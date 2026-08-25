import { pickValue, cleanText, normalizeKey } from "./parse-listing.mjs";
import { extractOdometerKm, kmDigitsFromValue } from "./extract-km.mjs";

/** Hasznaltauto.hu táblázat címkék → form mezőnév */
export const FIELD_ALIASES = {
  hirdetes_cime: ["cím", "cim", "hirdetés címe"],
  gyartmany: ["gyártmány", "gyartmany", "márka", "marka"],
  modell: ["modell"],
  tipus: ["típus", "tipus", "felszereltségi szint", "felszereltsegi szint"],
  egyeb_tipus: ["egyéb típus", "egyeb tipus"],
  kivitel: ["kivitel", "kategória", "kategoria", "szerkezeti változat", "szerkezeti valtozat", "karosszéria"],
  uzemanyag: ["üzemanyag", "uzemanyag"],
  allapot: ["állapot", "allapot"],
  km: [
    "futásteljesítmény",
    "futasteljesitmeny",
    "km óra állás",
    "km. óra állás",
    "km ora allas",
    "km. ora allas",
    "km óra állása",
    "kilométeróra",
    "kilometerora",
  ],
  okmany_jelleg: ["okmányok jellege", "okmanyok jellege"],
  okmany_ervenyesseg: ["okmányok érvényessége", "okmanyok ervenyessege"],
  alvazszam: ["alvázszám", "alvazszam", "vin"],
  rendszam: ["rendszám", "rendszam"],
  tulajdonosok_szama: ["tulajdonosok száma", "tulajdonos", "tulajdonosok"],
  ajtok: ["ajtók száma", "ajtok szama", "ajtók"],
  szemelyek: [
    "szállítható személyek száma",
    "szallithato szemelyek",
    "szállítható szem. száma",
    "szallithato szem szama",
    "szállítható szem",
    "ülések",
    "ulesek",
  ],
  hengerurtartalom: ["hengerűrtartalom", "hengerurtartalom", "cm³", "cm3"],
  kornyezetvedelmi: ["környezetvédelmi osztály", "kornyezetvedelmi osztaly", "euro norma", "euro"],
  co2_kibocsatas: ["co2-kibocsátás", "co2 kibocsatas", "co2"],
  fogyasztas_varosi: ["városi fogyasztás", "varosi fogyasztas"],
  fogyasztas_orszaguti: ["országúti fogyasztás", "orszaguti fogyasztas"],
  fogyasztas_kombinalt: ["kombinált fogyasztás", "kombinalt fogyasztas"],
  sebessegvalto: ["sebességváltó", "sebessegvalto", "váltó"],
  hajtas: ["hajtás", "hajtas", "meghajtás", "hajtómű"],
  henger_elrendezes: ["henger-elrendezés", "henger elrendezes"],
  sajat_tomeg: ["saját tömeg", "sajat tomeg"],
  ossztomeg: ["össztömeg", "ossztomeg"],
  szin: ["szín", "szin", "külső szín", "kulso szin"],
  karpit1: [
    "kárpit színe (1)",
    "karpit szine (1)",
    "kárpit színe",
    "karpit szine",
    "belső szín",
    "belso szin",
    "kárpit",
  ],
  karpit2: ["kárpit színe (2)", "karpit szine (2)"],
  klima: ["klíma fajtája", "klima fajtaja", "klíma", "klima", "klíma felszereltség"],
  tetto: ["tető", "teto"],
  csomagtarto: ["csomagtartó", "csomagtarto"],
  belso_azonosito: ["belső azonosító", "belso azonosito", "hirdetéskód", "hirdeteskod"],
  akkumulator_kwh: ["akkumulátor kapacitás", "akkumulator kapacitas", "akkumulátor"],
  hatotav: ["hatótáv", "hatotav", "elektromos hatótáv"],
  tolto_csatlakozas: ["töltőcsatlakozó", "tolto csatlakozas", "töltő csatlakozó"],
  vetelar: ["vételár", "vetelar", "ár", "ar", "hirdetési ár"],
  akcios_ar: ["akciós ár", "akcios ar", "kedvezményes ár"],
  vetelar_eur: ["ár (eur)", "ar (eur)", "eur ár"],
  forgalomba_helyezes_ar: ["forgalomba helyezés ára", "magyarországi forgalomba helyezés"],
  leiras: ["leírás", "leiras"],
  megye: ["megye"],
  telepules: ["település", "telepules", "megtalálható", "megtalalhato", "elhelyezkedés"],
  iranyitoszam: ["irányítószám", "iranyitoszam", "irsz"],
  megtekintesi_cim: ["megtekintési cím", "megtekintesi cim", "cím megtekintéshez"],
  email: ["e-mail", "email", "e-mail cím"],
  video_url: ["videó", "video", "youtube"],
  gyartasi_ev: ["évjárat", "gyártási év", "gyartasi ev"],
  forgalomba_helyezes_ev: [
    "első magyarországi forgalomba helyezés",
    "elso magyarorszagi forgalomba helyezes",
    "első forgalomba helyezés",
  ],
  muszaki_ev: ["műszaki vizsga érvényes", "muszaki vizsga", "műszaki érvényes"],
  nyari_gumi: ["nyári gumi méret", "nyari gumi meret", "nyári gumi", "gumi méret"],
  teli_gumi: ["téli gumi méret", "teli gumi meret", "téli gumi"],
  hatso_nyari_gumi: ["hátsó nyári gumi", "hatso nyari gumi"],
  hatso_teli_gumi: ["hátsó téli gumi", "hatso teli gumi"],
};

