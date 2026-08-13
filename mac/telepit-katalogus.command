#!/bin/bash
# Egy parancs: feature ág + másolás a futó Autosweb mappába + ellenőrzés
set -euo pipefail

MAC_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$MAC_DIR/../.." && pwd)"
SOURCE="$REPO/autosweb"
BRANCH="cursor/mentesmarka-csv-katalogus-2aa0"

# Cél: ahol tényleg fut (nálad: ~/Downloads/autosweb)
if [ -d "${HOME}/Downloads/autosweb" ]; then
  TARGET="${HOME}/Downloads/autosweb"
elif [ -d "${HOME}/Letöltések/autosweb" ]; then
  TARGET="${HOME}/Letöltések/autosweb"
elif [ -d "${HOME}/Letöltések" ]; then
  TARGET="${HOME}/Letöltések/autosweb"
else
  TARGET="${HOME}/Downloads/autosweb"
fi

echo "══════════════════════════════════════"
echo " Autosweb járműkatalógus telepítés"
echo "══════════════════════════════════════"
echo "  Repo:   $REPO"
echo "  Ág:     $BRANCH"
echo "  Cél:    $TARGET"
echo ""

cd "$REPO"

echo "→ Helyi módosítások félretéve (stash)…"
git stash push -u -m "autosweb-katalogus-telepit-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true

echo "→ Ág lekérése…"
git fetch origin "$BRANCH"
git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
git pull origin "$BRANCH"

if [ ! -f "$SOURCE/lib/jarmu-katalogus.mjs" ]; then
  echo "✗ Nincs jarmu-katalogus.mjs a forrásban — pull sikertelen?"
  exit 1
fi

echo "→ Másolás → $TARGET …"
mkdir -p "$TARGET"
cp "$SOURCE/package.json" "$SOURCE/server.mjs" "$TARGET/"
mkdir -p "$TARGET/lib" "$TARGET/public" "$TARGET/scripts" "$TARGET/mac"
rsync -a --delete "$SOURCE/lib/" "$TARGET/lib/"
cp -R "$SOURCE/scripts/." "$TARGET/scripts/" 2>/dev/null || true
cp -R "$SOURCE/mac/." "$TARGET/mac/" 2>/dev/null || true

# public másolás — kategória képek megőrzése
RSYNC_SH="$MAC_DIR/rsync-public-preserve-images.sh"
if [ -f "$RSYNC_SH" ]; then
  bash "$RSYNC_SH" "$SOURCE" "$TARGET" || rsync -a "$SOURCE/public/" "$TARGET/public/"
else
  rsync -a "$SOURCE/public/" "$TARGET/public/"
fi

cd "$TARGET"
if [ -f scripts/embed-ad-form.mjs ]; then
  node scripts/embed-ad-form.mjs 2>/dev/null || true
fi

echo ""
echo "→ Ellenőrzés…"
FAIL=0
VER=$(cat "$TARGET/public/version.txt" 2>/dev/null || echo "HIÁNYZIK")
echo "  Verzió: $VER"

if [ ! -f "$TARGET/lib/jarmu-katalogus.mjs" ]; then
  echo "  ✗ jarmu-katalogus.mjs hiányzik"; FAIL=1
else
  echo "  ✓ jarmu-katalogus.mjs"
fi

if grep -q 'jarmu-katalogus-ui' "$TARGET/public/js/form-core.js" 2>/dev/null; then
  echo "  ✓ form-core.js katalógus kötés"
else
  echo "  ✗ form-core.js régi"; FAIL=1
fi

if grep -q '<select id="modell"' "$TARGET/public/hirdetesfeladas.html" 2>/dev/null; then
  echo "  ✓ modell = select"
else
  echo "  ✗ modell még nem select"; FAIL=1
fi

if grep -q '<select id="tipus"' "$TARGET/public/hirdetesfeladas.html" 2>/dev/null; then
  echo "  ✓ tipus = select"
else
  echo "  ✗ tipus még nem select"; FAIL=1
fi

CSV=""
for C in "${HOME}/Letöltések/mentesmarka/jarmu-katalogus.csv" \
         "${HOME}/Downloads/mentesmarka/jarmu-katalogus.csv" \
         "${HOME}/Letöltések/mentesmarka/jarmu-katalogus.append.csv" \
         "${HOME}/Downloads/mentesmarka/jarmu-katalogus.append.csv"; do
  if [ -f "$C" ]; then CSV="$C"; break; fi
done
if [ -n "$CSV" ]; then
  echo "  ✓ Katalógus CSV: $CSV"
else
  echo "  ⚠ Nincs CSV — a legördülők üresek lesznek."
  echo "    Futtasd a mentesmarka programot → Letöltések/mentesmarka/"
fi

cp "$MAC_DIR/Autosweb-indito.command" "$HOME/Desktop/Autosweb-indito.command" 2>/dev/null || true
chmod +x "$HOME/Desktop/Autosweb-indito.command" 2>/dev/null || true

if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti:3456 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "→ Régi szerver leállítása (3456)…"
    kill -9 $PIDS 2>/dev/null || true
    sleep 1
  fi
fi

if [ "$FAIL" -ne 0 ]; then
  echo ""
  echo "✗ Telepítés hibás — ne indítsd még."
  exit 1
fi

echo ""
echo "══════════════════════════════════════"
echo " KÉSZ"
echo "══════════════════════════════════════"
echo "1) Indítsd: ~/Desktop/Autosweb-indito.command"
echo "   vagy:    cd \"$TARGET\" && npm start"
echo "2) Nyisd:   http://127.0.0.1:3456/hirdetesfeladas.html"
echo "3) Cmd+Shift+R"
echo ""
echo "Ha jó: Gyártmány / Modell / Típus mind legördülő."
