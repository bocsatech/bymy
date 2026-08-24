#!/usr/bin/env node
/** Admin állapot Supabase-ben (jelszó nélkül). */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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

loadEnvLocal();
process.env.DB_BACKEND = process.env.DB_BACKEND || "supabase";

const { getSupabase, isSupabaseBackend } = await import("../lib/supabase/client.mjs");

if (!isSupabaseBackend()) {
  console.error("Nincs Supabase (.env.local: SUPABASE_URL + SERVICE_ROLE_KEY).");
  process.exit(1);
}

const sb = getSupabase();
const { data, error } = await sb
  .from("level1_admins")
  .select("id, username, email, locked, failed_attempts, updated_at")
  .order("id");

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log("level1_admins:");
for (const row of data ?? []) {
  console.log(
    `  - ${row.username} | email=${row.email || "—"} | locked=${row.locked} | fails=${row.failed_attempts}`
  );
}
if (!data?.length) console.log("  (üres — nincs admin fiók)");

console.log("\nVercel env (helyi .env.local):");
for (const k of [
  "LEVEL1_BOOTSTRAP_USERNAME",
  "LEVEL1_BOOTSTRAP_PASSWORD",
  "LEVEL1_BOOTSTRAP_EMAIL",
  "SMTP_USER",
]) {
  const v = process.env[k];
  console.log(`  ${k}=${v ? (k.includes("PASSWORD") || k.includes("SECRET") ? "***" : v) : "(nincs)"}`);
}
