#!/bin/zsh
# Gmail SMTP → Vercel Production (OTP emailhez). Forrás: ~/.autosweb/smtp.json
# Dupla katt / Terminal: mac/vercel-smtp-env.command
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1 || ! command -v npx >/dev/null 2>&1; then
  echo "Node.js + npx kell."
  read -r "?Enter..."
  exit 1
fi

read -r SMTP_JSON SMTP_USER SMTP_PASS SMTP_FROM SMTP_HOST SMTP_PORT <<EOF
$(node -e "
const fs=require('fs'); const os=require('os'); const p=os.homedir()+'/.autosweb/smtp.json';
const j=JSON.parse(fs.readFileSync(p,'utf8'));
if (!j.user||!j.pass) { console.error('Hiányos smtp.json (user/pass)'); process.exit(1); }
console.log([p,j.user,String(j.pass).replace(/\\s+/g,''),j.from||j.user,j.host||'smtp.gmail.com',String(j.port??587)].join('\\t'));
")
EOF

echo "→ Vercel bejelentkezés (ha kell)…"
npx --yes vercel login
echo "→ Projekt linkelése…"
npx --yes vercel link --yes --project bymy || npx --yes vercel link --yes

echo "→ Régi SMTP env törlése…"
for key in SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM SMTP_SECURE; do
  npx --yes vercel env rm "$key" production --yes 2>/dev/null || true
done

echo "→ SMTP env (Production) — forrás: $SMTP_JSON"
printf '%s' "$SMTP_HOST" | npx --yes vercel env add SMTP_HOST production
printf '%s' "$SMTP_PORT" | npx --yes vercel env add SMTP_PORT production
printf '%s' "$SMTP_USER" | npx --yes vercel env add SMTP_USER production
printf '%s' "$SMTP_PASS" | npx --yes vercel env add SMTP_PASS production
printf '%s' "$SMTP_FROM" | npx --yes vercel env add SMTP_FROM production

echo "→ Production redeploy…"
npx --yes vercel --prod --yes

echo ""
echo "Kész. Teszt: https://bymy.vercel.app/Bocsatech.html"
echo "Ha még mindig SMTP hiba: új Gmail app jelszó → ~/.autosweb/smtp.json → futtasd újra ezt a scriptet."
read -r "?Enter a bezáráshoz…"
