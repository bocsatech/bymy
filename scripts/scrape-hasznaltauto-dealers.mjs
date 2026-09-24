/**
 * Használtautó.hu kereskedések → Excel
 * Verzió: Chrome CDP (te nyitod a böngészőt, a script csatlakozik)
 *
 * 1) Indítsd a Chrome-ot debug módban:
 *      mac/chrome-debug-hasznaltauto.command
 *
 * 2) A megnyíló Chrome-ban nyisd meg:
 *      https://www.hasznaltauto.hu/kereskedesek
 *    Várd meg, amíg betölt (nem „Egy pillanat…”).
 *
 * 3) Futtasd:
 *      npm run scrape:ha-dealers
 *      LIMIT=20 npm run scrape:ha-dealers
 *      REFRESH_URLS=1 npm run scrape:ha-dealers
 *      REFRESH_FIELDS=1 npm run scrape:ha-dealers   # hiányzó találat/nyitvatartás pótlása
 *      RESCRAPE=1 npm run scrape:ha-dealers         # teljes újra
 *
 * Kimenet: data/hasznaltauto-kereskedesek/hasznaltauto-kereskedesek.xlsx
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import ExcelJS from "exceljs";

const ROOT = path.resolve("data/hasznaltauto-kereskedesek");
const URLS_FILE = path.join(ROOT, "urls.json");
const RESULTS_FILE = path.join(ROOT, "results.jsonl");
const XLSX_FILE = path.join(ROOT, "hasznaltauto-kereskedesek.xlsx");
const PROGRESS_FILE = path.join(ROOT, "progress.json");
const LOG_FILE = path.join(ROOT, "scrape.log");

const CDP_URL = process.env.CDP_URL || "http://127.0.0.1:9222";
const LIMIT = Number(process.env.LIMIT || 0) || Infinity;
const BATCH = Math.max(1, Number(process.env.BATCH || 15));
const RESCRAPE = process.env.RESCRAPE === "1";
const REFRESH_FIELDS = process.env.REFRESH_FIELDS === "1" || RESCRAPE;
const BASE = "https://www.hasznaltauto.hu";

const INDEX_PATHS = [
  "/kereskedesek",
  ...[..."bcdefghijklmnopqrstuvwxyz"].map((l) => `/kereskedesek/${l}`),
  "/kereskedesek/egyeb",
  "/kereskedesek/kulfoldi",
];

fs.mkdirSync(ROOT, { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, `${line}\n`);
}

function writeProgress(extra = {}) {
  fs.writeFileSync(
    PROGRESS_FILE,
    JSON.stringify({ at: new Date().toISOString(), ...extra }, null, 2)
  );
}

function writeResultsJsonl(rows) {
  const list = [...rows];
  const body = list.map((r) => JSON.stringify(r)).join("\n") + (list.length ? "\n" : "");
  fs.writeFileSync(RESULTS_FILE, body);
}

function needsFieldRefresh(row) {
  if (!row || row.error) return true;
  const hasCount = row.talalat_db != null && String(row.talalat_db).trim() !== "";
  const hasHours = Boolean(String(row.nyitvatartas || "").trim());
  return !hasCount || !hasHours;
}

async function connectChrome() {
  try {
    const browser = await chromium.connectOverCDP(CDP_URL);
    const context = browser.contexts()[0];
    if (!context) {
      throw new Error("Nincs Chrome kontextus. Indítsd a debug Chrome-ot, nyiss egy lapot.");
    }
    return { browser, context };
  } catch (err) {
    throw new Error(
      `Nem sikerült csatlakozni a Chrome-hoz (${CDP_URL}).\n` +
        `Indítsd: mac/chrome-debug-hasznaltauto.command\n` +
        `Majd nyisd meg: ${BASE}/kereskedesek\n` +
        `Hiba: ${err.message}`
    );
  }
}

async function ensureHaPage(context) {
  let page = context.pages().find((p) => p.url().includes("hasznaltauto.hu"));
  if (!page) page = context.pages()[0] || (await context.newPage());

  if (!page.url().includes("hasznaltauto.hu/kereskedesek") && !page.url().includes("/partner/")) {
    log(`Navigálás: ${BASE}/kereskedesek`);
    await page.goto(`${BASE}/kereskedesek`, { waitUntil: "domcontentloaded", timeout: 90000 });
  }

  for (let i = 0; i < 60; i++) {
    const title = await page.title();
    const ok = await page.evaluate(() => {
      const partners = document.querySelectorAll('a[href*="/partner/"]').length;
      return { partners, title: document.title };
    });
    if (!/pillanat/i.test(ok.title) && ok.partners > 5) {
      log(`Oldal kész: „${ok.title}”, ${ok.partners} partner link a DOM-ban`);
      return page;
    }
    if (i === 0 || i % 5 === 0) {
      log(`Várakozás botvédelemre / betöltésre… (${i}s) cím: ${title}`);
    }
    await sleep(1000);
  }
  throw new Error(
    "A hasznaltauto oldal nem töltött be rendesen. Nyisd meg kézzel a Chrome-ban a kereskedéslistát, majd futtasd újra."
  );
}

async function collectPartnerUrls(page) {
  if (fs.existsSync(URLS_FILE) && !process.env.REFRESH_URLS) {
    const cached = JSON.parse(fs.readFileSync(URLS_FILE, "utf8"));
    if (Array.isArray(cached) && cached.length > 0) {
      log(`URL lista cache: ${cached.length} db`);
      return cached;
    }
  }

  log("Partner URL-ek gyűjtése (betűnként)…");
  const result = await page.evaluate(async (paths) => {
    const urls = new Set();
    const per = {};
    for (const p of paths) {
      const t = await fetch(p, { credentials: "include" }).then((r) => r.text());
      const found = [...t.matchAll(/href="(\/partner\/[^"]+-\d+)"/g)].map(
        (m) => `https://www.hasznaltauto.hu${m[1]}`
      );
      for (const u of found) urls.add(u);
      per[p] = new Set(found).size;
    }
    return { total: urls.size, per, urls: [...urls].sort() };
  }, INDEX_PATHS);

  for (const [p, n] of Object.entries(result.per)) {
    log(`  ${p}: ${n}`);
  }
  fs.writeFileSync(URLS_FILE, JSON.stringify(result.urls, null, 2));
  log(`Mentve: ${result.total} partner URL → ${URLS_FILE}`);
  return result.urls;
}

function loadDone() {
  const done = new Map();
  if (!fs.existsSync(RESULTS_FILE)) return done;
  for (const line of fs.readFileSync(RESULTS_FILE, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row?.url && !row.error) done.set(row.url, row);
    } catch {
      /* skip */
    }
  }
  return done;
}

