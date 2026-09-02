#!/bin/bash
# Chrome debug mód — partner.ingatlan.com scrape-hez
# A script (npm run scrape:ingatlan-partners) ehhez a Chrome-hoz csatlakozik.
# Port 9223 — külön a Használtautó scrape 9222-es portjától.

set -euo pipefail

PORT=9223
PROFILE="$HOME/.chrome-ingatlan-debug"
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
  echo "Nyisd meg (ha még nem): https://partner.ingatlan.com/"
  echo "Majd: cd $(dirname "$0")/.. && npm run scrape:ingatlan-partners"
  open "https://partner.ingatlan.com/" 2>/dev/null || true
  exit 0
fi

echo "Chrome indítása debug módban (port ${PORT})…"
echo "Profil: $PROFILE"
echo ""
echo "1) Várd meg, amíg megnyílik a Chrome"
echo "2) Ha kell, fogadd el a sütiket / várd ki a „Csak egy gyors ellenőrzés!”-t"
echo "3) Másik terminálban: npm run scrape:ingatlan-partners"
echo ""

"$CHROME" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE" \
  --no-first-run \
  --no-default-browser-check \
  "https://partner.ingatlan.com/" \
  >/tmp/chrome-ingatlan-debug.log 2>&1 &

sleep 2
if curl -fsS "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
  echo "OK — Chrome elérhető: http://127.0.0.1:${PORT}"
else
  echo "Figyelem: a debug port még nem válaszol. Nézd meg a Chrome ablakot /tmp/chrome-ingatlan-debug.log"
fi
