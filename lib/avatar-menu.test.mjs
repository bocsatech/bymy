import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

test("avatar menü JS: leírások és Ártábla nélkül", () => {
  const js = readFileSync(join(PUBLIC, "js/site-avatar-menu.js"), "utf8");
  assert.match(js, /Autóimport/);
  assert.match(js, /hasznaltauto\.hu/);
  assert.match(js, /Nyomtatások/);
  assert.match(js, /adásvételi/);
  assert.match(js, /Értékelések/);
  assert.match(js, /kereskedésről/);
  assert.match(js, /Autó hozzáadása/);
  assert.match(js, /Teherautó hozzáadása/);
  assert.match(js, /Teherautó 3,5-ig/);
  assert.match(js, /Kiemelések/);
  assert.match(js, /site-avatar-item--plain/);
  assert.match(js, /Parkoló/);
  assert.match(js, /Saját hirdetések/);
  assert.match(js, /Üzenetek/);
  assert.match(js, /Beállítások/);
  assert.doesNotMatch(js, /Mentett kereséseim/);
  assert.doesNotMatch(js, /Ártábla nyomtatása/);
  assert.doesNotMatch(js, /szekcio=artabla/);
  assert.doesNotMatch(js, /szekcio=kiemelesek/);
});

test("beallitasok Fiókom menü: csak a 7 tétel", () => {
  const html = readFileSync(join(PUBLIC, "beallitasok.html"), "utf8");
  const nav = html.slice(html.indexOf('class="mm-nav"'), html.indexOf("mm-side-logout"));
  assert.match(nav, /Autóimport/);
  assert.match(nav, /Nyomtatások/);
  assert.match(nav, /Értékelések/);
  assert.match(nav, /Autó hozzáadása/);
  assert.match(nav, /Teherautó hozzáadása/);
  assert.match(nav, /Kiemelések/);
  assert.match(nav, /Parkoló/);
  assert.doesNotMatch(nav, /Áttekintés/);
  assert.doesNotMatch(nav, /Mentett kereséseim/);
  assert.doesNotMatch(nav, /Saját hirdetések/);
  assert.doesNotMatch(nav, /Megjelenés/);
  assert.doesNotMatch(nav, /Beállítások/);
  assert.doesNotMatch(nav, /Ártábla/);
});

test("avatar menü CSS megvan", () => {
  const css = readFileSync(join(PUBLIC, "css/site-app.css"), "utf8");
  assert.match(css, /\.site-avatar-item--plain/);
  assert.match(css, /\.mm-nav-plain/);
});
