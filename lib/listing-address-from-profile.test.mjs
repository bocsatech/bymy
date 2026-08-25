import test from "node:test";
import assert from "node:assert/strict";
import {
  fillEmptyListingAddressFromProfile,
  getListingAddressFromProfile,
} from "./listing-address-from-profile.mjs";

test("getListingAddressFromProfile: magán cím", () => {
  const addr = getListingAddressFromProfile({
    accountType: "private",
    street: "Fő utca 1.",
    postalCode: "1117",
    city: "Budapest",
  });
  assert.equal(addr.street, "Fő utca 1.");
  assert.equal(addr.postalCode, "1117");
  assert.equal(addr.city, "Budapest");
});

test("getListingAddressFromProfile: cég cím elsőbbség", () => {
  const addr = getListingAddressFromProfile({
    accountType: "business",
    street: "Magán utca",
    city: "Pest",
    companyStreet: "Ipari park 3.",
    companyPostalCode: "2040",
    companyCity: "Budaörs",
  });
  assert.equal(addr.street, "Ipari park 3.");
  assert.equal(addr.postalCode, "2040");
  assert.equal(addr.city, "Budaörs");
});

test("fillEmptyListingAddressFromProfile: üres megtekintési cím → profil", () => {
  const form = { telepules: "ValamiHA", megye: "", megtekintesi_cim: "", iranyitoszam: "" };
  fillEmptyListingAddressFromProfile(form, {
    street: "Petőfi u. 9.",
    postalCode: "9021",
    city: "Győr",
  });
  assert.equal(form.megtekintesi_cim, "Petőfi u. 9.");
  assert.equal(form.iranyitoszam, "9021");
  assert.equal(form.telepules, "Győr");
  assert.equal(form.megye, "Győr-Moson-Sopron");
});

test("fillEmptyListingAddressFromProfile: meglévő utca → nem írja felül", () => {
  const form = {
    megtekintesi_cim: "Már megvan 2.",
    telepules: "Szeged",
    iranyitoszam: "6720",
  };
  fillEmptyListingAddressFromProfile(form, {
    street: "Másik utca",
    postalCode: "1117",
    city: "Budapest",
  });
  assert.equal(form.megtekintesi_cim, "Már megvan 2.");
  assert.equal(form.telepules, "Szeged");
});
