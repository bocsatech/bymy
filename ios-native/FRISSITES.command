#!/bin/bash
set -euo pipefail
echo "=== bymy iOS frissítés ==="
IOS=/Users/rbocsa/bymy/ios
cd /Users/rbocsa/bocsa-app
git fetch origin cursor/addelautod-mobile-de62
COMMIT=48b66a30
echo "Letöltés: $COMMIT"
rm -rf /tmp/bymy-ios-dl
mkdir -p /tmp/bymy-ios-dl
git archive "$COMMIT" addelautod-ios | tar -x -C /tmp/bymy-ios-dl
# Ne keverjük: csak temp, aztán rename, aztán egy Bymy
bash "$IOS/scripts/rename-to-bymy.sh" /tmp/bymy-ios-dl/addelautod-ios
rm -rf "$IOS/AddElAutod" "$IOS/AddElAutod.xcodeproj"
ditto /tmp/bymy-ios-dl/addelautod-ios/Bymy "$IOS/Bymy"
ditto /tmp/bymy-ios-dl/addelautod-ios/Bymy.xcodeproj "$IOS/Bymy.xcodeproj"
bash "$IOS/scripts/rename-to-bymy.sh" "$IOS"
rm -rf "$HOME/Library/Developer/Xcode/DerivedData/AddElAutod-"* \
       "$HOME/Library/Developer/Xcode/DerivedData/Bymy-"* \
       "$HOME/Library/Developer/Xcode/DerivedData/bymy-"* 2>/dev/null || true
open -a Xcode "$IOS/Bymy.xcodeproj"
echo "KESZ: $IOS/Bymy.xcodeproj  (név: bymy)"
echo "Xcode: Cmd+Shift+K, majd Cmd+R"
