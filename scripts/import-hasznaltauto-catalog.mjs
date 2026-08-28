#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const DatabaseSync = require("node:sqlite").DatabaseSync;
const BASE_URL = "https://admin.hasznaltauto.hu";
const OUTPUT = resolve(process.env.HA_CATALOG_DB || "data/hasznaltauto-szemelyauto.sqlite");
const delayMs = Number(process.env.HA_CATALOG_DELAY_MS || 120);
const storageState = process.argv[2];

if (!storageState) {
  console.error("Használat: node scripts/import-hasznaltauto-catalog.mjs /útvonal/storage-state.json");
  console.error("A storage-state.json bejelentkezett Használtautó munkamenetet tartalmazzon.");
  process.exit(1);
}

function parseOptions(html, selectName) {
  const selectMatch = String(html).match(new RegExp(`<select\\b[^>]*\\bname=["']${selectName}["'][^>]*>([\\s\\S]*?)</select>`, "i"));
  if (!selectMatch) return [];
  return [...selectMatch[1].matchAll(/<option\b[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi)]
    .map((match) => ({
      value: String(match[1]).trim(),
      label: String(match[2]).replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
    }))
    .filter((item) => item.value && item.value !== "0" && item.label && item.label !== "Válasszon!");
}

function parseYearRange(label) {
  const match = String(label).match(/(19|20)\d{2}\.?(?:\d{1,2}\.)?\s*[–-]\s*((?:19|20)\d{2})/);
  return { yearFrom: match ? Number(match[0].match(/(19|20)\d{2}/)?.[0]) : null, yearTo: match ? Number(match[2]) : null };
}

function parseDoors(label) {
  const match = String(label).match(/(\d+)\s*ajtós/i);
  return match ? Number(match[1]) : null;
}

function cleanFuel(value) {
  return String(value || "").trim();
}

function initDb(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS catalog_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      source_id TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS models (
      id INTEGER PRIMARY KEY,
      brand_id INTEGER NOT NULL REFERENCES brands(id),
      name TEXT NOT NULL,
      source_id TEXT NOT NULL,
      UNIQUE(brand_id, source_id)
    );
    CREATE TABLE IF NOT EXISTS vehicle_types (
      id INTEGER PRIMARY KEY,
      brand_id INTEGER NOT NULL REFERENCES brands(id),
      model_id INTEGER NOT NULL REFERENCES models(id),
      name TEXT NOT NULL,
      year_from INTEGER,
      year_to INTEGER,
      doors INTEGER,
      fuel TEXT,
      fuel_code TEXT,
      body_code TEXT,
      engine_cc INTEGER,
      power_kw REAL,
      power_hp REAL,
      source_id TEXT NOT NULL UNIQUE,
      raw_json TEXT NOT NULL,
      UNIQUE(model_id, name, year_from, year_to)
    );
    CREATE INDEX IF NOT EXISTS idx_models_brand ON models(brand_id);
    CREATE INDEX IF NOT EXISTS idx_types_model_year ON vehicle_types(model_id, year_from, year_to);
  `);
}

async function main() {
  mkdirSync(dirname(OUTPUT), { recursive: true });
  const db = new DatabaseSync(OUTPUT);
  initDb(db);
  db.prepare("DELETE FROM vehicle_types").run();
  db.prepare("DELETE FROM models").run();
  db.prepare("DELETE FROM brands").run();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/hirdetesfeladas/szemelyauto`, { waitUntil: "domcontentloaded" });

  const requestHtml = (path) => page.evaluate(async (url) => {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    return response.text();
  }, path);

  const brands = await page.locator("#gyartmany option").evaluateAll((options) =>
    options.map((option) => ({ value: option.value, label: option.textContent.trim() }))
      .filter((item) => item.value && item.value !== "0" && item.label && item.label !== "Válasszon!")
  );
  if (!brands.length) throw new Error("Nem található gyártmánylista. A storage-state lejárt vagy a Cloudflare blokkolta a munkamenetet.");

  const insertBrand = db.prepare("INSERT INTO brands (id, name, source_id) VALUES (?, ?, ?)");
  const insertModel = db.prepare("INSERT INTO models (id, brand_id, name, source_id) VALUES (?, ?, ?, ?)");
  const insertType = db.prepare(`INSERT INTO vehicle_types
    (id, brand_id, model_id, name, year_from, year_to, doors, fuel, fuel_code, body_code, engine_cc, power_kw, power_hp, source_id, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  let modelCount = 0;
  let typeCount = 0;
  for (const brand of brands) {
    const brandId = Number(brand.value);
    insertBrand.run(brandId, brand.label, brand.value);
    const models = parseOptions(await requestHtml(`/ajax/euroTax?mode=modell&id=${encodeURIComponent(brand.value)}&selectedid=0&kategoria=szemelyauto`), "modell");
    for (const model of models) {
      const modelId = Number(model.value);
      insertModel.run(modelId, brandId, model.label, model.value);
      modelCount += 1;
      const types = parseOptions(await requestHtml(`/ajax/euroTax?mode=tipus&id=${encodeURIComponent(model.value)}&selectedid=0&gyartmany=${encodeURIComponent(brand.value)}&ev=0&honap=0&hengerurt=false&kategoria=szemelyauto`), "tipus");
      for (const type of types) {
        const range = parseYearRange(type.label);
        const infoPath = `/ajax/euroTax?mode=info&gyartmany=${encodeURIComponent(brand.value)}&modell=${encodeURIComponent(model.value)}&kategoria=szemelyauto&ev=0&ho=0&id=${encodeURIComponent(type.value)}`;
        let info = {};
        try {
          const raw = await requestHtml(infoPath);
          info = JSON.parse(raw);
        } catch {
          info = {};
        }
        const row = info.row || info;
        insertType.run(
          Number(type.value), brandId, modelId, type.label,
          range.yearFrom, range.yearTo, Number(info.ajtokszama || row.ajtokszama || parseDoors(type.label)) || null,
          cleanFuel(info.uzemanyag || row.uzemanyag_label), cleanFuel(row.uzemanyag), cleanFuel(info.kivitel || row.kivitel),
          Number(info.hengerurtartalom || row.hengerurtartalom) || null,
          Number(info.teljesitmeny_kw || row.teljesitmeny_kw) || null,
          Number(info.teljesitmeny_le || row.teljesitmeny_le) || null,
          type.value, JSON.stringify(info)
        );
        typeCount += 1;
        if (delayMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
      }
    }
    console.log(`${brand.label}: ${models.length} modell`);
  }

  const meta = db.prepare("INSERT OR REPLACE INTO catalog_meta (key, value) VALUES (?, ?)");
  meta.run("source", BASE_URL);
  meta.run("category", "szemelyauto");
  meta.run("imported_at", new Date().toISOString());
  meta.run("brand_count", String(brands.length));
  meta.run("model_count", String(modelCount));
  meta.run("type_count", String(typeCount));
  db.close();
  await browser.close();
  console.log(`Kész: ${OUTPUT}`);
  console.log(`Gyártmány: ${brands.length}, modell: ${modelCount}, típus: ${typeCount}`);
}

main().catch((error) => {
  console.error(`Import sikertelen: ${error.message}`);
  process.exitCode = 1;
});
