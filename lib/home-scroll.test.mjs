import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

test("index.html: nincs külön grid viewport scroll", () => {
  const html = readFileSync(join(PUBLIC, "index.html"), "utf8");
  assert.ok(html.includes("home-grid-track"));
  assert.doesNotMatch(html, /home-grid-viewport/);
});

test("index.html: a teljes oldal görget, a hirdetéslistának nincs saját sávja", () => {
  const html = readFileSync(join(PUBLIC, "index.html"), "utf8");
  const css = readFileSync(join(PUBLIC, "css", "home.css"), "utf8");
  assert.ok(html.includes('id="home-scroll-fix"'));
  assert.ok(html.includes("overflow-y: auto !important"));
  assert.match(
    html,
    /body\.home-page \.home-listings-panel,[\s\S]*?overflow: visible !important/
  );
  assert.match(css, /\.home-listings-panel \{[^}]*overflow: visible/);
  assert.doesNotMatch(css, /\.home-listings-panel::-webkit-scrollbar/);
});
