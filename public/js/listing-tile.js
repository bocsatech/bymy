/**
 * Kompakt autócsempe: kép + cím + alcím + ár + év/km/LE (autó oldal hierarchia).
 * Használat: főoldal közelben / kedvencek — a csempe szélesség változatlan.
 */
import { formatListingDisplayTitle } from "./listing-card.js";
import { listingDetailHref } from "./listing-return.js?v=scrollTop1";

const ICON_YEAR = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const ICON_KM = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 18 12 6l8 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 18h9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const ICON_POWER = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="13" r="7" stroke="currentColor" stroke-width="1.6"/><path d="M12 13 16 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 6v1.5M5.5 10.5 6.6 11.2M18.5 10.5 17.4 11.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

export function listingTileTitle(item) {
  const preview = item?.preview ?? {};
  const raw = preview.title || item?.hirdetes_cime || `Hirdetés #${item?.id ?? "?"}`;
  let title = formatListingDisplayTitle(raw) || `Hirdetés #${item?.id ?? "?"}`;
  // Év a meta sorban van — a címből levesszük.
  title = title.replace(/\s*\(\d{4}(?:\/\d{1,2})?\)\s*$/u, "").trim();
  title = softTitleCase(title);
  return title || `Hirdetés #${item?.id ?? "?"}`;
}

/** Ha a forrás FULL CAPS, olvasható címformára. */
function softTitleCase(value) {
  const s = String(value ?? "").trim();
  if (!s) return s;
  const letters = [...s].filter((ch) => /\p{L}/u.test(ch));
  if (!letters.length) return s;
  const upper = letters.filter((ch) => ch === ch.toLocaleUpperCase("hu-HU") && ch !== ch.toLocaleLowerCase("hu-HU")).length;
  if (upper / letters.length < 0.7) return s;
  return s
    .toLocaleLowerCase("hu-HU")
    .replace(/(^|[\s\-_/])(\p{L})/gu, (_, sep, ch) => `${sep}${ch.toLocaleUpperCase("hu-HU")}`);
}

export function listingTilePrice(item) {
  const price = String(item?.preview?.price ?? "").trim();
  return price || "Ár egyeztetés szerint";
}

function pickFilter(preview, form, key) {
  return String(preview?.filter?.[key] ?? form?.[key] ?? "").trim();
}

export function listingTileSubtitle(item) {
  const preview = item?.preview ?? {};
  const form = item?.form ?? {};
  const fuel = pickFilter(preview, form, "uzemanyag");
  const gear = pickFilter(preview, form, "sebessegvalto");
  // Kompakt csempén rövidebb váltófelirat — ne törje szét a sort.
  const gearShort = gear
    .replace(/^Fokozatmentes\s+automata$/iu, "Automata")
    .replace(/^Fokozatmentes$/iu, "Automata");
  return [fuel, gearShort].filter(Boolean).join(", ");
}

export function listingTileYear(item) {
  const preview = item?.preview ?? {};
  const yearNum = Number(preview.filter?.gyartasi_ev);
  if (Number.isFinite(yearNum) && yearNum > 1900) return String(yearNum);
  const m = String(preview.specLine || "").match(/\b((?:19|20)\d{2})\b/);
  return m ? m[1] : "";
}

export function listingTileKm(item) {
  return String(item?.preview?.km || "").trim();
}

export function listingTilePower(item) {
  const preview = item?.preview ?? {};
  const form = item?.form ?? {};
  const le = Number(String(preview.filter?.teljesitmeny_le ?? form.teljesitmeny_le ?? "").replace(/\D/g, ""));
  if (Number.isFinite(le) && le > 0) return `${le} LE`;
  return "";
}

/** pl. „2021, 5.000 km” — legacy szöveges meta */
export function listingTileMeta(item) {
  const year = listingTileYear(item);
  const km = listingTileKm(item);
  if (year && km) return `${year}, ${km}`;
  if (year) return year;
  if (km) return km;
  return "";
}

export function slimListingTile(item) {
  const preview = item?.preview ?? {};
  const form = item?.form ?? {};
  return {
    id: item.id,
    hirdetes_cime: item.hirdetes_cime,
    fo_kep: item.fo_kep,
    updated_at: item.updated_at,
    created_at: item.created_at,
    form: {
      uzemanyag: form.uzemanyag ?? null,
      sebessegvalto: form.sebessegvalto ?? null,
      teljesitmeny_le: form.teljesitmeny_le ?? null,
    },
    preview: {
      title: preview.title,
      price: preview.price,
      km: preview.km,
      specLine: preview.specLine,
      imageUrl: preview.imageUrl || item.fo_kep || "",
      filter: {
        gyartasi_ev: preview.filter?.gyartasi_ev ?? null,
        uzemanyag: preview.filter?.uzemanyag ?? form.uzemanyag ?? null,
        sebessegvalto: preview.filter?.sebessegvalto ?? form.sebessegvalto ?? null,
        teljesitmeny_le: preview.filter?.teljesitmeny_le ?? form.teljesitmeny_le ?? null,
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

function appendSpec(row, iconSvg, text, spec) {
  if (!text) return;
  const el = document.createElement("span");
  el.className = "hf-card-spec";
  el.dataset.spec = spec;
  el.innerHTML = `${iconSvg}<span></span>`;
  el.querySelector("span").textContent = text;
  row.appendChild(el);
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
  const subtitle = listingTileSubtitle(item);
  const price = listingTilePrice(item);
  const year = listingTileYear(item);
  const km = listingTileKm(item);
  const power = listingTilePower(item);
  const imageUrl = String(preview.imageUrl || item.fo_kep || "").trim();

  const media = document.createElement("span");
  media.className = "hf-card-media";
  if (imageUrl) {
    media.style.backgroundImage = `url(${JSON.stringify(imageUrl)})`;
    media.style.backgroundSize = "cover";
    media.style.backgroundPosition = "center center";
    media.style.backgroundRepeat = "no-repeat";
    media.setAttribute("role", "img");
    media.setAttribute("aria-label", title);
  }

  const label = document.createElement("span");
  label.className = "hf-card-label";
  label.textContent = title;

  link.append(media, label);

  const sub = document.createElement("span");
  sub.className = "hf-card-sub";
  sub.textContent = subtitle || "\u00a0";
  link.appendChild(sub);

  const priceEl = document.createElement("span");
  priceEl.className = "hf-card-price";
  priceEl.textContent = price;
  link.appendChild(priceEl);

  const specs = document.createElement("span");
  specs.className = "hf-card-specs";
  const row = document.createElement("span");
  row.className = "hf-card-specs-row";
  appendSpec(row, ICON_YEAR, year, "year");
  appendSpec(row, ICON_KM, km, "km");
  appendSpec(row, ICON_POWER, power, "power");
  if (row.childElementCount) {
    specs.appendChild(row);
    link.appendChild(specs);
  }

  return link;
}
