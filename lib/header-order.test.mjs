import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

test("index.html: fejléc sorrend Belépés → Regisztráció → Hirdetésfeladás, ikonok alatta", () => {
  const html = readFileSync(join(PUBLIC, "index.html"), "utf8");
  const actions = html.match(/class="header-actions site-header-actions"[\s\S]*?<\/div>\s*<\/div>\s*<\/header>/);
  assert.ok(actions, "van header-actions blokk");
  const block = actions[0];

  const login = block.indexOf("Belépés");
  const register = block.indexOf("Regisztráció");
  const postAd = block.indexOf("Hirdetésfeladás");
  const tools = block.indexOf('class="site-header-tools"');

  assert.ok(login > 0 && register > login, "Belépés majd Regisztráció");
  assert.ok(postAd > register, "Hirdetésfeladás a Regisztráció után");
  assert.ok(tools > postAd, "ikonok a gombok alatt / után");
  assert.ok(block.includes("site-header-auth-row"));
});
