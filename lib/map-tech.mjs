import { cleanText, normalizeKey, pickValue } from "./parse-listing.mjs";
import { ALL_FORM_EQUIPMENT, EQUIPMENT_ALIASES, KLIM_OPTIONS } from "./equipment-catalog.mjs";

export function parseSummarySpecs(text) {
  const map = {};
  if (!text) return map;

  const ccMatch = text.match(/([\d\s.]+)\s*cm³/i);
  if (ccMatch) map.Hengerűrtartalom = ccMatch[1].replace(/\s|\./g, "");

  const kwMatch = text.match(/([\d.,]+)\s*kW/i);
  const leMatch = text.match(/([\d.,]+)\s*LE\b/i);
  if (kwMatch && leMatch) {
    map.Teljesítmény = `${kwMatch[1].replace(",", ".")} kW / ${leMatch[1].replace(",", ".")} LE`;
  } else if (kwMatch) {
    map.Teljesítmény = `${kwMatch[1].replace(",", ".")} kW`;
  } else if (leMatch) {
    map.Teljesítmény = `${leMatch[1].replace(",", ".")} LE`;
  }

  const doorsMatch = text.match(/(\d)\s*ajtó/i);
  if (doorsMatch) map["Ajtók száma"] = doorsMatch[1];

  const seatsMatch = text.match(/(\d)\s*fő/i);
  if (seatsMatch) map["Szállítható személyek száma"] = seatsMatch[1];

  if (/\bcvt\b/i.test(text)) map["Sebességváltó"] = "CVT automata";
  else if (/\bautomata\b/i.test(text)) map["Sebességváltó"] = "Automata";
  else if (/\bmanuális\b/i.test(text)) map["Sebességváltó"] = "Manuális";

  const hatotavMatch =
    text.match(/\bLE,\s*(\d[\d\s.]*)\s*km\b/i) ||
    text.match(/,\s*(\d[\d\s.]*)\s*km\s*$/i);
  if (hatotavMatch && /\bhibrid|elektromos|phev|ev\b/i.test(text)) {
    map["Hatótáv"] = hatotavMatch[1].replace(/\s|\./g, "");
  }

  if (/\b(4x4|awd|összkerék|összkerekes)\b/i.test(text)) map.Hajtás = "Összkerék";
  else if (/\b(hátsó|hátsókerék)\b/i.test(text)) map.Hajtás = "Hátsó kerék";
  else if (/\b(első|elsőkerék|fwd)\b/i.test(text)) map.Hajtás = "Első kerék";

  return map;
}

export function mapSebessegvalto(value, hints = "") {
  const v = normalizeKey(`${value} ${hints}`);
  if (!v) return "";
  if (v.includes("cvt") || v.includes("fokozatmentes") || v.includes("e-cvt")) return "Fokozatmentes automata";
  if (v.includes("automata")) return "Automata";
  if (v.includes("manuális") && v.includes("6")) return "Manuális (6 seb.)";
  if (v.includes("manuális") && v.includes("5")) return "Manuális (5 seb.)";
  if (v.includes("manuális")) return "Manuális (6 seb.)";
  return cleanText(value);
}

export function mapHajtas(value) {
  const v = normalizeKey(value);
  if (!v) return "";
  if (v.includes("osszker") || v.includes("4x4") || v.includes("awd") || v.includes("4wd")) return "Összkerék";
  if (v.includes("hatso")) return "Hátsó kerék";
  if (v.includes("elso") || v.includes("fwd")) return "Első kerék";
  return cleanText(value);
}

export function mapHengerElrendezes(value) {
  const v = normalizeKey(value);
  if (!v) return "";
  if (v.includes("boxer") || v.includes("dobos")) return "Boxer";
  if (v === "v" || v.includes(" v ")) return "V";
  if (v.includes("w")) return "W";
  if (v.includes("sor")) return "Sor";
  return cleanText(value);
}

export function mapKlima(value, badges = [], extraText = "") {
  const v = normalizeKey([value, ...badges, extraText].filter(Boolean).join(" "));
  if (!v) return "";
  if (v.includes("hoszivattyu") || v.includes("hőszivattyú")) return "hőszivattyús klíma";
  if (v.includes("tobbzona") || v.includes("többzónás")) return "digitális többzónás klíma";
  if (v.includes("ketzone") || v.includes("kétzónás")) return "digitális kétzónás klíma";
  if (v.includes("digitalis") || v.includes("digitális")) return "digitális klíma";
  if (v.includes("manualis") && v.includes("klima")) return "manuális klíma";
  if (v.includes("automata") && v.includes("klima")) return "automata klíma";
  if (/\bklima\b|\bklíma\b/.test(v) && !v.includes("nincs")) return "automata klíma";
  return "";
}

