#!/usr/bin/env node
/**
 * Használtautó ár-letöltés (szelektív).
 *
 * Szabályok: docs/ha-ar-letoltes-gyartmanyok.txt
 *   - alap: lista oldal (cím, év, km, ár)
 *   - reszletes:ev:YYYY → gyártási év >= YYYY detail oldal
 *
 * Használat:
 *   1) npm run ha:price-download -- --brand BMW --max-pages 2
 *   2) npm run ha:price-write-market  → rows.jsonl → értékbecslő dump
 *   3) npm run ha:price-reszletes -- --delay 1200
 *      (opció: --brand BMW --max 100 — részletes detail scrape a jelöltekre)
 *
 * Chrome: a script indítja a debug Chrome-ot (CDP 9222), ha nincs.
 * Cloudflare: ha „Egy pillanat…”, fogadd el a Chrome ablakban.
 *
 * Kimenet:
 *   data/ha-prices/rows.jsonl
 *   data/ha-prices/progress.json
 *   data/ha-prices/progress-reszletes.json
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
const PROGRESS_RESZLETES_FILE = join(ROOT, "progress-reszletes.json");
const LOG_FILE = join(ROOT, "scrape.log");
const MARKET_GZ = resolve("lib/ha-market/prices.json.gz");
const MARKET_META = resolve("lib/ha-market/meta.json");
const RESZLETES_FLUSH_EVERY = 25;
const RESZLETES_FIELD_KEYS = [
  ["uzemanyag", ["üzemanyag", "uzemanyag"]],
  ["teljesitmeny", ["teljesítmény", "teljesitmeny"]],
  ["sebessegvalto", ["sebességváltó", "sebessegvalto", "váltó"]],
  ["hajtas", ["hajtás", "hajtas"]],
  ["kivitel", ["kivitel"]],
  ["szin", ["szín", "szin"]],
  ["allapot", ["állapot", "allapot"]],
  ["hengerurtartalom", ["hengerűrtartalom", "hengerurtartalom", "cm³", "cm3"]],
  ["ajtok", ["ajtók", "ajtok", "ajtószám"]],
  ["klima", ["klíma", "klima"]],
  ["okmany", ["okmány", "okmany"]],
  ["tomeg", ["saját tömeg", "sajat tomeg", "tömeg"]],
];

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
    max: Number(process.env.MAX || 0) || 0,
    writeMarket: process.env.WRITE_MARKET === "1",
    writeMarketOnly: process.env.WRITE_MARKET_ONLY === "1",
    reszletes: process.env.RESZLETES === "1",
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
    else if (a === "--max" && argv[i + 1]) out.max = Number(argv[++i]) || 0;
    else if (a === "--write-market") out.writeMarket = true;
    else if (a === "--write-market-only") {
      out.writeMarketOnly = true;
      out.writeMarket = true;
    } else if (a === "--reszletes") out.reszletes = true;
    else if (a === "--plan") out.planOnly = true;
    else if (a === "--no-resume") out.resume = false;
    else if (a === "--resume") out.resume = true;
    else if (a === "--delay" && argv[i + 1]) out.delayMs = Number(argv[++i]) || 800;
  }
  if (!Number.isFinite(out.maxPages) || out.maxPages < 0) out.maxPages = 0;
  if (!Number.isFinite(out.max) || out.max < 0) out.max = 0;
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

function foldLabel(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickFromMap(map, aliases) {
  if (!map || typeof map !== "object") return "";
  const entries = Object.entries(map);
  /* 1) pontos egyezés */
  for (const alias of aliases) {
    const want = foldLabel(alias);
    for (const [k, v] of entries) {
      if (foldLabel(k) === want && v) return String(v).trim();
    }
  }
  /* 2) részleges — de ne keverjük az üzemanyagtankot az üzemanyaggal */
  for (const alias of aliases) {
    const want = foldLabel(alias);
    for (const [k, v] of entries) {
      const fk = foldLabel(k);
      if (!v || !fk.includes(want)) continue;
      if (want === "uzemanyag" && /tank|fogyaszt/.test(fk)) continue;
      if (want === "tomeg" && /vontat|terheles|terhelés/.test(fk)) continue;
      return String(v).trim();
    }
  }
  return "";
}

