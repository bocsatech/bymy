/**
 * Ingatlan kereső + feladás közös kerék-séma (sorrend / elrendezés / üres sorok).
 * Kategória (Eladó/Kiadó/Airbnb) NEM része — csak az élő oldalon.
 */

export const INGATLAN_WHEEL_SCHEMA_KEY = "ingatlan_wheel_schema_v1";
export const WHEEL_COLS = 12;

/** Admin: Kiadó (master) + Eladó + Airbnb — külön mentés, másolat a masterről. */
export const INGATLAN_WHEEL_ADMIN_CATEGORIES = ["ingatlan", "elado-ingatlan", "airbnb"];

export function normalizeIngatlanWheelVariant(value) {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  if (v === "elado-ingatlan" || v === "elado_ingatlan" || v === "eladoingatlan") return "elado-ingatlan";
  if (v === "airbnb") return "airbnb";
  return "ingatlan";
}

export function ingatlanWheelSchemaKvKey(variant) {
  switch (normalizeIngatlanWheelVariant(variant)) {
    case "elado-ingatlan":
      return "elado_ingatlan_wheel_schema_v1";
    case "airbnb":
      return "airbnb_wheel_schema_v1";
    default:
      return INGATLAN_WHEEL_SCHEMA_KEY;
  }
}

export function isIngatlanWheelAdminCategory(category) {
  const v = String(category ?? "")
    .trim()
    .toLowerCase();
  if (v === "elado-ingatlan" || v === "elado_ingatlan" || v === "eladoingatlan") return true;
  if (v === "airbnb") return true;
  if (v === "ingatlan") return true;
  return false;
}

/**
 * Élő keresőn osztott (min–max) kerék blokkok.
 * Adminban egy csempeként jelennek meg; a mezőkulcsok változatlanok.
 */
export const INGATLAN_DUAL_RANGE_GROUPS = [
  {
    id: "ar",
    title: "Ár",
    adminLabel: "Ár (min–max beírás · millió Ft / Ft)",
    tolKey: "ar_tol",
    igKey: "ar_ig",
    unit: "",
    ariaLabel: "Ár tartomány",
  },
  {
    id: "alapterulet",
    title: "Alapterület",
    adminLabel: "Alapterület (osztott kerék · min–max)",
    tolKey: "alapterulet_tol",
    igKey: "alapterulet_ig",
    unit: "m²",
    ariaLabel: "Alapterület tartomány",
  },
  {
    id: "emelet",
    title: "Emelet",
    adminLabel: "Emelet (osztott kerék · min–max)",
    tolKey: "emelet_tol",
    igKey: "emelet_ig",
    unit: "",
    ariaLabel: "Emelet tartomány",
  },
  {
    id: "telekterulet",
    title: "Telekterület",
    adminLabel: "Telekterület (osztott kerék · min–max)",
    tolKey: "telekterulet_tol",
    igKey: "telekterulet_ig",
    unit: "m²",
    ariaLabel: "Telekterület tartomány",
  },
  {
    id: "szintek",
    title: "Szintek száma",
    adminLabel: "Szintek száma (osztott kerék · min–max)",
    tolKey: "szintek_tol",
    igKey: "szintek_ig",
    unit: "emelet",
    ariaLabel: "Szintek száma tartomány",
  },
  {
    id: "uzemeltetesi_dij",
    title: "Üzemeltetési díj",
    adminLabel: "Üzemeltetési díj (osztott kerék · min–max)",
    tolKey: "uzemeltetesi_dij_tol",
    igKey: "uzemeltetesi_dij_ig",
    unit: "Ft",
    ariaLabel: "Üzemeltetési díj tartomány",
  },
  {
    id: "epitmeny_terulet",
    title: "Építmény területe",
    adminLabel: "Esetleges építmény területe (osztott kerék · min–max)",
    tolKey: "epitmeny_terulet_tol",
    igKey: "epitmeny_terulet_ig",
    unit: "m²",
    ariaLabel: "Építmény terület tartomány",
  },
];

