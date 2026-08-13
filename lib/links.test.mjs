import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import test from "node:test";
import assert from "node:assert/strict";
import { extractListingLinksFromHtml, hasListingLinksInHtml } from "./links.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const talalatiFixture = join(
  __dirname,
  "..",
  "..",
  "hasznaltauto-scraper",
  "fixtures",
  "sample-talalatilista-page.html"
);

test("extractListingLinksFromHtml talalatilista oldalról", () => {
  const html = readFileSync(talalatiFixture, "utf8");
  const baseUrl = "https://www.hasznaltauto.hu/talalatilista/TEST";
  const links = extractListingLinksFromHtml(html, baseUrl);

  assert.equal(links.length, 2);
  assert.ok(links[0].includes("11111111"));
  assert.ok(links[1].includes("22222222"));
});

test("hasListingLinksInHtml cf-challenge-platform mellett is true ha van link", () => {
  const html = readFileSync(talalatiFixture, "utf8");
  const withCf = html.replace("</body>", '<script src="cf-challenge-platform"></script></body>');
  const baseUrl = "https://www.hasznaltauto.hu/talalatilista/TEST";
  assert.equal(hasListingLinksInHtml(withCf, baseUrl), true);
});
