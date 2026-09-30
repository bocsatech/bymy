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
    await page.waitForSelector(".auto-drum-portal--multi .immo-drum-inline-item", { state: "attached", timeout: 5000 });

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
      const scrollRect = scroll?.getBoundingClientRect();
      const firstItems = items.slice(0, 12).map((el) => el.querySelector(".immo-drum-inline-text")?.textContent?.trim());
      const toolbar = root?.querySelector(".auto-drum-portal__toolbar");
      return {
        itemCount: items.length,
        switchCount: switches.length,
        hasDone: Boolean(root?.querySelector(".auto-drum-portal__toolbar .auto-drum-portal__done") || root?.querySelector(".auto-drum-portal__done")),
        ringHeight: ringRect?.height,
        borderWidth: ring ? getComputedStyle(ring).borderTopWidth : null,
        padTop,
        topGap: firstRect && scrollRect ? firstRect.top - scrollRect.top : null,
        textColor: firstCs?.color,
        opacity: firstItemCs?.opacity,
        afterContent,
        switchRightGap: swRect && ringRect ? ringRect.right - swRect.right : null,
        firstItems,
        isMultiClass: root?.classList.contains("auto-drum-portal--multi"),
        hasToolbar: Boolean(toolbar),
        backHiddenOnBrands: root?.querySelector(".auto-drum-portal__back")?.hidden,
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
    log("thicker border", parseFloat(portal.borderWidth || "0") >= 2.5, portal.borderWidth);
    log("top toolbar with Kész", portal.hasToolbar === true && portal.hasDone === true, {
      hasToolbar: portal.hasToolbar,
      hasDone: portal.hasDone,
    });
    log("Vissza hidden on brand list", portal.backHiddenOnBrands === true, portal.backHiddenOnBrands);
    log("text black", /^(rgb\(0,\s*0,\s*0\)|#000)/i.test(portal.textColor || ""), portal.textColor);
    log("no checkmark ::after", !portal.afterContent || portal.afterContent === "none" || portal.afterContent === '""', portal.afterContent);
    log("switch near right edge", (portal.switchRightGap ?? 99) < 24, portal.switchRightGap);
    log("first labels look like brands", portal.firstItems?.[0] === "Mindegy" && portal.firstItems?.length > 5, portal.firstItems);

    // Toggle BMW → same portal switches to Modell list
    await page.locator('.auto-drum-portal--multi .immo-drum-inline-item[data-value="BMW"]').click();
    await page.waitForTimeout(200);

    const afterBrandOn = await page.evaluate(() => {
      const root = document.querySelector(".auto-drum-portal--bm, .auto-drum-portal--multi");
      const view = root?.querySelector(".auto-drum-portal__ring")?.dataset?.view;
      const sub = root?.querySelector(".auto-drum-portal__sub")?.textContent?.trim();
      const back = root?.querySelector(".auto-drum-portal__back");
      const done = root?.querySelector(".auto-drum-portal__toolbar .auto-drum-portal__done");
      const items = [...(root?.querySelectorAll(".immo-drum-inline-item") ?? [])].map((el) =>
        el.querySelector(".immo-drum-inline-text")?.textContent?.trim()
      );
      return {
        view,
        sub,
        backText: back?.textContent?.trim(),
        backHidden: back?.hidden,
        topDone: Boolean(done),
        itemCount: items.length,
        sample: items.slice(0, 8),
      };
    });
    log(
      "same portal switches to Modell",
      afterBrandOn.view === "models" && afterBrandOn.sub === "BMW",
      afterBrandOn
    );
    log("model rows from catalog", (afterBrandOn.itemCount ?? 0) > 5, afterBrandOn.sample);
    log("Vissza visible on model view", afterBrandOn.backHidden === false && afterBrandOn.backText === "Vissza", {
      backText: afterBrandOn.backText,
      backHidden: afterBrandOn.backHidden,
    });
    log("Kész in top toolbar", afterBrandOn.topDone === true, afterBrandOn.topDone);

    await page.locator(".auto-drum-portal__back").click();
    await page.waitForTimeout(150);
    const backToBrands = await page.evaluate(() => ({
      view: document.querySelector(".auto-drum-portal__ring")?.dataset?.view,
      first: document.querySelector(".immo-drum-inline-text")?.textContent?.trim(),
      backHidden: document.querySelector(".auto-drum-portal__back")?.hidden,
    }));
    log("back returns to Gyártmány", backToBrands.view === "brands" && backToBrands.backHidden === true, backToBrands);

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
    log("brand selection persisted", /BMW/i.test(after.triggerText || "") || /BMW/i.test(after.hiddenValue || ""), after);

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