/** Mezőkatalógus — surfaces: search | post */
export const INGATLAN_WHEEL_FIELD_DEFS = [
  { field_key: "keresesi_hely", label: "Település", kind: "text", surfaces: ["search"] },
  { field_key: "ar_tol", label: "Ár · min", kind: "wheel", surfaces: ["search"] },
  { field_key: "ar_ig", label: "Ár · max", kind: "wheel", surfaces: ["search"] },
  { field_key: "alapterulet_tol", label: "Alapterület · min", kind: "wheel", surfaces: ["search"] },
  { field_key: "alapterulet_ig", label: "Alapterület · max", kind: "wheel", surfaces: ["search"] },
  { field_key: "alapterulet", label: "Alapterület (feladás)", kind: "wheel", surfaces: ["post"] },
  { field_key: "szobaszam", label: "Szobaszám", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "ingatlan_lakas_tipus", label: "Típus", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "ingatlan_tipus_2", label: "Típus 2", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "allapot", label: "Állapot", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "ingatlan_kora", label: "Építés éve", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "min_berleti_ido", label: "Minimum bérleti idő", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "butorozott", label: "Bútorozott", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "kilatas", label: "Kilátás", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "tajolas", label: "Tájolás", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "futes", label: "Fűtés módja", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "parkolas", label: "Parkolás", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "komfort", label: "Komfort", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "tetoter", label: "Tetőtér", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "furdo_wc", label: "Fürdő és WC", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "emelet", label: "Emelet (feladás)", kind: "wheel", surfaces: ["post"] },
  { field_key: "emelet_tol", label: "Emelet · min", kind: "wheel", surfaces: ["search"] },
  { field_key: "emelet_ig", label: "Emelet · max", kind: "wheel", surfaces: ["search"] },
  { field_key: "belmagassag", label: "Belmagasság", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "koltozheto", label: "Mikortól költözhető", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "villany", label: "Villany", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "viz", label: "Víz", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "gaz", label: "Gáz", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "csatorna", label: "Csatorna", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "irodahaz_kategoria", label: "Irodaház kategóriája", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "telekterulet_tol", label: "Telekterület · min", kind: "wheel", surfaces: ["search"] },
  { field_key: "telekterulet_ig", label: "Telekterület · max", kind: "wheel", surfaces: ["search"] },
  { field_key: "szintek_tol", label: "Szintek · min", kind: "wheel", surfaces: ["search"] },
  { field_key: "szintek_ig", label: "Szintek · max", kind: "wheel", surfaces: ["search"] },
  { field_key: "uzemeltetesi_dij_tol", label: "Üzemeltetési díj · min", kind: "wheel", surfaces: ["search"] },
  { field_key: "uzemeltetesi_dij_ig", label: "Üzemeltetési díj · max", kind: "wheel", surfaces: ["search"] },
  { field_key: "kaucio_max", label: "Kaució mértéke", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "epitmeny_terulet_tol", label: "Építmény terület · min", kind: "wheel", surfaces: ["search"] },
  { field_key: "epitmeny_terulet_ig", label: "Építmény terület · max", kind: "wheel", surfaces: ["search"] },
  { field_key: "lift", label: "Lift", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "erkely", label: "Erkély", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "szigeteles", label: "Szigetelés", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "energiahatekonys", label: "Energiahatékony", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "akadalymentesitett", label: "Akadálymentesített", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "legkondicionalo", label: "Légkondicionáló", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "kertkapcsolatos", label: "Kertkapcsolatos", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "panelprogram", label: "Panelprogram", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "gepesitett", label: "Gépesített", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "kisallat_megengedett", label: "Kisállat hozható", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "dohanyzas_megengedett", label: "Dohányzás megengedett", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "pince", label: "Pince", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "napelem", label: "Napelem", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "uj_parcellazasu", label: "Csak új parcellázású", kind: "wheel", surfaces: ["search", "post"] },
  { field_key: "ar_ft_min", label: "Ár Ft min. (régi)", kind: "wheel", surfaces: ["search"] },
];

const DEF_BY_KEY = new Map(INGATLAN_WHEEL_FIELD_DEFS.map((d) => [d.field_key, d]));

function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.round(v)));
}

