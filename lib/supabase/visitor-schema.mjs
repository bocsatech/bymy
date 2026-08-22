/**
 * Supabase: site_visitor_sessions + site_page_hits táblák (007 migráció).
 * Szükséges env: SUPABASE_DB_URL vagy DATABASE_URL (Postgres connection string).
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { isSupabaseBackend } from "./client.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
let ensurePromise = null;
let ensured = false;

function migrationSql() {
  const base = join(__dirname, "..", "..", "supabase", "migrations");
  const a = readFileSync(join(base, "007_visitors_and_last_login.sql"), "utf8");
  const b = readFileSync(join(base, "008_visitor_monitoring.sql"), "utf8");
  return `${a}\n${b}`;
}

function dbUrl() {
  return String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").trim();
}

export function visitorSchemaHint() {
  if (!isSupabaseBackend()) return "";
  return "Futtasd a supabase/migrations/007_visitors_and_last_login.sql fájlt a Supabase SQL Editorban (NOTIFY sor is kell a végén), várj ~1 percet, majd frissíts. Automatikus telepítéshez: SUPABASE_DB_URL a Vercel env-ben.";
}

export async function ensureSupabaseVisitorSchema({ force = false } = {}) {
  if (!isSupabaseBackend()) return { ok: true, skipped: "sqlite" };
  if (ensured && !force) return { ok: true, cached: true };

  const url = dbUrl();
  if (!url) {
    return { ok: false, error: "SUPABASE_DB_URL nincs beállítva.", hint: visitorSchemaHint() };
  }

  if (!ensurePromise || force) {
    ensurePromise = (async () => {
      let pg;
      try {
        pg = await import("pg");
      } catch {
        return {
          ok: false,
          error: "A pg csomag nincs telepítve (npm install).",
          hint: visitorSchemaHint(),
        };
      }

      const client = new pg.default.Client({
        connectionString: url,
        ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
      });

      try {
        await client.connect();
        await client.query(migrationSql());
        ensured = true;
        return { ok: true };
      } catch (err) {
        ensured = false;
        return { ok: false, error: err.message ?? String(err), hint: visitorSchemaHint() };
      } finally {
        try {
          await client.end();
        } catch {
          /* ignore */
        }
      }
    })();
  }

  return ensurePromise;
}

export function resetVisitorSchemaCache() {
  ensured = false;
  ensurePromise = null;
}