async function scrapeBatch(page, urls) {
  return page.evaluate(async (batchUrls) => {
    const DAYS = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"];

    const parseDealer = (html, pageUrl) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
      const bodyText = text(doc.body);

      const companyFromH2 = [...doc.querySelectorAll("h2")]
        .map((h) => text(h))
        .find(
          (t) =>
            t &&
            !/Bejelentkezés|Zárva|Akikhez|Ellenőrzés|Földrajzi|Nyitás|találat/i.test(t) &&
            t.length < 120
        );
      const h1 = text(doc.querySelector("h1"));
      const cegnev =
        companyFromH2 || (h1 ? h1.replace(/\s*hirdetései\s*$/i, "").trim() : "") || "";

      const addressEl =
        doc.querySelector('a[href*="google.com/maps"]') ||
        [...doc.querySelectorAll("a")].find((a) =>
          /út|utca|tér|körút|köz|sor|telep|Budapest|ker\./i.test(a.textContent || "")
        );

      const webEl = [...doc.querySelectorAll("a")].find((a) => {
        const t = text(a);
        const href = a.href || "";
        return (
          t &&
          t.length < 80 &&
          /\.[a-z]{2,}/i.test(t) &&
          !/hasznaltauto|money\.hu|autoalkatresz|autokatalogus|google\.com|facebook|instagram|mailto:|tel:/i.test(
            href
          )
        );
      });

      const peopleH = [...doc.querySelectorAll("h2, h3")].find((h) =>
        /Akikhez fordulhat/i.test(h.textContent || "")
      );
      let people = [];
      if (peopleH) {
        const root = peopleH.parentElement || peopleH;
        people = [...root.querySelectorAll("li, p, span, div")]
          .map((n) => text(n))
          .filter(
            (t) =>
              t &&
              t.length >= 5 &&
              t.length <= 50 &&
              /^[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+(?:\s+[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű.-]+)+$/.test(
                t
              ) &&
              !/Akikhez|partner|felfed|telefon|mail|Nyitás|Zárva|találat/i.test(t)
          );
        people = [...new Set(people)];
      }

      const contactByTestId = (sel) => {
        const vals = [...doc.querySelectorAll(sel)]
          .map((e) => e.getAttribute("data-contact-value"))
          .filter(Boolean);
        return vals[0] || "";
      };

      let email = contactByTestId('[data-testid="seller-email"]');
      let elso_tel = contactByTestId('[data-testid="seller-phone-number-primary"]');
      let masod_tel = contactByTestId('[data-testid="seller-phone-number-secondary"]');

      if (!email) {
        const mailto = doc.querySelector('a[href^="mailto:"]');
        if (mailto) {
          email = (mailto.getAttribute("href") || "").replace(/^mailto:/i, "").split("?")[0].trim();
        }
      }
      if (!email) {
        const m = bodyText.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
        if (m && !/hasznaltauto|example\.com/i.test(m[0])) email = m[0];
      }

      const telFromHref = [...doc.querySelectorAll('a[href^="tel:"]')]
        .map((a) => (a.getAttribute("href") || "").replace(/^tel:/i, "").trim())
        .filter(Boolean);
      if (!elso_tel && telFromHref[0]) elso_tel = telFromHref[0];
      if (!masod_tel && telFromHref[1]) masod_tel = telFromHref[1];

      if (!elso_tel || !masod_tel) {
        const extras = [...doc.querySelectorAll("[data-contact-value]")]
          .map((e) => ({
            id: e.getAttribute("data-testid") || "",
            val: e.getAttribute("data-contact-value") || "",
          }))
          .filter((x) => x.val && /phone|tel/i.test(x.id + x.val));
        for (const x of extras) {
          if (!elso_tel) elso_tel = x.val;
          else if (!masod_tel && x.val !== elso_tel) masod_tel = x.val;
        }
      }

      let talalat_db = "";
      const countMatch =
        bodyText.match(/(\d+)\s*db\s*találat/i) ||
        bodyText.match(/(\d+)\s*találat/i) ||
        html.match(/"(?:adCount|listingCount|resultCount|adsCount)"\s*:\s*(\d+)/i);
      if (countMatch) talalat_db = String(Number(countMatch[1]));

      const hours = [];
      for (const day of DAYS) {
        const re = new RegExp(
          `${day}\\s*[:|]\\s*(Zárva|\\d{1,2}:\\d{2}\\s*[-–—]\\s*\\d{1,2}:\\d{2})`,
          "i"
        );
        const m = bodyText.match(re);
        if (m) {
          hours.push(`${day}: ${m[1].replace(/\s+/g, " ").replace(/[–—]/g, "-")}`);
        }
      }
      if (!hours.length) {
        for (const day of DAYS) {
          const re = new RegExp(
            `${day}[^\\dZárva]{0,12}(Zárva|\\d{1,2}:\\d{2}\\s*[-–—]\\s*\\d{1,2}:\\d{2})`,
            "i"
          );
          const m = bodyText.match(re);
          if (m) hours.push(`${day}: ${m[1].replace(/\s+/g, " ").replace(/[–—]/g, "-")}`);
        }
      }
      const nyitvatartas = hours.join(" | ");

      return {
        url: pageUrl,
        cegnev,
        cim: text(addressEl),
        web: text(webEl) || webEl?.getAttribute("href") || "",
        talalat_db,
        nyitvatartas,
        akikhez_fordulhat: people.join("; "),
        email,
        elso_tel,
        masod_tel,
        scrapedAt: new Date().toISOString(),
      };
    };

    const out = [];
    for (const url of batchUrls) {
      try {
        const path = url.replace("https://www.hasznaltauto.hu", "");
        const html = await fetch(path, { credentials: "include" }).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        });
        if (/Egy pillanat/i.test(html) && html.length < 40000) {
          out.push({ url, error: "bot_challenge", scrapedAt: new Date().toISOString() });
          continue;
        }
        out.push(parseDealer(html, url));
      } catch (err) {
        out.push({ url, error: String(err?.message || err), scrapedAt: new Date().toISOString() });
      }
    }
    return out;
  }, urls);
}

