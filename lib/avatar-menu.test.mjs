import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

test("avatar kattintás a Fiókom oldalra visz, nincs lenyíló menü", () => {
  const js = readFileSync(join(PUBLIC, "js/site-avatar-menu.js"), "utf8");
  assert.match(js, /\/beallitasok\.html/);
  assert.doesNotMatch(js, /openMenu/);
  assert.doesNotMatch(js, /fiokMenuInnerHtml/);
  assert.doesNotMatch(js, /site-avatar-dropdown--fiok/);
});

test("beallitasok Fiókom menü: teljes fiókmenü a bal oldalon", () => {
  const html = readFileSync(join(PUBLIC, "beallitasok.html"), "utf8");
  const side = html.slice(html.indexOf('aria-label="Fiók menü"'), html.indexOf("mm-side-logout"));
  assert.doesNotMatch(side, /Profilkép/);
  assert.match(side, /Autóimport/);
  assert.match(side, /Nyomtatások/);
  assert.match(side, /Értékelések/);
  assert.match(side, /Autó hozzáadása/);
  assert.match(side, /Teherautó hozzáadása/);
  assert.match(side, /Teherautó 3,5-ig/);
  assert.match(side, /Kiemelések/);
  assert.match(side, /Parkoló/);
  assert.match(side, /Saját hirdetések/);
  assert.match(side, /Mentett kereséseim/);
  assert.match(side, /Üzenetek/);
  assert.match(side, /Megjelenés/);
  assert.match(side, /Beállítások/);
  assert.match(side, /mm-nav/);
  assert.doesNotMatch(side, /Autó hirdetés/);
  assert.doesNotMatch(side, /category-picker/);
});

test("avatar menü CSS megvan", () => {
  const css = readFileSync(join(PUBLIC, "css/site-app.css"), "utf8");
  assert.match(css, /\.site-avatar-item--plain/);
  assert.match(css, /\.mm-nav-plain/);
});
