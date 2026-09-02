/**
 * partner.ingatlan.com partnerek → Excel
 * Verzió: Chrome CDP (te nyitod a böngészőt, a script csatlakozik)
 *
 * 1) Indítsd a Chrome-ot debug módban:
 *      mac/chrome-debug-ingatlan-partners.command
 *
 * 2) A megnyíló Chrome-ban nyisd meg:
 *      https://partner.ingatlan.com/
 *    Várd meg, amíg betölt (nem „Csak egy gyors ellenőrzés!”).
 *
 * 3) Futtasd:
 *      npm run scrape:ingatlan-partners
 *      LIMIT=20 npm run scrape:ingatlan-partners   # próba
 *      REFRESH_URLS=1 npm run scrape:ingatlan-partners
 *
 * Mezők: nev, cegnev (ha van), telefonszam (látható / részleges), mail (ha van)
 *
 * Megjegyzés: a teljes telefonszám sok profilon CAPTCHA után („Felfedés”) jelenik meg.
 * Alapból a látható (gyakran csonka) számot mentjük.
 *
 * Kimenet: data/ingatlan-partners/ingatlan-partners.xlsx
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import ExcelJS from "exceljs";

const ROOT = path.resolve("data/ingatlan-partners");
const URLS_FILE = path.join(ROOT, "urls.json");
const RESULTS_FILE = path.join(ROOT, "results.jsonl");
const XLSX_FILE = path.join(ROOT, "ingatlan-partners.xlsx");
const PROGRESS_FILE = path.join(ROOT, "progress.json");
const LOG_FILE = path.join(ROOT, "scrape.log");

const CDP_URL = process.env.CDP_URL || "http://127.0.0.1:9223";
const LIMIT = Number(process.env.LIMIT || 0) || Infinity;
const BASE = "https://partner.ingatlan.com";

const SKIP_SLUGS = new Set([
  "",
  "program",
  "regisztracio",
  "ingatlankozvetitok",
  "impresszum",
  "adatvedelem",
  "aszf",
  "dsa",
  "suti",
  "cookies",
]);

const FOOTER_MAILS = new Set([
  "segitunk@ingatlan.com",
  "dpo@ingatlan.com",
  "info@ingatlan.com",
]);

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
        `Indítsd: mac/chrome-debug-ingatlan-partners.command\n` +
        `Majd nyisd meg: ${BASE}/\n` +
        `Hiba: ${err.message}`
    );
  }
}

async function ensurePartnerPage(context) {
  let page = context.pages().find((p) => p.url().includes("partner.ingatlan.com"));
  if (!page) page = context.pages()[0] || (await context.newPage());

  if (!page.url().includes("partner.ingatlan.com")) {
    log(`Navigálás: ${BASE}/`);
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
  }

  for (let i = 0; i < 90; i++) {
    const state = await page.evaluate(() => {
      const body = document.body?.innerText || "";
      const cards = [...document.querySelectorAll('a[href^="/"]')].filter((a) => {
        const href = a.getAttribute("href") || "";
        return (
          /^\/[a-z0-9._-]+$/i.test(href) &&
          href.includes(".") &&
          /Partner|prémium|ellenőrzött/i.test(a.innerText || "")
        );
      }).length;
      return {
        title: document.title,
        cards,
        challenge: /gyors ellenőrzés|Egy pillanat|Just a moment/i.test(
          body + document.title
        ),
        count: (body.match(/(\d[\d\s]*)\s*Partner/i) || [])[1] || "",
      };
    });
    if (!state.challenge && state.cards >= 5) {
      log(
        `Oldal kész: „${state.title}”, ${state.cards} partner kártya` +
          (state.count ? `, lista: ${state.count.trim()} Partner` : "")
      );
      return page;
    }
    if (i === 0 || i % 5 === 0) {
      log(
        `Várakozás botvédelemre / betöltésre… (${i}s) cím: ${state.title}` +
          (state.challenge ? " [ellenőrzés]" : "")
      );
    }
    await sleep(1000);
  }
  throw new Error(
    "A partner.ingatlan.com nem töltött be rendesen. Nyisd meg kézzel a Chrome-ban, fogadd el az ellenőrzést, majd futtasd újra."
  );
}

async function readListingMeta(page) {
  return page.evaluate(() => {
    const body = document.body?.innerText || "";
    const m = body.match(/(\d[\d\s]*)\s*Partner/i);
    const totalPartners = m ? Number(m[1].replace(/\s+/g, "")) : 0;
    const links = [
      ...new Set(
        [...document.querySelectorAll('a[href^="/"]')]
          .map((a) => a.getAttribute("href") || "")
          .filter((h) => /^\/[a-z0-9._-]+$/i.test(h) && h.includes("."))
      ),
    ].map((h) => `https://partner.ingatlan.com${h}`);
    const hasNext = !!document.querySelector(
      'a[href*="page="], a[rel="next"]'
    );
    return { totalPartners, links, hasNext };
  });
}

async function collectPartnerUrls(page) {
  if (fs.existsSync(URLS_FILE) && !process.env.REFRESH_URLS) {
    const cached = JSON.parse(fs.readFileSync(URLS_FILE, "utf8"));
    if (Array.isArray(cached) && cached.length > 0) {
      log(`URL lista cache: ${cached.length} db`);
      return cached;
    }
  }

  log("Partner URL-ek gyűjtése (lapozva, böngésző navigáció)…");
  const urls = new Set();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await sleep(800);

  let meta = await readListingMeta(page);
  const totalPartners = meta.totalPartners;
  const maxPages = Math.max(
    1,
    Math.ceil((totalPartners || 1200) / 12) + 8
  );
  log(`Lista szerint ~${totalPartners || "?"} Partner, maxPages=${maxPages}`);

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    if (pageNum > 1) {
      await page.goto(`${BASE}/?page=${pageNum}`, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
      await sleep(400);
      meta = await readListingMeta(page);
    }

    const title = await page.title();
    if (/gyors ellenőrzés|Egy pillanat|Just a moment/i.test(title)) {
      throw new Error(
        `Botvédelem a ${pageNum}. oldalon. Oldd meg a Chrome-ban, majd REFRESH_URLS=1.`
      );
    }

    const before = urls.size;
    for (const u of meta.links) {
      const slug = u.replace(`${BASE}/`, "").toLowerCase();
      if (SKIP_SLUGS.has(slug)) continue;
      urls.add(u);
    }
    const added = urls.size - before;
    log(`  page ${pageNum}: +${added} (összesen ${urls.size})`);

    if (added === 0 && pageNum > 1) break;
    if (totalPartners && urls.size >= totalPartners) break;
    if (Number.isFinite(LIMIT) && urls.size >= LIMIT) break;
  }

  const list = [...urls].sort();
  const incomplete =
    Number.isFinite(LIMIT) && totalPartners && list.length < totalPartners;
  if (!incomplete) {
    fs.writeFileSync(URLS_FILE, JSON.stringify(list, null, 2));
    log(`Mentve: ${list.length} partner URL → ${URLS_FILE}`);
  } else {
    log(`URL gyűjtés LIMIT miatt részleges: ${list.length} db (cache nem frissült)`);
  }
  return list;
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

async function scrapeProfile(page, url) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
      await sleep(350);

      const title = await page.title();
      if (/gyors ellenőrzés|Egy pillanat|Just a moment/i.test(title)) {
        return {
          url,
          error: "bot_challenge",
          scrapedAt: new Date().toISOString(),
        };
      }

      return await page.evaluate(
        ({ pageUrl, footerMails }) => {
          const FOOTER = new Set(footerMails);
          const text = (el) =>
            (el?.textContent || "").replace(/\s+/g, " ").trim();

          const card =
            document.querySelector(".profile-basic-details-card") ||
            document.querySelector("[data-controller*='profile-page']") ||
            document.body;

          const nev =
            text(card.querySelector("h1")) ||
            text(document.querySelector("h1")) ||
            "";

          let cegnev = text(
            card.querySelector(
              ".fw-700.font-family-secondary.fs-7, .fw-700.font-family-secondary"
            )
          );
          if (!cegnev) {
            const officeBlock = card.querySelector(
              'a[href*="iroda.ingatlan.com"]'
            )?.parentElement;
            if (officeBlock) {
              const cand = [...officeBlock.querySelectorAll("div, span, a")]
                .map((el) => text(el))
                .find(
                  (t) =>
                    t &&
                    t.length >= 3 &&
                    t.length < 80 &&
                    !/felfed|visszahív|megoszt|partner|phone/i.test(t)
                );
              if (cand) cegnev = cand;
            }
          }

          let telefonszam = "";
          const chunk = card.querySelector("#chunked-phone-number");
          if (chunk) {
            telefonszam = text(chunk)
              .replace(/\bphone\b/gi, "")
              .replace(/\bFelfedés\b/gi, "")
              .replace(/\s+/g, " ")
              .trim();
          }
          if (!telefonszam) {
            const telLink = card.querySelector('a[href^="tel:"]');
            if (telLink) {
              telefonszam =
                text(telLink) ||
                decodeURIComponent(
                  (telLink.getAttribute("href") || "").replace(/^tel:/i, "")
                );
            }
          }

          let mail = "";
          for (const a of card.querySelectorAll('a[href^="mailto:"]')) {
            const href = a.getAttribute("href") || "";
            const addr = href
              .replace(/^mailto:/i, "")
              .split("?")[0]
              .trim()
              .toLowerCase();
            if (!addr || !addr.includes("@")) continue;
            if (FOOTER.has(addr)) continue;
            mail = addr;
            break;
          }

          const phoneMasked =
            /felfed/i.test(text(chunk) || "") ||
            !!card.querySelector(
              '[data-controller*="phone-reveal"], [data-action*="phone-reveal"]'
            );

          return {
            url: pageUrl,
            nev,
            cegnev: cegnev || "",
            telefonszam,
            mail,
            telefon_maszkolt: phoneMasked,
            scrapedAt: new Date().toISOString(),
          };
        },
        { pageUrl: url, footerMails: [...FOOTER_MAILS] }
      );
    } catch (err) {
      const msg = String(err?.message || err);
      if (attempt < 2 && /closed|Target page|browser has been/i.test(msg)) {
        await sleep(1000);
        continue;
      }
      return { url, error: msg, scrapedAt: new Date().toISOString() };
    }
  }
  return {
    url,
    error: "unknown",
    scrapedAt: new Date().toISOString(),
  };
}

async function writeExcel(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Partnerek");
  ws.columns = [
    { header: "Név", key: "nev", width: 28 },
    { header: "Cégnév", key: "cegnev", width: 36 },
    { header: "Telefonszám", key: "telefonszam", width: 22 },
    { header: "E-mail", key: "mail", width: 32 },
    { header: "Tel. maszkolt?", key: "telefon_maszkolt", width: 14 },
    { header: "URL", key: "url", width: 48 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow({
      nev: r.nev || "",
      cegnev: r.cegnev || "",
      telefonszam: r.telefonszam || "",
      mail: r.mail || "",
      telefon_maszkolt: r.telefon_maszkolt ? "igen" : "nem",
      url: r.url || "",
    });
  }
  await wb.xlsx.writeFile(XLSX_FILE);
  log(`Excel mentve: ${XLSX_FILE} (${rows.length} sor)`);
}

async function main() {
  log(`CDP=${CDP_URL}, LIMIT=${LIMIT === Infinity ? "∞" : LIMIT}`);
  const { browser, context } = await connectChrome();
  log("Csatlakozva a Chrome-hoz.");

  let page = await ensurePartnerPage(context);
  const urls = (await collectPartnerUrls(page)).slice(0, LIMIT);
  const done = loadDone();
  const queue = urls.filter((u) => !done.has(u));
  log(`Összesen: ${urls.length}, kész: ${done.size}, hátra: ${queue.length}`);
  writeProgress({
    total: urls.length,
    done: done.size,
    remaining: queue.length,
    phase: "scrape",
  });

  let fail = 0;
  let i = 0;
  for (const url of queue) {
    i += 1;
    // ha a lap bezáródott, újra csatlakozás / új lap
    if (page.isClosed()) {
      log("Lap bezáródott — újracsatlakozás…");
      const again = await connectChrome();
      page = await ensurePartnerPage(again.context);
    }
    const row = await scrapeProfile(page, url);
    fs.appendFileSync(RESULTS_FILE, `${JSON.stringify(row)}\n`);
    if (row.error) {
      fail += 1;
      log(`  HIBA ${url}: ${row.error}`);
    } else {
      done.set(url, row);
      log(
        `  OK ${done.size}/${urls.length}: ${row.nev || "?"} | ${row.cegnev || "—"} | ${row.telefonszam || "—"}`
      );
    }
    writeProgress({
      total: urls.length,
      done: done.size,
      remaining: queue.length - i,
      failBatch: fail,
      phase: "scrape",
      lastNev: row.nev || "",
    });
    if (done.size % 25 === 0 || i === queue.length) {
      await writeExcel([...done.values()]);
    }
    await sleep(200);
  }

  await writeExcel([...done.values()]);
  writeProgress({ total: urls.length, done: done.size, remaining: 0, phase: "done" });
  log(`KÉSZ. Sikeres: ${done.size}, hiba ebben a futásban: ${fail}`);
  log(`Excel: ${XLSX_FILE}`);
  // connectOverCDP: ne zárd be a felhasználó Chrome-ját
}

main().catch((err) => {
  console.error(err.message || err);
  writeProgress({ phase: "error", error: String(err.message || err) });
  process.exit(1);
});
