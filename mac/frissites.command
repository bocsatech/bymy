#!/bin/bash
# Frissítés: GitHub-ról CSAK autosweb → ~/Downloads/autosweb
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SOURCE="$REPO/autosweb"
TARGET="$HOME/Downloads/autosweb"

echo "Autosweb frissítés (GitHub main → Letöltések)…"
echo "  Repo: $REPO"
echo ""

cd "$REPO"
git fetch origin main
git pull origin main -- autosweb/ 2>/dev/null || git checkout origin/main -- autosweb/

if [ ! -d "$TARGET" ]; then
  echo "Nincs telepítve. Futtasd: ./telepites.command"
  exit 1
fi

cp "$SOURCE/package.json" "$SOURCE/server.mjs" "$TARGET/"
cp -R "$SOURCE/scripts" "$TARGET/" 2>/dev/null || true
rsync -a --delete "$SOURCE/lib/" "$TARGET/lib/"
"$(dirname "$0")/rsync-public-preserve-images.sh" "$SOURCE" "$TARGET"

cd "$TARGET"
node scripts/embed-ad-form.mjs
npm install
npx playwright install chromium 2>/dev/null || true
npx playwright install chrome 2>/dev/null || true

if [ -f "$HOME/Desktop/lista.csv" ]; then
  echo ""
  echo "Járműkatalógus import (~/Desktop/lista.csv)…"
  if npm run import:catalog -- "$HOME/Desktop/lista.csv"; then
    echo "  ✓ lista.csv → data/vehicle-catalog.json"
  else
    echo "  ✗ Import sikertelen — ellenőrizd a CSV fejlécét (Gyartmany, Modell, Tipus)"
  fi
elif [ -f "$HOME/Downloads/lista.csv" ]; then
  echo ""
  echo "Járműkatalógus import (~/Downloads/lista.csv)…"
  npm run import:catalog -- "$HOME/Downloads/lista.csv" && echo "  ✓ lista.csv importálva"
else
  echo ""
  echo "  ⚠ Nincs lista.csv az Asztalon — márka/modell legördülők üresek maradhatnak."
  echo "    Import kézzel: cd ~/Downloads/autosweb && npm run import:catalog -- ~/Desktop/lista.csv"
fi

if grep -q 'vehicle-catalog-client.js' "$TARGET/public/js/form-core.js" 2>/dev/null; then
  echo "  ✓ járműkatalógus JS OK"
else
  echo "  ✗ HIBA: vehicle-catalog hiányzik — git pull + frissites újra"
  exit 1
fi

if grep -q 'tipus_katalogus' "$TARGET/public/hirdetesfeladas.html" 2>/dev/null &&
   grep -q 'filter-tipus-katalogus' "$TARGET/public/index.html" 2>/dev/null; then
  echo "  ✓ típus legördülő (évjárat szerint) OK"
else
  echo "  ✗ HIBA: régi HTML — nincs típus legördülő (git pull + frissites újra)"
  exit 1
fi

if [ -f "$TARGET/data/vehicle-catalog.json" ]; then
  MODEL_COUNT=$(node -e "const c=require('./data/vehicle-catalog.json'); console.log(Object.values(c.modellek||{}).reduce((n,a)=>n+a.length,0))" 2>/dev/null || echo 0)
  echo "  ✓ vehicle-catalog.json ($MODEL_COUNT modell)"
else
  echo "  ⚠ Nincs vehicle-catalog.json — tedd az Asztalra a lista.csv-t, majd frissites újra"
fi

VER=$(cat "$TARGET/public/version.txt" 2>/dev/null || echo "HIÁNYZIK")
echo "  ✓ Kategória képek: lokális fájlok megmaradtak (public/images/categories/)"
echo "  ✓ Hirdetésképek: ~/.autosweb/uploads/listings/ (nem a public/ mappa)"

if [ ! -f "$TARGET/public/css/automax.css" ]; then
  echo "  ✗ HIBA: automax.css hiányzik — git pull sikertelen?"
  exit 1
fi
if grep -q 'site-app' "$TARGET/public/hirdetesfeladas.html"; then
  echo "  ✓ site-app téma OK"
else
  echo "  ✗ HIBA: régi HTML — nincs site-app!"
  exit 1
fi

if [ ! -f "$TARGET/public/css/site-app.css" ]; then
  echo "  ✗ HIBA: site-app.css hiányzik — git pull sikertelen?"
  exit 1
fi

if [ ! -f "$TARGET/public/fugveny.html" ]; then
  echo "  ✗ HIBA: fugveny.html hiányzik — git pull / frissítés sikertelen?"
  exit 1
