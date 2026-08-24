/**
 * Vercel Edge: csak regisztrált felhasználók (HTML + API cookie ellenőrzés).
 * Teljes session validáció: api/index.mjs → server.mjs site-gate.
 * Kikapcsolás: SITE_PUBLIC=1
 */

const PUBLIC_HTML = new Set([
  "/belepes.html",
  "/regisztracio.html",
  "/aktivalas.html",
  "/jelszo-elfelejtve.html",
  "/jelszo-visszaallitas.html",
  "/Bocsatech.html",
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

function membersOnly() {
  const pub = String(process.env.SITE_PUBLIC ?? "").trim().toLowerCase();
  return !(pub === "1" || pub === "true" || pub === "yes");
}

function extname(pathname) {
  const i = pathname.lastIndexOf(".");
  return i >= 0 ? pathname.slice(i).toLowerCase() : "";
}

function isStaticAsset(pathname) {
  if (pathname === "/favicon.ico" || pathname === "/robots.txt" || pathname === "/maintenance.html") {
    return true;
  }
  return STATIC_EXT.has(extname(pathname));
}

function isPublicApi(pathname, method) {
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname === "/api/health" && method === "GET") return true;
  // Bocsatech admin saját auth — ne a members gate zárja ki
  if (pathname.startsWith("/api/level1/")) return true;
  return false;
}

function isPublic(pathname, method) {
  if (PUBLIC_HTML.has(pathname)) return true;
  if (isStaticAsset(pathname)) return true;
  if (pathname.startsWith("/api/") && isPublicApi(pathname, method)) return true;
  return false;
}

function hasSessionCookie(request) {
  const cookie = request.headers.get("cookie") || "";
  return /(?:^|;\s*)autosweb_session=/.test(cookie);
}

export default function middleware(request) {
  if (!membersOnly()) return;

  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method || "GET";

  if (isPublic(pathname, method)) return;

  if (hasSessionCookie(request)) return;

  if (pathname.startsWith("/api/")) {
    return new Response(JSON.stringify({ error: "Belépés szükséges.", code: "AUTH_REQUIRED" }), {
      status: 401,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const next = encodeURIComponent(`${pathname}${url.search}`);
  return Response.redirect(new URL(`/belepes.html?next=${next}`, request.url), 302);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
