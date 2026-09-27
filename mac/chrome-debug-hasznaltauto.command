#!/bin/bash
# Chrome debug mód — Használtautó scrape-hez (kereskedések / gyártmány-modell)
# Csatlakozás: npm run scrape:ha-dealers  VAGY  npm run scrape:ha-brands-models

set -euo pipefail

PORT=9222
PROFILE="$HOME/.chrome-ha-debug"
CHROME=""

if [[ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif [[ -x "/Applications/Chromium.app/Contents/MacOS/Chromium" ]]; then
  CHROME="/Applications/Chromium.app/Contents/MacOS/Chromium"
else
  echo "Nem található Google Chrome / Chromium az Applications mappában."
  exit 1
fi

mkdir -p "$PROFILE"

# Ha már fut debug Chrome ezen a porton, ne indíts újat
if curl -fsS "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
  echo "Chrome debug már fut a ${PORT}-es porton."
  echo "Nyisd meg: https://www.hasznaltauto.hu/szemelyauto  (vagy /kereskedesek)"
  echo "Majd: cd $(dirname "$0")/.. && npm run scrape:ha-brands-models"
  open "https://www.hasznaltauto.hu/szemelyauto" 2>/dev/null || true
  exit 0
fi

echo "Chrome indítása debug módban (port ${PORT})…"
echo "Profil: $PROFILE"
echo ""
echo "1) Várd meg, amíg megnyílik a Chrome"
echo "2) Ha kell, fogadd el a sütiket / várd ki az „Egy pillanat…”-ot"
echo "3) Másik terminálban: cd bymy && npm run scrape:ha-brands-models"
echo ""

nohup "$CHROME" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE" \
  --no-first-run \
  --no-default-browser-check \
  "https://www.hasznaltauto.hu/szemelyauto" \
  >/tmp/chrome-ha-debug.log 2>&1 &
disown $! 2>/dev/null || true

sleep 2
if curl -fsS "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
  echo "OK — Chrome elérhető: http://127.0.0.1:${PORT}"
else
  echo "Figyelem: a debug port még nem válaszol. Nézd meg a Chrome ablakot /tmp/chrome-ha-debug.log"
fi
