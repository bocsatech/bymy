import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { filterByCategory } from "../public/js/home-category-bar.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const benzinItem = {
  preview: { filter: { uzemanyag: "Benzin" }, kmNum: 50000 },
};
const dieselItem = {
  preview: { filter: { uzemanyag: "Dízel" }, kmNum: 80000, title: "Mercedes Mild hybrid drive" },
};
const dieselMildTitle = {
  preview: {
    title: "Mercedes-Benz C 220 T d Mild hybrid drive",
    filter: { uzemanyag: "Dízel" },
    kmNum: 80000,
  },
};
const evItem = {
  preview: { filter: { uzemanyag: "Elektromos" }, kmNum: 12000 },
};
const hybridItem = {
  preview: { filter: { uzemanyag: "Benzin/elektromos" }, kmNum: 20000 },
};
const dieselHybridFuel = {
  preview: { filter: { uzemanyag: "Dízel/elektromos" }, kmNum: 30000 },
};
const leasingItem = {
  preview: { filter: { uzemanyag: "Benzin", hirdetes_alkategoria: "leasing" }, kmNum: 10000 },
};
const rentItem = {
  preview: { filter: { uzemanyag: "Benzin", berelheto: "1" }, kmNum: 15000 },
};

test("filterByCategory: benzin", () => {
  const filtered = filterByCategory([benzinItem, dieselItem, hybridItem], "benzin");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0], benzinItem);
});

test("filterByCategory: diesel", () => {
  const filtered = filterByCategory([benzinItem, dieselItem, dieselMildTitle], "diesel");
  assert.equal(filtered.length, 2);
});

test("filterByCategory: elektromos", () => {
  const filtered = filterByCategory([evItem, benzinItem], "elektromos");
  assert.equal(filtered.length, 1);
});

test("filterByCategory: hybrid csak üzemanyag, nem cím", () => {
  const filtered = filterByCategory(
    [dieselMildTitle, dieselItem, hybridItem, dieselHybridFuel, evItem],
    "hybrid"
  );
  assert.equal(filtered.length, 2);
  assert.ok(filtered.includes(hybridItem));
  assert.ok(filtered.includes(dieselHybridFuel));
  assert.ok(!filtered.includes(dieselMildTitle));
});

test("filterByCategory: leasing feladás alkategória", () => {
  const filtered = filterByCategory([leasingItem, benzinItem], "leasing");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0], leasingItem);
});

test("filterByCategory: bérelhető feladás mező", () => {
  const filtered = filterByCategory([rentItem, benzinItem], "berelheto");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0], rentItem);
});

test("filterByCategory: OT egyelőre üres", () => {
  const filtered = filterByCategory([benzinItem, dieselItem, hybridItem], "ot");
  assert.equal(filtered.length, 0);
});

test("index.html: autó kategória ikonok a szűrt autó oldalra mutatnak", () => {
  const html = readFileSync(join(__dirname, "..", "public", "index.html"), "utf8");
  assert.ok(html.includes("hub-menu-rails.js"));
  assert.ok(html.includes('id="hub-auto-kategoriak-rail"'));
  assert.ok(html.includes('data-hf="auto-kategoriak"'));
});

test("index.html: autók a közelben szekció aktív", () => {
  const html = readFileSync(join(__dirname, "..", "public", "index.html"), "utf8");
  assert.ok(html.includes('data-hf="kozelben"'));
  assert.ok(html.includes('id="hub-nearby-rail"'));
  assert.ok(html.includes("hub-nearby-cars.js"));
  assert.ok(html.includes('id="hub-nearby-all"'));
});

test("index.html: ingatlan / kedvenc / ajánlás sínek a főoldalon", () => {
  const html = readFileSync(join(__dirname, "..", "public", "index.html"), "utf8");
  assert.ok(html.includes('data-hf="elado-lakasok"'));
  assert.ok(html.includes('data-hf="elado-hazak"'));
  assert.ok(html.includes('data-hf="ajanlas-ingatlan"'));
  assert.ok(html.includes('data-hf="ajanlasok"'));
  assert.ok(html.includes('data-hf="kedvencek"'));
  assert.ok(html.includes("hub-home-extra-rails.js"));
  assert.ok(html.includes('id="hub-nearby-lakas-rail"'));
  assert.ok(html.includes('id="hub-nearby-haz-rail"'));
  assert.ok(html.includes('id="hub-ajanlas-ingatlan-rail"'));
  assert.ok(html.includes('id="hub-ajanlas-auto-rail"'));
  assert.ok(html.includes('id="hub-fav-rail"'));
});

test("filterByCategory: benzin kizárja dízel/elektromos/hibrid", () => {
  const filtered = filterByCategory(
    [benzinItem, dieselItem, evItem, hybridItem, dieselHybridFuel],
    "benzin"
  );
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0], benzinItem);
});

test("filterByCategory: diesel kizárja benzint és hibridet", () => {
  const filtered = filterByCategory(
    [benzinItem, dieselItem, hybridItem, dieselHybridFuel, evItem],
    "diesel"
  );
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0], dieselItem);
});

test("filterByCategory: elektromos kizárja hibridet", () => {
  const filtered = filterByCategory([evItem, hybridItem, benzinItem], "elektromos");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0], evItem);
});

test("hub-menu-rails: kategória csempék auto.html?cat= linkre mennek", () => {
  const html = readFileSync(join(__dirname, "..", "public", "js", "hub-menu-rails.js"), "utf8");
  assert.ok(html.includes("autoCategoryHref"));
  assert.ok(html.includes("hub-auto-kategoriak-rail"));
  const bar = readFileSync(join(__dirname, "..", "public", "js", "home-category-bar.js"), "utf8");
  assert.ok(bar.includes("/auto.html?cat="));
});

test("home-app: URL cat kategória az autó oldalon is érvényesül", () => {
  const src = readFileSync(join(__dirname, "..", "public", "js", "home-app.js"), "utf8");
  assert.ok(src.includes("resolveCategoryFromUrl"));
  assert.ok(src.includes("HOME_CATEGORY_IDS"));
  assert.match(src, /categoryFilter = fromUrl/);
  assert.match(src, /searchResultsCommitted = true/);
});
