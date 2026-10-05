#!/usr/bin/env node
/**
 * Scrape HA public detail pages into tmp-ha-extracts.json for fill-thin-from-ha-extract.mjs
 * Usage: node scripts/scrape-ha-public-batch.mjs [todo.json] [out.json]
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { chromium } from "playwright";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");
const todoPath = process.argv[2] || join(root, "tmp-scrape-todo.json");
const outPath = process.argv[3] || join(root, "tmp-ha-extracts.json");
const todo = JSON.parse(readFileSync(todoPath, "utf8"));
const EXTRACT = readFileSync(join(__dir, "ha-public-extract-snippet.js"), "utf8");

mkdirSync(join(root, "tmp-ha-extracts"), { recursive: true });

const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
  args: ["--disable-blink-features=AutomationControlled"],
});
const context = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  locale: "hu-HU",
  viewport: { width: 1280, height: 900 },
});
const page = await context.newPage();

const out = [];
for (const item of todo) {
  const row = { id: item.id, ha: String(item.ha), userId: item.userId || 21 };
  try {
    await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    // Wait out Cloudflare / soft challenges
    for (let attempt = 0; attempt < 6; attempt++) {
      const title = await page.title();
      const hasLabels = (await page.locator(".print-basic-info-item__label").count()) > 0;
      if (hasLabels && !/just a moment|egy pillanat|attention required/i.test(title)) break;
      await page.waitForTimeout(4000 + attempt * 1500);
      if (attempt === 3) {
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      }
    }
    await page.waitForSelector(".print-basic-info-item__label", { timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(800);
    const extract = await page.evaluate(EXTRACT);
    const km = extract?.pairs?.["Km. óra állás"] || "";
    const pairN = Object.keys(extract?.pairs || {}).length;
    const eqN = (extract?.equip || []).length;
    const ok = extract && pairN >= 8 && (km || eqN >= 5);
    row.extract = extract;
    if (!ok) {
      row.error = "thin extract";
      console.log(JSON.stringify({ ok: false, id: item.id, ha: item.ha, title, pairN, eqN }));
    } else {
      console.log(JSON.stringify({ ok: true, id: item.id, ha: item.ha, km, eq: eqN, pairs: pairN }));
    }
    writeFileSync(join(root, "tmp-ha-extracts", `${item.id}.json`), JSON.stringify(row, null, 2));
  } catch (e) {
    row.error = e.message || String(e);
    console.log(JSON.stringify({ ok: false, id: item.id, ha: item.ha, error: row.error }));
  }
  out.push(row);
  writeFileSync(outPath, JSON.stringify(out, null, 2));
}

await browser.close();
const good = out.filter((x) => x.extract && !x.error).length;
console.log(JSON.stringify({ done: true, total: out.length, good, outPath }));
