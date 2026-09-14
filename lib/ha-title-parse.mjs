/** HA admin / lista címsor → gyártmány, modell, típus (gold import mintájára). */

const MULTI_BRANDS = [
  "MERCEDES-BENZ",
  "MERCEDES BENZ",
  "LAND ROVER",
  "ALFA ROMEO",
  "ASTON MARTIN",
  "ROLLS-ROYCE",
  "ROLLS ROYCE",
  "RANGE ROVER",
];

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function isNoiseTitle(line) {
  const v = clean(line);
  if (!v || v.length < 4) return true;
  return /^(hirdetés|importált autó|javascript|hiba!|módosítás|törlés)/i.test(v);
}

/**
 * @param {string} title — pl. „MERCEDES-BENZ E 250 CDI 4Matic Classic (Automata)”
 * @returns {{ gyartmany: string, modell: string, tipus: string, vehicleTitle: string }}
 */
export function parseVehicleTitleFields(title) {
  const vehicleTitle = clean(String(title || "").split(/\n+/)[0]);
  if (!vehicleTitle || isNoiseTitle(vehicleTitle)) {
    return { gyartmany: "", modell: "", tipus: "", vehicleTitle: "" };
  }

  const upper = vehicleTitle.toLocaleUpperCase("hu-HU");
  let gyartmany = "";
  let rest = vehicleTitle;

  for (const name of MULTI_BRANDS) {
    if (upper.startsWith(name)) {
      gyartmany = vehicleTitle.slice(0, name.length).trim();
      rest = vehicleTitle.slice(name.length).trim();
      break;
    }
  }

  const tokens = rest.split(/\s+/).filter(Boolean);
  if (!gyartmany && tokens.length) {
    gyartmany = tokens.shift();
    rest = tokens.join(" ");
  } else if (gyartmany) {
    // rest already set
  } else {
    rest = "";
  }

  let modell = "";
  let tipus = "";
  if (tokens.length || rest) {
    const parts = (rest || tokens.join(" ")).split(/\s+/).filter(Boolean);
    if (parts.length) {
      modell = parts[0];
      tipus = parts.slice(1).join(" ");
    }
  }

  return {
    gyartmany: normalizeGyartmanyForCatalog(gyartmany),
    modell,
    tipus,
    vehicleTitle,
  };
}

/** Katalógus-selectekhez: MERCEDES-BENZ, KIA, stb. */
export function normalizeGyartmanyForCatalog(brand) {
  const v = clean(brand);
  if (!v) return "";
  const upper = v.toLocaleUpperCase("hu-HU").replace(/\s+/g, " ");
  if (/^MERCEDES[\s-]?BENZ$/i.test(upper) || upper === "MERCEDES") return "MERCEDES-BENZ";
  if (upper === "VW") return "VOLKSWAGEN";
  return upper;
}

/** HTML / fixture: cím a CDN thumb-hoz tartozó kártyában. */
export function findListingTitleInHtml(html, listingId) {
  const raw = String(html || "");
  const id = String(listingId || "").trim();
  if (!id) return "";
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const tries = [
    new RegExp(`data-id=["']${esc}["'][\\s\\S]{0,4000}?class=["'][^"']*\\bcim\\b[^"']*["'][^>]*>([^<]+)<`, "i"),
    new RegExp(`class=["'][^"']*\\bcim\\b[^"']*["'][^>]*href=["'][^"']*${esc}[^"']*["'][^>]*>([^<]+)<`, "i"),
    new RegExp(`href=["'][^"']*${esc}[^"']*["'][^>]*>([^<]{4,160})<`, "i"),
    new RegExp(`-${esc}(?:["'/]|</)[^>]*>([^<]{4,160})<`, "i"),
    new RegExp(`gyorsnezet[^"']*${esc}["'][^>]*>([^<]{4,160})<`, "i"),
  ];
  for (const re of tries) {
    const m = raw.match(re);
    const t = clean(m?.[1] || "");
    if (t && !isNoiseTitle(t)) return t;
  }
  return "";
}

export function enrichDealerCarsWithTitles(cars, html) {
  const raw = String(html || "");
  return (Array.isArray(cars) ? cars : []).map((car) => {
    const visibleTitle = clean(car.visibleTitle || findListingTitleInHtml(raw, car.listingId));
    if (!visibleTitle) return car;
    const fields = parseVehicleTitleFields(visibleTitle);
    return {
      ...car,
      visibleTitle,
      gyartmany: normalizeGyartmanyForCatalog(fields.gyartmany),
      modell: fields.modell,
      tipus: fields.tipus,
    };
  });
}
