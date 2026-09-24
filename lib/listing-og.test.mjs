import test from "node:test";
import assert from "node:assert/strict";
import {
  buildListingOpenGraph,
  injectOpenGraphIntoHtml,
  isSocialShareCrawler,
} from "./listing-og.mjs";

test("isSocialShareCrawler detects Facebook", () => {
  assert.equal(
    isSocialShareCrawler({ headers: { "user-agent": "facebookexternalhit/1.1" } }),
    true
  );
  assert.equal(isSocialShareCrawler({ headers: { "user-agent": "Mozilla/5.0" } }), false);
});

test("buildListingOpenGraph builds title image url", () => {
  const og = buildListingOpenGraph({
    baseUrl: "https://bymy.hu",
    listing: {
      id: 42,
      fo_kep: "https://img.hasznaltautocdn.com/118x88/1/2.jpg",
      detail: {
        title: "BMW 320d",
        price: "4 500 000 Ft",
        year: "2018",
        km: "120 000 km",
        description: "Szép állapot.",
        addressLines: ["Budapest"],
      },
    },
  });
  assert.equal(og.url, "https://bymy.hu/hirdetes.html?id=42");
  assert.match(og.title, /BMW 320d/);
  assert.match(og.image, /hasznaltautocdn|2048x1536|img/);
  assert.ok(og.description.length > 0);
});

test("injectOpenGraphIntoHtml replaces title", () => {
  const html = `<!doctype html><html><head><title>Old</title></head><body></body></html>`;
  const out = injectOpenGraphIntoHtml(html, {
    title: "Új cím | Bymy",
    description: "Leírás",
    url: "https://bymy.hu/hirdetes.html?id=1",
    image: "https://img.bymy.hu/x.jpg",
    siteName: "Bymy",
  });
  assert.match(out, /<title>Új cím \| Bymy<\/title>/);
  assert.match(out, /property="og:image"/);
  assert.doesNotMatch(out, /<title>Old<\/title>/);
});
