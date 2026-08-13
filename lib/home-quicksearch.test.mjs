import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

test("index.html: gyorskereső 3 sora a megadott mezőkkel", () => {
  const html = readFileSync(join(PUBLIC, "index.html"), "utf8");
  const formMatch = html.match(/id="home-qs-form"[\s\S]*?<\/form>/);
  assert.ok(formMatch, "van home-qs-form");
  const form = formMatch[0];

  const row1 = form.indexOf("qs-gyartmany");
  const tipus = form.indexOf("qs-tipus");
  const uzemanyag = form.indexOf("qs-uzemanyag");
  const arTol = form.indexOf('id="qs-ar-tol"');
  const kereses = form.indexOf(">Keresés</button>");
  const reszletes = form.indexOf("qs-reszletes");
  const vissza = form.indexOf('type="reset"');

  assert.ok(row1 > 0 && tipus > row1, "1. sor: Márka majd Típus");
  assert.ok(uzemanyag > tipus, "2. sor: Üzemanyag a Típus után");
  assert.ok(arTol > uzemanyag, "Vételár a 2. sorban");
  assert.match(
    form.slice(Math.max(0, arTol - 40), arTol + 40),
    /<select[^>]*id="qs-ar-tol"/,
    "Vételár legördülő (500 000 Ft ugrás)"
  );
  assert.ok(kereses > uzemanyag, "3. sor: Keresés a mezők után");
  assert.ok(reszletes > kereses, "Részletes keresés a Keresés után");
  assert.ok(vissza > reszletes, "Visszaállítás a Részletes után");
  assert.doesNotMatch(
    form.slice(row1, tipus),
    /qs-uzemanyag/,
    "1. sorban nincs Üzemanyag (az a 2. sor)"
  );
});
