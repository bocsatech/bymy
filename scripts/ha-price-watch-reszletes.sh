#!/bin/bash
# HA ár részletes (detail) watch — resume + auto-restart.
# Indítás: launchctl kickstart -k gui/$(id -u)/hu.bymy.ha-price-reszletes
# vagy: bash scripts/ha-price-watch-reszletes.sh
set -u
cd "$(dirname "$0")/.."
mkdir -p data/ha-prices

if [[ -z "${HA_PRICE_CAFFEINATED:-}" ]]; then
  export HA_PRICE_CAFFEINATED=1
  exec /usr/bin/caffeinate -dims /bin/bash "$0" "$@"
fi

echo $$ > data/ha-prices/watch-reszletes.pid
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ha-price-reszletes-watch start pid=$$" >> data/ha-prices/scrape.log

while true; do
  node scripts/ha-price-download.mjs --reszletes --resume --delay 1200 \
    >> data/ha-prices/node-stdout-reszletes.log 2>&1
  code=$?
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] reszletes exit=$code — újraindítás 8s múlva" >> data/ha-prices/scrape.log

  if node -e '
    const fs = require("fs");
    const rows = fs.readFileSync("data/ha-prices/rows.jsonl","utf8").split("\n").filter(Boolean);
    let cand = 0, done = 0;
    for (const line of rows) {
      try {
        const o = JSON.parse(line);
        if (!o.reszletes_candidate) continue;
        cand++;
        if (o.level === "reszletes" && o.detail) done++;
      } catch {}
    }
    // kész, ha a jelöltek >=95%-a megvan (CF hibák miatt)
    if (cand > 0 && done / cand >= 0.95) process.exit(0);
    // vagy progress azt mondja doneAll
    try {
      const p = JSON.parse(fs.readFileSync("data/ha-prices/progress-reszletes.json","utf8"));
      if (p.doneAll) process.exit(0);
    } catch {}
    process.exit(1);
  '; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] RESZLETES_ALL_DONE" >> data/ha-prices/scrape.log
    rm -f data/ha-prices/watch-reszletes.pid
    exit 0
  fi
  sleep 8
done
