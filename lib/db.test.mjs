import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { formDataToCells, cellsToFormData } from "./form-field-catalog.mjs";

test("formDataToCells: csak kitöltött mezők és extrák", () => {
  const cells = formDataToCells({
    gyartmany: "FORD",
    km: "45000",
    leiras: "Szép autó.",
    felszereltseg: ["tempomat", "könnyűfém felni"],
  });

  assert.ok(cells.some((c) => c.field_key === "km" && c.label === "Km. óra állás"));
  assert.ok(cells.some((c) => c.field_key === "gyartmany" && c.label === "Gyártmány"));
  assert.ok(cells.some((c) => c.label === "tempomat" && c.value === "1"));
  assert.equal(cells.some((c) => c.label.includes("Segítség")), false);
});

test("cellsToFormData: visszaállítás", () => {
  const cells = formDataToCells({
    modell: "KUGA",
    felszereltseg: ["bluetooth-os kihangosító"],
  });
  const data = cellsToFormData(cells);
  assert.equal(data.modell, "KUGA");
  assert.deepEqual(data.felszereltseg, ["bluetooth-os kihangosító"]);
});

test("saveListing: sqlite fájlba ment", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "autosweb-db-"));
  process.env.AUTOSWEB_DB_PATH = join(tempDir, "test.db");

  const {
    saveListing,
    getListing,
    dbStats,
    listListings,
    listingSourceExists,
    findListingByHasznaltautoId,
    listListingsWithPreview,
    updateListingFoKep,
    recordListingView,
  } = await import(`./db.mjs?t=${Date.now()}`);

  const saved = saveListing(
    {
      hirdetes_cime: "Eladó FORD KUGA (2023)",
      gyartmany: "FORD",
      modell: "KUGA",
      km: "45000",
      forras_url: "https://www.hasznaltauto.hu/szemelyauto/ford/kuga/test-12345678",
      hasznaltauto_hirdetes_id: "12345678",
      fo_kep: "/uploads/listings/12345678.jpg",
    },
    null,
    { status: "mentett" }
  );

  assert.ok(saved.id);
  assert.equal(saved.status, "mentett");
  assert.equal(saved.form.km, "45000");
  assert.equal(saved.fo_kep, "/uploads/listings/12345678.jpg");
  assert.ok(saved.cells.some((c) => c.label === "Km. óra állás"));

  const loaded = getListing(saved.id);
  assert.equal(loaded.form.gyartmany, "FORD");
  assert.equal(loaded.fo_kep, "/uploads/listings/12345678.jpg");

  assert.equal(
    listingSourceExists({
      sourceUrl: "https://www.hasznaltauto.hu/szemelyauto/ford/kuga/test-12345678",
    }),
    true
  );
  assert.equal(listingSourceExists({ hasznaltautoId: "12345678" }), true);
  assert.equal(listingSourceExists({ sourceUrl: "https://other.example/x" }), false);
  assert.ok(findListingByHasznaltautoId("12345678"));

  const withPreview = listListingsWithPreview({ limit: 10 });
  // Helyi fájl nincs a lemezen → üres imageUrl (ne törött <img>)
  assert.equal(withPreview[0].fo_kep, "/uploads/listings/12345678.jpg");
  assert.equal(withPreview[0].preview.imageUrl, "");

  const remote = saveListing(
    {
      hirdetes_cime: "Remote kep",
      forras_url: "https://www.hasznaltauto.hu/szemelyauto/x/y-99999999",
      hasznaltauto_hirdetes_id: "99999999",
      fo_kep: "https://www.hasznaltauto.hu/img/test.jpg",
    },
    null,
    { status: "feladott" }
  );
  const remotePreview = listListingsWithPreview({ limit: 10 }).find((row) => row.id === remote.id);
  assert.match(remotePreview.preview.imageUrl, /^\/api\/media\/proxy\?url=/);

  const stats = dbStats();
  assert.equal(stats.listings, 2);
  assert.equal(stats.mentett, 1);
  assert.equal(stats.feladott, 1);
  assert.ok(stats.cells >= 4);

  const feladott = saveListing({ hirdetes_cime: "Feladott teszt", gyartmany: "BMW" }, null, {
    status: "feladott",
  });
  assert.equal(feladott.status, "feladott");
  assert.equal(listListings({ status: "feladott" }).length, 2);

  const repaired = updateListingFoKep(saved.id, "/uploads/listings/repaired.jpg");
  assert.equal(repaired.fo_kep, "/uploads/listings/repaired.jpg");

  const viewed = recordListingView(feladott.id, "web");
  recordListingView(feladott.id, "app");
  recordListingView(feladott.id, "app");
  assert.equal(viewed.views_web, 1);
  const afterEdit = saveListing(
    { hirdetes_cime: "Feladott teszt", gyartmany: "BMW", views_web: "0" },
    feladott.id,
    { status: "feladott" }
  );
  assert.equal(afterEdit.views_web, 1);
  assert.equal(afterEdit.views_app, 2);

  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.AUTOSWEB_DB_PATH;
});
