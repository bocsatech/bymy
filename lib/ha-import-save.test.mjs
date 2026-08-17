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

test("isChromeTitle kiszűri a belépés / hasznaltauto címeket", () => {
  assert.equal(isChromeTitle("Belépés"), true);
  assert.equal(isChromeTitle("hasznaltauto.hu"), true);
  assert.equal(isChromeTitle("Volkswagen Golf"), false);
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

test("saveExtractedPages ment és a duplikátumot átugorja", async () => {
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
  const first = await saveExtractedPages({ pages: [page] });
  assert.equal(first.savedCount, 1);
  assert.ok(first.items[0].savedId);
  const second = await saveExtractedPages({ pages: [page] });
  assert.equal(second.savedCount, 0);
  assert.equal(second.skippedCount, 1);
  const adminAgain = await saveExtractedPages({
    pages: [
      {
        ...page,
        url: "https://admin.hasznaltauto.hu/gyorsnezet/szemelyauto/88887777",
      },
    ],
  });
  assert.equal(adminAgain.savedCount, 0);
  assert.equal(adminAgain.skippedCount, 1);
  rmSync(dir, { recursive: true, force: true });
});

test("saveExtractedPages fénykép nélkül is ment", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bymy-ha-imp-nophoto-"));
  process.env.DB_BACKEND = "sqlite";
  process.env.AUTOSWEB_DB_PATH = join(dir, "test.db");
  process.env.AUTOSWEB_UPLOADS_PATH = join(dir, "listings");

  const { saveExtractedPages } = await import(`./ha-import-save.mjs?t=${Date.now()}-nophoto`);
  const result = await saveExtractedPages({
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