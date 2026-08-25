import { pickValue, cleanText, normalizeKey } from "./parse-listing.mjs";
import { extractOdometerKm, kmDigitsFromValue } from "./extract-km.mjs";
import { applyMuszakiFields, applyExtrakFields } from "./map-tech.mjs";
import { applyFieldMap } from "./field-key-map.mjs";
import { summarizeImportByStep, formatImportSummary } from "./map-import-summary.mjs";
import { sanitizeListingFieldValue, sanitizeListingPlainText } from "./listing-preview.mjs";
import {
  findCatalogBrand,
  findCatalogModel,
  normalizeBrand,
  stripLeadingCatalogToken,
} from "./vehicle-catalog.mjs";

const COUNTY_NAMES = [
  "Budapest",
  "Pest",
  "Fejér",
  "Győr-Moson-Sopron",
  "Komárom-Esztergom",
  "Veszprém",
  "Baranya",
  "Bács-Kiskun",
  "Békés",
  "Borsod-Abaúj-Zemplén",
  "Csongrád-Csanád",
  "Hajdú-Bihar",
  "Heves",
  "Jász-Nagykun-Szolnok",
  "Nógrád",
  "Somogy",
  "Szabolcs-Szatmár-Bereg",
  "Tolna",
  "Vas",
  "Zala",
];

function resolveKm(parsed, m, titleParts) {
  const fromFields = extractOdometerKm({
    maps: [m],
    texts: [parsed.km, parsed.cim, parsed.jarmuTipus, parsed.leiras, titleParts.rest],
  });
  if (fromFields !== "") return fromFields;
  return kmDigitsFromValue(parsed.km || pickValue(m, ["futásteljesítmény", "futasteljesitmeny", "km óra állás", "km ora allas"]));
}

function digits(value) {
  const match = String(value ?? "").match(/[\d\s.]+/);
  return match ? match[0].replace(/\s|\./g, "") : "";
}

function parseYearMonth(value) {
  if (!value) return { ev: "", honap: "" };
  const match = String(value).match(/(19|20)\d{2}(?:\/(\d{1,2}))?/);
  if (!match) {
    const yearOnly = String(value).match(/\b(19|20)\d{2}\b/);
    return { ev: yearOnly?.[0] ?? "", honap: "" };
  }
  return { ev: match[0].slice(0, 4), honap: match[2] ? String(Number(match[2])) : "" };
}

function parsePower(value) {
  if (!value) return { kw: "", le: "" };
  const kwMatch = value.match(/([\d.,]+)\s*kW/i);
  const leMatch = value.match(/([\d.,]+)\s*LE/i);
  return {
    kw: kwMatch ? kwMatch[1].replace(",", ".") : "",
    le: leMatch ? leMatch[1].replace(",", ".") : "",
  };
}

function parsePhoneParts(phone) {
  if (!phone) return null;
  const compact = phone.replace(/[^\d+]/g, "");
  const match = compact.match(/^(\+36|06)(\d{1,2})(\d{6,8})$/);
  if (!match) return null;
  const orszag = match[1].startsWith("06") ? "+36" : match[1];
  const szam = match[3].replace(/(\d{3})(\d+)/, "$1 $2");
  return { orszag, korzet: match[2], szam };
}