function loadRowsById() {
  const byId = new Map();
  const order = [];
  if (!existsSync(ROWS_FILE)) return { byId, order };
  for (const line of readFileSync(ROWS_FILE, "utf8").split(/\n/)) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (!row?.id) continue;
      const id = String(row.id);
      byId.set(id, row);
      order.push(id);
    } catch {
      /* ignore */
    }
  }
  return { byId, order };
}

function writeAllRows(byId, order) {
  const lines = [];
  for (const id of order) {
    const row = byId.get(id);
    if (row) lines.push(JSON.stringify(row));
  }
  writeFileSync(ROWS_FILE, lines.length ? `${lines.join("\n")}\n` : "");
}

function loadReszletesProgress() {
  if (!existsSync(PROGRESS_RESZLETES_FILE)) {
    return { done: {}, errors: {}, ok: 0, fail: 0, skipped: 0 };
  }
  try {
    const raw = JSON.parse(readFileSync(PROGRESS_RESZLETES_FILE, "utf8"));
    return {
      done: raw.done && typeof raw.done === "object" ? raw.done : {},
      errors: raw.errors && typeof raw.errors === "object" ? raw.errors : {},
      ok: Number(raw.ok) || 0,
      fail: Number(raw.fail) || 0,
      skipped: Number(raw.skipped) || 0,
    };
  } catch {
    return { done: {}, errors: {}, ok: 0, fail: 0, skipped: 0 };
  }
}

function saveReszletesProgress(prog, extra = {}) {
  writeFileSync(
    PROGRESS_RESZLETES_FILE,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        ok: prog.ok,
        fail: prog.fail,
        skipped: prog.skipped,
        doneCount: Object.keys(prog.done).length,
        done: prog.done,
        errors: prog.errors,
        ...extra,
      },
      null,
      2
    )
  );
}

function listReszletesCandidates(byId, order, { brand = "", resume = true, prog = null } = {}) {
  const needle = brand ? brand.trim().toUpperCase() : "";
  const out = [];
  for (const id of order) {
    const row = byId.get(id);
    if (!row?.reszletes_candidate) continue;
    if (row.level === "reszletes" && row.detail) {
      if (resume && prog) prog.done[id] = true;
      continue;
    }
    if (resume && prog?.done?.[id]) continue;
    if (needle && String(row.gyartmany || "").toUpperCase() !== needle) continue;
    if (!row.url) continue;
    out.push(id);
  }
  return out;
}

async function waitListingOrCf(page, label, timeoutSec = 45) {
  for (let i = 0; i < timeoutSec; i++) {
    let st = null;
    try {
      st = await page.evaluate(() => {
        const title = document.title || "";
        const cf = /pillanat|just a moment|attention required|cloudflare/i.test(title);
        const h1 = document.querySelector("h1")?.innerText?.trim() || "";
        const hasData =
          !!document.querySelector(
            "table.table-primary, table.hirdetesadatok, .print-basic-info-item__label, td.bal.pontos"
          ) ||
          /Évjárat|Km\.\s*óra|Üzemanyag/i.test(document.body?.innerText || "");
        return { title, cf, h1, hasData, href: location.href };
      });
    } catch {
      await sleep(1000);
      continue;
    }
    if (st.cf) {
      if (i % 5 === 0) log(`CF… (${i}s) ${label}`);
      await sleep(1000);
      continue;
    }
    if (st.hasData && st.h1 && st.h1.length > 3) return st;
    await sleep(1000);
  }
  return null;
}

