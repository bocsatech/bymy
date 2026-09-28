/**
 * Map → listing → back: search list + map pins must remain.
 * BYMY_BASE=http://127.0.0.1:3457 node scripts/test-search-back-map.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BYMY_BASE || "http://127.0.0.1:3457";

function encodeSs(page, filters) {
  const b64 = Buffer.from(JSON.stringify({ v: 1, page, filters }), "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await (
    await browser.newContext({ locale: "hu-HU", viewport: { width: 1400, height: 900 } })
  ).newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  const log = (m, d) => console.log(`• ${m}`, d ?? "");

  try {
    const ss = encodeSs("auto", { uzemanyagok: ["Dízel"] });
    await page.goto(`${BASE}/auto.html?ss=${ss}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#home-grid-track [data-listing-id]", { timeout: 45000 });
    await page.waitForTimeout(2000);

    const openInfo = await page.evaluate(async () => {
      const mod = await import("/js/search-results-map.js?v=searchBack9");
      const real = [...document.querySelectorAll("#home-grid-track [data-listing-id]")]
        .map((el) => el.__bymyListing)
        .filter(Boolean);
      const r = await mod.openSearchResultsMap(real, { mode: "filtered", preferHomeZoom: false });
      sessionStorage.setItem("bymy-vehicle-map-open", JSON.stringify({ at: Date.now() }));
      sessionStorage.setItem(
        "bymy-vehicle-search-restore",
        JSON.stringify({ page: "auto", at: Date.now() })
      );
      sessionStorage.setItem(
        "bymy-vehicle-search-state",
        JSON.stringify({
          page: "auto",
          committed: true,
          filters: { uzemanyagok: ["Dízel"] },
          at: Date.now(),
        })
      );
      return { items: real.length, pins: r?.pins, skipped: r?.skipped };
    });
    log("map open", openInfo);
    if (!openInfo.pins) errors.push(`initial pins=0 (items=${openInfo.items})`);

    const listingId = await page.evaluate(() => {
      const el = document.querySelector("#home-grid-track [data-listing-id]");
      return el?.getAttribute("data-listing-id") || "";
    });
    await page.goto(`${BASE}/hirdetes.html?id=${encodeURIComponent(listingId)}`, {
      waitUntil: "domcontentloaded",
    });
    log("detail", page.url());

    const flags = await page.evaluate(() => ({
      map: sessionStorage.getItem("bymy-vehicle-map-open"),
      restore: sessionStorage.getItem("bymy-vehicle-search-restore"),
    }));
    log("flags", flags);
    if (!flags.map) {
      await page.evaluate(() => {
        sessionStorage.setItem("bymy-vehicle-map-open", JSON.stringify({ at: Date.now() }));
        sessionStorage.setItem(
          "bymy-vehicle-search-restore",
          JSON.stringify({ page: "auto", at: Date.now() })
        );
      });
    }

    await page.goBack({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#home-grid-track [data-listing-id]", { timeout: 45000 });
    await page.waitForTimeout(7000);

    const after = await page.evaluate(() => {
      const map = document.getElementById("search-map-modal");
      const cards = document.querySelectorAll("#home-grid-track [data-listing-id]").length;
      const carIcons = document.querySelectorAll(
        ".search-map-car-icon, .search-map-postal-cluster"
      ).length;
      const side = map?.querySelector("[data-search-map-side]")?.innerText?.slice(0, 200) || "";
      const stats = map?.querySelector(".search-map-modal__stats")?.innerText || "";
      return {
        mapHidden: map?.hidden ?? null,
        bodyMap: document.body.classList.contains("search-map-open"),
        cards,
        carIcons,
        side,
        stats,
        hasSs: new URLSearchParams(location.search).has("ss"),
      };
    });
    log("after back", after);

    if (after.mapHidden !== false) errors.push("map not open");
    if (after.cards < 1) errors.push(`listings gone (cards=${after.cards})`);
    if (after.carIcons < 1) errors.push(`no map pins (icons=${after.carIcons}, side=${after.side})`);

    const ok = errors.length === 0;
    console.log(ok ? "RESULT PASS" : "RESULT FAIL", errors);
    await page.screenshot({ path: "test-results/search-back-map2.png" });
    process.exit(ok ? 0 : 1);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await browser.close();
  }
}
main();
