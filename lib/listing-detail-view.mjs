/**
 * Willhaben-szerű hirdetésnézet: a feltöltött autóadatokból.
 */
import {
  composeVehicleTitle,
  formatListingDisplayTitle,
  formatBrandDisplayName,
  sanitizeListingFieldValue,
  sanitizeListingPlainText,
  collectPreviewImageUrls,
  isStubVehicleName,
} from "./listing-preview.mjs";
import { resolveListingVertical } from "./listing-vertical.mjs";

export { formatBrandDisplayName } from "./listing-preview.mjs";

function categoryMeta(listing, form) {
  const vertical = resolveListingVertical({
    ...listing,
    form,
    hirdetes_vertical: str(form, "hirdetes_vertical") || listing?.hirdetes_vertical,
    hirdetes_alkategoria: str(form, "hirdetes_alkategoria") || listing?.hirdetes_alkategoria,
  });
  if (vertical === "ingatlan") {
    return { categoryHref: "/ingatlan.html", categoryLabel: "Ingatlanok" };
  }
  if (vertical === "teher") {
    return { categoryHref: "/teherauto.html", categoryLabel: "Teherautók" };
  }
  return { categoryHref: "/auto.html", categoryLabel: "Autók" };
}

function str(form, key) {
  const raw = form?.[key];
  if (Array.isArray(raw)) return raw.map((item) => String(item ?? "").trim()).filter(Boolean).join(", ");
  return String(raw ?? "").trim();
}

function digits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function formatPriceFt(value) {
  const n = Number(digits(value));
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${n.toLocaleString("hu-HU")} Ft`;
}

function formatKm(value) {
  const n = Number(digits(value));
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${n.toLocaleString("hu-HU")} km`;
}

