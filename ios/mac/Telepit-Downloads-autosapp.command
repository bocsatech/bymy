#!/bin/bash
# Egyszerű telepítő: ~/Downloads/autosapp + Xcode megnyitás
# Fontos: az .xcodeproj mappa (bundle) — benne kell legyen a project.pbxproj
set -euo pipefail

DEST="$HOME/Downloads/autosapp"
BRANCH="cursor/addelautod-mobile-de62"
REPO="https://github.com/bocsatech/bocsa-app.git"
TMP="$HOME/Downloads/autosapp-tmp-clone"

echo "1) Régi mappa törlése: $DEST"
mkdir -p "$HOME/Downloads"
rm -rf "$TMP"
rm -rf "$DEST"
mkdir -p "$DEST"

echo "2) GitHub letöltés ($BRANCH)..."
if ! command -v git >/dev/null 2>&1; then
  echo "HIBA: nincs git. Telepítsd: xcode-select --install"
  exit 1
fi

git clone --depth 1 --branch "$BRANCH" "$REPO" "$TMP"

SRC_PROJ="$TMP/addelautod-ios/AddElAutod.xcodeproj"
SRC_APP="$TMP/addelautod-ios/AddElAutod"
PBX="$SRC_PROJ/project.pbxproj"

if [[ ! -f "$PBX" ]]; then
  echo "HIBA: a klónban nincs project.pbxproj: $PBX"
  ls -la "$TMP/addelautod-ios" || true
  exit 1
fi

echo "3) Másolás (ditto — Xcode bundle biztonságos)..."
# ditto megőrzi a .xcodeproj csomagot; cp -R néha elrontja Finderrel
if command -v ditto >/dev/null 2>&1; then
  ditto "$SRC_APP" "$DEST/AddElAutod"
  ditto "$SRC_PROJ" "$DEST/AddElAutod.xcodeproj"
else
  cp -R "$SRC_APP" "$DEST/"
  cp -R "$SRC_PROJ" "$DEST/"
fi
cp "$TMP/addelautod-ios/README.md" "$DEST/" 2>/dev/null || true
rm -rf "$TMP"

DEST_PBX="$DEST/AddElAutod.xcodeproj/project.pbxproj"
if [[ ! -f "$DEST_PBX" ]]; then
  echo "HIBA: másolás után nincs project.pbxproj"
  echo "Tartalom:"
  ls -laR "$DEST" | head -80
  exit 1
fi

echo "4) Ellenőrzés OK: $DEST_PBX ($(wc -c < "$DEST_PBX") byte)"
echo "5) Xcode megnyitás..."
open "$DEST/AddElAutod.xcodeproj" || open -a Xcode "$DEST/AddElAutod.xcodeproj"

echo ""
echo "KESZ: $DEST"
echo "Ha mégis hibázik: Quit Xcode teljesen, majd:"
echo "  open ~/Downloads/autosapp/AddElAutod.xcodeproj"
