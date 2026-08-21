/** Belső útvonalak — open redirect ellen (//evil.example tiltva). */

const DEFAULT_PATH = "/";

/**
 * Csak ugyanarra a site-ra mutató relatív útvonalat enged.
 * @param {unknown} value
 * @param {string} [fallback="/"]
 * @returns {string}
 */
export function safeInternalPath(value, fallback = DEFAULT_PATH) {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }

  const path = decoded.trim();
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//")) return fallback;
  if (path.includes("\\")) return fallback;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return fallback;
  if (path.includes("@")) return fallback;
  if (/[\0\r\n]/.test(path)) return fallback;

  // Query/hash OK, de a path rész ne legyen protocol-relative
  const pathOnly = path.split(/[?#]/)[0] || "/";
  if (pathOnly.startsWith("//") || pathOnly.includes("\\")) return fallback;

  return path.length > 500 ? fallback : path;
}
