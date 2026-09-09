import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  buildFormFromPage,
  isChromeTitle,
  validateReadyToSave,
  imageUrlFromHtml,
  resolvePublicHaUrl,
} from "./ha-import-save.mjs";


async function makeImportUser(accountType = "private") {
  const { registerUser, activateUserByToken } = await import(`./web-users.mjs?t=${Date.now()}-${Math.random()}`);
  const email = `imp-${Date.now()}-${Math.random().toString(16).slice(2)}@local.dev`;
  const reg = await registerUser(email, "titok1titok12", "titok1titok12", accountType);
  const activated = await activateUserByToken(reg.activationToken);
  return activated.user.id;
}

test("isChromeTitle kiszűri a belépés / hasznaltauto címeket", () => {
  assert.equal(isChromeTitle("Belépés"), true);
  assert.equal(isChromeTitle("hasznaltauto.hu"), true);
  assert.equal(isChromeTitle("Hiba!"), true);
  assert.equal(isChromeTitle("Hiba! A"), true);
  assert.equal(isChromeTitle("Hirdetés #124"), true);
  assert.equal(isChromeTitle("Importált autó #99"), true);
  assert.equal(isChromeTitle("Volkswagen Golf"), false);
  assert.equal(isChromeTitle("Hibrid"), true);
});

test("isChromeTitle / preview kiszűri a Képkezelés és évjárat címeket", async () => {
  const { buildFormFromPage } = await import("./ha-import-save.mjs");
  const { buildListingPreview, sanitizeListingFieldValue, composeVehicleTitle } = await import(
    "./listing-preview.mjs"
  );
  assert.equal(isChromeTitle("Képkezelés"), true);
  assert.equal(isChromeTitle("Képkezelés Képkezelés"), true);
  assert.equal(isChromeTitle("2022/3"), true);
  assert.equal(sanitizeListingFieldValue("Képkezelés"), "");
  assert.equal(composeVehicleTitle({ gyartmany: "Képkezelés", modell: "Képkezelés" }), "");
  const preview = buildListingPreview(
    {
      hirdetes_cime: "Eladó Képkezelés Képkezelés",
      gyartmany: "Képkezelés",
      modell: "Képkezelés",
      gyartasi_ev: "2022",
      gyartasi_honap: "3",
      vetelar: "8599000",
    },
    { id: 114 }
  );
  assert.equal(preview.title, "Hirdetés #114");
  const form = buildFormFromPage({
    url: "https://admin.hasznaltauto.hu/gyorsnezet/szemelyauto/23429999",
    listingId: "23429999",
    visibleTitle: "Képkezelés Képkezelés",
    brand: "Képkezelés",
    model: "Képkezelés",
    year: "2020",
    price: "8599000",
    map: {
      Márka: "VOLVO",
      Modell: "V90",
      Évjárat: "2020/9",
      Vételár: "8 599 000 Ft",
    },
  });
  assert.match(form.gyartmany, /volvo/i);
  assert.match(form.modell, /v90/i);
  assert.doesNotMatch(form.hirdetes_cime || "", /képkezelés/i);
});

test("évjárat+üzemanyag lista-sor nem lesz kártyacím", async () => {
  const { buildListingPreview, isListingTitleNoise } = await import("./listing-preview.mjs");
  assert.equal(isListingTitleNoise("2022/4 , Dízel (23439253)"), true);
  assert.equal(isListingTitleNoise("2020/9 , Benzin/elektromos..."), true);
  assert.equal(isListingTitleNoise("Volvo V90"), false);
  const preview = buildListingPreview(
    {
      hirdetes_cime: "2022/4 , Dízel (23439253)",
      gyartmany: "",
      modell: "",
      tipus: "2022/4 , Dízel (23439253)",
      uzemanyag: "Dízel",
      gyartasi_ev: "2022",
      gyartasi_honap: "4",
      vetelar: "11299000",
    },
    { id: 112 }
  );
  assert.equal(preview.title, "Hirdetés #112");
  const withBrand = buildListingPreview(
    {
      hirdetes_cime: "2022/4 , Dízel (23439253)",
      gyartmany: "LAND ROVER",
      modell: "RANGE ROVER VELAR",
      tipus: "2022/4 , Dízel (23439253)",
      gyartasi_ev: "2022",
      vetelar: "11299000",
    },
    { id: 112 }
  );
  assert.match(withBrand.title, /Land Rover/i);
});

