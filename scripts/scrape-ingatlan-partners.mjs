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
 * 3) Futtasd (teljes telefonszám felfedéssel):
 *      npm run scrape:ingatlan-partners
 *      LIMIT=5 npm run scrape:ingatlan-partners   # próba
 *
 * A script megnyomja a „Felfedés”-t. Ha Cloudflare Turnstile captcha jön,
 * OLD MEG A CHROME ABLAKBAN — a script megvárja (CAPTCHA_WAIT mp).
 * Gyakran egy sikeres captcha után a következő profilok auto-reveal-elnek.
 *
 * Maszkolt / csonka számok újra:
 *      RETRY_MASKED=1 npm run scrape:ingatlan-partners
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
const CAPTCHA_WAIT = Math.max(30, Number(process.env.CAPTCHA_WAIT || 180));
const RETRY_MASKED = process.env.RETRY_MASKED === "1";
const BASE = "https://partner.ingatlan.com";

function phoneDigits(s) {
  return String(s || "").replace(/\D/g, "");
}

/** HU mobil/vezetékes: országkóddal tipikusan 11+ számjegy */
function isFullPhone(s) {
  const d = phoneDigits(s);
  return d.length >= 10;
}

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
      if (!row?.url || row.error) continue;
      // későbbi sor felülírja
      done.set(row.url, row);
    } catch {
      /* skip */
    }
  }
  if (RETRY_MASKED) {
    for (const [url, row] of [...done.entries()]) {
      if (row.telefon_maszkolt || !isFullPhone(row.telefonszam)) {
        done.delete(url);
      }
    }
  }
  return done;
}

async function extractProfileFields(page, pageUrl) {
  return page.evaluate(
    ({ pageUrl: url, footerMails }) => {
      const FOOTER = new Set(footerMails);
      const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();

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

      // Teljes szám: revealed blokk / tel: link; különben chunked
      let telefonszam = "";
      const revealed = card.querySelector("#revealed-phone-numbers");
      if (revealed && !revealed.classList.contains("d-none")) {
        const tels = [...revealed.querySelectorAll('a[href^="tel:"], a, span')]
          .map((el) => {
            const href = el.getAttribute?.("href") || "";
            if (href.startsWith("tel:")) {
              return decodeURIComponent(href.replace(/^tel:/i, ""));
            }
            return text(el);
          })
          .map((t) => t.replace(/\bphone\b/gi, "").trim())
          .filter((t) => /\d{6,}/.test(t.replace(/\D/g, "")));
        if (tels.length) telefonszam = tels[0];
      }

      if (!telefonszam) {
        const telLink = [...card.querySelectorAll('a[href^="tel:"]')].find(
          (a) => !a.classList.contains("pe-none")
        );
        if (telLink) {
          telefonszam =
            text(telLink) ||
            decodeURIComponent(
              (telLink.getAttribute("href") || "").replace(/^tel:/i, "")
            );
        }
      }

      const chunk = card.querySelector("#chunked-phone-number");
      const chunkText = text(chunk)
        .replace(/\bphone\b/gi, "")
        .replace(/\bFelfedés\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!telefonszam) telefonszam = chunkText;

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

      const revealBtn = card.querySelector("#reveal-phone-number-button");
      const captchaEl = document.querySelector("#phoneRevealCaptchaCollapse");
      const captchaOpen =
        !!captchaEl?.classList.contains("show") ||
        !!document.querySelector(
          'iframe[src*="challenges.cloudflare"], iframe[src*="turnstile"]'
        );

      const revealedVisible =
        !!revealed && !revealed.classList.contains("d-none");

      return {
        url,
        nev,
        cegnev: cegnev || "",
        telefonszam: (telefonszam || "").replace(/\s+/g, " ").trim(),
        chunkText,
        mail,
        hasRevealButton:
          !!revealBtn &&
          getComputedStyle(revealBtn).display !== "none" &&
          !revealBtn.classList.contains("d-none"),
        captchaOpen,
        revealedVisible,
        scrapedAt: new Date().toISOString(),
      };
    },
    { pageUrl, footerMails: [...FOOTER_MAILS] }
  );
}

async function tryRevealPhone(page) {
  const btn = page.locator("#reveal-phone-number-button");
  if ((await btn.count()) === 0) return;
  try {
    await btn.first().click({ timeout: 5000 });
  } catch {
    /* already gone / not clickable */
  }
  await sleep(800);
}