function isSpacer(cell) {
  return cell?.type === "spacer" || String(cell?.field_key || "").startsWith("__spacer");
}

function defaultPlacementRaw() {
  return [
    { field_key: "keresesi_hely", section: "main", row: 1, col: 1, colSpan: 12, hidden: false },
    { field_key: "ar_tol", section: "main", row: 2, col: 1, colSpan: 6, hidden: false },
    { field_key: "ar_ig", section: "main", row: 2, col: 7, colSpan: 6, hidden: false },
    { field_key: "alapterulet_tol", section: "main", row: 3, col: 1, colSpan: 6, hidden: false },
    { field_key: "alapterulet_ig", section: "main", row: 3, col: 7, colSpan: 6, hidden: false },
    { field_key: "szobaszam", section: "main", row: 4, col: 1, colSpan: 3, hidden: false },
    /* Fő szűrők legalja — meglévő sorok (1–4) érintetlenek. */
    { field_key: "ingatlan_tipus_2", section: "main", row: 5, col: 1, colSpan: 6, hidden: false },
    { field_key: "alapterulet", section: "more", row: 12, col: 1, colSpan: 6, hidden: false },
    { field_key: "ingatlan_lakas_tipus", section: "more", row: 1, col: 1, colSpan: 6, hidden: false },
    { field_key: "allapot", section: "more", row: 1, col: 7, colSpan: 6, hidden: false },
    { field_key: "ingatlan_kora", section: "more", row: 2, col: 1, colSpan: 6, hidden: false },
    { field_key: "min_berleti_ido", section: "more", row: 2, col: 7, colSpan: 6, hidden: false },
    { field_key: "butorozott", section: "more", row: 3, col: 1, colSpan: 6, hidden: false },
    { field_key: "kilatas", section: "more", row: 3, col: 7, colSpan: 6, hidden: false },
    { field_key: "tajolas", section: "more", row: 4, col: 1, colSpan: 6, hidden: false },
    { field_key: "futes", section: "more", row: 4, col: 7, colSpan: 6, hidden: false },
    { field_key: "parkolas", section: "more", row: 5, col: 1, colSpan: 6, hidden: false },
    { field_key: "komfort", section: "more", row: 5, col: 7, colSpan: 6, hidden: false },
    { field_key: "tetoter", section: "more", row: 6, col: 1, colSpan: 6, hidden: false },
    { field_key: "furdo_wc", section: "more", row: 6, col: 7, colSpan: 6, hidden: false },
    { field_key: "emelet_tol", section: "more", row: 7, col: 1, colSpan: 6, hidden: false },
    { field_key: "emelet_ig", section: "more", row: 7, col: 7, colSpan: 6, hidden: false },
    { field_key: "emelet", section: "more", row: 12, col: 7, colSpan: 6, hidden: false },
    { field_key: "belmagassag", section: "more", row: 8, col: 1, colSpan: 6, hidden: false },
    { field_key: "koltozheto", section: "more", row: 8, col: 7, colSpan: 6, hidden: false },
    { field_key: "lift", section: "more", row: 9, col: 1, colSpan: 3, hidden: false },
    { field_key: "erkely", section: "more", row: 9, col: 4, colSpan: 3, hidden: false },
    { field_key: "szigeteles", section: "more", row: 9, col: 7, colSpan: 3, hidden: false },
    { field_key: "energiahatekonys", section: "more", row: 9, col: 10, colSpan: 3, hidden: false },
    { field_key: "akadalymentesitett", section: "more", row: 10, col: 1, colSpan: 3, hidden: false },
    { field_key: "legkondicionalo", section: "more", row: 10, col: 4, colSpan: 3, hidden: false },
    { field_key: "kertkapcsolatos", section: "more", row: 10, col: 7, colSpan: 3, hidden: false },
    { field_key: "panelprogram", section: "more", row: 10, col: 10, colSpan: 3, hidden: false },
    { field_key: "gepesitett", section: "more", row: 11, col: 1, colSpan: 3, hidden: false },
    { field_key: "kisallat_megengedett", section: "more", row: 11, col: 4, colSpan: 3, hidden: false },
    { field_key: "dohanyzas_megengedett", section: "more", row: 11, col: 7, colSpan: 3, hidden: false },
    { field_key: "pince", section: "more", row: 13, col: 1, colSpan: 3, hidden: false },
    { field_key: "napelem", section: "more", row: 13, col: 4, colSpan: 3, hidden: false },
    { field_key: "uj_parcellazasu", section: "more", row: 13, col: 7, colSpan: 3, hidden: false },
    { field_key: "villany", section: "more", row: 14, col: 1, colSpan: 3, hidden: false },
    { field_key: "viz", section: "more", row: 14, col: 4, colSpan: 3, hidden: false },
    { field_key: "gaz", section: "more", row: 14, col: 7, colSpan: 3, hidden: false },
    { field_key: "csatorna", section: "more", row: 14, col: 10, colSpan: 3, hidden: false },
    { field_key: "irodahaz_kategoria", section: "more", row: 15, col: 1, colSpan: 6, hidden: false },
    { field_key: "kaucio_max", section: "more", row: 15, col: 7, colSpan: 6, hidden: false },
    { field_key: "telekterulet_tol", section: "more", row: 16, col: 1, colSpan: 6, hidden: false },
    { field_key: "telekterulet_ig", section: "more", row: 16, col: 7, colSpan: 6, hidden: false },
    { field_key: "szintek_tol", section: "more", row: 17, col: 1, colSpan: 6, hidden: false },
    { field_key: "szintek_ig", section: "more", row: 17, col: 7, colSpan: 6, hidden: false },
    { field_key: "uzemeltetesi_dij_tol", section: "more", row: 18, col: 1, colSpan: 6, hidden: false },
    { field_key: "uzemeltetesi_dij_ig", section: "more", row: 18, col: 7, colSpan: 6, hidden: false },
    { field_key: "epitmeny_terulet_tol", section: "more", row: 19, col: 1, colSpan: 6, hidden: false },
    { field_key: "epitmeny_terulet_ig", section: "more", row: 19, col: 7, colSpan: 6, hidden: false },
    { field_key: "ar_ft_min", section: "more", row: 11, col: 10, colSpan: 3, hidden: true },
  ];
}

