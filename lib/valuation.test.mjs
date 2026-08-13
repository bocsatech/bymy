import test from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("estimateValuation: márka kötelező", async () => {
  process.env.AUTOSWEB_DB_PATH = join(__dirname, "..", "data", "autosweb.db");
  const { estimateValuation } = await import("./valuation.mjs");
  const result = estimateValuation({});
  assert.equal(result.error, "Add meg a márkát.");
});

test("estimateValuation: ismert adatokkal átlagár vagy üres találat", async () => {
  process.env.AUTOSWEB_DB_PATH = join(__dirname, "..", "data", "autosweb.db");
  const { estimateValuation, valuationOptions } = await import("./valuation.mjs");
  const options = valuationOptions();
  if (!options.gyartmanyok.length) return;

  const brand = options.gyartmanyok[0];
  const result = estimateValuation({ gyartmany: brand });
  assert.equal(result.gyartmany, brand);
  assert.ok(result.count >= 0);
  if (result.count > 0) {
    assert.ok(result.average_price > 0);
    assert.ok(result.average_price_formatted.includes("Ft"));
  } else {
    assert.equal(result.average_price, null);
  }
});
