import { shortUrl } from "./url-utils.mjs";
import { extractOdometerKm, formatKmDisplay } from "./extract-km.mjs";
import { parseSummarySpecs } from "./map-tech.mjs";
import { sanitizeListingPlainText, isListingSiteChromeLine } from "./listing-preview.mjs";

const PHONE_RE = /(?:\+36|06)\s*[\d\s/-]{7,14}\d/;

const YEAR_KEYS = ["évjárat", "gyártási év", "gyartasi ev"];
const KM_KEYS = ["futásteljesítmény", "futasteljesitmeny", "kilométeróra", "kilometerora", "km"];
const PRICE_KEYS = ["vételár", "vetelar", "ár", "ar", "hirdetési ár"];
const TYPE_KEYS = ["jármű típus", "jarmu tipus", "típus", "tipus", "kategória", "kategoria", "kivitel", "típusjel"];

export function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .replace(/:$/, "")
    .replace(/[.:·,]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function pickValue(map, keys) {
  for (const key of keys) {
    const normalized = normalizeKey(key);
    for (const [entryKey, entryValue] of Object.entries(map)) {
      if (normalizeKey(entryKey) === normalized && cleanText(entryValue)) {
        const value = cleanText(entryValue);
        if (isListingSiteChromeLine(value)) continue;
        return value;
      }
    }
    for (const [entryKey, entryValue] of Object.entries(map)) {
      if (normalizeKey(entryKey).includes(normalized) && cleanText(entryValue)) {
        const value = cleanText(entryValue);
        if (isListingSiteChromeLine(value)) continue;
        return value;
      }
    }
  }
  return null;
}

function extractYear(value) {
  if (!value) return null;
  const ym = value.match(/\b((19|20)\d{2})(?:\/(\d{1,2}))?\b/);
  if (ym) {
    return ym[3] ? `${ym[1]}/${Number(ym[3])}` : ym[1];
  }
  return cleanText(value);
}

function attributeValueScore(value) {
  const v = cleanText(value);
  if (!v) return -1;
  if (/telefonszám|felfedése|elfogad|cookie|cloudflare|parkolóba/i.test(v)) return -1000;
  if (/javascript|böngésző nem támogatja|bongeszo nem tamogatja/i.test(v)) return -1000;
  if (v.length > 120) return 50;
  return v.length;
}

/** Több forrásból származó címke→érték map egyesítése; a tisztább/hosszabb érték marad. */
export function mergeAttributeMaps(...maps) {
  const merged = {};
  for (const map of maps) {
    if (!map || typeof map !== "object") continue;
    for (const [rawKey, rawValue] of Object.entries(map)) {
      const key = cleanText(String(rawKey).replace(/:$/, ""));
      const value = cleanText(rawValue);
      if (!key || !value || key.length > 80) continue;
      const existing = merged[key];
      if (!existing) {
        merged[key] = value;
        continue;
      }
      if (attributeValueScore(value) > attributeValueScore(existing)) {
        merged[key] = value;
      }
    }
  }
  return merged;
}

function stripHtml(value) {
  return cleanText(String(value ?? "").replace(/<[^>]+>/g, " "));
}

function isPlausibleLabel(key) {
  const text = cleanText(String(key).replace(/:$/, ""));
  if (!text || text.length < 2 || text.length > 60) return false;
  if (/https?:|javascript:|<|>|{|}/i.test(text)) return false;
  return true;
}

function isOptionDump(value) {
  const v = cleanText(value);
  if (/^v[aá]lasszon|^-\s*$|^nincs megadva$/i.test(v)) return true;
  if (v.length > 70 && v.split(/\s+/).length > 6) return true;
  return false;
}

function cellText(html) {
  const selected =
    String(html ?? "").match(/<option[^>]*\bselected\b[^>]*>([\s\S]*?)<\/option>/i) ||
    String(html ?? "").match(/<option[^>]*\bselected\b[^>]*value=["']([^"']+)["'][^>]*>/i);
  if (selected) return stripHtml(selected[1]);
  const inputVal = String(html ?? "").match(/<(?:input|textarea)[^>]*\bvalue=["']([^"']+)["']/i);
  if (inputVal) return cleanText(inputVal[1]);
  return stripHtml(html);
}

function addAttributePair(map, rawKey, rawValue) {
  const key = cleanText(String(rawKey).replace(/:$/, ""));
  const value = cellText(rawValue);
  if (!isPlausibleLabel(key) || !value || value.length > 500 || isOptionDump(value)) return;
  if (/^(ár|ar|költségek|altalanos adatok|muszaki adatok|felszereltseg|felszereltség)$/i.test(key)) {
    return;
  }
  const existing = map[key];
  const isNameKey = /m[aá]rka|gy[aá]rtm[aá]ny|modell/i.test(key);
  if (!existing) {
    map[key] = value;
    return;
  }
  if (isNameKey && existing.length > value.length && value.length >= 2) {
    map[key] = value;
    return;
  }
  if (!isNameKey && existing.length < value.length) {
    map[key] = value;
  }
}

function parseTableRows(tableHtml, map) {
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const row of rows) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
    if (cells.length < 2) continue;

    let keyCell = cells[0][1];
    let valueCell = cells[cells.length - 1][1];

    const keyFromBal = row[1].match(/<td[^>]*class="[^"]*bal[^"]*pontos[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
    if (keyFromBal) {
      keyCell = keyFromBal[1];
      const afterKey = row[1].slice(keyFromBal.index + keyFromBal[0].length);
      const valueAfterKey = afterKey.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
      if (valueAfterKey) valueCell = valueAfterKey[1];
    }

    addAttributePair(map, keyCell, valueCell);
  }
}

