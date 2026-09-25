
/** Belépés nélkül csak auth / jelszó oldalak + Level1 admin belépő (members-only). */
const PUBLIC_HTML = new Set([
  "/belepes.html",
  "/regisztracio.html",
  "/aktivalas.html",
  "/jelszo-elfelejtve.html",
  "/jelszo-visszaallitas.html",
  "/Bocsatech.html",
  "/bocsatech.html",
]);

const STATIC_EXT = new Set([
  ".css",
  ".js",
  ".mjs",
  ".map",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".txt",
  ".json",
]);

export function isMembersOnlySite() {
  const pub = String(process.env.SITE_PUBLIC ?? "").trim().toLowerCase();
  return !(pub === "1" || pub === "true" || pub === "yes");
}

function extname(pathname) {
  const i = pathname.lastIndexOf(".");
  return i >= 0 ? pathname.slice(i).toLowerCase() : "";
}

export function isStaticAssetPath(pathname) {
  if (pathname === "/favicon.ico" || pathname === "/robots.txt" || pathname === "/maintenance.html") {
    return true;
  }
  return STATIC_EXT.has(extname(pathname));
}

export function isPublicHtmlPath(pathname) {
  const path = String(pathname || "");
  if (PUBLIC_HTML.has(path)) return true;
  // macOS / böngésző gyakran kisbetűs URL-t küld
  if (path.toLowerCase() === "/bocsatech.html") return true;
  return false;
}

export function isPublicApiPath(pathname, method = "GET") {
  const m = String(method || "GET").toUpperCase();
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname === "/api/health" && m === "GET") return true;
  if (pathname === "/api/site-blocks") return true;
  if (pathname.startsWith("/api/level1/")) return true;
  if (pathname === "/api/internal/mail-relay" && m === "POST") return true;
  return false;
}

export function isPublicPath(pathname, method = "GET") {
  if (pathname.startsWith("/cdn-cgi/")) return true;
  if (isPublicHtmlPath(pathname)) return true;
  if (isStaticAssetPath(pathname)) return true;
  if (pathname.startsWith("/api/") && isPublicApiPath(pathname, method)) return true;
  return false;
}

function loginRedirectUrl(req, pathname) {
  const q = String(req.url || "").includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const next = encodeURIComponent(`${pathname}${q}`);
  return `/belepes.html?next=${next}`;
}

export async function enforceMembersGate(req, res, pathname, deps) {
  if (!isMembersOnlySite()) return { allowed: true };
  if (isPublicPath(pathname, req.method || "GET")) return { allowed: true };

  // Share crawler: hirdetés HTML OG-hez (API továbbra is védett)
  if (
    (req.method || "GET").toUpperCase() === "GET" &&
    pathname === "/hirdetes.html" &&
    deps?.isSocialShareCrawler?.(req)
  ) {
    return { allowed: true };
  }

  const { getUserBySessionToken, getSessionTokenFromRequest, sendJson, sendRedirect } = deps;
  let user = null;
  try {
    user = await getUserBySessionToken(getSessionTokenFromRequest(req), { light: true });
  } catch {
    user = null;
  }
  if (user?.email) return { allowed: true, user };

  if (pathname.startsWith("/api/")) {
    sendJson(res, 401, { error: "Belépés szükséges.", code: "AUTH_REQUIRED" });
    return { allowed: false };
  }

  sendRedirect(res, loginRedirectUrl(req, pathname === "/" ? "/" : pathname));
  return { allowed: false };
}
