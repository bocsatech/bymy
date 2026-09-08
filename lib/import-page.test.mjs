import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

test("ad-form partial: összes fő mezőcsoport", () => {
  const partial = readFileSync(join(PUBLIC, "partials", "ad-form.html"), "utf8");
  assert.ok(partial.includes("Gyártási év"));
  assert.ok(partial.includes("Km. óra állás"));
  assert.ok(partial.includes("Hitel"));
  assert.ok(partial.includes("Egyéb információk"));
  assert.ok(partial.includes("Beszélt nyelvek"));
  assert.ok(partial.includes("egyeb-info-sections"));
});

test("import.html: Autóimport átirányítás", () => {
  const html = readFileSync(join(PUBLIC, "import.html"), "utf8");
  assert.ok(html.includes("beallitasok.html"));
  assert.ok(html.includes("szekcio"));
  assert.ok(html.includes("import"));
  assert.doesNotMatch(html, /theme-automax/);
});

test("hirdetesfeladas.html: beépített űrlap", () => {
  const html = readFileSync(join(PUBLIC, "hirdetesfeladas.html"), "utf8");
  assert.ok(html.includes('id="gyartasi_ev"'));
  assert.ok(!html.includes("<!-- AD_FORM -->"));
});

test("index.html: hub feed kezdőlap", () => {
  const html = readFileSync(join(PUBLIC, "index.html"), "utf8");
  assert.ok(html.includes('data-site-page="hub"') || html.includes("hub-page--feed"));
  assert.ok(html.includes("hf-rail") || html.includes("hub-fav-rail"));
  assert.ok(html.includes("ajanlasok.html"));
  assert.doesNotMatch(html, /home-quick-filters/);
  assert.doesNotMatch(html, /home-valuation-init\.js/);
  assert.doesNotMatch(html, /partner-recommendations-init\.js/);
  assert.match(html, /class="[^"]*site-app[^"]*"/);
  assert.match(html, /site-app\.css/);
});

test("partners.html: partner admin oldal", () => {
  const html = readFileSync(join(PUBLIC, "partners.html"), "utf8");
  assert.ok(html.includes('data-site-page="partners"'));
  assert.ok(html.includes("partner-form"));
  assert.ok(html.includes("partners-app.js"));
});

test("listings.html: hirdetések oldal", () => {
  const html = readFileSync(join(PUBLIC, "listings.html"), "utf8");
  assert.ok(html.includes('data-site-page="listings"'));
  assert.ok(html.includes("listings-empty") || html.includes("listings-app"));
  assert.match(html, /class="[^"]*site-app[^"]*"/);
  assert.match(html, /site-app\.css/);
  assert.doesNotMatch(html, /theme-automax/);
});

test("hirdetesfeladas.html: egységes fejléc és wizard", () => {
  const html = readFileSync(join(PUBLIC, "hirdetesfeladas.html"), "utf8");
  assert.match(html, /class="[^"]*site-app[^"]*"/);
  assert.match(html, /site-app-wizard-steps/);
  assert.doesNotMatch(html, /theme-automax/);
  assert.doesNotMatch(html, /data-site-side=/);
  assert.doesNotMatch(html, />Videók</);
  assert.doesNotMatch(html, /site-content-bar/);
});
