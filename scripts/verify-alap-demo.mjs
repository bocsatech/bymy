import { chromium } from "playwright";
import { createServer } from "http";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const root = "/Users/rbocsa/bymy";
const PUBLIC = path.join(root, "public");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
};

const fixtureHtml = `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="/css/ingatlan-search.css" />
  <link rel="stylesheet" href="/css/ad-form-bm-pickers.css?v=demoExact2" />
  <link rel="stylesheet" href="/css/ad-form-desk.css?v=demoExact2" />
  <style>
    body { margin: 0; padding: 12px; background: #dbe3ea; font-family: system-ui, sans-serif; }
    #ad-form { width: min(390px, 100%); margin: 0 auto; }
    .labeled-field { display: grid; gap: 6px; margin: 0 0 12px; }
    label { font-size: 13px; font-weight: 600; }
    select, input { min-height: 44px; width: 100%; }
  </style>
</head>
<body class="site-app ad-form-desk-active" data-site-page="hirdetesfeladas">
<form id="ad-form" class="ad-form-desk-layout">
  <div class="auto-desk-acc is-open" data-desk-acc="alap">
    <button type="button" class="auto-desk-acc__head">Alap adatok <span>▲</span></button>
    <div class="auto-desk-acc__body">
      <div class="step-panel" data-step="1">
        <div class="ad-layout-canvas ad-layout-on" id="canvas">
          <div class="ad-layout-item labeled-field" data-layout-row="1">
            <label for="gyartmany">Gyártmány &amp; Modell: *</label>
            <select id="gyartmany" name="gyartmany"><option value="">Válasszon</option><option>BMW</option></select>
          </div>
          <div class="ad-layout-item labeled-field" data-layout-row="2">
            <label for="modell">Modell: *</label>
            <select id="modell" name="modell"><option value="">—</option></select>
          </div>
          <div class="ad-layout-item labeled-field" data-layout-row="2">
            <label for="egyeb_tipus">Egyéb típus:</label>
            <input id="egyeb_tipus" name="egyeb_tipus" class="ad-form-cell" placeholder="pl. AMG" />
          </div>
          <div class="ad-layout-item labeled-field" data-layout-row="3">
            <label for="kivitel">Kivitel: *</label>
            <select id="kivitel" name="kivitel" class="ad-form-cell"><option value="">Válasszon</option><option>Sedan</option></select>
          </div>
          <div class="ad-layout-item labeled-field" data-layout-row="4">
            <label for="allapot">Állapot: *</label>
            <select id="allapot" name="allapot" class="ad-form-cell"><option value="">Válasszon</option></select>
          </div>
          <div class="ad-layout-item labeled-field" data-layout-row="5">
            <label for="gyartasi_ev">Gyártási év: *</label>
            <div class="inline-2">
              <select id="gyartasi_ev" name="gyartasi_ev"><option value="">év</option><option>2020</option></select>
              <select id="gyartasi_honap" name="gyartasi_honap"><option value="">hó</option><option>6</option></select>
            </div>
          </div>
          <div class="ad-layout-item labeled-field" data-layout-row="6">
            <label for="km">Km:</label>
            <input id="km" name="km" class="ad-form-cell" />
          </div>
        </div>
      </div>
    </div>
  </div>
</form>
<script type="module">
  import { stackVehicleCanvasSingleColumn } from "/js/ad-form-desk-pinned-blocks.js?v=demoExact2";
  import { refreshAdFormBmPickers } from "/js/ad-form-bm-pickers.js?v=demoExact2";
  const form = document.getElementById("ad-form");
  const canvas = document.getElementById("canvas");
  await refreshAdFormBmPickers(form, { gyartmanyok: ["BMW","Audi"], modellek: { BMW:["320"] } });
  stackVehicleCanvasSingleColumn(canvas, { canonicalStep1: true });
  const brand = canvas.querySelector(":scope > .ad-form-alap-brand-block");
  const card = canvas.querySelector(":scope > .ad-form-alap-card");
  const head = document.querySelector(".auto-desk-acc__head");
  const body = document.querySelector(".auto-desk-acc__body");
  const pill = brand?.querySelector(".ad-form-drum-wrap, .immo-wheel-wrap");
  const field = card?.querySelector(".ad-form-cell, select.ad-form-cell, .ad-form-drum-wrap");
  const csBody = body ? getComputedStyle(body) : null;
  const csPill = pill ? getComputedStyle(pill) : null;
  const csCard = card ? getComputedStyle(card) : null;
  const csHead = head ? getComputedStyle(head) : null;
  const csField = field ? getComputedStyle(field) : null;
  window.__R__ = {
    hasBrandOutside: Boolean(brand) && brand.parentElement === canvas,
    hasCard: Boolean(card),
    cardTitle: card?.querySelector(".ad-form-alap-card__title-text")?.textContent || "",
    headDisplay: csHead?.display,
    bodyBg: csBody?.backgroundColor,
    pillRadius: csPill?.borderRadius,
    pillBg: csPill?.backgroundColor,
    cardBg: csCard?.backgroundColor,
    cardRadius: csCard?.borderRadius,
    fieldBorderBottom: csField?.borderBottomWidth + " " + csField?.borderBottomStyle,
    fieldBorderTop: csField?.borderTopWidth,
    hasHasznalt: /Használt/i.test(document.body.innerText),
    brandInCard: Boolean(card?.querySelector(".ad-form-alap-brand-block, .ad-form-bm-field--brand-model")),
    brandH: Math.round(brand?.getBoundingClientRect()?.height || 0),
    pillH: Math.round(pill?.getBoundingClientRect()?.height || 0),
  };
  window.__R__.ok =
    window.__R__.hasBrandOutside &&
    window.__R__.hasCard &&
    window.__R__.cardTitle === "Alapadatok" &&
    window.__R__.headDisplay === "none" &&
    window.__R__.brandH >= 40 &&
    window.__R__.pillH >= 40 &&
    !window.__R__.hasHasznalt &&
    !window.__R__.brandInCard;
</script>
</body></html>`;

const server = await new Promise((resolve) => {
  const s = createServer(async (req, res) => {
    try {
      const url = req.url || "/";
      if (url === "/" || url.startsWith("/f")) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(fixtureHtml);
        return;
      }
      const clean = decodeURIPath(url);
      const filePath = path.join(PUBLIC, clean);
      const data = await readFile(filePath);
      res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
      res.end(data);
    } catch (e) {
      res.writeHead(404).end(String(e));
    }
  });
  s.listen(0, "127.0.0.1", () => resolve(s));
});
function decodeURIPath(url) {
  return decodeURIComponent(url.split("?")[0].replace(/^\//, ""));
}
const { port } = server.address();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.HOME + "/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
page.on("pageerror", (e) => console.error("ERR", e.message));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__R__, null, { timeout: 20000 });
const r = await page.evaluate(() => window.__R__);
await page.screenshot({ path: root + "/test-results/alap-demo-verify.png", fullPage: true });
console.log(JSON.stringify(r, null, 2));
await browser.close();
server.close();
process.exit(r.ok ? 0 : 1);
