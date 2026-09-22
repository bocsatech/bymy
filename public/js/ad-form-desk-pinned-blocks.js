/** Live desk: ezek egy blokkban maradnak — layout cellák csoportosítva, admin stackben szintetikus csempe. */

export const TIRE_LAYOUT_GROUP_KEYS = new Set([
  "nyari_gumi_szelesseg",
  "nyari_gumi_magassag",
  "nyari_gumi_atmero",
  "teli_gumi_szelesseg",
  "teli_gumi_magassag",
  "teli_gumi_atmero",
]);

export const EV_LAYOUT_GROUP_KEYS = new Set([
  "akkumulator_kwh",
  "jelenlegi_akkukapacitas",
  "ac_tolto_csatlakozas",
  "ac_toltesi_teljesitmeny",
  "dc_tolto_csatlakozas",
  "dc_toltesi_teljesitmeny",
  "hatotav",
  "autopalya_hatotav",
  "teli_hatotav",
  "tolto_csatlakozas",
  "villamtoltes",
  "zold_rendszam",
]);

/** Használtautó desk „Műszaki adatok” — admin stack és éles canvas ugyanilyen sorrendben. */
export const DESK_MUSZAKI_CORE_FIELD_KEYS = ["uzemanyag", "hengerurtartalom", "teljesitmeny_kw"];

export const DESK_STEP2_CANONICAL_STACK = [
  "__desk_tire_sizes__",
  "uzemanyag",
  "hengerurtartalom",
  "teljesitmeny_kw",
  "fogyasztas_varosi",
  "fogyasztas_orszaguti",
  "fogyasztas_kombinalt",
  "__desk_electric_block__",
  "sebessegvalto",
  "hajtas",
  "sajat_tomeg",
  "ossztomeg",
  "nyomatek_nm",
  "rakter_terfogat",
  "rakter_hossz",
  "rakter_szelesseg",
  "rakter_magassag",
  "ajtok",
  "szemelyek",
  "csomagtarto",
  "tetto",
  "szin",
  "karpit1",
  "karpit2",
];

const CANONICAL_RANK = new Map(DESK_STEP2_CANONICAL_STACK.map((key, index) => [key, index]));

export function deskStep2CanonicalRank(fieldKey) {
  const key = String(fieldKey || "");
  if (CANONICAL_RANK.has(key)) return CANONICAL_RANK.get(key);
  return 900 + (CANONICAL_RANK.size || 0);
}

export function sortDeskStep2StackItems(items) {
  return [...items].sort(
    (a, b) =>
      deskStep2CanonicalRank(a.field_key) - deskStep2CanonicalRank(b.field_key) ||
      (Number(a.row) || 1) - (Number(b.row) || 1) ||
      (Number(a.order) || 0) - (Number(b.order) || 0) ||
      String(a.field_key).localeCompare(String(b.field_key))
  );
}

export const DESK_STEP2_PINNED_BLOCKS = [
  {
    syntheticKey: "__desk_tire_sizes__",
    label: "Gumi méretek (nyári + téli)",
    anchorKeys: TIRE_LAYOUT_GROUP_KEYS,
    domId: "tire-sizes-card",
  },
  {
    syntheticKey: "__desk_electric_block__",
    label: "Elektromos / hibrid mezők",
    anchorKeys: EV_LAYOUT_GROUP_KEYS,
    domId: "electric-fields-block",
  },
];

const SYNTHETIC_BY_KEY = new Map(DESK_STEP2_PINNED_BLOCKS.map((b) => [b.syntheticKey, b]));

export function isDeskSyntheticFieldKey(fieldKey) {
  return SYNTHETIC_BY_KEY.has(fieldKey);
}

export function deskPinnedGroupKeys() {
  const keys = new Set();
  for (const block of DESK_STEP2_PINNED_BLOCKS) {
    for (const k of block.anchorKeys) keys.add(k);
  }
  return keys;
}

const PINNED_ANCHOR_LABELS = {
  nyari_gumi_szelesseg: "Nyári gumi szélesség",
  nyari_gumi_magassag: "Nyári gumi magasság",
  nyari_gumi_atmero: "Nyári gumi átmérő",
  teli_gumi_szelesseg: "Téli gumi szélesség",
  teli_gumi_magassag: "Téli gumi magasság",
  teli_gumi_atmero: "Téli gumi átmérő",
  akkumulator_kwh: "Akkumulátor kapacitás",
  jelenlegi_akkukapacitas: "Jelenlegi akkukapacitás",
  ac_toltesi_teljesitmeny: "AC töltési teljesítmény",
  dc_toltesi_teljesitmeny: "DC töltési teljesítmény",
  ac_tolto_csatlakozas: "AC töltőcsatlakozó típusa",
  dc_tolto_csatlakozas: "DC töltőcsatlakozó típusa",
  hatotav: "WLTP hatótáv",
  autopalya_hatotav: "Autópálya hatótáv",
  teli_hatotav: "Téli hatótáv",
  villamtoltes: "Villámtöltés",
  zold_rendszam: "Zöld rendszám",
  tolto_csatlakozas: "Töltőcsatlakozó",
};

