#!/usr/bin/env node
/**
 * Használtautó ár-letöltés (szelektív).
 *
 * Szabályok: docs/ha-ar-letoltes-gyartmanyok.txt
 *   - alap: lista oldal (cím, év, km, ár)
 *   - reszletes:ev:YYYY → gyártási év >= YYYY detail (későbbi kör; most alap MVP)
 *
 * Használat:
 *   1) npm run ha:price-download -- --brand BMW --max-pages 2
 *   2) vagy: BRAND=BMW MAX_PAGES=2 npm run ha:price-download
 *   3) npm run ha:price-write-market  → rows.jsonl → értékbecslő dump (scrape nélkül)
 *
 * Chrome: a script indítja a debug Chrome-ot (CDP 9222), ha nincs.
 * Cloudflare: ha „Egy pillanat…”, fogadd el a Chrome ablakban.
 *
 * Kimenet:
 *   data/ha-prices/rows.jsonl
 *   data/ha-prices/progress.json
 *   lib/ha-market/prices.json.gz  (ha --write-market / --write-market-only)
 */
import { mkdirSync, writeFileSync, appendFileSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { chromium } from "playwright";
import { loadHaPriceRules, summarizeHaPriceRules } from "../lib/ha-price-rules.mjs";
import {
  startChromeWithDebugging,
  waitForCdpReady,
  isCdpReady,
  getChromeProfileDir,
} from "../lib/chrome-launcher.mjs";

const ROOT = resolve("data/ha-prices");
const ROWS_FILE = join(ROOT, "rows.jsonl");
const PROGRESS_FILE = join(ROOT, "progress.json");
const LOG_FILE = join(ROOT, "scrape.log");
const MARKET_GZ = resolve("lib/ha-market/prices.json.gz");
const MARKET_META = resolve("lib/ha-market/meta.json");

const CDP_URL = process.env.CDP_URL || "http://127.0.0.1:9222";
const WWW = "https://www.hasznaltauto.hu";

function parseArgs(argv) {
  const out = {
    path: null,
    brand: process.env.BRAND || "",
    // 0 = összes fennmaradó oldal a márkánál
    maxPages: process.env.MAX_PAGES != null && process.env.MAX_PAGES !== ""
      ? Number(process.env.MAX_PAGES)
      : 0,
    maxBrands: Number(process.env.MAX_BRANDS || 0) || 0,
    writeMarket: process.env.WRITE_MARKET === "1",
    writeMarketOnly: process.env.WRITE_MARKET_ONLY === "1",
    planOnly: false,
    resume: process.env.RESUME !== "0",
    delayMs: Number(process.env.DELAY_MS || 800) || 800,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--path" && argv[i + 1]) out.path = argv[++i];
    else if (a === "--brand" && argv[i + 1]) out.brand = argv[++i];
    else if (a === "--max-pages" && argv[i + 1]) out.maxPages = Number(argv[++i]);
    else if (a === "--max-brands" && argv[i + 1]) out.maxBrands = Number(argv[++i]) || 0;
    else if (a === "--write-market") out.writeMarket = true;
    else if (a === "--write-market-only") {
      out.writeMarketOnly = true;
      out.writeMarket = true;
    } else if (a === "--plan") out.planOnly = true;
    else if (a === "--no-resume") out.resume = false;
    else if (a === "--resume") out.resume = true;
    else if (a === "--delay" && argv[i + 1]) out.delayMs = Number(argv[++i]) || 800;
  }
  if (!Number.isFinite(out.maxPages) || out.maxPages < 0) out.maxPages = 0;
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  mkdirSync(ROOT, { recursive: true });
  appendFileSync(LOG_FILE, `${line}\n`);
}

function brandSlug(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\(([^)]*)\)/g, " $1 ")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]+/g, "")
    .replace(/[_-]{2,}/g, (m) => (m.includes("-") && !m.includes("_") ? "-" : "_"))
    .replace(/^[_-]+|[_-]+$/g, "");
}

/** Ha az első slug üres, próbál hyphen/underscore váltást. */
function brandSlugCandidates(name) {
  const primary = brandSlug(name);
  const alt = primary.includes("_")
    ? primary.replace(/_/g, "-")
    : primary.includes("-")
      ? primary.replace(/-/g, "_")
      : "";
  return [...new Set([primary, alt].filter(Boolean))];
}

