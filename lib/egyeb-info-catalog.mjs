function norm(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Szinkron: public/js/egyeb-info-data.js + listing-extra „Egyéb információ”. */
export const EGYEB_INFO_CANONICAL = [
  "garanciális",
  "amerikai modell",
  "azonnal elvihető",
  "bemutató jármű",
  "jobbkormányos",
  "rendelhető",
  "ÁFA visszaigényelhető",
  "autóbeszámítás lehetséges",
  "első forgalomba helyezés Magyarországon",
  "első tulajdonostól",
  "frissen szervizelt",
  "garantált km futás",
  "garázsban tartott",
  "keveset futott",
  "második tulajdonostól",
  "motorbeszámítás lehetséges",
  "mozgássérült",
  "nem dohányzó",
  "rendszeresen karbantartott",
  "taxi",
  "törzskönyv",
  "végig vezetett szervizkönyv",
  "vezetett szervizkönyv",
];

const LOOKUP = [...EGYEB_INFO_CANONICAL].sort((a, b) => b.length - a.length);

export function matchEgyebInfoItems(text) {
  const hay = norm(text);
  if (!hay) return [];
  const found = [];
  const seen = new Set();
  for (const item of LOOKUP) {
    const key = norm(item);
    if (!key || seen.has(key)) continue;
    if (hay === key || hay.includes(key)) {
      seen.add(key);
      found.push(item);
    }
  }
  return found;
}

export function splitEquipmentAndEgyebInfo(items = []) {
  const felszereltseg = [];
  const egyeb_info = [];
  const seenExtra = new Set();
  const seenEgyeb = new Set();

  for (const raw of items) {
    const text = String(raw ?? "").trim();
    if (!text) continue;
    const egyebMatches = matchEgyebInfoItems(text);
    if (egyebMatches.length) {
      for (const item of egyebMatches) {
        const key = norm(item);
        if (seenEgyeb.has(key)) continue;
        seenEgyeb.add(key);
        egyeb_info.push(item);
      }
      const leftover = norm(text);
      const covered = egyebMatches.map((x) => norm(x)).join(" ");
      if (leftover.replace(covered, "").trim().length >= 3) {
        const key = norm(text);
        if (!seenExtra.has(key)) {
          seenExtra.add(key);
          felszereltseg.push(text);
        }
      }
      continue;
    }
    const key = norm(text);
    if (seenExtra.has(key)) continue;
    seenExtra.add(key);
    felszereltseg.push(text);
  }

  return { felszereltseg, egyeb_info };
}
