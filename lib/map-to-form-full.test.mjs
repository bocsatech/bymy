import test from "node:test";
import assert from "node:assert/strict";
import { parseTireSize, applyFieldMap, mapTulajdonos } from "./field-key-map.mjs";
import { mapListingToFormWithSummary } from "./map-to-form.mjs";

test("parseTireSize: 225/45 R17", () => {
  assert.deepEqual(parseTireSize("225/45 R17"), {
    szelesseg: "225",
    magassag: "45",
    atmero: "17",
  });
});

test("applyFieldMap: gumi, jelzők, kapcsolat", () => {
  const data = {};
  applyFieldMap(
    data,
    {
      "Nyári gumi méret": "225/45 R17",
      "Tulajdonosok száma": "2",
      "E-mail": "elado@example.com",
      "Megtekintési cím": "Budapest, XI. kerület",
    },
    {
      leiras: "Alkudható, csere érdekel, metál fény. https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      telefonszam: "+36 30 123 4567",
    }
  );

  assert.equal(data.nyari_gumi_szelesseg, "225");
  assert.equal(data.tulajdonosok_szama, "2");
  assert.equal(data.email, "elado@example.com");
  assert.equal(data.megtekintesi_cim, "Budapest, XI. kerület");
  assert.equal(data.alkudhato, "1");
  assert.equal(data.csere, "1");
  assert.equal(data.metalfeny, "1");
  assert.equal(data.video_url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(data.telefon1_korzet, "30");
});

test("mapListingToFormWithSummary: lépésenkénti összesítés", () => {
  const { form, importSummary } = mapListingToFormWithSummary({
    url: "https://www.hasznaltauto.hu/szemelyauto/ford/kuga/test-99999999",
    cim: "FORD KUGA 2.5 PHEV ST-Line CVT",
    ar: "10 999 000 Ft",
    evjarat: "2023/7",
    leiras: "Garanciális, tempomat, navigáció.",
    felszereltseg: ["ALUFELNI", "KLÍMA", "TEMPOMAT"],
    nyersAdatok: {
      Üzemanyag: "Hibrid (Benzin)",
      "Nyári gumi méret": "235/50 R18",
      Kategória: "SUV",
      "Kárpit színe": "Fekete",
      Szín: "Piros metál",
      Vételár: "10 999 000 Ft",
      Megtalálható: "Budapest, Pest megye",
    },
  });

  assert.ok(form.hirdetes_cime.startsWith("Eladó FORD"));
  assert.equal(form.nyari_gumi_szelesseg, "235");
  assert.equal(form.karpit1, "Fekete");
  assert.equal(form.klima, "automata klíma");
  assert.ok(importSummary["1"].filledCount >= 8);
  assert.ok(importSummary["2"].filledCount >= 3);
  assert.ok(importSummary["3"].filledCount >= 1);
});

test("mapTulajdonos: 4+ eset", () => {
  assert.equal(mapTulajdonos("4"), "4+");
  assert.equal(mapTulajdonos("2"), "2");
});
