#!/usr/bin/env node
/**
 * Teljes mentés: GitHub + Supabase + Vercel konfig + helyi adatok
 * → ~/Downloads/mentesweb/
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BASE = join(process.env.HOME || "", "Downloads", "mentesweb");
const STAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUT = join(BASE, STAMP);

const TABLES = [
  "field_defs",
  "listings",
  "listing_cells",
  "web_users",
  "web_sessions",
  "web_user_identities",
  "conversations",
  "messages",
  "message_blocks",
  "device_tokens",
  "push_outbox",
  "service_categories",
  "postal_codes",
  "partners",
  "partner_services",
  "level1_admins",
  "level1_otps",
  "level1_sessions",
  "level1_kv",
  "site_visitor_sessions",
  "site_page_hits",
];

const STORAGE_BUCKETS = ["listings", "hub-promo", "site-hero"];

function log(msg) {
  console.log(`[mentes] ${msg}`);
}

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function run(cmd, cwd = ROOT) {
  return execSync(cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function copyTree(src, dest, { exclude = [] } = {}) {
  if (!existsSync(src)) return false;
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, {
    recursive: true,
    filter: (p) => !exclude.some((x) => p.includes(x)),
  });
  return true;
}

async function dumpSupabase(outDir) {
  const report = { tables: {}, storage: {}, errors: [] };
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    report.errors.push("Nincs SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env.local)");
    return report;
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const dataDir = join(outDir, "data");
  mkdirSync(dataDir, { recursive: true });

  for (const table of TABLES) {
    try {
      const rows = [];
      let from = 0;
      const page = 500;
      while (true) {
        const { data, error } = await sb.from(table).select("*").range(from, from + page - 1);
        if (error) {
          report.tables[table] = { error: error.message };
          break;
        }
        if (!data?.length) {
          report.tables[table] = { rows: rows.length };
          writeFileSync(join(dataDir, `${table}.json`), JSON.stringify(rows, null, 2));
          break;
        }
        rows.push(...data);
        if (data.length < page) {
          report.tables[table] = { rows: rows.length };
          writeFileSync(join(dataDir, `${table}.json`), JSON.stringify(rows, null, 2));
          break;
        }
        from += page;
      }
      log(`Supabase tábla: ${table} → ${report.tables[table]?.rows ?? "hiba"}`);
    } catch (err) {
      report.tables[table] = { error: err.message ?? String(err) };
    }
  }

  const storageDir = join(outDir, "storage");
  mkdirSync(storageDir, { recursive: true });

  async function listAll(bucket, prefix = "") {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) throw error;
    const files = [];
    for (const item of data || []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) files.push(path);
      else if (!item.metadata) {
        const nested = await listAll(bucket, path);
        files.push(...nested);
      }
    }
    return files;
  }

  for (const bucket of STORAGE_BUCKETS) {
    try {
      const files = await listAll(bucket);
      report.storage[bucket] = { files: files.length };
      const bucketDir = join(storageDir, bucket);
      mkdirSync(bucketDir, { recursive: true });
      let ok = 0;
      for (const filePath of files) {
        try {
          const { data, error } = await sb.storage.from(bucket).download(filePath);
          if (error || !data) continue;
          const buf = Buffer.from(await data.arrayBuffer());
          const dest = join(bucketDir, filePath);
          mkdirSync(dirname(dest), { recursive: true });
          writeFileSync(dest, buf);
          ok++;
        } catch {
          /* skip single file */
        }
      }
      report.storage[bucket].downloaded = ok;
      log(`Supabase storage: ${bucket} → ${ok}/${files.length} fájl`);
    } catch (err) {
      report.storage[bucket] = { error: err.message ?? String(err) };
    }
  }

  writeFileSync(join(outDir, "dump-report.json"), JSON.stringify(report, null, 2));
  return report;
}

