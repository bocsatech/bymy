const VALID_AUTO = new Set([
  "atiras_ugyintezes",
  "eredetvizsga",
  "muszakivizsga",
  "autoatvizsgalas",
  "autoszerelo",
  "gumiszerelo",
  "lakatos",
  "klimaszerelo",
  "autokozmetika",
  "autovillamossag",
]);

const VALID_INGATLAN = new Set([
  "ertekesites",
  "ertekbecsles",
  "energetikai_tanusitvany",
  "szerkezeti_vizsgalat",
  "hitelugyintezes",
  "foldmeres",
  "tervezok",
  "lakberendezo",
  "kertepito",
  "ugyvedek",
  "kozjegyzok",
]);

function asList(raw) {
  if (Array.isArray(raw)) return raw.map((v) => String(v ?? "").trim()).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    const t = raw.trim();
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) return asList(parsed);
    } catch {
      /* comma list */
    }
    return t.split(/[,;|]+/).map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

/** @param {unknown} raw @param {Set<string>} valid */
function normalizeCatIds(raw, valid, existingList) {
  let src = raw;
  if ((src == null || (Array.isArray(src) && src.length === 0)) && existingList?.length) {
    src = existingList;
  }
  const out = [];
  for (const id of asList(src)) {
    if (valid.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

function asBool(raw, existing, key) {
  const src = raw != null ? raw : existing?.[key];
  if (src == null || src === "") return false;
  if (typeof src === "boolean") return src;
  if (src === 1 || src === "1" || src === "true" || src === "on") return true;
  return false;
}

/** Céges Ajánlások mezők normalizálása profil mentéshez. */
export function normalizeCompanyAjanlasok(profile = {}, existing = {}) {
  const masterOn = asBool(profile.companyAjanlasok, existing, "companyAjanlasok");
  if (!masterOn) {
    return {
      companyAjanlasok: false,
      companyAjanlasokAuto: false,
      companyAjanlasokIngatlan: false,
      companyAjanlasokAutoCats: [],
      companyAjanlasokIngatlanCats: [],
    };
  }
  const autoOn = asBool(profile.companyAjanlasokAuto, existing, "companyAjanlasokAuto");
  const immoOn = asBool(profile.companyAjanlasokIngatlan, existing, "companyAjanlasokIngatlan");
  const autoCats = autoOn
    ? normalizeCatIds(profile.companyAjanlasokAutoCats, VALID_AUTO, existing.companyAjanlasokAutoCats)
    : [];
  const immoCats = immoOn
    ? normalizeCatIds(
        profile.companyAjanlasokIngatlanCats,
        VALID_INGATLAN,
        existing.companyAjanlasokIngatlanCats
      )
    : [];
  return {
    companyAjanlasok: true,
    companyAjanlasokAuto: autoOn,
    companyAjanlasokIngatlan: immoOn,
    companyAjanlasokAutoCats: autoCats,
    companyAjanlasokIngatlanCats: immoCats,
  };
}
