/**
 * Vercel Edge: csak regisztrált felhasználók (HTML + API cookie ellenőrzés).
 * Nyilvános útvonalak: lib/site-gate.mjs (ugyanaz, mint S1 server.mjs).
 * Kikapcsolás: SITE_PUBLIC=1
 *
 * Session: nem elég a cookie létezése — /api/auth/me-vel ellenőrizzük.
 */

import {
  isMembersOnlySite,
  isPublicHtmlPath,
  isPublicApiPath,
  isStaticAssetPath,
} from "./lib/site-gate.mjs";

function isSocialShareCrawler(request) {
  const ua = request.headers.get("user-agent") || "";
  return /facebookexternalhit|Facebot|FacebookBot|Twitterbot|LinkedInBot|Slackbot|WhatsApp|TelegramBot|Discordbot|Pinterest|vkShare|Googlebot/i.test(
    ua
  );
}

function isPublic(pathname, method) {
  if (pathname.startsWith("/cdn-cgi/")) return true;
  if (isPublicHtmlPath(pathname)) return true;
  if (isStaticAssetPath(pathname)) return true;
  if (pathname.startsWith("/api/") && isPublicApiPath(pathname, method)) return true;
  return false;
}

async function sessionUserEmail(request) {
  const cookie = request.headers.get("cookie") || "";
  if (!/(?:^|;\s*)autosweb_session=/.test(cookie)) return "";
  try {
    const meUrl = new URL("/api/auth/me", request.url);
    const res = await fetch(meUrl, {
      method: "GET",
      headers: {
        cookie,
        accept: "application/json",
        "x-bymy-edge-gate": "1",
      },
      redirect: "manual",
    });
    if (!res.ok) return "";
    const data = await res.json().catch(() => null);
    return String(data?.user?.email || "").trim();
  } catch {
    return "";
  }
}

export default async function middleware(request) {
  if (!isMembersOnlySite()) return;

  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method || "GET";

  if (isPublic(pathname, method)) return;

  // Facebook / WhatsApp OG előnézet — csak a hirdetés HTML
  if (method === "GET" && pathname === "/hirdetes.html" && isSocialShareCrawler(request)) {
    return;
  }

  const email = await sessionUserEmail(request);
  if (email) return;

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
