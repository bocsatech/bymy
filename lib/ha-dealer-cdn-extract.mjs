/**
 * Kereskedői lista: a thumb CDN path már tartalmazza a hirdetés- és kép-ID-t.
 * Példa: .../118x88/23505596/28800111.jpg → HQ 2048x1536 ugyanazokkal az ID-kkel.
 */

export const HA_CDN_HQ = "2048x1536";

const CDN_RE =
  /(?:https?:)?\/\/(?:img\.)?hasznaltautocdn\.com\/(?:\d{2,4}x\d{2,4}\/)?(\d{5,12})\/(\d{5,12})\.(jpe?g|png|webp)/gi;

/**
 * @param {string} html
 * @returns {{ listingId: string, imageId: string, visibleImage: string, photoOnly: true }[]}
 */
export function extractDealerCarsFromHtml(html) {
  const raw = String(html || "");
  const byId = new Map();
  CDN_RE.lastIndex = 0;
  let m;
  while ((m = CDN_RE.exec(raw))) {
    const listingId = m[1];
    const imageId = m[2];
    const ext = String(m[3] || "jpg").toLowerCase().replace("jpeg", "jpg");
    if (!listingId || !imageId) continue;
    if (byId.has(listingId)) continue; // első (lista-thumb) kép
    byId.set(listingId, {
      listingId,
      imageId,
      url: `https://admin.hasznaltauto.hu/hirdetesfeladas/szemelyauto?id=${listingId}`,
      adminUrl: `https://admin.hasznaltauto.hu/hirdetesfeladas/szemelyauto?id=${listingId}`,
      publicUrl: `https://www.hasznaltauto.hu/szemelyauto/x/x-${listingId}`,
      visibleImage: `https://img.hasznaltautocdn.com/${HA_CDN_HQ}/${listingId}/${imageId}.${ext}`,
      photoOnly: true,
    });
  }
  return [...byId.values()];
}

/**
 * Élő dokumentumból: HTML + img src/srcset/data-* attribútumok.
 * @param {Document} doc
 */
export function extractDealerCarsFromDocument(doc) {
  if (!doc) return [];
  const chunks = [String(doc.documentElement?.outerHTML || doc.body?.innerHTML || "")];
  try {
    for (const img of doc.querySelectorAll("img")) {
      for (const attr of ["src", "currentSrc", "data-src", "data-lazy", "data-original", "data-full", "srcset"]) {
        const v = img.getAttribute?.(attr) || img[attr] || "";
        if (v) chunks.push(String(v));
      }
    }
  } catch {
  }
  return extractDealerCarsFromHtml(chunks.join("\n"));
}
