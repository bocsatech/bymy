import test from "node:test";
import assert from "node:assert/strict";
import { extractOdometerKm, kmDigitsFromValue, chooseOdometerKm } from "./extract-km.mjs";

test("km: lista sor 45 000 km, összefoglalóban 50 km hatótáv → 45000", () => {
  const km = extractOdometerKm({
    texts: [
      "10 999 000 Ft Hibrid (Benzin), 2023/7, 2 488 cm³, 112 kW, 152 LE, 50 km",
      "FORD KUGA 45 000 km",
    ],
  });
  assert.equal(km, "45000");
});

test("km: 0-Kmes a címben", () => {
  const km = extractOdometerKm({
    texts: ["FORD KUGA 0-Kmes Autó - Túltárolt"],
  });
  assert.equal(km, "0");
});

test("km: táblázat Futásteljesítmény mező", () => {
  const km = extractOdometerKm({
    maps: [{ Futásteljesítmény: "125 000 km" }],
  });
  assert.equal(km, "125000");
});

test("km: Km óra állás felirat", () => {
  assert.equal(kmDigitsFromValue("82 500 km"), "82500");
  assert.equal(chooseOdometerKm([50, 82500]), "82500");
});

test("km: Km. óra állás felirat (ponttal)", () => {
  const km = extractOdometerKm({
    maps: [{ "Km. óra állás": "82 500 km" }],
  });
  assert.equal(km, "82500");
});

test("km: 125 ezer km", () => {
  assert.equal(kmDigitsFromValue("125 ezer km"), "125000");
});

test("pickValue: Km. óra állás illesztés", async () => {
  const { pickValue } = await import("./parse-listing.mjs");
  const map = { "Km. óra állás": "45 000 km" };
  assert.equal(pickValue(map, ["km óra állás", "km. óra állás"]), "45 000 km");
});
