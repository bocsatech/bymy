import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

const PAGES = [
  "index.html",
  "fugveny.html",
  "listings.html",
  "import.html",
  "hirdetesfeladas.html",
  "belepes.html",
  "regisztracio.html",
];

test("avatar menü minden oldalon magyar tételekkel", () => {
  for (const page of PAGES) {
    const html = readFileSync(join(PUBLIC, page), "utf8");
    assert.ok(html.includes("data-avatar-menu"), `${page}: data-avatar-menu`);
    assert.ok(html.includes("Áttekintés"), `${page}: Áttekintés`);
    assert.ok(html.includes("Mentett kereséseim"), `${page}: Mentett kereséseim`);
    assert.ok(html.includes("Kedvencek"), `${page}: Kedvencek`);
    assert.ok(html.includes("Hirdetéseim"), `${page}: Hirdetéseim`);
    assert.ok(html.includes("Direkt eladás"), `${page}: Direkt eladás`);
    assert.ok(html.includes("Járműveim"), `${page}: Járműveim`);
    assert.ok(html.includes("Beállítások"), `${page}: Beállítások`);
    assert.ok(html.includes("Kommunikáció"), `${page}: Kommunikáció`);
    assert.ok(html.includes("Profilkép feltöltése"), `${page}: Profilkép`);
    assert.ok(html.includes("Kijelentkezés"), `${page}: Kijelentkezés`);
    assert.ok(html.includes("Bejelentkezve mint"), `${page}: Bejelentkezve mint`);
  }
});

test("avatar menü JS és CSS megvan", () => {
  const js = readFileSync(join(PUBLIC, "js/site-avatar-menu.js"), "utf8");
  const css = readFileSync(join(PUBLIC, "css/site-app.css"), "utf8");
  const auth = readFileSync(join(PUBLIC, "js/site-auth.js"), "utf8");
  assert.match(js, /initAvatarMenu/);
  assert.match(js, /setAvatarPhoto/);
  assert.match(css, /\.site-avatar-dropdown/);
  assert.match(auth, /site-avatar-menu\.js/);
});
