/**
 * Terhelés / script forgalom: k6-szerű UA vagy túl sűrű kérés → IP tiltás,
 * amíg admin fel nem oldja.
 * A számláló processzenként megy (PM2 cluster: a küszöb így is eléri a ~20+ req/s origin terhelést).
 */

const WINDOW_MS = 6_000;
const MAX_HITS = 50;

const SCRIPT_UA =
  /\b(k6\/|locust|gatling|jmeter|apachebench|vegeta|fortio|siege\/|wrk\/|hey\/|bombardier|artillery|BymyLoadTest)\b/i;

/** @type {Map<string, number[]>} */
const hitsByIp = new Map();

export function resetIpAbuseForTests() {
  hitsByIp.clear();
}

function allowSet() {
  return new Set(
    String(process.env.BYMY_ABUSE_ALLOW_IPS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export function isLocalOrUnknownIp(ip) {
  const v = String(ip || "").trim();
  if (!v || v === "unknown") return true;
  if (v === "127.0.0.1" || v === "::1" || v === "::ffff:127.0.0.1") return true;
  return false;
}

export function isScriptUserAgent(ua) {
  return SCRIPT_UA.test(String(ua || ""));
}

/**
 * @returns {{ reason: string } | null}
 */
export function shouldAutoBlock({ ip, userAgent, now = Date.now() } = {}) {
  const addr = String(ip || "").trim();
  if (isLocalOrUnknownIp(addr)) return null;
  if (allowSet().has(addr)) return null;

  if (isScriptUserAgent(userAgent)) {
    return { reason: "script-ua" };
  }

  let bucket = hitsByIp.get(addr);
  if (!bucket) {
    bucket = [];
    hitsByIp.set(addr, bucket);
  }
  const cutoff = now - WINDOW_MS;
  while (bucket.length && bucket[0] < cutoff) bucket.shift();
  bucket.push(now);
  if (hitsByIp.size > 8000) {
    hitsByIp.delete(hitsByIp.keys().next().value);
  }
  if (bucket.length >= MAX_HITS) {
    return { reason: "rate" };
  }
  return null;
}
