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

test("index.html: kategória sáv 8 gombbal", () => {
  const html = readFileSync(join(__dirname, "..", "public", "index.html"), "utf8");
  assert.ok(html.includes("home-category-bar"));
  for (const id of HOME_CATEGORY_IDS) {
    assert.ok(html.includes(`data-category="${id}"`), `hiányzik: ${id}`);
  }
  assert.ok(html.includes("/images/categories/elektromos.jpg"));
  assert.ok(html.includes("/images/categories/benzin.jpg"));
  assert.ok(html.includes("/images/categories/ot.jpg"));
  assert.ok(html.includes("/images/categories/leasing.jpg"));
  assert.ok(html.includes("/images/categories/hybrid.jpg"));
  assert.ok(html.includes("/images/categories/diesel.jpg"));
  assert.ok(html.includes("/images/categories/berelheto.jpg"));
});
