#!/usr/bin/env node
import { importVehicleCatalogFromCsv, resolveDefaultCsvPath, getVehicleCatalogPath } from "../lib/vehicle-catalog.mjs";

const csvArgs = process.argv.slice(2);
const csvPaths = csvArgs.length
  ? csvArgs.map((arg) => arg.replace(/^~/, process.env.HOME ?? ""))
  : [resolveDefaultCsvPath()];

if (csvPaths.some((path) => !path)) {
  console.error("Használat: npm run import:catalog -- ~/Desktop/lista.csv ~/Desktop/lista-old.csv");
  console.error("Adj meg egy vagy több CSV-forrást.");
  process.exit(1);
}

try {
  const catalog = importVehicleCatalogFromCsv(csvPaths);
  console.log(`✓ Importálva: ${csvPaths.join(", ")}`);
  console.log(`  Cél: ${getVehicleCatalogPath()}`);
  console.log(`  Gyártmányok: ${catalog.gyartmanyok.length}`);
  console.log(
    `  Modellek összesen: ${Object.values(catalog.modellek).reduce((n, arr) => n + arr.length, 0)}`
  );
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exit(1);
}
