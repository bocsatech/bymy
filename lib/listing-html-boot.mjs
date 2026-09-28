/**
 * Hirdetés HTML: listing detail beágyazása az első festéshez (Jófogás-szerű SSR).
 */

function escHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(value) {
  return escHtml(value).replace(/'/g, "&#39;");
}

/** JSON <script> tartalom — ne törje a HTML-t. */
export function listingBootJson(listing) {
  return JSON.stringify(listing ?? null).replace(/</g, "\\u003c");
}

/**
 * Beilleszti a listing boot JSON-t + azonnali skeleton festést a <!--BYMY_LISTING_BOOT--> helyére.
 * Ha nincs marker, a </main> után szúr be.
 */
export function injectListingBootIntoHtml(html, listing) {
  if (!html || !listing?.detail) return html;
  const d = listing.detail;
  const title = String(d.title || "Hirdetés").trim() || "Hirdetés";
  const price = String(d.price || "").trim();
  const img = String(
    (Array.isArray(d.images) && d.images[0]) || d.imageUrl || listing.fo_kep || ""
  ).trim();
  const json = listingBootJson(listing);

  const boot = `<!--BYMY_LISTING_BOOT-->
<script type="application/json" id="bymy-listing-boot">${json}</script>
<script>
(function () {
  try {
    var el = document.getElementById("bymy-listing-boot");
    if (!el) return;
    var listing = JSON.parse(el.textContent || "null");
    if (!listing || !listing.detail) return;
    window.__BYMY_LISTING_BOOT__ = listing;
    var d = listing.detail;
    document.title = (d.title || "Hirdetés") + " — Bymy";
    var root = document.getElementById("hd-root");
    if (!root) return;
    var img = "";
    if (d.images && d.images.length) img = String(d.images[0] || "");
    if (!img) img = String(d.imageUrl || listing.fo_kep || "");
    var title = String(d.title || "Hirdetés");
    var price = String(d.price || "");
    function esc(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }
    root.innerHTML =
      '<div class="hd-boot-shell" data-hd-boot-shell>' +
      (img
        ? '<div class="hd-boot-img-wrap"><img class="hd-boot-img" src="' +
          esc(img) +
          '" alt="" fetchpriority="high" decoding="async" /></div>'
        : "") +
      '<div class="hd-boot-meta"><p class="hd-boot-title">' +
      esc(title) +
      "</p>" +
      (price ? '<p class="hd-boot-price">' + esc(price) + "</p>" : "") +
      '<p class="hd-boot-hint">Részletek betöltése…</p></div></div>';
  } catch (e) {}
})();
</script>`;

  let next = String(html);
  next = next.replace(/<title>[^<]*<\/title>/i, `<title>${escHtml(title)} — Bymy</title>`);
  if (next.includes("<!--BYMY_LISTING_BOOT-->")) {
    next = next.replace("<!--BYMY_LISTING_BOOT-->", boot);
  } else if (/<\/main>/i.test(next)) {
    next = next.replace(/<\/main>/i, `</main>\n${boot}`);
  } else {
    next = `${next}\n${boot}`;
  }

  // Noscript / crawler fallback text
  if (img || title) {
    const noscript = `<noscript><article><h1>${escHtml(title)}</h1>${
      price ? `<p>${escHtml(price)}</p>` : ""
    }${img ? `<img src="${escAttr(img)}" alt="" />` : ""}</article></noscript>`;
    if (!/<\/noscript>/i.test(next)) {
      next = next.replace(/<main[^>]*>/i, (m) => `${m}\n${noscript}`);
    }
  }
  return next;
}
