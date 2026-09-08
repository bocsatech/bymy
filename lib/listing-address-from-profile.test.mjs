import test from "node:test";
import assert from "node:assert/strict";
import {
  fillEmptyListingAddressFromProfile,
  getListingAddressFromProfile,
} from "./listing-address-from-profile.mjs";

test("getListingAddressFromProfile: magán cím — utca nem a szerverprofilból", () => {
  const addr = getListingAddressFromProfile({
    accountType: "private",
    street: "Fő utca 1.",
    postalCode: "1117",
    city: "Budapest",
  });
  assert.equal(addr.street, "");
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

test("fillEmptyListingAddressFromProfile: üres megtekintési cím → magánnál csak irányító/város", () => {
  const form = { telepules: "ValamiHA", megye: "", megtekintesi_cim: "", iranyitoszam: "" };
  fillEmptyListingAddressFromProfile(form, {
    accountType: "private",
    street: "Petőfi u. 9.",
    postalCode: "9021",
    city: "Győr",
  });
  assert.equal(form.megtekintesi_cim, "");
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
