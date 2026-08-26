/**
 * Kompakt autócsempe: kép + cím + ár + év/km (Willhaben-szerű).
 * Használat: főoldal közelben, később minden autós lista.
 */
import { formatListingDisplayTitle } from "./listing-card.js";
import { listingDetailHref } from "./listing-return.js?v=scrollTop1";

export function listingTileTitle(item) {
  const preview = item?.preview ?? {};
  const raw = preview.title || item?.hirdetes_cime || `Hirdetés #${item?.id ?? "?"}`;
  let title = formatListingDisplayTitle(raw) || `Hirdetés #${item?.id ?? "?"}`;
  // Év a meta sorban van — a címből levesszük.
  title = title.replace(/\s*\(\d{4}(?:\/\d{1,2})?\)\s*$/u, "").trim();
  return title || `Hirdetés #${item?.id ?? "?"}`;
}

export function listingTilePrice(item) {
  const price = String(item?.preview?.price ?? "").trim();
  return price || "Ár egyeztetés szerint";
}

/** pl. „2021, 5.000 km” */
export function listingTileMeta(item) {
  const preview = item?.preview ?? {};
  const yearNum = Number(preview.filter?.gyartasi_ev);
  const year =
    Number.isFinite(yearNum) && yearNum > 1900
      ? String(yearNum)
      : (() => {
          const m = String(preview.specLine || "").match(/\b((?:19|20)\d{2})\b/);
          return m ? m[1] : "";
        })();
  const km = String(preview.km || "").trim();
  if (year && km) return `${year}, ${km}`;
  if (year) return year;
  if (km) return km;
  return "";
}

export function slimListingTile(item) {
  const preview = item?.preview ?? {};
  return {
    id: item.id,
    hirdetes_cime: item.hirdetes_cime,
    fo_kep: item.fo_kep,
    updated_at: item.updated_at,
    created_at: item.created_at,
    preview: {
      title: preview.title,
      price: preview.price,
      km: preview.km,
      specLine: preview.specLine,
      imageUrl: preview.imageUrl || item.fo_kep || "",
      filter: {
        gyartasi_ev: preview.filter?.gyartasi_ev ?? null,
      },
    },
  };
}

export function formatListingCountBadge(n) {
  const num = Number(n) || 0;
  if (num <= 0) return "";
  if (num >= 50) return "50+";
  return String(num);
}

/**
 * @param {object} item
 * @param {{ className?: string }} [opts]
 */
export function createListingTileCard(item, { className = "hf-card hf-card--listing" } = {}) {
  const preview = item.preview ?? {};
  const link = document.createElement("a");
  link.className = className;
  link.href = listingDetailHref(item.id);
  link.dataset.listingId = String(item.id);
  link.setAttribute("role", "listitem");

  const title = listingTileTitle(item);
  const price = listingTilePrice(item);
  const meta = listingTileMeta(item);
  const imageUrl = String(preview.imageUrl || item.fo_kep || "").trim();

  const media = document.createElement("span");
  media.className = "hf-card-media";
  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    media.appendChild(img);
    media.setAttribute("role", "img");
    media.setAttribute("aria-label", title);
  }

  const label = document.createElement("span");
  label.className = "hf-card-label";
  label.textContent = title;

  const priceEl = document.createElement("span");
  priceEl.className = "hf-card-price";
  priceEl.textContent = price;

  link.append(media, label, priceEl);

  if (meta) {
    const metaEl = document.createElement("span");
    metaEl.className = "hf-card-meta";
    metaEl.textContent = meta;
    link.appendChild(metaEl);
  }

  return link;
}
