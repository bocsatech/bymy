import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  filterByCategory,
  HOME_CATEGORY_IDS,
} from "../public/js/home-category-bar.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const benzinItem = {
  preview: { filter: { uzemanyag: "Benzin" }, kmNum: 50000 },
};
const dieselItem = {
  preview: { filter: { uzemanyag: "Dízel" }, kmNum: 80000 },
};
const evItem = {
  preview: { filter: { uzemanyag: "Elektromos" }, kmNum: 12000 },
};

test("filterByCategory: benzin", () => {
  const filtered = filterByCategory([benzinItem, dieselItem], "benzin");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0], benzinItem);
});

test("filterByCategory: diesel", () => {
  const filtered = filterByCategory([benzinItem, dieselItem], "diesel");
  assert.equal(filtered.length, 1);
});

test("filterByCategory: elektromos", () => {
  const filtered = filterByCategory([evItem, benzinItem], "elektromos");
  assert.equal(filtered.length, 1);
});

test("index.html: autó kategória ikonok a szűrt autó oldalra mutatnak", () => {
  const html = readFileSync(join(__dirname, "..", "public", "index.html"), "utf8");
  assert.ok(html.includes("hf-card--kategoria"));
  assert.ok(html.includes("hub-auto-categories.js"));
  for (const id of HOME_CATEGORY_IDS) {
    assert.ok(html.includes(`data-auto-cat="${id}"`), `hiányzik: ${id}`);
    assert.ok(html.includes(`/auto.html?cat=${id}`), `hiányzik href: ${id}`);
  }
  assert.ok(html.includes("/images/categories/benzin.png"));
  assert.ok(html.includes("/images/categories/diesel.png"));
});

test("index.html: autók a közelben szekció aktív", () => {
  const html = readFileSync(join(__dirname, "..", "public", "index.html"), "utf8");
  assert.ok(html.includes('data-hf="kozelben"'));
  assert.ok(html.includes('id="hub-nearby-rail"'));
  assert.ok(html.includes("hub-nearby-cars.js"));
  assert.ok(html.includes('id="hub-nearby-all"'));
});

test("auto.html: kategória sáv helye a listához", () => {
  const html = readFileSync(join(__dirname, "..", "public", "auto.html"), "utf8");
  assert.ok(html.includes('id="home-category-bar"'));
  assert.ok(html.includes("home-app.js"));
});
