import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import {
  extractDealerCarsFromHtml,
  extractDealerCarsFromDocument,
} from "./ha-dealer-cdn-extract.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const fixture = readFileSync(join(root, "test/fixtures/ha-admin-vehicle-list.html"), "utf8");
const dealerJs = readFileSync(join(root, "public/js/ha-dealer-import.js"), "utf8");

test("cdn extract: listingId + HQ from thumb paths", () => {
  const cars = extractDealerCarsFromHtml(fixture);
  assert.equal(cars.length, 3);
  assert.equal(cars[0].listingId, "23505596");
  assert.equal(
    cars[0].visibleImage,
    "https://img.hasznaltautocdn.com/2048x1536/23505596/28800111.jpg"
  );
  assert.equal(cars[1].listingId, "23161660");
  assert.equal(cars[2].listingId, "23113337");
  assert.match(cars[2].visibleImage, /2048x1536\/23113337\/26375069\.jpg/);
});

test("cdn extract: protocol-relative and query noise", () => {
  const html = `
    <img src="//img.hasznaltautocdn.com/118x88/11111111/22222222.jpg?x=1" />
    <div style="background:url('https://img.hasznaltautocdn.com/240x180/33333333/44444444.jpeg')"></div>
  `;
  const cars = extractDealerCarsFromHtml(html);
  assert.equal(cars.length, 2);
  assert.equal(cars[0].visibleImage, "https://img.hasznaltautocdn.com/2048x1536/11111111/22222222.jpg");
  assert.equal(cars[1].visibleImage, "https://img.hasznaltautocdn.com/2048x1536/33333333/44444444.jpg");
});

test("dealer import script: extract + Bearer save loop", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const posts = [];
    await page.route("https://admin.hasznaltauto.hu/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: fixture });
    });
    await page.route("https://bymy.test/api/import/extracted", async (route) => {
      posts.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, result: { savedCount: 1, errorCount: 0 } }),
      });
    });
    await page.goto("https://admin.hasznaltauto.hu/hirdeteseim", { waitUntil: "domcontentloaded" });
    await page.addScriptTag({ content: dealerJs });
    const out = await page.evaluate(async () => {
      const found = window.BymyHaDealerImport.extractCarsFromPage();
      await window.BymyHaDealerImport.run({
        origin: "https://bymy.test",
        authToken: "tok-1",
      });
      return {
        found: found.length,
        progress: document.getElementById("bymy-ha-progress")?.textContent || "",
      };
    });
    assert.equal(out.found, 3);
    assert.equal(posts.length, 3);
    assert.equal(posts[0].photoOnly, true);
    assert.match(posts[0].pages[0].visibleImage, /2048x1536\/23505596\//);
    assert.match(out.progress, /Kész: 3/);
  } finally {
    await browser.close();
  }
});

test("dealer save still stores CDN HQ fo_kep", async () => {
  const { mkdtempSync, rmSync } = await import("fs");
  const { join: j } = await import("path");
  const { tmpdir } = await import("os");
  const dir = mkdtempSync(j(tmpdir(), "ha-cdn-"));
  process.env.DB_BACKEND = "sqlite";
  process.env.AUTOSWEB_DB_PATH = j(dir, "t.db");
  process.env.AUTOSWEB_UPLOADS_PATH = j(dir, "up");
  const { registerUser, activateUserByToken } = await import(`./web-users.mjs?t=${Date.now()}`);
  const reg = await registerUser(`cdn-${Date.now()}@local.dev`, "titok1titok12", "titok1titok12", "dealer");
  const userId = (await activateUserByToken(reg.activationToken)).user.id;
  const cars = extractDealerCarsFromHtml(fixture);
  const { saveDealerPhotoImportPages } = await import(`./ha-dealer-photo-import.mjs?t=${Date.now()}`);
  const { getListing } = await import(`./db-store.mjs?t=${Date.now()}`);
  const result = await saveDealerPhotoImportPages({ userId, pages: cars.slice(0, 2) });
  assert.equal(result.savedCount, 2);
  const row = await getListing(result.items[0].savedId);
  assert.equal(row.fo_kep, cars[0].visibleImage);
  rmSync(dir, { recursive: true, force: true });
});
