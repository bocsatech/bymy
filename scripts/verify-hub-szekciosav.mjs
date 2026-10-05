#!/usr/bin/env node
/** Szekciósáv ellenőrzés: az éles kezdőlapra injektálja a friss mobil CSS-t. */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const URL = process.env.HUB_URL || "https://bymy.vercel.app/";
const OUT = path.resolve("test-results");
fs.mkdirSync(OUT, { recursive: true });

const mobileCss = fs.readFileSync("public/css/hub-mobile-app.css", "utf8");
const inlineOverride = `
  @media (max-width: 800px) {
    body.hub-page--feed .hf-section {
      padding: 14px var(--hf-gutter) 16px !important;
      margin: 0 calc(var(--hf-gutter) * -1) 14px !important;
    }
  }
  .hf-card--listing.hf-card--featured .hf-card-price,
  .home-grid-card.home-grid-card--featured .home-grid-card-price { color: #111; }
  .hf-card--prompt-all .hf-card-media {
    background: linear-gradient(145deg, #f6d57f 0%, #e6a800 100%);
  }
`;

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.HOME +
    "/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
});
const page = await browser.newPage({
  viewport: { width: 430, height: 1000 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(OUT, "szekciosav-elotte.png"), fullPage: false });

await page.addStyleTag({ content: mobileCss });
await page.addStyleTag({ content: inlineOverride });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, "szekciosav-utana.png"), fullPage: false });
await page.evaluate(() => window.scrollBy(0, 760));
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, "szekciosav-utana-2.png"), fullPage: false });

const blues = await page.evaluate(() => {
  const hits = [];
  for (const el of document.querySelectorAll(".hub-feed *, .hub-intro *")) {
    const cs = getComputedStyle(el);
    for (const prop of ["color", "backgroundColor", "borderBottomColor"]) {
      const m = cs[prop].match(/^rgba?\((\d+), (\d+), (\d+)/);
      if (!m) continue;
      const [r, g, b] = [+m[1], +m[2], +m[3]];
      if (b > 110 && b - r > 45 && b - g > 25) {
        hits.push(`${el.className || el.tagName} ${prop}=${cs[prop]}`);
      }
    }
  }
  return [...new Set(hits)].slice(0, 20);
});
console.log("kék találatok:", blues.length ? blues : "nincs");

await browser.close();