async function scrapeDetailPage(page) {
  return page.evaluate(() => {
    const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
    const map = {};
    const knownLabel =
      /^(Évjárat|Km\.\s*óra\s*állás|Üzemanyag|Teljesítmény|Állapot|Kivitel|Szín|Ajtók száma|Sebességváltó|Hajtás|Klíma|Okmányok jellege|Hengerűrtartalom|Saját tömeg|Csomagtartó|Vételár|Szállítható szem\.\s*szám)$/i;
    const addPair = (rawKey, rawValue, { preferShorter = false } = {}) => {
      let key = clean(rawKey).replace(/:$/, "");
      let value = clean(rawValue);
      if (!key || !value || key.length > 60) return;
      /* Összefűzött multi-field érték → első „mező” */
      if ((value.match(/\b(Évjárat|Km\.|Üzemanyag|Teljesítmény|Állapot|Kivitel)\b/g) || []).length >= 2) {
        value = value.split(/\s{2,}|\n/)[0] || value;
        value = clean(value);
      }
      if (!value || value.length > 180) return;
      if (/^(ár|ar|költségek|altalanos adatok|muszaki adatok|alapadatok)$/i.test(key)) return;
      if (!map[key]) map[key] = value;
      else if (preferShorter && value.length < map[key].length) map[key] = value;
      else if (!preferShorter && value.length > map[key].length && value.length < 120) map[key] = value;
    };

    /* 1) Táblázatok — legtisztább párok */
    for (const table of document.querySelectorAll("table")) {
      for (const row of table.querySelectorAll("tr")) {
        const cells = [...row.querySelectorAll("td, th")];
        if (cells.length < 2) continue;
        addPair(cells[0].innerText, cells[cells.length - 1].innerText, { preferShorter: true });
      }
    }

    /* 2) print-basic-info label + szomszédos col */
    for (const label of document.querySelectorAll(".print-basic-info-item__label")) {
      const row = label.closest(".row, .print-basic-info-item, [class*='basic-info']") || label.parentElement;
      let valueEl = row?.querySelector(".print-basic-info-item__value");
      if (!valueEl && row) {
        const cols = [...row.children].filter((el) => el !== label);
        valueEl = cols.find((el) => !el.classList?.contains?.("print-basic-info-item__label")) || label.nextElementSibling;
      }
      if (valueEl && valueEl !== label) {
        addPair(label.innerText, valueEl.innerText, { preferShorter: true });
      }
    }

    /* 3) Egymás utáni sorok a body szövegben (Évjárat / érték) */
    const lines = String(document.body?.innerText || "")
      .split(/\n/)
      .map((l) => clean(l))
      .filter(Boolean);
    for (let i = 0; i < lines.length - 1; i++) {
      if (knownLabel.test(lines[i]) && !knownLabel.test(lines[i + 1])) {
        addPair(lines[i], lines[i + 1], { preferShorter: true });
      }
    }

    for (const dl of document.querySelectorAll("dl")) {
      for (const dt of dl.querySelectorAll("dt")) {
        const dd = dt.nextElementSibling;
        if (dd?.tagName === "DD") addPair(dt.innerText, dd.innerText, { preferShorter: true });
      }
    }

    const felszereltseg = [];
    for (const selector of [
      ".hirdetes-felszereltseg li",
      ".felszereltseg-list li",
      "[class*='felszer'] li",
      "[class*='extra'] li",
      ".extranev",
      ".feature-badge",
      "[class*='equipment'] li",
      "[class*='Equipment'] li",
    ]) {
      for (const node of document.querySelectorAll(selector)) {
        const text = clean(node.innerText);
        if (text && text.length <= 60 && !felszereltseg.includes(text)) felszereltseg.push(text);
      }
    }
    for (const section of document.querySelectorAll("[class*='felszer'], [class*='extra'], section, [class*='Equipment']")) {
      const heading = clean(section.querySelector("h2, h3, h4, strong")?.innerText ?? "");
      if (!/felszer|extra|beltér|műszaki|kültér|multimédia|equipment/i.test(heading)) continue;
      for (const item of section.querySelectorAll("li, span, label")) {
        const text = clean(item.innerText);
        if (text.length > 2 && text.length <= 60 && !felszereltseg.includes(text)) {
          felszereltseg.push(text);
        }
      }
    }

    const title = clean(document.querySelector("h1")?.innerText ?? "");
    let priceText =
      document.querySelector(".price__main, .hirdetesara, [class*='price']")?.textContent || "";
    if (!/Ft/i.test(priceText)) {
      const m = (document.body.innerText || "").match(/([\d\s.]{4,})\s*Ft/);
      if (m) priceText = m[0];
    }
    return {
      map,
      felszereltseg: felszereltseg.slice(0, 120),
      title,
      priceText,
      href: location.href,
    };
  });
}

