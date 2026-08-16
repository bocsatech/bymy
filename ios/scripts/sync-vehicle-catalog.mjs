#!/usr/bin/env node
/**
 * Frissíti az iOS VehicleCatalog.json-t a webes katalógusból.
 *
 * Preferencia:
 *   1) argumentum: lista.csv vagy vehicle-catalog.json
 *   2) public/data/vehicle-catalog.json
 *   3) data/vehicle-catalog.json
 *   4) ~/Desktop|Downloads/lista.csv → import
 *
 * Használat:
 *   node ios/scripts/sync-vehicle-catalog.mjs
 *   node ios/scripts/sync-vehicle-catalog.mjs "~/Desktop/lista/lista old/lista auto.csv"
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import {
  importVehicleCatalogFromCsv,
  parseCsvText,
  buildVehicleCatalog,
  slimVehicleCatalog,
  resolveDefaultCsvPath,
} from "../../lib/vehicle-catalog.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "Bymy", "VehicleCatalog.json");
const PUBLIC_JSON = join(ROOT, "..", "public", "data", "vehicle-catalog.json");
const DATA_JSON = join(ROOT, "..", "data", "vehicle-catalog.json");

function toIos(catalog) {
  const slim = slimVehicleCatalog(catalog);
  return {
    source: slim.source ?? "bymy",
    imported_at: slim.imported_at,
    count_brands: slim.count_brands,
    count_models: slim.count_models,
    gyartmanyok: slim.gyartmanyok,
    modellek: slim.modellek,
  };
}

function loadFromJson(path) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!raw?.modellek || !Object.keys(raw.modellek).length) {
    throw new Error(`Üres vagy hibás katalógus: ${path}`);
  }
  return toIos(raw);
}

function loadFromCsv(path) {
  const text = readFileSync(path, "utf8");
  const rows = parseCsvText(text);
  return toIos(buildVehicleCatalog(rows, path));
}

function main() {
  const arg = process.argv[2] ? resolve(process.argv[2].replace(/^~/, process.env.HOME ?? "")) : null;
  let catalog;

  if (arg) {
    if (arg.endsWith(".json")) catalog = loadFromJson(arg);
    else catalog = loadFromCsv(arg);
  } else if (existsSync(PUBLIC_JSON)) {
    catalog = loadFromJson(PUBLIC_JSON);
  } else if (existsSync(DATA_JSON)) {
    catalog = loadFromJson(DATA_JSON);
  } else {
    const csv = resolveDefaultCsvPath();
    if (!csv) {
      console.error("Nincs járműkatalógus / lista.csv.");
      console.error('Használat: node ios/scripts/sync-vehicle-catalog.mjs "~/Desktop/lista/lista old/lista auto.csv"');
      process.exit(1);
    }
    catalog = toIos(importVehicleCatalogFromCsv(csv));
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(catalog)}\n`);
  console.log(`OK → ${OUT}`);
  console.log(`  Márkák: ${catalog.count_brands}, modellek: ${catalog.count_models}`);
  console.log(`  Forrás: ${catalog.source}`);
}

main();
