#!/bin/bash
# Bymy helyi web — localhost:3456
set -euo pipefail

ROOT="/Users/rbocsa/bymy"
PORT=3456
URL="http://127.0.0.1:${PORT}/"

echo "══════════════════════════════════════"
echo " local web — Bymy"
echo "══════════════════════════════════════"
echo "Mappa: $ROOT"
echo "URL:   $URL"
echo ""

if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "Régi szerver leállítása (${PORT})…"
    # shellcheck disable=SC2086
    kill $PIDS 2>/dev/null || true
    sleep 1
  fi
fi

cd "$ROOT"
mkdir -p "$ROOT/data"

export LEVEL1_DB_PATH="${LEVEL1_DB_PATH:-$ROOT/data/level1.db}"

if [ ! -d node_modules ]; then
  echo "npm install…"
  npm install
fi

echo "Indítás… (bezárás: Ctrl+C)"
echo ""

open "$URL" 2>/dev/null || true
npm start