const ALIAS_TO_FIELD = new Map();
for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
  ALIAS_TO_FIELD.set(normalizeKey(field), field);
  for (const alias of aliases) {
    ALIAS_TO_FIELD.set(normalizeKey(alias), field);
  }
}

export function resolveFormField(label) {
  const key = normalizeKey(label);
  if (!key) return null;
  // Ne illesszünk „Címke: érték” egyben álló sorokat mezőnévként.
  if (key.includes(":") || /:\s*\S/.test(String(label ?? ""))) {
    const before = normalizeKey(String(label).split(":")[0] || "");
    if (ALIAS_TO_FIELD.has(before)) return ALIAS_TO_FIELD.get(before);
  }
  if (ALIAS_TO_FIELD.has(key)) return ALIAS_TO_FIELD.get(key);
  for (const [alias, field] of ALIAS_TO_FIELD) {
    if (alias.length < 6) continue;
    if (key === alias || key.startsWith(`${alias} `) || key.includes(` ${alias}`)) return field;
    if (key.includes(alias) && alias.length >= 10) return field;
  }
  return null;
}

function digits(value) {
  const match = String(value ?? "").match(/[\d\s.]+/);
  return match ? match[0].replace(/\s|\./g, "") : "";
}

function firstNumber(value) {
  const n = parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? String(n) : digits(value);
}

export function parseYearMonth(value) {
  if (!value) return { ev: "", honap: "" };
  const match = String(value).match(/(19|20)\d{2}(?:\/(\d{1,2}))?/);
  if (!match) {
    const yearOnly = String(value).match(/\b(19|20)\d{2}\b/);
    return { ev: yearOnly?.[0] ?? "", honap: "" };
  }
  return { ev: match[0].slice(0, 4), honap: match[2] ? String(Number(match[2])) : "" };
}

export function parseTireSize(value) {
  if (!value) return null;
  const match = String(value).match(/(\d{3})\s*\/\s*(\d{2})\s*R?\s*(\d{2})/i);
  if (!match) return null;
  return { szelesseg: match[1], magassag: match[2], atmero: match[3] };
}

export function mapTulajdonos(value) {
  const text = cleanText(value);
  if (!text) return "";
  if (/4\+|több|tobb/i.test(text)) return "4+";
  const n = parseInt(digits(text), 10);
  if (!Number.isFinite(n) || n <= 0) return text;
  if (n >= 4) return "4+";
  return String(n);
}

export function mapToltoCsatlakozas(value) {
  const v = normalizeKey(value);
  if (!v) return "";
  if (v.includes("type 2") || v.includes("type2")) return "Type 2";
  if (v.includes("ccs")) return "CCS";
  if (v.includes("chademo")) return "CHAdeMO";
  if (v.includes("schuko") || v.includes("halozati") || v.includes("hálózati")) return "Schuko / hálózati";
  return cleanText(value);
}

export function transformFieldValue(field, value) {
  const raw = cleanText(value);
  if (!raw) return "";

  switch (field) {
    case "km":
      return kmDigitsFromValue(raw) || digits(raw);
    case "vetelar":
    case "akcios_ar":
    case "vetelar_eur":
    case "forgalomba_helyezes_ar":
    case "hengerurtartalom":
    case "co2_kibocsatas":
    case "sajat_tomeg":
    case "ossztomeg":
    case "csomagtarto":
    case "hatotav":
    case "szemelyek":
      return digits(raw);
    case "fogyasztas_varosi":
    case "fogyasztas_orszaguti":
    case "fogyasztas_kombinalt":
    case "akkumulator_kwh":
      return firstNumber(raw);
    case "tulajdonosok_szama":
      return mapTulajdonos(raw);
    case "tolto_csatlakozas":
      return mapToltoCsatlakozas(raw);
    case "gyartmany":
      return raw.toUpperCase();
    default:
      return raw;
  }
}

