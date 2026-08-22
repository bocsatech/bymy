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
  return readFileSync(join(__dirname, "..", "..", "supabase", "migrations", "007_visitors_and_last_login.sql"), "utf8");
}

function dbUrl() {
  return String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").trim();
}

export function visitorSchemaHint() {
  if (!isSupabaseBackend()) return "";
  if (dbUrl()) {
    return "A látogató táblák még nincsenek létrehozva. Kattints a „Séma telepítése” gombra, vagy futtasd a 007 migrációt a Supabase SQL Editorban.";
  }
  return "A látogató táblák hiányoznak. Supabase → SQL Editor → futtasd: supabase/migrations/007_visitors_and_last_login.sql. Vagy állítsd be a SUPABASE_DB_URL env-et és használd a „Séma telepítése” gombot.";
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