function extractKm(value) {
  if (!value) return null;
  const match = value.match(/([\d\s.]+)\s*km/i);
  if (match) return `${match[1].replace(/\s/g, " ").trim()} km`;
  const digits = value.match(/^\d[\d\s.]*$/);
  return digits ? `${digits[0].replace(/\s/g, " ").trim()} km` : cleanText(value);
}

function extractPrice(value) {
  if (!value) return null;
  const match = value.match(/([\d\s.]+)\s*(Ft|EUR|€)/i);
  if (match) return `${match[1].replace(/\s/g, " ").trim()} ${match[2]}`;
  return cleanText(value);
}

function extractPhone(text) {
  const matches = String(text ?? "").match(new RegExp(PHONE_RE, "gi"));
  if (!matches?.length) return null;
  return cleanText(matches[0]);
}

function parseAttributesTable(html) {
  const map = {};
  const tablePatterns = [
    /<table[^>]*class="[^"]*hirdetesadatok[^"]*"[^>]*>([\s\S]*?)<\/table>/gi,
    /<table[^>]*class="[^"]*adat[^"]*"[^>]*>([\s\S]*?)<\/table>/gi,
  ];

  for (const pattern of tablePatterns) {
    for (const tableMatch of html.matchAll(pattern)) {
      parseTableRows(tableMatch[1], map);
    }
  }

  return map;
}

function parseLabeledBlocks(html) {
  const map = {};
  const patterns = [
    />([^<:]{2,50}):<\/[^>]+>\s*<[^>]+>\s*<[^>]+>\s*([^<]+)</gi,
    /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi,
    /<span[^>]*>([\s\S]*?)<\/span>\s*<(?:strong|span|div)[^>]*>([\s\S]*?)<\/(?:strong|span|div)>/gi,
    /<div[^>]*class="[^"]*(?:label|cimke|key)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*(?:value|ertek)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      addAttributePair(map, match[1], match[2]);
    }
  }

  return map;
}

function parseInlineAttributes(html) {
  const map = {};
  const text = stripHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
  );

  for (const line of text.split(/\n+/)) {
    const match = line.match(/^(.{2,50}?):\s*(.{1,200})$/);
    if (match) addAttributePair(map, match[1], match[2]);
  }

  return map;
}

