import test from "node:test";
import assert from "node:assert/strict";
import {
  fuelProfile,
  fuelFieldVisibility,
  normalizeAdFuelValue,
} from "../public/js/ad-form-fuel-profile.js";

test("fuelProfile: dízel = combustion", () => {
  assert.equal(fuelProfile("Dízel"), "combustion");
  assert.equal(fuelProfile("Diesel"), "combustion");
});

test("fuelProfile: benzin = combustion", () => {
  assert.equal(fuelProfile("Benzin"), "combustion");
});

test("fuelProfile: elektromos", () => {
  assert.equal(fuelProfile("Elektromos"), "electric");
});

test("fuelProfile: hibrid variánsok", () => {
  assert.equal(fuelProfile("Hibrid"), "hybrid");
  assert.equal(fuelProfile("Hibrid (Benzin)"), "hybrid");
  assert.equal(fuelProfile("Hibrid (Dízel)"), "hybrid");
  assert.equal(fuelProfile("Benzin/elektromos"), "hybrid");
});

test("fuelFieldVisibility", () => {
  assert.deepEqual(fuelFieldVisibility("combustion"), {
    showElectric: false,
    showConsumption: true,
    showHenger: true,
  });
  assert.deepEqual(fuelFieldVisibility("electric"), {
    showElectric: true,
    showConsumption: false,
    showHenger: true,
  });
  assert.deepEqual(fuelFieldVisibility("hybrid"), {
    showElectric: true,
    showConsumption: true,
    showHenger: true,
  });
});

test("fuelProfile: hidrogén/elektromos", () => {
  assert.equal(fuelProfile("Hidrogén/elektromos"), "electric");
});

test("normalizeAdFuelValue aliases", () => {
  assert.equal(normalizeAdFuelValue("Diesel"), "Dízel");
});
