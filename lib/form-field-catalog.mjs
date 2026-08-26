/** Látható űrlapmezők címkéi — segéd-, jogi és instrukciós szövegek NINCSENEK benne. */
export const DROPPED_FORM_FIELD_KEYS = [
  "okmany_ervenyesseg",
  "kornyezetvedelmi",
  "co2_kibocsatas",
  "henger_elrendezes",
  "belso_azonosito",
  "hatso_nyari_szelesseg",
  "hatso_nyari_magassag",
  "hatso_nyari_atmero",
  "hatso_nyari_kulon",
  "hatso_teli_szelesseg",
  "hatso_teli_magassag",
  "hatso_teli_atmero",
  "hatso_teli_kulon",
  "tipus_katalogus",
  "felezo_valto",
  "metalfeny",
];

export const FORM_FIELD_CATALOG = [
  { field_key: "uzemanyag", label: "Üzemanyag", step: 2 },
  { field_key: "hirdetes_cime", label: "Hirdetés címe", step: 1 },
  { field_key: "hirdetes_vertical", label: "Hirdetés kategória", step: 1 },
  { field_key: "hirdetes_alkategoria", label: "Hirdetés alkategória", step: 1 },
  { field_key: "gyartasi_ev", label: "Gyártási év", step: 1 },
  { field_key: "gyartasi_honap", label: "Gyártási hónap", step: 1 },
  { field_key: "forgalomba_helyezes_ev", label: "Első magyarországi forgalomba helyezés (év)", step: 1 },
  { field_key: "forgalomba_helyezes_honap", label: "Első magyarországi forgalomba helyezés (hónap)", step: 1 },
  { field_key: "muszaki_ev", label: "Műszaki vizsga érvényes (év)", step: 1 },
  { field_key: "muszaki_honap", label: "Műszaki vizsga érvényes (hónap)", step: 1 },
  { field_key: "allapot", label: "Állapot", step: 1 },
  { field_key: "gyartmany", label: "Gyártmány", step: 1 },
  { field_key: "modell", label: "Modell", step: 1 },
  { field_key: "egyeb_modell", label: "Egyéb modell", step: 1 },
  { field_key: "tipus", label: "Típus", step: 1 },
  { field_key: "egyeb_tipus", label: "Egyéb típus", step: 1 },
  { field_key: "kivitel", label: "Kivitel", step: 1 },
  { field_key: "ajtok", label: "Ajtók száma", step: 1 },
  { field_key: "szemelyek", label: "Szállítható szem. száma", step: 1 },
  { field_key: "okmany_jelleg", label: "Okmányok jellege", step: 1 },
  { field_key: "km", label: "Km. óra állás", step: 1 },
  { field_key: "alvazszam", label: "Alvázszám", step: 1 },
  { field_key: "rendszam", label: "Rendszám", step: 1 },
  { field_key: "tulajdonosok_szama", label: "Tulajdonosok száma", step: 1 },
  { field_key: "hengerurtartalom", label: "Hengerűrtartalom", step: 2 },
  { field_key: "teljesitmeny_kw", label: "Teljesítmény (kW)", step: 2 },
  { field_key: "teljesitmeny_le", label: "Teljesítmény (LE)", step: 2 },
  { field_key: "fogyasztas_varosi", label: "Városi fogyasztás", step: 2 },
  { field_key: "fogyasztas_orszaguti", label: "Országúti fogyasztás", step: 2 },
  { field_key: "fogyasztas_kombinalt", label: "Kombinált fogyasztás", step: 2 },
  { field_key: "sebessegvalto", label: "Sebességváltó", step: 2 },
  { field_key: "hajtas", label: "Hajtás", step: 2 },
  { field_key: "sajat_tomeg", label: "Saját tömeg", step: 2 },
  { field_key: "ossztomeg", label: "Össztömeg", step: 2 },
  { field_key: "nyomatek_nm", label: "Nyomaték (Nm)", step: 2 },
  { field_key: "rakter_terfogat", label: "Raktér térfogata (m³)", step: 2 },
  { field_key: "rakter_hossz", label: "Raktér hossza (m)", step: 2 },
  { field_key: "rakter_szelesseg", label: "Raktér szélessége (m)", step: 2 },
  { field_key: "rakter_magassag", label: "Raktér magassága (m)", step: 2 },
  { field_key: "karpit1", label: "Kárpit színe (1)", step: 2 },
  { field_key: "karpit2", label: "Kárpit színe (2)", step: 2 },
  { field_key: "szin", label: "Szín", step: 2 },
  { field_key: "tetto", label: "Tető", step: 2 },
  { field_key: "csomagtarto", label: "Csomagtartó", step: 2 },
  { field_key: "akkumulator_kwh", label: "Akkumulátor kapacitás", step: 2 },
  { field_key: "hatotav", label: "Hatótáv", step: 2 },
  { field_key: "tolto_csatlakozas", label: "Töltőcsatlakozó", step: 2 },
  { field_key: "nyari_gumi_szelesseg", label: "Nyári gumi szélesség", step: 2 },
  { field_key: "nyari_gumi_magassag", label: "Nyári gumi magasság", step: 2 },
  { field_key: "nyari_gumi_atmero", label: "Nyári gumi átmérő", step: 2 },
  { field_key: "teli_gumi_szelesseg", label: "Téli gumi szélesség", step: 2 },
  { field_key: "teli_gumi_magassag", label: "Téli gumi magasság", step: 2 },
  { field_key: "teli_gumi_atmero", label: "Téli gumi átmérő", step: 2 },
  { field_key: "klima", label: "Klíma", step: 3 },
  { field_key: "nem_dohanyzo", label: "Nem dohányzó", step: 3 },
  { field_key: "holgy_tulajdonos", label: "Hölgy tulajdonostól", step: 3 },
  { field_key: "hitel", label: "Hitel", step: 5 },
  { field_key: "kezdo_reszlet", label: "Kezdőrészlet", step: 5 },
  { field_key: "havi_reszlet", label: "Havi részlet", step: 5 },
  { field_key: "futamido", label: "Futamidő", step: 5 },
  { field_key: "berelheto", label: "Bérelhető", step: 5 },
  { field_key: "beszelt_nyelvek", label: "Beszélt nyelvek", step: 5 },
  { field_key: "vetelar", label: "Vételár", step: 5 },
  { field_key: "akcios_ar", label: "Akciós ár", step: 5 },
  { field_key: "vetelar_eur", label: "Ár (EUR)", step: 5 },
  { field_key: "forgalomba_helyezes_ar", label: "Forgalomba helyezés ára", step: 5 },
  { field_key: "alkudhato", label: "Alkudható", step: 5 },
  { field_key: "csere", label: "Csere érdekel", step: 5 },
  { field_key: "leiras", label: "Leírás", step: 5 },
  { field_key: "megye", label: "Megye", step: 5 },
  { field_key: "telepules", label: "Település", step: 5 },
  { field_key: "iranyitoszam", label: "Irányítószám", step: 5 },
  { field_key: "keresesi_korzet", label: "Keresési körzet", step: 5 },
  { field_key: "megtekintesi_cim", label: "Megtekintési cím", step: 5 },
  { field_key: "email_megjelenik", label: "Megjelenjen az email címe", step: 5 },
  { field_key: "email", label: "E-mail", step: 5 },
  { field_key: "telefon1_orszag", label: "Telefon 1 országkód", step: 5 },
  { field_key: "telefon1_korzet", label: "Telefon 1 körzet", step: 5 },
  { field_key: "telefon1_szam", label: "Telefon 1 szám", step: 5 },
  { field_key: "telefon2_orszag", label: "Telefon 2 országkód", step: 5 },
  { field_key: "telefon2_korzet", label: "Telefon 2 körzet", step: 5 },
  { field_key: "telefon2_szam", label: "Telefon 2 szám", step: 5 },
  { field_key: "telefon3_orszag", label: "Telefon 3 országkód", step: 5 },
  { field_key: "telefon3_korzet", label: "Telefon 3 körzet", step: 5 },
  { field_key: "telefon3_szam", label: "Telefon 3 szám", step: 5 },
  { field_key: "fotok", label: "Fotók", step: 4 },
  { field_key: "owner_user_id", label: "Tulajdonos", step: 9 },
  { field_key: "views_web", label: "Web megtekintés", step: 9 },
  { field_key: "views_app", label: "App megtekintés", step: 9 },
  { field_key: "video_url", label: "Videó link", step: 5 },
  { field_key: "forras_url", label: "Forrás URL", step: 5 },
  { field_key: "hasznaltauto_hirdetes_id", label: "Hasznaltauto hirdetés azonosító", step: 5 },
];

