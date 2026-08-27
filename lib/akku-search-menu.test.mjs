import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAkkuSearchMenu,
  publicAkkuSearchSection,
  DEFAULT_AKKU_SEARCH_MENU_ITEMS,
  akkuKindLabel,
  menuFromFormLayoutCells,
} from "./akku-search-menu.mjs";

test("normalizeAkkuSearchMenu defaults when empty — all disabled", () => {
  const menu = normalizeAkkuSearchMenu({ items: [] });
  assert.equal(menu.items.length, DEFAULT_AKKU_SEARCH_MENU_ITEMS.length);
  assert.equal(menu.items[0].id, "akkumulator_kwh");
  assert.ok(menu.items.every((item) => item.enabled === false));
});

test("normalizeAkkuSearchMenu keeps order and adds missing defaults", () => {
  const menu = normalizeAkkuSearchMenu({
    items: [{ id: "hatotav", kind: "range", label: "Hatótáv WLTP", enabled: true }],
  });
  assert.equal(menu.items[0].id, "hatotav");
  assert.equal(menu.items[0].label, "Hatótáv WLTP");
  assert.equal(menu.items[0].enabled, true);
  assert.ok(menu.items.some((item) => item.id === "villamtoltes"));
  assert.equal(menu.items.find((item) => item.id === "villamtoltes")?.enabled, false);
});

test("publicAkkuSearchSection is empty when nothing enabled", () => {
  const section = publicAkkuSearchSection({ items: [] });
  assert.equal(section.ranges.length, 0);
  assert.equal(section.selects.length, 0);
  assert.equal(section.toggles.length, 0);
});

test("publicAkkuSearchSection hides disabled and groups fields", () => {
  const section = publicAkkuSearchSection({
    title: "Akku adatok",
    items: [
      { id: "hatotav", kind: "range", label: "WLTP", unit: "km", step: "1", enabled: true },
      { id: "villamtoltes", kind: "toggle", label: "Villámtöltés", enabled: false },
      {
        id: "ac_tolto_csatlakozas",
        kind: "select",
        label: "AC csatlakozó",
        options: ["", "Type 2"],
        enabled: true,
      },
    ],
  });
  assert.equal(section.title, "Akku adatok");
  const hatotav = section.ranges.find((item) => item.id === "hatotav");
  assert.equal(hatotav?.label, "WLTP");
  assert.ok(section.selects.some((item) => item.id === "ac_tolto_csatlakozas"));
  assert.ok(!section.toggles.some((item) => item.id === "villamtoltes"));
});

test("akkuKindLabel", () => {
  assert.equal(akkuKindLabel("range"), "Tól–ig");
  assert.equal(akkuKindLabel("toggle"), "Kapcsoló");
});

test("menuFromFormLayoutCells respects hidden and order", () => {
  const menu = menuFromFormLayoutCells([
    { field_key: "villamtoltes", label: "Villám", hidden: false, row: 2, col: 1 },
    { field_key: "hatotav", label: "WLTP custom", hidden: true, row: 1, col: 1 },
    { field_key: "gyartmany", label: "Márka", hidden: false, row: 1, col: 1 },
  ]);
  assert.equal(menu.items[0].id, "hatotav");
  assert.equal(menu.items[0].enabled, false);
  assert.equal(menu.items[0].label, "WLTP custom");
  assert.equal(menu.items[1].id, "villamtoltes");
  assert.equal(menu.items[1].enabled, true);
  const section = publicAkkuSearchSection(menu);
  assert.ok(!section.ranges.some((r) => r.id === "hatotav"));
  assert.ok(section.toggles.some((t) => t.id === "villamtoltes"));
});
