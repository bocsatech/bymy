#!/bin/zsh
# Bocsatech admin (LEVEL1) + opcionális SMTP → Vercel Production, majd redeploy.
# Előbb add a .env.local-hoz:
#   LEVEL1_BOOTSTRAP_USERNAME=bocsatechadmin
#   LEVEL1_BOOTSTRAP_PASSWORD=...
#   LEVEL1_BOOTSTRAP_EMAIL=te@email.hu
# Dupla katt / Terminal: mac/vercel-level1-env.command
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Hiányzik: .env.local"
  echo ""
  echo "Példa sorok:"
  echo "  LEVEL1_BOOTSTRAP_USERNAME=bocsatechadmin"
  echo "  LEVEL1_BOOTSTRAP_PASSWORD=ErősJelszo123456"
  echo "  LEVEL1_BOOTSTRAP_EMAIL=te@email.hu"
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

L1_USER="${ENV[LEVEL1_BOOTSTRAP_USERNAME]:-bocsatechadmin}"
L1_PASS="${ENV[LEVEL1_BOOTSTRAP_PASSWORD]:-}"
L1_EMAIL="${ENV[LEVEL1_BOOTSTRAP_EMAIL]:-}"
SMTP_HOST="${ENV[SMTP_HOST]:-smtp.gmail.com}"
SMTP_PORT="${ENV[SMTP_PORT]:-587}"
SMTP_USER="${ENV[SMTP_USER]:-}"
SMTP_PASS="${ENV[SMTP_PASS]:-}"
SMTP_FROM="${ENV[SMTP_FROM]:-$SMTP_USER}"

if [[ -z "$L1_PASS" || -z "$L1_EMAIL" ]]; then
  echo "A .env.local-ban kötelező:"
  echo "  LEVEL1_BOOTSTRAP_USERNAME=bocsatechadmin"
  echo "  LEVEL1_BOOTSTRAP_PASSWORD=... (min. 12 karakter)"
  echo "  LEVEL1_BOOTSTRAP_EMAIL=te@email.hu  (ide megy az OTP)"
  echo ""
  echo "Opcionális (OTP emailben): SMTP_USER, SMTP_PASS, SMTP_FROM"
  read -r "?Enter..."
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "npx hiányzik (Node.js kell)."
  read -r "?Enter..."
  exit 1
fi

echo "→ Vercel bejelentkezés (ha kell)…"
npx --yes vercel login

echo "→ Projekt linkelése…"
npx --yes vercel link --yes --project bymy || npx --yes vercel link --yes

echo "→ Régi LEVEL1 / SMTP env eltávolítása (ha létezik)…"
for key in LEVEL1_BOOTSTRAP_USERNAME LEVEL1_BOOTSTRAP_PASSWORD LEVEL1_BOOTSTRAP_EMAIL \
  SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM DB_BACKEND; do
  npx --yes vercel env rm "$key" production --yes 2>/dev/null || true
done

echo "→ LEVEL1 admin env (Production)…"
printf '%s' "$L1_USER" | npx --yes vercel env add LEVEL1_BOOTSTRAP_USERNAME production
printf '%s' "$L1_PASS" | npx --yes vercel env add LEVEL1_BOOTSTRAP_PASSWORD production
printf '%s' "$L1_EMAIL" | npx --yes vercel env add LEVEL1_BOOTSTRAP_EMAIL production
printf '%s' "supabase" | npx --yes vercel env add DB_BACKEND production

if [[ -n "$SMTP_USER" && -n "$SMTP_PASS" ]]; then
  echo "→ SMTP env (Production)…"
  printf '%s' "$SMTP_HOST" | npx --yes vercel env add SMTP_HOST production
  printf '%s' "$SMTP_PORT" | npx --yes vercel env add SMTP_PORT production
  printf '%s' "$SMTP_USER" | npx --yes vercel env add SMTP_USER production
  printf '%s' "$SMTP_PASS" | npx --yes vercel env add SMTP_PASS production
  printf '%s' "$SMTP_FROM" | npx --yes vercel env add SMTP_FROM production
else
  echo "⚠ SMTP nincs a .env.local-ban — OTP kód a Bocsatech képernyőn jelenik meg."
fi

echo "→ Supabase jelszó szinkron + zárolás feloldás…"
export DB_BACKEND=supabase
node scripts/level1-unlock.mjs "$L1_USER" 2>/dev/null || true
node scripts/level1-bootstrap.mjs "$L1_USER" "$L1_EMAIL" "$L1_PASS" 2>/dev/null || true

echo "→ Production redeploy…"
npx --yes vercel --prod --yes

echo ""
echo "Kész."
echo "  Admin: https://bymy.vercel.app/Bocsatech.html"
echo "  Felhasználó: $L1_USER"
echo "  Jelszó: (a .env.local LEVEL1_BOOTSTRAP_PASSWORD)"
echo "  OTP email: $L1_EMAIL"
read -r "?Enter a bezáráshoz…"
