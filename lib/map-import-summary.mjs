/** Mezők lépésenként — egyezik a form füleivel (4. lépés = képek, nincs import). */
export const FIELDS_BY_STEP = {
  1: [
    "uzemanyag",
    "hirdetes_cime",
    "gyartasi_ev",
    "gyartasi_honap",
    "forgalomba_helyezes_ev",
    "forgalomba_helyezes_honap",
    "muszaki_ev",
    "muszaki_honap",
    "allapot",
    "gyartmany",
    "modell",
    "tipus",
    "egyeb_tipus",
    "kivitel",
    "okmany_jelleg",
    "okmany_ervenyesseg",
    "km",
    "alvazszam",
    "rendszam",
    "tulajdonosok_szama",
  ],
  2: [
    "ajtok",
    "szemelyek",
    "hengerurtartalom",
    "teljesitmeny_kw",
    "teljesitmeny_le",
    "kornyezetvedelmi",
    "co2_kibocsatas",
    "fogyasztas_varosi",
    "fogyasztas_orszaguti",
    "fogyasztas_kombinalt",
    "sebessegvalto",
    "felezo_valto",
    "hajtas",
    "henger_elrendezes",
    "sajat_tomeg",
    "ossztomeg",
    "karpit1",
    "karpit2",
    "szin",
    "metalfeny",
    "tetto",
    "csomagtarto",
    "belso_azonosito",
    "akkumulator_kwh",
    "hatotav",
    "tolto_csatlakozas",
    "nyari_gumi_szelesseg",
    "nyari_gumi_magassag",
    "nyari_gumi_atmero",
    "hatso_nyari_szelesseg",
    "hatso_nyari_magassag",
    "hatso_nyari_atmero",
    "teli_gumi_szelesseg",
    "teli_gumi_magassag",
    "teli_gumi_atmero",
    "hatso_teli_szelesseg",
    "hatso_teli_magassag",
    "hatso_teli_atmero",
  ],
  3: ["klima", "felszereltseg", "nem_dohanyzo", "holgy_tulajdonos"],
  5: [
    "vetelar",
    "akcios_ar",
    "vetelar_eur",
    "forgalomba_helyezes_ar",
    "alkudhato",
    "csere",
    "leiras",
    "megye",
    "telepules",
    "iranyitoszam",
    "megtekintesi_cim",
    "email",
    "telefon1_korzet",
    "telefon1_szam",
    "telefon2_korzet",
    "telefon2_szam",
    "telefon3_korzet",
    "telefon3_szam",
    "video_url",
    "forras_url",
    "hasznaltauto_hirdetes_id",
  ],
};

const STEP_LABELS = {
  1: "Alapadatok",
  2: "Műszaki adatok",
  3: "Extrák",
  5: "Hirdetés",
};

function isFilled(form, field) {
  const value = form?.[field];
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function summarizeImportByStep(form) {
  const summary = {};
  for (const [step, fields] of Object.entries(FIELDS_BY_STEP)) {
    const filled = fields.filter((field) => isFilled(form, field));
    summary[step] = {
      label: STEP_LABELS[step],
      filled,
      filledCount: filled.length,
      totalCount: fields.length,
    };
  }
  return summary;
}

export function formatImportSummary(summary) {
  const lines = [];
  for (const step of ["1", "2", "3", "5"]) {
    const s = summary[step];
    if (!s) continue;
    lines.push(`${s.label}: ${s.filledCount}/${s.totalCount} mező`);
  }
  return lines.join("\n");
}
