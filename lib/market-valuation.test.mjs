import test from "node:test";
import assert from "node:assert/strict";

import { estimateMarketValuation, marketDataAvailable } from "./market-valuation.mjs";

const ALFA = {
  gyartmany: "Alfa Romeo",
  modell: "Giulietta",
  gyartasi_ev: 2014,
  km: 156234,
  uzemanyag: "Benzin",
};

test("estimateMarketValuation: gyártmány és modell kötelező", () => {
  const result = estimateMarketValuation({ gyartmany: "Alfa Romeo" });
  assert.equal(result.error, "Add meg a gyártmányt és a modellt.");
});

test("estimateMarketValuation: szélsőérték-szűrés és kevés minta jelzés", () => {
  if (!marketDataAvailable()) return;
  const result = estimateMarketValuation(ALFA);
  if (!result.count) return;

  assert.ok(result.count <= result.matched_count);
  assert.equal(result.dropped_outliers, result.matched_count - result.count);
  assert.ok(result.recommended >= result.min_price);
  assert.ok(result.recommended <= result.max_price);
  assert.equal(result.thin, result.count < 5);
  assert.equal(typeof result.thin_note === "string", result.thin);
  if (result.dropped_outliers) {
    assert.ok(result.message.includes("szélsőérték"));
  }
});

test("estimateMarketValuation: km-súlyozás a közelebbi hirdetés felé húz", () => {
  if (!marketDataAvailable()) return;
  const low = estimateMarketValuation({ ...ALFA, km: 110000 });
  const high = estimateMarketValuation({ ...ALFA, km: 230000 });
  if (!low.count || !high.count) return;
  /* Kevesebb km → nem lehet alacsonyabb a javasolt ár, mint a futottabb mintánál. */
  assert.ok(low.recommended >= high.recommended);
});

test("estimateMarketValuation: ismeretlen modellre nincs találat", () => {
  if (!marketDataAvailable()) return;
  const result = estimateMarketValuation({
    gyartmany: "Alfa Romeo",
    modell: "Nincsilyenmodell",
    gyartasi_ev: 2014,
    km: 100000,
  });
  assert.equal(result.count, 0);
  assert.equal(result.recommended, null);
});
