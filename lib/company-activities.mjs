export const COMPANY_ACTIVITY_OPTIONS = [
  { id: "auto", label: "Autó" },
  { id: "teherauto", label: "Teherautó" },
  { id: "ingatlan", label: "Ingatlan" },
];

const VALID_IDS = new Set(COMPANY_ACTIVITY_OPTIONS.map((o) => o.id));

const LABEL_TO_ID = {
  auto: "auto",
  autó: "auto",
  teherauto: "teherauto",
  teherautó: "teherauto",
  ingatlan: "ingatlan",
};

function stripAccents(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

/** @param {unknown} raw */
export function normalizeCompanyActivities(raw, existing = {}) {
  let src = raw;
  if (
    (src == null || (Array.isArray(src) && src.length === 0)) &&
    Array.isArray(existing?.companyActivities) &&
    existing.companyActivities.length
  ) {
    src = existing.companyActivities;
  }
  let list = [];
  if (Array.isArray(src)) {
    list = src.map((v) => String(v ?? "").trim());
  } else if (typeof src === "string" && src.trim()) {
    const t = src.trim();
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) list = parsed.map((v) => String(v ?? "").trim());
      else list = t.split(/[,;|]+/).map((v) => v.trim());
    } catch {
      list = t.split(/[,;|]+/).map((v) => v.trim());
    }
  }
  const out = [];
  for (const item of list) {
    if (!item) continue;
    const key = stripAccents(item);
    const id = VALID_IDS.has(key) ? key : LABEL_TO_ID[item.toLowerCase()] || LABEL_TO_ID[key];
    if (id && VALID_IDS.has(id) && !out.includes(id)) out.push(id);
  }
  return COMPANY_ACTIVITY_OPTIONS.map((o) => o.id).filter((id) => out.includes(id));
}

export function companyActivitiesLabels(ids) {
  const set = new Set(normalizeCompanyActivities(ids));
  return COMPANY_ACTIVITY_OPTIONS.filter((o) => set.has(o.id)).map((o) => o.label);
}

/** Cég tevékenység id → hirdetés vertical (listing-quota). */
export function companyActivityToVertical(activityId) {
  const id = String(activityId ?? "").trim();
  if (id === "teherauto") return "teher";
  if (id === "ingatlan") return "ingatlan";
  if (id === "auto") return "auto";
  return "";
}

export function verticalToCompanyActivity(vertical) {
  const v = String(vertical ?? "")
    .trim()
    .toLowerCase();
  if (v === "teher") return "teherauto";
  if (v === "ingatlan") return "ingatlan";
  if (v === "auto") return "auto";
  return "";
}

/** Profilban bejelölt tevékenységek → engedélyezett vertical lista. */
export function allowedVerticalsFromProfile(profile = {}) {
  return normalizeCompanyActivities(profile?.companyActivities)
    .map(companyActivityToVertical)
    .filter(Boolean);
}
