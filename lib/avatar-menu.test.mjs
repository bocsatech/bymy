import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

test("avatar kattintás a Fiók menü oldalra visz, nincs lenyíló menü", () => {
  const js = readFileSync(join(PUBLIC, "js/site-avatar-menu.js"), "utf8");
  assert.match(js, /\/fiok\.html/);
  assert.doesNotMatch(js, /openMenu/);
  assert.doesNotMatch(js, /fiokMenuInnerHtml/);
  assert.doesNotMatch(js, /site-avatar-dropdown--fiok/);
});

test("kezdőlap profilkép a Fiók menü oldalra mutat", () => {
  const html = readFileSync(join(PUBLIC, "index.html"), "utf8");
  assert.match(html, /class="mw-app-avatar"[^>]*href="\/fiok\.html"/);
});

test("fiok.html: a weboldal Fiókom menüjét tölti be", () => {
  const html = readFileSync(join(PUBLIC, "fiok.html"), "utf8");
  assert.match(html, /aria-label="Fiók menü"/);
  assert.match(html, /Autóimport/);
  assert.match(html, /Nyomtatások/);
  assert.match(html, /Értékelések/);
  assert.match(html, /Kiemelések/);
  assert.match(html, /Parkoló/);
  assert.match(html, /Saját hirdetések/);
  assert.match(html, /Mentett kereséseim/);
  assert.match(html, /Üzenetek/);
  assert.match(html, /Megjelenés/);
  assert.match(html, /Beállítások/);
  assert.match(html, /Kijelentkezés/);
  assert.match(html, /\/beallitasok\.html\?szekcio=/);
  assert.doesNotMatch(html, /Kedvencek/);
});

test("beallitasok Fiókom menü: teljes fiókmenü a bal oldalon", () => {
  const html = readFileSync(join(PUBLIC, "beallitasok.html"), "utf8");
  const side = html.slice(html.indexOf('aria-label="Fiók menü"'), html.indexOf("mm-side-logout"));
  assert.doesNotMatch(side, /Profilkép/);
  assert.match(side, /Cégadatok/);
  assert.match(side, /Autóimport/);
  assert.match(side, /Nyomtatások/);
  assert.match(side, /Értékelések/);
  assert.match(side, /Kiemelések/);
  assert.match(side, /Parkoló/);
  assert.match(side, /Saját hirdetések/);
  assert.match(side, /Mentett kereséseim/);
  assert.match(side, /Üzenetek/);
  assert.match(side, /Megjelenés/);
  assert.match(side, /Beállítások/);
  assert.match(side, /mm-nav/);
  assert.doesNotMatch(side, /category-picker/);
});

test("avatar menü CSS megvan", () => {
  const css = readFileSync(join(PUBLIC, "css/site-app.css"), "utf8");
  assert.match(css, /\.site-avatar-item--plain/);
  assert.match(css, /\.mm-nav-plain/);
});