fi
if [ ! -f "$TARGET/lib/fugveny-api.mjs" ]; then
  echo "  ✗ HIBA: fugveny-api.mjs hiányzik"
  exit 1
fi
echo "  ✓ Függvény oldal OK (/fugveny.html)"

if grep -q 'id="gyartasi_ev"' "$TARGET/public/import.html" 2>/dev/null; then
  echo "  ✓ Import űrlap OK"
else
  echo "  ✗ HIBA: import.html űrlap hiányzik!"
  exit 1
fi

if grep -q 'home-stats-bar' "$TARGET/public/index.html" 2>/dev/null; then
  echo "  ✓ Főoldal: stats sáv OK"
else
  echo "  ✗ HIBA: index.html régi — nincs home-stats-bar (git pull + frissites újra)"
  exit 1
fi

if ! grep -q 'home-search-form' "$TARGET/public/index.html" 2>/dev/null; then
  echo "  ✓ Főoldal: fejléc keresősáv törölve"
else
  echo "  ✗ HIBA: index.html még tartalmazza a fejléc keresőt"
  exit 1
fi

if grep -q 'home-stats-postal' "$TARGET/public/index.html" 2>/dev/null; then
  echo "  ✓ stats irányítószám mező OK"
else
  echo "  ✗ HIBA: hiányzik a stats irányítószám mező"
  exit 1
fi

if grep -q 'partner-recommendations-init.js' "$TARGET/public/index.html" 2>/dev/null; then
  echo "  ✓ partner accordion init OK"
else
  echo "  ✗ HIBA: partner-recommendations-init.js hiányzik — git pull + frissites újra"
  exit 1
fi

if grep -q 'home-partner-accordion' "$TARGET/public/js/partner-recommendations.js" 2>/dev/null; then
  echo "  ✓ partner accordion JS OK"
else
  echo "  ✗ HIBA: partner-recommendations.js régi — git pull + frissites újra"
  exit 1
fi

if grep -q 'qscatalog20260730\|katalogus20260727\|headerorder20260730\|indito-autoupdate' "$TARGET/public/index.html" 2>/dev/null; then
  echo "  ✓ főoldal verzió OK (járműkatalógus)"
else
  echo "  ✗ HIBA: index.html régi — járműkatalógus verzió hiányzik"
  exit 1
fi

if [ -f "$TARGET/public/data/vehicle-catalog.json" ] || [ -f "$TARGET/data/vehicle-catalog.json" ]; then
  echo "  ✓ járműkatalógus fájl megvan (API + /data fallback)"
else
  echo "  ⚠ Nincs vehicle-catalog.json — lista.csv import kell a márka listához"
fi

INDEX_VER=$(grep -o 'autosweb-version" content="[^"]*' "$TARGET/public/index.html" | head -1 | sed 's/.*"//')
echo "  Főoldal verzió: ${INDEX_VER:-?}"

echo ""
echo "✓ Frissítve: $TARGET"
echo "  Verzió: $VER"
echo ""
echo "  Mostantól elég az Asztali Autosweb-indito.command —"
echo "  induláskor maga tölti le a GitHub frissítést, nem kell külön terminál."
echo "  1) Indítsd: ~/Desktop/Autosweb-indito.command"
echo "  2) Böngésző: http://127.0.0.1:3456/  (NEM a Vercel weboldal!)"
echo "  3) Cmd+Shift+R (kemény frissítés)"
echo ""
echo "Jó verzió = világos háttér, nincs fejléc keresősáv, stats sáv a kategóriák alatt, középső hirdetésrács görget."

if grep -q 'home-scroll-fix' "$TARGET/public/index.html" 2>/dev/null; then
  echo "  ✓ Főoldal: egyetlen görgetés (inline scroll fix) OK"
else
  echo "  ✗ HIBA: index.html régi — nincs home-scroll-fix (git pull + frissites újra)"
  exit 1
fi

if grep -q 'max-height: calc(100vh' "$TARGET/public/css/home.css" 2>/dev/null; then
  echo "  ✗ HIBA: home.css még tartalmazza a külön oldalsáv scrollt"
  exit 1
fi

DESKTOP="$HOME/Desktop/Autosweb-indito.command"
if [ -f "$SOURCE/mac/Autosweb-indito.command" ]; then
  cp "$SOURCE/mac/Autosweb-indito.command" "$DESKTOP"
  chmod +x "$DESKTOP"
  echo "  ✓ Asztali indító frissítve: $DESKTOP"
fi
