import test from "node:test";
import assert from "node:assert/strict";
import { buildListingPreview, buildPreviewFromCells } from "./listing-preview.mjs";

test("sanitizeListingPlainText kiszűri a Használtautó.hu / Belépés fejlécet", async () => {
  const { sanitizeListingPlainText, formatListingDisplayTitle } = await import("./listing-preview.mjs");
  assert.equal(sanitizeListingPlainText("Használtautó.hu\nBelépés"), "");
  assert.equal(sanitizeListingPlainText("Használtautó.hu Belépés"), "");
  assert.equal(
    sanitizeListingPlainText("Használtautó.hu\nBelépés\nSzép, garanciális autó."),
    "Szép, garanciális autó."
  );
  assert.equal(
    sanitizeListingPlainText("Használtautó.hu Belépés Mercedes-Benz C 220 d — első tulajdonos"),
    "Mercedes-Benz C 220 d — első tulajdonos"
  );
  assert.equal(formatListingDisplayTitle("Használtautó.hu"), "");
  assert.equal(formatListingDisplayTitle("Használtautó.hu | Belépés"), "");
  assert.equal(
    formatListingDisplayTitle("Használtautó.hu Belépés BMW X5"),
    "BMW X5"
  );
});

test("buildListingPreview nem engedi a szennyezett gyartmany/modell fallback címet", () => {
  const preview = buildListingPreview(
    {
      hirdetes_cime: "Használtautó.hu\nBelépés",
      gyartmany: "Használtautó.hu",
      modell: "Belépés",
      vetelar: "5000000",
    },
    { id: 99 }
  );
  assert.equal(preview.title, "Hirdetés #99");
  assert.equal(preview.filter.gyartmany, "");
  assert.equal(preview.filter.modell, "");
});

test("buildListingPreview kiszűri a chrome települést a location-ből", () => {
  const preview = buildListingPreview(
    {
      hirdetes_cime: "FORD PUMA",
      telepules: "Használtautó.hu Belépés",
      megye: "Belépés",
      vetelar: "1000000",
    },
    { id: 3 }
  );
  assert.equal(preview.location, "");
  assert.equal(preview.filter.telepules, "");
});

test("formatListingDisplayTitle eltávolítja az Eladó prefixet", async () => {
  const { formatListingDisplayTitle } = await import("./listing-preview.mjs");
  assert.equal(
    formatListingDisplayTitle("Eladó MERCEDES-BENZ C 220 d 4Matic"),
    "MERCEDES-BENZ C 220 d 4Matic"
  );
  assert.equal(formatListingDisplayTitle("Hirdetés #18"), "Hirdetés #18");
});

test("buildListingPreview összeállítja a hasznaltauto stílusú mezőket", () => {
  const preview = buildListingPreview(
    {
      hirdetes_cime: "Mercedes-Benz C 220 d 4Matic",
      vetelar: "17799000",
      uzemanyag: "Dízel",
      gyartasi_ev: "2019",
      gyartasi_honap: "3",
      hengerurtartalom: "1995",
      teljesitmeny_kw: "143",
      teljesitmeny_le: "194",
      km: "126000",
      leiras: "Garanciális, frissen szervizelt, első tulajdonos autó.",
      telepules: "Budapest",
      megye: "Pest megye",
      sebessegvalto: "Automata",
      felszereltseg: ["bluetooth-os kihangosító", "tempomat", "ESP"],
    },
    { id: 42, status: "mentett", hasznaltauto_hirdetes_id: "23005301" }
  );

  assert.equal(preview.title, "Mercedes-Benz C 220 d 4Matic");
  assert.equal(
    buildListingPreview({ hirdetes_cime: "Eladó BMW X5" }).title,
    "BMW X5"
  );
  assert.equal(preview.price.replace(/\u00a0/g, " "), "17 799 000 Ft");
  assert.match(preview.specLine, /Dízel/);
  assert.match(preview.specLine, /2019\/3/);
  assert.match(preview.specLine, /1995 cm³/);
  assert.match(preview.specLine, /143 kW, 194 LE/);
  assert.equal(preview.km.replace(/\u00a0/g, " "), "126 000 km");
  assert.match(preview.leiras, /Garanciális/);
  assert.equal(preview.hirdeteskod, "23005301");
  assert.match(preview.location, /Budapest/);
  assert.ok(preview.badges.includes("AUTOMATA"));
  assert.ok(preview.badges.includes("BLUETOOTH"));
  assert.equal(preview.status, "mentett");
});

test("buildPreviewFromCells cellákból épít előnézetet", () => {
  const preview = buildPreviewFromCells(
    [
      { field_key: "gyartmany", label: "Gyártmány", value: "FORD", step: 1 },
      { field_key: "modell", label: "Modell", value: "KUGA", step: 1 },
      { field_key: "vetelar", label: "Vételár", value: "10999000", step: 2 },
      { field_key: "uzemanyag", label: "Üzemanyag", value: "Hibrid", step: 3 },
    ],
    { id: 7, status: "feladott" }
  );

  assert.equal(preview.title, "FORD KUGA");
  assert.equal(preview.price.replace(/\u00a0/g, " "), "10 999 000 Ft");
  assert.equal(preview.status, "feladott");
});

test("kártyacím a gyártmány+modell, ne a régi rejtett Abarth cím", () => {
  const preview = buildListingPreview(
    {
      hirdetes_cime: "Eladó ABARTH 124 Spider 1.4 MultiAir T (Automata) (2017)",
      gyartmany: "MERCEDES-BENZ",
      modell: "ML-OSZTÁLY",
      gyartasi_ev: "2009",
      vetelar: "330000",
    },
    { id: 6 }
  );
  assert.equal(preview.title, "MERCEDES-BENZ ML-OSZTÁLY (2009)");
});

test("kártyakép a fo_kep + fotok listából", () => {
  const preview = buildListingPreview(
    {
      gyartmany: "BMW",
      modell: "X5",
      fotok: "https://cdn.example/a.jpg\nhttps://cdn.example/b.jpg",
    },
    { id: 9, fo_kep: "https://cdn.example/a.jpg" }
  );
  assert.equal(preview.imageUrl, "https://cdn.example/a.jpg");
  assert.deepEqual(preview.imageUrls, [
    "https://cdn.example/a.jpg",
    "https://cdn.example/b.jpg",
  ]);
});
