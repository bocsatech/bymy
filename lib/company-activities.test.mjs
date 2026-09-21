import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCompanyActivities, companyActivitiesLabels } from "./company-activities.mjs";

test("normalizeCompanyActivities — több választás és címkék", () => {
  assert.deepEqual(normalizeCompanyActivities(["auto", "ingatlan"]), ["auto", "ingatlan"]);
  assert.deepEqual(normalizeCompanyActivities('["teherauto","auto"]'), ["auto", "teherauto"]);
  assert.deepEqual(companyActivitiesLabels(["auto", "teherauto"]), ["Autó", "Teherautó"]);
  assert.deepEqual(normalizeCompanyActivities(null, { companyActivities: ["ingatlan"] }), ["ingatlan"]);
});
