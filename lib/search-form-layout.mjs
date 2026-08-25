import { normalizeFormLayout } from "./form-layout-model.mjs";
import { isSearchLayoutCategory } from "./ad-form-layout-categories.mjs";

/** Keresőben alapból rejtett mezők (feladás-specifikus / admin). */
export const SEARCH_HIDDEN_BY_DEFAULT = new Set([
  "hirdetes_cime",
  "hirdetes_vertical",
  "hirdetes_alkategoria",
  "fotok",
  "owner_user_id",
  "views_web",
  "views_app",
  "telefon1_orszag",
  "telefon1_korzet",
  "telefon1_szam",
  "telefon2_orszag",
  "telefon2_korzet",
  "telefon2_szam",
  "telefon3_orszag",
  "telefon3_korzet",
  "telefon3_szam",
  "beszelt_nyelvek",
  "email_megjelenik",
  "email",
  "leiras",
  "video_url",
  "forras_url",
  "hasznaltauto_hirdetes_id",
  "megtekintesi_cim",
  "alvazszam",
  "rendszam",
  "akcios_ar",
  "forgalomba_helyezes_ar",
  "vetelar_eur",
  "hitel",
  "kezdo_reszlet",
  "havi_reszlet",
  "futamido",
  "berelheto",
  "egyeb_modell",
  "egyeb_tipus",
  "tipus",
  "gyartasi_honap",
  "forgalomba_helyezes_honap",
  "muszaki_honap",
]);

/** Gyorskereső (1. lépés) — megegyezik a jelenlegi auto.html hero mezőivel. */
const QUICK_VISIBLE = new Set([
  "gyartmany",
  "modell",
  "uzemanyag",
  "gyartasi_ev",
  "vetelar",
]);

/** Több szűrő panel — a jelenlegi bővített gyorskereső. */
const MORE_VISIBLE = new Set([
  "km",
  "teljesitmeny_le",
  "kivitel",
  "sebessegvalto",
  "hajtas",
  "hengerurtartalom",
  "allapot",
  "ajtok",
  "szemelyek",
  "szin",
  "teto",
  "csomagtarto",
  "klima",
  "megye",
  "telepules",
  "iranyitoszam",
]);

/**
 * Alap kereső-elrendezés: 1. lépés = gyors, 2–3 = több szűrő, többi rejtve.
 * @param {object} postingLayout — személyautó feladási layout (opcionális másolat forrás)
 */
export function defaultSearchFormLayout(postingLayout = null) {
  const base = normalizeFormLayout(postingLayout || { cells: [] }, { category: "szemelyauto-search" });
  for (const cell of base.cells) {
    const key = cell.field_key;
    if (SEARCH_HIDDEN_BY_DEFAULT.has(key)) {
      cell.hidden = true;
      continue;
    }
    if (QUICK_VISIBLE.has(key)) {
      cell.hidden = false;
      cell.step = 1;
      continue;
    }
    if (MORE_VISIBLE.has(key)) {
      cell.hidden = false;
      cell.step = key === "megye" || key === "telepules" || key === "iranyitoszam" ? 5 : 2;
      continue;
    }
    cell.hidden = true;
  }
  base.category = "szemelyauto-search";
  return base;
}

export function applySearchLayoutDefaults(layout, postingLayout = null) {
  if (!isSearchLayoutCategory(layout?.category)) return layout;
  const hasLive = layout?.live || (Array.isArray(layout?.cells) && layout.cells.some((c) => c.hidden === false));
  if (hasLive && layout?.version >= 2) return layout;
  return defaultSearchFormLayout(postingLayout);
}
