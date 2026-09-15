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
  try {
    const current = new URL(raw);
    if (publicBase) {
      const pub = new URL(publicBase);
      current.protocol = pub.protocol;
      current.hostname = pub.hostname;
      current.port = pub.port;
    }
    // S2 storage :8000 nem elérhető kifelé — mindig a normál HTTPS host kell.
    if (current.port === "8000") current.port = "";
    if (/^168\.\d+\.\d+\.\d+$/.test(current.hostname)) {
      const fallbackHost = publicBase ? new URL(publicBase).hostname : "bymy.hu";
      current.protocol = "https:";
      current.hostname = fallbackHost;
      current.port = "";
    }
    return current.toString();
  } catch {
    return raw;
  }
}