test("fromListCard márka nélkül elutasítva", () => {
  const msg = validateReadyToSave(
    {
      fromListCard: true,
      visibleTitle: "2022/4 , Dízel (23439253)",
      price: "11299000",
      map: {},
    },
    { vetelar: "11299000" }
  );
  assert.match(String(msg), /márka|módosítás|hirdetés/i);
});

test("ár önmagában nem elég márka/cím nélkül", () => {
  const msg = validateReadyToSave(
    {
      visibleTitle: "2022/10 , Benzin/elektromos...",
      price: "10990000",
      map: { "Gyártási év": "2022/10", Üzemanyag: "Benzin/elektromos" },
      brand: "",
    },
    { vetelar: "10990000", gyartmany: "" }
  );
  assert.match(String(msg), /márka|módosítás|hirdetés/i);
});


test("buildFormFromPage összerakja a címet, árat, km-t", () => {
  const form = buildFormFromPage({
    url: "https://www.hasznaltauto.hu/szemelyauto/volkswagen/golf/teszt-23005301",
    listingId: "23005301",
    visibleTitle: "Volkswagen Golf 1.5 TSI",
    price: "4 290 000 Ft",
    km: "125 000 km",
    year: "2018",
    fuel: "Benzin",
    brand: "Volkswagen",
    model: "Golf",
    visibleImage: "https://www.hasznaltauto.hu/kepek/auto.jpg",
  });
  assert.equal(form.hasznaltauto_hirdetes_id, "23005301");
  assert.match(form.hirdetes_cime, /Volkswagen Golf/i);
  assert.equal(form.vetelar, "4290000");
  assert.equal(form.km, "125000");
  assert.equal(form.gyartasi_ev, "2018");
  assert.equal(form.uzemanyag, "Benzin");
  assert.equal(form.jarmu_kategoria, "szemelyauto");
});

test("buildFormFromPage gyorsnézet címből márka/modell Márka sor nélkül", () => {
  const form = buildFormFromPage({
    url: "https://admin.hasznaltauto.hu/gyorsnezet/szemelyauto/23468730",
    visibleTitle:
      "KIA SPORTAGE 1.6 T-GDI HEV GT Line 4WD (Automata) FULL LED/PANORÁMA/BŐR/NAVI/3D-KAMERA/4xÜLÉS-KORMÁNYFŰTÉS/ÖNTÖLTŐS HYBRID!",
    brand: "KIA",
    model: "SPORTAGE",
    price: "10990000",
    year: "2022",
    fuel: "Benzin/elektromos",
    map: {
      "Gyártási év": "2022/10",
      Üzemanyag: "Benzin/elektromos",
      Vételár: "10.990.000 Ft",
      "Km. óra állás": "60 000 km",
    },
  });
  assert.match(form.gyartmany, /kia/i);
  assert.match(form.modell, /sportage/i);
  assert.match(form.hirdetes_cime, /sportage/i);
  assert.equal(form.vetelar, "10990000");
});

test("buildFormFromPage címből is kitölti a márkát ha brand mező üres", () => {
  const form = buildFormFromPage({
    url: "https://admin.hasznaltauto.hu/gyorsnezet/szemelyauto/23468730",
    visibleTitle: "KIA SPORTAGE 1.6 T-GDI HEV GT Line 4WD (Automata)",
    price: "10990000",
    map: {
      "Gyártási év": "2022/10",
      Üzemanyag: "Benzin/elektromos",
      Vételár: "10.990.000 Ft",
    },
  });
  assert.match(form.gyartmany, /kia/i);
  assert.match(form.modell, /sportage/i);
});

