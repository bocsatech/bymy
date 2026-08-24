#!/bin/zsh
# Google OAuth → .env.local-ból Vercel Production + helyi oauth.json, majd redeploy.
# Dupla katt / Terminalből: mac/vercel-oauth-env.command
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

GOOGLE_ID="${ENV[GOOGLE_CLIENT_ID]:-${ENV[OAUTH_GOOGLE_CLIENT_ID]:-}}"
GOOGLE_SECRET="${ENV[GOOGLE_CLIENT_SECRET]:-${ENV[OAUTH_GOOGLE_CLIENT_SECRET]:-}}"
STATE_SECRET="${ENV[OAUTH_STATE_SECRET]:-}"
PUBLIC_BASE="${ENV[OAUTH_PUBLIC_BASE_URL]:-${ENV[PUBLIC_BASE_URL]:-https://bymy.vercel.app}}"

if [[ -z "$GOOGLE_ID" || -z "$GOOGLE_SECRET" ]]; then
  echo "A .env.local-ban add meg:"
  echo "  GOOGLE_CLIENT_ID=....apps.googleusercontent.com"
  echo "  GOOGLE_CLIENT_SECRET=...."
  echo ""
  echo "Google Cloud → OAuth client (Web) → Redirect URI:"
  echo "  ${PUBLIC_BASE%/}/api/auth/oauth/callback/google"
  read -r "?Enter..."
  exit 1
fi

if [[ -z "$STATE_SECRET" ]]; then
  STATE_SECRET="$(openssl rand -hex 24 2>/dev/null || date +%s | shasum | cut -c1-48)"
  echo "OAUTH_STATE_SECRET generálva (mentsd a .env.local-ba is):"
  echo "OAUTH_STATE_SECRET=$STATE_SECRET"
fi

mkdir -p "$HOME/.autosweb"
node - <<NODE
const fs = require("fs");
const path = require("path");
const cfg = {
  publicBaseUrl: process.env.PUBLIC_BASE || "https://bymy.vercel.app",
  stateSecret: process.env.STATE_SECRET,
  google: {
    enabled: true,
    clientId: process.env.GOOGLE_ID,
    clientSecret: process.env.GOOGLE_SECRET,
  },
  facebook: { enabled: false, appId: "", appSecret: "" },
  apple: {
    enabled: false,
    clientId: "com.example.web",
    teamId: "",
    keyId: "",
    privateKeyPath: "~/.autosweb/AuthKey_XXXXX.p8",
  },
};
fs.writeFileSync(
  path.join(process.env.HOME, ".autosweb", "oauth.json"),
  JSON.stringify(cfg, null, 2) + "\n",
  "utf8"
);
console.log("Helyi oauth.json frissítve: ~/.autosweb/oauth.json");
NODE

export GOOGLE_ID GOOGLE_SECRET STATE_SECRET PUBLIC_BASE

echo "Projekt: $ROOT"
echo "PUBLIC_BASE=$PUBLIC_BASE"
echo "GOOGLE_CLIENT_ID=${GOOGLE_ID:0:24}..."
echo ""

if ! command -v npx >/dev/null 2>&1; then
  echo "npx hiányzik (Node.js kell)."
  read -r "?Enter..."
  exit 1
fi

echo "→ Vercel bejelentkezés (ha kell)…"
npx --yes vercel login

echo "→ Projekt linkelése…"
npx --yes vercel link --yes --project bymy || npx --yes vercel link --yes

echo "→ Régi OAuth env eltávolítása (ha létezik)…"
for key in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET OAUTH_STATE_SECRET OAUTH_PUBLIC_BASE_URL PUBLIC_BASE_URL; do
  npx --yes vercel env rm "$key" production --yes 2>/dev/null || true
done

echo "→ Új OAuth env (Production)…"
printf '%s' "$GOOGLE_ID" | npx --yes vercel env add GOOGLE_CLIENT_ID production
printf '%s' "$GOOGLE_SECRET" | npx --yes vercel env add GOOGLE_CLIENT_SECRET production
printf '%s' "$STATE_SECRET" | npx --yes vercel env add OAUTH_STATE_SECRET production
printf '%s' "${PUBLIC_BASE%/}" | npx --yes vercel env add OAUTH_PUBLIC_BASE_URL production
printf '%s' "${PUBLIC_BASE%/}" | npx --yes vercel env add PUBLIC_BASE_URL production

echo "→ Production redeploy…"
npx --yes vercel --prod --yes

echo ""
echo "Kész. Teszt: ${PUBLIC_BASE%/}/belepes.html → Folytatás Google-lal"
read -r "?Enter a bezáráshoz…"
