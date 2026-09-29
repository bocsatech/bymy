import assert from "node:assert/strict";
import test from "node:test";
import { companyContactFieldsForListingForm } from "./sync-company-profile-to-listings.mjs";

test("companyContactFieldsForListingForm: céges profil → listing cellák", () => {
  const fields = companyContactFieldsForListingForm({
    accountType: "business",
    company: "Hivatalos Kft.",
    companyListingName: "Fehérvár Autó",
    companyStreet: "Fő utca 1.",
    companyPostalCode: "8000",
    companyCity: "Székesfehérvár",
    companyPhone: "+36 22 123 4567",
    companyPhone2: "+36 30 111 2233",
    companyPhone3: "+36 70 999 8877",
    companyEmail: "iroda@example.com",
    salespersonName: "Kovács Anna",
    salespersonName2: "Nagy Béla",
  });
  assert.ok(fields);
  assert.equal(fields.company, "Fehérvár Autó");
  assert.equal(fields.cegnev, "Fehérvár Autó");
  assert.equal(fields.hirdeto_nev, "Fehérvár Autó");
  assert.equal(fields.megtekintesi_cim, "Fő utca 1.");
  assert.equal(fields.iranyitoszam, "8000");
  assert.equal(fields.telepules, "Székesfehérvár");
  assert.equal(fields.telefon1_orszag, "+36");
  assert.equal(fields.telefon1_korzet, "22");
  assert.equal(fields.email, "iroda@example.com");
  assert.equal(fields.ertekesito_neve, "Kovács Anna");
  assert.equal(fields.ertekesito_neve_2, "Nagy Béla");
  assert.equal(fields.telefon2_korzet, "30");
  assert.equal(fields.telefon3_korzet, "70");
});

test("companyContactFieldsForListingForm: magán fiók → null", () => {
  assert.equal(
    companyContactFieldsForListingForm({
      accountType: "private",
      company: "X",
      companyPhone: "+36 30 111 1111",
    }),
    null
  );
});