function formatCcm(value) {
  const n = Number(digits(value));
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${n.toLocaleString("hu-HU")} cm³`;
}

function pad2(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return String(value ?? "").trim();
  return String(n).padStart(2, "0");
}

function yearMonth(year, month) {
  const y = String(year ?? "").trim();
  const m = String(month ?? "").trim();
  if (y && m) return `${pad2(m)}.${y}`;
  return y;
}

function powerLabel(form) {
  const kw = str(form, "teljesitmeny_kw");
  const le = str(form, "teljesitmeny_le");
  if (le && kw) return `${le} LE (${kw} kW)`;
  if (le) return `${le} LE`;
  if (kw) return `${kw} kW`;
  return "";
}

function equipmentList(form) {
  const items = [];
  const klima = str(form, "klima");
  if (klima) items.push(klima);
  const extras = Array.isArray(form?.felszereltseg) ? form.felszereltseg : [];
  for (const item of extras) {
    const text = String(item ?? "").trim();
    if (text.length >= 2 && !items.includes(text)) items.push(text);
  }
  if (/^(i|igen|1|true)$/i.test(str(form, "nem_dohanyzo"))) {
    items.push("Nem dohányzó jármű");
  }
  return items;
}

function formatPhone(form) {
  const country = str(form, "telefon1_orszag");
  const area = str(form, "telefon1_korzet");
  const number = str(form, "telefon1_szam");
  const assembled = [country || "+36", area, number].filter(Boolean).join(" ").trim();
  if (area || number) return assembled;
  for (const key of ["telefonszam", "telefon", "phone", "mobil"]) {
    const v = str(form, key);
    if (v) return v;
  }
  return "";
}

export function maskPhone(phone) {
  const raw = String(phone ?? "").trim();
  if (!raw) return "";
  const chars = [...raw];
  let kept = 0;
  let cut = 0;
  for (let i = 0; i < chars.length; i += 1) {
    if (/\d/.test(chars[i])) kept += 1;
    cut = i + 1;
    if (kept >= 5) break;
  }
  if (kept < 5) return `${raw.slice(0, Math.min(6, raw.length))}…`;
  return `${raw.slice(0, cut)}…`;
}

function softTruncatePlain(text, max = 600) {
  const t = String(text ?? "").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.55 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}

function addressLines(form) {
  const street = sanitizeListingFieldValue(str(form, "megtekintesi_cim"));
  const postal = sanitizeListingFieldValue(str(form, "iranyitoszam"));
  const city = sanitizeListingFieldValue(str(form, "telepules"));
  const megye = sanitizeListingFieldValue(str(form, "megye"));
  const lines = [];
  if (street) lines.push(street);
  const cityLine = [postal, city, megye].filter(Boolean).join(" ");
  if (cityLine) lines.push(cityLine);
  return lines;
}

function sellerName(form) {
  const company = sanitizeListingFieldValue(str(form, "company") || str(form, "cegnev"));
  if (company) return company;
  const named = sanitizeListingFieldValue(str(form, "hirdeto_nev"));
  if (named) return named;
  return "Eladó";
}

function kv(label, value) {
  const v = String(value ?? "").trim();
  if (!v || v === "—") return null;
  return { label, value: v };
}

function consumption(form) {
  const combined = str(form, "fogyasztas_kombinalt");
  if (combined) return /l/i.test(combined) ? combined : `${combined} l/100km`;
  return "";
}

export function buildListingDetailView(listing = {}) {
  const form = listing.form ?? {};
  const year = str(form, "gyartasi_ev");
  const titleRaw =
    formatListingDisplayTitle(composeVehicleTitle(form)) ||
    formatListingDisplayTitle(listing.hirdetes_cime) ||
    formatListingDisplayTitle(str(form, "hirdetes_cime")) ||
    `Hirdetés #${listing.id ?? "?"}`;
  const title = formatListingDisplayTitle(titleRaw);

  const km = formatKm(str(form, "km"));
  const price = formatPriceFt(str(form, "vetelar") || str(form, "akcios_ar"));
  const listPrice = formatPriceFt(str(form, "forgalomba_helyezes_ar"));
  const salePrice = formatPriceFt(str(form, "akcios_ar"));
  const power = powerLabel(form);
  const equipment = equipmentList(form);
  const description = softTruncatePlain(sanitizeListingPlainText(str(form, "leiras")), 600);
  const phone = formatPhone(form);
  const address = addressLines(form);
  const city = sanitizeListingFieldValue(str(form, "telepules"));
  const megye = sanitizeListingFieldValue(str(form, "megye"));
  // Térkép: csak település szint (adatvédelem) — ne küldjünk pontos utcacímet
  const mapQuery = [city, megye, "Magyarország"].filter(Boolean).join(", ");
  const images = collectPreviewImageUrls(form, listing);
  const code =
    str(form, "hasznaltauto_hirdetes_id") ||
    listing.hasznaltauto_hirdetes_id ||
    (listing.id ? String(listing.id) : "");

  const { categoryHref, categoryLabel } = categoryMeta(listing, form);
  const brand = formatBrandDisplayName(str(form, "gyartmany"));
  const typeName =
    (!isStubVehicleName(form.modell) && sanitizeListingFieldValue(form.modell)) || "";

  const perks = [];
  if (/garanci/i.test(description) || equipment.some((item) => /garanci/i.test(item))) {
    perks.push("Garanciális");
  }
  if (/áfa|afa/i.test(str(form, "okmany_jelleg") + description)) {
    perks.push("ÁFA visszaigényelhető");
  }

  const basics = [
    kv("Sebességváltó", str(form, "sebessegvalto")),
    kv("Futásteljesítmény", km),
    kv("Teljesítmény", power),
    kv("Üzemanyag", str(form, "uzemanyag")),
    kv("Hajtás", str(form, "hajtas")),
  ].filter(Boolean);

  const bodyTech = [
    kv("Állapot", str(form, "allapot")),
    kv("Jármű típusa", str(form, "kivitel") || typeName),
    kv("Hengerűrtartalom", formatCcm(str(form, "hengerurtartalom"))),
    kv("Ajtók száma", str(form, "ajtok")),
    kv("Ülések száma", str(form, "szemelyek") || str(form, "ulesek")),
    kv("Fogyasztás", consumption(form)),
    kv("Külső szín", str(form, "szin")),
    kv("Műszaki érvényesség", yearMonth(str(form, "muszaki_ev"), str(form, "muszaki_honap"))),
    kv("Előző tulajdonosok", str(form, "tulajdonosok_szama")),
  ].filter(Boolean);

  const headerSpecs = [
    str(form, "allapot"),
    km,
    power,
  ].filter(Boolean);

  const registration = yearMonth(
    str(form, "forgalomba_helyezes_ev") || year,
    str(form, "forgalomba_helyezes_honap") || str(form, "gyartasi_honap")
  );

  return {
    id: listing.id ?? null,
    title,
    titleUpper: title.toUpperCase(),
    price: price || "—",
    listPrice,
    salePrice: salePrice && salePrice !== price ? salePrice : "",
    km: km || "—",
    power: power || "—",
    year: year || "—",
    registration: registration || "—",
    fuel: str(form, "uzemanyag") || "—",
    headerSpecs,
    images,
    imageUrl: images[0] || "",
    basics,
    bodyTech,
    perks,
    equipment,
    description,
    sellerName: sellerName(form),
    phone,
    phoneMasked: maskPhone(phone),
    addressLines: address,
    mapQuery: address.length ? mapQuery : "",
    website: str(form, "weboldal") || str(form, "honlap") || "",
    code,
    updatedAt: listing.updated_at || "",
    status: listing.status || "",
    userId: listing.user_id ?? null,
    categoryHref,
    categoryLabel,
    brand,
    typeName,
    metaLine: [year || "—", km || "—", power || "—"].join(", "),
  };
}
