#!/bin/bash
# Gmail SMTP beállítás Autosweb aktiváló emailhez
set -euo pipefail

DIR="$HOME/.autosweb"
EXAMPLE="$DIR/smtp.example.json"
TARGET="$DIR/smtp.json"

mkdir -p "$DIR"

cat > "$EXAMPLE" <<'EOF'
{
  "host": "smtp.gmail.com",
  "port": 587,
  "secure": false,
  "user": "te@gmail.com",
  "pass": "xxxx xxxx xxxx xxxx",
  "from": "Add el autod.hu <te@gmail.com>"
}
EOF

if [ ! -f "$TARGET" ]; then
  cp "$EXAMPLE" "$TARGET"
fi

echo "══════════════════════════════════════"
echo " Autosweb — Gmail SMTP"
echo "══════════════════════════════════════"
echo ""
echo "1) Google fiók → 2 lépéses hitelesítés BE"
echo "2) https://myaccount.google.com/apppasswords"
echo "   → Alkalmazásjelszó létrehozása (Mail / Mac)"
echo "3) Szerkeszd: $TARGET"
echo "   - user: a Gmail címed"
echo "   - pass: a 16 karakteres app jelszó (szóközökkel vagy anélkül)"
echo ""
echo "Példa fájl: $EXAMPLE"
echo "Éles config: $TARGET"
echo ""

if command -v open >/dev/null 2>&1; then
  open -e "$TARGET" 2>/dev/null || open -t "$TARGET" 2>/dev/null || true
  open "https://myaccount.google.com/apppasswords" 2>/dev/null || true
fi

read -r -p "ENTER…" _ >/dev/null || true