const LABEL_BY_KEY = new Map(FORM_FIELD_CATALOG.map((f) => [f.field_key, f.label]));

export function labelForField(fieldKey) {
  return LABEL_BY_KEY.get(fieldKey) ?? fieldKey;
}

export function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
}

function hasValue(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  return String(value).trim() !== "";
}

/** Űrlap adat → DB cellák (felirat + érték, segéd szövegek nélkül). */
export function formDataToCells(formData) {
  const cells = [];
  if (!formData || typeof formData !== "object") return cells;

  for (const def of FORM_FIELD_CATALOG) {
    const value = formData[def.field_key];
    if (!hasValue(value)) continue;
    cells.push({
      field_key: def.field_key,
      label: def.label,
      value: String(value).trim(),
      step: def.step,
    });
  }

  for (const item of formData.felszereltseg ?? []) {
    const text = String(item).trim();
    if (!text) continue;
    cells.push({
      field_key: `extra:${slugify(text)}`,
      label: text,
      value: "1",
      step: 3,
    });
  }

  for (const item of formData.egyeb_info ?? []) {
    const text = String(item).trim();
    if (!text) continue;
    cells.push({
      field_key: `info:${slugify(text)}`,
      label: text,
      value: "1",
      step: 3,
    });
  }

  return cells;
}

/** DB cellák → űrlap adat. */
export function cellsToFormData(cells) {
  const data = {};
  const felszereltseg = [];
  const egyeb_info = [];

  for (const cell of cells ?? []) {
    if (cell.field_key?.startsWith("extra:")) {
      felszereltseg.push(cell.label);
    } else if (cell.field_key?.startsWith("info:")) {
      egyeb_info.push(cell.label);
    } else if (cell.field_key) {
      data[cell.field_key] = cell.value;
    }
  }

  if (felszereltseg.length) data.felszereltseg = felszereltseg;
  if (egyeb_info.length) data.egyeb_info = egyeb_info;
  return data;
}
