import { parseListingHtml, cleanText } from "./parse-listing.mjs";
import { findDescriptionInHtml, gyorsnezetUrlForListing } from "./ha-description-parse.mjs";

/** Beltér / Műszaki / Kültér / Multimédia / Egyéb — gyorsnézet szöveges blokkok. */
export function extractFelszereltsegFromHtml(html) {
  const items = [];
  const push = (raw) => {
    const t = cleanText(String(raw ?? "").replace(/^[•·\-–]\s*/, ""));
    if (!t || t.length < 3 || t.length > 80) return;
    if (/^(beltér|műszaki|kültér|multimédia|egyéb|felszereltség|navigáció)$/i.test(t)) return;
    if (!items.includes(t)) items.push(t);
  };

  const body = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/\r\n/g, "\n");

  const sectionRe =
    /(?:^|\n)\s*(Beltér|Műszaki|Kültér|Multimédia\s*\/\s*Navigáció|Multimédia|Egyéb információ|Egyéb)\s*\n([\s\S]*?)(?=\n\s*(?:Beltér|Műszaki|Kültér|Multimédia|Egyéb információ|Egyéb|Leírás|Általános|Hirdetés|Okmányok|Abroncs|Ár,?\s*költségek|Jármű adatok|Motor adatok)\b|$)/gi;
  for (const match of body.matchAll(sectionRe)) {
    for (const line of String(match[2] || "").split("\n")) {
      const t = cleanText(line);
      if (t && !/:$/.test(t) && t.split(/\s+/).length <= 14) push(t);
    }
  }

  return items.slice(0, 300);
}

export function enrichPageFromGyorsnezetHtml(page = {}, html = "") {
  const raw = String(html || page.html || page.gyorsnezetHtml || "");
  if (raw.length <= 400) return page;

  const listingId = String(page.listingId || page.hasznaltauto_hirdetes_id || "").trim();
  const parsed = parseListingHtml(raw, {
    url: page.url || page.adminUrl || gyorsnezetUrlForListing(listingId),
  });
  const felszereltseg = [
    ...new Set([
      ...(Array.isArray(page.felszereltseg) ? page.felszereltseg : []),
      ...(parsed.felszereltseg ?? []),
      ...extractFelszereltsegFromHtml(raw),
    ]),
  ];

  const map =
    page.map && typeof page.map === "object" && Object.keys(page.map).length
      ? page.map
      : parsed.nyersAdatok ?? {};

  const visibleDescription =
    page.visibleDescription ||
    page.description ||
    findDescriptionInHtml(raw) ||
    parsed.leiras ||
    "";

  return {
    ...page,
    html: raw,
    gyorsnezetHtml: raw,
    listingId: listingId || page.listingId,
    url: page.url || page.adminUrl || gyorsnezetUrlForListing(listingId),
    visibleDescription,
    felszereltseg,
    map,
  };
}
