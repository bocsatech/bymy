#!/bin/bash
# GitHub AddElAutod → bymy. Ha mindkettő megvan, AddElAutod törlődik.
set -euo pipefail
IOS="${1:-/Users/rbocsa/bymy/ios}"
cd "$IOS"

if [ -d AddElAutod ]; then
  if [ ! -d Bymy ]; then
    if [ -f AddElAutod/AddElAutodApp.swift ]; then
      sed -i '' 's/struct AddElAutodApp/struct BymyApp/' AddElAutod/AddElAutodApp.swift
      mv AddElAutod/AddElAutodApp.swift AddElAutod/BymyApp.swift
    fi
    mv AddElAutod Bymy
  else
    rm -rf AddElAutod
  fi
fi

if [ -d AddElAutod.xcodeproj ]; then
  if [ ! -d Bymy.xcodeproj ]; then
    mv AddElAutod.xcodeproj Bymy.xcodeproj
  else
    rm -rf AddElAutod.xcodeproj
  fi
fi

PBX="$IOS/Bymy.xcodeproj/project.pbxproj"
test -f "$PBX"
sed -i '' \
  -e 's/AddElAutodApp\.swift/BymyApp.swift/g' \
  -e 's/AddElAutod\.app/bymy.app/g' \
  -e 's/path = AddElAutod;/path = Bymy;/g' \
  -e 's|INFOPLIST_FILE = AddElAutod/Info.plist;|INFOPLIST_FILE = Bymy/Info.plist;|g' \
  -e 's/INFOPLIST_KEY_CFBundleDisplayName = "Bymy";/INFOPLIST_KEY_CFBundleDisplayName = bymy;/g' \
  -e 's/INFOPLIST_KEY_CFBundleDisplayName = "Add el autod";/INFOPLIST_KEY_CFBundleDisplayName = bymy;/g' \
  -e 's/PRODUCT_BUNDLE_IDENTIFIER = hu.addelautod.app;/PRODUCT_BUNDLE_IDENTIFIER = hu.bymy.app;/g' \
  -e 's/name = AddElAutod;/name = bymy;/g' \
  -e 's/productName = AddElAutod;/productName = bymy;/g' \
  -e 's/PBXNativeTarget "AddElAutod"/PBXNativeTarget "bymy"/g' \
  -e 's/PBXProject "AddElAutod"/PBXProject "bymy"/g' \
  -e 's/\/\* AddElAutod \*\//\/\* bymy \*\//g' \
  -e 's/\/\* AddElAutod.app \*\//\/\* bymy.app \*\//g' \
  "$PBX"

if [ -f Bymy/BymyApp.swift ]; then
  sed -i '' 's/struct AddElAutodApp/struct BymyApp/' Bymy/BymyApp.swift
fi

echo "Név: bymy  |  $IOS/Bymy.xcodeproj"
