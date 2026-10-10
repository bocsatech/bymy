import {
  composeVehicleTitle,
  formatListingDisplayTitle,
  sanitizeListingFieldValue,
  sanitizeListingPlainText,
  collectPreviewImageUrls,
  isStubVehicleName,
} from "./listing-preview.mjs";
import { categorizeListingExtras } from "./listing-extra-categories.mjs";
import { resolveVerticalFromFields } from "./listing-vertical.mjs";
import { estimateMarketValuation, marketDataAvailable } from "./market-valuation.mjs";
import { lookupPostalCodeFromSeed, normalizePostalCode } from "./postal-codes.mjs";
import { isHungaryCountyOnlyLabel } from "./hu-counties.mjs";
import {
  collectPiacPropRows,
  firstPiacPositionValue,
  formatPiacPathLabels,
  isPiacAllasPath,
  pickPiacHighlightRows,
} from "./piac-display.mjs";

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

function formatKg(value) {
  const n = Number(digits(value));
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${n.toLocaleString("hu-HU")} kg`;
}

function formatLiter(value) {
  const n = Number(digits(value));
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${n.toLocaleString("hu-HU")} liter`;
}

function formatPersons(value) {
  const n = Number(digits(value));
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${n} fő`;
}

function formatTireSize(form, prefix) {
  const w = str(form, `${prefix}_szelesseg`);
  const h = str(form, `${prefix}_magassag`);
  const r = str(form, `${prefix}_atmero`);
  if (w && h && r) {
    const rim = String(r).replace(/^R/i, "").trim();
    return `${w}/${h} R ${rim}`;
  }
  const legacy = str(form, prefix === "nyari_gumi" ? "nyari_gumi_meret" : "teli_gumi_meret");
  return legacy.replace(/\s+/g, " ").trim();
}

function upholsteryColor(form) {
  const parts = [str(form, "karpit1"), str(form, "karpit2")].filter(Boolean);
  return parts.join(" / ");
}

function klimaLabel(form) {
  const klima = str(form, "klima");
  if (!klima || /^nincs$/i.test(klima)) return "";
  return klima;
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
  if (kw && le) return `${kw} kW, ${le} LE`;
  if (le) return `${le} LE`;
  if (kw) return `${kw} kW`;
  return "";
}

function equipmentList(form) {
  const items = [];
  const extras = Array.isArray(form?.felszereltseg) ? form.felszereltseg : [];
  for (const item of extras) {
    const text = String(item ?? "").trim();
    if (text.length >= 2 && !items.includes(text)) items.push(text);
  }
  const egyeb = Array.isArray(form?.egyeb_info) ? form.egyeb_info : [];
  for (const item of egyeb) {
    const text = String(item ?? "").trim();
    if (text.length >= 2 && !items.includes(text)) items.push(text);
  }
  if (/^(i|igen|1|true)$/i.test(str(form, "nem_dohanyzo"))) {
    if (!items.some((x) => /nem dohányzó/i.test(x))) items.push("Nem dohányzó jármű");
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

function resolveCityMegye(form) {
  let city = sanitizeListingFieldValue(str(form, "telepules"));
  let megye = sanitizeListingFieldValue(str(form, "megye"));
  const postal = normalizePostalCode(str(form, "iranyitoszam"));
  if (isHungaryCountyOnlyLabel(city)) {
    if (!megye) megye = city;
    city = "";
  }
  const hit = postal ? lookupPostalCodeFromSeed(postal) : null;
  if (hit) {
    if (!city) city = String(hit.city || "").trim();
    if (hit.megye) megye = String(hit.megye).trim();
  }
  return {
    city,
    megye,
    postal: sanitizeListingFieldValue(str(form, "iranyitoszam")),
  };
}

function addressLines(form) {
  const street = sanitizeListingFieldValue(str(form, "megtekintesi_cim"));
  const { postal, city, megye } = resolveCityMegye(form);
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

function formatSellerSince(value) {
  if (!value) return "";
  try {
    const d = new Date(String(value).includes("T") ? value : `${value}Z`);
    if (!Number.isFinite(d.getTime())) return "";
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${mm}/${yyyy}`;
  } catch {
    return "";
  }
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
  const vertical = resolveVerticalFromFields(
    str(form, "hirdetes_vertical"),
    str(form, "hirdetes_alkategoria")
  );
  const piacTitle =
    formatListingDisplayTitle(str(form, "piac_cim")) ||
    formatListingDisplayTitle(str(form, "hirdetes_cime")) ||
    formatListingDisplayTitle(listing.hirdetes_cime);
  const title =
    (vertical === "piac" && piacTitle) ||
    formatListingDisplayTitle(composeVehicleTitle(form)) ||
    piacTitle ||
    `Hirdetés #${listing.id ?? "?"}`;

  const km = formatKm(str(form, "km"));
  const price = formatPriceFt(str(form, "vetelar") || str(form, "akcios_ar"));
  const listPrice = formatPriceFt(str(form, "forgalomba_helyezes_ar"));
  const salePrice = formatPriceFt(str(form, "akcios_ar"));
  const power = powerLabel(form);
  const equipment = equipmentList(form);
  const description = softTruncatePlain(sanitizeListingPlainText(str(form, "leiras")), 600);
  const phone = formatPhone(form);
  const address = addressLines(form);
  const { city, megye } = resolveCityMegye(form);
  const mapQuery =
    city || megye ? [city, megye, "Magyarország"].filter(Boolean).join(", ") : "";
  const images = collectPreviewImageUrls(form, listing);
  const code =
    str(form, "hasznaltauto_hirdetes_id") ||
    listing.hasznaltauto_hirdetes_id ||
    (listing.id ? String(listing.id) : "");
  const categoryHref =
    vertical === "teher"
      ? "/teherauto.html"
      : vertical === "ingatlan"
        ? "/ingatlan.html"
        : vertical === "piac"
          ? "/piacter.html"
          : "/auto.html";
  const categoryLabel =
    vertical === "teher"
      ? "Teherautó"
      : vertical === "ingatlan"
        ? "Ingatlan"
        : vertical === "piac"
          ? "Piactér"
          : "Autó";
  const brand = sanitizeListingFieldValue(str(form, "gyartmany"));
  const typeName =
    (!isStubVehicleName(form.modell) && sanitizeListingFieldValue(form.modell)) || "";

  const perks = [];
  if (/garanci/i.test(description) || equipment.some((item) => /garanci/i.test(item))) {
    perks.push("Garanciális");
  }
  if (/áfa|afa/i.test(str(form, "okmany_jelleg") + description)) {
    perks.push("ÁFA visszaigényelhető");
  }

  const piacPath = sanitizeListingFieldValue(str(form, "piac_path"));
  const piacPathLabel = formatPiacPathLabels(piacPath) || (piacPath ? piacPath.replace(/\//g, " › ") : "");
  const piacIntent = String(str(form, "piac_intent") || "").trim().toLowerCase();
  const piacIntentLabel = piacIntent === "keres" ? "Keres" : piacIntent === "kinal" ? "Kínál" : "";
  const piacFree = String(str(form, "piac_ingyen") || "") === "1";
  const allasWageAsk = String(str(form, "piac_wo_wage_demands") || "") === "1";
  const allasWageDim = String(str(form, "piac_price_dimension") || "hó").trim() || "hó";

  const isAllas = vertical === "piac" && isPiacAllasPath(piacPath);
  const allasDocs = String(str(form, "allas_dokumentumok") || str(form, "piac_prop_job_documents") || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
  const propSpecs = collectPiacPropRows(form).map((row) => kv(row.label, row.value)).filter(Boolean);
  const allasMunkakor =
    str(form, "allas_munkakor") || firstPiacPositionValue(form) || "";
  const allasSpecs = (
    isAllas
      ? [
          kv("Munkakör", allasMunkakor),
          kv("Tapasztalat", str(form, "allas_tapasztalat") || str(form, "piac_prop_carrier_level")),
          kv("Foglalkoztatás jellege", str(form, "allas_foglalkoztatas") || str(form, "piac_prop_jobtype")),
          kv("Elvárt végzettség", str(form, "allas_vegzettseg") || str(form, "piac_prop_education")),
          kv("Szükséges nyelvtudás", str(form, "allas_nyelv") || str(form, "piac_prop_language")),
          kv("Külföldi munka esetén ország", str(form, "allas_kulfoldi_orszag")),
          kv("Jelentkezéshez szükséges dokumentumok", allasDocs),
        ]
      : propSpecs
  ).filter(Boolean);

  /* Valós ár nyer az „Ingyen elvihető” flag felett (régi mentéseknél mindkettő lehet). */
  let priceDisplay = price ? price : piacFree ? "Ingyen elvihető" : "";
  if (isAllas) {
    if (price) priceDisplay = `${price} / ${allasWageDim}`;
    else if (allasWageAsk) priceDisplay = "A jelentkező adja meg a bérigényét";
    else priceDisplay = "";
  }

  let vehicleSpecs =
    vertical === "piac"
      ? [
          kv("Kategória", piacPathLabel),
          kv("Szándék", piacIntentLabel),
          !isAllas ? kv("Állapot", str(form, "allapot") || str(form, "piac_prop_electronic_condition_one")) : null,
          priceDisplay ? kv(isAllas ? "Bruttó bér" : "Vételár", priceDisplay) : null,
          kv("Település", city),
        ].filter(Boolean)
      : [
          kv("Km. óra állás", km),
          kv("Szállítható szem. száma", formatPersons(str(form, "szemelyek") || str(form, "ulesek"))),
          kv("Ajtók száma", str(form, "ajtok")),
          kv("Szín", str(form, "szin")),
          kv("Saját tömeg", formatKg(str(form, "sajat_tomeg"))),
          kv("Teljes tömeg", formatKg(str(form, "ossztomeg"))),
          kv("Csomagtartó", formatLiter(str(form, "csomagtarto"))),
          kv("Klíma fajtája", klimaLabel(form)),
          kv("Jármű típusa", str(form, "kivitel") || typeName),
          kv("Állapot", str(form, "allapot")),
          kv("Kárpit színe", upholsteryColor(form)),
        ].filter(Boolean);
  // Vékony importnál (csak cím/ár/modell) is mutassunk valamit a blokkban
  if (vertical !== "piac" && vehicleSpecs.length < 3) {
    const seen = new Set(vehicleSpecs.map((row) => row.label));
    for (const row of [
      kv("Gyártmány", brand),
      kv("Modell", typeName),
      kv("Típus", sanitizeListingFieldValue(str(form, "tipus"))),
      kv("Gyártási év", year),
      kv("Vételár", price),
    ].filter(Boolean)) {
      if (!seen.has(row.label)) {
        vehicleSpecs.push(row);
        seen.add(row.label);
      }
    }
  }

  const motorSpecs =
    vertical === "piac"
      ? []
      : [
          kv("Üzemanyag", str(form, "uzemanyag")),
          kv("Teljesítmény", power),
          kv("Hajtás", str(form, "hajtas")),
          kv("Sebességváltó", str(form, "sebessegvalto")),
          kv("Hengerűrtartalom", formatCcm(str(form, "hengerurtartalom"))),
          kv("Fogyasztás", consumption(form)),
          kv("CO₂ kibocsátás", (() => {
            const co2 = str(form, "co2_kibocsatas");
            if (!co2) return "";
            return /g/i.test(co2) ? co2 : `${co2} g/km`;
          })()),
        ].filter(Boolean);

  const documentSpecs =
    vertical === "piac"
      ? []
      : [
          kv("Okmányok jellege", str(form, "okmany_jelleg")),
          kv("Műszaki érvényesség", yearMonth(str(form, "muszaki_ev"), str(form, "muszaki_honap"))),
          kv(
            "Forgalomba helyezés",
            yearMonth(
              str(form, "forgalomba_helyezes_ev") || year,
              str(form, "forgalomba_helyezes_honap") || str(form, "gyartasi_honap")
            )
          ),
          kv("Előző tulajdonosok", str(form, "tulajdonosok_szama")),
        ].filter(Boolean);

  const tireSpecs =
    vertical === "piac"
      ? []
      : [
          kv("Nyári gumi méret", formatTireSize(form, "nyari_gumi")),
          kv("Téli gumi méret", formatTireSize(form, "teli_gumi")),
        ].filter(Boolean);

  const basics = [
    ...vehicleSpecs.filter((row) => ["Km. óra állás", "Hajtás"].includes(row.label)),
    ...motorSpecs.filter((row) => ["Teljesítmény", "Üzemanyag", "Sebességváltó"].includes(row.label)),
  ];
  const bodyTech = [
    ...vehicleSpecs.filter((row) =>
      [
        "Állapot",
        "Jármű típusa",
        "Ajtók száma",
        "Szállítható szem. száma",
        "Szín",
        "Kárpit színe",
        "Saját tömeg",
        "Teljes tömeg",
        "Csomagtartó",
        "Klíma fajtája",
      ].includes(row.label)
    ),
    ...motorSpecs.filter((row) => ["Hengerűrtartalom", "Fogyasztás"].includes(row.label)),
    ...documentSpecs.filter((row) =>
      ["Műszaki érvényesség", "Előző tulajdonosok"].includes(row.label)
    ),
  ];

  const equipmentGroups = categorizeListingExtras(equipment);

  // A felső hero sávban ne duplikáljuk az állapot/km/teljesítmény adatokat.
  const headerSpecs = [];

  const registration = yearMonth(
    str(form, "forgalomba_helyezes_ev") || year,
    str(form, "forgalomba_helyezes_honap") || str(form, "gyartasi_honap")
  );

  let marketHint = null;
  if (vertical !== "ingatlan" && vertical !== "piac" && marketDataAvailable()) {
    try {
      const market = estimateMarketValuation({
        gyartmany: str(form, "gyartmany"),
        modell: str(form, "modell"),
        tipus: str(form, "tipus") || str(form, "egyeb_tipus"),
        gyartasi_ev: year,
        km: str(form, "km"),
        ar: str(form, "vetelar") || str(form, "akcios_ar"),
      });
      if (market?.opinion && market?.bars && !market.error) {
        marketHint = {
          opinion: market.opinion,
          bars: market.bars,
          label:
            market.opinion === "jó ár" ? "Jó ár" : market.opinion === "kevés" ? "Kevés" : "Sok",
        };
      }
    } catch {
      marketHint = null;
    }
  }

  const piacHighlights =
    vertical === "piac"
      ? pickPiacHighlightRows(form, {
          isAllas,
          city,
          priceLabel: priceDisplay || "",
        })
      : [];

  return {
    id: listing.id ?? null,
    title,
    titleUpper: title.toUpperCase(),
    price: vertical === "piac" ? priceDisplay || (isAllas ? "" : "—") : price || "—",
    hasPrice: Boolean(priceDisplay),
    listPrice: vertical === "piac" ? "" : listPrice,
    salePrice: vertical === "piac" ? "" : salePrice && salePrice !== price ? salePrice : "",
    marketHint: vertical === "piac" ? null : marketHint,
    km: km || "—",
    power: power || "—",
    year: year || "—",
    registration: registration || "—",
    fuel: str(form, "uzemanyag") || "—",
    headerSpecs,
    images,
    imageUrl: images[0] || "",
    vehicleSpecs,
    allasSpecs,
    motorSpecs,
    documentSpecs,
    tireSpecs,
    basics,
    bodyTech,
    perks: vertical === "piac" ? [] : perks,
    equipment,
    equipmentGroups,
    description,
    sellerName: sellerName(form),
    sellerAvatarUrl: String(listing.sellerAvatarUrl || form.seller_avatar || "").trim(),
    sellerSince: formatSellerSince(listing.created_at || form.created_at || listing.updated_at),
    phone,
    phoneMasked: maskPhone(phone),
    addressLines: address,
    mapQuery,
    website: str(form, "weboldal") || str(form, "honlap") || "",
    code,
    updatedAt: listing.updated_at || "",
    status: listing.status || "",
    userId: listing.user_id ?? null,
    vertical,
    categoryHref,
    categoryLabel,
    brand: vertical === "piac" ? "" : brand,
    typeName: vertical === "piac" ? "" : typeName,
    piacPath,
    piacPathLabel,
    piacIntentLabel,
    isAllas,
    piacHighlights,
    metaLine:
      vertical === "piac"
        ? [piacPathLabel, piacIntentLabel, city].filter(Boolean).join(" • ") || "Piactér"
        : [year || "—", km || "—", power || "—"].join(", "),
  };
}