function hayIncludes(hay, token) {
  const key = normalizeKey(token);
  if (!key || key.length < 2) return false;
  return hay.includes(key);
}

function matchAlias(hay, canonical, aliases) {
  if (hayIncludes(hay, canonical)) return true;
  return aliases.some((alias) => hayIncludes(hay, alias));
}

export function splitEquipmentTokens(text) {
  if (!text) return [];
  return String(text)
    .split(/[,;|•·\n/]+/)
    .map((part) => cleanText(part))
    .filter((part) => part.length > 1 && part.length < 80);
}

export function mapEquipmentFromSources({ badges = [], texts = [] } = {}) {
  const found = new Set();
  const parts = [...badges, ...texts.flatMap((text) => splitEquipmentTokens(text)), ...texts];
  const hay = normalizeKey(parts.filter(Boolean).join(" "));

  for (const [canonical, aliases] of EQUIPMENT_ALIASES) {
    if (matchAlias(hay, canonical, aliases)) found.add(canonical);
  }

  const sorted = [...ALL_FORM_EQUIPMENT].sort((a, b) => b.length - a.length);
  for (const item of sorted) {
    if (hayIncludes(hay, item)) found.add(item);
  }

  return [...found];
}

export function mapEquipmentFromBadges(badges = [], extraText = "") {
  return mapEquipmentFromSources({ badges, texts: extraText ? [extraText] : [] });
}

export function mapOwnerFlags(texts = []) {
  const hay = normalizeKey(texts.filter(Boolean).join(" "));
  return {
    nem_dohanyzo: /\bnem dohanyzo\b|dohanyzasmentes/.test(hay) ? "1" : "",
    holgy_tulajdonos: /\bholgy tulajdon|noi tulajdon|asszony tulajdon/.test(hay) ? "1" : "",
  };
}

export function applyExtrakFields(data, parsed, m, badges = []) {
  const textSources = [
    parsed.leiras,
    parsed.cardText,
    parsed.bodyText,
    pickValue(m, ["felszereltség", "felszereltseg", "extrák", "extrak", "extra felszereltség"]),
    pickValue(m, ["klíma", "klima", "klíma fajtája", "klima fajtaja", "klíma felszereltség", "klima felszereltseg"]),
    ...badges,
  ].filter(Boolean);

  const equipment = mapEquipmentFromSources({
    badges,
    texts: textSources,
  });

  if (equipment.length) {
    data.felszereltseg = equipment;
  }

  const klimaRaw =
    pickValue(m, ["klíma fajtája", "klima fajtaja", "klíma", "klima", "klíma felszereltség", "klima felszereltseg"]) ||
    data.klima;
  const klima = mapKlima(klimaRaw, badges, textSources.join(" "));
  if (klima && KLIM_OPTIONS.includes(klima)) {
    data.klima = klima;
  } else if (!data.klima && /\bklima\b|\bklíma\b/i.test(textSources.join(" "))) {
    data.klima = "automata klíma";
  }

  const flags = mapOwnerFlags(textSources);
  if (flags.nem_dohanyzo) data.nem_dohanyzo = flags.nem_dohanyzo;
  if (flags.holgy_tulajdonos) data.holgy_tulajdonos = flags.holgy_tulajdonos;

  if (equipment.includes("nem dohányzó") && !data.nem_dohanyzo) {
    data.nem_dohanyzo = "1";
  }

  return data;
}

