import { chromium } from "playwright";

const widths = [390, 768, 1024, 1280];
const browser = await chromium.launch({ headless: true });
const results = [];

for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  page.on("pageerror", (e) => console.error("PAGE", w, e.message));
  const html = `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="http://127.0.0.1:3000/css/site-app.css" />
<link rel="stylesheet" href="http://127.0.0.1:3000/css/ad-form-desk.css?v=cellAll1" />
<link rel="stylesheet" href="http://127.0.0.1:3000/css/ad-form-bm-pickers.css?v=cellAll1" />
<link rel="stylesheet" href="http://127.0.0.1:3000/css/ingatlan-search.css" />
<style>
body{margin:0;padding:12px;background:#eee}
#ad-form{width:min(520px,100%);background:#fff;padding:12px;margin:0 auto}
.labeled-field{display:grid;gap:6px;margin:0 0 10px}
label{font-size:13px;font-weight:600}
</style></head>
<body class="site-app ad-form-desk-active" data-site-page="hirdetesfeladas">
<form id="ad-form" class="ad-form-desk-layout">
  <div class="ad-form-desk-shell">
    <div class="ad-layout-canvas ad-layout-on" id="canvas">
      <div class="ad-layout-item labeled-field" id="i-year" data-layout-row="1">
        <label for="gyartasi_ev">Gyártási év</label>
        <div class="ad-form-split-ym" data-ev-id="gyartasi_ev"><div class="immo-dual-range ad-form-split-ym__dual">
          <div class="immo-dual-range__half"><div class="immo-wheel-wrap"><button type="button" class="immo-wheel-trigger">év</button></div></div>
          <div class="immo-dual-range__half"><div class="immo-wheel-wrap"><button type="button" class="immo-wheel-trigger">hó</button></div></div>
        </div></div>
      </div>
      <div class="ad-layout-item labeled-field" id="i-brand" data-layout-row="3" data-ad-bm-for="gyartmany">
        <label for="gyartmany">Gyártmány</label>
        <div class="ad-form-bm-field ad-form-bm-field--drum ad-form-cell" data-ad-bm-for="gyartmany"><div class="ad-form-drum-wrap"><button type="button" class="immo-wheel-trigger">Válasszon</button></div></div>
      </div>
      <div class="ad-layout-item labeled-field" id="i-egyeb" data-layout-row="4">
        <label for="egyeb_tipus">Egyéb típus</label>
        <input id="egyeb_tipus" class="ad-form-cell" />
      </div>
      <div class="ad-layout-item labeled-field" id="i-kivitel" data-layout-row="5">
        <label for="kivitel">Kivitel</label>
        <div class="ad-form-bm-field ad-form-bm-field--drum ad-form-cell" data-ad-bm-for="kivitel"><div class="ad-form-drum-wrap"><button type="button" class="immo-wheel-trigger">Válasszon</button></div></div>
      </div>
      <div class="ad-layout-item labeled-field" id="i-power" data-layout-row="8">
        <label for="teljesitmeny_le">Teljesítmény</label>
        <div class="suffix-field"><input id="teljesitmeny_le" class="ad-form-cell" /><span>LE</span></div>
      </div>
    </div>
  </div>
</form>
<script>
const RANK = { gyartmany: 0, egyeb_tipus: 1, kivitel: 2, gyartasi_ev: 3, teljesitmeny_le: 4 };
const canvas = document.getElementById("canvas");
const items = [...canvas.children];
const keyOf = (el) =>
  el.dataset.adBmFor ||
  el.querySelector("[data-ad-bm-for]")?.getAttribute("data-ad-bm-for") ||
  el.querySelector(".ad-form-split-ym")?.dataset?.evId ||
  el.querySelector("label[for]")?.htmlFor ||
  el.querySelector("input,select")?.id ||
  "";
items.sort((a, b) => (RANK[keyOf(a)] ?? 90) - (RANK[keyOf(b)] ?? 90));
items.forEach((el, i) => {
  el.dataset.layoutRow = String(i + 1);
  el.style.setProperty("grid-column", "1 / span 12", "important");
  el.style.setProperty("grid-row", String(i + 1), "important");
  el.style.setProperty("position", "relative", "important");
  canvas.appendChild(el);
});
canvas.style.setProperty("display", "flex", "important");
canvas.style.setProperty("flex-direction", "column", "important");

const ids = ["i-brand", "i-egyeb", "i-kivitel", "i-power", "i-year"];
const boxes = ids.map((id) => {
  const root = document.getElementById(id);
  const ctrl = root.querySelector(".ad-form-bm-field, .suffix-field, .ad-form-split-ym, input.ad-form-cell");
  const r = ctrl.getBoundingClientRect();
  return { id, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), visible: r.height > 8 && r.width > 40 };
});
const ws = boxes.map((b) => b.w);
const maxW = Math.max(...ws);
const minW = Math.min(...ws);
const orderOk = boxes.find((b) => b.id === "i-brand").top < boxes.find((b) => b.id === "i-year").top;
window.__R__ = {
  viewport: ${w},
  equalWidth: maxW - minW <= 3,
  maxW,
  minW,
  orderOk,
  yearVisible: boxes.find((b) => b.id === "i-year").visible,
  boxes,
  ok: maxW - minW <= 3 && orderOk && boxes.every((b) => b.visible),
};
</script>
</body></html>`.replace("${w}", String(w));

  await page.setContent(html, { waitUntil: "load" });
  try {
    await page.waitForFunction(() => window.__R__, null, { timeout: 10000 });
    const r = await page.evaluate(() => window.__R__);
    await page.screenshot({ path: `test-results/cell-all-${w}.png` });
    results.push(r);
  } catch (e) {
    results.push({ viewport: w, ok: false, error: String(e.message || e) });
  }
  await page.close();
}

await browser.close();
const allOk = results.every((r) => r.ok);
console.log(JSON.stringify({ allOk, results }, null, 2));
process.exit(allOk ? 0 : 1);
