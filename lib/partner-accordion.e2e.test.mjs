import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";

test("partner widget: összecsukva indul, kinyitás után accordion működik", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto("http://127.0.0.1:3456/", { waitUntil: "networkidle" });

    assert.equal(
      await page.locator("#home-partner-recommendations").evaluate((el) => el.classList.contains("is-collapsed")),
      true,
      "induláskor összecsukva"
    );
    assert.equal(await page.locator("#home-partner-rec-body").evaluate((el) => el.hidden), true);
    assert.equal(await page.locator("#home-partner-postal-status").evaluate((el) => el.hidden), true);

    await page.click("#home-partner-rec-toggle");
    assert.equal(
      await page.locator("#home-partner-recommendations").evaluate((el) => el.classList.contains("is-collapsed")),
      false
    );

    await page.fill("#home-partner-postal-input", "8000");
    await page.click(".home-partner-postal-btn");
    await page.waitForSelector("#home-partner-accordion", { timeout: 15000 });

    const toggleCount = await page.locator(".home-partner-category-toggle").count();
    assert.ok(toggleCount >= 9, "legalább 9 kategória");

    assert.equal(
      await page.locator(".home-partner-category-panel:not([hidden])").count(),
      0,
      "kategóriák zárva betöltés után"
    );

    await page.locator(".home-partner-category-toggle").first().click();
    assert.equal(await page.locator(".home-partner-category.is-open").count(), 1);

    await page.locator(".home-partner-category-toggle").nth(1).click();
    assert.equal(await page.locator(".home-partner-category.is-open").count(), 1);
    assert.equal(await page.locator(".home-partner-category-panel:not([hidden])").count(), 1);

    await page.click("#home-partner-collapse-all");
    assert.equal(await page.locator("#home-partner-accordion").count(), 0);
    assert.equal(await page.locator("#home-partner-results").evaluate((el) => el.hidden), true);
    assert.equal(
      await page.locator("#home-partner-recommendations").evaluate((el) => el.classList.contains("is-collapsed")),
      true,
      "összes becsukása után widget zárva"
    );
    assert.equal(await page.locator("#home-partner-recommendations").isVisible(), true);
  } finally {
    await browser.close();
  }
});
