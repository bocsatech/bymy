import test from "node:test";
import assert from "node:assert/strict";
import { personFromProfile, vehicleFromListing } from "../public/js/adasveteli-data.js";

test("magánszemély profil szerződő féllé alakul", () => {
  const person = personFromProfile(
    { firstName: "Anna", lastName: "Kiss", postalCode: "1111", city: "Budapest", street: "Minta utca 1.", phone: "+36 30 123 4567" },
    { email: "anna@example.com" }
  );
  assert.equal(person.type, "person");
  assert.equal(person.fullName, "Kiss Anna");
  assert.equal(person.city, "Budapest");
  assert.equal(person.email, "anna@example.com");
});

test("céges profil szerződő féllé alakul", () => {
  const person = personFromProfile(
    { accountType: "business", company: "Minta Auto Kft.", companyTaxId: "12345678-2-41", companyPostalCode: "2222", companyCity: "Példa", companyStreet: "Fő út 2.", companyPhone: "+36 20 222 2222", companyEmail: "iroda@example.com", salespersonName: "Nagy Béla" },
    { email: "user@example.com" }
  );
  assert.equal(person.type, "company");
  assert.equal(person.companyName, "Minta Auto Kft.");
  assert.equal(person.representative, "Nagy Béla");
  assert.equal(person.taxId, "12345678-2-41");
});

test("hirdetés járműadatai szerződésformátumba kerülnek", () => {
  const vehicle = vehicleFromListing({ form: { gyartmany: "Toyota", modell: "Corolla", gyartasi_ev: "2021", rendszam: "ABC-123", alvazszam: "VIN123", km: "45200", vetelar: "6 500 000 Ft" } });
  assert.equal(vehicle.make, "Toyota");
  assert.equal(vehicle.model, "Corolla");
  assert.equal(vehicle.year, "2021");
  assert.equal(vehicle.vin, "VIN123");
  assert.equal(vehicle.price, "6 500 000 Ft");
});