function brandListUrl(brand, page = 1, slugOverride = null) {
  const slug = slugOverride || brandSlug(brand);
  const base = `${WWW}/szemelyauto/${slug}`;
  return page <= 1 ? base : `${base}/page${page}`;
}

function parseFt(text) {
  const n = Number(String(text || "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseYear(text) {
  const m = String(text || "").match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : null;
}

function parseKm(text) {
  const m = String(text || "").match(/(\d[\d\s.]{2,})\s*km/i);
  if (!m) return null;
  const n = Number(m[1].replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function writeProgress(extra = {}) {
  writeFileSync(PROGRESS_FILE, JSON.stringify({ at: new Date().toISOString(), ...extra }, null, 2));
}

function loadProgress() {
  if (!existsSync(PROGRESS_FILE)) return { brands: {} };
  try {
    const raw = JSON.parse(readFileSync(PROGRESS_FILE, "utf8"));
    if (!raw.brands || typeof raw.brands !== "object") raw.brands = {};
    return raw;
  } catch {
    return { brands: {} };
  }
}

function saveBrandProgress(progress, brand, patch) {
  if (!progress.brands) progress.brands = {};
  progress.brands[brand] = {
    ...(progress.brands[brand] || {}),
    ...patch,
    updated_at: new Date().toISOString(),
  };
  writeProgress({
    brands: progress.brands,
    current: brand,
    nextPage: patch.nextPage ?? progress.brands[brand]?.nextPage,
    done: patch.done ?? progress.brands[brand]?.done,
  });
}

async function ensureChrome() {
  if (await isCdpReady(9222)) {
    log("Chrome CDP már fut (9222).");
    return 9222;
  }
  log("Chrome indítása debug módban…");
  startChromeWithDebugging(`${WWW}/szemelyauto`, 9222);
  const port = await waitForCdpReady(9222, {
    profileDir: getChromeProfileDir(),
    timeoutMs: 60000,
    onProgress: (m) => log(m),
  });
  if (!port) throw new Error("Chrome CDP nem indult el (9222).");
  return port;
}

async function connect(port) {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0];
  if (!context) throw new Error("Nincs Chrome kontextus.");
  return { browser, context };
}

async function ensureWww(page) {
  if (!page.url().includes("hasznaltauto.hu")) {
    await page.goto(`${WWW}/szemelyauto`, { waitUntil: "domcontentloaded", timeout: 90000 });
  }
  for (let i = 0; i < 90; i++) {
    let st = null;
    try {
      st = await page.evaluate(() => ({
        title: document.title,
        host: location.hostname,
        cf: /pillanat|just a moment|attention required|cloudflare/i.test(document.title),
      }));
    } catch {
      await sleep(1000);
      continue;
    }
    if (!st.cf && /hasznaltauto\.hu$/i.test(st.host)) {
      log(`Chrome OK: ${st.title.slice(0, 60)}`);
      return;
    }
    if (i % 5 === 0) log(`Várakozás Cloudflare-re… (${i}s) — kattints a Chrome-ban ha kell`);
    await sleep(1000);
  }
  throw new Error("Cloudflare nem ment át a debug Chrome-ban.");
}

/** Listaoldal kártyák kiolvasása a DOM-ból (.listing-card). */
async function scrapeListPage(page) {
  return page.evaluate(() => {
    const abs = (href) => {
      try {
        const u = new URL(href, location.origin);
        return u.pathname + u.search;
      } catch {
        return href;
      }
    };
    const num = (text) => {
      const n = Number(String(text || "").replace(/[^\d]/g, ""));
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const cards = [...document.querySelectorAll(".listing-card")];
    const items = [];
    for (const card of cards) {
      const idEl = card.querySelector("[data-listing--card-ad-id-value]");
      const id =
        idEl?.getAttribute("data-listing--card-ad-id-value") ||
        (card.innerHTML.match(/-(\d{7,})(?:["'?#]|$)/) || [])[1] ||
        "";
      if (!id) continue;

      const link =
        card.querySelector(`a[href*="-${id}"]`) ||
        card.querySelector('a[href*="/szemelyauto/"]');
      const href = link?.getAttribute("href") || "";

      const title =
        card.querySelector("img[alt]")?.getAttribute("alt")?.trim() ||
        card.querySelector(".d-flex.align-items-baseline")?.textContent?.replace(/\s+/g, " ").trim() ||
        "";

      const badges = [...card.querySelectorAll(".highlighted-info__text, .badge")]
        .map((el) => el.textContent.replace(/\s+/g, " ").trim())
        .filter(Boolean);

      let year = null;
      let km = null;
      let fuel = "";
      let power = "";
      let gear = "";
      for (const b of badges) {
        if (!year) {
          const ym = b.match(/\b((?:19|20)\d{2})(?:\s*\/\s*\d{1,2})?\b/);
          if (ym) year = Number(ym[1]);
        }
        if (!km && /km/i.test(b)) km = num(b);
        if (!fuel && /dízel|benzin|hibrid|elektromos|lpg|cng|plugin|plug-in/i.test(b)) fuel = b;
        if (!power && /\b(kW|LE)\b/i.test(b)) power = b;
        if (!gear && /automat|manuál|tiptronic|dsg|cvt/i.test(b)) gear = b;
      }

      const priceText =
        card.querySelector(".price__main")?.textContent ||
        [...card.querySelectorAll("*")]
          .map((el) => el.childNodes.length === 1 && el.textContent)
          .find((t) => t && /^\s*[\d\s.]+\s*Ft\s*$/i.test(t)) ||
        "";
      const price = num(priceText);
      if (!title || !price) continue;

      items.push({
        id: String(id),
        url: abs(href),
        title: title.slice(0, 180),
        year,
        km,
        price,
        fuel,
        power,
        gear,
      });
    }

    const pageLinks = [...document.querySelectorAll("a[data-page], .pagination a, nav a")]
      .map((a) => Number(a.getAttribute("data-page") || a.textContent))
      .filter((n) => Number.isFinite(n) && n > 0);
    const maxPage = pageLinks.length ? Math.max(...pageLinks) : 1;

    return {
      items,
      maxPage,
      title: document.title,
      href: location.href,
      cardCount: cards.length,
    };
  });
}

function loadExistingIds() {
  const ids = new Set();
  if (!existsSync(ROWS_FILE)) return ids;
  for (const line of readFileSync(ROWS_FILE, "utf8").split(/\n/)) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row?.id) ids.add(String(row.id));
    } catch {
      /* ignore */
    }
  }
  return ids;
}

function appendRows(rows) {
  if (!rows.length) return;
  const body = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  appendFileSync(ROWS_FILE, body);
}

function rebuildMarketGz({ merge = true } = {}) {
  if (!existsSync(ROWS_FILE)) {
    log("Nincs rows.jsonl — market dump kihagyva.");
    return;
  }
  const byKey = new Map();
  if (merge && existsSync(MARKET_GZ)) {
    try {
      const prev = JSON.parse(gunzipSync(readFileSync(MARKET_GZ)).toString("utf8"));
      if (Array.isArray(prev)) {
        for (const row of prev) {
          if (!Array.isArray(row) || !row[0] || !row[3]) continue;
          const key = `prev|${row[0]}|${row[1]}|${row[2]}|${row[3]}`;
          byKey.set(key, row);
        }
        log(`Market merge: meglévő ${byKey.size} sor`);
      }
    } catch (err) {
      log(`Market merge skip: ${err.message}`);
    }
  }
  for (const line of readFileSync(ROWS_FILE, "utf8").split(/\n/)) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      if (!r?.title || !r?.price) continue;
      const key = r.id ? `id:${r.id}` : `${r.title}|${r.year}|${r.km}|${r.price}`;
      byKey.set(key, [r.title, r.year ?? null, r.km ?? null, r.price]);
    } catch {
      /* ignore */
    }
  }
  const rows = [...byKey.values()];
  mkdirSync(resolve("lib/ha-market"), { recursive: true });
  writeFileSync(MARKET_GZ, gzipSync(Buffer.from(JSON.stringify(rows))));
  writeFileSync(
    MARKET_META,
    JSON.stringify(
      {
        count: rows.length,
        source: "ha-price-download+merge",
        effective: "lista_ar",
        updated_at: new Date().toISOString(),
      },
      null,
      2
    )
  );
  log(`Market dump: ${rows.length} sor → ${MARKET_GZ}`);
}

async function scrapeBrand(page, rule, { maxPages, delayMs, seen, progress, resume }) {
  const brand = rule.gyartmany;
  const prev = progress.brands?.[brand] || {};
  if (resume && prev.done) {
    log(`${brand}: már kész (resume skip)`);
    return { brand, totalNew: 0, maxPage: prev.maxPage || 1, skipped: true };
  }

  let startPage = resume && prev.nextPage > 1 ? Number(prev.nextPage) : 1;
  if (!Number.isFinite(startPage) || startPage < 1) startPage = 1;

  const slugCandidates = brandSlugCandidates(brand);
  let activeSlug = prev.slug || slugCandidates[0];
  let totalNew = 0;
  let lastMaxPage = Number(prev.maxPage) || 1;
  let pagesThisRun = 0;
  const pageBudget = maxPages > 0 ? maxPages : Infinity;

  for (let p = startPage; pagesThisRun < pageBudget; p++) {
    let data = null;
    let usedSlug = activeSlug;
    try {
      for (const slug of p === startPage && !prev.slug ? slugCandidates : [activeSlug]) {
        const url = brandListUrl(brand, p, slug);
        log(`${brand} lista p${p}: ${url}`);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
        await sleep(1200);
        for (let i = 0; i < 40; i++) {
          let cf = false;
          try {
            cf = await page.evaluate(() => /pillanat|just a moment|cloudflare/i.test(document.title));
          } catch {
            cf = true;
          }
          if (!cf) break;
          if (i % 5 === 0) log(`CF… (${i}s) ${brand} p${p}`);
          await sleep(1000);
        }
        data = await scrapeListPage(page);
        usedSlug = slug;
        if (data.items.length || data.cardCount > 0) {
          activeSlug = slug;
          break;
        }
        if (p === startPage && slug !== slugCandidates[slugCandidates.length - 1]) {
          log(`${brand}: 0 kártya slug=${slug}, próbálom a következőt…`);
        }
      }
    } catch (err) {
      log(`${brand} p${p} HIBA: ${err?.message || err} — kihagyom / folytatom`);
      saveBrandProgress(progress, brand, {
        nextPage: p + 1,
        maxPage: lastMaxPage,
        done: false,
        slug: usedSlug,
        lastError: String(err?.message || err).slice(0, 200),
      });
      // Ha a page meghalt, dobjuk feljebb → main újracsatlakozik
      if (/Target closed|Session closed|Connection closed|Browser closed|ECONNREFUSED/i.test(String(err?.message || err))) {
        throw err;
      }
      pagesThisRun += 1;
      await sleep(delayMs + 1500);
      continue;
    }

    lastMaxPage = Math.max(lastMaxPage, data?.maxPage || 1);
    const fresh = [];
    for (const item of data?.items || []) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      const row = {
        id: item.id,
        gyartmany: brand,
        title: item.title,
        year: item.year,
        km: item.km,
        price: item.price,
        fuel: item.fuel || "",
        power: item.power || "",
        gear: item.gear || "",
        url: item.url,
        level: "alap",
        scraped_at: new Date().toISOString(),
      };
      if (rule.reszletes === "ev" && rule.reszletesFromYear && item.year != null) {
        row.reszletes_candidate = item.year >= rule.reszletesFromYear;
      } else if (rule.reszletes === "igen") {
        row.reszletes_candidate = true;
      } else {
        row.reszletes_candidate = false;
      }
      fresh.push(row);
    }
    appendRows(fresh);
    totalNew += fresh.length;
    pagesThisRun += 1;
    const nextPage = p + 1;
    const empty = !(data?.items?.length);
    const done = empty || p >= lastMaxPage;
    saveBrandProgress(progress, brand, {
      nextPage: done ? p : nextPage,
      maxPage: lastMaxPage,
      done,
      slug: usedSlug,
      lastNew: fresh.length,
      totalNewRun: totalNew,
    });
    log(
      `${brand} p${p}: ${data?.items?.length || 0} kártya, +${fresh.length} új (maxPage~${lastMaxPage})${done ? " · KÉSZ" : ""}`
    );

    if (done) break;
    await sleep(delayMs);
  }

  return { brand, totalNew, maxPage: lastMaxPage, skipped: false };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  mkdirSync(ROOT, { recursive: true });

  const { path, rules } = loadHaPriceRules(opts.path || undefined);
  const sum = summarizeHaPriceRules(rules);
  log(`Szabályfájl: ${path}`);
  log(`letöltendő: ${sum.download} / ${sum.total}`);

  let ready = sum.ready;
  if (opts.brand) {
    const needle = opts.brand.trim().toUpperCase();
    ready = ready.filter((r) => r.gyartmany.toUpperCase() === needle);
    if (!ready.length) {
      // allow brand even if not in ready? still from rules
      const hit = rules.find((r) => r.gyartmany.toUpperCase() === needle);
      if (hit) ready = [hit];
    }
  }
  if (opts.maxBrands > 0) ready = ready.slice(0, opts.maxBrands);

  if (opts.planOnly) {
    for (const r of ready.slice(0, 40)) {
      const res =
        r.reszletes === "ev"
          ? `ev:${r.reszletesFromYear}`
          : r.reszletes === "nem"
            ? "nem"
            : String(r.reszletes || "?");
      console.log(`  ${r.gyartmany} · alap · reszletes:${res}`);
    }
    if (ready.length > 40) console.log(`  … +${ready.length - 40}`);
    return;
  }

  if (opts.writeMarketOnly) {
    log("Csak market dump (rows.jsonl → prices.json.gz), scrape nélkül.");
    rebuildMarketGz({ merge: true });
    log(`Adatok: ${ROWS_FILE}`);
    return;
  }

  if (!ready.length) {
    log("Nincs letöltendő márka (szűrés után).");
    return;
  }

  log(`Márkák most: ${ready.map((r) => r.gyartmany).join(", ")}`);
  log(`maxPages=${opts.maxPages || "∞"}, resume=${opts.resume}, writeMarket=${opts.writeMarket}`);

  let port = await ensureChrome();
  let { browser, context } = await connect(port);
  let page = context.pages().find((p) => p.url().includes("hasznaltauto.hu")) || context.pages()[0];
  if (!page) page = await context.newPage();
  await page.bringToFront();
  await ensureWww(page);

  const seen = loadExistingIds();
  const progress = opts.resume ? loadProgress() : { brands: {} };
  if (opts.resume && seen.size && !progress.brands?.BMW) {
    progress.brands = progress.brands || {};
    progress.brands.BMW = { nextPage: 3, maxPage: 334, done: false, seeded: true };
    writeProgress({ brands: progress.brands, note: "seed BMW from first trial" });
    log("Resume seed: BMW nextPage=3");
  }
  log(`Meglévő sorok (id): ${seen.size}`);

  async function reconnect() {
    log("CDP újracsatlakozás…");
    port = await ensureChrome();
    ({ browser, context } = await connect(port));
    page = context.pages().find((p) => p.url().includes("hasznaltauto.hu")) || context.pages()[0];
    if (!page) page = await context.newPage();
    await page.bringToFront();
    await ensureWww(page);
  }

  let grand = 0;
  for (const rule of ready) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await scrapeBrand(page, rule, {
          maxPages: opts.maxPages,
          delayMs: opts.delayMs,
          seen,
          progress,
          resume: opts.resume,
        });
        grand += res.totalNew;
        break;
      } catch (err) {
        log(`${rule.gyartmany} attempt ${attempt}/3 fail: ${err?.message || err}`);
        if (attempt === 3) throw err;
        await sleep(2000);
        await reconnect();
      }
    }
  }

  log(`Kész. Új sorok ebben a futásban: ${grand}`);
  if (opts.writeMarket) rebuildMarketGz();
  else log("Market dump nem íródott (--write-market ha kell).");
  log(`Adatok: ${ROWS_FILE}`);
}

process.on("uncaughtException", (err) => {
  try {
    appendFileSync(LOG_FILE, `[${new Date().toISOString()}] uncaughtException: ${err?.stack || err}\n`);
  } catch {
    /* ignore */
  }
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  try {
    appendFileSync(LOG_FILE, `[${new Date().toISOString()}] unhandledRejection: ${err?.stack || err}\n`);
  } catch {
    /* ignore */
  }
  process.exit(1);
});

main().catch((err) => {
  console.error(err);
  try {
    appendFileSync(LOG_FILE, `[${new Date().toISOString()}] fatal: ${err?.stack || err}\n`);
  } catch {
    /* ignore */
  }
  process.exit(1);
});
