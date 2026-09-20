#!/bin/bash
# Supabase Studio (S2 bymy-data) — SSH tunnel, majd böngésző.
set -euo pipefail
HOST="${BYMY_S2_HOST:-bymy-data}"
LOCAL_PORT="${BYMY_STUDIO_LOCAL_PORT:-54323}"
URL="http://127.0.0.1:${LOCAL_PORT}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! ssh -o ConnectTimeout=5 "$HOST" "test -S /var/run/docker.sock" 2>/dev/null; then
  echo "Nem érhető el: $HOST (ssh bymy-data echo ok)"
  exit 1
fi

if ! ssh "$HOST" "ss -tln | grep -q ':${LOCAL_PORT} '" 2>/dev/null; then
  echo "Studio még nincs localhoston az S2-n — telepítés…"
  (cd "$ROOT" && node scripts/s2-studio-localhost.mjs)
fi

if lsof -iTCP:"${LOCAL_PORT}" -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "A ${LOCAL_PORT} port már foglalt (régi tunnel?). Próbáld: kill \$(lsof -t -iTCP:${LOCAL_PORT} -sTCP:LISTEN)"
fi

echo "SSH tunnel indítása → ${URL}"
ssh -N -L "${LOCAL_PORT}:127.0.0.1:${LOCAL_PORT}" "$HOST" &
SSH_PID=$!
cleanup() {
  kill "$SSH_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for _ in $(seq 1 50); do
  if curl -s -o /dev/null --connect-timeout 0.3 "$URL" 2>/dev/null; then
    break
  fi
  sleep 0.15
done

if ! curl -s -o /dev/null --connect-timeout 1 "$URL" 2>/dev/null; then
  echo "A tunnel nem épült fel. Ellenőrizd: ssh ${HOST} echo ok"
  exit 1
fi

echo "Megnyitás: $URL"
open "$URL" 2>/dev/null || true
echo "Tunnel fut — ne zárd be ezt az ablakot (Ctrl+C = leállítás)."
wait "$SSH_PID"
