import test from "node:test";
import assert from "node:assert/strict";
import { parseListingCard } from "./parse-listing.mjs";
import { mapListingToForm } from "./map-to-form.mjs";

test("lista kártya összefoglaló → kötelező mezők", () => {
  const card = parseListingCard({
    url: "https://www.hasznaltauto.hu/szemelyauto/ford/kuga/test-99999999",
    title: "FORD KUGA 2.5 PHEV ST-Line CVT",
    text: "10 999 000 Ft Hibrid (Benzin), 2023/7, 2 488 cm³, 112 kW, 152 LE, 50 km AUTOMATA ALUFELNI BLUETOOTH KLÍMA",
  });
  const form = mapListingToForm({
    url: card.url,
    cim: card.cim,
    ar: card.ar,
    km: card.km,
    evjarat: card.evjarat,
    cardText: card.cardText,
    felszereltseg: card.felszereltseg,
    nyersAdatok: card.nyersAdatok,
  });

  assert.equal(form.gyartmany, "FORD");
  assert.equal(form.modell, "KUGA");
  assert.equal(form.uzemanyag, "Benzin/elektromos");
  assert.equal(form.gyartasi_ev, "2023");
  assert.equal(form.gyartasi_honap, "7");
  assert.equal(form.allapot, "Normál");
  assert.equal(form.hengerurtartalom, "2488");
  assert.equal(form.teljesitmeny_kw, "112");
  assert.equal(form.teljesitmeny_le, "152");
  assert.equal(form.sebessegvalto, "Fokozatmentes automata");
  assert.equal(form.hatotav, "50");
  assert.equal(form.hirdetes_cime, "Eladó FORD KUGA 2.5 PHEV ST-Line CVT (2023/7)");
  assert.ok(form.felszereltseg?.includes("könnyűfém felni"));
  assert.equal(form.klima, "automata klíma");
  assert.ok(form.felszereltseg?.includes("bluetooth-os kihangosító"));
});

test("km: 45 000 km a listában, 50 km hatótáv az összefoglalóban", () => {
  const card = parseListingCard({
    url: "https://www.hasznaltauto.hu/szemelyauto/ford/kuga/test-99999999",
    title: "FORD KUGA 2.5 PHEV ST-Line",
    text: "10 999 000 Ft 45 000 km Hibrid (Benzin), 2023/7, 112 kW, 50 km",
  });
  const form = mapListingToForm({
    url: card.url,
    cim: card.cim,
    ar: card.ar,
    km: card.km,
    evjarat: card.evjarat,
    nyersAdatok: card.nyersAdatok,
  });
  assert.equal(form.km, "45000");
});
