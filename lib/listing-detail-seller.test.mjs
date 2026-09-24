import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSellerInventoryContact,
  companyContactAddressLines,
  mergeSellerCompanyContact,
  mergeSellerProfilePhone,
  publicSellerInventoryContact,
  sellerProfilePhone,
} from "./listing-detail-seller.mjs";

test("buildSellerInventoryContact: értékesítők + telefon + cím", () => {
  const contact = buildSellerInventoryContact({
    displayName: "X",
    profile: {
      accountType: "business",
      company: "AutoKing Kft.",
      companyStreet: "Példa utca 1.",
      companyPostalCode: "1111",
      companyCity: "Budapest",
      companyPhone: "+36 1 234 5678",
      companyPhone2: "+36 30 111 2233",
      salespersonName: "Kovács Anna",
      salespersonName2: "Nagy Béla",
      avatarDataUrl: "data:image/png;base64,xx",
    },
  });
  assert.equal(contact.sellerName, "AutoKing Kft.");
  assert.equal(contact.staff.length, 2);
  assert.equal(contact.staff[0].name, "Kovács Anna");
  assert.equal(contact.staff[0].photoUrl, "data:image/png;base64,xx");
  assert.equal(contact.staff[1].name, "Nagy Béla");
  assert.deepEqual(contact.phones, ["+36 1 234 5678", "+36 30 111 2233"]);
  assert.equal(contact.hasPhone, true);
  assert.equal(contact.phonesMasked.length, 2);
  assert.match(contact.phonesMasked[0], /…$/);
  assert.ok(contact.addressLines.some((l) => /Példa utca/.test(l)));
  assert.match(contact.mapQuery, /Példa utca|Budapest/);
  const pub = publicSellerInventoryContact(contact);
  assert.equal(pub.phones, undefined);
  assert.equal(pub.hasPhone, true);
  assert.match(pub.phonesMasked[0], /…$/);
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

test("companyContactAddressLines: irsz+település ne legyen kétszer (utca mezőben is)", () => {
  const lines = companyContactAddressLines({
    accountType: "business",
    companyStreet: "8000 Székesfehérvár",
    companyPostalCode: "8000",
    companyCity: "Székesfehérvár",
  });
  assert.deepEqual(lines, ["8000 Székesfehérvár Fejér"]);
});

test("companyContactAddressLines: valódi utca + település külön sor", () => {
  const lines = companyContactAddressLines({
    accountType: "business",
    companyStreet: "Példa utca 1.",
    companyPostalCode: "8000",
    companyCity: "Székesfehérvár",
  });
  assert.deepEqual(lines, ["Példa utca 1.", "8000 Székesfehérvár Fejér"]);
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
