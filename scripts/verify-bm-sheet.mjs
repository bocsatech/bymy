import { chromium } from "playwright";
import { createServer } from "http";
import { readFile } from "fs/promises";
import path from "path";

const root = process.cwd();
const PUBLIC = path.join(root, "public");
const MIME = { ".html":"text/html",".js":"text/javascript",".css":"text/css",".mjs":"text/javascript" };
const html = `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="/css/ingatlan-search.css?v=bmSheet2" />
<style>body{margin:0;background:#ddd;font-family:system-ui}</style>
</head><body class="site-app" data-site-page="hirdetesfeladas">
<button id="t" class="immo-wheel-trigger">Gyártmány / Modell</button>
<div class="immo-wheel-wrap" id="wrap">
  <div class="immo-wheel" data-wheel="gyartmany"><button class="immo-wheel-opt" data-value="BMW">BMW</button><button class="immo-wheel-opt" data-value="Audi">Audi</button></div>
  <div class="immo-wheel" data-wheel="modell" hidden></div>
</div>
<form id="f"></form>
<script type="module">
import { openBrandModelCatalogSheet } from "/js/auto-drum-sheet.js?v=bmSheet2";
import { setWheelValue } from "/js/ingatlan-wheels.js?v=immoClearAll1";
const form = document.getElementById("f");
form._autoDrumCatalog = { gyartmanyok: ["BMW","Audi","Mercedes-Benz"], modellek: { BMW:["320","X5"], Audi:["A4"] } };
const brand = document.querySelector('[data-wheel="gyartmany"]');
const trigger = document.getElementById("t");
const wrap = document.getElementById("wrap");
openBrandModelCatalogSheet(brand, trigger, wrap, "Gyártmány / Modell", form, { singleSelect: true });
await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
const portal = document.querySelector(".auto-drum-portal--sheet");
const ring = portal?.querySelector(".auto-drum-portal__ring");
const item = portal?.querySelector(".immo-drum-inline-item .immo-drum-inline-text");
const done = portal?.querySelector(".auto-drum-portal__sheet-foot .auto-drum-portal__done");
const title = portal?.querySelector(".auto-drum-portal__sheet-title");
const csRing = ring ? getComputedStyle(ring) : null;
const csItem = item ? getComputedStyle(item) : null;
const csDone = done ? getComputedStyle(done) : null;
const fs = parseFloat(csItem?.fontSize || "0");
const sticky = portal?.querySelector(".auto-drum-portal__sheet-sticky");
const sheetScroll = portal?.querySelector("[data-sheet-scroll]");
const section = portal?.querySelector("[data-sheet-section]");
// jump to models via BMW row
const bmw = [...(portal?.querySelectorAll(".immo-drum-inline-item")||[])].find(el => (el.dataset.value||"")==="BMW");
bmw?.click();
await new Promise(r => setTimeout(r, 50));
const stickyAfter = portal?.querySelector(".auto-drum-portal__sheet-sticky");
const sectionTxt = portal?.querySelector("[data-sheet-section]")?.textContent || "";
const toolbarVis = portal?.querySelector(".auto-drum-portal__toolbar--sheet")?.classList.contains("is-visible");
const stickyPos = stickyAfter ? getComputedStyle(stickyAfter).position : "";
const stickyTop = stickyAfter ? getComputedStyle(stickyAfter).top : "";
window.__R__ = {
  hasSheet: Boolean(portal),
  title: title?.textContent || "",
  borderW: csRing?.borderTopWidth,
  borderC: csRing?.borderTopColor,
  ringBg: csRing?.backgroundColor,
  stageBg: portal ? getComputedStyle(portal.querySelector(".auto-drum-portal__stage")).backgroundColor : null,
  itemFs: fs,
  itemFw: csItem?.fontWeight,
  doneBg: csDone?.backgroundColor,
  noThickBlack: csRing && parseFloat(csRing.borderTopWidth) < 1,
  sectionTxt,
  toolbarVis: Boolean(toolbarVis),
  stickyPos,
  stickyTop,
  hasSheetScroll: Boolean(sheetScroll),
  ok: false,
};
window.__R__.ok = window.__R__.hasSheet && window.__R__.noThickBlack && window.__R__.itemFs > 0 && window.__R__.itemFs <= 16 && Number(window.__R__.itemFw) <= 600 && /Modell/i.test(window.__R__.title||"") && window.__R__.sectionTxt === "Modellek" && window.__R__.toolbarVis && window.__R__.stickyPos === "sticky" && window.__R__.hasSheetScroll;
</script></body></html>`;

const server = await new Promise((resolve) => {
  const s = createServer(async (req, res) => {
    try {
      const url = req.url || "/";
      if (url === "/" || url.startsWith("/f")) { res.writeHead(200,{"Content-Type":"text/html"}); res.end(html); return; }
      const clean = decodeURIComponent(url.split("?")[0].replace(/^\//,""));
      const data = await readFile(path.join(PUBLIC, clean));
      res.writeHead(200,{"Content-Type": MIME[path.extname(clean)] || "bin"});
      res.end(data);
    } catch (e) { res.writeHead(404).end(String(e)); }
  });
  s.listen(0, "127.0.0.1", () => resolve(s));
});
const { port } = server.address();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.HOME + "/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.error("ERR", e.message));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__R__, null, { timeout: 15000 });
const r = await page.evaluate(() => window.__R__);
await page.screenshot({ path: "test-results/bm-sheet-verify.png" });
console.log(JSON.stringify(r, null, 2));
await browser.close();
server.close();
process.exit(r.ok ? 0 : 1);
