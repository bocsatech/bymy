/** Egyszerű IP/kulcs alapú sliding-window rate limit (folyamatmemória). */

const buckets = new Map();

function prune(bucket, windowMs) {
  const cutoff = Date.now() - windowMs;
  while (bucket.length && bucket[0] < cutoff) bucket.shift();
}

/**
 * @param {string} key
 * @param {{ limit?: number, windowMs?: number }} [opts]
 * @returns {{ ok: boolean, retryAfterSec?: number }}
 */
export function rateLimit(key, { limit = 20, windowMs = 60_000 } = {}) {
  const id = String(key || "anon");
  let bucket = buckets.get(id);
  if (!bucket) {
    bucket = [];
    buckets.set(id, bucket);
  }
  prune(bucket, windowMs);
  if (bucket.length >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket[0] + windowMs - Date.now()) / 1000));
    return { ok: false, retryAfterSec };
  }
  bucket.push(Date.now());
  if (buckets.size > 5000) {
    const oldest = buckets.keys().next().value;
    buckets.delete(oldest);
  }
  return { ok: true };
}

export function clientIp(req) {
  const xf = String(req?.headers?.["x-forwarded-for"] ?? "").split(",")[0].trim();
  if (xf) return xf;
  return String(req?.socket?.remoteAddress || req?.headers?.["x-real-ip"] || "unknown");
}