export function applyMuszakiFields(data, parsed, m, badges = []) {
  const hints = [parsed.cim, parsed.jarmuTipus, parsed.leiras, parsed.cardText, parsed.bodyText, ...badges]
    .filter(Boolean)
    .join(" ");
  const summarySpecs = parseSummarySpecs(hints);
  const merged = { ...summarySpecs, ...m };

  const powerRaw = pickValue(merged, ["teljesítmény", "teljesitmeny", "max. teljesítmény"]);
  if (!data.hengerurtartalom) {
    data.hengerurtartalom = digitsOnly(
      pickValue(merged, ["hengerűrtartalom", "hengerurtartalom", "cm³", "cm3"])
    );
  }
  if (!data.teljesitmeny_kw || !data.teljesitmeny_le) {
    const kwMatch = String(powerRaw ?? hints).match(/([\d.,]+)\s*kW/i);
    const leMatch = String(powerRaw ?? hints).match(/([\d.,]+)\s*LE\b/i);
    if (!data.teljesitmeny_kw && kwMatch) data.teljesitmeny_kw = kwMatch[1].replace(",", ".");
    if (!data.teljesitmeny_le && leMatch) data.teljesitmeny_le = leMatch[1].replace(",", ".");
  }
  if (!data.sebessegvalto) {
    data.sebessegvalto = mapSebessegvalto(
      pickValue(merged, ["sebességváltó", "sebessegvalto", "váltó"]),
      hints
    );
  } else {
    const normalized = mapSebessegvalto(data.sebessegvalto, hints);
    if (normalized) data.sebessegvalto = normalized;
  }
  if (!data.hajtas) {
    data.hajtas = mapHajtas(pickValue(merged, ["hajtás", "hajtas", "meghajtás", "hajtómű"]));
  } else {
    const normalized = mapHajtas(data.hajtas);
    if (normalized) data.hajtas = normalized;
  }
  if (!data.henger_elrendezes) {
    data.henger_elrendezes = mapHengerElrendezes(
      pickValue(merged, ["henger-elrendezés", "henger elrendezes"])
    );
  }
  if (!data.ajtok) data.ajtok = pickValue(merged, ["ajtók száma", "ajtok szama", "ajtók"]);
  if (!data.szemelyek) {
    data.szemelyek = digitsOnly(
      pickValue(merged, [
        "szállítható személyek száma",
        "szallithato szemelyek",
        "szállítható szem. száma",
        "szallithato szem szama",
        "ülések",
      ])
    );
  }
  if (!data.szin) data.szin = pickValue(merged, ["szín", "szin", "külső szín"]);
  if (!data.karpit1) {
    data.karpit1 = pickValue(merged, ["kárpit színe (1)", "karpit szine (1)", "kárpit színe", "karpit szine"]);
  }
  if (!data.sajat_tomeg) data.sajat_tomeg = digitsOnly(pickValue(merged, ["saját tömeg", "sajat tomeg"]));
  if (!data.ossztomeg) data.ossztomeg = digitsOnly(pickValue(merged, ["össztömeg", "ossztomeg"]));
  if (!data.csomagtarto) data.csomagtarto = digitsOnly(pickValue(merged, ["csomagtartó", "csomagtarto"]));
  if (!data.klima) {
    data.klima = mapKlima(
      pickValue(merged, ["klíma fajtája", "klima fajtaja", "klíma", "klima", "klíma felszereltség"]),
      badges,
      hints
    );
  }
  if (!data.co2_kibocsatas) {
    data.co2_kibocsatas = digitsOnly(pickValue(merged, ["co2-kibocsátás", "co2 kibocsatas", "co2"]));
  }
  if (!data.fogyasztas_varosi) {
    data.fogyasztas_varosi = firstNumber(pickValue(merged, ["városi fogyasztás", "varosi fogyasztas"]));
  }
  if (!data.fogyasztas_orszaguti) {
    data.fogyasztas_orszaguti = firstNumber(pickValue(merged, ["országúti fogyasztás", "orszaguti fogyasztas"]));
  }
  if (!data.fogyasztas_kombinalt) {
    data.fogyasztas_kombinalt = firstNumber(pickValue(merged, ["kombinált fogyasztás", "kombinalt fogyasztas"]));
  }
  if (!data.kornyezetvedelmi) {
    data.kornyezetvedelmi = pickValue(merged, ["környezetvédelmi osztály", "kornyezetvedelmi osztaly", "euro"]);
  }
  if (!data.akkumulator_kwh) {
    data.akkumulator_kwh = firstNumber(pickValue(merged, ["akkumulátor kapacitás", "akkumulator kapacitas", "akkumulátor"]));
  }
  if (!data.hatotav) {
    data.hatotav = digitsOnly(pickValue(merged, ["hatótáv", "hatotav", "elektromos hatótáv"]));
  }
  if (!data.tolto_csatlakozas) {
    data.tolto_csatlakozas = pickValue(merged, ["töltőcsatlakozó", "tolto csatlakozas", "töltő csatlakozó"]);
  }

  return data;
}

function digitsOnly(value) {
  const match = String(value ?? "").match(/[\d\s.]+/);
  return match ? match[0].replace(/\s|\./g, "") : "";
}

function firstNumber(value) {
  const n = parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? String(n) : digitsOnly(value);
}
