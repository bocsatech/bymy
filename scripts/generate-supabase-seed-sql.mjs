#!/usr/bin/env node
/**
 * Generálja a supabase/migrations/002_seed_baseline.sql fájlt
 * (field_defs + service_categories). Irányítószámok külön seed scripttel.
 */
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { FORM_FIELD_CATALOG } from "../lib/form-field-catalog.mjs";
import { PARTNER_CATEGORIES } from "../lib/partner-categories.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "supabase", "migrations", "002_seed_baseline.sql");

function sqlEscape(value) {
  return String(value).replace(/'/g, "''");
}

const fieldRows = FORM_FIELD_CATALOG.map(
  (def, index) =>
    `  ('${sqlEscape(def.field_key)}', '${sqlEscape(def.label)}', ${def.step}, ${index})`
).join(",\n");

const categoryRows = PARTNER_CATEGORIES.map(
  (cat) => `  ('${sqlEscape(cat.id)}', '${sqlEscape(cat.label)}', ${cat.sort_order})`
).join(",\n");

const sql = `-- Automatikusan generált — ne szerkeszd kézzel.
-- Futtatás: node scripts/generate-supabase-seed-sql.mjs

INSERT INTO field_defs (field_key, label, step, sort_order) VALUES
${fieldRows}
ON CONFLICT (field_key) DO NOTHING;

INSERT INTO service_categories (id, label, sort_order) VALUES
${categoryRows}
ON CONFLICT (id) DO NOTHING;
`;

writeFileSync(outPath, sql, "utf8");
console.log(`Wrote ${outPath} (${FORM_FIELD_CATALOG.length} fields, ${PARTNER_CATEGORIES.length} categories)`);