function parseEmbeddedListingJson(html) {
  const map = {};
  const scriptPatterns = [
    /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
    /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi,
  ];

  const tryExtract = (node, depth = 0) => {
    if (!node || depth > 12) return;
    if (Array.isArray(node)) {
      for (const item of node) tryExtract(item, depth + 1);
      return;
    }
    if (typeof node !== "object") return;

    const label = node.label ?? node.name ?? node.key ?? node.title;
    const value = node.value ?? node.text ?? node.content ?? node.val;
    if (typeof label === "string" && (typeof value === "string" || typeof value === "number")) {
      addAttributePair(map, label, value);
    }

    if (typeof node.marka === "string") addAttributePair(map, "Márka", node.marka);
    if (typeof node.gyartmany === "string") addAttributePair(map, "Gyártmány", node.gyartmany);
    if (typeof node.modell === "string") addAttributePair(map, "Modell", node.modell);
    if (typeof node.brand === "string") addAttributePair(map, "Márka", node.brand);
    if (typeof node.model === "string") addAttributePair(map, "Modell", node.model);

    for (const value of Object.values(node)) {
      if (value && typeof value === "object") tryExtract(value, depth + 1);
    }
  };

  for (const pattern of scriptPatterns) {
    const matches = pattern.global
      ? [...html.matchAll(pattern)]
      : html.match(pattern)
        ? [html.match(pattern)]
        : [];
    for (const match of matches) {
      try {
        tryExtract(JSON.parse(match[1]));
      } catch {
        /* ignore */
      }
    }
  }

  return map;
}

/** Új hasznaltauto layout: kiemelt ikonok + táblázat — body szövegből címke/érték pár. */
export function parseBodyTextAttributes(text) {
  const map = {};
  const raw = String(text ?? "");
  if (!raw.trim()) return map;

  const inlinePatterns = [
    ["Évjárat", /\b(?:Évjárat|Gyártási év)\s*[:\n]\s*(\d{4}(?:\/\d{1,2})?)/gi],
    ["Futásteljesítmény", /\b(?:Futásteljesítmény|Km\.?\s*óra\s*állás[a]?)\s*[:\n]\s*([\d\s.]+\s*km)/gi],
    ["Vételár", /\b(?:Vételár|Hirdetési ár)\s*[:\n]\s*([\d\s.]+\s*Ft)/gi],
    ["Üzemanyag", /\bÜzemanyag\s*[:\n]\s*([^\n]{2,60})/gi],
    ["Kategória", /\b(?:Kategória|Kivitel)\s*[:\n]\s*([^\n]{2,40})/gi],
    ["Állapot", /\bÁllapot\s*[:\n]\s*([^\n]{2,40})/gi],
    ["Teljesítmény", /\bTeljesítmény\s*[:\n]\s*([^\n]{2,40})/gi],
    ["Sebességváltó", /\bSebességváltó\s*[:\n]\s*([^\n]{2,40})/gi],
    ["Hajtás", /\b(?:Hajtás|Hajtáslánc|Meghajtás)\s*[:\n]\s*([^\n]{2,40})/gi],
    ["Szín", /\bSzín\s*[:\n]\s*([^\n]{2,40})/gi],
    ["Hengerűrtartalom", /\bHengerűrtartalom\s*[:\n]\s*([\d\s.]+\s*cm³?)/gi],
    ["Okmányok jellege", /\bOkmányok jellege\s*[:\n]\s*([^\n]{2,60})/gi],
    ["Okmányok érvényessége", /\bOkmányok érvényessége\s*[:\n]\s*([^\n]{2,40})/gi],
    [
      "Első magyarországi forgalomba helyezés",
      /\bElső magyarországi forgalomba helyezés\s*[:\n]\s*(\d{4}(?:\/\d{1,2})?)/gi,
    ],
    ["Műszaki vizsga érvényes", /\bMűszaki vizsga érvényes\s*[:\n]\s*(\d{4}(?:\/\d{1,2})?)/gi],
    ["Megtalálható", /\b(?:Megtalálható|Település|Elhelyezkedés)\s*[:\n]\s*([^\n]{2,80})/gi],
    ["Nyári gumi méret", /\bNyári gumi méret\s*[:\n]\s*(\d{3}\s*\/\s*\d{2}\s*R?\s*\d{2})/gi],
  ];

  for (const [label, pattern] of inlinePatterns) {
    for (const match of raw.matchAll(pattern)) {
      addAttributePair(map, label, match[1]);
    }
  }

  const lines = raw
    .split(/\n+/)
    .map((line) => cleanText(line))
    .filter(Boolean);

  const labelHints =
    /^(evjarat|gyartasi|futasteljesitmeny|km|vetelar|uzemanyag|kategoria|kivitel|allapot|teljesitmeny|sebesseg|hajt|szin|henger|okmany|forgalomba|muszaki|megtalalhato|ajto|szallithato|co2|fogyasztas|csomagtarto|karpit|tulajdonos)/;

  for (let i = 0; i < lines.length - 1; i += 1) {
    const line = lines[i].replace(/:$/, "");
    const next = lines[i + 1];
    if (!line || line.length > 55 || next.length > 80) continue;
    if (next.endsWith(":") || /^[\d\s.]+\s*Ft$/i.test(line)) continue;
    if (/telefonszám|felfedése|cookie/i.test(next)) continue;
    if (labelHints.test(normalizeKey(line)) || line.endsWith(":")) {
      addAttributePair(map, line, next);
    }
  }

  return map;
}

