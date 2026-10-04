import test from "node:test";
import assert from "node:assert/strict";
import { assertCanImportExistingListing } from "./listing-import-guard.mjs";

test("allows update for owner", () => {
  const r = assertCanImportExistingListing(
    { id: 1, form: { owner_user_id: "5" } },
    { id: 5 }
  );
  assert.equal(r.ok, true);
});

test("allows update for other user (re-import / teszt)", () => {
  const r = assertCanImportExistingListing(
    { id: 1, form: { owner_user_id: "5" } },
    { id: 9 }
  );
  assert.equal(r.ok, true);
});

test("allows claim when no owner", () => {
  const r = assertCanImportExistingListing({ id: 1, form: {} }, { id: 9 });
  assert.equal(r.ok, true);
});