function slimDetailMap(map) {
  const keep = {};
  if (!map) return keep;
  const important =
    /uzemanyag|teljesitmeny|sebesseg|valto|hajtas|kivitel|szin|allapot|henger|ajto|klima|okmany|tomeg|evjarat|km|futas|valto|szallithato|csomagtarto|sajat|motor/i;
  for (const [k, v] of Object.entries(map)) {
    if (important.test(foldLabel(k)) && v) keep[k] = String(v).slice(0, 200);
  }
  return keep;
}

function applyDetailToRow(row, scraped) {
  const detail = {};
  for (const [field, aliases] of RESZLETES_FIELD_KEYS) {
    const v = pickFromMap(scraped.map, aliases);
    if (v) detail[field] = v;
  }
  if (scraped.felszereltseg?.length) detail.felszereltseg = scraped.felszereltseg;
  detail.map = slimDetailMap(scraped.map);

  const next = {
    ...row,
    level: "reszletes",
    detail,
    reszletes_at: new Date().toISOString(),
  };
  if (scraped.title && scraped.title.length > 5) next.title = scraped.title.split("\n")[0].trim();
  if (detail.uzemanyag) next.fuel = detail.uzemanyag;
  if (detail.teljesitmeny) next.power = detail.teljesitmeny;
  if (detail.sebessegvalto) next.gear = detail.sebessegvalto;
  const year = parseYear(pickFromMap(scraped.map, ["évjárat", "gyártási év", "gyartasi ev"]) || "");
  if (year) next.year = year;
  const kmRaw =
    pickFromMap(scraped.map, ["km. óra állás", "km ora allas", "futásteljesítmény", "futasteljesitmeny"]) ||
    "";
  const km = parseKm(kmRaw.includes("km") ? kmRaw : `${kmRaw} km`);
  if (km != null) next.km = km;
  const price = parseFt(scraped.priceText || pickFromMap(scraped.map, ["vételár", "vetelar"]) || "");
  if (price) next.price = price;
  return next;
}

