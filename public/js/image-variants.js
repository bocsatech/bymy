/** Kliens: bymy képvariáns URL + onerror fallback fullra + srcset. */

const VARIANT_SUFFIX_RE = /_(thumb|card)(?=\.[a-z0-9]+(?:\?|$))/i;

export function stripImageVariantSuffix(pathOrName) {
  return String(pathOrName || "").replace(VARIANT_SUFFIX_RE, "");
}

function withVariantSuffix(pathOrName, variant) {
  const cleaned = stripImageVariantSuffix(pathOrName);
  if (variant === "full" || !variant) return cleaned;
  const suffix = variant === "thumb" ? "_thumb" : "_card";
  return cleaned.replace(/(\.[a-z0-9]+)(\?.*)?$/i, `${suffix}$1$2`);
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

function rewriteHaSize(src, size) {
  try {
    const u = new URL(src.startsWith("//") ? `https:${src}` : src, window.location.origin);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "hasznaltautocdn.com" && !host.endsWith(".hasznaltautocdn.com")) return "";
    const m = u.pathname.match(/\/(\d{5,12})\/(\d{5,12})\.(jpe?g|png|webp)$/i);
    if (m) {
      const ext = m[3].toLowerCase().replace("jpeg", "jpg");
      return `https://img.hasznaltautocdn.com/${size}/${m[1]}/${m[2]}.${ext}`;
    }
    if (/\/\d{2,4}x\d{2,4}\//i.test(u.pathname)) {
      u.pathname = u.pathname.replace(/\/\d{2,4}x\d{2,4}\//i, `/${size}/`);
      u.search = "";
      return u.href;
    }
  } catch {
    /* ignore */
  }
  return "";
}

function isBymyManagedUrl(src) {
  const raw = String(src || "").trim();
  if (!raw) return false;
  if (raw.startsWith("/media/img/") || raw.startsWith("/uploads/listings/")) return true;
  try {
    const u = new URL(raw.startsWith("//") ? `https:${raw}` : raw, window.location.origin);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    return host === "img.bymy.hu" || host === "bymy.hu" || host.endsWith(".bymy.hu");
  } catch {
    return false;
  }
}

/** Lista-kártya: HA CDN HQ → 640x480; bymy URL-t a szerver már átírja. */
export function listCardImageUrl(src) {
  const raw = String(src ?? "").trim();
  if (!raw) return "";
  const list = rewriteHaSize(raw, "640x480");
  if (list) return list;
  return raw;
}

/**
 * thumb / card / full URL-ek a srcset-hez.
 * @returns {{ thumb: string, card: string, full: string }}
 */
export function listingImageVariantUrls(src) {
  const raw = String(src ?? "").trim();
  const empty = { thumb: "", card: "", full: "" };
  if (!raw) return empty;

  const haCard = rewriteHaSize(raw, "640x480");
  if (haCard) {
    return {
      thumb: rewriteHaSize(raw, "640x480") || haCard,
      card: haCard,
      full: rewriteHaSize(raw, "2048x1536") || raw,
    };
  }

  if (isBymyManagedUrl(raw)) {
    try {
      if (raw.startsWith("/")) {
        return {
          thumb: withVariantSuffix(raw, "thumb"),
          card: withVariantSuffix(raw, "card"),
          full: withVariantSuffix(raw, "full"),
        };
      }
      const u = new URL(raw.startsWith("//") ? `https:${raw}` : raw, window.location.origin);
      const basePath = stripImageVariantSuffix(u.pathname);
      const mk = (variant) => {
        const n = new URL(u.href);
        n.pathname = withVariantSuffix(basePath, variant);
        return n.href;
      };
      return { thumb: mk("thumb"), card: mk("card"), full: mk("full") };
    } catch {
      return { thumb: raw, card: raw, full: raw };
    }
  }

  const card = listCardImageUrl(raw) || raw;
  return { thumb: card, card, full: raw };
}

/** srcset: thumb 240w, card 640w, full 1600w (ahol van). */
export function listingImageSrcset(src) {
  const v = listingImageVariantUrls(src);
  if (!v.card && !v.thumb) return "";
  const parts = [];
  if (v.thumb) parts.push(`${v.thumb} 240w`);
  if (v.card && v.card !== v.thumb) parts.push(`${v.card} 640w`);
  else if (v.card) parts.push(`${v.card} 640w`);
  if (v.full && v.full !== v.card) parts.push(`${v.full} 1600w`);
  return parts.join(", ");
}

/** Ha a thumb/card 404, visszaáll full URL-re (backfill előtt). */
export function bindListingImgFallback(img) {
  if (!(img instanceof HTMLImageElement)) return img;
  const onErr = () => {
    img.removeEventListener("error", onErr);
    const next = fullImageUrlFromVariant(img.currentSrc || img.src);
    if (next && next !== img.src) {
      img.removeAttribute("srcset");
      img.src = next;
    }
  };
  img.addEventListener("error", onErr);
  return img;
}

export function applyListingImgSrcset(img, src, { sizes = "(max-width: 640px) 50vw, 240px" } = {}) {
  if (!(img instanceof HTMLImageElement)) return img;
  const v = listingImageVariantUrls(src);
  const srcset = listingImageSrcset(src);
  img.src = v.thumb || v.card || listCardImageUrl(src) || src;
  if (srcset) {
    img.srcset = srcset;
    img.sizes = sizes;
  }
  bindListingImgFallback(img);
  return img;
}

/** HTML img attribute — string template-ekhez. */
export function listingImgFallbackAttr() {
  return `onerror="this.onerror=null;try{this.removeAttribute('srcset');var u=new URL(this.src,location.href);u.pathname=u.pathname.replace(/_(thumb|card)(?=\\.[a-z0-9]+$)/i,'');this.src=u.href;}catch(e){}"`;
}

/** srcset + sizes HTML attribute string. */
export function listingImgSrcsetAttrs(src, { sizes = "(max-width: 768px) 100vw, 640px" } = {}) {
  const srcset = listingImageSrcset(src);
  if (!srcset) return "";
  return `srcset="${srcset.replace(/"/g, "&quot;")}" sizes="${sizes.replace(/"/g, "&quot;")}"`;
}
