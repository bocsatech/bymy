#!/bin/bash
# Közvetlen másolás Downloads-ba — git nélkül is, ha a forrás friss
set -euo pipefail

SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$HOME/Downloads/autosweb"

if [ ! -d "$TARGET" ]; then
  echo "Először: ./telepites.command"
  exit 1
fi

cp "$SOURCE/package.json" "$SOURCE/server.mjs" "$TARGET/"
rsync -a --delete "$SOURCE/lib/" "$TARGET/lib/"
rsync -a --delete "$SOURCE/scripts/" "$TARGET/scripts/"
"$(dirname "$0")/rsync-public-preserve-images.sh" "$SOURCE" "$TARGET"

# Járműkatalógus az Asztalon lévő lista.csv-ből (a data/ mappát nem törli).
if [ -f "$HOME/Desktop/lista.csv" ]; then
  (cd "$TARGET" && npm run import:catalog -- "$HOME/Desktop/lista.csv") &&
    echo "  ✓ lista.csv importálva" ||
    echo "  ⚠ lista.csv import sikertelen — a többi fájl attól még átmásolva"
fi

VER=$(cat "$TARGET/public/version.txt" 2>/dev/null || echo "HIÁNYZIK")
echo ""
echo "✓ Másolva: $TARGET"
echo "  Verzió: $VER"

if [ ! -f "$TARGET/public/css/site-app.css" ]; then
  echo "  ✗ HIBA: site-app.css hiányzik!"
  exit 1
fi
if grep -q 'site-app' "$TARGET/public/hirdetesfeladas.html"; then
  echo "  ✓ site-app téma"
else
  echo "  ✗ HIBA: régi HTML — nincs site-app!"
  exit 1
fi

cp "$(dirname "$0")/Autosweb-indito.command" "$HOME/Desktop/Autosweb-indito.command" 2>/dev/null || true
chmod +x "$HOME/Desktop/Autosweb-indito.command" 2>/dev/null || true
echo "  ✓ Asztali indító frissítve"

echo ""
echo "Következő lépések:"
echo "  1) Állítsd le a futó Autosweb-et (Ctrl+C)"
echo "  2) Indítsd: ~/Desktop/Autosweb-indito.command"
echo "  3) Böngésző: Cmd+Shift+R"