/** Admin desk: hiányzó gumi/EV layout cellák pótlása (akár csak néhány kulcs). */
export function ensureDeskPinnedAnchorCells(cells, byKey) {
  if (!Array.isArray(cells) || !byKey) return false;
  let changed = false;
  for (const block of DESK_STEP2_PINNED_BLOCKS) {
    const row = deskStep2CanonicalRank(block.syntheticKey) + 1;
    for (const key of block.anchorKeys) {
      if (byKey.get(key)) continue;
      const cell = {
        field_key: key,
        label: PINNED_ANCHOR_LABELS[key] || key,
        step: 2,
        row,
        col: 1,
        colSpan: 12,
        order: row * 12,
        hidden: false,
      };
      cells.push(cell);
      byKey.set(key, cell);
      changed = true;
    }
  }
  return changed;
}

export function restorePinnedBlockAnchors(byKey, syntheticKey) {
  const block = SYNTHETIC_BY_KEY.get(syntheticKey);
  if (!block) return false;
  let changed = false;
  for (const key of block.anchorKeys) {
    const cell = byKey.get(key);
    if (!cell || !cell.hidden) continue;
    cell.hidden = false;
    changed = true;
  }
  return changed;
}

export function hiddenPinnedAnchorCount(byKey, syntheticKey) {
  const block = SYNTHETIC_BY_KEY.get(syntheticKey);
  if (!block) return 0;
  let n = 0;
  for (const key of block.anchorKeys) {
    const cell = byKey.get(key);
    if (cell?.hidden) n += 1;
  }
  return n;
}

export function anchorCellsForBlock(byKey, block, step) {
  const cells = [...block.anchorKeys].map((k) => byKey.get(k)).filter(Boolean);
  const visible = cells.filter((cell) => !cell.hidden);
  const pool = visible.length ? visible : cells;
  if (step !== 2) return pool.filter((cell) => Number(cell.step) === step);
  return pool;
}

export function minAnchorRow(cells) {
  if (!cells.length) return null;
  let min = Infinity;
  for (const cell of cells) {
    min = Math.min(min, Number(cell.row) || 1);
  }
  return Number.isFinite(min) ? min : null;
}

export function collapsePinnedAnchorRows(byKey, step) {
  for (const block of DESK_STEP2_PINNED_BLOCKS) {
    const anchors = anchorCellsForBlock(byKey, block, step);
    if (!anchors.length) continue;
    const row = minAnchorRow(anchors) ?? 1;
    for (const cell of anchors) {
      cell.row = row;
      cell.col = 1;
      cell.colSpan = 12;
      cell.order = row;
    }
  }
}

export function applySyntheticStackRow(byKey, syntheticKey, row, step, { col = 1, colSpan = 12 } = {}) {
  const block = SYNTHETIC_BY_KEY.get(syntheticKey);
  if (!block) return;
  const c = clampCol(col);
  const span = clampColSpan(colSpan, c);
  for (const key of block.anchorKeys) {
    const cell = byKey.get(key);
    if (!cell) continue;
    cell.step = step;
    cell.row = row;
    cell.col = c;
    cell.colSpan = span;
    cell.order = (row - 1) * 12 + c;
  }
}

function clampCol(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(12, Math.max(1, Math.round(n)));
}

function clampColSpan(span, col) {
  const n = Number(span);
  const s = Number.isFinite(n) ? Math.round(n) : 12;
  return Math.min(12, Math.max(1, s), 13 - col);
}

export function hideSyntheticAnchors(byKey, syntheticKey) {
  const block = SYNTHETIC_BY_KEY.get(syntheticKey);
  if (!block) return;
  for (const key of block.anchorKeys) {
    const cell = byKey.get(key);
    if (cell) cell.hidden = true;
  }
}

export function layoutRowForPinnedBlock(cells, anchorKeys) {
  const anchors = (cells || []).filter((c) => anchorKeys.has(c.field_key) && !c.hidden);
  if (anchors.length) return minAnchorRow(anchors) ?? 1;
  const any = (cells || []).filter((c) => anchorKeys.has(c.field_key));
  if (any.length) return minAnchorRow(any) ?? 1;
  return 1;
}

export function insertPinnedDomBlock(canvas, blockEl, layoutRow) {
  if (!canvas || !blockEl) return;
  blockEl.classList.add("ad-desk-pinned-block");
  blockEl.dataset.layoutRow = String(layoutRow);
  const siblings = [...canvas.children].filter(
    (el) => el !== blockEl && (el.matches(".ad-layout-item:not(.ad-layout-hidden)") || el.matches(".ad-desk-pinned-block"))
  );
  const insertBefore = siblings.find((el) => {
    const r = Number(el.dataset?.layoutRow);
    return Number.isFinite(r) && r > layoutRow;
  });
  if (insertBefore) canvas.insertBefore(blockEl, insertBefore);
  else canvas.appendChild(blockEl);
}
