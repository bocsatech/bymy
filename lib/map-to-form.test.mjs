import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import test from "node:test";
import assert from "node:assert/strict";
import { parseListingHtml } from "./parse-listing.mjs";
import { mapListingToForm } from "./map-to-form.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = join(__dirname, "..", "..", "hasznaltauto-scraper", "fixtures", "sample-listing.html");

test("mapListingToForm kitölti az alap mezőket", () => {
  const html = readFileSync(fixture, "utf8");
  const parsed = parseListingHtml(html, {
    url: "https://www.hasznaltauto.hu/szemelyauto/volkswagen/golf/test-12345678",
    phone: "+36 30 123 4567",
  });
  const form = mapListingToForm(parsed);

  assert.equal(form.gyartasi_ev, "2018");
  assert.equal(form.km, "125000");
  assert.equal(form.vetelar, "4290000");
  assert.equal(form.hasznaltauto_hirdetes_id, "12345678");
  assert.equal(form.telefon1_korzet, "30");
  assert.equal(form.kivitel, "Kombi");
  assert.equal(form.allapot, "Normál");
  assert.equal(form.okmany_jelleg, "Magyar okmányokkal");
  assert.equal(form.tipus, "Kombi");
  assert.equal(form.hirdetes_cime, "Eladó VOLKSWAGEN GOLF Kombi (2018)");
});
