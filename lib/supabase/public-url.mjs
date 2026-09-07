/**
 * Server talks to Supabase on an internal URL; browsers need the public HTTPS host.
 * Set SUPABASE_PUBLIC_URL (e.g. https://bymy.hu) when SUPABASE_URL is private.
 */
export function rewritePublicStorageUrl(url) {
  const raw = String(url ?? "").trim();
  if (!raw) return raw;
  const publicBase = String(process.env.SUPABASE_PUBLIC_URL ?? "")
    .trim()
    .replace(/\/$/, "");
  if (!publicBase) return raw;
  try {
    const current = new URL(raw);
    const pub = new URL(publicBase);
    current.protocol = pub.protocol;
    current.host = pub.host;
    return current.toString();
  } catch {
    return raw;
  }
}
