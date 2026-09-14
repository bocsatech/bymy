#!/bin/zsh
# S1 (bymy.hu / bymy-app): Supabase env a .env.local-ból → VPS .env.local, majd pm2 restart.
# Előbb .env.local-ban: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, S1_SSH, S1_APP_DIR
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Hiányzik: .env.local"
  read -r "?Enter..."
  exit 1
fi

typeset -A ENV
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"
  line="$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  [[ -z "$line" ]] && continue
  [[ "$line" != *=* ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  key="$(echo "$key" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  val="$(echo "$val" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^["'\'']//' -e 's/["'\'']$//')"
  ENV[$key]="$val"
done < "$ENV_FILE"

URL="${ENV[SUPABASE_URL]:-}"
SVC="${ENV[SUPABASE_SERVICE_ROLE_KEY]:-}"
ANON="${ENV[SUPABASE_ANON_KEY]:-}"
S1_SSH="${ENV[S1_SSH]:-}"
S1_APP_DIR="${ENV[S1_APP_DIR]:-}"
PUBLIC_BASE="${ENV[PUBLIC_BASE_URL]:-https://bymy.hu}"
SUPABASE_PUBLIC="${ENV[SUPABASE_PUBLIC_URL]:-$PUBLIC_BASE}"

if [[ -z "$URL" || -z "$SVC" ]]; then
  echo "Hiányzik SUPABASE_URL vagy SUPABASE_SERVICE_ROLE_KEY a .env.local-ban."
  read -r "?Enter..."
  exit 1
fi

if [[ -z "$S1_SSH" || -z "$S1_APP_DIR" ]]; then
  echo "Hiányzik S1_SSH vagy S1_APP_DIR a .env.local-ban."
  echo "Példa:"
  echo "  S1_SSH=deploy@your-vps"
  echo "  S1_APP_DIR=/var/www/bymy-app"
  read -r "?Enter..."
  exit 1
fi

REMOTE_ENV="${ENV[S1_ENV]:-${S1_APP_DIR}/.env}"
TMP="$(mktemp)"
{
  echo "# Generálva: mac/s1-supabase-env.command ($(date -Iseconds))"
  echo "DB_BACKEND=supabase"
  echo "SUPABASE_URL=$URL"
  echo "SUPABASE_SERVICE_ROLE_KEY=$SVC"
  [[ -n "$ANON" ]] && echo "SUPABASE_ANON_KEY=$ANON"
  echo "SUPABASE_PUBLIC_URL=$SUPABASE_PUBLIC"
  echo "PUBLIC_BASE_URL=$PUBLIC_BASE"
  echo "NODE_ENV=production"
} > "$TMP"

echo "→ S1 env feltöltés: $S1_SSH:$REMOTE_ENV"
scp "$TMP" "${S1_SSH}:${REMOTE_ENV}.new"
ssh "$S1_SSH" "mv '${REMOTE_ENV}.new' '${REMOTE_ENV}' && cd '${S1_APP_DIR}' && (pm2 restart bymy-app 2>/dev/null || pm2 restart all 2>/dev/null || echo 'pm2 restart manuálisan')"

rm -f "$TMP"
echo ""
echo "Kész. Ellenőrizd: https://bymy.hu/api/health"
read -r "?Enter a bezáráshoz…"