function parseJsonLd(html) {
  const map = {};
  const scripts = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    try {
      const data = JSON.parse(script[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item?.name) map["Cím"] = cleanText(item.name);
        if (item?.offers?.price) {
          const currency = item.offers.priceCurrency ?? "Ft";
          map["Ár"] = `${item.offers.price} ${currency}`;
        }
        if (item?.vehicleModelDate) map["Évjárat"] = String(item.vehicleModelDate);
        if (item?.mileageFromOdometer?.value) {
          map["Futásteljesítmény"] = `${item.mileageFromOdometer.value} km`;
        }
      }
    } catch {
      /* ignore */
    }
  }
  return map;
}

function parseTitle(html) {
  const candidates = [];
  for (const match of String(html ?? "").matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)) {
    const inner = match[1]
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ");
    candidates.push(inner);
  }
  const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
  if (ogTitle) candidates.push(ogTitle[1]);
  const jsonName = html.match(/"name"\s*:\s*"([^"]{3,120})"/);
  if (jsonName) candidates.push(jsonName[1]);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) candidates.push(title[1].replace(/\s*[|–-].*$/, ""));
  for (const raw of candidates) {
    const cleaned = sanitizeListingPlainText(raw);
    if (cleaned && cleaned.replace(/\s+/g, " ").trim().length >= 3) return cleaned;
  }
  return null;
}

function parsePriceFromHtml(html) {
  const patterns = [
    /class="[^"]*price[^"]*"[^>]*>([^<]+)</i,
    />([\d\s.]+)\s*Ft</i,
    /"price"\s*:\s*"?([\d\s.]+)"?/i,
    /Vételár[^<]{0,40}<[^>]+>[^<]{0,20}([\d\s.]+)\s*Ft/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return extractPrice(match[1] + " Ft");
  }
  return null;
}

function parseYearFromTitle(title) {
  if (!title) return null;
  const match = title.match(/\((19|20)\d{2}(?:\/\d{1,2})?\)/);
  return match ? extractYear(match[0].replace(/[()]/g, "")) : null;
}

function parseVehicleType(title, map) {
  if (title) {
    const fromTitle = title
      .replace(/^eladó\s+/i, "")
      .replace(/\s*\((19|20)\d{2}.*\)\s*$/, "")
      .trim();
    if (fromTitle) return fromTitle;
  }

  return pickValue(map, TYPE_KEYS);
}

function isJunkDescription(text) {
  const n = cleanText(text);
  if (!n) return true;
  if (/^le[ií]r[aá]s\b/i.test(n) && n.length < 90) return true;
  if (/megtekinthet[oő]\s+telefonon/i.test(n) && n.length < 160) return true;
  return false;
}

export function parseDescription(html) {
  const patterns = [
    /<div[^>]*class="[^"]*leiras[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="[^"]*leiras[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<section[^>]*class="[^"]*leiras[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
    /Leírás[\s\S]{0,80}?<(?:div|p)[^>]*>([\s\S]{40,8000}?)<\/(?:div|p)>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;
    const text = sanitizeListingPlainText(
      match[1].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")
    ).replace(/^le[ií]r[aá]s\s+/i, "");
    if (text.length >= 20 && !isJunkDescription(text)) return text;
  }

  return null;
}

