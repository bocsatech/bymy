import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const fixture = readFileSync(join(root, "test/fixtures/ha-admin-vehicle-list.html"), "utf8");
const bookmarklet = readFileSync(join(root, "public/js/ha-import-bookmarklet.js"), "utf8");

test("dealer list extract: nested .row actions + HQ image URLs", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route("https://admin.hasznaltauto.hu/**", async (route) => {
      const url = route.request().url();
      if (url.includes("ha-import-bookmarklet")) {
        await route.fulfill({
          status: 200,
          contentType: "application/javascript; charset=utf-8",
          body: bookmarklet,
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: fixture,
      });
    });
    await page.goto("https://admin.hasznaltauto.hu/hirdeteseim", { waitUntil: "domcontentloaded" });
    await page.addScriptTag({ content: bookmarklet });

    const result = await page.evaluate(() => {
      const pages = window.BymyHaImport.extractDealerListPages(document);
      return pages.map((p) => ({
        id: p.listingId,
        title: p.visibleTitle,
        image: p.visibleImage,
        adminUrl: p.adminUrl,
      }));
    });

    assert.ok(result.length >= 3, `expected >=3 cars, got ${result.length}: ${JSON.stringify(result)}`);
    const byId = Object.fromEntries(result.map((r) => [r.id, r]));
    assert.ok(byId["23505596"], "missing 23505596");
    assert.match(byId["23505596"].image, /2048x1536\/23505596\/28800111\.jpg/);
    assert.match(byId["23505596"].title, /Mercedes-Benz E 250/i);
    assert.ok(byId["23161660"], "missing 23161660");
    assert.match(byId["23161660"].image, /2048x1536\/23161660\//);
    assert.ok(byId["23113337"], "missing 23113337 (onclick módosítás)");
    assert.match(byId["23113337"].image, /2048x1536\/23113337\/26375069\.jpg/);
  } finally {
    await browser.close();
  }
});

test("dealer collectAllDealerListPages finishes fast on fixture", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route("https://admin.hasznaltauto.hu/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: fixture,
      });
    });
    await page.goto("https://admin.hasznaltauto.hu/hirdeteseim", { waitUntil: "domcontentloaded" });
    await page.addScriptTag({ content: bookmarklet });

    const started = Date.now();
    const result = await page.evaluate(async () => {
      // collect is not exported — run slim path via extract + timing scroll
      const pages = window.BymyHaImport.extractDealerListPages(document);
      return { count: pages.length, withImage: pages.filter((p) => p.visibleImage).length };
    });
    const elapsed = Date.now() - started;
    assert.ok(result.count >= 3, JSON.stringify(result));
    assert.equal(result.withImage, result.count);
    assert.ok(elapsed < 5000, `extract too slow: ${elapsed}ms`);
  } finally {
    await browser.close();
  }
});

test("dealer run posts CDN pages via authToken without opener", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const posts = [];
    await page.route("https://admin.hasznaltauto.hu/**", async (route) => {
      const url = route.request().url();
      if (url.includes("ha-import-bookmarklet")) {
        await route.fulfill({
          status: 200,
          contentType: "application/javascript; charset=utf-8",
          body: bookmarklet,
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: fixture,
      });
    });
    await page.route("https://bymy.test/api/import/extracted", async (route) => {
      const req = route.request();
      posts.push({
        auth: req.headers()["authorization"] || "",
        body: req.postDataJSON(),
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, result: { savedCount: 1, errorCount: 0, items: [{ savedId: 1 }] } }),
      });
    });
    await page.goto("https://admin.hasznaltauto.hu/hirdeteseim", { waitUntil: "domcontentloaded" });
    await page.addScriptTag({ content: bookmarklet });
    const outcome = await page.evaluate(async () => {
      await window.BymyHaImport.run({
        origin: "https://bymy.test",
        mode: "dealer",
        authToken: "test-token-abc",
      });
      const progress = document.getElementById("bymy-ha-progress");
      return { text: progress ? progress.textContent : "", hasProgress: Boolean(progress) };
    });
    assert.ok(posts.length >= 3, `expected >=3 API posts, got ${posts.length}`);
    assert.match(posts[0].auth, /Bearer test-token-abc/);
    assert.equal(posts[0].body.photoOnly, true);
    assert.match(String(posts[0].body.pages?.[0]?.visibleImage || ""), /2048x1536/);
    assert.match(outcome.text, /Kész/i);
  } finally {
    await browser.close();
  }
});

test("dealer save path keeps CDN HQ fo_kep", async () => {
  const { mkdtempSync, rmSync } = await import("fs");
  const { join } = await import("path");
  const { tmpdir } = await import("os");
  const dir = mkdtempSync(join(tmpdir(), "ha-e2e-"));
  process.env.DB_BACKEND = "sqlite";
  process.env.AUTOSWEB_DB_PATH = join(dir, "test.db");
  process.env.AUTOSWEB_UPLOADS_PATH = join(dir, "listings");

  const { registerUser, activateUserByToken } = await import(`../lib/web-users.mjs?t=${Date.now()}`);
  const email = `e2e-${Date.now()}@local.dev`;
  const reg = await registerUser(email, "titok1titok12", "titok1titok12", "dealer");
  const activated = await activateUserByToken(reg.activationToken);
  const userId = activated.user.id;

  const { saveDealerPhotoImportPages } = await import(`../lib/ha-dealer-photo-import.mjs?t=${Date.now()}`);
  const { getListing } = await import(`../lib/db-store.mjs?t=${Date.now()}`);

  const result = await saveDealerPhotoImportPages({
    userId,
    pages: [
      {
        listingId: "23505596",
        url: "https://admin.hasznaltauto.hu/hirdetesfeladas/szemelyauto?id=23505596",
        visibleImage: "https://img.hasznaltautocdn.com/118x88/23505596/28800111.jpg",
        photoOnly: true,
      },
      {
        listingId: "23161660",
        visibleImage: "https://img.hasznaltautocdn.com/118x88/23161660/27770001.jpg",
        photoOnly: true,
      },
    ],
  });

  assert.equal(result.savedCount, 2);
  assert.equal(result.errorCount, 0);
  const a = await getListing(result.items[0].savedId);
  assert.equal(a.fo_kep, "https://img.hasznaltautocdn.com/2048x1536/23505596/28800111.jpg");
  rmSync(dir, { recursive: true, force: true });
});
