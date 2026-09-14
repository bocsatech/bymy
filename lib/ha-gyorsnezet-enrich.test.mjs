import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  extractFelszereltsegFromHtml,
  enrichPageFromGyorsnezetHtml,
} from "./ha-gyorsnezet-enrich.mjs";
import { buildFormFromPage } from "./ha-import-save.mjs";

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures/ha-admin-gyorsnezet-full.html"),
  "utf8"
);

test("extractFelszereltsegFromHtml: szekciók", () => {
  const items = extractFelszereltsegFromHtml(fixture);
  assert.ok(items.includes("fedélzeti komputer"));
  assert.ok(items.includes("tolatókamera"));
  assert.ok(items.includes("Apple CarPlay"));
  assert.ok(items.includes("nem dohányzó"));
});

test("enrichPageFromGyorsnezetHtml + buildFormFromPage: műszaki mezők", () => {
  const enriched = enrichPageFromGyorsnezetHtml(
    { listingId: "24112233", visibleTitle: "TOYOTA RAV4 2.5 Hybrid" },
    fixture
  );
  const form = buildFormFromPage({
    ...enriched,
    brand: "TOYOTA",
    model: "RAV4",
  });
  assert.equal(form.vetelar, "8599000");
  assert.match(form.vetelar_eur || "", /23630/);
  assert.equal(form.gyartasi_ev, "2018");
  assert.equal(form.gyartasi_honap, "8");
  assert.equal(form.km, "94000");
  assert.equal(form.allapot, "Kitűnő");
  assert.match(form.kivitel || "", /terepjáró/i);
  assert.equal(form.szemelyek, "5");
  assert.equal(form.ajtok, "5");
  assert.equal(form.sajat_tomeg, "1835");
  assert.equal(form.ossztomeg, "2420");
  assert.equal(form.csomagtarto, "555");
  assert.match(form.klima || "", /kétzónás/i);
  assert.match(form.uzemanyag || "", /Benzin/i);
  assert.equal(form.hengerurtartalom, "2494");
  assert.equal(form.teljesitmeny_kw, "114");
  assert.equal(form.teljesitmeny_le, "155");
  assert.match(form.sebessegvalto || "", /automata/i);
  assert.match(form.okmany_jelleg || "", /magyar okmányokkal/i);
  assert.equal(form.nyari_gumi_szelesseg, "225");
  assert.equal(form.nyari_gumi_magassag, "60");
  assert.equal(form.nyari_gumi_atmero, "18");
  assert.ok(Array.isArray(form.felszereltseg));
  assert.ok(form.felszereltseg.includes("tempomat"));
});
