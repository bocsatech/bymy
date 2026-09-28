/**
 * HA Kishaszon dump often includes személyautó models/brands.
 * Keep only models that look like light-commercial, and brands that have at least one.
 */

function norm(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** True commercial / LCV / pickup model names. */
export const KISTEHER_COMMERCIAL_RE =
  /\b(TRANSIT|TRANSPORTER|CRAFTER|SPRINTER|VITO|CITAN|DOBLO|DUCATO|BOXER|JUMPER|EXPERT|PARTNER|BERLINGO|KANGOO|TRAFIC|TRAFFIC|MASTER|MOVANO|VIVARO|COMBO|CONNECT|COURIER|RANGER|NAVARA|HILUX|L200|AMAROK|D-?MAX|PORTER|DAILY|MASSIF|ETP3|DELIVER|CARGO|FURGON|PICK-?UP|PLAT[OÓ]|ALV[AÁ]Z|MULTIVAN|CARAVELLE|PROACE|TOWNSTAR|EXPRESS|NV200|NV250|NV300|NV400|INTERSTAR|PRIMASTAR|TALENTO|SCUDO|JUMPY|SPACETOURER|TRAVELLER|CUSTOM|VARIO|T1\/TN|MB100|BIPPER|FIORINO|CADDY|RELAY|NEMO|MASCOTT|MAXITY|DYNA|EQV|E-?VITO|E-?TRANSIT|E-?DELIVER|CORSA COMBO|SILVERADO|F ?1[45]0|F ?250|F SERIES|ECONOLINE|TGE|H ?100|H ?350|K2500|K2700|K2900|PREGIO|CANTER|ATLEON|CABSTAR|NP300|TRADE|INCA|PRAKTIK|APE|STREETSCOOTER|WORK|C25|N-SZÉRIA|TUNLAND|LOGISTAR|VN5|FUMO|TREMO|MUSSO|TELCOLINE|E 2200|B1000|G3|LUBLIN)\b/i;

function collectSzemelyNames(szemelyCatalog) {
  const set = new Set();
  if (!szemelyCatalog) return set;
  for (const [brand, models] of Object.entries(szemelyCatalog.modellek || {})) {
    for (const m of models || []) set.add(`${brand}|${norm(m)}`);
  }
  for (const [brand, tree] of Object.entries(szemelyCatalog.modellekTree || {})) {
    const walk = (nodes) => {
      for (const n of nodes || []) {
        set.add(`${brand}|${norm(n.name)}`);
        walk(n.children);
      }
    };
    walk(tree);
  }
  return set;
}

function isCommercialModel(name) {
  return KISTEHER_COMMERCIAL_RE.test(name) || /^EGY[EÉ]B$/i.test(name);
}

function keepModel(brand, name, szemelyNames) {
  const n = norm(name);
  if (!n) return false;
  if (isCommercialModel(name)) return true;
  if (szemelyNames.has(`${brand}|${n}`)) return false;
  return false;
}

function filterTree(brand, tree, szemelyNames) {
  const out = [];
  for (const node of tree || []) {
    const kids = filterTree(brand, node.children || [], szemelyNames);
    const keepSelf = keepModel(brand, node.name, szemelyNames);
    if (keepSelf) {
      out.push({ ...node, children: kids, postRequiresChild: kids.length > 0 });
    } else if (kids.length) {
      out.push({ ...node, children: kids, postRequiresChild: true });
    }
  }
  return out;
}

function flattenNames(tree) {
  const out = [];
  const walk = (nodes) => {
    for (const n of nodes || []) {
      if (n.name) out.push(n.name);
      walk(n.children);
    }
  };
  walk(tree);
  return [...new Set(out)];
}

function hasCommercialModel(names) {
  return names.some((n) => KISTEHER_COMMERCIAL_RE.test(n));
}

export function cleanKisteherCatalog(rawCatalog, szemelyCatalog = null) {
  const szemelyNames = collectSzemelyNames(szemelyCatalog);
  const newTree = {};
  const newFlat = {};
  const brands = [];
  const removed = [];
  let modelCount = 0;
  let childCount = 0;
  let groups = 0;

  for (const brand of rawCatalog.gyartmanyok || []) {
    const filtered = filterTree(brand, rawCatalog.modellekTree?.[brand] || [], szemelyNames);
    const names = flattenNames(filtered);
    if (!hasCommercialModel(names)) {
      removed.push(brand);
      continue;
    }
    brands.push(brand);
    newTree[brand] = filtered;
    newFlat[brand] = names;
    for (const n of filtered) {
      modelCount += 1;
      if (n.children?.length) {
        groups += 1;
        childCount += n.children.length;
        for (const c of n.children) childCount += c.children?.length || 0;
      }
    }
  }

  return {
    ...rawCatalog,
    category: "kisteher",
    imported_at: new Date().toISOString(),
    count_rows: modelCount + childCount,
    count_brands: brands.length,
    count_models: modelCount,
    count_model_children: childCount,
    count_groups_with_children: groups,
    gyartmanyok: brands,
    modellek: newFlat,
    modellekTree: newTree,
    tipusok: {},
    meta: {
      ...(rawCatalog.meta || {}),
      cleaned: "strict commercial model whitelist — no passenger leftover brands/models",
      removed_brands: removed,
    },
  };
}
