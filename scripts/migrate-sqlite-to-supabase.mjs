#!/usr/bin/env node
/**
 * Helyi SQLite (~/.autosweb/autosweb.db + level1.db) → Supabase feltöltés.
 *
 * Használat:
 *   node scripts/migrate-sqlite-to-supabase.mjs
 *   node scripts/migrate-sqlite-to-supabase.mjs --dry-run
 *   node scripts/migrate-sqlite-to-supabase.mjs --skip-images
 */
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "module";
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, extname, basename } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DRY = process.argv.includes("--dry-run");
const SKIP_IMAGES = process.argv.includes("--skip-images");

const SQLITE_DB = process.env.AUTOSWEB_DB_PATH || join(homedir(), ".autosweb", "autosweb.db");
const LEVEL1_DB =
  process.env.LEVEL1_DB_PATH || join(ROOT, "data", "level1.db");
const UPLOADS = join(homedir(), ".autosweb", "uploads");

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

function log(msg) {
  console.log(`[migrate] ${msg}`);
}

function openSqlite(path) {
  const require = createRequire(import.meta.url);
  const { DatabaseSync } = require("node:sqlite");
  return new DatabaseSync(path);
}

function all(db, sql, params = []) {
  return db.prepare(sql).all(...params);
}

function contentType(file) {
  const ext = extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

async function ensureBuckets(sb) {
  const needed = ["listings", "hub-promo", "site-hero"];
  const { data, error } = await sb.storage.listBuckets();
  if (error) throw error;
  const have = new Set((data || []).map((b) => b.name));
  for (const name of needed) {
    if (have.has(name)) continue;
    if (DRY) {
      log(`dry-run: create bucket ${name}`);
      continue;
    }
    const { error: err } = await sb.storage.createBucket(name, { public: true });
    if (err && !/already exists/i.test(err.message)) throw err;
    log(`bucket created: ${name}`);
  }
}

async function upsertRows(sb, table, rows, { onConflict = "id", chunk = 200 } = {}) {
  if (!rows.length) {
    log(`${table}: 0`);
    return 0;
  }
  if (DRY) {
    log(`dry-run ${table}: ${rows.length}`);
    return rows.length;
  }
  let done = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await sb.from(table).upsert(slice, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
    done += slice.length;
  }
  log(`${table}: ${done}`);
  return done;
}

function mapUser(row) {
  return {
    id: row.id,
    email: row.email,
    password_salt: row.password_salt,
    password_hash: row.password_hash,
    display_name: row.display_name,
    profile_json: row.profile_json || "{}",
    email_verified: Boolean(row.email_verified ?? 1),
    activation_token_hash: row.activation_token_hash || null,
    activation_expires_at: row.activation_expires_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapListing(row) {
  return {
    id: row.id,
    hirdetes_cime: row.hirdetes_cime,
    forras_url: row.forras_url,
    hasznaltauto_hirdetes_id: row.hasznaltauto_hirdetes_id,
    fo_kep: row.fo_kep,
    status: row.status || "mentett",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function uploadImages(sb) {
  const dir = join(UPLOADS, "listings");
  if (!existsSync(dir)) {
    log("nincs helyi listings upload mappa");
    return { uploaded: 0, urlByFile: new Map() };
  }
  const files = readdirSync(dir).filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f));
  const urlByFile = new Map();
  let uploaded = 0;
  for (const file of files) {
    const full = join(dir, file);
    if (!statSync(full).isFile()) continue;
    const buf = readFileSync(full);
    const path = file;
    if (DRY) {
      uploaded += 1;
      continue;
    }
    const { error } = await sb.storage.from("listings").upload(path, buf, {
      contentType: contentType(file),
      upsert: true,
    });
    if (error) {
      log(`image fail ${file}: ${error.message}`);
      continue;
    }
    const { data } = sb.storage.from("listings").getPublicUrl(path);
    urlByFile.set(file, data.publicUrl);
    urlByFile.set(`/uploads/listings/${file}`, data.publicUrl);
    uploaded += 1;
  }
  log(`images listings: ${uploaded}/${files.length}`);

  // hub-promo
  const hubDir = join(UPLOADS, "hub-promo");
  if (existsSync(hubDir)) {
    for (const file of readdirSync(hubDir)) {
      const full = join(hubDir, file);
      if (!statSync(full).isFile()) continue;
      if (DRY) continue;
      const { error } = await sb.storage.from("hub-promo").upload(file, readFileSync(full), {
        contentType: contentType(file),
        upsert: true,
      });
      if (error) log(`hub-promo fail ${file}: ${error.message}`);
    }
  }
  return { uploaded, urlByFile };
}

async function rewriteFoKep(sb, urlByFile) {
  if (DRY || !urlByFile.size) return 0;
  const { data, error } = await sb.from("listings").select("id, fo_kep");
  if (error) throw error;
  let n = 0;
  for (const row of data || []) {
    const fo = String(row.fo_kep || "");
    if (!fo) continue;
    let next = urlByFile.get(fo) || urlByFile.get(basename(fo));
    if (!next && fo.startsWith("/uploads/listings/")) {
      next = urlByFile.get(fo);
    }
    if (!next || next === fo) continue;
    const { error: err } = await sb.from("listings").update({ fo_kep: next }).eq("id", row.id);
    if (err) throw err;
    n += 1;
  }
  log(`fo_kep rewritten: ${n}`);
  return n;
}

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Hiányzik SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env.local)");
    process.exit(1);
  }
  if (!existsSync(SQLITE_DB)) {
    console.error(`Nincs SQLite: ${SQLITE_DB}`);
    process.exit(1);
  }

  log(`SQLite: ${SQLITE_DB}`);
  log(`Supabase: ${new URL(url).hostname}`);
  if (DRY) log("DRY-RUN mód");

  const sb = createClient(url, key, { auth: { persistSession: false } });

  // connectivity
  const ping = await sb.from("field_defs").select("field_key", { count: "exact", head: true });
  if (ping.error) {
    console.error(`Supabase kapcsolat hiba: ${ping.error.message}`);
    console.error("Ellenőrizd a kulcsokat és hogy a migrációk (001/002/005…) lefutottak-e.");
    process.exit(1);
  }
  log(`field_defs meglévő: ${ping.count ?? "?"}`);

  await ensureBuckets(sb);

  const db = openSqlite(SQLITE_DB);

  // field_defs
  const fieldDefs = all(db, "SELECT field_key, label, step, sort_order FROM field_defs");
  await upsertRows(
    sb,
    "field_defs",
    fieldDefs.map((r) => ({
      field_key: r.field_key,
      label: r.label,
      step: Number(r.step) || 1,
      sort_order: Number(r.sort_order) || 0,
    })),
    { onConflict: "field_key" }
  );

  // users first (FK)
  const users = all(db, "SELECT * FROM web_users");
  await upsertRows(sb, "web_users", users.map(mapUser));

  // listings
  const listings = all(db, "SELECT * FROM listings");
  await upsertRows(sb, "listings", listings.map(mapListing));

  // cells
  const cells = all(db, "SELECT listing_id, field_key, label, value, step FROM listing_cells");
  await upsertRows(
    sb,
    "listing_cells",
    cells.map((r) => ({
      listing_id: r.listing_id,
      field_key: r.field_key,
      label: r.label,
      value: r.value,
      step: Number(r.step) || 1,
    })),
    { onConflict: "listing_id,field_key", chunk: 500 }
  );

  // partners (optional)
  try {
    const partners = all(db, "SELECT * FROM partners");
    if (partners.length) {
      await upsertRows(
        sb,
        "partners",
        partners.map((r) => {
          const out = { ...r };
          return out;
        }),
        { onConflict: "id" }
      );
    }
  } catch (err) {
    log(`partners skip: ${err.message}`);
  }

  // service_categories
  try {
    const cats = all(db, "SELECT * FROM service_categories");
    await upsertRows(sb, "service_categories", cats, { onConflict: "id" });
  } catch {
    /* optional */
  }

  // level1 kv + admins
  if (existsSync(LEVEL1_DB)) {
    const l1 = openSqlite(LEVEL1_DB);
    try {
      const admins = all(l1, "SELECT * FROM admins");
      await upsertRows(
        sb,
        "level1_admins",
        admins.map((r) => ({
          id: r.id,
          username: r.username,
          email: r.email,
          password_salt: r.password_salt,
          password_hash: r.password_hash,
          failed_attempts: Number(r.failed_attempts) || 0,
          locked: Boolean(r.locked),
          created_at: r.created_at,
          updated_at: r.updated_at,
        }))
      );
    } catch (err) {
      log(`level1_admins skip: ${err.message}`);
    }
    try {
      const kv = all(l1, "SELECT key, value FROM kv");
      await upsertRows(sb, "level1_kv", kv, { onConflict: "key" });
    } catch (err) {
      log(`level1_kv skip: ${err.message}`);
    }
  }

  if (!SKIP_IMAGES) {
    const { urlByFile } = await uploadImages(sb);
    await rewriteFoKep(sb, urlByFile);
  } else {
    log("képek kihagyva (--skip-images)");
  }

  // verify
  for (const t of ["listings", "listing_cells", "web_users", "field_defs", "level1_kv"]) {
    const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
    log(`verify ${t}: ${error ? error.message : count}`);
  }

  log(DRY ? "kész (dry-run)" : "kész — adatok a Supabase-en");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
