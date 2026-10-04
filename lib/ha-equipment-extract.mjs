function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

const SECTION_NAMES =
  "Beltér|Műszaki|Kültér|Multimédia\\s*\\/\\s*Navigáció|Multimédia|Egyéb információ|Egyéb|Felszereltség";
const SECTION_HEADING_RE = new RegExp(`^(${SECTION_NAMES})$`, "i");
const SKIP_ITEM_RE =
  /^(beltér|műszaki|kültér|multimédia|egyéb|felszereltség|navigáció|leírás|nincs)$/i;

const JUNK_LABEL_RE =
  /keresked[eé]s\s+adatai|t[eé]rk[eé]p\s+megjelen|hirdet[eé]sk[oó]d|hirdet[eé]s\s*(id|kod|kód)|kapcsolat|telefonsz[aá]m|^telefon$|^e-?mail$|^fax$|^honlap$|^weboldal$|^c[ií]m$/i;
const JUNK_COMPANY_RE = /\b(kft|bt|zrt|nyrt)\.?\b/i;
const JUNK_CITY_RE =
  /^(szekesfehervar|budapest|debrecen|szeged|pecs|gyor|miskolc|kecskemet|nyiregyhaza|sopron|szombathely|veszprem|eger|szolnok|tatabanya|bekescaba|kaposvar|zalaegerszeg|baja|szentendre|godollo)$/i;

function foldExtra(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Telefon, hirdetés ID, cég, város, UI-címke — nem felszereltség. */
export function isUnwantedImportedExtra(value) {
  const t = cleanText(value);
  if (!t) return true;
  const compact = t.replace(/[\s./()-]/g, "");
  if (/^\d{5,}$/.test(compact)) return true;
  if (/\+36|\(\s*\+?\s*36\s*\)/i.test(t)) return true;
  if (/\d{2,}\/\d{6,}/.test(t)) return true;
  if (/\d+\s*%/.test(t) && /elvihet/i.test(foldExtra(t))) return true;
  const n = foldExtra(t);
  if (JUNK_LABEL_RE.test(n) || JUNK_COMPANY_RE.test(n) || JUNK_CITY_RE.test(n)) return true;
  return false;
}

function stripTags(html) {
  return String(html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitEquipmentTokens(raw) {
  return String(raw ?? "")
    .split(/[\n,;·•|/]+/)
    .map((part) => cleanText(part).replace(/^[•·\-–]\s*/, ""))
    .filter(Boolean);
}

export function bodyTextFromEquipmentHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/\r\n/g, "\n");
}

/** Beltér / Műszaki / Kültér / Multimédia / Egyéb — gyorsnézet HTML + szöveg. */
export function extractFelszereltsegFromHtml(html) {
  const items = [];
  const push = (raw) => {
    for (const token of splitEquipmentTokens(raw)) {
      const t = cleanText(token);
      if (!t || t.length < 2 || t.length > 90) continue;
      if (SECTION_HEADING_RE.test(t)) continue;
      if (SKIP_ITEM_RE.test(t)) continue;
      if (isUnwantedImportedExtra(t)) continue;
      if (/:$/.test(t)) continue;
      if (!items.includes(t)) items.push(t);
    }
  };

  const raw = String(html || "");
  if (!raw) return items;

  for (const re of [
    /class="[^"]*\bextranev\b[^"]*"[^>]*>([^<]{2,90})</gi,
    /class="[^"]*(?:extra-badge|tooltip-badge|feature-badge)[^"]*"[^>]*>([^<]{2,90})</gi,
    /data-(?:extra|feature)="([^"]{2,90})"/gi,
  ]) {
    for (const match of raw.matchAll(re)) push(match[1]);
  }

  for (const match of raw.matchAll(
    new RegExp(
      `<h[1-6][^>]*>\\s*(${SECTION_NAMES})\\s*<\\/h[1-6]>([\\s\\S]*?)(?=<h[1-6][^>]*>|$)`,
      "gi"
    )
  )) {
    const block = match[2] || "";
    for (const li of block.matchAll(/<li[^>]*>([^<]{2,90})<\/li>/gi)) push(li[1]);
    for (const p of block.matchAll(/<p[^>]*>([^<]{2,120})<\/p>/gi)) push(p[1]);
    for (const span of block.matchAll(/class="[^"]*\bextranev\b[^"]*"[^>]*>([^<]{2,90})</gi)) {
      push(span[1]);
    }
  }

  for (const match of raw.matchAll(
    new RegExp(
      `<strong>\\s*(${SECTION_NAMES})\\s*<\\/strong>([\\s\\S]{0,12000}?)(?=<strong>\\s*(?:${SECTION_NAMES})\\s*<\\/strong>|<h[1-6]|Leírás|Általános|Okmányok|Abroncs|$)`,
      "gi"
    )
  )) {
    const block = match[2] || "";
    for (const li of block.matchAll(/<li[^>]*>([^<]{2,90})<\/li>/gi)) push(li[1]);
    for (const p of block.matchAll(/<p[^>]*>([^<]{2,120})<\/p>/gi)) push(p[1]);
    for (const span of block.matchAll(/class="[^"]*\bextranev\b[^"]*"[^>]*>([^<]{2,90})</gi)) {
      push(span[1]);
    }
  }

  for (const match of raw.matchAll(
    new RegExp(
      `<tr[^>]*>[\\s\\S]*?<td[^>]*class="[^"]*pontos[^"]*"[^>]*>\\s*(${SECTION_NAMES})\\s*<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`,
      "gi"
    )
  )) {
    push(stripTags(match[2]));
  }

  for (const match of raw.matchAll(
    /<input[^>]*type="checkbox"[^>]*checked[^>]*(?:value="([^"]{2,90})")?[^>]*>/gi
  )) {
    if (match[1]) push(match[1]);
  }

  const body = bodyTextFromEquipmentHtml(raw);
  const sectionRe = new RegExp(
    `(?:^|\\n)\\s*(${SECTION_NAMES})\\s*\\n([\\s\\S]*?)(?=\\n\\s*(?:${SECTION_NAMES}|Leírás|Általános|Hirdetés|Okmányok|Abroncs|Ár,?\\s*költségek|Jármű adatok|Motor adatok)\\b|$)`,
    "gi"
  );
  for (const match of body.matchAll(sectionRe)) {
    for (const line of String(match[2] || "").split("\n")) {
      const t = cleanText(line);
      if (t && !/:$/.test(t) && t.split(/\s+/).length <= 14) push(t);
    }
  }

  return items.slice(0, 300);
}