async function fetchVercelLive(outDir) {
  const urls = [
    "https://bymy.vercel.app/",
    "https://bymy.vercel.app/belepes.html",
    "https://bymy.vercel.app/auto.html",
    "https://bymy.vercel.app/api/health",
  ];
  const liveDir = join(outDir, "live-snapshots");
  mkdirSync(liveDir, { recursive: true });
  const report = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      const body = await res.text();
      const name = url.replace(/https?:\/\//, "").replace(/[/?]/g, "_");
      writeFileSync(join(liveDir, `${name}.headers.txt`), [...res.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n"));
      writeFileSync(join(liveDir, `${name}.body.txt`), body.slice(0, 500_000));
      report.push({ url, status: res.status, bytes: body.length });
    } catch (err) {
      report.push({ url, error: err.message ?? String(err) });
    }
  }
  writeFileSync(join(outDir, "live-fetch-report.json"), JSON.stringify(report, null, 2));
  return report;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  log(`Mentés ide: ${OUT}`);
  loadEnvLocal();

  const manifest = {
    createdAt: new Date().toISOString(),
    sourceRoot: ROOT,
    output: OUT,
    sections: {},
  };

  // GitHub
  const ghDir = join(OUT, "github");
  mkdirSync(ghDir, { recursive: true });
  try {
    run(`git bundle create "${join(ghDir, "bymy.bundle")}" --all`, ROOT);
    manifest.sections.github_bundle = "ok";
    log("Git bundle kész");
  } catch (err) {
    manifest.sections.github_bundle = String(err.stderr || err.message || err);
  }
  try {
    run(`git clone --mirror git@github.com:bocsatech/bymy.git "${join(ghDir, "bymy.git")}"`, ghDir);
    manifest.sections.github_mirror = "ok";
    log("GitHub mirror clone kész");
  } catch (err) {
    try {
      run(`git clone --mirror https://github.com/bocsatech/bymy.git "${join(ghDir, "bymy.git")}"`, ghDir);
      manifest.sections.github_mirror = "ok (https)";
    } catch (err2) {
      manifest.sections.github_mirror = String(err2.stderr || err2.message || err2);
    }
  }
  try {
    run(
      `tar -czf "${join(ghDir, "bymy-working-tree.tar.gz")}" --exclude=node_modules --exclude=.git --exclude=ios/build --exclude=ios/dist --exclude=.vercel -C "${ROOT}" .`
    );
    manifest.sections.github_worktree_tar = "ok";
    log("Forráskód tar.gz kész");
  } catch (err) {
    manifest.sections.github_worktree_tar = String(err.stderr || err.message || err);
  }

  // Supabase (séma + adat)
  const sbDir = join(OUT, "supabase");
  mkdirSync(sbDir, { recursive: true });
  copyTree(join(ROOT, "supabase"), join(sbDir, "migrations-repo"));
  copyTree(join(ROOT, "docs"), join(sbDir, "docs"), { exclude: [] });
  if (existsSync(join(ROOT, ".env.local"))) {
    cpSync(join(ROOT, ".env.local"), join(sbDir, "env.local.backup"));
  }
  if (existsSync(join(ROOT, ".env.example"))) {
    cpSync(join(ROOT, ".env.example"), join(sbDir, "env.example"));
  }
  manifest.sections.supabase_schema = "ok";
  try {
    manifest.sections.supabase_dump = await dumpSupabase(sbDir);
  } catch (err) {
    manifest.sections.supabase_dump = { error: err.message ?? String(err) };
  }

  // Vercel
  const vzDir = join(OUT, "vercel");
  mkdirSync(vzDir, { recursive: true });
  for (const f of ["vercel.json", "middleware.js", "package.json"]) {
    if (existsSync(join(ROOT, f))) cpSync(join(ROOT, f), join(vzDir, f));
  }
  if (existsSync(join(ROOT, "api"))) copyTree(join(ROOT, "api"), join(vzDir, "api"));
  try {
    manifest.sections.vercel_live = await fetchVercelLive(vzDir);
  } catch (err) {
    manifest.sections.vercel_live = { error: err.message ?? String(err) };
  }
  try {
    const who = run("npx --yes vercel@59.4.0 whoami 2>&1", ROOT);
    writeFileSync(join(vzDir, "vercel-whoami.txt"), who);
    manifest.sections.vercel_cli = who.trim();
  } catch (err) {
    manifest.sections.vercel_cli = "nincs bejelentkezve";
    writeFileSync(join(vzDir, "vercel-whoami.txt"), "Logged out — env változók nem tölthetők le CLI-ből.\n");
  }

  // Helyi adatok
  const localDir = join(OUT, "local");
  mkdirSync(localDir, { recursive: true });
  const autosweb = join(process.env.HOME || "", ".autosweb");
  for (const name of ["autosweb.db", "profiles.json", "smtp.json", "smtp.example.json", "oauth.json", "oauth.example.json", "README.txt", "SERVER_INFO.txt"]) {
    const src = join(autosweb, name);
    if (existsSync(src)) cpSync(src, join(localDir, name));
  }
  if (existsSync(join(autosweb, "uploads"))) {
    copyTree(join(autosweb, "uploads"), join(localDir, "uploads"));
  }
  manifest.sections.local_autosweb = existsSync(autosweb) ? "ok" : "missing";

  writeFileSync(
    join(OUT, "README.txt"),
    [
      "Bymy teljes mentés",
      `Időpont: ${manifest.createdAt}`,
      `Mappa: ${OUT}`,
      "",
      "Tartalom:",
      "  github/     — git bundle, mirror clone, forráskód tar.gz",
      "  supabase/   — migrációk, env backup, táblák JSON, storage fájlok",
      "  vercel/     — vercel.json, middleware, api, élő URL pillanatképek",
      "  local/      — ~/.autosweb (SQLite, profilok, feltöltések)",
      "",
      "FIGYELEM: env.local.backup és smtp.json titkos kulcsokat tartalmaz — ne oszd meg!",
      "",
      "Visszaállítás GitHubról:",
      "  git clone github/bymy.git vagy git clone bymy.bundle",
      "",
    ].join("\n")
  );

  writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(join(BASE, "LATEST.txt"), OUT);

  log(`Kész: ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
