/**
 * Workerek közötti feed cache (fájl) — pm2 cluster / több instance ugyanazt a listát kapja.
 * L1 továbbra is process memóriában van (listings.mjs); ez az L2.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";

function isServerlessRuntime() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTION_NAME);
}

function cacheRoot() {
  if (process.env.LISTINGS_FEED_CACHE_DIR) return process.env.LISTINGS_FEED_CACHE_DIR;
  if (isServerlessRuntime()) return join(tmpdir(), "bymy-feed-cache");
  return join(homedir(), ".autosweb", "feed-cache");
}

function ensureDir() {
  const dir = cacheRoot();
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  } catch {
    /* ignore */
  }
  return dir;
}

function safeKey(key) {
  return String(key || "default")
    .replace(/[^a-zA-Z0-9|_-]+/g, "_")
    .slice(0, 180);
}

function filePath(key) {
  return join(ensureDir(), `${safeKey(key)}.json`);
}

export function readSharedFeedCache(key, ttlMs) {
  const ttl = Math.max(0, Number(ttlMs) || 60_000);
  try {
    const path = filePath(key);
    if (!existsSync(path)) return null;
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const at = Number(parsed.at) || 0;
    if (!at || Date.now() - at > ttl) return null;
    if (parsed.value === undefined) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

export function writeSharedFeedCache(key, value) {
  if (value === undefined) return;
  try {
    const path = filePath(key);
    const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmp, JSON.stringify({ at: Date.now(), value }));
    renameSync(tmp, path);
  } catch {
    /* ignore — cache nem kritikus */
  }
}

export function clearSharedFeedCache() {
  try {
    const dir = ensureDir();
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      try {
        unlinkSync(join(dir, name));
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}
