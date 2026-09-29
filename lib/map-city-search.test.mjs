import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("buildNearbyFilter: keresés csak településnévvel, irsz nem origin", () => {
  const src = readFileSync(join(__dirname, "..", "public", "js", "nearby-search.js"), "utf8");
  assert.match(src, /CSAK településnév alapján/);
  assert.match(src, /Ismeretlen település/);
  // Nincs irsz-koordináta origin fallback a city resolve után
  const afterCity = src.split("resolveCityCoords(cityName, cityIndex)")[1] || "";
  assert.ok(!afterCity.includes("fetchPostalLookup(postal_code);\n  if (!origin.city"));
  assert.ok(src.includes("Adj meg települést a térképes"));
});

test("resolveHomeOrigin: nincs irsz-pin origin", () => {
  const src = readFileSync(join(__dirname, "..", "public", "js", "search-results-map.js"), "utf8");
  assert.match(src, /Irsz csak a településnév feloldásához/);
  assert.ok(!src.includes("Mentés: irányítószám koordináta"));
});

test("map uses Google Maps loader + Places search", () => {
  const src = readFileSync(join(__dirname, "..", "public", "js", "search-results-map.js"), "utf8");
  assert.match(src, /loadGoogleMaps|google-maps-loader/);
  assert.match(src, /places\.Autocomplete/);
  assert.ok(!src.includes("tile.openstreetmap.org"));
  assert.ok(!src.includes("loadLeaflet"));
});

test("site-gate: maps-config public", () => {
  const src = readFileSync(join(__dirname, "..", "lib", "site-gate.mjs"), "utf8");
  assert.match(src, /\/api\/maps-config/);
});

test("home-app: körzethez átadja a településnevet", () => {
  const src = readFileSync(join(__dirname, "..", "public", "js", "home-app.js"), "utf8");
  assert.match(src, /values\.telepules|values\?\.telepules/);
  assert.match(src, /buildNearbyFilter\(\{[\s\S]*?city,/);
});
