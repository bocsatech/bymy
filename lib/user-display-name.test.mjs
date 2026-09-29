import assert from "node:assert/strict";
import test from "node:test";
import { resolveStoredDisplayName, resolveUserDisplayName } from "./user-display-name.mjs";

test("resolveUserDisplayName: céges fiók → cégnév, nem e-mail local-part", () => {
  assert.equal(
    resolveUserDisplayName({
      email: "bymy@example.com",
      displayName: "Bymy",
      profile: { accountType: "business", company: "Fehérvár Autó Kft." },
    }),
    "Fehérvár Autó Kft."
  );
});

test("resolveUserDisplayName: céges → companyListingName ha nincs company", () => {
  assert.equal(
    resolveUserDisplayName({
      email: "bymy@example.com",
      displayName: "Bymy",
      profile: { accountType: "business", companyListingName: "Fehérvár Autó" },
    }),
    "Fehérvár Autó"
  );
});

test("resolveUserDisplayName: magán → személynév", () => {
  assert.equal(
    resolveUserDisplayName({
      email: "anna@example.com",
      displayName: "Anna",
      profile: { accountType: "private", firstName: "Anna", lastName: "Kovács" },
    }),
    "Anna Kovács"
  );
});

test("resolveStoredDisplayName: business company felülírja a régi Bymy-t", () => {
  assert.equal(
    resolveStoredDisplayName(
      { accountType: "business", company: "Új Cég Kft.", firstName: "", lastName: "" },
      "Bymy"
    ),
    "Új Cég Kft."
  );
});
