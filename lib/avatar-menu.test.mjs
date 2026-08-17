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
  assert.match(js, /Mentett kereséseim/);
  assert.match(js, /Megjelenés/);
  assert.match(js, /hirdetesfeladas/);
  assert.match(js, /isPostAdPage/);
  assert.doesNotMatch(js, /szekcio=artabla/);
  assert.doesNotMatch(js, /szekcio=kiemelesek/);
});

test("beallitasok Fiókom menü: csak a 3 hirdetéskártya", () => {
  const html = readFileSync(join(PUBLIC, "beallitasok.html"), "utf8");
  const side = html.slice(html.indexOf("mm-side--cats"), html.indexOf("mm-side-logout"));
  assert.match(side, /Autó hirdetés/);
  assert.match(side, /Személyautó és más/);
  assert.match(side, /Leasing hirdetés/);
  assert.match(side, /Bérautó hirdetés/);
  assert.match(side, /Bérelhető lakókocsi hirdetés/);
  assert.match(side, /Teherautó hirdetés/);
  assert.match(side, /Ingatlan hirdetések/);
  assert.doesNotMatch(side, /Autóimport/);
  assert.doesNotMatch(side, /Nyomtatások/);
  assert.doesNotMatch(side, /Parkoló/);
  assert.doesNotMatch(side, /mm-nav/);
});

test("avatar menü CSS megvan", () => {
  const css = readFileSync(join(PUBLIC, "css/site-app.css"), "utf8");
  assert.match(css, /\.site-avatar-item--plain/);
  assert.match(css, /\.mm-nav-plain/);
});
