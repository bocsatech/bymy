import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import test from "node:test";
import assert from "node:assert/strict";
import { parseListingHtml, mergeAttributeMaps, parseBodyTextAttributes } from "./parse-listing.mjs";
import { mapListingToFormWithSummary } from "./map-to-form.mjs";
import { mergePageExtract } from "./page-extract.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleFixture = join(__dirname, "..", "..", "hasznaltauto-scraper", "fixtures", "sample-listing.html");
const fullFixture = join(__dirname, "..", "..", "hasznaltauto-scraper", "fixtures", "sample-listing-full.html");

test("parseAttributesTable: második td értéke, nem az első", () => {
  const html = readFileSync(sampleFixture, "utf8");
  const parsed = parseListingHtml(html, { url: "https://example.test/12345678" });
  assert.equal(parsed.nyersAdatok["Évjárat"], "2018/3");
  assert.equal(parsed.nyersAdatok["Futásteljesítmény"], "125 000 km");
  assert.equal(parsed.nyersAdatok["Kategória"], "Kombi");
});

test("parseListingHtml: teljes táblázat → form mezők", () => {
  const html = readFileSync(fullFixture, "utf8");
  const parsed = parseListingHtml(html, {
    url: "https://www.hasznaltauto.hu/szemelyauto/ford/kuga/test-99999999",
    phone: "+36 30 987 6543",
  });
  const { form, importSummary } = mapListingToFormWithSummary(parsed);

  assert.equal(form.gyartasi_ev, "2023");
  assert.equal(form.gyartasi_honap, "7");
  assert.equal(form.km, "50");
  assert.equal(form.kivitel, "SUV / Crossover");
  assert.equal(form.uzemanyag, "Benzin/elektromos");
  assert.equal(form.allapot, "Normál");
  assert.equal(form.okmany_jelleg, "Érvényes magyar okmányokkal");
  assert.equal(form.forgalomba_helyezes_ev, "2023");
  assert.equal(form.forgalomba_helyezes_honap, "9");
  assert.equal(form.muszaki_ev, "2027");
  assert.equal(form.ajtok, "5");
  assert.equal(form.hengerurtartalom, "2488");
  assert.equal(form.teljesitmeny_kw, "112");
  assert.equal(form.teljesitmeny_le, "152");
  assert.equal(form.sebessegvalto, "Fokozatmentes automata");
  assert.equal(form.hajtas, "Összkerék");
  assert.equal(form.szin, "Fehér metál");
  assert.equal(form.karpit1, "Fekete");
  assert.equal(form.nyari_gumi_szelesseg, "235");
  assert.equal(form.telefon1_korzet, "30");
  assert.ok(importSummary["1"].filledCount >= 12);
  assert.ok(importSummary["2"].filledCount >= 8);
});

test("mergePageExtract: élő DOM adat nem íródik felül üres HTML parse-szal", () => {
  const parsed = parseListingHtml("<html><body><h1>TESLA</h1></body></html>", {
    url: "https://example.test/11111111",
  });
  const merged = mergePageExtract(parsed, {
    map: {
      Évjárat: "2022/5",
      "Futásteljesítmény": "45 000 km",
      Üzemanyag: "Elektromos",
      Kategória: "SUV",
      "Sebességváltó": "Automata",
      Szín: "Piros",
    },
    title: "TESLA MODEL Y",
    leiras: "Teszt leírás",
    kmText: "45 000 km",
  });
  const { form } = mapListingToFormWithSummary(merged);

  assert.equal(form.gyartasi_ev, "2022");
  assert.equal(form.gyartasi_honap, "5");
  assert.equal(form.km, "45000");
  assert.equal(form.uzemanyag, "Elektromos");
  assert.equal(form.sebessegvalto, "Automata");
  assert.equal(form.szin, "Piros");
});

test("mergeAttributeMaps: zajos érték nem nyer a tiszta ellen", () => {
  const merged = mergeAttributeMaps(
    { Kategória: "Kombi" },
    { Kategória: "Kombi Elsődleges telefonszám felfedése +" }
  );
  assert.equal(merged["Kategória"], "Kombi");
});

test("parseBodyTextAttributes: új layout — címke sor + érték sor", () => {
  const map = parseBodyTextAttributes(`
    Évjárat
    2021/3
    Futásteljesítmény
    125 000 km
    Üzemanyag
    Diesel
    Állapot
    Normál
    Sebességváltó
    Automata (9 f.)
  `);
  assert.equal(map["Évjárat"], "2021/3");
  assert.equal(map["Futásteljesítmény"], "125 000 km");
  assert.equal(map["Üzemanyag"], "Diesel");
  assert.equal(map["Állapot"], "Normál");
  assert.equal(map["Sebességváltó"], "Automata (9 f.)");
});

test("inferFuelFromHints: 220 d → Dízel", async () => {
  const { mapListingToFormWithSummary } = await import("./map-to-form.mjs");
  const { form } = mapListingToFormWithSummary({
    url: "https://www.hasznaltauto.hu/szemelyauto/mercedes-benz/glc/test-12345678",
    cim: "Eladó MERCEDES-BENZ GLC 220 d 4Matic 9G-TRONIC",
    nyersAdatok: {},
  });
  assert.equal(form.uzemanyag, "Dízel");
  assert.equal(form.kivitel, "SUV / Crossover");
  assert.equal(form.allapot, "Normál");
});
