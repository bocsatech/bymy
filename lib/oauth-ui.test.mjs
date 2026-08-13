import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

test("belepes/regisztracio: OAuth gombok", () => {
  for (const file of ["belepes.html", "regisztracio.html"]) {
    const html = readFileSync(join(PUBLIC, file), "utf8");
    assert.match(html, /data-oauth-buttons/);
    assert.match(html, /data-oauth-provider="google"/);
    assert.match(html, /data-oauth-provider="apple"/);
    assert.match(html, /data-oauth-provider="facebook"/);
    assert.match(html, /vagy emaillel/);
  }
  const js = readFileSync(join(PUBLIC, "js", "site-auth.js"), "utf8");
  assert.match(js, /initOAuthButtons/);
  assert.match(js, /\/api\/auth\/oauth\/start\//);
});
