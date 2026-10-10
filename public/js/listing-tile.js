import { formatListingDisplayTitle } from "./listing-card.js?v=3e8a4a3fe2";
import { listingDetailHref } from "./listing-return.js?v=1911f0cb28";
import { createListingFeaturedUnderPhotoStrip } from "./listing-featured-decor.js?v=e831c3517c";
import { listingShowsKiemeltDecor, promoTopAjanlatActive } from "./listing-promo.js?v=a2c84c124b";
import { listCardImageUrl, applyListingImgSrcset } from "./image-variants.js?v=82833209fb";

export { listCardImageUrl } from "./image-variants.js?v=82833209fb";

const ICON_YEAR = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const ICON_KM = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 18 12 6l8 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 18h9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const ICON_POWER = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="13" r="7" stroke="currentColor" stroke-width="1.6"/><path d="M12 13 16 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 6v1.5M5.5 10.5 6.6 11.2M18.5 10.5 17.4 11.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

function isImportStubTitle(value) {
  return /importált autó\s*\(\d{5,}\)/i.test(String(value ?? "").trim());
}

function looksLikeListMetaTitle(value) {
  const n = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!n) return true;
  if (/\bkepkezeles\b/.test(n)) return true;
  if (/\bcimlapra\b/.test(n)) return true;
  if (/^keretes$/.test(n)) return true;
  if (/^(19|20)\d{2}\/\d{1,2}\b/.test(n)) return true;
  if (/\(\d{5,}\)\s*$/.test(n) && /^(19|20)\d{2}/.test(n)) return true;
  if (/^(benzin|dizel|elektromos|hibrid)(\/|\s|,|$)/.test(n) && n.length <= 40) return true;
  return false;
}

export function listingTileTitle(item) {
  const preview = item?.preview ?? {};
  const filter = preview.filter ?? {};
  const brand = String(filter.gyartmany || item?.form?.gyartmany || "").trim();
  const model = String(filter.modell || item?.form?.modell || "").trim();
  const tipus = String(filter.tipus || item?.form?.tipus || "").trim();
  const fromBrand = [brand, model, tipus]
    .filter((part) => part && !looksLikeListMetaTitle(part))
    .join(" ");
  const candidates = [
    preview.title,
    fromBrand,
    item?.hirdetes_cime,
    item?.form?.hirdetes_cime,
    `Hirdetés #${item?.id ?? "?"}`,
  ];
  let title = "";
  for (const raw of candidates) {
    if (looksLikeListMetaTitle(raw) || isImportStubTitle(raw)) continue;
    title = formatListingDisplayTitle(raw);
    if (title && !looksLikeListMetaTitle(title)) break;
    title = "";
  }
  title = title.replace(/\s*\(\d{4}(?:\/\d{1,2})?\)\s*$/u, "").trim();
  title = softTitleCase(title);
  return title || `Hirdetés #${item?.id ?? "?"}`;
}

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
  if (isAllasListing(item)) {
    const form = item?.form ?? {};
    if (String(form.piac_wo_wage_demands || "").trim() === "1" && !price) {
      return "Bérigény a jelentkezőtől";
    }
    if (price) {
      const dim = String(form.piac_price_dimension || "hó").trim() || "hó";
      return `${price} / ${dim}`;
    }
    return "";
  }
  return price || "Ár egyeztetés szerint";
}

export function isAllasListing(item) {
  const form = item?.form ?? {};
  const filter = item?.preview?.filter ?? {};
  const path = String(form.piac_path || filter.piac_path || "").toLowerCase();
  if (path === "allas" || path.startsWith("allas/")) return true;
  const alk = String(form.hirdetes_alkategoria || filter.hirdetes_alkategoria || "").toLowerCase();
  return alk === "allas" || alk.startsWith("allas");
}

function listingAllasCompany(item) {
  const form = item?.form ?? {};
  return String(
    form.piac_prop_name_of_company ||
      form.name_of_company ||
      form.hirdeto_nev ||
      item?.preview?.company ||
      ""
  ).trim();
}

function listingAllasJobtype(item) {
  const form = item?.form ?? {};
  return String(form.piac_prop_jobtype || form.allas_foglalkoztatas || "").trim();
}

