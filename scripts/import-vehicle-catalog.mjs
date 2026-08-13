#!/usr/bin/env node
import { importVehicleCatalogFromCsv, resolveDefaultCsvPath, getVehicleCatalogPath } from "../lib/vehicle-catalog.mjs";

const csvArg = process.argv[2];
const csvPath = csvArg ? csvArg.replace(/^~/, process.env.HOME ?? "") : resolveDefaultCsvPath();

if (!csvPath) {
  console.error("Használat: npm run import:catalog -- ~/Desktop/lista.csv");
  console.error("Vagy helyezd a lista.csv fájlt az Asztalra.");
  process.exit(1);
}

try {
  const catalog = importVehicleCatalogFromCsv(csvPath);
  console.log(`✓ Importálva: ${csvPath}`);
  console.log(`  Cél: ${getVehicleCatalogPath()}`);
  console.log(`  Gyártmányok: ${catalog.gyartmanyok.length}`);
  console.log(
    `  Modellek összesen: ${Object.values(catalog.modellek).reduce((n, arr) => n + arr.length, 0)}`
  );
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exit(1);
}
