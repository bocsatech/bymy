import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { isBigCityPostalCode, normalizePostalCode } from "./postal-codes.mjs";

test("normalizePostalCode: 4 számjegy", () => {
  assert.equal(normalizePostalCode("8000"), "8000");
  assert.equal(normalizePostalCode(" 1138 "), "1138");
  assert.equal(normalizePostalCode("12"), null);
});

test("isBigCityPostalCode: Budapest és megyei jogú városok", () => {
  assert.equal(isBigCityPostalCode("1138"), true);
  assert.equal(isBigCityPostalCode("8000"), false);
  assert.equal(isBigCityPostalCode("6720"), true);
});

test("lookupPostalCodeFromSeed: 8000 Székesfehérvár", async () => {
  const { lookupPostalCodeFromSeed, listPostalCitiesFromSeed } = await import("./postal-codes.mjs");
  const row = lookupPostalCodeFromSeed("8000");
  assert.ok(row);
  assert.equal(row.postal_code, "8000");
  assert.equal(row.city, "Székesfehérvár");
  const cities = listPostalCitiesFromSeed();
  assert.ok(cities.some((c) => c.city === "Székesfehérvár"));
});

test("getPostalCode: Vercel-en seed adat, SQLite nélkül", async () => {
  const prev = process.env.VERCEL;
  process.env.VERCEL = "1";
  try {
    const { getPostalCode } = await import(`./partners.mjs?vercel=${Date.now()}`);
    const row = getPostalCode("1138");
    assert.ok(row);
    assert.equal(row.city, "Budapest");
  } finally {
    if (prev === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prev;
  }
});

test("getPartnerRecommendations: távolság sáv és limit", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "autosweb-partners-"));
  process.env.AUTOSWEB_DB_PATH = join(tempDir, "test.db");

  const { savePartner, getPartnerRecommendations } = await import(`./partners.mjs?t=${Date.now()}`);

  savePartner({
    name: "Közeli szerelő",
    address: "Fő u. 1.",
    postal_code: "8000",
    phone: "+36 22 111 1111",
    is_active: true,
    is_paid: true,
    services: ["autoszerelo"],
    google_rating: 4.5,
    google_review_count: 10,
  });

  savePartner({
    name: "Távoli szerelő",
    address: "Fő u. 2.",
    postal_code: "6720",
    phone: "+36 62 222 2222",
    is_active: true,
    is_paid: true,
    services: ["autoszerelo"],
  });

  savePartner({
    name: "Nem fizetős",
    address: "Fő u. 3.",
    postal_code: "8000",
    phone: "+36 22 333 3333",
    is_active: true,
    is_paid: false,
    services: ["autoszerelo"],
  });

  const result = getPartnerRecommendations("8000");
  assert.equal(result.postal_code, "8000");
  assert.equal(result.is_big_city, false);
  assert.equal(result.max_results, 3);

  const autoszerelo = result.categories.find((c) => c.id === "autoszerelo");
  assert.ok(autoszerelo);
  assert.equal(autoszerelo.partners.length, 1);
  assert.equal(autoszerelo.partners[0].name, "Közeli szerelő");
  assert.ok(autoszerelo.partners[0].distance_km <= 5);

  const ures = result.categories.find((c) => c.id === "gumiszerelo");
  assert.equal(ures.partners.length, 0);
  assert.equal(ures.empty_message, "Hamarosan a környékeden is");

  delete process.env.AUTOSWEB_DB_PATH;
  rmSync(tempDir, { recursive: true, force: true });
});

test("getPartnerRecommendations: nagyváros max 5", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "autosweb-partners-"));
  process.env.AUTOSWEB_DB_PATH = join(tempDir, "test.db");

  const { savePartner, getPartnerRecommendations } = await import(`./partners.mjs?t=${Date.now()}`);

  for (let i = 0; i < 6; i += 1) {
    savePartner({
      name: `Budapest gumis ${i + 1}`,
      address: `Utca ${i + 1}.`,
      postal_code: "1117",
      phone: `+36 1 400 000${i}`,
      is_active: true,
      is_paid: true,
      services: ["gumiszerelo"],
    });
  }

  const result = getPartnerRecommendations("1138");
  assert.equal(result.is_big_city, true);
  assert.equal(result.max_results, 5);
  const gumis = result.categories.find((c) => c.id === "gumiszerelo");
  assert.equal(gumis.partners.length, 5);

  delete process.env.AUTOSWEB_DB_PATH;
  rmSync(tempDir, { recursive: true, force: true });
});
