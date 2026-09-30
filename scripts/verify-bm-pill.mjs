import { chromium } from "playwright";
import { createServer } from "http";
import { readFile } from "fs/promises";
import path from "path";

const PUBLIC = path.resolve("public");
const MIME = {
  ".html": "text/html;charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".mjs": "text/javascript",
};

const html = `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="/css/ingatlan-search.css" />
<link rel="stylesheet" href="/css/ad-form-bm-pickers.css?v=bmPill1" />
<style>
body{margin:0;padding:16px;background:#e8eef3}
#ad-form{width:min(390px,100%);margin:0 auto;background:#fff;padding:14px;border-radius:8px}
.labeled-field{display:grid;gap:6px}
label{font:600 13px/1.2 system-ui;color:#1f2937}
</style>
</head>
<body class="site-app ad-form-desk-active" data-site-page="hirdetesfeladas">
<form id="ad-form"><div class="labeled-field ad-form-bm-anchor">
<label for="gyartmany">Gyártmány &amp; Modell: <span class="req">*</span></label>
<select id="gyartmany"><option value="">Válasszon</option><option>BMW</option></select>
<select id="modell" hidden><option value="">—</option></select>
</div></form>
<script type="module">
import { refreshAdFormBmPickers } from "/js/ad-form-bm-pickers.js?v=bmPill1";
const form = document.getElementById("ad-form");
await refreshAdFormBmPickers(form, { gyartmanyok: ["BMW","Audi"], modellek: { BMW:["320","X5"] } });
const wrap = document.querySelector(".ad-form-bm-field--brand-model");
const drum = wrap?.querySelector(".ad-form-drum-wrap");
const trigger = wrap?.querySelector(".immo-wheel-trigger");
const label = document.querySelector('label[for="gyartmany"]')?.textContent?.replace(/\\s+/g," ").trim();
const cs = drum ? getComputedStyle(drum) : null;
const tr = trigger?.getBoundingClientRect();
const radius = cs?.borderRadius || "";
window.__R__ = {
  label,
  placeholder: trigger?.textContent?.trim(),
  radius,
  border: (cs?.borderTopWidth || "") + " " + (cs?.borderTopColor || ""),
  h: Math.round(tr?.height || 0),
  w: Math.round(tr?.width || 0),
  ok: false,
};
window.__R__.ok =
  /Gyártmány\\s*&\\s*Modell/.test(label || "") &&
  window.__R__.placeholder === "Gyártmány / Modell" &&
  window.__R__.h >= 40 &&
  (radius.includes("999") || parseFloat(radius) >= 20);
</script></body></html>`;

const server = await new Promise((resolve) => {
  const s = createServer(async (req, res) => {
    try {
      const url = req.url || "/";
      if (url === "/" || url.startsWith("/f")) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
        return;
      }
      const clean = decodeURIComponent(url.split("?")[0].replace(/^\//, ""));
      const filePath = path.join(PUBLIC, clean);
      const data = await readFile(filePath);
      res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404).end("x");
    }
  });
  s.listen(0, "127.0.0.1", () => resolve(s));
});

const { port } = server.address();
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.HOME +
    "/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
});
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
page.on("pageerror", (e) => console.error("ERR", e.message));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__R__, null, { timeout: 20000 });
const r = await page.evaluate(() => window.__R__);
await page.screenshot({ path: "test-results/bm-pill-verify.png" });
console.log(JSON.stringify(r, null, 2));
await browser.close();
server.close();
process.exit(r.ok ? 0 : 1);
