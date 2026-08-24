#!/usr/bin/env node
/**
 * Lefuttatja a supabase/migrations/*.sql fájlokat a Postgres-en.
 * Kell: SUPABASE_DB_URL vagy DATABASE_URL a .env.local-ban.
 *
 *   node scripts/apply-supabase-migrations.mjs
 */
import { createRequire } from "module";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const FILES = [
  "001_initial_schema.sql",
  "002_seed_baseline.sql",
  "005_level1.sql",
  "006_drop_unused_form_fields.sql",
  "007_visitors_and_last_login.sql",
  "008_visitor_monitoring.sql",
  "009_password_reset.sql",
];

function loadEnvLocal() {
  const path = join(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 1) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();
  const url = String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").trim();
  if (!url) {
    console.error("Hiányzik SUPABASE_DB_URL (vagy DATABASE_URL) a .env.local-ból.");
    console.error(
      "Supabase → Project Settings → Database → Connection string (URI) → jelszóval."
    );
    process.exit(1);
  }

  const require = createRequire(import.meta.url);
  const pg = require("pg");
  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  const dir = join(ROOT, "supabase", "migrations");
  for (const name of FILES) {
    const full = join(dir, name);
    if (!existsSync(full)) {
      console.warn(`skip missing: ${name}`);
      continue;
    }
    const sql = readFileSync(full, "utf8");
    process.stdout.write(`apply ${name} … `);
    await client.query(sql);
    console.log("ok");
  }
  // schema cache refresh for PostgREST
  try {
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log("NOTIFY pgrst reload schema: ok");
  } catch (err) {
    console.warn("NOTIFY skip:", err.message);
  }
  await client.end();
  console.log("kész — séma fent");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