function parseEquipmentFromHtml(html) {
  const items = [];
  const patterns = [
    /class="[^"]*(?:extra-badge|tooltip-badge|feature-badge)[^"]*"[^>]*>([^<]{2,60})</gi,
    /class="[^"]*felszer[^"]*"[^>]*>([^<]{2,80})</gi,
    /data-(?:extra|feature)="([^"]{2,80})"/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const text = cleanText(match[1]);
      if (text && !items.includes(text)) items.push(text);
    }
  }

  const felszerBlock = html.match(/Felszereltség[\s\S]{0,4000}?<\/(?:section|div)>/i);
  if (felszerBlock) {
    for (const match of felszerBlock[0].matchAll(/>([^<]{2,60})</g)) {
      const text = cleanText(match[1]);
      if (text.length > 2 && text.length < 60 && !/felszereltség|extra|további/i.test(text)) {
        if (!items.includes(text)) items.push(text);
      }
    }
  }

  return items;
}

export function parseListingHtml(html, { url = "", phone = null } = {}) {
  const bodyText = stripHtml(
    String(html ?? "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
  );
  const attributeMap = mergeAttributeMaps(
    parseJsonLd(html),
    parseEmbeddedListingJson(html),
    parseLabeledBlocks(html),
    parseInlineAttributes(html),
    parseAttributesTable(html),
    parseBodyTextAttributes(bodyText)
  );

  const title = parseTitle(html);
  const jarmuTipus = parseVehicleType(title, attributeMap);
  const ar =
    extractPrice(pickValue(attributeMap, PRICE_KEYS)) ??
    parsePriceFromHtml(html);
  const evjarat =
    extractYear(pickValue(attributeMap, YEAR_KEYS)) ??
    parseYearFromTitle(title);
  const kmDigits = extractOdometerKm({
    maps: [attributeMap],
    texts: [title, html],
  });
  const km = kmDigits ? formatKmDisplay(kmDigits) : extractKm(pickValue(attributeMap, KM_KEYS));
  const telefonszam = phone ?? extractPhone(html);
  const leiras = parseDescription(html);
  const felszereltseg = parseEquipmentFromHtml(html);

  return {
    url: cleanText(url),
    jarmuTipus,
    ar,
    evjarat,
    km,
    telefonszam,
    cim: title,
    leiras: sanitizeListingPlainText(leiras),
    felszereltseg: felszereltseg.length ? felszereltseg : undefined,
    nyersAdatok: attributeMap,
  };
}

const CARD_BADGE_TOKENS = [
  "AUTOMATA",
  "MANUÁLIS",
  "MANUALIS",
  "ALUFELNI",
  "BLUETOOTH",
  "KLÍMA",
  "KLIMA",
  "TEMPOMAT",
  "NAVIGÁCIÓ",
  "NAVIGACIO",
  "BŐR",
  "XENON",
  "LED",
  "VONÓHOROG",
  "VONOHOROG",
  "GARANCIÁLIS",
  "GARANCIALIS",
  "KEVESET FUTOTT",
  "NEM DOHÁNYZÓ",
  "NEM DOHANYZO",
  "TOLATÓRADAR",
  "TOLATORADAR",
  "TOLATÓKAMERA",
  "TOLATOKAMERA",
  "START-STOP",
  "FULL EXTRA",
  "CARPLAY",
  "ANDROID AUTO",
  "KEYLESS",
  "FŰTHETŐ ÜLÉS",
  "FŰTHETŐ KORMÁNY",
  "SPORTÜLÉS",
  "CENTRÁLZÁR",
  "SZERVOKORMÁNY",
  "ISOFIX",
  "ESP",
  "ABS",
  "USB",
  "360 KAMERA",
  "SÁVTARTÓ",
  "IMMOBILISER",
  "DIGITÁLIS KLÍMA",
  "DIGITALIS KLIMA",
  "GARÁZS",
  "SZERVIZKÖNYV",
  "ÁFÁS",
  "AFAS",
];

function extractBadgesFromText(text) {
  if (!text) return [];
  const hay = normalizeKey(text);
  const found = [];
  for (const token of CARD_BADGE_TOKENS) {
    if (hay.includes(normalizeKey(token))) found.push(token);
  }
  return found;
}

function parseSummaryLine(text) {
  const map = {};
  if (!text) return map;

  const fuelMatch =
    text.match(/Hibrid\s*\([^)]+\)/i) ||
    text.match(/(?:^|[,(]\s*)((?:Elektromos|Diesel|Benzin|LPG|CNG)[^,)]*)/i);
  if (fuelMatch) map.Üzemanyag = cleanText(fuelMatch[0].replace(/^[,(]\s*/, ""));

  const yearMatch = text.match(/\b((?:19|20)\d{2})(?:\/(\d{1,2}))?\b/);
  if (yearMatch) {
    map.Évjárat = yearMatch[2] ? `${yearMatch[1]}/${yearMatch[2]}` : yearMatch[1];
  }

  const kmMatches = [...text.matchAll(/(\d[\d\s.]{1,12})\s*km\b/gi)];
  for (const match of kmMatches) {
    const before = text.slice(Math.max(0, match.index - 8), match.index);
    if (/\bLE,\s*$/i.test(before)) continue;
    map.Futásteljesítmény = `${match[1].trim()} km`;
    break;
  }
  if (!map.Futásteljesítmény) {
    const zero = /\b0\s*[- ]?kmes\b/i.test(text) || /\b0\s*km[- ]?es\b/i.test(text);
    if (zero) map.Futásteljesítmény = "0 km";
  }

  return { ...parseSummarySpecs(text), ...map };
}

export function mergeParsedListing(detail, card) {
  if (!card) return detail;
  const cardParsed = parseListingCard({
    url: card.url ?? detail.url,
    text: card.text,
    title: card.title,
  });
  const mergedAttrs = mergeAttributeMaps(cardParsed.nyersAdatok, detail.nyersAdatok);
  const kmDigits = extractOdometerKm({
    maps: [mergedAttrs],
    texts: [detail.cim, detail.leiras, card?.text, card?.title, card?.kmText, cardParsed.km, detail.km],
  });

  const cardBadges = extractBadgesFromText(card?.text ?? "");
  const felszereltseg = [
    ...new Set([...(detail.felszereltseg ?? []), ...(cardParsed.felszereltseg ?? []), ...cardBadges]),
  ];

  return {
    ...detail,
    cim: detail.cim || cardParsed.cim,
    ar: detail.ar || cardParsed.ar,
    km: kmDigits ? formatKmDisplay(kmDigits) : detail.km || cardParsed.km,
    evjarat: detail.evjarat || cardParsed.evjarat,
    jarmuTipus: detail.jarmuTipus || cardParsed.jarmuTipus,
    telefonszam: detail.telefonszam || cardParsed.telefonszam,
    felszereltseg: felszereltseg.length ? felszereltseg : detail.felszereltseg,
    cardText: card?.text ?? "",
    nyersAdatok: mergedAttrs,
  };
}

export function parseListingCard({ url, text, title }) {
  const source = cleanText(`${title}\n${text}`);
  const summaryMap = parseSummaryLine(text);
  const arMatch = source.match(/([\d\s.]+)\s*Ft/i);
  const kmMatch = source.match(/([\d\s.]+)\s*km/i);
  const yearMatch = source.match(/\b(19|20)\d{2}\b/);
  const phoneMatch = source.match(/(?:\+36|06)[\s\d/-]{7,16}\d/);

  const jarmuTipus = cleanText(title)
    .replace(/^eladó\s+/i, "")
    .replace(/\s*\((19|20)\d{2}.*\)\s*$/, "")
    .trim();

  const kmDigits = extractOdometerKm({
    maps: [summaryMap],
    texts: [text, title, source],
  });

  const felszereltseg = extractBadgesFromText(source);

  return {
    url: cleanText(url),
    jarmuTipus: jarmuTipus || null,
    ar: arMatch ? extractPrice(`${arMatch[1]} Ft`) : null,
    evjarat: yearMatch ? yearMatch[0] : null,
    km: kmDigits ? formatKmDisplay(kmDigits) : kmMatch ? extractKm(`${kmMatch[1]} km`) : null,
    telefonszam: phoneMatch ? cleanText(phoneMatch[0]) : null,
    cim: cleanText(title) || null,
    forras: "lista oldal",
    felszereltseg: felszereltseg.length ? felszereltseg : undefined,
    cardText: cleanText(text) || undefined,
    nyersAdatok: summaryMap,
  };
}

export { shortUrl };