/** Osztott min–max párok: közös sor/szekció, szélesség és elhelyezés megőrzése. */
export function syncDualRangeCells(cells) {
  const map = new Map(cells.filter((c) => !isSpacer(c)).map((c) => [c.field_key, c]));
  for (const g of INGATLAN_DUAL_RANGE_GROUPS) {
    const tol = map.get(g.tolKey);
    const ig = map.get(g.igKey);
    if (!tol || !ig) continue;
    if (tol.hidden !== ig.hidden) {
      const show = !tol.hidden || !ig.hidden;
      tol.hidden = !show;
      ig.hidden = !show;
    }
    const section = tol.section === "more" || ig.section === "more" ? "more" : "main";
    tol.section = section;
    ig.section = section;
    ig.row = tol.row;

    const totalSpan = clamp(Number(tol.colSpan) + Number(ig.colSpan), 2, WHEEL_COLS);
    let startCol = clamp(Math.min(Number(tol.col) || 1, Number(ig.col) || 1), 1, WHEEL_COLS);
    if (startCol + totalSpan - 1 > WHEEL_COLS) {
      startCol = Math.max(1, WHEEL_COLS - totalSpan + 1);
    }

    let leftSpan = clamp(Number(tol.colSpan) || 1, 1, totalSpan - 1);
    let rightSpan = totalSpan - leftSpan;
    if (rightSpan < 1) {
      leftSpan = Math.max(1, Math.floor(totalSpan / 2));
      rightSpan = totalSpan - leftSpan;
    }

    tol.col = startCol;
    tol.colSpan = leftSpan;
    ig.col = startCol + leftSpan;
    ig.colSpan = rightSpan;
  }
}

export function dualGroupForField(fieldKey) {
  return INGATLAN_DUAL_RANGE_GROUPS.find((g) => g.tolKey === fieldKey || g.igKey === fieldKey) || null;
}

const FALLBACK_BY_KEY = new Map(defaultPlacementRaw().map((c) => [c.field_key, c]));

