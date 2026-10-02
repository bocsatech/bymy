/** Kliens: bymy képvariáns URL + onerror fallback fullra. */

const VARIANT_SUFFIX_RE = /_(thumb|card)(?=\.[a-z0-9]+(?:\?|$))/i;

export function stripImageVariantSuffix(pathOrName) {
  return String(pathOrName || "").replace(VARIANT_SUFFIX_RE, "");
}

export function fullImageUrlFromVariant(src) {
  const raw = String(src || "").trim();
  if (!raw) return "";
  try {
    if (raw.startsWith("/")) return stripImageVariantSuffix(raw);
    const u = new URL(raw.startsWith("//") ? `https:${raw}` : raw, window.location.origin);
    u.pathname = stripImageVariantSuffix(u.pathname);
    return u.href;
  } catch {
    return stripImageVariantSuffix(raw);
  }
}

/** HA CDN HQ → 640x480; bymy URL-t a szerver már átírja. */
export function listCardImageUrl(src) {
  const raw = String(src ?? "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw.startsWith("//") ? `https:${raw}` : raw, window.location.origin);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "hasznaltautocdn.com" || host.endsWith(".hasznaltautocdn.com")) {
      const m = u.pathname.match(/\/(\d{5,12})\/(\d{5,12})\.(jpe?g|png|webp)$/i);
      if (m) {
        const ext = m[3].toLowerCase().replace("jpeg", "jpg");
        return `https://img.hasznaltautocdn.com/640x480/${m[1]}/${m[2]}.${ext}`;
      }
      if (/\/\d{2,4}x\d{2,4}\//i.test(u.pathname)) {
        u.pathname = u.pathname.replace(/\/\d{2,4}x\d{2,4}\//i, "/640x480/");
        u.search = "";
        return u.href;
      }
    }
  } catch {
    /* keep raw */
  }
  return raw;
}

/** Ha a thumb/card 404, visszaáll full URL-re (backfill előtt). */
export function bindListingImgFallback(img) {
  if (!(img instanceof HTMLImageElement)) return img;
  const onErr = () => {
    img.removeEventListener("error", onErr);
    const next = fullImageUrlFromVariant(img.currentSrc || img.src);
    if (next && next !== img.src) img.src = next;
  };
  img.addEventListener("error", onErr);
  return img;
}

/** HTML img attribute — string template-ekhez. */
export function listingImgFallbackAttr() {
  return `onerror="this.onerror=null;try{var u=new URL(this.src,location.href);u.pathname=u.pathname.replace(/_(thumb|card)(?=\\.[a-z0-9]+$)/i,'');this.src=u.href;}catch(e){}"`;
}
