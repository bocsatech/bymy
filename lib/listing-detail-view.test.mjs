import test from "node:test";
import assert from "node:assert/strict";
import { buildListingDetailView, maskPhone } from "./listing-detail-view.mjs";

test("maskPhone: első számjegyek látszanak", () => {
  assert.equal(maskPhone("+36 20 123 4567").startsWith("+36 20"), true);
  assert.match(maskPhone("+36 20 123 4567"), /…$/);
});

test("hirdetésnézet a feltöltött autóadatokból, magyar címkékkel", () => {
  const view = buildListingDetailView({
    id: 115,
    hirdetes_cime: "Eladó FORD (2022)",
    status: "feladott",
    updated_at: "2026-08-15T16:45:00Z",
    user_id: 2,
    form: {
      gyartmany: "FORD",
      modell: "Kuga",
      gyartasi_ev: "2022",
      gyartasi_honap: "7",
      km: "142000",
      vetelar: "6499000",
      uzemanyag: "Benzin/elektromos",
      sebessegvalto: "Fokozatmentes automata",
      hajtas: "Összkerék",
      allapot: "Kitűnő",
      kivitel: "SUV / Crossover",
      hengerurtartalom: "2488",
      teljesitmeny_kw: "112",
      teljesitmeny_le: "152",
      ajtok: "5",
      szemelyek: "5",
      szin: "Fekete",
      klima: "digitális klíma",
      felszereltseg: ["tempomat", "ülésfűtés"],
      leiras: "Megtekinthető telefonon egyeztetett időpontban.",
      telepules: "Budapest",
      iranyitoszam: "1117",
      megtekintesi_cim: "Budafoki út 1",
      telefon1_orszag: "+36",
      telefon1_korzet: "20",
      telefon1_szam: "1234567",
      hasznaltauto_hirdetes_id: "23399214",
    },
  });

  assert.match(view.title, /FORD/i);
  assert.match(view.title, /Kuga/i);
  assert.doesNotMatch(view.title, /böngésző/i);
  assert.equal(view.price.replace(/\u00a0/g, " "), "6 499 000 Ft");
  assert.equal(view.km.replace(/\u00a0/g, " "), "142 000 km");
  assert.equal(view.power, "152 LE (112 kW)");
  assert.ok(view.basics.some((row) => row.label === "Sebességváltó" && row.value.includes("automata")));
  assert.ok(view.bodyTech.some((row) => row.label === "Jármű típusa" && row.value.includes("SUV")));
  assert.ok(view.equipment.includes("tempomat"));
  assert.equal(view.sellerName, "Eladó");
  assert.equal(view.phone, "+36 20 1234567");
  assert.ok(view.addressLines.some((line) => /Budapest/.test(line)));
  assert.equal(view.categoryLabel, "Autó");
  assert.equal(view.code, "23399214");
});

test("JS-figyelmeztetés típus nem kerül a címbe", () => {
  const view = buildListingDetailView({
    id: 1,
    form: {
      gyartmany: "NISSAN",
      gyartasi_ev: "2013",
      tipus: "böngésző nem támogatja a JavaScript-et.",
      vetelar: "2599990",
    },
  });
  assert.equal(view.title, "NISSAN (2013)");
  assert.doesNotMatch(view.title, /javascript/i);
});
