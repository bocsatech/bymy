import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "fs";
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

test("minden fő oldal: fejléc mint a főoldalon (Belépés → Regisztráció → Hirdetésfeladás + ikonok)", () => {
  for (const page of PAGES) {
    const html = readFileSync(join(PUBLIC, page), "utf8");
    assert.ok(html.includes("site-header-auth-row"), `${page}: auth-row`);
    assert.ok(html.includes('class="site-header-tools"'), `${page}: tools`);
    const login = html.indexOf('data-auth-login');
    const register = html.indexOf('data-auth-register');
    const postAd = html.indexOf('data-auth-guard');
    const tools = html.indexOf('class="site-header-tools"');
    assert.ok(login > 0 && register > login, `${page}: Belépés → Regisztráció`);
    assert.ok(postAd > register, `${page}: Regisztráció → Hirdetésfeladás`);
    assert.ok(tools > postAd, `${page}: ikonok a gombok után`);
  }
});
