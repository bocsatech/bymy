import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeKivitelMenu,
  publicKivitelLabels,
  DEFAULT_KIVITEL_MENU_ITEMS,
} from "./kivitel-menu.mjs";

test("normalizeKivitelMenu defaults when empty", () => {
  const menu = normalizeKivitelMenu({ items: [] });
  assert.equal(menu.items.length, DEFAULT_KIVITEL_MENU_ITEMS.length);
  assert.equal(menu.items[0].label, "Pickup");
  assert.equal(menu.items.at(-1).label, "Egyéb");
});

test("normalizeKivitelMenu keeps order and disables", () => {
  const menu = normalizeKivitelMenu({
    items: [
      { id: "sedan", label: "Sedan", enabled: true },
      { id: "pickup", label: "Pickup", enabled: false },
    ],
  });
  assert.equal(menu.items[0].id, "sedan");
  assert.equal(menu.items[1].id, "pickup");
  assert.equal(menu.items[1].enabled, false);
  assert.ok(menu.items.some((item) => item.id === "kombi"));
});

test("publicKivitelLabels hides disabled", () => {
  const labels = publicKivitelLabels({
    items: [
      { id: "pickup", label: "Pickup", enabled: true },
      { id: "buggy", label: "Buggy", enabled: false },
      { id: "sedan", label: "Sedan", enabled: true },
    ],
  });
  assert.deepEqual(
    labels.filter((l) => ["Pickup", "Buggy", "Sedan"].includes(l)),
    ["Pickup", "Sedan"]
  );
});
