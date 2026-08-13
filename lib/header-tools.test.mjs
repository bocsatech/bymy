import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

test("index.html: fiók ikonok a Hirdetésfeladás mellett", () => {
  const html = readFileSync(join(PUBLIC, "index.html"), "utf8");
  assert.ok(html.includes('class="site-header-tools"'));
  assert.ok(html.includes('aria-label="Értesítések"'));
  assert.ok(html.includes('aria-label="Mentett keresések"'));
  assert.ok(html.includes('aria-label="Kedvencek"'));
  assert.ok(html.includes('aria-label="Üzenetek"'));
  assert.ok(html.includes("data-auth-avatar"));
  assert.ok(html.includes("site-header-auth-row"));
});
