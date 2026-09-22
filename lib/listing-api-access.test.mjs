import test from "node:test";
import assert from "node:assert/strict";
import {
  applyListingAccessPolicy,
  sanitizeListingForPublic,
  sanitizeListingList,
  sanitizePublicPartnerProfile,
} from "./listing-api-access.mjs";

test("sanitizeListingForPublic: telefon, form, user_id nélkül", () => {
  const raw = {
    id: 1,
    user_id: 9,
    form: { telefon: "+36301234567", gyartmany: "BMW" },
    cells: [{ field_key: "telefon" }],
    detail: {
      phone: "+36301234567",
      phoneMasked: "+36 30 *** **67",
      userId: 9,
      addressLines: ["Fő utca 1", "1011 Budapest"],
      mapQuery: "Budapest, Magyarország",
    },
  };
  const out = sanitizeListingForPublic(raw);
  assert.equal(out.user_id, undefined);
  assert.equal(out.form, undefined);
  assert.equal(out.cells, undefined);
  assert.equal(out.detail.phone, undefined);
  assert.equal(out.detail.userId, undefined);
  assert.equal(out.detail.hasPhone, true);
  assert.deepEqual(out.detail.addressLines, ["1011 Budapest"]);
});

test("applyListingAccessPolicy: tulajdonos látja a teljes adatot", () => {
  const listing = { user_id: 2, form: { telefon: "123" }, detail: { phone: "123" } };
  const full = applyListingAccessPolicy(listing, { user: { id: 2 } });
  assert.equal(full.form.telefon, "123");
  const pub = applyListingAccessPolicy(listing, { user: { id: 3 } });
  assert.equal(pub.form, undefined);
});

test("sanitizeListingList: user_id eltávolítása", () => {
  const out = sanitizeListingList([{ id: 1, user_id: 5, preview: {} }]);
  assert.equal(out[0].user_id, undefined);
});

test("sanitizePublicPartnerProfile: user_id kihagyva, nyilvános mezők megmaradnak", () => {
  const out = sanitizePublicPartnerProfile({
    slug: "demo",
    display_name: "Demo",
    email: "partner@example.com",
    phone: "+36 30 123 4567",
    commission: "2–4%",
    user_id: 3,
    is_verified: true,
  });
  assert.equal(out.display_name, "Demo");
  assert.equal(out.email, "partner@example.com");
  assert.equal(out.phone, "+36 30 123 4567");
  assert.equal(out.commission, "2–4%");
  assert.equal(out.user_id, undefined);
});
