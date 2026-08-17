import test from "node:test";
import assert from "node:assert/strict";
import { mergeProtectedCells, listingStatsFromForm, canManageListing } from "./listing-meta.mjs";

test("mergeProtectedCells megőrzi a megtekintéseket szerkesztéskor", () => {
  const merged = mergeProtectedCells(
    [
      { field_key: "gyartmany", label: "Gyártmány", value: "BMW", step: 1 },
      { field_key: "views_web", label: "Web megtekintés", value: "0", step: 9 },
    ],
    [
      { field_key: "views_web", label: "Web megtekintés", value: "12", step: 9 },
      { field_key: "views_app", label: "App megtekintés", value: "3", step: 9 },
      { field_key: "owner_user_id", label: "Tulajdonos", value: "7", step: 9 },
      { field_key: "fotok", label: "Fotók", value: "/img/a.jpg", step: 4 },
    ]
  );
  const byKey = Object.fromEntries(merged.map((cell) => [cell.field_key, cell.value]));
  assert.equal(byKey.gyartmany, "BMW");
  assert.equal(byKey.views_web, "12");
  assert.equal(byKey.views_app, "3");
  assert.equal(byKey.owner_user_id, "7");
  assert.equal(byKey.fotok, "/img/a.jpg");
});

test("mergeProtectedCells az új fotólistát veszi, ha nem üres", () => {
  const merged = mergeProtectedCells(
    [{ field_key: "fotok", label: "Fotók", value: "/img/b.jpg\n/img/c.jpg", step: 4 }],
    [{ field_key: "fotok", label: "Fotók", value: "/img/a.jpg", step: 4 }]
  );
  assert.equal(merged.find((cell) => cell.field_key === "fotok")?.value, "/img/b.jpg\n/img/c.jpg");
});

test("listingStatsFromForm web+app összesítés", () => {
  const stats = listingStatsFromForm({ views_web: "4", views_app: "6" });
  assert.deepEqual(stats.views, { web: 4, app: 6, total: 10 });
});

test("canManageListing: gazdátlan hirdetést a bejelentkezett user kezelheti", () => {
  assert.equal(canManageListing({ user_id: null }, { id: 2 }), true);
  assert.equal(canManageListing({ user_id: 2 }, { id: 2 }), true);
  assert.equal(canManageListing({ user_id: 9 }, { id: 2 }), false);
  assert.equal(canManageListing({ user_id: 2 }, null), false);
});
