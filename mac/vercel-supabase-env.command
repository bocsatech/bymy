#!/bin/zsh
# Vercel env: SUPABASE_* a .env.local-ból → Production, majd redeploy.
# Dupla katt / Terminalből: mac/vercel-supabase-env.command
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Hiányzik: .env.local"
  read -r "?Enter..."
  exit 1
fi

# Betöltés (idézőjel nélkül)
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
ANON="${ENV[SUPABASE_ANON_KEY]:-}"
SVC="${ENV[SUPABASE_SERVICE_ROLE_KEY]:-}"

if [[ -z "$URL" || -z "$SVC" ]]; then
  echo "A .env.local-ban hiányzik SUPABASE_URL vagy SUPABASE_SERVICE_ROLE_KEY."
  read -r "?Enter..."
  exit 1
fi
if [[ "$SVC" == "your_service_role_key" || "$SVC" == *placeholder* ]]; then
  echo "A SUPABASE_SERVICE_ROLE_KEY még placeholder — előbb javítsd a .env.local-ban."
  read -r "?Enter..."
  exit 1
fi

echo "Projekt: $ROOT"
echo "SUPABASE_URL=$URL"
echo "ANON len=${#ANON}  SERVICE len=${#SVC}"
echo ""

if ! command -v npx >/dev/null 2>&1; then
  echo "npx hiányzik (Node.js kell)."
  read -r "?Enter..."
  exit 1
fi

echo "→ Vercel bejelentkezés (ha kell, böngésző nyílik)…"
npx --yes vercel login

echo "→ Projekt linkelése…"
npx --yes vercel link --yes --project bymy || npx --yes vercel link --yes

echo "→ Régi értékek eltávolítása (ha léteznek)…"
for key in SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
  npx --yes vercel env rm "$key" production --yes 2>/dev/null || true
done

echo "→ Új env változók (Production)…"
printf '%s' "$URL" | npx --yes vercel env add SUPABASE_URL production
if [[ -n "$ANON" ]]; then
  printf '%s' "$ANON" | npx --yes vercel env add SUPABASE_ANON_KEY production
fi
printf '%s' "$SVC" | npx --yes vercel env add SUPABASE_SERVICE_ROLE_KEY production

echo "→ Production redeploy…"
npx --yes vercel --prod --yes

echo ""
echo "Kész. Nyisd meg: https://bymy.vercel.app/belepes.html"
read -r "?Enter a bezáráshoz…"
