import { chromium } from "playwright";
import { createServer } from "http";
import { readFile } from "fs/promises";
import path from "path";

const root = process.cwd();
const PUBLIC = path.join(root, "public");
const MIME = { ".html":"text/html",".js":"text/javascript",".css":"text/css",".mjs":"text/javascript" };
const html = `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="/css/ingatlan-search.css?v=bmSheet6" />
<style>body{margin:0;background:#999}</style>
</head><body class="site-app" data-site-page="hirdetesfeladas">
<button id="t">open</button>
<div class="immo-wheel-wrap" id="wrap">
  <div class="immo-wheel" data-wheel="gyartmany"></div>
  <div class="immo-wheel" data-wheel="modell" hidden></div>
</div>
<form id="f"></form>
<script type="module">
import { openBrandModelCatalogSheet } from "/js/auto-drum-sheet.js?v=bmSheet6";
const form = document.getElementById("f");
form._autoDrumCatalog = { gyartmanyok: Array.from({length:35},(_,i)=>"Brand"+i), modellek: {} };
openBrandModelCatalogSheet(document.querySelector('[data-wheel="gyartmany"]'), document.getElementById("t"), document.getElementById("wrap"), "Gyártmány / Modell", form, { singleSelect: true });
await new Promise((r) => setTimeout(r, 40));
const portal = document.querySelector(".auto-drum-portal--sheet");
const stage = portal.querySelector(".auto-drum-portal__stage");
const head = portal.querySelector(".auto-drum-portal__sheet-head");
const foot = portal.querySelector(".auto-drum-portal__sheet-foot");
const ring = portal.querySelector(".auto-drum-portal__ring");
const body = portal.querySelector("[data-sheet-scroll]");
const section = portal.querySelector("[data-sheet-section]");
const w0 = Math.round(ring.getBoundingClientRect().width);
const headTop0 = Math.round(head.getBoundingClientRect().top);
const footTop0 = Math.round(foot.getBoundingClientRect().top);
const ringTop0 = Math.round(ring.getBoundingClientRect().top);
const bodyTop0 = Math.round(body.getBoundingClientRect().top);
/* Fehér kártya tetejét a kék középső zóna tetejére húzzuk (szekció elmegy) */
const gap = ring.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
body.scrollTop = gap;
await new Promise((r) => setTimeout(r, 40));
const w1 = Math.round(ring.getBoundingClientRect().width);
const headTop1 = Math.round(head.getBoundingClientRect().top);
const footTop1 = Math.round(foot.getBoundingClientRect().top);
const ringTop1 = Math.round(ring.getBoundingClientRect().top);
const bodyTop1 = Math.round(body.getBoundingClientRect().top);
const stageBg = getComputedStyle(stage).backgroundColor;
const ringBg = getComputedStyle(ring).backgroundColor;
const bodyOverflow = getComputedStyle(body).overflowY;
const ringOverflow = getComputedStyle(ring).overflowY;
window.__R__ = {
  title: portal.querySelector(".auto-drum-portal__sheet-title")?.textContent || "",
  section: section?.textContent || "",
  w0, w1, sameWidth: w0 === w1 && w0 > 200,
  headFixed: headTop0 === headTop1,
  footFixed: footTop0 === footTop1,
  bodyFixed: bodyTop0 === bodyTop1,
  ringSlidUp: ringTop1 < ringTop0 - 20,
  ringAtBlueTop: Math.abs(ringTop1 - bodyTop1) <= 3,
  stageBlue: stageBg === "rgb(232, 238, 243)",
  ringWhite: ringBg === "rgb(255, 255, 255)",
  bodyScrolls: bodyOverflow === "auto" || bodyOverflow === "scroll",
  ringNoInnerScroll: ringOverflow === "hidden" || ringOverflow === "visible",
  noScrolledClass: !portal.classList.contains("is-scrolled"),
  ok: false,
};
window.__R__.ok =
  window.__R__.sameWidth &&
  window.__R__.headFixed &&
  window.__R__.footFixed &&
  window.__R__.bodyFixed &&
  window.__R__.ringSlidUp &&
  window.__R__.ringAtBlueTop &&
  window.__R__.stageBlue &&
  window.__R__.ringWhite &&
  window.__R__.bodyScrolls &&
  window.__R__.ringNoInnerScroll &&
  window.__R__.noScrolledClass &&
  /Modell/i.test(window.__R__.title);
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
      const data = await readFile(path.join(PUBLIC, clean));
      res.writeHead(200, { "Content-Type": MIME[path.extname(clean)] || "bin" });
      res.end(data);
    } catch (e) {
      res.writeHead(404).end(String(e));
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
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.error("ERR", e.message));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__R__, null, { timeout: 15000 });
const r = await page.evaluate(() => window.__R__);
await page.screenshot({ path: "test-results/bm-sheet-slide-top.png" });
console.log(JSON.stringify(r, null, 2));
await browser.close();
server.close();
process.exit(r.ok ? 0 : 1);
