
const buckets = new Map();

function prune(bucket, windowMs) {
  const cutoff = Date.now() - windowMs;
  while (bucket.length && bucket[0] < cutoff) bucket.shift();
}

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

function headerValue(req, name) {
  const raw = req?.headers?.[name];
  if (raw == null) return "";
  return String(Array.isArray(raw) ? raw[0] : raw).trim();
}

/** Cloudflare proxied kérésnél CF-Connecting-IP a megbízható forrás. */
export function clientIp(req) {
  const cf = headerValue(req, "cf-connecting-ip");
  if (cf) return cf;
  const realIp = headerValue(req, "x-real-ip");
  if (realIp) return realIp;
  const xf = headerValue(req, "x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return String(req?.socket?.remoteAddress || "unknown");
}
