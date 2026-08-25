import { cleanText, mergeAttributeMaps, parseBodyTextAttributes } from "./parse-listing.mjs";
import { sanitizeListingPlainText } from "./listing-preview.mjs";
import { extractOdometerKm, formatKmDisplay } from "./extract-km.mjs";

export async function dismissCookieBanner(page) {
  const candidates = [
    page.getByRole("button", { name: /elfogad|hozzájárul|összes.*elfogad|accept/i }),
    page.locator("button, a").filter({ hasText: /elfogad|hozzájárul/i }),
  ];
  for (const locator of candidates) {
    try {
      const target = locator.first();
      if ((await target.count()) === 0 || !(await target.isVisible())) continue;
      await target.click({ timeout: 3000 });
      await page.waitForTimeout(800);
      return;
    } catch {
      /* next */
    }
  }
}

export async function scrollListingPage(page) {
  for (let i = 0; i < 8; i += 1) {
    await page.evaluate((y) => window.scrollTo(0, y), i * 700);
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}

export async function revealPhoneNumber(page) {
  const revealSelectors = [
    page.getByRole("button", { name: /elsődleges telefonszám felfedése/i }),
    page.getByRole("link", { name: /elsődleges telefonszám felfedése/i }),
    page.getByRole("button", { name: /telefonszám.*felfed/i }),
    page.getByRole("link", { name: /telefonszám.*felfed/i }),
    page.getByText(/elsődleges telefonszám.*felfed/i),
    page.getByText(/telefonszám.*felfedése/i),
    page.locator("button, a").filter({ hasText: /felfed/i }),
  ];

  for (const locator of revealSelectors) {
    try {
      const target = locator.first();
      if ((await target.count()) === 0 || !(await target.isVisible())) continue;
      await target.click({ timeout: 2000 });
      break;
    } catch {
      /* try next */
    }
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const phone = await extractVisiblePhone(page);
    if (phone) return phone;
    await page.waitForTimeout(200);
  }
  return null;
}

async function extractVisiblePhone(page) {
  try {
    const telLink = page.locator('a[href^="tel:"]').first();
    if ((await telLink.count()) > 0) {
      const href = await telLink.getAttribute("href");
      if (href) return href.replace(/^tel:/i, "").replace(/\s+/g, " ").trim();
    }
  } catch {
    /* continue */
  }

  for (const selector of [".contact-box", ".telefonszam", "[class*='telefon']", "[class*='phone']"]) {
    try {
      const node = page.locator(selector).first();
      if ((await node.count()) === 0 || !(await node.isVisible())) continue;
      const text = await node.innerText();
      const match = text.match(/(?:\+36|06)[\s\d/-]{7,16}\d/);
      if (match) return match[0].replace(/\s+/g, " ").trim();
    } catch {
      /* next */
    }
  }

  try {
    const bodyText = await page.locator("body").innerText();
    const match = bodyText.match(/(?:\+36|06)[\s\d/-]{7,16}\d/);
    return match ? match[0].replace(/\s+/g, " ").trim() : null;
  } catch {
    return null;
  }
}

export async function extractListingFromPage(page) {
  return page.evaluate(() => {
    const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
    const map = {};

    const addPair = (rawKey, rawValue) => {
      const key = clean(rawKey).replace(/:$/, "");
      const value = clean(rawValue);
      if (!key || !value || key.length > 80 || value.length > 500) return;
      if (/^(ár|ar|költségek|altalanos adatok|muszaki adatok)$/i.test(key)) return;
      if (!map[key] || map[key].length < value.length) map[key] = value;
    };

    const parseTable = (table) => {
      for (const row of table.querySelectorAll("tr")) {
        const cells = [...row.querySelectorAll("td, th")];
        if (cells.length < 2) continue;
        const keyCell = row.querySelector("td.bal.pontos, td.pontos, th.pontos, .bal.pontos");
        if (keyCell) {
          const valueCell = keyCell.nextElementSibling;
          if (valueCell) {
            addPair(keyCell.innerText, valueCell.innerText);
            continue;
          }
        }
        addPair(cells[0].innerText, cells[cells.length - 1].innerText);
      }
    };

    for (const table of document.querySelectorAll(
      "table.hirdetesadatok, table[class*='hirdetesadatok'], .hirdetesadatok table, table[class*='adat']"
    )) {
      parseTable(table);
    }

    for (const row of document.querySelectorAll("tr")) {
      const keyCell = row.querySelector("td.bal.pontos, td.pontos, th.pontos, .bal.pontos");
      if (!keyCell) continue;
      const valueCell = keyCell.nextElementSibling;
      if (valueCell) addPair(keyCell.innerText, valueCell.innerText);
    }

    for (const dl of document.querySelectorAll("dl")) {
      for (const dt of dl.querySelectorAll("dt")) {
        const dd = dt.nextElementSibling;
        if (dd?.tagName === "DD") addPair(dt.innerText, dd.innerText);
      }
    }

    for (const label of document.querySelectorAll("label, .label, [class*='label'], [class*='cimke']")) {
      const text = clean(label.innerText);
      if (!text.endsWith(":") || text.length > 50) continue;
      const parent = label.parentElement;
      const valueNode =
        parent?.querySelector("strong, span:not(.label), input, select, .value, [class*='value'], [class*='ertek']") ||
        label.nextElementSibling;
      if (valueNode && valueNode !== label) addPair(text, valueNode.innerText || valueNode.value);
    }

    for (const section of document.querySelectorAll(
      "[class*='adat'], [class*='spec'], [class*='property'], [class*='attribute'], .hirdetes-adatok, .adatok, [data-testid*='spec']"
    )) {
      const text = section.innerText || "";
      for (const line of text.split("\n")) {
        const match = line.match(/^(.{2,50}?):\s*(.+)$/);
        if (match) addPair(match[1], match[2]);
      }
    }

    for (const item of document.querySelectorAll(
      "[class*='highlight'], [class*='kiemelt'], [class*='summary'], [class*='infokontener'], [class*='quick-spec']"
    )) {
      const text = clean(item.innerText ?? "");
      if (!text) continue;
      const yearKm = text.match(/(\d{4}(?:\/\d{1,2})?).*?(\d[\d\s.]*\s*km)/i);
      if (yearKm) {
        addPair("Évjárat", yearKm[1]);
        addPair("Futásteljesítmény", yearKm[2]);
      }
      const fuel = text.match(/(Hibrid\s*\([^)]+\)|Elektromos|Diesel|Benzin|LPG|CNG[^,]*)/i);
      if (fuel) addPair("Üzemanyag", fuel[1]);
      const power = text.match(/([\d.,]+)\s*kW(?:\s*\/\s*([\d.,]+)\s*LE)?/i);
      if (power) {
        addPair("Teljesítmény", power[2] ? `${power[1]} kW / ${power[2]} LE` : `${power[1]} kW`);
      }
      const cc = text.match(/([\d\s.]+)\s*cm³/i);
      if (cc) addPair("Hengerűrtartalom", cc[1].replace(/\s|\./g, ""));
    }

    let leiras = "";
    const leirasSelectors = [
      ".leiras",
      "#leiras",
      "[class*='leiras']",
      "[class*='description']",
      "[data-testid*='description']",
      "section[class*='leiras']",
    ];
    for (const selector of leirasSelectors) {
      const node = document.querySelector(selector);
      const text = sanitizeListingPlainText(node?.innerText ?? "");
      if (text.length >= 20) {
        leiras = text;
        break;
      }
    }

    if (!leiras) {
      for (const heading of document.querySelectorAll("h2, h3, h4, strong, b, span")) {
        if (!/leírás/i.test(heading.textContent ?? "")) continue;
        const block =
          heading.closest("section, div, article") ||
          heading.parentElement?.querySelector("p, div") ||
          heading.nextElementSibling;
        const text = sanitizeListingPlainText(block?.innerText ?? "");
        if (text.length >= 20) {
          leiras = text;
          break;
        }
      }
    }

    const felszereltseg = [];
    const badgeSelectors = [
      ".extra-badge",
      ".tooltip-badge",
      "[class*='felszer']",
      "[class*='badge']",
      ".hirdetes-extra",
      ".talalati-sor .badge",
      ".feature-badge",
      ".hirdetes-felszereltseg li",
      ".felszereltseg-list li",
      "[class*='extra'] li",
      ".extranev",
    ];
    for (const selector of badgeSelectors) {
      for (const node of document.querySelectorAll(selector)) {
        const text = clean(node.innerText);
        if (text && text.length <= 60 && !felszereltseg.includes(text)) felszereltseg.push(text);
      }
    }

    for (const section of document.querySelectorAll("[class*='felszer'], [class*='extra'], section")) {
      const heading = clean(section.querySelector("h2, h3, h4, strong")?.innerText ?? "");
      if (!/felszer|extra|további/i.test(heading)) continue;
      for (const item of section.querySelectorAll("li, span, label")) {
        const text = clean(item.innerText);
        if (text.length > 2 && text.length <= 60 && !felszereltseg.includes(text)) {
          felszereltseg.push(text);
        }
      }
    }

    const titleRaw = document.querySelector("h1")?.innerText ?? "";
    const title = String(titleRaw)
      .replace(/\r\n/g, "\n")
      .replace(/\u00a0/g, " ")
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
    let location = "";
    for (const [key, value] of Object.entries(map)) {
      if (/megtalál|települ|megye|elérhet/i.test(key)) location = value;
    }
    let kmText = "";
    for (const [key, value] of Object.entries(map)) {
      if (/futás|km\s*óra|km\s*ora|kilométeróra|kilometerora/i.test(key)) kmText = value;
    }
    if (!kmText) {
      for (const node of document.querySelectorAll(
        ".talalatisor-infokontener span, [class*='km'], [class*='futas'], .hirdetes-km, .pricefield-secondary, .adatok"
      )) {
        const t = clean(node.innerText ?? "");
        if (/\d[\d\s.]*\s*km/i.test(t) || /\b0\s*km/i.test(t)) {
          kmText = t;
          break;
        }
      }
    }

    if (!kmText) {
      const body = clean(document.body.innerText ?? "");
      const inline = body.match(
        /(?:Futásteljesítmény|Futasteljesitmeny|Km\.?\s*óra\s*állás[a]?)\s*:?\s*([\d\s.]+)\s*km/i
      );
      if (inline) kmText = `${inline[1]} km`;
    }

    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const raw = JSON.parse(script.textContent ?? "null");
        const items = Array.isArray(raw) ? raw : [raw];
        for (const item of items) {
          const value = item?.mileageFromOdometer?.value;
          if (value != null && value !== "") {
            const text = `${value} km`;
            map["Futásteljesítmény"] = text;
            if (!kmText) kmText = text;
          }
        }
      } catch {
        /* ignore */
      }
    }

    return { map, leiras, felszereltseg, title, location, kmText, bodyText: document.body.innerText ?? "" };
  });
}