test("buildFormFromPage kihagyja a Hiba! címet és a gyorsnézet táblát használja", () => {
  const html = `
    <html><body>
      <h1>Hiba!</h1>
      <table class="hirdetesadatok">
        <tr><td class="bal pontos">Márka</td><td>Audi</td></tr>
        <tr><td class="bal pontos">Modell</td><td>A6</td></tr>
        <tr><td class="bal pontos">Évjárat</td><td>2024/3</td></tr>
        <tr><td class="bal pontos">Vételár</td><td>9 350 000 Ft</td></tr>
        <tr><td class="bal pontos">Futásteljesítmény</td><td>12 000 km</td></tr>
        <tr><td class="bal pontos">Üzemanyag</td><td>Benzin</td></tr>
        <tr><td class="bal pontos">Szín</td><td>Fekete</td></tr>
      </table>
      <div class="leiras">Leírás Megtekinthető telefonon egyeztetett időpontban.</div>
    </body></html>
  `;
  const form = buildFormFromPage({
    url: "https://admin.hasznaltauto.hu/gyorsnezet/szemelyauto/23429942",
    listingId: "23429942",
    html,
    visibleTitle: "Hiba!",
    brand: "Hiba!",
    model: "A",
    year: "2024",
    price: "9350000",
    map: {
      Márka: "Audi",
      Modell: "A6",
      Évjárat: "2024/3",
      Vételár: "9 350 000 Ft",
      Futásteljesítmény: "12 000 km",
      Üzemanyag: "Benzin",
      Szín: "Fekete",
    },
  });
  assert.match(form.gyartmany, /audi/i);
  assert.match(form.modell, /a6/i);
  assert.doesNotMatch(form.hirdetes_cime, /hiba/i);
  assert.equal(form.vetelar, "9350000");
  assert.equal(form.km, "12000");
  assert.equal(form.gyartasi_ev, "2024");
  assert.equal(form.uzemanyag, "Benzin");
  assert.equal(form.szin, "Fekete");
  assert.doesNotMatch(form.leiras || "", /megtekinthető telefonon/i);
});

test("buildFormFromPage selectből olvassa a márkát és a modellt", () => {
  const html = `
    <html><body>
      <h1>Hiba!</h1>
      <table class="hirdetesadatok">
        <tr><td class="bal pontos">Gyártmány</td><td>
          <select name="marka"><option>Válasszon</option><option selected>BMW</option><option>Audi</option></select>
        </td></tr>
        <tr><td class="bal pontos">Modell</td><td>
          <select name="modell"><option>Válasszon</option><option selected>X5</option></select>
        </td></tr>
        <tr><td class="bal pontos">Évjárat</td><td>2017</td></tr>
        <tr><td class="bal pontos">Vételár</td><td>3 290 000 Ft</td></tr>
      </table>
    </body></html>
  `;
  const form = buildFormFromPage({
    url: "https://admin.hasznaltauto.hu/gyorsnezet/szemelyauto/11112222",
    listingId: "11112222",
    html,
    visibleTitle: "Hiba!",
    brand: "A",
    model: "A",
    year: "2017",
    price: "3290000",
  });
  assert.match(form.gyartmany, /bmw/i);
  assert.match(form.modell, /x5/i);
  assert.doesNotMatch(String(form.gyartmany), /^a$/i);
  assert.match(form.hirdetes_cime, /BMW/i);
});

test("validateReadyToSave fénykép nélkül is elfogadja", () => {
  const msg = validateReadyToSave(
    { visibleTitle: "Audi A4", price: "3000000" },
    { hirdetes_cime: "Eladó Audi A4", vetelar: "3000000", gyartmany: "Audi" }
  );
  assert.equal(msg, "");
});

test("imageUrlFromHtml kiveszi az og:image-et", () => {
  const html = `<meta property="og:image" content="https://www.hasznaltauto.hu/kepek/x.jpg">`;
  assert.equal(imageUrlFromHtml(html), "https://www.hasznaltauto.hu/kepek/x.jpg");
});

test("resolvePublicHaUrl admin gyorsnézetet nyilvános URL-re vált", () => {
  assert.equal(
    resolvePublicHaUrl("https://admin.hasznaltauto.hu/gyorsnezet/szemelyauto/23005301"),
    "https://www.hasznaltauto.hu/szemelyauto/import-23005301"
  );
});