async function waitForFullPhone(page, url) {
  let notifiedCaptcha = false;
  const deadline = Date.now() + CAPTCHA_WAIT * 1000;

  while (Date.now() < deadline) {
    const fields = await extractProfileFields(page, url);
    const full = isFullPhone(fields.telefonszam);
    const revealed =
      fields.revealedVisible ||
      (full && phoneDigits(fields.telefonszam).length > phoneDigits(fields.chunkText).length);

    if (full && (revealed || !fields.hasRevealButton)) {
      return { ...fields, telefon_maszkolt: false };
    }

    if (fields.captchaOpen || fields.hasRevealButton) {
      if (!notifiedCaptcha) {
        log(
          `  ⏳ CAPTCHA / Felfedés — oldd meg a Chrome ablakban (${CAPTCHA_WAIT}s timeout): ${url}`
        );
        notifiedCaptcha = true;
        writeProgress({
          phase: "captcha_wait",
          url,
          message: "Oldd meg a Turnstile captchát a Chrome-ban",
        });
      }
      if (fields.hasRevealButton && !fields.captchaOpen) {
        await tryRevealPhone(page);
      }
    }

    await sleep(1000);
  }

  const last = await extractProfileFields(page, url);
  return {
    ...last,
    telefon_maszkolt: !isFullPhone(last.telefonszam),
    captcha_timeout: !isFullPhone(last.telefonszam),
  };
}

async function scrapeProfile(page, url) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
      await sleep(500);

      const title = await page.title();
      if (/gyors ellenőrzés|Egy pillanat|Just a moment/i.test(title)) {
        return {
          url,
          error: "bot_challenge",
          scrapedAt: new Date().toISOString(),
        };
      }

      // auto-reveal néha azonnal ad teljes számot
      let fields = await extractProfileFields(page, url);
      if (isFullPhone(fields.telefonszam) && !fields.hasRevealButton) {
        return { ...fields, telefon_maszkolt: false };
      }

      if (fields.hasRevealButton) {
        await tryRevealPhone(page);
      }

      fields = await waitForFullPhone(page, url);
      return fields;
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
  log(
    `CDP=${CDP_URL}, LIMIT=${LIMIT === Infinity ? "∞" : LIMIT}, CAPTCHA_WAIT=${CAPTCHA_WAIT}s, RETRY_MASKED=${RETRY_MASKED}`
  );
  const { context } = await connectChrome();
  log("Csatlakozva a Chrome-hoz.");

  let page = await ensurePartnerPage(context);
  const urls = (await collectPartnerUrls(page)).slice(0, LIMIT);
  const done = loadDone();
  const queue = urls.filter((u) => !done.has(u));
  log(`Összesen: ${urls.length}, kész (teljes tel.): ${done.size}, hátra: ${queue.length}`);
  log(
    "Teljes telefonszámhoz: ha captcha jön, oldd meg a debug Chrome ablakban."
  );
  writeProgress({
    total: urls.length,
    done: done.size,
    remaining: queue.length,
    phase: "scrape",
  });

  let fail = 0;
  let masked = 0;
  let i = 0;
  for (const url of queue) {
    i += 1;
    if (page.isClosed()) {
      log("Lap bezáródott — újracsatlakozás…");
      const again = await connectChrome();
      page = await ensurePartnerPage(again.context);
    }
    const row = await scrapeProfile(page, url);
    // ne mentsük a belső helper mezőket
    const out = {
      url: row.url,
      nev: row.nev || "",
      cegnev: row.cegnev || "",
      telefonszam: row.telefonszam || "",
      mail: row.mail || "",
      telefon_maszkolt: !!row.telefon_maszkolt,
      captcha_timeout: !!row.captcha_timeout,
      error: row.error,
      scrapedAt: row.scrapedAt || new Date().toISOString(),
    };
    fs.appendFileSync(RESULTS_FILE, `${JSON.stringify(out)}\n`);
    if (out.error) {
      fail += 1;
      log(`  HIBA ${url}: ${out.error}`);
    } else if (out.telefon_maszkolt || !isFullPhone(out.telefonszam)) {
      masked += 1;
      // ne tegye a done-ba → RETRY_MASKED / újraindítás újra próbálja
      log(
        `  RÉSZLEGES ${out.nev || "?"} | ${out.telefonszam || "—"} (captcha timeout? ${out.captcha_timeout})`
      );
    } else {
      done.set(url, out);
      log(
        `  OK ${done.size}/${urls.length}: ${out.nev || "?"} | ${out.cegnev || "—"} | ${out.telefonszam}`
      );
    }
    writeProgress({
      total: urls.length,
      done: done.size,
      remaining: queue.length - i,
      failBatch: fail,
      maskedBatch: masked,
      phase: "scrape",
      lastNev: out.nev || "",
    });
    if (done.size % 25 === 0 || i === queue.length) {
      await writeExcel([...done.values()]);
    }
    await sleep(250);
  }

  await writeExcel([...done.values()]);
  writeProgress({ total: urls.length, done: done.size, remaining: 0, phase: "done" });
  log(
    `KÉSZ. Teljes tel.: ${done.size}, részleges/captcha: ${masked}, hiba: ${fail}`
  );
  log(`Excel: ${XLSX_FILE}`);
}

main().catch((err) => {
  console.error(err.message || err);
  writeProgress({ phase: "error", error: String(err.message || err) });
  process.exit(1);
});