async function writeExcel(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Kereskedések");
  ws.columns = [
    { header: "Cégnév", key: "cegnev", width: 40 },
    { header: "Cím", key: "cim", width: 40 },
    { header: "Web", key: "web", width: 28 },
    { header: "Találat (db)", key: "talalat_db", width: 14 },
    { header: "Nyitvatartás", key: "nyitvatartas", width: 55 },
    { header: "Akikhez fordulhat", key: "akikhez_fordulhat", width: 36 },
    { header: "E-mail", key: "email", width: 32 },
    { header: "Elsődleges tel.", key: "elso_tel", width: 22 },
    { header: "Másodlagos tel.", key: "masod_tel", width: 22 },
    { header: "URL", key: "url", width: 55 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow({
      cegnev: r.cegnev || "",
      cim: r.cim || "",
      web: r.web || "",
      talalat_db: r.talalat_db ?? "",
      nyitvatartas: r.nyitvatartas || "",
      akikhez_fordulhat: r.akikhez_fordulhat || "",
      email: r.email || "",
      elso_tel: r.elso_tel || "",
      masod_tel: r.masod_tel || "",
      url: r.url || "",
    });
  }
  await wb.xlsx.writeFile(XLSX_FILE);
  log(`Excel mentve: ${XLSX_FILE} (${rows.length} sor)`);
}

async function main() {
  log(
    `CDP=${CDP_URL}, LIMIT=${LIMIT === Infinity ? "∞" : LIMIT}, BATCH=${BATCH}, RESCRAPE=${RESCRAPE ? 1 : 0}, REFRESH_FIELDS=${REFRESH_FIELDS ? 1 : 0}`
  );
  const { browser, context } = await connectChrome();
  log("Csatlakozva a Chrome-hoz.");

  const page = await ensureHaPage(context);
  const urls = (await collectPartnerUrls(page)).slice(0, LIMIT);
  const done = loadDone();

  if (RESCRAPE && fs.existsSync(RESULTS_FILE)) {
    const bak = `${RESULTS_FILE}.bak-${Date.now()}`;
    fs.copyFileSync(RESULTS_FILE, bak);
    log(`Régi results mentve: ${bak}`);
    done.clear();
  }

  const queue = urls.filter((u) => {
    if (!done.has(u)) return true;
    if (REFRESH_FIELDS) return needsFieldRefresh(done.get(u));
    return false;
  });
  log(`Összesen: ${urls.length}, kész: ${done.size}, hátra: ${queue.length}`);
  writeProgress({ total: urls.length, done: done.size, remaining: queue.length, phase: "scrape" });

  let ok = 0;
  let fail = 0;
  while (queue.length) {
    const batch = queue.splice(0, BATCH);
    const rows = await scrapeBatch(page, batch);
    for (const row of rows) {
      if (row.error) {
        fail += 1;
        log(`  HIBA ${row.url}: ${row.error}`);
        continue;
      }
      const prev = done.get(row.url);
      done.set(row.url, prev ? { ...prev, ...row } : row);
      ok += 1;
    }
    writeResultsJsonl([...done.values()]);
    const remaining = queue.length;
    const doneCount = done.size;
    log(
      `Haladás: kész ${doneCount}/${urls.length} | ebben a körben +${ok} ok, ${fail} hiba | hátra ${remaining}`
    );
    writeProgress({
      total: urls.length,
      done: doneCount,
      remaining,
      okBatch: ok,
      failBatch: fail,
      phase: "scrape",
      lastCeg: rows.find((r) => r.cegnev)?.cegnev || "",
    });
    if (doneCount % 50 < BATCH || remaining === 0) {
      await writeExcel([...done.values()]);
    }
    await sleep(250);
  }

  writeResultsJsonl([...done.values()]);
  await writeExcel([...done.values()]);
  writeProgress({ total: urls.length, done: done.size, remaining: 0, phase: "done" });
  log(`KÉSZ. Sikeres: ${done.size}, hiba ebben a futásban: ${fail}`);
  log(`Excel: ${XLSX_FILE}`);
  await browser.close().catch(() => {});
}

main().catch((err) => {
  console.error(err.message || err);
  writeProgress({ phase: "error", error: String(err.message || err) });
  process.exit(1);
});
