/**
 * HA Kishaszon dump often includes személyautó models (BMW X3, Jaguar E-PACE…).
 * Keep commercial models; drop passenger overlap.
 */

function norm(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

const KEEP_RE =
  /\b(TRANSIT|TRANSPORTER|CRAFTER|SPRINTER|VITO|CITAN|DOBLO|DUCATO|BOXER|JUMPER|EXPERT|PARTNER|BERLINGO|KANGOO|TRAFIC|TRAFFIC|MASTER|MOVANO|VIVARO|COMBO|CONNECT|COURIER|RANGER|NAVARA|HILUX|L200|AMAROK|D-?MAX|PORTER|DAILY|MASSIF|ETP3|DELIVERY|CARGO|FURGON|PICKUP|PICK-UP|PLAT[OÓ]|ALV[AÁ]Z|MULTIVAN|CARAVELLE|CALIFORNIA|PROACE|TOWNSTAR|EXPRESS|NV200|NV300|NV400|E-?NV|ID\.?BUZZ|SILVERADO|F ?1[45]0|F ?250|F SERIES|ECONOLINE|INTERSTAR|PRIMASTAR|TALENTO|SCUDO|JUMPY|SPACETOURER|TRAVELLER|CUSTOM|VARIO|T1\/TN|MB100|BIPPER|FIORINO|CADDY|RELAY|NEMO|MASCOTT|MAXITY|DYNA|SAVER|EQV|E-?VITO|E-?TRANSIT|E-?DELIVER|COMBO CARGO|CORSA COMBO)\b/i;

const DROP_RE =
  /\b(SOROZAT|SERIES|CLASS|PACE|CAMARO|FIESTA|FOCUS|MONDEO|KUGA|GOLF|POLO|PASSAT|OCTAVIA|FABIA|COROLLA|CIVIC|ACCORD|X[1-7]\b|[1-8]-AS|320D|318D|520D|C-MAX|S-MAX|GALAXY|SHARAN|TOURAN|TIGUAN|T-ROC|T-CROSS|YARIS|AYGO|AVENSIS|AURIS|RAV4|CR-V|HR-V|FR-V|JAZZ|E-PACE|F-PACE|I-PACE|^CORSA$)\b/i;

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

function keepModel(brand, name, szemelyNames) {
  const n = norm(name);
  if (!n) return false;
  if (n === "EGYÉB" || n === "EGYEB") return true;
  if (KEEP_RE.test(name)) return true;
  if (szemelyNames.has(`${brand}|${n}`)) return false;
  if (DROP_RE.test(name)) return false;
  if (/^(M?\d{2,3}[A-Z]?|\d{3}D)$/i.test(n)) return false;
  return true;
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
    if (!filtered.length) {
      removed.push(brand);
      continue;
    }
    brands.push(brand);
    newTree[brand] = filtered;
    newFlat[brand] = flattenNames(filtered);
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
      cleaned: "removed személyautó-overlapping / passenger models",
      removed_brands: removed,
    },
  };
}
