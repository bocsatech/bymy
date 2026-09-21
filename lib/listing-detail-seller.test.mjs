import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeSellerCompanyContact,
  mergeSellerProfilePhone,
  sellerProfilePhone,
} from "./listing-detail-seller.mjs";

test("sellerProfilePhone: magán profil", () => {
  assert.equal(sellerProfilePhone({ phone: "+36 30 123 4567" }), "+36 30 123 4567");
});

test("sellerProfilePhone: cég profil", () => {
  assert.equal(
    sellerProfilePhone({ accountType: "business", companyPhone: "+36 1 234 5678", phone: "+36 30 111 1111" }),
    "+36 1 234 5678"
  );
});

test("mergeSellerProfilePhone: profil fallback, ha a hirdetésben nincs telefon", () => {
  const merged = mergeSellerProfilePhone({ phone: "", sellerName: "Teszt" }, { phone: "+36 20 999 8877" });
  assert.equal(merged.phone, "+36 20 999 8877");
  assert.match(merged.phoneMasked, /\+36 20/);
  assert.match(merged.phoneMasked, /…$/);
});

test("mergeSellerProfilePhone: hirdetés telefonja elsőbbséget élvez", () => {
  const merged = mergeSellerProfilePhone(
    { phone: "+36 70 111 2233", phoneMasked: "+36 70 …" },
    { phone: "+36 20 999 8877" }
  );
  assert.equal(merged.phone, "+36 70 111 2233");
  assert.equal(merged.phoneMasked, "+36 70 …");
});

test("mergeSellerCompanyContact: cég profil cím és telefon felülírja a hirdetés mezőit", () => {
  const merged = mergeSellerCompanyContact(
    {
      sellerName: "Régi hirdető",
      phone: "+36 70 111 2233",
      phoneMasked: "+36 70 …",
      addressLines: ["dsfwef", "3421 fgfdbhgfds"],
      mapQuery: "fgfdbhgfds",
    },
    {
      accountType: "business",
      company: "Bymy Kft.",
      companyStreet: "Példa utca 1.",
      companyPostalCode: "1111",
      companyCity: "Budapest",
      companyPhone: "+36 1 234 5678",
    }
  );
  assert.equal(merged.sellerName, "Bymy Kft.");
  assert.equal(merged.phone, "+36 1 234 5678");
  assert.deepEqual(merged.addressLines, ["Példa utca 1.", "1111 Budapest"]);
  assert.match(merged.mapQuery, /Budapest/);
});
