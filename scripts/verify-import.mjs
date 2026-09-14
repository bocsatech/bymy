#!/usr/bin/env node
/** Import + mentés ellenőrzés — hirdetés URL vagy lista URL. */
import { importListings } from "../lib/import-listings.mjs";
import { saveListing } from "../lib/db.mjs";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const url = process.argv[2];
if (!url) {
  console.error("Használat: node scripts/verify-import.mjs <hasznaltauto-url>");
  process.exit(1);
}

process.env.AUTOSWEB_DB_PATH = join(mkdtempSync(join(tmpdir(), "verify-import-")), "test.db");

console.log("Import:", url.slice(0, 80) + "...");

try {
  const result = await importListings(url, {
    limit: 3,
    autoSave: false,
    onProgress: (msg) => console.log(" ", msg),
  });

  console.log(`\nKész: ${result.count} hirdetés`);
  if (!result.items?.length) {
    console.error("Nincs importált elem — Cloudflare vagy üres lista.");
    process.exit(1);
  }

  const item = result.items[0];
  console.log("Első:", item.cim, "| km:", item.form?.km ?? item.km);

  const saved = saveListing(item.form, null);
  console.log(`Mentve DB-be: #${saved.id}, ${saved.cells.length} cella`);
  console.log("Mezők:", saved.cells.map((c) => c.label).slice(0, 8).join(", "), "…");
} catch (error) {
  console.error("HIBA:", error.message ?? error);
  process.exit(1);
}
