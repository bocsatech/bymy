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

export function anchorCellsForBlock(byKey, block, step) {
  return [...block.anchorKeys]
    .map((k) => byKey.get(k))
    .filter((cell) => cell && Number(cell.step) === step);
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

export function applySyntheticStackRow(byKey, syntheticKey, row, step) {
  const block = SYNTHETIC_BY_KEY.get(syntheticKey);
  if (!block) return;
  for (const key of block.anchorKeys) {
    const cell = byKey.get(key);
    if (!cell) continue;
    cell.step = step;
    cell.row = row;
    cell.col = 1;
    cell.colSpan = 12;
    cell.order = row;
  }
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
