#!/usr/bin/env node
/**
 * PNG demók: docs/design-demos/kiemelt-listing-cards-demo.html
 * node scripts/capture-kiemelt-card-demos.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = path.join(root, "docs/design-demos/kiemelt-listing-cards-demo.html");
const outDir = path.join(root, "docs/design-demos");

const exports = [
  { selector: '[data-export="kiemelt-cards-01-alap"]', file: "kiemelt-cards-01-alap.png" },
  { selector: '[data-export="kiemelt-cards-02-keret-badge"]', file: "kiemelt-cards-02-keret-badge.png" },
  { selector: '[data-export="kiemelt-cards-03-dupla-slot"]', file: "kiemelt-cards-03-dupla-slot.png" },
  { selector: '[data-export="kiemelt-cards-04-csik-lift"]', file: "kiemelt-cards-04-csik-lift.png" },
  { selector: '[data-export="kiemelt-cards-05-overlay"]', file: "kiemelt-cards-05-overlay.png" },
  { selector: '[data-export="kiemelt-cards-06-kombo"]', file: "kiemelt-cards-06-kombo.png" },
  { selector: '[data-export="kiemelt-cards-06-uj"]', file: "kiemelt-cards-06-uj.png" },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 720 } });
await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);

for (const { selector, file } of exports) {
  const el = page.locator(selector);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await el.screenshot({ path: path.join(outDir, file), type: "png" });
  console.log("✓", file);
}

await browser.close();
console.log("Kész:", outDir);
