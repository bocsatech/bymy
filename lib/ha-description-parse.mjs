/** HA admin / gyorsnézet → leírás mező (dealer photo import). */

const MAX_LEIRAS = 2000;

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

function plainTextFromHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .replace(/\r\n/g, "\n");
}

/** HTML forrás: textarea, .leiras, „Leírás” szekció. */
export function findDescriptionInHtml(html) {
  const raw = String(html || "");

  const textareaRe =
    /<textarea[^>]*(?:name|id)=["'][^"']*leiras[^"']*["'][^>]*>([\s\S]*?)<\/textarea>/gi;
  let m;
  while ((m = textareaRe.exec(raw))) {
    const t = normalizeImportedLeiras(m[1]);
    if (t) return t;
  }

  const divRe = /<div[^>]*class=["'][^"']*leiras[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  while ((m = divRe.exec(raw))) {
    const t = normalizeImportedLeiras(m[1]);
    if (t) return t;
  }

  const body = plainTextFromHtml(raw);
  const section = body.match(
    /(?:^|\n)\s*Leírás\s*\n+([\s\S]{8,12000}?)(?=\n\s*(?:Felszereltség|Általános|Műszaki|Megtalálható|Okmányok|Hirdetés|Beltér|Kültér|Egyéb információ)\b|$)/i
  );
  if (section) {
    const t = normalizeImportedLeiras(section[1]);
    if (t) return t;
  }
  return "";
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
