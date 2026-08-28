import { normalizeFormLayout } from "./form-layout-model.mjs";
import { isSearchLayoutCategory, normalizeLayoutCategory } from "./ad-form-layout-categories.mjs";

/** Kereső layout lépésnevek (Extrák felett: Akkumulátor). */
export const SEARCH_LAYOUT_STEP_NAMES = {
  1: "Gyorskereső",
  2: "Műszaki adatok",
  3: "Akkumulátor és hatótáv adatok",
  4: "Extrák",
  5: "Helyszín",
};

/** Akkumulátor mezők — keresőben a 3. lépés rácsán. */
export const AKKU_SEARCH_LAYOUT_KEYS = new Set([
  "akkumulator_kwh",
  "jelenlegi_akkukapacitas",
  "ac_toltesi_teljesitmeny",
  "dc_toltesi_teljesitmeny",
  "hatotav",
  "autopalya_hatotav",
  "teli_hatotav",
  "ac_tolto_csatlakozas",
  "dc_tolto_csatlakozas",
  "villamtoltes",
  "zold_rendszam",
  "tolto_csatlakozas",
]);

/**
 * Egyszeri migráció: a régi Extrák mezők (klima stb.) a 3-asról a 4-esre,
 * hogy a 3-as „Akkumulátor és hatótáv” rács szabad legyen.
 * Nem kényszerít lépést / elrejtést mentéskor — az admin szabadon rakja a mezőket.
 */
export function ensureSearchAkkuBoard(layout) {
  if (!layout || !isSearchLayoutCategory(layout.category)) return layout;
  const cells = Array.isArray(layout.cells) ? layout.cells : [];
  if (!cells.length) return layout;

  const extrasMarkers = ["klima", "nem_dohanyzo", "holgy_tulajdonos"];
  const stillOldExtras = cells.some(
    (cell) => extrasMarkers.includes(String(cell.field_key || "")) && Number(cell.step) === 3
  );
  if (!stillOldExtras) return layout;

  for (const cell of cells) {
    if (AKKU_SEARCH_LAYOUT_KEYS.has(String(cell.field_key || ""))) continue;
    if (Number(cell.step) === 3) cell.step = 4;
  }

  return layout;
}

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

/** Gyorskereső (1. lépés) — megegyezik a jelenlegi auto/teher hero mezőivel. */
const QUICK_VISIBLE = new Set([
  "gyartmany",
  "modell",
  "tipus",
  "uzemanyag",
  "gyartasi_ev",
  "vetelar",
]);

/** Több szűrő panel — személyautó. */
const AUTO_MORE_VISIBLE = new Set([
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
  "telepules",
  "iranyitoszam",
  "keresesi_korzet",
]);

/** Több szűrő panel — teherautó (raktér / tömeg mezőkkel). */
const TEHER_MORE_VISIBLE = new Set([
  ...AUTO_MORE_VISIBLE,
  "sajat_tomeg",
  "ossztomeg",
  "nyomatek_nm",
  "rakter_terfogat",
  "rakter_hossz",
  "rakter_szelesseg",
  "rakter_magassag",
]);

function moreVisibleFor(category) {
  return normalizeLayoutCategory(category) === "teherauto-search" ? TEHER_MORE_VISIBLE : AUTO_MORE_VISIBLE;
}

/**
 * Alap kereső-elrendezés: 1. lépés = gyors, 2–5 = több szűrő, akku = 3. lépés (rejtve).
 * @param {object} postingLayout — feladási layout (opcionális másolat forrás)
 * @param {string} category — szemelyauto-search | teherauto-search
 */
export function defaultSearchFormLayout(postingLayout = null, category = "szemelyauto-search") {
  const cat = isSearchLayoutCategory(category) ? normalizeLayoutCategory(category) : "szemelyauto-search";
  const moreVisible = moreVisibleFor(cat);
  const base = normalizeFormLayout(postingLayout || { cells: [] }, { category: cat });
  for (const cell of base.cells) {
    const key = cell.field_key;
    if (SEARCH_HIDDEN_BY_DEFAULT.has(key)) {
      cell.hidden = true;
      continue;
    }
    if (AKKU_SEARCH_LAYOUT_KEYS.has(key)) {
      cell.hidden = true;
      cell.step = 3;
      continue;
    }
    if (QUICK_VISIBLE.has(key)) {
      cell.hidden = false;
      cell.step = 1;
      continue;
    }
    if (moreVisible.has(key)) {
      cell.hidden = false;
      cell.step =
        key === "telepules" || key === "iranyitoszam" || key === "keresesi_korzet" ? 5 : 2;
      // Extrák (klima stb.) katalógus step=3 → ensureSearchAkkuBoard tolja 4-re
      if (key === "klima" || key === "nem_dohanyzo" || key === "holgy_tulajdonos") {
        cell.step = 3;
      }
      continue;
    }
    cell.hidden = true;
  }
  base.category = cat;
  return ensureSearchAkkuBoard(base);
}

export function applySearchLayoutDefaults(layout, postingLayout = null) {
  if (!isSearchLayoutCategory(layout?.category)) return layout;
  const hasLive = layout?.live || (Array.isArray(layout?.cells) && layout.cells.some((c) => c.hidden === false));
  if (hasLive && layout?.version >= 2) return ensureSearchAkkuBoard(layout);
  return defaultSearchFormLayout(postingLayout, layout.category);
}