test("saveExtractedPages ment és a duplikátumot frissíti", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bymy-ha-imp-"));
  process.env.DB_BACKEND = "sqlite";
  process.env.AUTOSWEB_DB_PATH = join(dir, "test.db");
  process.env.AUTOSWEB_UPLOADS_PATH = join(dir, "listings");

  const { saveExtractedPages } = await import(`./ha-import-save.mjs?t=${Date.now()}`);
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const page = {
    url: "https://www.hasznaltauto.hu/szemelyauto/ford/kuga/teszt-88887777",
    listingId: "88887777",
    visibleTitle: "Ford Kuga",
    price: "8900000",
    km: "42000",
    year: "2021",
    fuel: "Benzin",
    brand: "Ford",
    model: "Kuga",
    imageJpegBase64: png,
  };
  const userId = await makeImportUser("business");
  const first = await saveExtractedPages({ pages: [page], userId });
  assert.equal(first.savedCount, 1);
  assert.ok(first.items[0].savedId);
  assert.equal(first.items[0].updated, false);
  const second = await saveExtractedPages({
    pages: [{ ...page, price: "9100000", km: "43000" }],
    userId,
  });
  assert.equal(second.savedCount, 1);
  assert.equal(second.skippedCount, 0);
  assert.equal(second.items[0].updated, true);
  assert.equal(second.items[0].savedId, first.items[0].savedId);
  const adminAgain = await saveExtractedPages({
    userId,
    pages: [
      {
        ...page,
        price: "9200000",
        url: "https://admin.hasznaltauto.hu/hirdetesfeladas/szemelyauto?id=88887777",
      },
    ],
  });
  assert.equal(adminAgain.savedCount, 1);
  assert.equal(adminAgain.skippedCount, 0);
  assert.equal(adminAgain.items[0].updated, true);
  rmSync(dir, { recursive: true, force: true });
});

test("saveExtractedPages felülírja a hiányos márka/modell importot", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bymy-ha-imp-repair-"));
  process.env.DB_BACKEND = "sqlite";
  process.env.AUTOSWEB_DB_PATH = join(dir, "test.db");
  process.env.AUTOSWEB_UPLOADS_PATH = join(dir, "listings");

  const { saveExtractedPages } = await import(`./ha-import-save.mjs?t=${Date.now()}-repair`);
  const url = "https://admin.hasznaltauto.hu/gyorsnezet/szemelyauto/55554444";
  const userId = await makeImportUser("business");
  await assert.rejects(
    () =>
      saveExtractedPages({
        userId,
        pages: [
          {
            url,
            listingId: "55554444",
            visibleTitle: "Hiba!",
            brand: "A",
            model: "A",
            price: "3290000",
            year: "2017",
          },
        ],
      }),
    /márka|módosítás|hirdetés|cím/i
  );
  const first = await saveExtractedPages({
    userId,
    pages: [
      {
        url,
        listingId: "55554444",
        visibleTitle: "BMW",
        brand: "BMW",
        model: "",
        price: "3290000",
        year: "2017",
      },
    ],
  });
  assert.equal(first.savedCount, 1);
  const repaired = await saveExtractedPages({
    userId,
    pages: [
      {
        url,
        listingId: "55554444",
        visibleTitle: "BMW X5",
        brand: "BMW",
        model: "X5",
        price: "3290000",
        year: "2017",
        map: { Márka: "BMW", Modell: "X5", Évjárat: "2017" },
      },
    ],
  });
  assert.equal(repaired.savedCount, 1);
  assert.equal(repaired.skippedCount, 0);
  assert.match(repaired.items[0].cim, /BMW/i);
  rmSync(dir, { recursive: true, force: true });
});

test("saveExtractedPages fénykép nélkül is ment", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bymy-ha-imp-nophoto-"));
  process.env.DB_BACKEND = "sqlite";
  process.env.AUTOSWEB_DB_PATH = join(dir, "test.db");
  process.env.AUTOSWEB_UPLOADS_PATH = join(dir, "listings");

  const { saveExtractedPages } = await import(`./ha-import-save.mjs?t=${Date.now()}-nophoto`);
  const userId = await makeImportUser("business");
  const result = await saveExtractedPages({
    userId,
    pages: [
      {
        url: "https://www.hasznaltauto.hu/szemelyauto/opel/corsa/teszt-77776666",
        listingId: "77776666",
        visibleTitle: "Opel Corsa",
        price: "1200000",
        km: "180000",
        year: "2015",
        brand: "Opel",
        model: "Corsa",
      },
    ],
  });
  assert.equal(result.savedCount, 1);
  assert.equal(result.errorCount, 0);
  assert.ok(result.items[0].savedId);
  rmSync(dir, { recursive: true, force: true });
});