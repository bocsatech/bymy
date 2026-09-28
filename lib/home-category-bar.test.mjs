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

test("auto.html: kategória sáv helye a listához", () => {
  const html = readFileSync(join(__dirname, "..", "public", "auto.html"), "utf8");
  assert.ok(html.includes('id="home-category-bar"'));
  assert.ok(html.includes("home-app.js"));
});
