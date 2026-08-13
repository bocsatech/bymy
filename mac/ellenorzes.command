#!/bin/bash
# Gyors ellenőrzés: frissült-e a ~/Downloads/autosweb
set -euo pipefail

TARGET="$HOME/Downloads/autosweb"
HTML="$TARGET/public/index.html"

echo "Autosweb ellenőrzés: $TARGET"
echo ""

if [ ! -f "$HTML" ]; then
  echo "✗ Nincs telepítve. Futtasd: telepites.command"
  exit 1
fi

if grep -q 'home-stats-bar' "$HTML"; then
  echo "✓ Stats sáv: VAN"
else
  echo "✗ Stats sáv: NINCS (régi index.html)"
fi

if grep -q 'home-nearby' "$HTML"; then
  echo "✗ Közelben widget: MÉG VAN (régi)"
else
  echo "✓ Közelben widget: törölve"
fi

if grep -q 'home-search-form' "$HTML"; then
  echo "✗ Fejléc keresősáv: MÉG VAN (régi)"
else
  echo "✓ Fejléc keresősáv: törölve"
fi

VER=$(grep 'autosweb-version' "$HTML" | head -1 | sed 's/.*content="//;s/".*//')
echo "  Verzió meta: ${VER:-?}"

if lsof -ti:3456 >/dev/null 2>&1; then
  echo "✓ Szerver fut: http://127.0.0.1:3456/"
else
  echo "⚠ Szerver NEM fut — indítsd: ~/Desktop/Autosweb-indito.command"
fi

echo ""
echo "Ha ✗ van fent: cd ~/bocsa-app && git pull && autosweb/mac/frissites.command"
