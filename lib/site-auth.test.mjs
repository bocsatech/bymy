import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

test("index.html: fejléc jobb oldali gombok", () => {
  const html = readFileSync(join(PUBLIC, "index.html"), "utf8");
  assert.ok(html.includes("site-header-actions"));
  assert.ok(html.includes('data-auth-guard'));
  assert.ok(html.includes('data-auth-login'));
  assert.ok(html.includes(">Hirdetésfeladás</a>"));
  assert.ok(html.includes(">Belépés</a>"));
  assert.ok(html.includes('data-auth-register'));
  assert.ok(html.includes("/regisztracio.html"));
  assert.doesNotMatch(html, /home-nav-link[^>]*>Hirdetésfeladás/);
});

test("regisztracio.html: regisztrációs űrlap", () => {
  const html = readFileSync(join(PUBLIC, "regisztracio.html"), "utf8");
  assert.ok(html.includes('id="register-form"'));
  assert.ok(html.includes('name="password_confirm"'));
});

test("belepes.html: belépő űrlap", () => {
  const html = readFileSync(join(PUBLIC, "belepes.html"), "utf8");
  assert.ok(html.includes('id="login-form"'));
  assert.ok(html.includes('name="email"'));
  assert.ok(html.includes('name="password"'));
});

test("hirdetesfeladas.html: auth védelem", () => {
  const html = readFileSync(join(PUBLIC, "hirdetesfeladas.html"), "utf8");
  assert.ok(html.includes("requireAuthForPage"));
});
