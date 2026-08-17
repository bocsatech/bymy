import { cellsToFormData } from "./form-field-catalog.mjs";

const BADGE_ALIASES = [
  ["automata", "AUTOMATA"],
  ["manuális", "MANUÁLIS"],
  ["manualis", "MANUÁLIS"],
  ["bluetooth", "BLUETOOTH"],
  ["tempomat", "TEMPOMAT"],
  ["klíma", "KLÍMA"],
  ["klima", "KLÍMA"],
  ["alufelni", "ALUFELNI"],
  ["könnyűfém", "ALUFELNI"],
  ["xenon", "XENON"],
  ["led", "LED"],
  ["navig", "NAVIGÁCIÓ"],
  ["bőr", "BŐR"],
  ["vonóhorog", "VONÓHOROG"],
  ["garanci", "GARANCIÁLIS"],
  ["esp", "ESP"],
  ["abs", "ABS"],
  ["asr", "ASR"],
  ["centrál", "CENTRÁLZÁR"],
  ["szervokorm", "SZERVOKORMÁNY"],
  ["isofix", "ISOFIX"],
  ["start-stop", "START-STOP"],
  ["full extra", "FULL EXTRA"],
];

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/** Használtautó.hu fejléc / Belépés stb. — ne jelenjen meg hirdetés szövegként. */
export function sanitizeListingPlainText(value) {
  const raw = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ");
  const lines = raw
    .split(/\n+/)
    .map((line) => stripInlineListingChrome(line.replace(/\s+/g, " ").trim()))
    .filter(Boolean)
    .filter((line) => !isListingSiteChromeLine(line));
  const text = lines.join("\n").trim();
  if (!text || isListingSiteChromeLine(text.replace(/\n+/g, " "))) return "";
  return text;
}

/** Inline „Használtautó.hu” / „Belépés” tokenek eltávolítása egy sorból. */
export function stripInlineListingChrome(line) {
  // Ékezetes + ASCII (hasznaltauto / belepes) — a scrape gyakran mindkettőt hozza
  return String(line ?? "")
    .replace(/haszn[aá]ltaut[oó]\.?\s*hu/gi, " ")
    .replace(/\bhaszn[aá]ltaut[oó]\b/gi, " ")
    .replace(/\bbel[eé]p[eé]s\b/gi, " ")
    .replace(/\bregisztr[aá]ci[oó]\b/gi, " ")
    .replace(/\badd\s*el\s*autod(\.hu)?\b/gi, " ")
    .replace(/[|·•]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s|·•\-–—]+|[\s|·•\-–—]+$/g, "")
    .trim();
}

/** Gyártmány / modell / típus: ha site-chrome, ne legyen preview cím. */
export function sanitizeListingFieldValue(value) {
  const cleaned = sanitizeListingPlainText(value).replace(/\s+/g, " ").trim();
  if (!cleaned || isListingSiteChromeLine(cleaned)) return "";
  return cleaned;
}

export function isListingSiteChromeLine(line) {
  const n = String(line ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!n) return true;
  // Ha a sor csak site-chrome szavakból áll (bármilyen hossz), dobjuk
  const onlyChrome = n
    .replace(/hasznaltauto(\.hu)?/g, " ")
    .replace(/\bbelepes\b/g, " ")
    .replace(/\bregisztracio\b/g, " ")
    .replace(/\badd el autod(\.hu)?\b/g, " ")
    .replace(/[|·•\-–—./:!]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!onlyChrome) return true;
  // Rövid sor, amiben hasznaltauto / belépés szerepel → fejléc szemét
  if (n.includes("hasznaltauto") && n.length <= 64) return true;
  if (/\bbelepes\b/.test(n) && n.length <= 24) return true;
  if (/^belepes([.!|]*)?$/.test(n)) return true;
  if (/^regisztracio([.!|]*)?$/.test(n)) return true;
  if (/^add el autod(\.hu)?$/.test(n)) return true;
  return false;
}

/** Megjelenítéshez: „Eladó MERCEDES…” → „MERCEDES…” + site chrome nélkül */
export function formatListingDisplayTitle(value) {
  const cleaned = sanitizeListingPlainText(String(value ?? "").replace(/^eladó\s+/i, ""));
  return cleaned.replace(/\s+/g, " ").trim();
}

function formatPriceFt(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return `${Number(digits).toLocaleString("hu-HU")} Ft`;
}

function formatKm(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return `${Number(digits).toLocaleString("hu-HU")} km`;
}

