#!/usr/bin/env node
/** Beépíti az ad-form partialt az import.html és hirdetesfeladas.html fájlokba. */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(ROOT, "public");
const PARTIAL = join(PUBLIC, "partials", "ad-form.html");
const PLACEHOLDER = "<!-- AD_FORM -->";

if (!existsSync(PARTIAL)) {
  console.error("Hiányzik:", PARTIAL);
  process.exit(1);
}

const partial = readFileSync(PARTIAL, "utf8");

for (const file of ["import.html", "hirdetesfeladas.html"]) {
  const path = join(PUBLIC, file);
  let html = readFileSync(path, "utf8");
  if (!html.includes(PLACEHOLDER)) {
    console.warn(`${file}: nincs ${PLACEHOLDER} — kihagyva`);
    continue;
  }
  html = html.replace(PLACEHOLDER, partial);
  writeFileSync(path, html);
  console.log(`✓ ${file} — űrlap beépítve (${partial.length} bájt)`);
}
