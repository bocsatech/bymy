/** Blokkolt IP címek — level1 kv (admin). */
import { createRequire } from "module";
import { initLevel1, level1SqlitePath } from "./level1.mjs";
import { isSupabaseBackend, getSupabase } from "./supabase/client.mjs";

const require = createRequire(import.meta.url);
const KV_KEY = "blocked_ips_v1";

let sqliteDb = null;

function normalizeIp(value) {
  return String(value ?? "").trim();
}

function sb() {
  return getSupabase();
}

function getSqlite() {
  if (!sqliteDb) {
    const DatabaseSync = require("node:sqlite").DatabaseSync;
    sqliteDb = new DatabaseSync(level1SqlitePath());
  }
  return sqliteDb;
}

async function readList() {
  await initLevel1();
  if (isSupabaseBackend()) {
    const { data, error } = await sb().from("level1_kv").select("value").eq("key", KV_KEY).maybeSingle();
    if (error) throw error;
    if (!data?.value) return [];
    try {
      const parsed = JSON.parse(data.value);
      return Array.isArray(parsed) ? parsed.map(normalizeIp).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  const row = getSqlite().prepare(`SELECT value FROM kv WHERE key = ?`).get(KV_KEY);
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed.map(normalizeIp).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function writeList(ips) {
  const json = JSON.stringify([...new Set(ips.map(normalizeIp).filter(Boolean))]);
  if (isSupabaseBackend()) {
    const { error } = await sb().from("level1_kv").upsert({ key: KV_KEY, value: json }, { onConflict: "key" });
    if (error) throw error;
    return;
  }
  getSqlite()
    .prepare(`INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .run(KV_KEY, json);
}

export async function listBlockedIps() {
  return readList();
}

export async function blockIp(ip) {
  const next = normalizeIp(ip);
  if (!next) throw new Error("IP cím kötelező.");
  const list = await readList();
  if (!list.includes(next)) list.push(next);
  await writeList(list);
  return list;
}

export async function unblockIp(ip) {
  const target = normalizeIp(ip);
  await writeList((await readList()).filter((x) => x !== target));
  return readList();
}

export async function isIpBlocked(ip) {
  const target = normalizeIp(ip);
  if (!target) return false;
  return (await readList()).includes(target);
}