async function runReszletes(page, opts, reconnect) {
  const { byId, order } = loadRowsById();
  const prog = opts.resume ? loadReszletesProgress() : { done: {}, errors: {}, ok: 0, fail: 0, skipped: 0 };
  const queue = listReszletesCandidates(byId, order, {
    brand: opts.brand,
    resume: opts.resume,
    prog,
  });
  const budget = opts.max > 0 ? opts.max : queue.length;
  log(
    `Részletes: jelöltek hátra ${queue.length}, most max ${budget || "∞"}, resume=${opts.resume}, delay=${opts.delayMs}ms`
  );
  if (!queue.length) {
    log("Nincs hátralévő részletes jelölt.");
    saveReszletesProgress(prog, { current: null, doneAll: true });
    return { ok: 0, fail: 0 };
  }

  let ok = 0;
  let fail = 0;
  let dirty = 0;
  const flush = () => {
    if (!dirty) return;
    writeAllRows(byId, order);
    saveReszletesProgress(prog, { current: null });
    dirty = 0;
  };

  for (let i = 0; i < queue.length && ok + fail < budget; i++) {
    const id = queue[i];
    const row = byId.get(id);
    if (!row?.url) {
      prog.skipped += 1;
      prog.done[id] = true;
      continue;
    }
    const url = row.url.startsWith("http") ? row.url : `${WWW}${row.url}`;
    const label = `${row.gyartmany || "?"} #${id}`;
    try {
      log(`Részletes ${i + 1}/${queue.length}: ${label}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
      const ready = await waitListingOrCf(page, label, 50);
      if (!ready) throw new Error("CF/timeout detail");
      const scraped = await scrapeDetailPage(page);
      const mapCount = Object.keys(scraped.map || {}).length;
      if (mapCount < 3 && !(scraped.felszereltseg || []).length) {
        throw new Error(`üres detail (map=${mapCount})`);
      }
      const upgraded = applyDetailToRow(row, scraped);
      byId.set(id, upgraded);
      prog.done[id] = true;
      delete prog.errors[id];
      prog.ok += 1;
      ok += 1;
      dirty += 1;
      if (ok % 10 === 0 || i === 0) {
        log(
          `Részletes OK #${id} · map=${mapCount} · felsz=${(scraped.felszereltseg || []).length} · futás +${ok}`
        );
      }
      if (dirty >= RESZLETES_FLUSH_EVERY) flush();
    } catch (err) {
      fail += 1;
      prog.fail += 1;
      prog.errors[id] = String(err?.message || err).slice(0, 220);
      log(`Részletes FAIL ${label}: ${err?.message || err}`);
      if (/Target closed|Session closed|Connection closed|Browser closed|ECONNREFUSED/i.test(String(err?.message || err))) {
        flush();
        await reconnect();
      }
    }
    saveReszletesProgress(prog, { current: id, queueLeft: queue.length - i - 1 });
    await sleep(opts.delayMs);
  }
  flush();
  log(`Részletes kész ebben a futásban: ok=${ok}, fail=${fail}, összes done=${Object.keys(prog.done).length}`);
  return { ok, fail };
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

  let port = await ensureChrome();
  let { browser, context } = await connect(port);
  let page = context.pages().find((p) => p.url().includes("hasznaltauto.hu")) || context.pages()[0];
  if (!page) page = await context.newPage();
  await page.bringToFront();
  await ensureWww(page);

  async function reconnect() {
    log("CDP újracsatlakozás…");
    port = await ensureChrome();
    ({ browser, context } = await connect(port));
    page = context.pages().find((p) => p.url().includes("hasznaltauto.hu")) || context.pages()[0];
    if (!page) page = await context.newPage();
    await page.bringToFront();
    await ensureWww(page);
  }

  if (opts.reszletes) {
    log(`Részletes mód · brand=${opts.brand || "összes"} · max=${opts.max || "∞"}`);
    try {
      await runReszletes(page, opts, reconnect);
      if (opts.writeMarket) rebuildMarketGz();
      log(`Adatok: ${ROWS_FILE}`);
    } finally {
      try {
        await browser.close();
      } catch {
        /* CDP shared Chrome — close lehet no-op */
      }
      process.exit(0);
    }
    return;
  }

  if (!ready.length) {
    log("Nincs letöltendő márka (szűrés után).");
    return;
  }

  log(`Márkák most: ${ready.map((r) => r.gyartmany).join(", ")}`);
  log(`maxPages=${opts.maxPages || "∞"}, resume=${opts.resume}, writeMarket=${opts.writeMarket}`);

  const seen = loadExistingIds();
  const progress = opts.resume ? loadProgress() : { brands: {} };
  if (opts.resume && seen.size && !progress.brands?.BMW) {
    progress.brands = progress.brands || {};
    progress.brands.BMW = { nextPage: 3, maxPage: 334, done: false, seeded: true };
    writeProgress({ brands: progress.brands, note: "seed BMW from first trial" });
    log("Resume seed: BMW nextPage=3");
  }
  log(`Meglévő sorok (id): ${seen.size}`);

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
