/** Böngésző: belső útvonal open-redirect ellen. */

export function safeInternalPath(value, fallback = "/") {
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

  const pathOnly = path.split(/[?#]/)[0] || "/";
  if (pathOnly.startsWith("//") || pathOnly.includes("\\")) return fallback;

  return path.length > 500 ? fallback : path;
}