export function mergePageExtract(parsed, extracted) {
  if (!extracted) return parsed;
  const fromBody = parseBodyTextAttributes(extracted.bodyText ?? "");
  const mergedMap = mergeAttributeMaps(parsed.nyersAdatok, fromBody, extracted.map);
  if (extracted.kmText && !mergedMap["Futásteljesítmény"]) {
    mergedMap["Futásteljesítmény"] = extracted.kmText;
  }
  if (extracted.kmText && !mergedMap["Km. óra állás"]) {
    mergedMap["Km. óra állás"] = extracted.kmText;
  }

  const kmDigits = extractOdometerKm({
    maps: [mergedMap],
    texts: [extracted.kmText, parsed.km, parsed.cim],
  });
  const km = kmDigits ? formatKmDisplay(kmDigits) : parsed.km;

  const parsedTitle = sanitizeListingPlainText(parsed.cim || "");
  const extractedTitle = sanitizeListingPlainText(extracted.title || "");
  const cim = parsedTitle || extractedTitle;

  const parsedLeiras = sanitizeListingPlainText(parsed.leiras || "");
  const extractedLeiras = sanitizeListingPlainText(extracted.leiras || "");
  const leiras =
    extractedLeiras.length > parsedLeiras.length ? extractedLeiras : parsedLeiras || extractedLeiras;

  return {
    ...parsed,
    cim,
    leiras,
    km,
    telefonszam: parsed.telefonszam || extracted.phone || parsed.telefonszam,
    felszereltseg: [...new Set([...(parsed.felszereltseg ?? []), ...(extracted.felszereltseg ?? [])])],
    bodyText: extracted.bodyText || parsed.bodyText || "",
    cardText: parsed.cardText || extracted.bodyText || "",
    nyersAdatok: mergedMap,
  };
}

export async function waitForListingAttributes(page, { minFields = 5, timeoutMs = 45000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const extracted = await extractListingFromPage(page);
    const count = Object.keys(extracted.map ?? {}).length;
    if (count >= minFields) return extracted;
    await page.waitForTimeout(800);
  }
  return extractListingFromPage(page);
}

export async function prepareListingPage(page) {
  await dismissCookieBanner(page);
  await scrollListingPage(page);
}