function listingAllasCity(item) {
  const preview = item?.preview ?? {};
  const form = item?.form ?? {};
  const filter = preview.filter ?? {};
  return String(filter.telepules || form.telepules || preview.city || "").trim();
}

function listingAllasDateShort(item) {
  const raw = item?.created_at || item?.updated_at || "";
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.`;
}

function listingIsNew(item, days = 7) {
  const raw = item?.created_at || item?.updated_at || "";
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < days * 24 * 60 * 60 * 1000;
}

function pickFilter(preview, form, key) {
  return String(preview?.filter?.[key] ?? form?.[key] ?? "").trim();
}

export function listingTileSubtitle(item) {
  const preview = item?.preview ?? {};
  const form = item?.form ?? {};
  const fuel = pickFilter(preview, form, "uzemanyag");
  const gear = pickFilter(preview, form, "sebessegvalto");
  const gearShort = gear
    .replace(/^Fokozatmentes\s+automata$/iu, "Automata")
    .replace(/^Fokozatmentes$/iu, "Automata")
    .replace(/^Automata\s*\([^)]*\)(?:\s*sebességváltó)?$/iu, "Automata")
    .replace(/^Manuális\s*\([^)]*\)$/iu, "Manuális")
    .replace(/^Szekvenciális(?:\s*\([^)]*\))?$/iu, "Félautomata")
    .replace(/^Tiptronic$/iu, "Automata");
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
      piac_path: form.piac_path ?? preview.filter?.piac_path ?? null,
      piac_cim: form.piac_cim ?? null,
      piac_price_dimension: form.piac_price_dimension ?? null,
      piac_wo_wage_demands: form.piac_wo_wage_demands ?? null,
      piac_prop_jobtype: form.piac_prop_jobtype ?? null,
      allas_foglalkoztatas: form.allas_foglalkoztatas ?? null,
      piac_prop_name_of_company: form.piac_prop_name_of_company ?? null,
      name_of_company: form.name_of_company ?? null,
      hirdeto_nev: form.hirdeto_nev ?? null,
      telepules: form.telepules ?? preview.filter?.telepules ?? null,
      hirdetes_alkategoria: form.hirdetes_alkategoria ?? null,
      promo_kiemelt: form.promo_kiemelt ?? null,
      promo_top_ajanlat: form.promo_top_ajanlat ?? null,
    },
    preview: {
      title: preview.title,
      price: preview.price,
      km: preview.km,
      city: preview.city || preview.filter?.telepules || form.telepules || "",
      specLine: preview.specLine,
      imageUrl: preview.imageUrl || item.fo_kep || "",
      promo: preview.promo || {
        kiemelt: String(form.promo_kiemelt ?? "").trim() === "1",
        top: String(form.promo_top_ajanlat ?? "").trim() === "1",
      },
      filter: {
        gyartmany: preview.filter?.gyartmany ?? form.gyartmany ?? null,
        modell: preview.filter?.modell ?? form.modell ?? null,
        tipus: preview.filter?.tipus ?? form.tipus ?? null,
        gyartasi_ev: preview.filter?.gyartasi_ev ?? null,
        uzemanyag: preview.filter?.uzemanyag ?? form.uzemanyag ?? null,
        sebessegvalto: preview.filter?.sebessegvalto ?? form.sebessegvalto ?? null,
        teljesitmeny_le: preview.filter?.teljesitmeny_le ?? form.teljesitmeny_le ?? null,
        piac_path: preview.filter?.piac_path ?? form.piac_path ?? null,
        telepules: preview.filter?.telepules ?? form.telepules ?? null,
        hirdetes_alkategoria: preview.filter?.hirdetes_alkategoria ?? form.hirdetes_alkategoria ?? null,
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

function createAllasBrickCard(
  item,
  { className = "hf-card hf-card--listing", featured = false, configuredFeaturedIds = null, eager = false } = {}
) {
  const preview = item.preview ?? {};
  const showKiemelt = featured || listingShowsKiemeltDecor(item, configuredFeaturedIds);
  const showTop = promoTopAjanlatActive(item);
  const link = document.createElement("a");
  link.className = `${className} hf-card--allas${showKiemelt ? " hf-card--featured" : ""}`.trim();
  link.href = listingDetailHref(item.id);
  link.dataset.listingId = String(item.id);
  link.setAttribute("role", "listitem");

  const title = listingTileTitle(item);
  const company = listingAllasCompany(item);
  const jobtype = listingAllasJobtype(item);
  const city = listingAllasCity(item);
  const date = listingAllasDateShort(item);
  const wage = listingTilePrice(item);
  const imageUrl = listCardImageUrl(preview.imageUrl || item.fo_kep || "");
  const isNew = listingIsNew(item);

  const media = document.createElement("span");
  media.className = "hf-card-media hf-card-media--allas";
  if (imageUrl) {
    const img = document.createElement("img");
    img.className = "hf-card-media-img";
    img.alt = title;
    img.width = 96;
    img.height = 96;
    img.loading = eager ? "eager" : "lazy";
    img.decoding = "async";
    if (eager) img.fetchPriority = "high";
    img.referrerPolicy = "no-referrer";
    applyListingImgSrcset(img, imageUrl, { sizes: "96px" });
    media.appendChild(img);
  } else {
    media.classList.add("is-empty");
  }

  const body = document.createElement("span");
  body.className = "hf-card-allas-body";

  const label = document.createElement("span");
  label.className = "hf-card-label";
  label.textContent = title;
  body.appendChild(label);

  if (isNew || showKiemelt || showTop) {
    const badges = document.createElement("span");
    badges.className = "hf-card-allas-badges";
    if (isNew) {
      const neu = document.createElement("span");
      neu.className = "hf-card-allas-badge";
      neu.textContent = "Új — jelentkezz";
      badges.appendChild(neu);
    }
    if (showKiemelt) {
      const k = document.createElement("span");
      k.className = "hf-card-allas-badge hf-card-allas-badge--kiemelt";
      k.textContent = "Kiemelt";
      badges.appendChild(k);
    }
    body.appendChild(badges);
  }

  if (company) {
    const co = document.createElement("span");
    co.className = "hf-card-allas-company";
    co.textContent = company;
    body.appendChild(co);
  }

  const metaBits = [date, [jobtype, city].filter(Boolean).join(", ")].filter(Boolean);
  if (wage) metaBits.push(wage);
  if (metaBits.length) {
    const meta = document.createElement("span");
    meta.className = "hf-card-allas-meta";
    meta.textContent = metaBits.join(" | ");
    body.appendChild(meta);
  }

  link.append(media, body);
  return link;
}

export function createListingTileCard(
  item,
  { className = "hf-card hf-card--listing", featured = false, configuredFeaturedIds = null, eager = false } = {}
) {
  if (isAllasListing(item)) {
    return createAllasBrickCard(item, { className, featured, configuredFeaturedIds, eager });
  }

  const preview = item.preview ?? {};
  const showKiemelt = featured || listingShowsKiemeltDecor(item, configuredFeaturedIds);
  const showTop = promoTopAjanlatActive(item);
  const link = document.createElement("a");
  link.className = showKiemelt ? `${className} hf-card--featured`.trim() : className;
  link.href = listingDetailHref(item.id);
  link.dataset.listingId = String(item.id);
  link.setAttribute("role", "listitem");

  const title = listingTileTitle(item);
  const subtitle = listingTileSubtitle(item);
  const price = listingTilePrice(item);
  const year = listingTileYear(item);
  const km = listingTileKm(item);
  const power = listingTilePower(item);
  const imageUrl = listCardImageUrl(preview.imageUrl || item.fo_kep || "");

  const media = document.createElement("span");
  media.className = "hf-card-media";
  if (imageUrl) {
    const img = document.createElement("img");
    img.className = "hf-card-media-img";
    img.alt = title;
    img.width = 240;
    img.height = 180;
    img.loading = eager ? "eager" : "lazy";
    img.decoding = "async";
    if (eager) img.fetchPriority = "high";
    img.referrerPolicy = "no-referrer";
    applyListingImgSrcset(img, imageUrl, { sizes: "(max-width: 640px) 45vw, 180px" });
    media.appendChild(img);
  }
  const label = document.createElement("span");
  label.className = "hf-card-label";
  label.textContent = title;

  link.append(media);
  const strip = createListingFeaturedUnderPhotoStrip({ kiemelt: showKiemelt, topOffer: showTop });
  if (strip) link.appendChild(strip);
  link.appendChild(label);

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