function shortBadgeLabel(name) {
  const hay = cleanText(name).toLowerCase();
  for (const [needle, token] of BADGE_ALIASES) {
    if (hay.includes(needle)) return token;
  }
  const word = cleanText(name).split(/[\s,/(-]+/).find(Boolean) ?? "";
  return word.slice(0, 14).toUpperCase();
}

function collectBadges(form) {
  const found = new Set();
  const hay = cleanText(
    [form.leiras, form.tipus, form.sebessegvalto, form.kivitel].filter(Boolean).join(" ")
  ).toLowerCase();

  for (const [needle, token] of BADGE_ALIASES) {
    if (hay.includes(needle)) found.add(token);
  }

  for (const item of form.felszereltseg ?? []) {
    const token = shortBadgeLabel(item);
    if (token.length >= 2) found.add(token);
  }

  if (form.sebessegvalto && /automata|fokozatmentes|cvt/i.test(form.sebessegvalto)) {
    found.add("AUTOMATA");
  }

  return [...found].slice(0, 10);
}

/** Gyártmány + modell (+ év) — a kártyacím ebből jön, ne a régi rejtett hirdetéscímből. */
export function parsePhotoUrlList(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
      }
    } catch {
      /* newline list */
    }
  }
  return raw
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function collectPreviewImageUrls(data = {}, meta = {}) {
  const seen = new Set();
  const urls = [];
  for (const raw of [meta.fo_kep, data.fo_kep, ...parsePhotoUrlList(data.fotok)]) {
    const url = String(raw ?? "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

export function composeVehicleTitle(data = {}) {
  const gyartmany = sanitizeListingFieldValue(data.gyartmany);
  const modell = sanitizeListingFieldValue(data.modell);
  const parts = [gyartmany, modell].filter(Boolean).join(" ");
  if (!parts) return "";
  const year = String(data.gyartasi_ev ?? "").trim();
  return year ? `${parts} (${year})` : parts;
}

export function buildListingPreview(form, meta = {}) {
  const data = form ?? {};
  const year = data.gyartasi_ev;
  const month = data.gyartasi_honap;
  const yearLabel = year ? (month ? `${year}/${month}` : String(year)) : "";

  const specParts = [];
  if (data.uzemanyag) specParts.push(data.uzemanyag);
  if (yearLabel) specParts.push(yearLabel);
  if (data.hengerurtartalom) {
    specParts.push(`${Number(data.hengerurtartalom).toLocaleString("hu-HU")} cm³`);
  }
  if (data.teljesitmeny_kw) {
    let power = `${data.teljesitmeny_kw} kW`;
    if (data.teljesitmeny_le) power += `, ${data.teljesitmeny_le} LE`;
    specParts.push(power);
  } else if (data.teljesitmeny_le) {
    specParts.push(`${data.teljesitmeny_le} LE`);
  }
  const km = formatKm(data.km);
  if (km) specParts.push(km);

  const gyartmany = sanitizeListingFieldValue(data.gyartmany);
  const modell = sanitizeListingFieldValue(data.modell);
  const tipus = sanitizeListingFieldValue(data.tipus);
  const telepules = sanitizeListingFieldValue(data.telepules);
  const megye = sanitizeListingFieldValue(data.megye);
  const location = [telepules, megye].filter(Boolean).join(", ");
  const fromVehicle = formatListingDisplayTitle(composeVehicleTitle(data));
  const title =
    fromVehicle ||
    formatListingDisplayTitle(data.hirdetes_cime) ||
    formatListingDisplayTitle(meta.hirdetes_cime) ||
    formatListingDisplayTitle(tipus) ||
    `Hirdetés #${meta.id ?? "?"}`;
  const photoUrls = collectPreviewImageUrls(data, meta);

  return {
    title,
    imageUrl: photoUrls[0] || "",
    imageUrls: photoUrls,
    price: formatPriceFt(data.vetelar || data.akcios_ar),
    priceNum: Number(String(data.vetelar || data.akcios_ar || "").replace(/\D/g, "")) || null,
    specLine: specParts.join(", "),
    km,
    kmNum: Number(String(data.km ?? "").replace(/\D/g, "")) || null,
    leiras: sanitizeListingPlainText(data.leiras).slice(0, 240),
    hirdeteskod: meta.hasznaltauto_hirdetes_id || data.hasznaltauto_hirdetes_id || data.belso_azonosito || "",
    location,
    badges: collectBadges(data),
    status: meta.status ?? "mentett",
    forras_url: meta.forras_url || data.forras_url || "",
    filter: {
      gyartmany,
      modell,
      kivitel: cleanText(data.kivitel),
      uzemanyag: cleanText(data.uzemanyag),
      gyartasi_ev: Number(data.gyartasi_ev) || null,
      hengerurtartalom: Number(String(data.hengerurtartalom ?? "").replace(/\D/g, "")) || null,
      teljesitmeny_le:
        Number(String(data.teljesitmeny_le ?? "").replace(/\D/g, "")) || null,
      sebessegvalto: cleanText(data.sebessegvalto),
      hajtas: cleanText(data.hajtas),
      allapot: cleanText(data.allapot),
      ajtok: cleanText(data.ajtok_szama),
      ulesek: cleanText(data.ulesek_szama),
      tipus,
      telepules,
      hirdetes_vertical: cleanText(data.hirdetes_vertical),
      hirdetes_alkategoria: cleanText(data.hirdetes_alkategoria),
    },
  };
}

export function buildPreviewFromCells(cells, meta = {}) {
  return buildListingPreview(cellsToFormData(cells ?? []), meta);
}
