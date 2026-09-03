/**
 * Ingatlan típus → mező / terület / kiadó-only mátrix
 * (igazítva: docs/ingatlan-com-hirdetesfeladas-matrix.md).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  INGATLAN_FIELDS_BY_TIPUS,
  INGATLAN_AREA_BY_TIPUS,
  INGATLAN_KIADO_ONLY_FIELDS,
  fieldKeysVisibleForTipus,
  areaFieldKeysForTipus,
  tipus2OptionsForParents,
} from "./ingatlan-fields.mjs";

test("lakás eladó: fő részletek + lift/erkély, nincs napelem/pince, nincs kiadó-only", () => {
  const keys = fieldKeysVisibleForTipus(["lakas"], { uzletag: "elado" });
  for (const k of [
    "allapot",
    "futes",
    "parkolas",
    "komfort",
    "furdo_wc",
    "emelet",
    "tajolas",
    "lift",
    "erkely",
    "kertkapcsolatos",
    "szigeteles",
  ]) {
    assert.equal(keys.has(k), true, `missing ${k}`);
  }
  assert.equal(keys.has("napelem"), false);
  assert.equal(keys.has("pince"), false);
  for (const k of INGATLAN_KIADO_ONLY_FIELDS) {
    assert.equal(keys.has(k), false, `kiado-only leaked: ${k}`);
  }
});

test("lakás kiadó: bútorozott / kisállat / gépesített látszik", () => {
  const keys = fieldKeysVisibleForTipus(["lakas"], { uzletag: "kiado" });
  assert.equal(keys.has("butorozott"), true);
  assert.equal(keys.has("gepesitett"), true);
  assert.equal(keys.has("kisallat_megengedett"), true);
  assert.equal(keys.has("min_berleti_ido"), true);
});

test("ház: napelem + pince + telek; nincs lift", () => {
  const keys = fieldKeysVisibleForTipus(["haz"], { uzletag: "elado" });
  assert.equal(keys.has("napelem"), true);
  assert.equal(keys.has("pince"), true);
  assert.equal(keys.has("tetoter"), true);
  assert.equal(keys.has("lift"), false);
  assert.equal(keys.has("telekterulet"), true);
  assert.equal(keys.has("szintek"), true);
  const area = areaFieldKeysForTipus(["haz"]);
  assert.equal(area.has("telekterulet_tol"), true);
  assert.equal(area.has("alapterulet_tol"), true);
});

test("lakás: emelet kereső + feladás kulcs együtt látszik", () => {
  const keys = fieldKeysVisibleForTipus(["lakas"], { uzletag: "kiado" });
  assert.equal(keys.has("emelet"), true);
  assert.equal(keys.has("emelet_tol"), true);
  assert.equal(keys.has("emelet_ig"), true);
  assert.equal(keys.has("alapterulet"), true);
});

test("telek: közművek + új parcellázás; nincs alapterület", () => {
  const keys = fieldKeysVisibleForTipus(["telek"], { uzletag: "elado" });
  assert.equal(keys.has("villany"), true);
  assert.equal(keys.has("uj_parcellazasu"), true);
  assert.equal(keys.has("futes"), false);
  const area = areaFieldKeysForTipus(["telek"]);
  assert.equal(area.has("alapterulet_tol"), false);
  assert.equal(area.has("telekterulet_tol"), true);
});

test("garázs / ipari / raktár területmátrix", () => {
  assert.deepEqual(INGATLAN_AREA_BY_TIPUS.garazs, ["alapterulet"]);
  assert.ok(INGATLAN_AREA_BY_TIPUS.ipari.includes("alapterulet"));
  assert.ok(INGATLAN_AREA_BY_TIPUS.raktar.includes("alapterulet"));
});

test("Szoba altípus csak kiadónál", () => {
  const elado = tipus2OptionsForParents(["lakas"], { uzletag: "elado" }).map((o) => o.value);
  const kiado = tipus2OptionsForParents(["lakas"], { uzletag: "kiado" }).map((o) => o.value);
  assert.equal(elado.includes("lakas_szoba"), false);
  assert.equal(kiado.includes("lakas_szoba"), true);
});

test("lakás / ház: rezsi, közös, áram/gáz fogyasztás", () => {
  const lakas = fieldKeysVisibleForTipus(["lakas"], { uzletag: "elado" });
  const haz = fieldKeysVisibleForTipus(["haz"], { uzletag: "elado" });
  for (const k of ["rezsikoltseg", "kozos_koltseg", "atlagos_aram_fogyasztas", "atlagos_gaz_fogyasztas"]) {
    assert.equal(lakas.has(k), true, `lakas missing ${k}`);
    assert.equal(haz.has(k), true, `haz missing ${k}`);
  }
  const telek = fieldKeysVisibleForTipus(["telek"], { uzletag: "elado" });
  assert.equal(telek.has("rezsikoltseg"), false);
  const uzlet = fieldKeysVisibleForTipus(["uzlethelyiseg"], { uzletag: "elado" });
  assert.equal(uzlet.has("rezsikoltseg"), true);
  assert.equal(uzlet.has("kozos_koltseg"), false);
});

test("energetikai tanúsítvány és feltételes részletek a mátrixban", () => {
  const haz = fieldKeysVisibleForTipus(["haz"], { uzletag: "elado" });
  assert.equal(haz.has("energiahatekonys"), true);
  assert.equal(haz.has("napelem_kw"), true);
  assert.equal(haz.has("szigeteles_cm"), true);
  assert.equal(haz.has("nincs_gaz_bekotve"), true);
  const lakas = fieldKeysVisibleForTipus(["lakas"], { uzletag: "elado" });
  assert.equal(lakas.has("napelem"), false);
  assert.equal(lakas.has("napelem_kw"), false);
  assert.equal(lakas.has("szigeteles_cm"), true);
  assert.equal(lakas.has("energiahatekonys"), true);
});

test("INGATLAN_FIELDS_BY_TIPUS: lakás nem tartalmaz napelemet", () => {
  assert.equal(INGATLAN_FIELDS_BY_TIPUS.lakas.includes("napelem"), false);
  assert.equal(INGATLAN_FIELDS_BY_TIPUS.haz.includes("napelem"), true);
});
