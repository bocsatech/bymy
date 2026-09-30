/**
 * Mobile Gyártmány dobkerék: teljes lista, multi switch, ~10 sor magas.
 * BYMY_BASE=http://127.0.0.1:3456 node scripts/verify-brand-drum-mobile.mjs
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BYMY_BASE || "http://127.0.0.1:3456";
const OUT = { ok: false, checks: [], errors: [] };
const log = (name, pass, detail) => {
  OUT.checks.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail != null ? `: ${JSON.stringify(detail)}` : ""}`);
  if (!pass) OUT.errors.push(`${name}: ${detail}`);
};

async function main() {
  mkdirSync("test-results", { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({
    locale: "hu-HU",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  try {
    await page.goto(`${BASE}/auto.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#home-qs-form", { state: "attached" });
    await page.waitForFunction(
      () => document.getElementById("home-qs-form")?.dataset?.drumsMounted === "1",
      null,
      { timeout: 30000 }
    );
    await page.waitForFunction(
      () => document.getElementById("home-qs-form")?.classList.contains("is-qs-ready"),
      null,
      { timeout: 30000 }
    );
    await page.locator("#auto-search-toggle").click();
    await page.waitForSelector(".auto-search-panel.is-open", { timeout: 5000 });
    await page.waitForTimeout(300);

    const wheelMeta = await page.evaluate(() => {
      const form = document.getElementById("home-qs-form");
      const wheel = form?.querySelector('[data-wheel="gyartmany"]');
      const trigger = wheel?.closest(".immo-wheel-wrap")?.querySelector(".immo-wheel-trigger");
      return {
        optCount: wheel?.querySelectorAll(".immo-wheel-opt").length ?? 0,
        multiple: wheel?.dataset?.multiple,
        catalogBrands: form?._autoDrumCatalog?.gyartmanyok?.length ?? 0,
        triggerText: trigger?.textContent?.trim(),
        triggerDisabled: trigger?.disabled,
      };
    });
    log("wheel hidden opts after mount", wheelMeta.optCount >= 50, wheelMeta);

    const trigger = page.locator('[data-qs-field="gyartmany"] .immo-wheel-trigger').first();
    await trigger.click();
    await page.waitForSelector(".auto-drum-portal--multi", { state: "visible", timeout: 15000 });

    const portal = await page.evaluate(() => {
      const root = document.querySelector(".auto-drum-portal--multi");
      const scroll = root?.querySelector(".auto-drum-portal__scroll");
      const items = [...(scroll?.querySelectorAll(".immo-drum-inline-item") ?? [])];
      const switches = scroll?.querySelectorAll(".auto-drum-switch") ?? [];
      const ring = root?.querySelector(".auto-drum-portal__ring--multi");
      const ringRect = ring?.getBoundingClientRect();
      const first = items[0];
      const firstRect = first?.getBoundingClientRect();
      const firstText = first?.querySelector(".immo-drum-inline-text");
      const firstCs = firstText ? getComputedStyle(firstText) : null;
      const firstItemCs = first ? getComputedStyle(first) : null;
      const afterContent = first ? getComputedStyle(first, "::after").content : null;
      const sw = first?.querySelector(".auto-drum-switch");
      const swRect = sw?.getBoundingClientRect();
      const padTop = scroll ? parseFloat(getComputedStyle(scroll).paddingTop) : null;
      const firstItems = items.slice(0, 12).map((el) => el.querySelector(".immo-drum-inline-text")?.textContent?.trim());
      return {
        itemCount: items.length,
        switchCount: switches.length,
        hasDone: Boolean(root?.querySelector(".auto-drum-portal__done")),
        ringHeight: ringRect?.height,
        padTop,
        topGap: firstRect && ringRect ? firstRect.top - ringRect.top : null,
        textColor: firstCs?.color,
        opacity: firstItemCs?.opacity,
        afterContent,
        switchRightGap: swRect && ringRect ? ringRect.right - swRect.right : null,
        firstItems,
        isMultiClass: root?.classList.contains("auto-drum-portal--multi"),
      };
    });
    log("portal is multi sheet", portal.isMultiClass === true, portal.isMultiClass);
    log("portal item count (full catalog)", portal.itemCount >= 50, portal.itemCount);
    log("switches on rows", portal.switchCount >= 50, portal.switchCount);
    log("Kész button", portal.hasDone === true, portal.hasDone);
    log("ring tall (~10 rows)", (portal.ringHeight ?? 0) >= 400, {
      ringHeight: portal.ringHeight,
    });
    log("no large empty top", (portal.padTop ?? 999) < 40 && (portal.topGap ?? 999) < 40, {
      padTop: portal.padTop,
      topGap: portal.topGap,
    });
    log("text black", /^(rgb\(0,\s*0,\s*0\)|#000)/i.test(portal.textColor || ""), portal.textColor);
    log("no checkmark ::after", !portal.afterContent || portal.afterContent === "none" || portal.afterContent === '""', portal.afterContent);
    log("switch near right edge", (portal.switchRightGap ?? 99) < 24, portal.switchRightGap);
    log("first labels look like brands", portal.firstItems?.[0] === "Mindegy" && portal.firstItems?.length > 5, portal.firstItems);

    // Toggle two brands
    await page.locator('.auto-drum-portal--multi .immo-drum-inline-item[data-value="BMW"]').click();
    await page.locator('.auto-drum-portal--multi .immo-drum-inline-item[data-value="AUDI"]').click();

    const selectedUi = await page.evaluate(() => {
      const item = document.querySelector('.auto-drum-portal--multi .immo-drum-inline-item[data-value="BMW"]');
      const ring = document.querySelector(".auto-drum-portal__ring--multi");
      const sw = item?.querySelector(".auto-drum-switch");
      const after = item ? getComputedStyle(item, "::after").content : null;
      const swRect = sw?.getBoundingClientRect();
      const ringRect = ring?.getBoundingClientRect();
      return {
        after,
        switchRightGap: swRect && ringRect ? ringRect.right - swRect.right : null,
        textColor: item ? getComputedStyle(item.querySelector(".immo-drum-inline-text")).color : null,
      };
    });
    log("selected row no pipa", !selectedUi.after || selectedUi.after === "none" || selectedUi.after === '""', selectedUi.after);
    log("selected switch still at edge", (selectedUi.switchRightGap ?? 99) < 24, selectedUi.switchRightGap);
    log("selected text black", /^(rgb\(0,\s*0,\s*0\)|#000)/i.test(selectedUi.textColor || ""), selectedUi.textColor);

    await page.locator(".auto-drum-portal__done").click();
    await page.waitForSelector(".auto-drum-portal--multi", { state: "hidden", timeout: 5000 }).catch(() => {});

    // Brand Done → model sheet opens from catalog
    await page.waitForSelector(".auto-drum-portal--multi", { state: "visible", timeout: 8000 });
    const modelPortal = await page.evaluate(() => {
      const root = document.querySelector(".auto-drum-portal--multi");
      const wheel = root && document.querySelector('[data-wheel="modell"]');
      const items = [...(root?.querySelectorAll(".immo-drum-inline-item") ?? [])].map((el) =>
        el.querySelector(".immo-drum-inline-text")?.textContent?.trim()
      );
      return {
        open: Boolean(root),
        itemCount: items.length,
        sample: items.slice(0, 8),
        hasSeries: items.some((t) => /^[1-8]$|^X[1-7]$|^Z4$/i.test(String(t))),
      };
    });
    log("model sheet opens after brand Done", modelPortal.open === true, modelPortal);
    log("model list from catalog (BMW)", (modelPortal.itemCount ?? 0) > 5 && modelPortal.hasSeries, {
      itemCount: modelPortal.itemCount,
      sample: modelPortal.sample,
    });

    await page.locator(".auto-drum-portal__done").click();
    await page.waitForSelector(".auto-drum-portal--multi", { state: "hidden", timeout: 5000 });

    const after = await page.evaluate(() => {
      const form = document.getElementById("home-qs-form");
      const wheel = form?.querySelector('[data-wheel="gyartmany"]');
      const trigger = wheel?.closest(".immo-wheel-wrap")?.querySelector(".immo-wheel-trigger");
      return {
        triggerText: trigger?.textContent?.trim(),
        hiddenValue: wheel?.closest(".immo-wheel-wrap")?.querySelector('input[type="hidden"]')?.value,
      };
    });
    log("multi select persisted", /2 kiválasztva|BMW|AUDI/i.test(after.triggerText || ""), after);

    await page.screenshot({ path: "test-results/brand-drum-mobile-verify.png", fullPage: false });

    OUT.ok = OUT.errors.length === 0;
    writeFileSync(join("test-results", "brand-drum-mobile-verify.json"), JSON.stringify(OUT, null, 2));
    console.log("\n" + (OUT.ok ? "PASS" : "FAIL"), OUT.errors.join("; ") || "");
    process.exit(OUT.ok ? 0 : 1);
  } catch (e) {
    OUT.errors.push(String(e.message || e));
    await page.screenshot({ path: "test-results/brand-drum-mobile-fail.png", fullPage: true }).catch(() => {});
    console.error(e);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
