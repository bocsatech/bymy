
const PUBLIC_HTML = new Set([
  "/",
  "/index.html",
  "/auto.html",
  "/teherauto.html",
  "/ingatlan.html",
  "/hirdetes.html",
  "/listings.html",
  "/kereses.html",
  "/partners.html",
  "/ajanlasok.html",
  "/adasveteli-szerzodes.html",
  "/belepes.html",
  "/regisztracio.html",
  "/aktivalas.html",
  "/jelszo-elfelejtve.html",
  "/jelszo-visszaallitas.html",
  "/partner-profil.html",
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
  return PUBLIC_HTML.has(pathname) || /^\/partner\/[a-z0-9-]+\/?$/.test(pathname);
}

export function isPublicApiPath(pathname, method = "GET") {
  const m = String(method || "GET").toUpperCase();
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname === "/api/health" && m === "GET") return true;
  if (pathname === "/api/partner-profiles" && m === "GET") return true;
  if (pathname.startsWith("/api/partner-profiles/") && pathname !== "/api/partner-profiles/mine" && m === "GET") {
    return true;
  }
  if (pathname.startsWith("/api/level1/")) return true;
  if (pathname === "/api/site-blocks") return true;
  if (pathname === "/api/hub-promo" && m === "GET") return true;
  if (pathname === "/api/nav/counts" && m === "GET") return true;
  if (pathname === "/api/field-defs" && m === "GET") return true;
  if (pathname === "/api/media/proxy" && m === "GET") return true;
  if (pathname.startsWith("/api/vehicle-catalog") && m === "GET") return true;
  if ((pathname === "/api/postal-codes/lookup" || pathname === "/api/postal-codes/cities") && m === "GET") {
    return true;
  }
  if (pathname.startsWith("/api/partners") && m === "GET") return true;
  if (pathname === "/api/valuation/options" && m === "GET") return true;
  if (pathname === "/api/valuation/estimate" && m === "GET") return true;

  if (pathname === "/api/listings" && m === "GET") return true;
  if (pathname === "/api/listings/latest" && m === "GET") return true;
  if (/^\/api\/listings\/\d+$/.test(pathname) && m === "GET") return true;
  if (/^\/api\/listings\/\d+\/view$/.test(pathname) && m === "POST") return true;

  return false;
}

export function isPublicPath(pathname, method = "GET") {
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
