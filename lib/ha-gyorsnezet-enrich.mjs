import { parseListingHtml } from "./parse-listing.mjs";
import { findDescriptionInHtml, gyorsnezetUrlForListing } from "./ha-description-parse.mjs";
import {
  bodyTextFromEquipmentHtml,
  extractFelszereltsegFromHtml,
} from "./ha-equipment-extract.mjs";

export { extractFelszereltsegFromHtml } from "./ha-equipment-extract.mjs";

export function enrichPageFromGyorsnezetHtml(page = {}, html = "") {
  const raw = String(html || page.html || page.gyorsnezetHtml || "");
  if (raw.length <= 400) return page;

  const listingId = String(page.listingId || page.hasznaltauto_hirdetes_id || "").trim();
  const parsed = parseListingHtml(raw, {
    url: page.url || page.adminUrl || gyorsnezetUrlForListing(listingId),
  });
  const extracted = extractFelszereltsegFromHtml(raw);
  const felszereltseg = [
    ...new Set([
      ...(Array.isArray(page.felszereltseg) ? page.felszereltseg : []),
      ...(parsed.felszereltseg ?? []),
      ...extracted,
    ]),
  ];

  const clientMap = page.map && typeof page.map === "object" ? page.map : {};
  const map = { ...(parsed.nyersAdatok ?? {}), ...clientMap };

  const visibleDescription =
    page.visibleDescription ||
    page.description ||
    findDescriptionInHtml(raw) ||
    parsed.leiras ||
    "";

  const bodyText = page.bodyText || bodyTextFromEquipmentHtml(raw).slice(0, 25000);

  return {
    ...page,
    html: raw,
    gyorsnezetHtml: raw,
    listingId: listingId || page.listingId,
    url: page.url || page.adminUrl || gyorsnezetUrlForListing(listingId),
    visibleDescription,
    felszereltseg,
    bodyText,
    map,
  };
}
