/** HA admin / gyorsnézet → leírás mező (dealer photo import). */

const MAX_LEIRAS = 2000;

const SECTION_END =
  /(?:^|\n)\s*(?:Felszereltség|Általános|Műszaki|Megtalálható|Okmányok|Hirdetés|Beltér|Kültér|Egyéb információ|Autó jellemzői|Jármű adatok|Motor adatok|Ár,?\s*költségek|Abroncs)\b/i;

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeImportedLeiras(raw) {
  let desc = clean(String(raw ?? "").replace(/<[^>]+>/g, " ")).slice(0, MAX_LEIRAS);
  desc = desc.replace(/^le[ií]r[aá]s\s*[:.\-]?\s*/i, "").trim();
  if (!desc || desc.length < 20) return "";
  if (/^le[ií]r[aá]s\b/i.test(desc) && desc.length < 90) return "";
  if (/^leírás$/i.test(desc)) return "";
  if (/megtekinthet[oő]\s+telefonon/i.test(desc) && desc.length < 160) return "";
  return desc;
}

function extractLeirasSectionText(text) {
  const body = String(text || "").replace(/\r\n/g, "\n");
  const m = body.match(
    new RegExp(
      `(?:^|\\n)\\s*Leírás\\s*[:.]?\\s*(?:\\n+|(?=[A-Za-zÁÉÍÓÖŐÚÜŰ0-9]))([\\s\\S]{8,12000}?)(?=${SECTION_END.source}|$)`,
      "i"
    )
  );
  return m ? normalizeImportedLeiras(m[1]) : "";
}

function plainTextFromHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .replace(/\r\n/g, "\n");
}

/** HTML forrás: textarea, .leiras, h2+Leírás, szöveges szekció. */
export function findDescriptionInHtml(html) {
  const raw = String(html || "");

  const textareaRe =
    /<textarea[^>]*(?:name|id)=["'][^"']*leiras[^"']*["'][^>]*>([\s\S]*?)<\/textarea>/gi;
  let m;
  while ((m = textareaRe.exec(raw))) {
    const t = normalizeImportedLeiras(m[1]);
    if (t) return t;
  }

  const anyTextareaRe = /<textarea[^>]*>([\s\S]{20,12000}?)<\/textarea>/gi;
  while ((m = anyTextareaRe.exec(raw))) {
    const t = normalizeImportedLeiras(m[1]);
    if (t) return t;
  }

  const headingRe =
    /<h[1-6][^>]*>\s*Leírás\s*:?\s*<\/h[1-6]>\s*<(?:p|div|span|td)[^>]*>([\s\S]*?)<\/(?:p|div|span|td)>/i;
  m = raw.match(headingRe);
  if (m) {
    const t = normalizeImportedLeiras(m[1]);
    if (t) return t;
  }

  const divRe = /<div[^>]*class=["'][^"']*leiras[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  while ((m = divRe.exec(raw))) {
    const t = normalizeImportedLeiras(m[1]);
    if (t) return t;
  }

  const fromPlain = extractLeirasSectionText(plainTextFromHtml(raw));
  if (fromPlain) return fromPlain;
  return "";
}

export function gyorsnezetUrlForListing(listingId) {
  const id = String(listingId || "").trim();
  return id ? `https://admin.hasznaltauto.hu/gyorsnezet/szemelyauto/${id}` : "";
}

export function pickPageListingIdFromUrl(url) {
  const u = String(url || "");
  return (
    u.match(/[?&]id=(\d{5,12})\b/i)?.[1] ||
    u.match(/\/gyorsnezet\/[^/]+\/(\d{5,12})\b/i)?.[1] ||
    ""
  );
}

function shouldAttachDescription(car, cars, pageUrl) {
  const id = String(car.listingId || "");
  const urlId = pickPageListingIdFromUrl(pageUrl);
  if (cars.length === 1) return true;
  if (urlId && id === urlId) return true;
  return false;
}

export function enrichDealerCarsWithDescriptions(cars, html, { pageUrl = "" } = {}) {
  const pageDesc = findDescriptionInHtml(html);
  if (!pageDesc) return Array.isArray(cars) ? cars : [];

  return (Array.isArray(cars) ? cars : []).map((car) => {
    if (car.visibleDescription || car.description || car.leiras) return car;
    if (!shouldAttachDescription(car, cars, pageUrl)) return car;
    return { ...car, visibleDescription: pageDesc };
  });
}
