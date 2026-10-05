#!/usr/bin/env node
/** Demó képek a docs/design-demos/mobil-csempe-4.html variánsairól (mobil 430px). */
import { chromium } from "playwright";
import path from "node:path";

const BASE = process.env.DEMO_BASE || "http://localhost:8901/mobil-csempe-4.html";
const OUT = path.resolve("docs/design-demos");
const VARIANTS = ["a", "b", "c", "d"];

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

for (const v of VARIANTS) {
  await page.goto(`${BASE}?v=${v}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const file = path.join(OUT, `mobil-csempe-${v}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`ok ${v} -> ${file}`);
}

await browser.close();
