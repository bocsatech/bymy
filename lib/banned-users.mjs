import { createRequire } from "module";
import { initLevel1, level1SqlitePath } from "./level1.mjs";
import { isSupabaseBackend, getSupabase } from "./supabase/client.mjs";

const require = createRequire(import.meta.url);
const KV_KEY = "banned_users_v1";

let sqliteDb = null;

function normalizeEmail(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
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

function normalizeEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const email = normalizeEmail(raw.email);
  if (!email || !email.includes("@")) return null;
  return {
    email,
    displayName: String(raw.displayName ?? "").trim(),
    accountType:
      String(raw.accountType || "private").toLowerCase() === "business" ? "business" : "private",
    companyActivities: Array.isArray(raw.companyActivities) ? raw.companyActivities : [],
    formerUserId: Number(raw.formerUserId) || null,
    listingCountAtBan: Number(raw.listingCountAtBan) || 0,
    deletedListings: Number(raw.deletedListings) || 0,
    bannedAt: String(raw.bannedAt || new Date().toISOString()),
    profileSnapshot:
      raw.profileSnapshot && typeof raw.profileSnapshot === "object" ? raw.profileSnapshot : {},
  };
}

async function readList() {
  await initLevel1();
  if (isSupabaseBackend()) {
    const { data, error } = await sb().from("level1_kv").select("value").eq("key", KV_KEY).maybeSingle();
    if (error) throw error;
    if (!data?.value) return [];
    try {
      const parsed = JSON.parse(data.value);
      return Array.isArray(parsed) ? parsed.map(normalizeEntry).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  const row = getSqlite().prepare(`SELECT value FROM kv WHERE key = ?`).get(KV_KEY);
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed.map(normalizeEntry).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function writeList(entries) {
  const cleaned = [];
  const seen = new Set();
  for (const entry of entries.map(normalizeEntry).filter(Boolean)) {
    if (seen.has(entry.email)) continue;
    seen.add(entry.email);
    cleaned.push(entry);
  }
  const json = JSON.stringify(cleaned);
  if (isSupabaseBackend()) {
    const { error } = await sb().from("level1_kv").upsert({ key: KV_KEY, value: json }, { onConflict: "key" });
    if (error) throw error;
    return cleaned;
  }
  getSqlite()
    .prepare(`INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .run(KV_KEY, json);
  return cleaned;
}

export async function listBannedUsers() {
  const list = await readList();
  return list.sort((a, b) => String(b.bannedAt).localeCompare(String(a.bannedAt)));
}

export async function isEmailBanned(email) {
  const target = normalizeEmail(email);
  if (!target) return false;
  return (await readList()).some((row) => row.email === target);
}

/** Sync ellenőrzés (SQLite / helyi register). */
export function isEmailBannedSync(email) {
  const target = normalizeEmail(email);
  if (!target) return false;
  try {
    if (isSupabaseBackend()) return false; // csak async útvonalon
    const row = getSqlite().prepare(`SELECT value FROM kv WHERE key = ?`).get(KV_KEY);
    if (!row?.value) return false;
    const parsed = JSON.parse(row.value);
    if (!Array.isArray(parsed)) return false;
    return parsed.some((entry) => normalizeEmail(entry?.email) === target);
  } catch {
    return false;
  }
}

export async function banUserRecord(snapshot) {
  const entry = normalizeEntry({
    ...snapshot,
    bannedAt: snapshot?.bannedAt || new Date().toISOString(),
  });
  if (!entry) throw new Error("Email kötelező a tiltáshoz.");
  const list = await readList();
  const next = list.filter((row) => row.email !== entry.email);
  next.unshift(entry);
  await writeList(next);
  return entry;
}

export async function unbanEmail(email) {
  const target = normalizeEmail(email);
  if (!target) throw new Error("Email kötelező.");
  const list = await readList();
  await writeList(list.filter((row) => row.email !== target));
  return listBannedUsers();
}
