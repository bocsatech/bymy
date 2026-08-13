#!/bin/bash
# Google / Apple / Facebook OAuth beállítás Autoswebhez
set -euo pipefail

DIR="$HOME/.autosweb"
EXAMPLE="$DIR/oauth.example.json"
TARGET="$DIR/oauth.json"

mkdir -p "$DIR"

SECRET=$(openssl rand -hex 24 2>/dev/null || date +%s | shasum | cut -c1-48)

cat > "$EXAMPLE" <<EOF
{
  "publicBaseUrl": "http://127.0.0.1:3456",
  "stateSecret": "$SECRET",
  "google": {
    "enabled": false,
    "clientId": "",
    "clientSecret": ""
  },
  "facebook": {
    "enabled": false,
    "appId": "",
    "appSecret": ""
  },
  "apple": {
    "enabled": false,
    "clientId": "com.example.web",
    "teamId": "",
    "keyId": "",
    "privateKeyPath": "~/.autosweb/AuthKey_XXXXX.p8"
  }
}
EOF

if [ ! -f "$TARGET" ]; then
  cp "$EXAMPLE" "$TARGET"
fi

echo "══════════════════════════════════════"
echo " Autosweb — Social OAuth"
echo "══════════════════════════════════════"
echo ""
echo "Config: $TARGET"
echo "Példa:  $EXAMPLE"
echo ""
echo "1) publicBaseUrl = a domained (pl. https://addelautod.hu)"
echo "   Localhost most: http://127.0.0.1:3456"
echo ""
echo "2) Google Cloud Console → OAuth client (Web)"
echo "   Redirect: {publicBaseUrl}/api/auth/oauth/callback/google"
echo "   → google.enabled=true + clientId/clientSecret"
echo ""
echo "3) Meta Developer → Facebook Login"
echo "   Redirect: {publicBaseUrl}/api/auth/oauth/callback/facebook"
echo "   → facebook.enabled=true + appId/appSecret"
echo ""
echo "4) Apple Developer → Sign in with Apple (Services ID)"
echo "   Redirect: {publicBaseUrl}/api/auth/oauth/callback/apple"
echo "   → .p8 kulcs ide: ~/.autosweb/AuthKey_….p8"
echo "   → apple.enabled=true + clientId/teamId/keyId/privateKeyPath"
echo ""
echo "Indítsd újra az Autoswebet a mentés után."
echo ""

if command -v open >/dev/null 2>&1; then
  open -e "$TARGET" 2>/dev/null || open -t "$TARGET" 2>/dev/null || true
fi

read -r -p "ENTER…" _ >/dev/null || true
