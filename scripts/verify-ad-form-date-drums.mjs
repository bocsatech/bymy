/**
 * Verify year/forgalomba/műszaki drums survive remount and step1 order is brand-first.
 * Fixture — no auth required.
 */
import { chromium } from "playwright";
import { createServer } from "http";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
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
  <link rel="stylesheet" href="/css/ad-form-bm-pickers.css?v=dateDrum2" />
  <link rel="stylesheet" href="/css/ad-form-desk.css?v=dateDrum2" />
  <style>
    body { margin: 0; padding: 12px; background: #eee; font-family: system-ui, sans-serif; }
    #ad-form { width: min(420px, 100%); margin: 0 auto; background: #fff; padding: 12px; }
    .labeled-field { display: grid; gap: 6px; margin: 0 0 12px; }
    label { font-size: 13px; font-weight: 600; }
    select { min-height: 44px; }
  </style>
</head>
<body class="site-app ad-form-desk-active" data-site-page="hirdetesfeladas">
<form id="ad-form" class="ad-form-desk-layout">
  <div class="step-panel" data-step="1">
    <div class="ad-layout-canvas ad-layout-on" id="canvas">
      <div class="ad-layout-item labeled-field" data-layout-row="1">
        <label for="gyartasi_ev">Gyártási év: *</label>
        <div class="inline-2">
          <select id="gyartasi_ev" name="gyartasi_ev"><option value="">—</option><option value="2020">2020</option><option value="2021">2021</option></select>
          <select id="gyartasi_honap" name="gyartasi_honap"><option value="">—</option><option value="1">1</option><option value="6">6</option></select>
        </div>
      </div>
      <div class="ad-layout-item labeled-field" data-layout-row="2">
        <label for="forgalomba_helyezes_ev">Első magyarországi forgalomba helyezés:</label>
        <div class="inline-2">
          <select id="forgalomba_helyezes_ev" name="forgalomba_helyezes_ev"><option value="">—</option><option value="2020">2020</option></select>
          <select id="forgalomba_helyezes_honap" name="forgalomba_helyezes_honap"><option value="">—</option><option value="3">3</option></select>
        </div>
      </div>
      <div class="ad-layout-item labeled-field" data-layout-row="3">
        <label for="muszaki_ev">Műszaki vizsga érvényes:</label>
        <div class="inline-2">
          <select id="muszaki_ev" name="muszaki_ev"><option value="">—</option><option value="2027">2027</option></select>
          <select id="muszaki_honap" name="muszaki_honap"><option value="">—</option><option value="5">5</option></select>
        </div>
      </div>
      <div class="ad-layout-item labeled-field" data-layout-row="4">
        <label for="gyartmany">Gyártmány: *</label>
        <select id="gyartmany" name="gyartmany"><option value="">Válasszon</option><option value="BMW">BMW</option></select>
      </div>
      <div class="ad-layout-item labeled-field" data-layout-row="5">
        <label for="egyeb_tipus">Egyéb típus:</label>
        <input id="egyeb_tipus" name="egyeb_tipus" class="ad-form-cell" />
      </div>
      <div class="ad-layout-item labeled-field" data-layout-row="6">
        <label for="kivitel">Kivitel: *</label>
        <select id="kivitel" name="kivitel"><option value="">Válasszon</option><option value="sedan">Sedan</option></select>
      </div>
    </div>
  </div>
</form>
<script type="module">
  import { stackVehicleCanvasSingleColumn } from "/js/ad-form-desk-pinned-blocks.js?v=dateDrum2";
  import { refreshAdFormBmPickers } from "/js/ad-form-bm-pickers.js?v=dateDrum2";

  const form = document.getElementById("ad-form");
  const canvas = document.getElementById("canvas");

  // Admin order is year-first — canonical must put gyártmány first.
  stackVehicleCanvasSingleColumn(canvas, { canonicalStep1: true });
  await refreshAdFormBmPickers(form);
  // Second refresh used to orphan selects and leave empty labels.
  await refreshAdFormBmPickers(form);
  stackVehicleCanvasSingleColumn(canvas, { canonicalStep1: true });

  const items = [...canvas.children].filter((el) => !el.hidden).map((el) => {
    const split = el.querySelector(".ad-form-split-ym, .ad-form-muszaki-date");
    const triggers = [...el.querySelectorAll(".immo-wheel-trigger")].map((t) => {
      const r = t.getBoundingClientRect();
      return { text: t.textContent?.trim(), w: Math.round(r.width), h: Math.round(r.height) };
    });
    const halves = [...el.querySelectorAll(".immo-dual-range__half, .immo-triple-date__half")].map((h) => {
      const r = h.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    return {
      key:
        el.dataset?.adBmFor ||
        el.querySelector?.("[data-ad-bm-for]")?.getAttribute("data-ad-bm-for") ||
        split?.dataset?.evId ||
        el.querySelector?.("label[for]")?.htmlFor ||
        el.querySelector?.("select[id], input[id]")?.id ||
        "",
      label: el.querySelector("label")?.textContent?.replace(/\\s+/g, " ").trim()?.slice(0, 40),
      hasSplit: Boolean(split),
      triggers,
      halves,
      yearInDom: Boolean(document.getElementById("gyartasi_ev")?.isConnected),
      top: Math.round(el.getBoundingClientRect().top),
    };
  });

  const brand = items.find((i) => i.key === "gyartmany");
  const year = items.find((i) => i.key === "gyartasi_ev");
  const forg = items.find((i) => i.key === "forgalomba_helyezes_ev");
  const musz = items.find((i) => i.key === "muszaki_ev" || i.hasSplit && i.label?.includes("Műszaki"));

  const yearVisible = (year?.halves?.length >= 2 && year.halves.every((h) => h.h >= 30 && h.w >= 40))
    || (year?.triggers?.length >= 2 && year.triggers.every((t) => t.h >= 30 && t.w >= 40));
  const forgVisible = (forg?.halves?.length >= 2 && forg.halves.every((h) => h.h >= 30 && h.w >= 40))
    || (forg?.triggers?.length >= 2 && forg.triggers.every((t) => t.h >= 30 && t.w >= 40));
  const muszVisible =
    (musz?.halves?.length >= 3 && musz.halves.every((h) => h.h >= 30 && h.w >= 20))
    || (musz?.triggers?.length >= 3 && musz.triggers.every((t) => t.h >= 30));

  window.__R__ = {
    orderOk: brand && year && brand.top < year.top,
    yearVisible,
    forgVisible,
    muszVisible,
    yearInDom: Boolean(document.getElementById("gyartasi_ev")?.isConnected),
    honapInDom: Boolean(document.getElementById("gyartasi_honap")?.isConnected),
    splitCount: document.querySelectorAll(".ad-form-split-ym").length,
    muszakiCount: document.querySelectorAll(".ad-form-muszaki-date").length,
    keys: items.map((i) => i.key),
    items,
    ok: false,
  };
  window.__R__.ok =
    window.__R__.orderOk &&
    window.__R__.yearVisible &&
    window.__R__.forgVisible &&
    window.__R__.muszVisible &&
    window.__R__.yearInDom &&
    window.__R__.honapInDom;
</script>
</body>
</html>`;

function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        if (req.url === "/" || req.url?.startsWith("/fixture")) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(fixtureHtml);
          return;
        }
        const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
        const filePath = path.join(PUBLIC, urlPath.replace(/^\//, ""));
        if (!filePath.startsWith(PUBLIC)) {
          res.writeHead(403).end("forbidden");
          return;
        }
        const data = await readFile(filePath);
        const ext = path.extname(filePath);
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(data);
      } catch {
        res.writeHead(404).end("missing");
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

const { server, port } = await startServer();
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.HOME +
    "/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
});
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e?.message || e)));

await page.goto(`http://127.0.0.1:${port}/fixture`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForFunction(() => window.__R__, null, { timeout: 30000 });
const result = await page.evaluate(() => window.__R__);
await page.screenshot({ path: path.join(root, "test-results/date-drums-verify.png"), fullPage: true });
await browser.close();
server.close();

console.log(JSON.stringify({ ...result, errors: errors.slice(0, 10) }, null, 2));
process.exit(result.ok && errors.length === 0 ? 0 : 1);
