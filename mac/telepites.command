#!/bin/bash
# Csak a futtatáshoz kellő fájlok → ~/Downloads/autosweb (sem mac/, sem README)
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SOURCE="$REPO/autosweb"
TARGET="$HOME/Downloads/autosweb"
DESKTOP="$HOME/Desktop/Autosweb-indito.command"

echo "Autosweb telepítés"
echo "  Forrás: $SOURCE"
echo "  Cél:    $TARGET"
echo ""

cd "$REPO"
git fetch origin main 2>/dev/null || true
git checkout origin/main -- autosweb/ 2>/dev/null || true

mkdir -p "$TARGET/public" "$HOME/Desktop"

cp "$SOURCE/package.json" "$SOURCE/server.mjs" "$TARGET/"

if [ -d "$SOURCE/lib" ]; then
  rsync -a --delete "$SOURCE/lib/" "$TARGET/lib/"
fi

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$SOURCE/public/" "$TARGET/public/"
else
  rm -rf "$TARGET/public"
  cp -R "$SOURCE/public" "$TARGET/public"
fi
cp -R "$SOURCE/scripts" "$TARGET/" 2>/dev/null || true

cd "$TARGET"
node scripts/embed-ad-form.mjs 2>/dev/null || true
npm install
npx playwright install chromium 2>/dev/null || true
npx playwright install chrome 2>/dev/null || true

# SMTP példa a user home-ba
mkdir -p "$HOME/.autosweb"
if [ -f "$SOURCE/lib/mail.mjs" ] && [ ! -f "$HOME/.autosweb/smtp.example.json" ]; then
  cat > "$HOME/.autosweb/smtp.example.json" <<'EOF'
{
  "host": "smtp.gmail.com",
  "port": 587,
  "secure": false,
  "user": "te@gmail.com",
  "pass": "xxxx xxxx xxxx xxxx",
  "from": "Add el autod.hu <te@gmail.com>"
}
EOF
fi
if [ -f "$SOURCE/mac/smtp-beallitas.command" ]; then
  cp "$SOURCE/mac/smtp-beallitas.command" "$HOME/Desktop/Autosweb-smtp-beallitas.command" 2>/dev/null || true
  chmod +x "$HOME/Desktop/Autosweb-smtp-beallitas.command" 2>/dev/null || true
fi

cp "$SOURCE/mac/Autosweb-indito.command" "$DESKTOP"
chmod +x "$DESKTOP"

echo ""
echo "Kész."
echo "  Weboldal: $TARGET"
echo "  Indító:   $DESKTOP"
echo ""
echo "A Letöltések mappában: package.json, server.mjs, lib/, public/, node_modules/"
read -r -p "ENTER…" _ >/dev/null || true
