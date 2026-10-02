/** Listing kép méretváltozatok (willhaben/HA mintára: thumb / card / full). */

export const IMAGE_SIZE_VARIANTS = {
  full: { maxWidth: 1600, webpQuality: 78, suffix: "" },
  card: { maxWidth: 640, webpQuality: 72, suffix: "_card" },
  thumb: { maxWidth: 240, webpQuality: 68, suffix: "_thumb" },
};

const VARIANT_SUFFIX_RE = /_(thumb|card)(?=\.[a-z0-9]+(?:\?|$))/i;

export function normalizeImageSizeVariant(variant) {
  const v = String(variant || "full").trim().toLowerCase();
  if (v === "thumb" || v === "card" || v === "full") return v;
  return "full";
}

/** path vagy fájlnév: foo_card.webp → foo.webp */
export function stripImageVariantSuffix(pathOrName) {
  return String(pathOrName || "").replace(VARIANT_SUFFIX_RE, "");
}

/** path: listing-images/42/foo.webp + card → …/foo_card.webp */
export function withImageVariantSuffix(pathOrName, variant) {
  const raw = String(pathOrName || "").trim();
  if (!raw) return "";
  const cleaned = stripImageVariantSuffix(raw);
  const kind = normalizeImageSizeVariant(variant);
  if (kind === "full") return cleaned;
  const suffix = IMAGE_SIZE_VARIANTS[kind].suffix;
  return cleaned.replace(/(\.[a-z0-9]+)(\?.*)?$/i, `${suffix}$1$2`);
}

export function isBymyManagedImageUrl(src) {
  const raw = String(src || "").trim();
  if (!raw) return false;
  if (raw.startsWith("/media/img/")) return true;
  if (raw.startsWith("/uploads/listings/")) return true;
  try {
    const u = new URL(raw.startsWith("//") ? `https:${raw}` : raw, "https://bymy.local");
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "img.bymy.hu" || host === "bymy.hu" || host.endsWith(".bymy.hu")) return true;
    if (host.endsWith(".supabase.co") && /\/listing-images\//i.test(u.pathname)) return true;
    if (host.endsWith(".vercel.app") && /\/media\/img\//i.test(u.pathname)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Bymy tárolt kép URL → thumb/card/full változat (konvenciós fájlnév).
 * Más host: változatlan.
 */
export function bymyImageVariantUrl(src, variant = "card") {
  const raw = String(src || "").trim();
  if (!raw || !isBymyManagedImageUrl(raw)) return raw;
  const kind = normalizeImageSizeVariant(variant);
  if (kind === "full") return stripImageVariantSuffix(raw);
  try {
    if (raw.startsWith("/")) {
      return withImageVariantSuffix(raw, kind);
    }
    const u = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    u.pathname = withImageVariantSuffix(u.pathname, kind);
    return u.href;
  } catch {
    return withImageVariantSuffix(raw, kind);
  }
}

/** Teljes (full) URL a thumb/card URL-ből — kliens onerror fallback. */
export function fullImageUrlFromVariant(src) {
  return bymyImageVariantUrl(src, "full") || String(src || "").trim();
}
