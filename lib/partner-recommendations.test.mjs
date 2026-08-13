import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("home-app.js: partner ajánló külön init scriptben", () => {
  const homeApp = readFileSync(join(__dirname, "..", "public", "js", "home-app.js"), "utf8");
  assert.ok(!homeApp.includes("initPartnerRecommendations"));
  const html = readFileSync(join(__dirname, "..", "public", "index.html"), "utf8");
  assert.ok(html.includes("partner-recommendations-init.js"));
});

test("partner-recommendations.js: böngészőben elérhető kategória import", () => {
  const js = readFileSync(
    join(__dirname, "..", "public", "js", "partner-recommendations.js"),
    "utf8"
  );
  assert.ok(js.includes("./partner-categories-data.js"));
  assert.ok(js.includes("home-partner-accordion"));
  assert.ok(js.includes("home-partner-collapse-all"));
  assert.ok(js.includes("bindPartnerAccordion"));
  assert.ok(js.includes("setWidgetExpanded"));
  assert.ok(js.includes("collapseWidget"));
});

test("getPartnerRecommendations: 8000 környékén van találat demo adattal", async () => {
  process.env.AUTOSWEB_DB_PATH = join(__dirname, "..", "data", "autosweb.db");
  const { getPartnerRecommendations, partnerStats } = await import("./partners.mjs");
  const stats = partnerStats();
  if (stats.activePaid === 0) {
    const { seedDemoPartnersIfEmpty } = await import("../scripts/seed-partners.mjs");
    seedDemoPartnersIfEmpty();
  }
  const result = getPartnerRecommendations("8000");
  assert.equal(result.postal_code, "8000");
  assert.equal(result.city, "Székesfehérvár");
  const withPartners = result.categories.filter((c) => c.partners.length > 0);
  assert.ok(withPartners.length > 0, "legalább egy kategóriában legyen partner");
});