export function normalizeIngatlanWheelSchema(raw) {
  const incoming = raw && typeof raw === "object" ? raw : {};
  const byKey = new Map();
  const spacers = [];
  let spacerSeq = 0;

  for (const cell of Array.isArray(incoming.cells) ? incoming.cells : []) {
    if (isSpacer(cell)) {
      spacerSeq += 1;
      const id = String(cell.field_key || "").startsWith("__spacer")
        ? cell.field_key
        : `__spacer_${spacerSeq}_${Date.now().toString(36)}`;
      spacers.push({
        type: "spacer",
        field_key: id,
        label: "Üres sor",
        section: cell.section === "more" ? "more" : "main",
        row: clamp(cell.row, 1, 40),
        col: 1,
        colSpan: WHEEL_COLS,
        hidden: Boolean(cell.hidden),
      });
      continue;
    }
    const key = String(cell.field_key || "");
    if (!DEF_BY_KEY.has(key)) continue;
    byKey.set(key, cell);
  }

  const cells = [];
  for (const def of INGATLAN_WHEEL_FIELD_DEFS) {
    const prev = byKey.get(def.field_key) || {};
    const fallback = FALLBACK_BY_KEY.get(def.field_key) || {
      section: "more",
      row: 20,
      col: 1,
      colSpan: 6,
      hidden: true,
    };
    const col = clamp(prev.col ?? fallback.col, 1, WHEEL_COLS);
    let colSpan = clamp(prev.colSpan ?? fallback.colSpan, 1, WHEEL_COLS);
    if (col + colSpan - 1 > WHEEL_COLS) colSpan = WHEEL_COLS - col + 1;
    const section =
      prev.section === "main" || prev.section === "more" ? prev.section : fallback.section;
    cells.push({
      field_key: def.field_key,
      label: def.label,
      kind: def.kind,
      surfaces: [...def.surfaces],
      section,
      row: clamp(prev.row ?? fallback.row, 1, 40),
      col,
      colSpan,
      hidden: prev.hidden != null ? Boolean(prev.hidden) : Boolean(fallback.hidden),
    });
  }

  for (const sp of spacers) cells.push(sp);
  syncDualRangeCells(cells);

  /* Típus 2 csak akkor kap alap pozíciót, ha még soha nem volt a sémában.
     Mentett elrendezést (main/more/hidden) soha ne írjuk felül. */
  const tip2 = cells.find((c) => c.field_key === "ingatlan_tipus_2");
  if (tip2 && !byKey.has("ingatlan_tipus_2")) {
    const maxMain = Math.max(
      0,
      ...cells
        .filter((c) => c.section === "main" && c.field_key !== "ingatlan_tipus_2" && !isSpacer(c))
        .map((c) => Number(c.row) || 0)
    );
    tip2.section = "main";
    tip2.row = Math.max(5, maxMain + 1);
    tip2.col = 1;
    tip2.colSpan = 6;
    tip2.hidden = false;
  }

  cells.sort((a, b) => {
    const sa = a.section === "more" ? 1 : 0;
    const sb = b.section === "more" ? 1 : 0;
    if (sa !== sb) return sa - sb;
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });

  return { version: 1, cells };
}

export function defaultIngatlanWheelSchema() {
  return normalizeIngatlanWheelSchema({ version: 1, cells: defaultPlacementRaw() });
}

export function cellsForSurface(schema, surface) {
  const s = surface === "post" ? "post" : "search";
  return (schema?.cells || []).filter((cell) => {
    if (cell.hidden) return false;
    if (isSpacer(cell)) return true;
    const def = DEF_BY_KEY.get(cell.field_key);
    return def?.surfaces?.includes(s);
  });
}

export function fieldDef(fieldKey) {
  return DEF_BY_KEY.get(fieldKey) || null;
}

export function createSpacerCell(section = "main", row = 1) {
  return {
    type: "spacer",
    field_key: `__spacer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    label: "Üres sor",
    section: section === "more" ? "more" : "main",
    row: clamp(row, 1, 40),
    col: 1,
    colSpan: WHEEL_COLS,
    hidden: false,
  };
}
