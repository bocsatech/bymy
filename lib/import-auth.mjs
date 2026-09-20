import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getUserById } from "./web-users-store.mjs";
import { rateLimit } from "./rate-limit.mjs";

export const IMPORT_TOKEN_PREFIX = "imp1.";

export const HA_IMPORT_ORIGINS = new Set([
  "https://www.hasznaltauto.hu",
  "https://hasznaltauto.hu",
  "https://admin.hasznaltauto.hu",
]);

function importTokenSecret() {
  const s = String(
    process.env.BYMY_IMPORT_TOKEN_SECRET || process.env.OAUTH_STATE_SECRET || ""
  ).trim();
  return s || null;
}

export function importTokenTtlMs() {
  const n = Number(process.env.BYMY_IMPORT_TOKEN_TTL_MS || 4 * 60 * 60 * 1000);
  return Number.isFinite(n) && n >= 60_000 ? n : 4 * 60 * 60 * 1000;
}

export function importRateLimitPerHour() {
  const n = Number(process.env.BYMY_IMPORT_RATE_LIMIT || 120);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 120;
}

export function isImportScopedToken(token) {
  return String(token || "").trim().startsWith(IMPORT_TOKEN_PREFIX);
}

export function createImportToken(userId) {
  const secret = importTokenSecret();
  if (!secret) {
    throw new Error("BYMY_IMPORT_TOKEN_SECRET vagy OAUTH_STATE_SECRET hiányzik.");
  }
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) throw new Error("Érvénytelen felhasználó.");
  const exp = Date.now() + importTokenTtlMs();
  const nonce = randomBytes(8).toString("hex");
  const payload = `${uid}.${exp}.${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${IMPORT_TOKEN_PREFIX}${Buffer.from(payload, "utf8").toString("base64url")}.${sig}`;
}

export function parseImportToken(token) {
  const secret = importTokenSecret();
  if (!secret) return null;
  const raw = String(token || "").trim();
  if (!raw.startsWith(IMPORT_TOKEN_PREFIX)) return null;
  const rest = raw.slice(IMPORT_TOKEN_PREFIX.length);
  const dot = rest.lastIndexOf(".");
  if (dot < 1) return null;
  const payloadB64 = rest.slice(0, dot);
  const sig = rest.slice(dot + 1);
  let payload;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const parts = payload.split(".");
  const userId = Number(parts[0]);
  const exp = Number(parts[1]);
  if (!Number.isFinite(userId) || userId <= 0 || !Number.isFinite(exp) || Date.now() > exp) {
    return null;
  }
  return { userId, exp };
}

export async function getUserByImportToken(token) {
  const parsed = parseImportToken(token);
  if (!parsed) return null;
  try {
    return await getUserById(parsed.userId);
  } catch {
    return null;
  }
}

/** Cross-origin HA könyvjelző: csak rövid élettartamú imp1 token. */
export function haOriginRequiresImportToken(req) {
  const origin = String(req.headers?.origin ?? "").trim();
  return HA_IMPORT_ORIGINS.has(origin);
}

export function consumeImportSaveQuota(userId, saveCount = 1) {
  const uid = Number(userId);
  const n = Math.max(1, Math.min(Number(saveCount) || 1, 500));
  const limit = importRateLimitPerHour();
  const windowMs = 60 * 60 * 1000;
  const key = `import-save:user:${uid}`;
  for (let i = 0; i < n; i += 1) {
    const result = rateLimit(key, { limit, windowMs });
    if (!result.ok) return result;
  }
  return { ok: true };
}
