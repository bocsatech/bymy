import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSummarySpecs,
  mapSebessegvalto,
  mapEquipmentFromBadges,
  mapEquipmentFromSources,
  mapKlima,
  applyMuszakiFields,
  applyExtrakFields,
  mapOwnerFlags,
} from "./map-tech.mjs";

test("parseSummarySpecs: cm³, kW, LE, CVT, hatótáv", () => {
  const specs = parseSummarySpecs(
    "Hibrid (Benzin), 2023/7, 2 488 cm³, 112 kW, 152 LE, 50 km"
  );
  assert.equal(specs.Hengerűrtartalom, "2488");
  assert.equal(specs.Teljesítmény, "112 kW / 152 LE");
  assert.equal(specs["Sebességváltó"], undefined);
  assert.equal(specs["Hatótáv"], "50");
});

test("parseSummarySpecs: hatótáv badge-ek után is", () => {
  const specs = parseSummarySpecs(
    "10 999 000 Ft Hibrid (Benzin), 2023/7, 112 kW, 152 LE, 50 km AUTOMATA ALUFELNI"
  );
  assert.equal(specs["Hatótáv"], "50");
});

test("mapSebessegvalto: csak Manuális / Automata / Félautomata", () => {
  assert.equal(mapSebessegvalto("CVT automata", "FORD KUGA CVT"), "Automata");
  assert.equal(mapSebessegvalto("", "AUTOMATA"), "Automata");
  assert.equal(mapSebessegvalto("Manuális (6 fokozatú)", ""), "Manuális");
  assert.equal(mapSebessegvalto("Szekvenciális", ""), "Félautomata");
  assert.equal(mapSebessegvalto("Automata (7 fokozatú tiptronic) sebességváltó", ""), "Automata");
});

test("mapEquipmentFromBadges: alufelni és bluetooth", () => {
  const items = mapEquipmentFromBadges(["ALUFELNI", "BLUETOOTH"], "");
  assert.ok(items.includes("könnyűfém felni"));
  assert.ok(items.includes("bluetooth-os kihangosító"));
});

test("applyExtrakFields: badge-ek, nem dohányzó — klíma csak mezőből", () => {
  const data = {};
  const parsed = {
    leiras: "Garanciális, nem dohányzó autó. Tempomat, navigáció, bluetooth.",
    cardText: "AUTOMATA ALUFELNI BLUETOOTH KLÍMA",
    felszereltseg: ["AUTOMATA", "ALUFELNI", "BLUETOOTH", "KLÍMA", "TEMPOMAT", "hőszivattyús"],
  };

  applyExtrakFields(data, parsed, {}, parsed.felszereltseg);

  assert.equal(data.klima, undefined);
  assert.equal(data.nem_dohanyzo, "1");
  assert.ok(data.felszereltseg.includes("könnyűfém felni"));
  assert.ok(data.felszereltseg.includes("bluetooth-os kihangosító"));
  assert.ok(data.felszereltseg.includes("tempomat"));
  assert.ok(data.felszereltseg.includes("GPS (navigáció)"));
});

test("applyExtrakFields: bodyText zaj ne töltse az extrákat", () => {
  const data = {};
  const parsed = {
    bodyText: "ABS ASR ESP xenon LED tolatókamera full extra hőszivattyús klíma toloajto",
    felszereltseg: ["tempomat"],
  };
  applyExtrakFields(data, parsed, {}, parsed.felszereltseg);
  assert.ok(data.felszereltseg.includes("tempomat"));
  assert.ok(!data.felszereltseg?.includes("xenon fényszóró"));
  assert.ok(!data.klima);
});

test("mapKlima: üres mező + felszereltség hőszivattyú → ne találjon ki", () => {
  assert.equal(mapKlima("", ["hőszivattyús klíma"], "hőszivattyús a felszereltségben"), "");
  assert.equal(mapKlima("Digitális kétzónás klíma"), "digitális kétzónás klíma");
});

test("applyExtrakFields: egyéb információ → egyeb_info", () => {
  const data = {};
  applyExtrakFields(data, {}, {}, [
    "tempomat",
    "garantált km futás",
    "garázsban tartott",
    "autóbeszámítás lehetséges",
    "vezetett szervizkönyv",
  ]);
  assert.ok(data.felszereltseg?.includes("tempomat"));
  assert.ok(data.egyeb_info?.includes("garantált km futás"));
  assert.ok(data.egyeb_info?.includes("garázsban tartott"));
  assert.ok(data.egyeb_info?.includes("autóbeszámítás lehetséges"));
  assert.ok(data.egyeb_info?.includes("vezetett szervizkönyv"));
});

test("mapKlima: kétzónás és 2 zónás felismerés", () => {
  assert.equal(mapKlima("Digitális kétzónás klíma"), "digitális kétzónás klíma");
  assert.equal(mapKlima("Digitális, 2 zónás"), "digitális kétzónás klíma");
  assert.equal(mapKlima("4 zónás automata klíma"), "digitális többzónás klíma");
});

test("mapEquipmentFromSources: felszereltség lista mezőből", () => {
  const items = mapEquipmentFromSources({
    texts: ["tempomat, LED fényszóró, Apple CarPlay, ESP, ABS"],
  });
  assert.ok(items.includes("tempomat"));
  assert.ok(items.includes("LED fényszóró"));
  assert.ok(items.includes("Apple CarPlay"));
  assert.ok(items.includes("ESP (menetstabilizátor)"));
  assert.ok(items.includes("ABS (blokkolásgátló)"));
});

test("mapOwnerFlags: hölgy tulajdonos", () => {
  const flags = mapOwnerFlags(["Hölgy tulajdonostól eladó"]);
  assert.equal(flags.holgy_tulajdonos, "1");
});

test("applyMuszakiFields: lista összefoglalóból kitölt", () => {
  const data = {};
  const parsed = {
    cim: "FORD KUGA 2.5 PHEV ST-Line CVT",
    jarmuTipus: "FORD KUGA 2.5 PHEV ST-Line",
    cardText: "10 999 000 Ft Hibrid (Benzin), 2023/7, 2 488 cm³, 112 kW, 152 LE, 50 km",
    felszereltseg: ["AUTOMATA", "ALUFELNI"],
  };
  const m = parseSummarySpecs(parsed.cardText);

  applyMuszakiFields(data, parsed, m, parsed.felszereltseg);

  assert.equal(data.hengerurtartalom, "2488");
  assert.equal(data.teljesitmeny_kw, "112");
  assert.equal(data.teljesitmeny_le, "152");
  assert.equal(data.sebessegvalto, "Automata");
  assert.equal(data.hatotav, "50");
});