function extractListingId(url) {
  const match = String(url ?? "").match(/-(\d{5,})(?:[/?#]|$)/);
  return match ? match[1] : "";
}

/**
 * HA cím: 1. sor → katalógus márka + modell, maradék = típus;
 * 2. sor → típus végére. A hosszú leírás külön mező.
 */
export function parseTitleParts(title) {
  const plain = sanitizeListingPlainText(title)
    .replace(/^eladó\s+/i, "")
    .trim();
  if (!plain) return { gyartmany: "", modell: "", rest: "" };

  const lines = plain
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  let line1 = lines[0] || "";
  line1 = line1.replace(/\s*\((19|20)\d{2}(?:\/\d{1,2})?\)\s*$/, "").trim();
  const line2 = lines.slice(1).join(" ").trim();
  if (!line1) {
    return { gyartmany: "", modell: "", rest: sanitizeListingFieldValue(line2) };
  }

  let gyartmany = findCatalogBrand(line1);
  let afterBrand = stripLeadingCatalogToken(line1, gyartmany);
  if (afterBrand === line1.replace(/\s+/g, " ").trim()) {
    const firstWord = line1.split(/\s+/)[0] || "";
    gyartmany = normalizeBrand(firstWord) || firstWord;
    afterBrand = stripLeadingCatalogToken(line1, firstWord);
  }

  let modell = findCatalogModel(gyartmany, afterBrand) || findCatalogModel(gyartmany, line1);
  let afterModel = afterBrand;
  if (modell) {
    afterModel = stripLeadingCatalogToken(afterBrand, modell);
    if (afterModel === afterBrand) {
      afterModel = stripLeadingCatalogToken(line1, `${gyartmany} ${modell}`);
    }
  } else {
    const parts = afterBrand.split(/\s+/).filter(Boolean);
    modell = parts[0] || "";
    afterModel = parts.slice(1).join(" ");
  }

  const rest = [afterModel, line2].filter(Boolean).join(" ").trim();
  return {
    gyartmany: sanitizeListingFieldValue(gyartmany),
    modell: sanitizeListingFieldValue(modell),
    rest: sanitizeListingFieldValue(rest),
  };
}

export function buildHirdetesCime(parsed, data = {}) {
  const m = parsed.nyersAdatok ?? {};
  let raw = cleanText(
    parsed.cim ||
      parsed.jarmuTipus ||
      pickValue(m, ["cím", "cim", "hirdetés címe", "hirdetes cime"]) ||
      ""
  );
  // Ne mentsünk Használtautó.hu / Belépés fejlécet hirdetéscímnek
  raw = raw
    .replace(/haszn[aá]ltaut[oó]\.?\s*hu/gi, " ")
    .replace(/\bhaszn[aá]ltaut[oó]\b/gi, " ")
    .replace(/\bbel[eé]p[eé]s\b/gi, " ")
    .replace(/\bregisztr[aá]ci[oó]\b/gi, " ")
    .replace(/[|·•]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!raw || /^bel[eé]p[eé]s$/i.test(raw) || /^haszn/i.test(raw) && raw.length <= 24) {
    raw = "";
  }

  if (raw && /^eladó\s/i.test(raw)) return raw;

  const year = data.gyartasi_ev || parseYearMonth(parsed.evjarat || pickValue(m, ["évjárat", "gyártási év"])).ev;
  const month = data.gyartasi_honap || parseYearMonth(parsed.evjarat || pickValue(m, ["évjárat", "gyártási év"])).honap;
  const yearLabel = year ? (month ? `${year}/${month}` : String(year)) : "";

  if (raw) {
    if (/\(\s*(19|20)\d{2}/.test(raw)) {
      return /^eladó\s/i.test(raw) ? raw : `Eladó ${raw}`;
    }
    return yearLabel ? `Eladó ${raw} (${yearLabel})` : `Eladó ${raw}`;
  }

  const parts = [data.gyartmany, data.modell, data.tipus]
    .map((v) => sanitizeListingFieldValue(v))
    .filter(Boolean);
  if (!parts.length) return "";
  return yearLabel ? `Eladó ${parts.join(" ")} (${yearLabel})` : `Eladó ${parts.join(" ")}`;
}

function inferFuelFromHints(...texts) {
  const v = normalizeKey(texts.filter(Boolean).join(" "));
  if (!v) return "";
  if (v.includes("phev") || (v.includes("hibrid") && v.includes("benzin"))) return "Benzin/elektromos";
  if (v.includes("hibrid") && (v.includes("diesel") || v.includes("dizel"))) return "Dízel/elektromos";
  if (/\belektromos\b|\be-tron\b|\be\s*\d{2,3}\b|\btfsi e\b/.test(v)) return "Elektromos";
  if (/\b\d{2,3}\s*d\b|\bdiesel\b|\bdizel\b|\btdi\b|\bcdi\b|\bcdti\b|\bmultijet\b|\b220\s*d\b|\b250\s*d\b|\b350\s*d\b/.test(v)) {
    return "Dízel";
  }
  if (v.includes("lpg") && (v.includes("dizel") || v.includes("diesel"))) return "LPG/dízel";
  if (v.includes("cng") && (v.includes("dizel") || v.includes("diesel"))) return "CNG/dízel";
  if (v.includes("lpg") || v.includes("gaz")) return "LPG/benzin";
  if (v.includes("cng")) return "CNG/benzin";
  if (v.includes("etanol")) return "Etanol";
  if (v.includes("biodizel")) return "Biodízel";
  if (v.includes("hidrogen")) return "Hidrogén/elektromos";
  if (v.includes("hibrid")) return "Benzin/elektromos";
  if (/\bbenzin\b|\btsi\b|\btfsi\b|\bmpi\b|\becoboost\b|\bpuretech\b/.test(v)) return "Benzin";
  return "";
}

function mapFuel(value) {
  const v = normalizeKey(value);
  if (!v) return "";
  if (v.includes("phev") || (v.includes("hibrid") && v.includes("benzin"))) return "Benzin/elektromos";
  if (v.includes("hibrid") && (v.includes("diesel") || v.includes("dizel"))) return "Dízel/elektromos";
  if (v.includes("elektromos") && (v.includes("benzin"))) return "Benzin/elektromos";
  if (v.includes("elektromos") && (v.includes("diesel") || v.includes("dizel"))) return "Dízel/elektromos";
  if (v.includes("hidrogen") && v.includes("elektromos")) return "Hidrogén/elektromos";
  if (v.includes("elektromos")) return "Elektromos";
  if (v.includes("diesel") || v.includes("dizel")) return "Dízel";
  if (v.includes("lpg") && (v.includes("dizel") || v.includes("diesel"))) return "LPG/dízel";
  if (v.includes("cng") && (v.includes("dizel") || v.includes("diesel"))) return "CNG/dízel";
  if (v.includes("lpg") || v.includes("gaz")) return "LPG/benzin";
  if (v.includes("cng")) return "CNG/benzin";
  if (v.includes("etanol")) return "Etanol";
  if (v.includes("biodizel")) return "Biodízel";
  if (v.includes("hibrid")) return "Benzin/elektromos";
  if (v.includes("benzin")) return "Benzin";
  return cleanText(value);
}

function mapKivitel(value) {
  const v = normalizeKey(value);
  if (!v) return "";
  if (v.includes("suv") || v.includes("crossover") || v.includes("terepjaro")) return "SUV / Crossover";
  if (v.includes("kombi") || v.includes("wagon") || v.includes("estate")) return "Kombi";
  if (v.includes("ferde") || v.includes("hatchback")) return "Ferdehátú";
  if (v.includes("sedan") || v.includes("szedan")) return "Szedán";
  if (v.includes("egyteru") || v.includes("mpv")) return "Egyterű";
  if (v.includes("kupe") || v.includes("coupe")) return "Kupé";
  if (v.includes("cabrio") || v.includes("convertible")) return "Cabrio";
  return cleanText(value);
}

function mapAllapot(value) {
  const v = normalizeKey(value);
  if (!v) return "";
  if (v.includes("ujra") || v.includes("újszer")) return "Újszerű";
  if (v.includes("serulesmentes") || v.includes("sérülésmentes")) return "Sérülésmentes";
  if (v.includes("serult") || v.includes("sérült")) return "Sérült";
  if (v.includes("normal") || v.includes("normál") || v.includes("hasznalt") || v.includes("használt")) {
    return "Normál";
  }
  return cleanText(value);
}

function mapOkmanyJelleg(value) {
  const v = normalizeKey(value);
  if (!v) return "";
  if (v.includes("kulfold") || v.includes("külföld")) return "Érvényes külföldi okmányokkal";
  if (v.includes("magyar") || v.includes("forgalmi")) return "Érvényes magyar okmányokkal";
  return cleanText(value);
}

function mapOkmanyErvenyesseg(value) {
  const v = normalizeKey(value);
  if (!v) return "";
  if (v.includes("lejart") || v.includes("lejárt")) return "Lejárt";
  if (v.includes("ervenyes") || v.includes("érvényes")) return "Érvényes";
  return cleanText(value);
}

function inferTipus(titleParts, parsed, m) {
  if (titleParts.rest) return titleParts.rest;
  const fromTable = pickValue(m, ["típus", "tipus"]);
  if (fromTable) return fromTable;
  const cim = cleanText(parsed.cim || "");
  const withoutBrandModel = cim
    .replace(new RegExp(`^${titleParts.gyartmany}\\s+`, "i"), "")
    .replace(new RegExp(`^${titleParts.modell}\\s+`, "i"), "")
    .replace(/\s*\((19|20)\d{2}.*\)\s*$/, "")
    .trim();
  return withoutBrandModel || cim || "—";
}

function inferKivitelFromText(...texts) {
  const v = normalizeKey(texts.filter(Boolean).join(" "));
  if (!v) return "";
  if (v.includes("suv") || v.includes("crossover") || /\bkuga\b|\btucson\b|\bx\d|\bq\d|\bglc\b|\bgle\b/.test(v)) {
    return "SUV / Crossover";
  }
  if (v.includes("kombi") || v.includes("wagon") || v.includes("estate")) return "Kombi";
  if (v.includes("ferde") || v.includes("hatchback")) return "Ferdehátú";
  if (v.includes("sedan") || v.includes("szedan")) return "Szedán";
  if (v.includes("egyteru") || v.includes("mpv")) return "Egyterű";
  if (v.includes("kupe") || v.includes("coupe")) return "Kupé";
  if (v.includes("cabrio")) return "Cabrio";
  return "";
}

export const REQUIRED_FORM_FIELDS = [
  "uzemanyag",
  "gyartasi_ev",
  "gyartmany",
  "modell",
  "tipus",
  "kivitel",
  "allapot",
  "okmany_jelleg",
  "km",
  "vetelar",
  "megye",
  "telepules",
  "telefon1_korzet",
  "telefon1_szam",
];

export function getMissingRequiredFields(formData) {
  return REQUIRED_FORM_FIELDS.filter((name) => !String(formData?.[name] ?? "").trim());
}

function applyRequiredDefaults(data, parsed, titleParts, m) {
  if (!data.km) data.km = resolveKm(parsed, m, titleParts);
  if (!data.gyartasi_ev) {
    data.gyartasi_ev = parseYearMonth(pickValue(m, ["évjárat", "gyártási év"]) || parsed.evjarat).ev;
  }
  if (!data.vetelar) data.vetelar = digits(parsed.ar || pickValue(m, ["vételár", "vetelar"]));
  if (!data.leiras) data.leiras = parsed.leiras || "";
  if (!data.kivitel) {
    data.kivitel =
      mapKivitel(pickValue(m, ["kivitel", "kategória", "kategoria", "szerkezeti változat", "szerkezeti valtozat"])) ||
      inferKivitelFromText(parsed.cim, titleParts.rest, parsed.jarmuTipus);
  }
  if (!data.allapot) {
    data.allapot = mapAllapot(pickValue(m, ["állapot", "allapot"])) || "Normál";
  }
  if (!data.okmany_jelleg) {
    data.okmany_jelleg =
      mapOkmanyJelleg(pickValue(m, ["okmányok jellege", "okmanyok jellege"])) ||
      "Érvényes magyar okmányokkal";
  }
  if (!data.tipus) {
    data.tipus = inferTipus(titleParts, parsed, m);
  }
  if (!data.uzemanyag) {
    data.uzemanyag =
      mapFuel(pickValue(m, ["üzemanyag", "uzemanyag"])) ||
      inferFuelFromHints(data.tipus, titleParts.rest, parsed.cim, parsed.cardText, parsed.jarmuTipus);
  }
  if (!data.modell && titleParts.modell) {
    data.modell = titleParts.modell;
  }
  if (!data.gyartmany && titleParts.gyartmany) {
    data.gyartmany = titleParts.gyartmany.toUpperCase();
  } else if (data.gyartmany) {
    data.gyartmany = String(data.gyartmany).toUpperCase();
  }
  if (!data.megye || !data.telepules) {
    const loc = mapCounty(
      pickValue(m, ["megtalálható", "megtalalhato", "település", "telepules", "megye", "elhelyezkedés"])
    );
    if (!data.megye) data.megye = loc.megye;
    if (!data.telepules) data.telepules = loc.telepules;
  }
  return data;
}

function mapCounty(location) {
  if (!location) return { megye: "", telepules: "" };
  const text = sanitizeListingFieldValue(location);
  if (!text) return { megye: "", telepules: "" };
  for (const county of COUNTY_NAMES) {
    if (normalizeKey(text).includes(normalizeKey(county))) {
      const telepules = text.replace(new RegExp(county, "i"), "").replace(/^[,·\s-]+/, "").trim();
      return { megye: county, telepules };
    }
  }
  return { megye: "", telepules: text };
}

function firstNumber(value) {
  const n = parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? String(n) : digits(value);
}

function ensureKmField(data, parsed, m, titleParts) {
  if (data.km) return;

  let km = extractOdometerKm({
    maps: [m],
    texts: [
      parsed.km,
      parsed.cardText,
      parsed.cim,
      parsed.jarmuTipus,
      parsed.leiras,
      titleParts.rest,
    ],
  });

  if (!km && parsed.km) km = kmDigitsFromValue(parsed.km);
  if (km !== "") data.km = km;
}

export function backfillKmInForm(form, parsed) {
  if (form?.km) return form;
  const km = kmDigitsFromValue(parsed?.km);
  if (km) return { ...form, km };
  return form;
}

export function mapListingToForm(parsed) {
  const m = parsed.nyersAdatok ?? {};
  const titleParts = parseTitleParts(parsed.cim || parsed.jarmuTipus || "");
  const gyartEv = parseYearMonth(
    pickValue(m, ["évjárat", "gyártási év"]) || parsed.evjarat
  );
  const forgalom = parseYearMonth(
    pickValue(m, [
      "első magyarországi forgalomba helyezés",
      "elso magyarorszagi forgalomba helyezes",
      "első forgalomba helyezés",
    ])
  );
  const muszaki = parseYearMonth(pickValue(m, ["műszaki vizsga érvényes", "muszaki vizsga"]));
  const power = parsePower(pickValue(m, ["teljesítmény", "teljesitmeny"]));
  const location = mapCounty(
    pickValue(m, ["megtalálható", "megtalalhato", "település", "telepules", "megye"])
  );
  const phone = parsePhoneParts(parsed.telefonszam);
  const arFt = digits(parsed.ar || pickValue(m, ["vételár", "vetelar"]));
  const arEur = digits(pickValue(m, ["ár (eur)", "ar (eur)", "eur"]));

  const data = {
    forras_url: parsed.url || "",
    hasznaltauto_hirdetes_id: extractListingId(parsed.url),
    hirdetes_cime: "",
    gyartmany: normalizeBrand(
      sanitizeListingFieldValue(
        String(
          titleParts.gyartmany ||
            pickValue(m, ["gyártmány", "gyartmany", "márka", "marka"]) ||
            ""
        )
      )
    ),
    modell: sanitizeListingFieldValue(
      titleParts.modell || pickValue(m, ["modell", "típusjel", "tipusjel"])
    ),
    tipus: sanitizeListingFieldValue(titleParts.rest || pickValue(m, ["típus", "tipus"])),
    kivitel: mapKivitel(
      pickValue(m, ["kivitel", "kategória", "kategoria", "szerkezeti változat", "szerkezeti valtozat"])
    ),
    egyeb_tipus: pickValue(m, ["egyéb típus", "egyeb tipus"]) || "",
    uzemanyag:
      mapFuel(pickValue(m, ["üzemanyag", "uzemanyag"])) ||
      inferFuelFromHints(
        pickValue(m, ["típus", "tipus"]),
        titleParts.rest,
        parsed.cim,
        parsed.cardText,
        parsed.jarmuTipus
      ),
    gyartasi_ev: gyartEv.ev,
    gyartasi_honap: gyartEv.honap,
    forgalomba_helyezes_ev: forgalom.ev,
    forgalomba_helyezes_honap: forgalom.honap,
    muszaki_ev: muszaki.ev,
    muszaki_honap: muszaki.honap,
    allapot: mapAllapot(pickValue(m, ["állapot", "allapot"])),
    km: resolveKm(parsed, m, titleParts),
    okmany_jelleg: mapOkmanyJelleg(pickValue(m, ["okmányok jellege", "okmanyok jellege"])),
    okmany_ervenyesseg: mapOkmanyErvenyesseg(
      pickValue(m, ["okmányok érvényessége", "okmanyok ervenyessege"])
    ),
    alvazszam: pickValue(m, ["alvázszám", "alvazszam", "vin"]),
    rendszam: pickValue(m, ["rendszám", "rendszam"]),
    tulajdonosok_szama: pickValue(m, ["tulajdonosok száma", "tulajdonos"]),
    ajtok: pickValue(m, ["ajtók száma", "ajtok szama", "ajtók"]),
    szemelyek: digits(pickValue(m, ["szállítható személyek száma", "szallithato szemelyek"])),
    hengerurtartalom: digits(pickValue(m, ["hengerűrtartalom", "hengerurtartalom"])),
    teljesitmeny_kw: power.kw,
    teljesitmeny_le: power.le,
    kornyezetvedelmi: pickValue(m, ["környezetvédelmi osztály", "kornyezetvedelmi osztaly"]),
    co2_kibocsatas: digits(pickValue(m, ["co2-kibocsátás", "co2 kibocsatas", "co2"])),
    fogyasztas_varosi: firstNumber(pickValue(m, ["városi fogyasztás", "varosi fogyasztas"])),
    fogyasztas_orszaguti: firstNumber(pickValue(m, ["országúti fogyasztás", "orszaguti fogyasztas"])),
    fogyasztas_kombinalt: firstNumber(pickValue(m, ["kombinált fogyasztás", "kombinalt fogyasztas"])),
    sebessegvalto: pickValue(m, ["sebességváltó", "sebessegvalto"]),
    hajtas: pickValue(m, ["hajtás", "hajtas", "meghajtás"]),
    henger_elrendezes: pickValue(m, ["henger-elrendezés", "henger elrendezes"]),
    sajat_tomeg: digits(pickValue(m, ["saját tömeg", "sajat tomeg"])),
    ossztomeg: digits(pickValue(m, ["össztömeg", "ossztomeg"])),
    szin: pickValue(m, ["szín", "szin"]),
    csomagtarto: digits(pickValue(m, ["csomagtartó", "csomagtarto"])),
    akkumulator_kwh: firstNumber(pickValue(m, ["akkumulátor kapacitás", "akkumulator kapacitas", "akkumulátor"])),
    hatotav: digits(pickValue(m, ["hatótáv", "hatotav", "elektromos hatótáv"])),
    tolto_csatlakozas: pickValue(m, ["töltőcsatlakozó", "tolto csatlakozas"]),
    vetelar: arFt,
    vetelar_eur: arEur,
    forgalomba_helyezes_ar: digits(
      pickValue(m, ["forgalomba helyezés ára", "magyarországi forgalomba helyezés"])
    ),
    leiras: sanitizeListingPlainText(parsed.leiras || ""),
    megye: sanitizeListingFieldValue(location.megye),
    telepules: sanitizeListingFieldValue(location.telepules),
    iranyitoszam: sanitizeListingFieldValue(pickValue(m, ["irányítószám", "iranyitoszam"])),
  };

  if (phone) {
    data.telefon1_orszag = phone.orszag;
    data.telefon1_korzet = phone.korzet;
    data.telefon1_szam = phone.szam;
  }

  const meta = pickValue(m, ["hirdetés azonosító", "hirdetes azonosito"]);
  if (meta && !data.hasznaltauto_hirdetes_id) {
    data.hasznaltauto_hirdetes_id = digits(meta);
  }

  applyRequiredDefaults(data, parsed, titleParts, m);
  applyFieldMap(data, m, parsed);

  const badges = parsed.felszereltseg ?? [];
  applyMuszakiFields(data, parsed, m, badges);
  applyExtrakFields(data, parsed, m, badges);
  data.hirdetes_cime = buildHirdetesCime(parsed, data);
  ensureKmField(data, parsed, m, titleParts);

  // applyFieldMap után is: ne maradjon Használtautó.hu / Belépés a hely/cím mezőkben
  for (const key of [
    "telepules",
    "megye",
    "megtekintesi_cim",
    "iranyitoszam",
    "gyartmany",
    "modell",
    "tipus",
    "leiras",
    "hirdetes_cime",
  ]) {
    if (!data[key]) continue;
    data[key] =
      key === "leiras" || key === "hirdetes_cime"
        ? sanitizeListingPlainText(data[key])
        : sanitizeListingFieldValue(data[key]);
  }

  if (data.gyartmany) data.gyartmany = normalizeBrand(data.gyartmany);
  if (!data.modell) {
    data.modell =
      findCatalogModel(data.gyartmany, data.tipus) ||
      findCatalogModel(data.gyartmany, parsed.cim) ||
      findCatalogModel(data.gyartmany, data.hirdetes_cime) ||
      "";
  }

  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== "" && value != null));
}

export function mapListingToFormWithSummary(parsed) {
  const form = backfillKmInForm(mapListingToForm(parsed), parsed);
  const importSummary = summarizeImportByStep(form);
  return {
    form,
    importSummary,
    importSummaryText: formatImportSummary(importSummary),
    missingRequired: getMissingRequiredFields(form),
  };
}

export function mapCardPreview(card, parsed) {
  const mapped = mapListingToFormWithSummary(parsed);
  return {
    url: card.url,
    cim:
      sanitizeListingFieldValue(parsed.cim || card.title || card.jarmuTipus || "") ||
      "—",
    ar: parsed.ar || card.ar || "—",
    km: parsed.km || card.km || "—",
    evjarat: parsed.evjarat || card.evjarat || "—",
    form: mapped.form,
    importSummary: mapped.importSummary,
    importSummaryText: mapped.importSummaryText,
    missingRequired: mapped.missingRequired,
  };
}