export function applyFieldMap(data, m, parsed = {}) {
  for (const [label, value] of Object.entries(m)) {
    const field = resolveFormField(label);
    if (!field || data[field]) continue;
    const transformed = transformFieldValue(field, value);
    if (transformed) data[field] = transformed;
  }

  if (!data.teljesitmeny_kw || !data.teljesitmeny_le) {
    const powerRaw = pickValue(m, ["teljesítmény", "teljesitmeny", "max. teljesítmény"]);
    const kwMatch = String(powerRaw ?? "").match(/([\d.,]+)\s*kW/i);
    const leMatch = String(powerRaw ?? "").match(/([\d.,]+)\s*LE\b/i);
    if (!data.teljesitmeny_kw && kwMatch) data.teljesitmeny_kw = kwMatch[1].replace(",", ".");
    if (!data.teljesitmeny_le && leMatch) data.teljesitmeny_le = leMatch[1].replace(",", ".");
  }

  if (!data.gyartasi_ev || !data.gyartasi_honap) {
    const gy = parseYearMonth(
      pickValue(m, FIELD_ALIASES.gyartasi_ev) || parsed.evjarat || data.gyartasi_ev
    );
    if (!data.gyartasi_ev && gy.ev) data.gyartasi_ev = gy.ev;
    if (!data.gyartasi_honap && gy.honap) data.gyartasi_honap = gy.honap;
  }

  if (!data.forgalomba_helyezes_ev) {
    const fg = parseYearMonth(pickValue(m, FIELD_ALIASES.forgalomba_helyezes_ev));
    if (fg.ev) {
      data.forgalomba_helyezes_ev = fg.ev;
      if (fg.honap) data.forgalomba_helyezes_honap = fg.honap;
    }
  }

  if (!data.muszaki_ev) {
    const ms = parseYearMonth(pickValue(m, FIELD_ALIASES.muszaki_ev));
    if (ms.ev) {
      data.muszaki_ev = ms.ev;
      if (ms.honap) data.muszaki_honap = ms.honap;
    }
  }

  applyTireFields(data, m);
  applyFlagFields(data, parsed, m);
  applyContactFields(data, parsed, m);

  return data;
}

function applyTireFields(data, m) {
  const tireMap = [
    ["nyari_gumi", "nyari_gumi"],
    ["teli_gumi", "teli_gumi"],
    ["hatso_nyari_gumi", "hatso_nyari"],
    ["hatso_teli_gumi", "hatso_teli"],
  ];

  for (const [sourceKey, prefix] of tireMap) {
    const raw = pickValue(m, FIELD_ALIASES[sourceKey]);
    const tire = parseTireSize(raw);
    if (!tire) continue;
    if (!data[`${prefix}_szelesseg`]) data[`${prefix}_szelesseg`] = tire.szelesseg;
    if (!data[`${prefix}_magassag`]) data[`${prefix}_magassag`] = tire.magassag;
    if (!data[`${prefix}_atmero`]) data[`${prefix}_atmero`] = tire.atmero;
  }
}

function applyFlagFields(data, parsed, m) {
  const hay = normalizeKey(
    [parsed.leiras, parsed.cardText, ...Object.values(m)].filter(Boolean).join(" ")
  );

  if (!data.metalfeny && (/metalfeny|metál fény|metal/i.test(hay) || /metál/i.test(data.szin ?? ""))) {
    data.metalfeny = "1";
  }
  if (!data.alkudhato && /\balkudhat|alkuk[eé]pes|alkudni/i.test(hay)) {
    data.alkudhato = "1";
  }
  if (!data.csere && /\bcsere\b|csereert|csere érdekel/i.test(hay)) {
    data.csere = "1";
  }
  if (!data.felezo_valto && /felező váltó|felezo valto/i.test(hay)) {
    data.felezo_valto = "1";
  }
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

function extractPhones(...texts) {
  const found = [];
  const re = /(?:\+36|06)[\s\d/-]{7,16}\d/g;
  for (const text of texts) {
    for (const match of String(text ?? "").matchAll(re)) {
      const phone = cleanText(match[0]);
      if (!found.includes(phone)) found.push(phone);
    }
  }
  return found;
}

function applyContactFields(data, parsed, m) {
  if (!data.leiras && parsed.leiras) data.leiras = parsed.leiras;

  if (!data.megtekintesi_cim) {
    data.megtekintesi_cim =
      pickValue(m, FIELD_ALIASES.megtekintesi_cim) ||
      pickValue(m, ["cím", "cim"]) ||
      "";
  }

  if (!data.video_url) {
    const fromField = pickValue(m, FIELD_ALIASES.video_url);
    const fromLeiras = String(parsed.leiras ?? "").match(
      /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[\w-]+|youtu\.be\/[\w-]+)/i
    );
    data.video_url = fromField || fromLeiras?.[0] || "";
  }

  const phones = extractPhones(parsed.telefonszam, parsed.leiras, ...Object.values(m));
  const slots = [
    ["telefon1_orszag", "telefon1_korzet", "telefon1_szam"],
    ["telefon2_orszag", "telefon2_korzet", "telefon2_szam"],
    ["telefon3_orszag", "telefon3_korzet", "telefon3_szam"],
  ];

  for (let i = 0; i < phones.length && i < slots.length; i += 1) {
    const parts = parsePhoneParts(phones[i]);
    if (!parts) continue;
    const [orszagKey, korzetKey, szamKey] = slots[i];
    if (!data[korzetKey]) data[korzetKey] = parts.korzet;
    if (!data[szamKey]) data[szamKey] = parts.szam;
    if (!data[orszagKey]) data[orszagKey] = parts.orszag;
  }
}
