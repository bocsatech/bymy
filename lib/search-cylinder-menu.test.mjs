import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SEARCH_CYLINDER_ITEMS,
  normalizeSearchCylinderMenu,
  publicSearchCylinderItems,
} from "./search-cylinder-menu.mjs";

test("normalize kitölti a hiányzó alap elemeket", () => {
  const menu = normalizeSearchCylinderMenu({ items: [{ id: "elado", label: "Eladó" }] });
  assert.equal(menu.items.length, DEFAULT_SEARCH_CYLINDER_ITEMS.length);
  assert.equal(menu.items[0].id, "elado");
  assert.equal(menu.items[0].label, "Eladó");
  assert.ok(menu.items.some((item) => item.id === "szemelyauto"));
});

test("publicSearchCylinderItems kihagyja a kikapcsoltakat", () => {
  const menu = normalizeSearchCylinderMenu({
    items: DEFAULT_SEARCH_CYLINDER_ITEMS.map((item) =>
      item.id === "airbnb" ? { ...item, enabled: false } : item
    ),
  });
  const pub = publicSearchCylinderItems(menu);
  assert.equal(pub.length, DEFAULT_SEARCH_CYLINDER_ITEMS.length - 1);
  assert.ok(!pub.some((item) => item.id === "airbnb"));
});

test("rossz href visszatér az alapértelmezettre", () => {
  const menu = normalizeSearchCylinderMenu({
    items: [{ id: "szemelyauto", href: "javascript:alert(1)" }],
  });
  assert.equal(menu.items.find((i) => i.id === "szemelyauto").href, "/auto.html");
});
