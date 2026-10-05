/**
 * Értékbecslés „Gyártási év” tól–ig menü ellenőrzése az autós kereső mintájához képest.
 * Statikus kiszolgáló kell: cd public && python3 -m http.server 4599
 *   node scripts/verify-ertek-ev-range.mjs
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";

const BASE = process.env.BASE_URL || "http://localhost:4599";
const OUT = "test-results/ertek-ev";
const CHROME =
  "/Users/rbocsa/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });

async function openPage(path) {
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 940 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err?.message || err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text().slice(0, 160)}`);
  });
  page.on("requestfailed", (req) => {
    errors.push(`404/fail: ${req.url().replace(BASE, "")}`);
  });
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  return { ctx, page, errors };
}

async function probe(page) {
  return page.evaluate(() => {
    const block =
      document.querySelector('.immo-dual-range-block[data-range="gyartasi_ev"]') ||
      document.querySelector('[data-range="gyartasi_ev"]');
    const summary = block?.querySelector("button");
    return {
      bodyPage: document.body?.getAttribute("data-site-page") || null,
      hasForm: Boolean(document.getElementById("ad-form")),
      status: document.querySelector("[data-ertek-status]")?.textContent?.trim() || null,
      found: Boolean(block),
      blockClass: block?.className || null,
      summaryText: summary?.textContent?.trim() || null,
      wheels: [...(block?.querySelectorAll("[data-wheel]") || [])].map((w) => ({
        wheel: w.getAttribute("data-wheel"),
        filterKey: w.getAttribute("data-filter-key"),
        opts: w.querySelectorAll(".immo-wheel-opt").length,
      })),
    };
  });
}

const results = [];

for (const [tag, path, pre] of [
  ["auto.html", "/auto.html", true],
  ["ertekbecsles.html", "/ertekbecsles.html", false],
]) {
  const { ctx, page, errors } = await openPage(path);
  if (pre) {
    await page.evaluate(() => {
      document
        .querySelectorAll("[data-qs-more-toggle], .home-qs-more-toggle, [data-auto-more], .auto-search-more-toggle")
        .forEach((el) => el.click());
    });
    await page.waitForTimeout(800);
  }
  const info = await probe(page);
  results.push({ tag, ...info, errors: errors.slice(0, 8) });
  await page.screenshot({ path: `${OUT}/${tag.replace(".html", "")}-page.png`, fullPage: false });
  const block = page.locator('[data-range="gyartasi_ev"]').first();
  if (await block.count()) {
    await block.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await block.screenshot({ path: `${OUT}/${tag.replace(".html", "")}-ev-closed.png` });
    await block.locator("button").first().click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${tag.replace(".html", "")}-ev-sheet.png` });
  }
  await ctx.close();
}

console.log(JSON.stringify(results, null, 1));
await browser.close();
