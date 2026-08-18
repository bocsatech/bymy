import test from "node:test";
import assert from "node:assert/strict";
import { matchesCatalogTipus, filterListingsBySidebar, emptyFilters } from "../public/js/home-search-filter.js";

const CATALOG_TIPUS = "500 Coupe 1.4 TJet 140 [3 ajtós, 140 LE, 2016.04. – 2016.07.]";

function listing(filter, preview = {}) {
  return { id: preview.id ?? "1", preview: { filter, ...preview } };
}

test("üres választás mindent átenged", () => {
  assert.equal(matchesCatalogTipus(listing({ tipus: "bármi" }), ""), true);
});

test("űrlapon feladott hirdetés pontos egyezése", () => {
  const item = listing({ tipus: "500 Coupe 1.4 TJet 140" });
  assert.equal(matchesCatalogTipus(item, CATALOG_TIPUS), true);
});

test("importált hirdetés rövidebb típusa is egyezik", () => {
  const item = listing({ tipus: "1.4 TJet 140" });
  assert.equal(matchesCatalogTipus(item, CATALOG_TIPUS), true);
});

test("más típus nem egyezik", () => {
  const item = listing({ tipus: "2.0 TDI" }, { title: "Audi A4", specLine: "2.0 TDI" });
  assert.equal(matchesCatalogTipus(item, CATALOG_TIPUS), false);
});

test("ékezet és kis/nagybetű nem számít", () => {
  const item = listing({ tipus: "500 COUPE 1.4 TJET 140" });
  assert.equal(matchesCatalogTipus(item, CATALOG_TIPUS), true);
});

test("cím alapján is talál, ha a típus mező üres", () => {
  const item = listing({}, { title: "Fiat 500 Coupe 1.4 TJet 140 eladó" });
  assert.equal(matchesCatalogTipus(item, CATALOG_TIPUS), true);
});

test("túl rövid hirdetés-típus nem ad álpozitívat", () => {
  const item = listing({ tipus: "d" }, { title: "BMW 320", specLine: "320 d" });
  assert.equal(matchesCatalogTipus(item, CATALOG_TIPUS), false);
});

test("szűrő láncba kötve", () => {
  const items = [
    listing({ gyartmany: "ABARTH", modell: "500", tipus: "500 Coupe 1.4 TJet 140" }),
    listing({ gyartmany: "ABARTH", modell: "500", tipus: "500 1.4" }, { id: "2" }),
  ];

  const filters = { ...emptyFilters(), tipus: "500 Coupe 1.4 TJet 140" };
  const result = filterListingsBySidebar(items, filters);
  assert.equal(result.length, 1);
  assert.equal(result[0].preview.filter.tipus, "500 Coupe 1.4 TJet 140");
});

test("típus szűrő nélkül minden hirdetés megmarad", () => {
  const items = [
    listing({ tipus: "500 Coupe 1.4 TJet 140" }),
    listing({ tipus: "2.0 TDI" }, { id: "2" }),
  ];
  assert.equal(filterListingsBySidebar(items, emptyFilters()).length, 2);
});
