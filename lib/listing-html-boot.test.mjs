import assert from "node:assert/strict";
import test from "node:test";
import { injectListingBootIntoHtml, listingBootJson } from "./listing-html-boot.mjs";

test("listingBootJson escapes script breakers", () => {
  const json = listingBootJson({ detail: { title: "A <b>x</b>" } });
  assert.ok(!json.includes("<b>"));
  assert.ok(json.includes("\\u003c"));
});

test("injectListingBootIntoHtml paints title and boot marker", () => {
  const html = `<!doctype html><html><head><title>Hirdetés — Bymy</title></head>
<body><main id="hd-root"><p id="hd-boot">Hirdetés betöltése…</p></main>
<!--BYMY_LISTING_BOOT-->
</body></html>`;
  const listing = {
    id: 42,
    fo_kep: "https://example.com/a.jpg",
    detail: {
      title: "Teszt Autó",
      price: "1 000 000 Ft",
      images: ["https://example.com/a.jpg"],
    },
  };
  const out = injectListingBootIntoHtml(html, listing);
  assert.match(out, /<title>Teszt Autó — Bymy<\/title>/);
  assert.match(out, /id="bymy-listing-boot"/);
  assert.match(out, /__BYMY_LISTING_BOOT__/);
  assert.match(out, /Teszt Autó/);
  assert.match(out, /1 000 000 Ft/);
  assert.ok(!out.includes("<!--BYMY_LISTING_BOOT-->") || out.indexOf("bymy-listing-boot") > 0);
});
