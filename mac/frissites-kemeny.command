#!/bin/bash
# Kényszerített frissítés — ha a sima frissites nem elég
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SOURCE="$REPO/autosweb"
TARGET="$HOME/Downloads/autosweb"

echo "=== Autosweb KÉNYSZERÍTETT frissítés ==="
echo "Repo: $REPO"
echo ""

cd "$REPO"
git fetch origin main
git reset --hard origin/main

if [ ! -d "$TARGET" ]; then
  echo "Nincs ~/Downloads/autosweb — telepites.command futtatása…"
  exec "$(dirname "$0")/telepites.command"
fi

echo "Port 3456 leállítása…"
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti:3456 2>/dev/null || true)
  [ -n "$PIDS" ] && kill -9 $PIDS 2>/dev/null || true
fi

echo "Régi public/ törlése és újramásolás…"
rm -rf "$TARGET/public"
mkdir -p "$TARGET/public"

cp "$SOURCE/package.json" "$SOURCE/server.mjs" "$TARGET/"
rsync -a --delete "$SOURCE/lib/" "$TARGET/lib/"
rsync -a "$SOURCE/public/" "$TARGET/public/"
cp -R "$SOURCE/scripts" "$TARGET/" 2>/dev/null || true

cd "$TARGET"
node scripts/embed-ad-form.mjs
npm install

cp "$SOURCE/mac/Autosweb-indito.command" "$HOME/Desktop/Autosweb-indito.command"
chmod +x "$HOME/Desktop/Autosweb-indito.command"

echo ""
grep -q 'home-stats-bar' "$TARGET/public/index.html" && echo "✓ home-stats-bar VAN" || { echo "✗ home-stats-bar HIÁNYZIK"; exit 1; }
grep -q 'home-nearby' "$TARGET/public/index.html" && { echo "✗ home-nearby MÉG VAN"; exit 1; } || echo "✓ home-nearby NINCS"
grep -q 'home-search-form' "$TARGET/public/index.html" && { echo "✗ home-search-form MÉG VAN"; exit 1; } || echo "✓ keresősáv NINCS"

echo ""
echo "Kész. Indítsd: ~/Desktop/Autosweb-indito.command"
echo "Böngésző: http://127.0.0.1:3456/  majd Cmd+Shift+R"
