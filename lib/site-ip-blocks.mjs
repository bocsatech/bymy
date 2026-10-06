import { createRequire } from "module";
import { initLevel1, level1SqlitePath } from "./level1.mjs";
import { isSupabaseBackend, getSupabase } from "./supabase/client.mjs";

const require = createRequire(import.meta.url);
const KV_KEY = "blocked_ips_v1";
const AUTO_KV_KEY = "autoblocked_ips_v1";

let sqliteDb = null;
let blockCache = { at: 0, ips: new Set(), auto: [] };
const BLOCK_CACHE_MS = 8_000;

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

async function readAutoList() {
  await initLevel1();
  const raw = await readKv(AUTO_KV_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const ip = normalizeIp(row.ip);
        const until = Number(row.until || 0);
        if (!ip) return null;
        if (until > 0 && until <= now) return null;
        return { ip, until, reason: String(row.reason || "auto") };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function writeAutoList(rows) {
  await writeKv(AUTO_KV_KEY, JSON.stringify(rows));
}

async function readKv(key) {
  if (isSupabaseBackend()) {
    const { data, error } = await sb().from("level1_kv").select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    return data?.value || "";
  }
  const row = getSqlite().prepare(`SELECT value FROM kv WHERE key = ?`).get(key);
  return row?.value || "";
}

async function writeKv(key, json) {
  if (isSupabaseBackend()) {
    const { error } = await sb().from("level1_kv").upsert({ key, value: json }, { onConflict: "key" });
    if (error) throw error;
    return;
  }
  getSqlite()
    .prepare(`INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .run(key, json);
}

async function readList() {
  await initLevel1();
  const raw = await readKv(KV_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeIp).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function writeList(ips) {
  await writeKv(KV_KEY, JSON.stringify([...new Set(ips.map(normalizeIp).filter(Boolean))]));
}

function invalidateBlockCache() {
  blockCache = { at: 0, ips: new Set(), auto: [] };
}

async function loadBlockSnapshot() {
  const now = Date.now();
  if (blockCache.at && now - blockCache.at < BLOCK_CACHE_MS) {
    return blockCache;
  }
  const [manual, auto] = await Promise.all([readList(), readAutoList()]);
  const ips = new Set(manual);
  for (const row of auto) ips.add(row.ip);
  blockCache = { at: now, ips, auto };
  return blockCache;
}

export async function listBlockedIps() {
  const snap = await loadBlockSnapshot();
  return [...snap.ips];
}

export async function blockIp(ip) {
  const next = normalizeIp(ip);
  if (!next) throw new Error("IP cím kötelező.");
  const list = await readList();
  if (!list.includes(next)) list.push(next);
  await writeList(list);
  invalidateBlockCache();
  return listBlockedIps();
}

export async function autoBlockIp(ip, { reason = "auto" } = {}) {
  const next = normalizeIp(ip);
  if (!next) return readAutoList();
  const list = await readList();
  if (!list.includes(next)) {
    list.push(next);
    await writeList(list);
  }
  const auto = (await readAutoList()).filter((row) => row.ip !== next);
  auto.push({ ip: next, until: 0, reason: String(reason || "auto") });
  await writeAutoList(auto);
  invalidateBlockCache();
  return listBlockedIps();
}

export async function unblockIp(ip) {
  const target = normalizeIp(ip);
  await writeList((await readList()).filter((x) => x !== target));
  await writeAutoList((await readAutoList()).filter((row) => row.ip !== target));
  invalidateBlockCache();
  return listBlockedIps();
}

export async function isIpBlocked(ip) {
  const target = normalizeIp(ip);
  if (!target) return false;
  const snap = await loadBlockSnapshot();
  return snap.ips.has(target);
}
