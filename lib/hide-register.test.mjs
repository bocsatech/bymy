import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

test("belépve a Regisztráció gomb elrejthető (CSS [hidden] nem írja felül a display)", () => {
  const css = readFileSync(join(ROOT, "public/css/site-app.css"), "utf8");
  const js = readFileSync(join(ROOT, "public/js/site-auth.js"), "utf8");
  assert.match(css, /\[data-auth-register\]\[hidden\]/);
  assert.match(css, /display:\s*none\s*!important/);
  assert.match(js, /querySelectorAll\("\[data-auth-register\]"\)/);
  assert.match(js, /btn\.hidden\s*=\s*loggedIn/);
});
