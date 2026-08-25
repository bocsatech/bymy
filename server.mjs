import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { findChromeExecutable } from "./lib/chrome-launcher.mjs";
import {
  saveListing,
  getListing,
  getLatestListing,
  listListingsWithPreview,
  countNavListings,
  deleteListing,
  dbStats,
  listFieldDefs,
  listingSourceExists,
  updateListingFoKep,
  updateListingPhotoUrls,
  clearListingPhotos,
  recordListingView,
  listMyListings,
  updateListingStatus,
  getDbPath,
  closeDb,
} from "./lib/db-store.mjs";
import { isSupabaseBackend } from "./lib/supabase/client.mjs";
import { getSiteBlocks, saveSiteBlocks } from "./lib/site-blocks.mjs";
import {
  getSiteHero,
  setActiveHeroUrl,
  uploadHeroImage,
  resolveHeroUploadFile,
  resolveServerImageFile,
  ensureServerImageDirs,
} from "./lib/site-hero.mjs";
import { getHubPromoPublic, resolveHubPromoFile } from "./lib/hub-promo.mjs";
import {
  deleteQuery,
  listFugvenyLists,
  loadQueries,
  predictOne,
  runSavedQuery,
  saveQuery,
  scoreList,
  trainFugvenyModel,
} from "./lib/fugveny-api.mjs";
import {
  deletePartner,
  getPartner,
  getPartnerRecommendations,
  getPostalCode,
  importPartners,
  listPartners,
  listPostalCities,
  partnerStats,
  savePartner,
  upsertPostalCodes,
} from "./lib/partners.mjs";
import { PARTNER_CATEGORIES } from "./lib/partner-categories.mjs";
import { estimateValuation, valuationOptions } from "./lib/valuation.mjs";
import {
  ensureVehicleCatalog,
  getVehicleCatalog,
  catalogSummary,
  listModelTypes,
  listModelYears,
} from "./lib/vehicle-catalog.mjs";
import {
  SESSION_COOKIE,
  changeUserPassword,
  clearSessionCookieHeader,
  deleteUserAccount,
  destroySession,
  getSessionTokenFromRequest,
  countWebUsers,
  inspectWebUsersDb,
  getProfilesFilePath,
  ensureProfilesStore,
  getUserById,
  getUserBySessionToken,
  loginUser,
  registerUser,
  activateUserByToken,
  createActivationForEmail,
  requestPasswordReset,
  resetPasswordByToken,
  findOrCreateOAuthUser,
  saveUserProfile,
  mergeUserProfileJson,
  sessionCookieHeader,
  setUserDisplayName,
} from "./lib/web-users-store.mjs";
import { ensureSmtpExample, isSmtpConfigured, sendMail, smtpConfigPath } from "./lib/mail.mjs";
import {
  appleNameFromForm,
  buildAuthorizeUrl,
  createOAuthState,
  ensureOAuthExample,
  exchangeOAuthCode,
  IOS_OAUTH_CALLBACK,
  isMobileOAuthNext,
  listOAuthProviders,
  loadOAuthConfig,
  mobileOAuthCompleteUrl,
  oauthConfigPath,
  parseOAuthState,
  verifyAppleIdentityToken,
} from "./lib/oauth.mjs";
import { listingImageDir, resolveListingImageFile, fetchRemoteListingImage, clearListingImageFiles } from "./lib/listing-image.mjs";
import { saveListingPhotos } from "./lib/listing-photos.mjs";
import { canManageListing } from "./lib/listing-meta.mjs";
import { handleMessagesApi, initMessagingSchema } from "./lib/messaging.mjs";
import { handleLevel1Api } from "./lib/level1-api.mjs";
import { getLevel1TokenFromRequest, getLevel1AdminBySession } from "./lib/level1.mjs";
import { safeInternalPath } from "./lib/safe-path.mjs";
import { rateLimit, clientIp } from "./lib/rate-limit.mjs";
import { applySecurityHeaders } from "./lib/security-headers.mjs";
import { recordPageVisit, visitorCookieHeader } from "./lib/site-visitors.mjs";
import { isIpBlocked } from "./lib/site-ip-blocks.mjs";
import { enforceMembersGate } from "./lib/site-gate.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "public");
const PORT = Number(process.env.PORT ?? 3456);
const HOST = "127.0.0.1";

function assertAuthRate(req, res, bucket, { limit = 12, windowMs = 15 * 60 * 1000 } = {}) {
  const ip = clientIp(req);
  const result = rateLimit(`${bucket}:${ip}`, { limit, windowMs });
  if (!result.ok) {
    sendJson(
      res,
      429,
      { error: "Túl sok kísérlet. Próbáld újra később." },
      { "Retry-After": String(result.retryAfterSec || 60) }
    );
    return false;
  }
  return true;
}

function adminBypassBlockedIp(pathname) {
  if (pathname.startsWith("/api/level1")) return true;
  if (pathname === "/Bocsatech.html") return true;
  if (/^\/(css|js)\/bocsatech/.test(pathname)) return true;
  if (/^\/js\/(bocsatech|ingatlan-wheel-schema)/.test(pathname)) return true;
  return false;
}

async function rejectBlockedIp(req, res, pathname) {
  if (adminBypassBlockedIp(pathname)) return false;
  const ip = clientIp(req);
  if (!(await isIpBlocked(ip))) return false;
  if (pathname.startsWith("/api/")) {
    sendJson(res, 403, { error: "Hozzáférés megtagadva." });
  } else {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Hozzáférés megtagadva.");
  }
  return true;
}

function publicBaseUrl(req) {
  const fromEnv = String(process.env.PUBLIC_BASE_URL ?? "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const vercel = String(process.env.VERCEL_URL ?? "").trim().replace(/\/$/, "");
  if (vercel) return `https://${vercel}`;
  const forwardedHost = req?.headers?.["x-forwarded-host"];
  if (forwardedHost) {
    const proto = String(req.headers["x-forwarded-proto"] ?? "https").split(",")[0].trim();
    return `${proto}://${String(forwardedHost).split(",")[0].trim()}`;
  }
  return `http://${HOST}:${PORT}`;
}

let fugvenyBusy = false;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

let importRunning = false;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parseFormBody(raw) {
  const params = new URLSearchParams(raw || "");
  const out = {};
  for (const [key, value] of params.entries()) out[key] = value;
  return out;
}

function sendRedirect(res, location, headers = {}) {
  applySecurityHeaders(res);
  res.writeHead(302, { Location: location, ...headers });
  res.end();
}

async function handleMediaProxy(req, res) {
  try {
    const urlObj = new URL(req.url ?? "", `http://${HOST}:${PORT}`);
    const target = urlObj.searchParams.get("url");
    if (!target) {
      sendJson(res, 400, { error: "Hiányzó url paraméter." });
      return;
    }
    const { buffer, contentType } = await fetchRemoteListingImage(target);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      "Content-Length": String(buffer.length),
    });
    res.end(buffer);
  } catch (error) {
    const status = error.code === "FORBIDDEN_IMAGE" ? 403 : 502;
    sendJson(res, status, { error: error.message ?? "Kép proxy hiba." });
  }
}

function sendJson(res, status, data, headers = {}) {
  applySecurityHeaders(res);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(data));
}

const HA_IMPORT_ORIGINS = new Set([
  "https://www.hasznaltauto.hu",
  "https://hasznaltauto.hu",
  "https://admin.hasznaltauto.hu",
]);

function haImportCorsHeaders(req) {
  const origin = String(req.headers.origin ?? "").trim();
  if (!HA_IMPORT_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function serveStatic(path, res) {
  applySecurityHeaders(res);
  const rel = path === "/" ? "index.html" : path.replace(/^\//, "");

  // Hirdetésképek: ~/.autosweb/uploads (túléli a frissítést)
  if (rel.startsWith("uploads/listings/")) {
    const uploadFile = resolveListingImageFile(`/${rel}`);
    if (uploadFile) {
      const ext = extname(uploadFile);
      res.writeHead(200, {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      });
      res.end(readFileSync(uploadFile));
      return;
    }
  }

  // Hub promo (kezdőlap téglalapok)
  if (rel.startsWith("uploads/hub-promo/")) {
    const uploadFile = resolveHubPromoFile(`/${rel}`);
    if (uploadFile) {
      const ext = extname(uploadFile);
      res.writeHead(200, {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      });
      res.end(readFileSync(uploadFile));
      return;
    }
  }

  // Hero feltöltések: data/images/{pkw,lkw} (régi URL: /uploads/hero/…)
  if (rel.startsWith("uploads/hero/")) {
    const uploadFile = resolveHeroUploadFile(`/${rel}`);
    if (uploadFile) {
      const ext = extname(uploadFile);
      res.writeHead(200, {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      });
      res.end(readFileSync(uploadFile));
      return;
    }
  }

  // Szerver oldali képkönyvtár: data/images/pkw és data/images/lkw
  if (rel.startsWith("images/pkw/") || rel.startsWith("images/lkw/")) {
    const serverFile = resolveServerImageFile(`/${rel}`);
    if (serverFile) {
      const ext = extname(serverFile);
      res.writeHead(200, {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      });
      res.end(readFileSync(serverFile));
      return;
    }
  }

  const filePath = join(PUBLIC, rel);
  if (!filePath.startsWith(PUBLIC) || !existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 — nem található");
    return;
  }
  const ext = extname(filePath);
  if (ext === ".html") {
    let html = readFileSync(filePath, "utf8");
    if (html.includes("<!-- AD_FORM -->")) {
      const partialPath = join(PUBLIC, "partials", "ad-form.html");
      if (existsSync(partialPath)) {
        html = html.replace("<!-- AD_FORM -->", readFileSync(partialPath, "utf8"));
      }
    }
    if (html.includes("<!-- HOME_SEARCH_SIDEBAR -->")) {
      html = html.replace(
        "<!-- HOME_SEARCH_SIDEBAR -->",
        readFileSync(join(PUBLIC, "partials", "home-search-sidebar.html"), "utf8")
      );
    }
    if (html.includes("<!-- SITE_SIDE_LEFT -->")) {
      html = html.replace(
        "<!-- SITE_SIDE_LEFT -->",
        readFileSync(join(PUBLIC, "partials", "site-side-left.html"), "utf8")
      );
    }
    if (html.includes("<!-- SITE_SIDE_RIGHT -->")) {
      html = html.replace(
        "<!-- SITE_SIDE_RIGHT -->",
        readFileSync(join(PUBLIC, "partials", "site-side-right.html"), "utf8")
      );
    }
    if (html.includes("<!-- SITE_SIDE_CONTROLS -->")) {
      html = html.replace(
        "<!-- SITE_SIDE_CONTROLS -->",
        readFileSync(join(PUBLIC, "partials", "site-side-controls.html"), "utf8")
      );
    }
    res.writeHead(200, {
      "Content-Type": MIME[".html"],
      "Cache-Control": "no-store, no-cache, must-revalidate",
    });
    res.end(html);
    return;
  }
  res.writeHead(200, {
    "Content-Type": MIME[ext] ?? "application/octet-stream",
    "Cache-Control": "no-store, no-cache, must-revalidate",
  });
  res.end(readFileSync(filePath));
}

async function handleOpenChrome(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: "Érvénytelen JSON." });
    return;
  }

  const url = String(body.url ?? "https://www.hasznaltauto.hu/szemelyauto").trim();
  const logs = [];

  try {
    const { openChromeForImport } = await import("./lib/import-listings.mjs");
    await openChromeForImport(url, {
      onProgress: (message) => logs.push(message),
    });
    sendJson(res, 200, { ok: true, logs, chrome: findChromeExecutable() });
  } catch (error) {
    sendJson(res, 500, {
      error: error.message ?? String(error),
      logs,
      chrome: findChromeExecutable(),
    });
  }
}

async function handleImportDiscover(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: "Érvénytelen JSON." });
    return;
  }
  try {
    const { discoverFromHtml } = await import("./lib/import-client.mjs");
    const html = String(body.html ?? body.listHtml ?? "");
    const pageUrl = String(body.pageUrl ?? body.listUrl ?? "");
    const discovered = discoverFromHtml(html, pageUrl);
    sendJson(res, 200, { ok: true, ...discovered });
  } catch (error) {
    sendJson(res, 400, { error: error.message ?? String(error) });
  }
}

async function handleImportExtracted(req, res) {
  const cors = haImportCorsHeaders(req);
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  const user = await requestUser(req);
  if (!user) {
    sendJson(res, 401, { error: "Az importhoz be kell jelentkezned a Bymy fiókodba." }, cors);
    return;
  }
  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: "Érvénytelen JSON." }, cors);
    return;
  }

  try {
    const { pageFromPublicUrl, saveExtractedPages, MAX_IMPORT_BATCH } = await import("./lib/ha-import-save.mjs");
    const pages = [];
    if (Array.isArray(body.pages)) pages.push(...body.pages);
    if (body.page && typeof body.page === "object") pages.push(body.page);

    const urls = [
      ...(Array.isArray(body.urls) ? body.urls : []),
      body.url ? body.url : "",
    ]
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);

    for (const url of urls.slice(0, MAX_IMPORT_BATCH - pages.length)) {
      pages.push(await pageFromPublicUrl(url));
    }

    if (!pages.length) {
      sendJson(res, 400, { error: "Adj meg hirdetés URL-t, vagy importáld a megnyitott oldalt a könyvjelzővel." }, cors);
      return;
    }

    const result = await saveExtractedPages({
      pages,
      userId: user.id,
      limit: body.limit ?? MAX_IMPORT_BATCH,
    });
    sendJson(res, 200, { ok: true, result }, cors);
  } catch (error) {
    if (error.importResult) {
      sendJson(res, 400, { error: error.message ?? String(error), result: error.importResult }, cors);
      return;
    }
    sendJson(res, 400, { error: error.message ?? String(error) }, cors);
  }
}

async function handleImportClient(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: "Érvénytelen JSON." });
    return;
  }
  try {
    const { importFromClient } = await import("./lib/import-client.mjs");
    const result = await importFromClient({
      listHtml: body.listHtml,
      listUrl: body.listUrl,
      listings: body.listings,
      autoSave: body.autoSave !== false,
      limit: body.limit,
      visibleTitle: body.visibleTitle,
      visibleImage: body.visibleImage,
      visibleDescription: body.visibleDescription,
    });
    sendJson(res, 200, { ok: true, result });
  } catch (error) {
    sendJson(res, 400, { error: error.message ?? String(error) });
  }
}

async function handleImport(req, res) {
  if (importRunning) {
    sendJson(res, 409, { error: "Már fut egy import." });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: "Érvénytelen JSON." });
    return;
  }

  const url = String(body.url ?? "").trim();
  if (!url) {
    sendJson(res, 400, { error: "Adj meg hasznaltauto.hu lista- vagy hirdetés URL-t." });
    return;
  }

  importRunning = true;
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-store",
    Connection: "keep-alive",
  });

  const send = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const { importListings } = await import("./lib/import-listings.mjs");
    const result = await importListings(url, {
      limit: body.limit ?? 20,
      autoSave: body.autoSave !== false,
      onProgress: (message) => send({ type: "log", message }),
    });
    send({ type: "done", result });
  } catch (error) {
    send({ type: "error", message: error.message ?? String(error) });
  } finally {
    importRunning = false;
    res.end();
  }
}

async function requestUser(req) {
  return getUserBySessionToken(getSessionTokenFromRequest(req));
}

async function handleListingsApi(req, res, pathname) {
  const latestMatch = pathname === "/api/listings/latest";
  const listMatch = pathname === "/api/listings";
  const batchMatch = pathname === "/api/listings/batch";
  const idMatch = pathname.match(/^\/api\/listings\/(\d+)$/);

  if (pathname === "/api/db/stats" && req.method === "GET") {
    sendJson(res, 200, await dbStats());
    return;
  }

  if (pathname === "/api/field-defs" && req.method === "GET") {
    sendJson(res, 200, { fields: await listFieldDefs() });
    return;
  }

  if (latestMatch && req.method === "GET") {
    sendJson(res, 200, { listing: await getLatestListing() });
    return;
  }

  const mineRequested =
    (pathname === "/api/listings/mine" && req.method === "GET") ||
    (listMatch && req.method === "GET" && new URL(req.url ?? "", `http://${HOST}`).searchParams.get("mine") === "1");
  if (mineRequested) {
    const user = await requestUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Nem vagy bejelentkezve." });
      return;
    }
    const url = new URL(req.url ?? "", `http://${HOST}`);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 200), 1), 500);
    sendJson(res, 200, { listings: await listMyListings({ userId: user.id, limit }) });
    return;
  }

  if (listMatch && req.method === "GET") {
    const url = new URL(req.url ?? "", `http://${HOST}`);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 50);
    const status = url.searchParams.get("status");
    const vertical = url.searchParams.get("vertical");
    sendJson(res, 200, { listings: await listListingsWithPreview({ limit, status, vertical }) });
    return;
  }

  const viewMatch = pathname.match(/^\/api\/listings\/(\d+)\/view$/);
  if (viewMatch && req.method === "POST") {
    let body = {};
    try {
      body = await readBody(req);
    } catch {
      body = {};
    }
    const source = body.source === "app" ? "app" : "web";
    const listing = await recordListingView(Number(viewMatch[1]), source);
    if (!listing) {
      sendJson(res, 404, { error: "Nincs ilyen hirdetés." });
      return;
    }
    sendJson(res, 200, {
      views: listing.views,
      views_web: listing.views_web,
      views_app: listing.views_app,
    });
    return;
  }

  const photosMatch = pathname.match(/^\/api\/listings\/(\d+)\/photos$/);
  if (photosMatch && req.method === "DELETE") {
    const user = await requestUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Nem vagy bejelentkezve." });
      return;
    }
    const listing = await getListing(Number(photosMatch[1]));
    if (!listing) {
      sendJson(res, 404, { error: "Nincs ilyen hirdetés." });
      return;
    }
    if (!canManageListing(listing, user)) {
      sendJson(res, 403, { error: "Ezt a hirdetést nem módosíthatod." });
      return;
    }
    try {
      const updated = await clearListingPhotos(listing.id);
      sendJson(res, 200, { listing: updated });
    } catch (error) {
      sendJson(res, 500, { error: error.message ?? "A képek törlése sikertelen." });
    }
    return;
  }

  if (photosMatch && req.method === "POST") {
    const user = await requestUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Nem vagy bejelentkezve." });
      return;
    }
    const listing = await getListing(Number(photosMatch[1]));
    if (!listing) {
      sendJson(res, 404, { error: "Nincs ilyen hirdetés." });
      return;
    }
    if (!canManageListing(listing, user)) {
      sendJson(res, 403, { error: "Ezt a hirdetést nem módosíthatod." });
      return;
    }
    if (!listing.form?.owner_user_id && user.id) {
      await updateListingStatus(listing.id, listing.status, user.id);
    }
    let body;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { error: "Érvénytelen JSON." });
      return;
    }
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) {
      sendJson(res, 400, { error: "Legalább egy kép kell." });
      return;
    }
    try {
      const urls = [];
      for (const item of items) {
        const existing = String(item?.url ?? "").trim();
        if (existing) {
          urls.push(existing);
          continue;
        }
        if (!item?.data) continue;
        const uploaded = await saveListingPhotos(listing.id, [item.data]);
        if (uploaded[0]) urls.push(uploaded[0]);
      }
      if (!urls.length) {
        sendJson(res, 400, { error: "A képek mentése sikertelen." });
        return;
      }
      const updated = await updateListingPhotoUrls(listing.id, urls);
      sendJson(res, 200, { listing: updated });
    } catch (error) {
      sendJson(res, 500, { error: error.message ?? "A kép mentése sikertelen." });
    }
    return;
  }

  if (idMatch && req.method === "PATCH") {
    const user = await requestUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Nem vagy bejelentkezve." });
      return;
    }
    const listing = await getListing(Number(idMatch[1]));
    if (!listing) {
      sendJson(res, 404, { error: "Nincs ilyen hirdetés." });
      return;
    }
    if (!canManageListing(listing, user)) {
      sendJson(res, 403, { error: "Ezt a hirdetést nem módosíthatod." });
      return;
    }
    let body;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { error: "Érvénytelen JSON." });
      return;
    }
    if (body.status) {
      const updated = await updateListingStatus(listing.id, body.status, user.id);
      sendJson(res, 200, { listing: updated });
      return;
    }
    sendJson(res, 400, { error: "Nincs módosítható mező." });
    return;
  }

  if (idMatch && req.method === "GET") {
    const url = new URL(req.url ?? "", `http://${HOST}`);
    const mode = url.searchParams.get("view") === "detail" ? "detail" : "full";
    const listing = await getListing(Number(idMatch[1]), { mode });
    if (!listing) {
      sendJson(res, 404, { error: "Nincs ilyen hirdetés." });
      return;
    }
    sendJson(res, 200, { listing });
    return;
  }

  if (batchMatch && req.method === "POST") {
    let body;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { error: "Érvénytelen JSON." });
      return;
    }

    const forms = Array.isArray(body.forms) ? body.forms : Array.isArray(body.items) ? body.items : null;
    if (!forms?.length) {
      sendJson(res, 400, { error: "Hiányzó hirdetés lista (forms)." });
      return;
    }
    if (forms.length > 80) {
      sendJson(res, 400, { error: "Egyszerre max. 80 hirdetés menthető." });
      return;
    }

    const status = body.status ?? "feladott";
    const results = [];
    let savedCount = 0;
    let skippedCount = 0;

    for (const formData of forms) {
      if (!formData || typeof formData !== "object") {
        results.push({ skipped: true, reason: "invalid" });
        skippedCount += 1;
        continue;
      }
      const sourceUrl = String(formData.forras_url || "").trim();
      const hasznaltautoId = String(formData.hasznaltauto_hirdetes_id || "").trim();
      if (await listingSourceExists({ sourceUrl, hasznaltautoId })) {
        results.push({ skipped: true, reason: "duplicate", forras_url: sourceUrl });
        skippedCount += 1;
        continue;
      }
      const saved = await saveListing(formData, null, { status });
      results.push({ skipped: false, listing: saved });
      savedCount += 1;
    }

    sendJson(res, 200, { savedCount, skippedCount, count: forms.length, results });
    return;
  }

  if (listMatch && req.method === "POST") {
    let body;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { error: "Érvénytelen JSON." });
      return;
    }

    const formData = body.form ?? body;
    const listingId = body.id != null ? Number(body.id) : null;
    if (!formData || typeof formData !== "object") {
      sendJson(res, 400, { error: "Hiányzó űrlap adat." });
      return;
    }

    try {
      const user = await requestUser(req);
      if (listingId) {
        const existing = await getListing(listingId);
        if (!existing) {
          sendJson(res, 404, { error: "Nincs ilyen hirdetés." });
          return;
        }
        if (!user) {
          sendJson(res, 401, { error: "Nem vagy bejelentkezve." });
          return;
        }
        if (!canManageListing(existing, user)) {
          sendJson(res, 403, { error: "Ezt a hirdetést nem módosíthatod." });
          return;
        }
      } else {
        if (!user) {
          sendJson(res, 401, { error: "Nem vagy bejelentkezve." });
          return;
        }
        const sourceUrl = String(formData.forras_url || "").trim();
        const hasznaltautoId = String(formData.hasznaltauto_hirdetes_id || "").trim();
        if (sourceUrl || hasznaltautoId) {
          if (await listingSourceExists({ sourceUrl, hasznaltautoId })) {
            sendJson(res, 409, { error: "Ez a hirdetés már bent van." });
            return;
          }
        }
      }
      let saved = await saveListing(formData, listingId, {
        status: body.status,
        userId: user?.id ?? null,
      });
      if (!saved) {
        sendJson(res, 404, { error: "Nincs ilyen hirdetés." });
        return;
      }

      const photos = Array.isArray(body.photos) ? body.photos : [];
      if (photos.length) {
        try {
          const urls = await saveListingPhotos(saved.id, photos);
          if (!urls[0]) {
            sendJson(res, 400, {
              error: "A képek mentése sikertelen. JPG, PNG vagy WebP kell, max. 8 MB / kép.",
              listing: saved,
            });
            return;
          }
          const updated = await updateListingPhotoUrls(saved.id, urls);
          if (updated) saved = updated;
          else saved = { ...saved, fo_kep: urls[0] };
          saved = {
            ...saved,
            preview: {
              ...(saved.preview || {}),
              imageUrl: urls[0],
              imageUrls: urls,
            },
          };
        } catch (error) {
          console.warn("Hirdetéskép mentés:", error.message ?? error);
          sendJson(res, 500, {
            error: `A kép mentése sikertelen: ${error.message ?? error}`,
            listing: saved,
          });
          return;
        }
      }

      sendJson(res, 200, { listing: saved });
    } catch (error) {
      console.warn("Hirdetés mentés:", error.message ?? error);
      sendJson(res, 500, { error: error.message ?? "A hirdetés mentése sikertelen." });
    }
    return;
  }

  if (pathname === "/api/listings/all" && req.method === "DELETE") {
    const user = await requestUser(req);
    if (!user) {
      sendJson(res, 401, { error: "Nem vagy bejelentkezve." });
      return;
    }
    const mine = await listMyListings({ userId: user.id, limit: 500 });
    let deleted = 0;
    for (const listing of mine) {
      if (!canManageListing(listing, user)) continue;
      await deleteListing(listing.id);
      deleted += 1;
    }
    sendJson(res, 200, { ok: true, deleted, imagesRemoved: 0 });
    return;
  }

  if (idMatch && req.method === "DELETE") {
    try {
      const user = await requestUser(req);
      if (!user) {
        sendJson(res, 401, { error: "Nem vagy bejelentkezve." });
        return;
      }
      const listing = await getListing(Number(idMatch[1]));
      if (!listing) {
        sendJson(res, 404, { error: "Nincs ilyen hirdetés." });
        return;
      }
      if (!canManageListing(listing, user)) {
        sendJson(res, 403, { error: "Ezt a hirdetést nem törölheted." });
        return;
      }
      await deleteListing(listing.id);
      sendJson(res, 200, { ok: true });
    } catch (error) {
      console.warn("Hirdetés törlés:", error.message ?? error);
      sendJson(res, 500, { error: "A törlés sikertelen. Próbáld újra." });
    }
    return;
  }

  sendJson(res, 405, { error: "Nem támogatott művelet." });
}

async function handleFugvenyApi(req, res, pathname) {
  try {
    if (pathname === "/api/fugveny/lists" && req.method === "GET") {
      sendJson(res, 200, listFugvenyLists());
      return;
    }

    if (pathname === "/api/fugveny/queries" && req.method === "GET") {
      sendJson(res, 200, { queries: loadQueries() });
      return;
    }

    if (pathname === "/api/fugveny/queries" && req.method === "POST") {
      const body = await readBody(req);
      sendJson(res, 200, { query: saveQuery(body) });
      return;
    }

    const delMatch = pathname.match(/^\/api\/fugveny\/queries\/([^/]+)$/);
    if (delMatch && req.method === "DELETE") {
      sendJson(res, 200, deleteQuery(decodeURIComponent(delMatch[1])));
      return;
    }

    if (pathname === "/api/fugveny/queries/run" && req.method === "POST") {
      const body = await readBody(req);
      const id = body.id;
      if (!id) {
        sendJson(res, 400, { error: "Hiányzó lekérdezés id." });
        return;
      }
      const result = runSavedQuery(id);
      if (result.mode === "estimate") {
        const pred = await predictOne(result.params || {});
        sendJson(res, 200, { ...result, prediction: pred });
        return;
      }
      sendJson(res, 200, result);
      return;
    }

    if (pathname === "/api/fugveny/predict" && req.method === "POST") {
      const body = await readBody(req);
      const pred = await predictOne(body);
      sendJson(res, 200, pred);
      return;
    }

    if (pathname === "/api/fugveny/train" && req.method === "POST") {
      if (fugvenyBusy) {
        sendJson(res, 409, { error: "Már fut egy tanítás / pontozás." });
        return;
      }
      const body = await readBody(req);
      if (!body.listId) {
        sendJson(res, 400, { error: "Válassz listát (listId)." });
        return;
      }
      fugvenyBusy = true;
      try {
        const result = await trainFugvenyModel(body);
        sendJson(res, 200, result);
      } finally {
        fugvenyBusy = false;
      }
      return;
    }

    if (pathname === "/api/fugveny/score" && req.method === "POST") {
      if (fugvenyBusy) {
        sendJson(res, 409, { error: "Már fut egy tanítás / pontozás." });
        return;
      }
      const body = await readBody(req);
      if (!body.listId) {
        sendJson(res, 400, { error: "Válassz listát (listId)." });
        return;
      }
      fugvenyBusy = true;
      try {
        const result = await scoreList(body);
        sendJson(res, 200, result);
      } finally {
        fugvenyBusy = false;
      }
      return;
    }

    sendJson(res, 404, { error: "Ismeretlen fugveny API." });
  } catch (error) {
    sendJson(res, 500, { error: error.message ?? String(error) });
  }
}

async function handleVehicleCatalogApi(req, res, pathname) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Csak GET." });
    return;
  }

  const catalog = getVehicleCatalog();
  if (!catalog?.gyartmanyok?.length) {
    sendJson(res, 404, {
      error: "Nincs járműkatalógus. Futtasd: npm run import:catalog -- ~/Desktop/lista.csv",
    });
    return;
  }

  // Márkák + modellek — a típusok nélkül, hogy az oldal gyorsan induljon.
  if (pathname === "/api/vehicle-catalog") {
    sendJson(res, 200, catalogSummary(catalog));
    return;
  }

  // Egy modell évjáratai és típusai.
  if (pathname === "/api/vehicle-catalog/tipusok") {
    const url = new URL(req.url ?? "", `http://${HOST}`);
    const gyartmany = url.searchParams.get("gyartmany") ?? "";
    const modell = url.searchParams.get("modell") ?? "";
    const ev = url.searchParams.get("ev");

    if (!gyartmany || !modell) {
      sendJson(res, 400, { error: "gyartmany és modell kötelező." });
      return;
    }

    sendJson(res, 200, {
      gyartmany,
      modell,
      ev: ev || null,
      evek: listModelYears(catalog, gyartmany, modell),
      tipusok: listModelTypes(catalog, gyartmany, modell, ev),
    });
    return;
  }

  sendJson(res, 404, { error: "Ismeretlen katalógus API." });
}

async function handleValuationApi(req, res, pathname) {
  try {
    if (pathname === "/api/valuation/options" && req.method === "GET") {
      sendJson(res, 200, valuationOptions());
      return;
    }

    if (pathname === "/api/valuation/estimate" && req.method === "GET") {
      const url = new URL(req.url ?? "", `http://${HOST}`);
      const result = estimateValuation({
        gyartmany: url.searchParams.get("gyartmany"),
        modell_tipus: url.searchParams.get("modell_tipus"),
        gyartasi_ev: url.searchParams.get("gyartasi_ev"),
        km: url.searchParams.get("km"),
      });
      if (result.error) {
        sendJson(res, 400, result);
        return;
      }
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 404, { error: "Ismeretlen értékbecslő API." });
  } catch (error) {
    sendJson(res, 500, { error: error.message ?? String(error) });
  }
}

async function handlePartnersApi(req, res, pathname) {
  try {
    const recommendMatch = pathname === "/api/partners/recommendations";

    if (recommendMatch && req.method === "GET") {
      const url = new URL(req.url ?? "", `http://${HOST}`);
      const postalCode = url.searchParams.get("postal_code") ?? url.searchParams.get("iranyitoszam");
      if (!postalCode) {
        sendJson(res, 400, { error: "Hiányzó irányítószám." });
        return;
      }
      sendJson(res, 200, getPartnerRecommendations(postalCode));
      return;
    }

    if (pathname === "/api/partners/categories" && req.method === "GET") {
      sendJson(res, 200, { categories: PARTNER_CATEGORIES });
      return;
    }

    if (pathname === "/api/partners/stats" && req.method === "GET") {
      sendJson(res, 200, partnerStats());
      return;
    }

    if (pathname === "/api/partners" && req.method === "GET") {
      sendJson(res, 200, { partners: listPartners() });
      return;
    }

    if (pathname === "/api/partners/import" && req.method === "POST") {
      let body;
      try {
        body = await readBody(req);
      } catch {
        sendJson(res, 400, { error: "Érvénytelen JSON." });
        return;
      }
      const rows = body.partners ?? body.rows ?? body;
      if (!Array.isArray(rows)) {
        sendJson(res, 400, { error: "Hiányzó partners tömb." });
        return;
      }
      sendJson(res, 200, { results: importPartners(rows) });
      return;
    }

    if (pathname === "/api/postal-codes/lookup" && req.method === "GET") {
      const url = new URL(req.url ?? "", `http://${HOST}`);
      const postalCode = url.searchParams.get("postal_code") ?? url.searchParams.get("iranyitoszam");
      const origin = getPostalCode(postalCode);
      if (!origin) {
        sendJson(res, 404, { error: `Ismeretlen irányítószám: ${postalCode ?? ""}`.trim() });
        return;
      }
      sendJson(res, 200, origin);
      return;
    }

    if (pathname === "/api/postal-codes/cities" && req.method === "GET") {
      sendJson(res, 200, { cities: listPostalCities() });
      return;
    }

    if (pathname === "/api/postal-codes/import" && req.method === "POST") {
      let body;
      try {
        body = await readBody(req);
      } catch {
        sendJson(res, 400, { error: "Érvénytelen JSON." });
        return;
      }
      const rows = body.postal_codes ?? body.rows ?? body;
      if (!Array.isArray(rows)) {
        sendJson(res, 400, { error: "Hiányzó postal_codes tömb." });
        return;
      }
      sendJson(res, 200, upsertPostalCodes(rows));
      return;
    }

    const idMatch = pathname.match(/^\/api\/partners\/(\d+)$/);

    if (idMatch && req.method === "GET") {
      const partner = getPartner(Number(idMatch[1]));
      if (!partner) {
        sendJson(res, 404, { error: "Nincs ilyen partner." });
        return;
      }
      sendJson(res, 200, { partner });
      return;
    }

    if (pathname === "/api/partners" && req.method === "POST") {
      let body;
      try {
        body = await readBody(req);
      } catch {
        sendJson(res, 400, { error: "Érvénytelen JSON." });
        return;
      }
      const partnerId = body.id != null ? Number(body.id) : null;
      try {
        const saved = savePartner(body, partnerId);
        if (!saved) {
          sendJson(res, 404, { error: "Nincs ilyen partner." });
          return;
        }
        sendJson(res, 200, { partner: saved });
      } catch (error) {
        sendJson(res, 400, { error: error.message ?? String(error) });
      }
      return;
    }

    if (idMatch && req.method === "DELETE") {
      deletePartner(Number(idMatch[1]));
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 404, { error: "Ismeretlen partners API." });
  } catch (error) {
    sendJson(res, 500, { error: error.message ?? String(error) });
  }
}

async function sendActivationEmail(email, activationToken, baseUrl) {
  const root = (baseUrl ?? `http://${HOST}:${PORT}`).replace(/\/$/, "");
  const link = `${root}/aktivalas.html?token=${encodeURIComponent(activationToken)}`;
  console.log(`Aktiváló link → ${email}: ${link}`);
  try {
    await sendMail({
      to: email,
      subject: "Add el autod.hu — fiók aktiválása",
      text: `Szia!\n\nAktiváld a fiókodat ezen a linken (24 óráig érvényes):\n${link}\n\nHa nem te regisztráltál, hagyd figyelmen kívül ezt a levelet.\n`,
      html: `<p>Szia!</p><p>Aktiváld a fiókodat (24 óráig érvényes):</p><p><a href="${link}">${link}</a></p><p>Ha nem te regisztráltál, hagyd figyelmen kívül.</p>`,
    });
    return { sent: true, link };
  } catch (error) {
    if (error.code === "SMTP_NOT_CONFIGURED") {
      return { sent: false, link, error: error.message };
    }
    throw error;
  }
}

async function sendPasswordResetEmail(email, resetToken, baseUrl) {
  const root = (baseUrl ?? `http://${HOST}:${PORT}`).replace(/\/$/, "");
  const link = `${root}/jelszo-visszaallitas.html?token=${encodeURIComponent(resetToken)}`;
  console.log(`Jelszó-visszaállítás → ${email}: ${link}`);
  try {
    await sendMail({
      to: email,
      subject: "Bymy — jelszó visszaállítása",
      text: `Szia!\n\nÚj jelszót állíthatsz be ezen a linken (1 óráig érvényes):\n${link}\n\nHa nem te kérted, hagyd figyelmen kívül ezt a levelet.\n`,
      html: `<p>Szia!</p><p>Új jelszót állíthatsz be (1 óráig érvényes):</p><p><a href="${link}">${link}</a></p><p>Ha nem te kérted, hagyd figyelmen kívül.</p>`,
    });
    return { sent: true, link };
  } catch (error) {
    if (error.code === "SMTP_NOT_CONFIGURED") {
      return { sent: false, link, error: error.message };
    }
    throw error;
  }
}

async function handleAuthApi(req, res, pathname) {
  try {
    const token = getSessionTokenFromRequest(req);
    const currentUser = await getUserBySessionToken(token);

    if (pathname === "/api/auth/me" && req.method === "GET") {
      sendJson(res, 200, { user: currentUser });
      return;
    }

    if (pathname === "/api/auth/db" && req.method === "GET") {
      const admin = await getLevel1AdminBySession(getLevel1TokenFromRequest(req));
      if (!admin) {
        sendJson(res, 401, { error: "Admin belépés szükséges." });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        loggedIn: Boolean(currentUser),
        currentEmail: currentUser?.email || null,
        smtpConfigured: isSmtpConfigured(),
        oauthProviders: listOAuthProviders(),
        backend: isSupabaseBackend() ? "supabase" : "sqlite",
      });
      return;
    }

    if (pathname === "/api/auth/oauth/providers" && req.method === "GET") {
      try {
        ensureOAuthExample();
      } catch {
        /* serverless: ignore */
      }
      sendJson(res, 200, {
        providers: listOAuthProviders(),
      });
      return;
    }

    const oauthStartMatch = pathname.match(/^\/api\/auth\/oauth\/start\/(google|apple|facebook)$/);
    if (oauthStartMatch && req.method === "GET") {
      if (!assertAuthRate(req, res, "oauth-start", { limit: 30, windowMs: 15 * 60 * 1000 })) return;
      const provider = oauthStartMatch[1];
      const urlObj = new URL(req.url ?? "", `http://${HOST}:${PORT}`);
      const mobile = urlObj.searchParams.get("mobile") === "1";
      const rawNext = urlObj.searchParams.get("next") || "/hirdetesfeladas.html";
      const next = mobile
        ? IOS_OAUTH_CALLBACK
        : safeInternalPath(rawNext, "/hirdetesfeladas.html");
      try {
        const accountType = urlObj.searchParams.get("accountType") || "";
        const state = createOAuthState(provider, next, undefined, accountType);
        const authorizeUrl = buildAuthorizeUrl(provider, state);
        sendRedirect(res, authorizeUrl);
      } catch (error) {
        const msg = encodeURIComponent(error.message ?? "OAuth indítás sikertelen");
        if (mobile || isMobileOAuthNext(next)) {
          sendRedirect(res, mobileOAuthCompleteUrl({ error: error.message ?? "OAuth indítás sikertelen" }));
        } else {
          sendRedirect(res, `/belepes.html?oauth_error=${msg}`);
        }
      }
      return;
    }

    if (pathname === "/api/auth/oauth/native" && req.method === "POST") {
      const body = await readBody(req);
      const provider = String(body.provider ?? "").trim().toLowerCase();
      try {
        if (provider !== "apple") {
          throw new Error("Ez a social belépés az appban Safari-n keresztül megy.");
        }
        const identity = await verifyAppleIdentityToken(body.identityToken ?? body.id_token);
        const fullName = String(body.fullName ?? body.name ?? "").trim();
        if (fullName) identity.name = fullName;
        const { user, session } = await findOrCreateOAuthUser(identity);
        sendJson(
          res,
          200,
          { ok: true, token: session.token, user },
          { "Set-Cookie": sessionCookieHeader(session.token, session.expires) }
        );
      } catch (error) {
        sendJson(res, 400, { error: error.message ?? "Social belépés sikertelen." });
      }
      return;
    }

    const oauthCbMatch = pathname.match(/^\/api\/auth\/oauth\/callback\/(google|apple|facebook)$/);
    if (oauthCbMatch && (req.method === "GET" || req.method === "POST")) {
      const provider = oauthCbMatch[1];
      let params = {};
      try {
        if (req.method === "POST") {
          const raw = await readRawBody(req);
          const type = String(req.headers["content-type"] || "");
          if (type.includes("application/json")) {
            params = raw ? JSON.parse(raw) : {};
          } else {
            params = parseFormBody(raw);
          }
        } else {
          const urlObj = new URL(req.url ?? "", `http://${HOST}:${PORT}`);
          params = Object.fromEntries(urlObj.searchParams.entries());
        }

        if (params.error) {
          throw new Error(params.error_description || params.error);
        }

        const stateInfo = parseOAuthState(params.state, provider);
        const identity = await exchangeOAuthCode(provider, params.code);
        if (provider === "apple") {
          const appleName = appleNameFromForm(params.user);
          if (appleName && !identity.name) identity.name = appleName;
        }

        const { user, session } = await findOrCreateOAuthUser({
          ...identity,
          accountType: stateInfo.accountType,
        });
        if (stateInfo.mobile || isMobileOAuthNext(stateInfo.next)) {
          sendRedirect(res, mobileOAuthCompleteUrl({ token: session.token }), {
            "Set-Cookie": sessionCookieHeader(session.token, session.expires),
          });
        } else {
          const nextPath = safeInternalPath(stateInfo.next, "/hirdetesfeladas.html");
          sendRedirect(res, nextPath, {
            "Set-Cookie": sessionCookieHeader(session.token, session.expires),
          });
        }
        console.log(`OAuth OK (${provider}): ${user.email}`);
      } catch (error) {
        const msg = encodeURIComponent(error.message ?? "OAuth sikertelen");
        let mobile = false;
        try {
          mobile = Boolean(parseOAuthState(params.state).mobile);
        } catch {
          mobile = false;
        }
        if (mobile) {
          sendRedirect(res, mobileOAuthCompleteUrl({ error: error.message ?? "OAuth sikertelen" }));
        } else {
          sendRedirect(res, `/belepes.html?oauth_error=${msg}`);
        }
        console.warn("OAuth hiba:", error.message ?? error);
      }
      return;
    }

    if (pathname === "/api/auth/register" && req.method === "POST") {
      if (!assertAuthRate(req, res, "register", { limit: 8, windowMs: 60 * 60 * 1000 })) return;
      const body = await readBody(req);
      const registered = await registerUser(
        body.email,
        body.password,
        body.passwordConfirm ?? body.password_confirm,
        body.accountType ?? body.account_type
      );
      const siteRoot = publicBaseUrl(req);

      // Felhő + nincs SMTP: azonnal aktiválás (iOS app token + user mezőt vár).
      if (isSupabaseBackend() && !isSmtpConfigured()) {
        const { user, session } = await activateUserByToken(registered.activationToken);
        sendJson(
          res,
          200,
          {
            ok: true,
            needsActivation: false,
            email: registered.email,
            user,
            token: session.token,
            message: "Regisztráció sikeres.",
          },
          { "Set-Cookie": sessionCookieHeader(session.token, session.expires) }
        );
        return;
      }

      let mail = { sent: false, link: null, error: null };
      try {
        mail = await sendActivationEmail(registered.email, registered.activationToken, siteRoot);
      } catch (error) {
        mail = {
          sent: false,
          link: `${siteRoot}/aktivalas.html?token=${encodeURIComponent(registered.activationToken)}`,
          error: error.message,
        };
        console.warn("Aktiváló email hiba:", error.message ?? error);
      }
      sendJson(res, 200, {
        ok: true,
        needsActivation: true,
        email: registered.email,
        emailSent: mail.sent,
        activationLink: mail.sent ? undefined : mail.link,
        message: mail.sent
          ? `Küldtünk aktiváló emailt ide: ${registered.email}`
          : mail.error
            ? `Regisztráció OK, de az email nem ment ki (${mail.error}). Használd a linket / terminál logot.`
            : `SMTP nincs beállítva. Aktiváló link (terminálban is): ${mail.link}`,
      });
      return;
    }

    if (pathname === "/api/auth/activate" && req.method === "POST") {
      const body = await readBody(req);
      const { user, session } = await activateUserByToken(body.token);
      sendJson(
        res,
        200,
        { ok: true, user, token: session.token },
        { "Set-Cookie": sessionCookieHeader(session.token, session.expires) }
      );
      return;
    }

    if (pathname === "/api/auth/resend-activation" && req.method === "POST") {
      if (!assertAuthRate(req, res, "resend-activation", { limit: 5, windowMs: 60 * 60 * 1000 })) return;
      const body = await readBody(req);
      const created = await createActivationForEmail(body.email);
      let mail;
      try {
        mail = await sendActivationEmail(created.email, created.activationToken, publicBaseUrl(req));
      } catch (error) {
        sendJson(res, 502, { error: `Email küldés sikertelen: ${error.message}` });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        email: created.email,
        emailSent: mail.sent,
        activationLink: mail.sent ? undefined : mail.link,
        message: mail.sent
          ? `Új aktiváló emailt küldtünk: ${created.email}`
          : `SMTP nincs beállítva. Link: ${mail.link}`,
      });
      return;
    }

    if (pathname === "/api/auth/forgot-password" && req.method === "POST") {
      if (!assertAuthRate(req, res, "forgot-password", { limit: 5, windowMs: 60 * 60 * 1000 })) return;
      const body = await readBody(req);
      const result = await requestPasswordReset(body.email);
      const generic =
        "Ha van ilyen email-jelszavas fiók, küldtünk visszaállító linket. Nézd a spam mappát is.";
      let mail = { sent: false, link: null, error: null };
      if (result.resetToken) {
        try {
          mail = await sendPasswordResetEmail(result.email, result.resetToken, publicBaseUrl(req));
        } catch (error) {
          mail = {
            sent: false,
            link: `${publicBaseUrl(req)}/jelszo-visszaallitas.html?token=${encodeURIComponent(result.resetToken)}`,
            error: error.message,
          };
          console.warn("Jelszó-visszaállító email hiba:", error.message ?? error);
        }
      }
      sendJson(res, 200, {
        ok: true,
        message: mail.sent ? generic : result.resetToken ? `${generic} (SMTP hiba — link a válaszban.)` : generic,
        emailSent: mail.sent,
        resetLink: mail.sent || !result.resetToken ? undefined : mail.link,
      });
      return;
    }

    if (pathname === "/api/auth/reset-password" && req.method === "POST") {
      if (!assertAuthRate(req, res, "reset-password", { limit: 8, windowMs: 60 * 60 * 1000 })) return;
      const body = await readBody(req);
      await resetPasswordByToken(
        body.token,
        body.password,
        body.passwordConfirm ?? body.password_confirm
      );
      sendJson(res, 200, {
        ok: true,
        message: "Az új jelszó mentve. Most már beléphetsz vele.",
      });
      return;
    }

    if (pathname === "/api/auth/login" && req.method === "POST") {
      if (!assertAuthRate(req, res, "login", { limit: 15, windowMs: 15 * 60 * 1000 })) return;
      const body = await readBody(req);
      try {
        const emailKey = String(body.email ?? "").trim().toLowerCase();
        if (emailKey) {
          const emailRl = rateLimit(`login-email:${emailKey}`, { limit: 10, windowMs: 15 * 60 * 1000 });
          if (!emailRl.ok) {
            sendJson(
              res,
              429,
              { error: "Túl sok sikertelen kísérlet. Próbáld újra később." },
              { "Retry-After": String(emailRl.retryAfterSec || 60) }
            );
            return;
          }
        }
        const skipActivation = isSupabaseBackend() && !isSmtpConfigured();
        const { user, session } = await loginUser(body.email, body.password, { skipActivationCheck: skipActivation });
        sendJson(
          res,
          200,
          { user, token: session.token },
          { "Set-Cookie": sessionCookieHeader(session.token, session.expires) }
        );
      } catch (error) {
        if (error.code === "EMAIL_NOT_VERIFIED") {
          sendJson(res, 403, { error: error.message, code: "EMAIL_NOT_VERIFIED", email: body.email });
          return;
        }
        throw error;
      }
      return;
    }

    if (pathname === "/api/auth/logout" && req.method === "POST") {
      await destroySession(token);
      sendJson(res, 200, { ok: true }, { "Set-Cookie": clearSessionCookieHeader() });
      return;
    }

    if (pathname === "/api/auth/password" && req.method === "POST") {
      if (!currentUser) {
        sendJson(res, 401, { error: "Nem vagy bejelentkezve." });
        return;
      }
      const body = await readBody(req);
      await changeUserPassword(
        currentUser.id,
        body.currentPassword ?? body.current_password,
        body.newPassword ?? body.new_password,
        body.newPasswordConfirm ?? body.new_password_confirm
      );
      sendJson(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/auth/profile" && req.method === "GET") {
      if (!currentUser) {
        sendJson(res, 401, { error: "Nem vagy bejelentkezve." });
        return;
      }
      sendJson(res, 200, {
        user: currentUser,
        profile: currentUser.profile,
        displayName: currentUser.displayName,
      });
      return;
    }

    if (pathname === "/api/auth/avatar" && req.method === "PUT") {
      if (!currentUser) {
        sendJson(res, 401, { error: "Nem vagy bejelentkezve." });
        return;
      }
      const body = await readBody(req);
      const avatarDataUrl = String(body.avatarDataUrl ?? "").trim();
      const user = await mergeUserProfileJson(currentUser.id, { avatarDataUrl });
      sendJson(res, 200, { ok: true, user });
      return;
    }

    if (pathname === "/api/auth/prefs" && req.method === "PUT") {
      if (!currentUser) {
        sendJson(res, 401, { error: "Nem vagy bejelentkezve." });
        return;
      }
      const body = await readBody(req);
      const pageLayout = body.pageLayout ?? body.page_layout ?? null;
      const user = await mergeUserProfileJson(currentUser.id, { pageLayout });
      sendJson(res, 200, { ok: true, user, token });
      return;
    }

    if (pathname === "/api/auth/profile" && req.method === "PUT") {
      if (!currentUser) {
        sendJson(res, 401, { error: "Nem vagy bejelentkezve. Jelentkezz be újra." });
        return;
      }
      const body = await readBody(req);
      if (body.displayName !== undefined && body.profile === undefined) {
        const displayName = await setUserDisplayName(currentUser.id, body.displayName);
        const user = await getUserById(currentUser.id);
        sendJson(res, 200, { displayName, user, token });
        return;
      }
      const saved = await saveUserProfile(currentUser.id, body.profile ?? body);
      const { _savedTo, ...profile } = saved;
      const user = await getUserById(currentUser.id);
      const p = user?.profile;
      const savedOk =
        p?.accountType === "business"
          ? Boolean(String(p?.company || "").trim() || String(p?.companyTaxId || "").trim() || p?.firstName)
          : Boolean(p?.firstName);
      if (!savedOk) {
        sendJson(res, 500, { error: "A mentés nem íródott a helyi adatbázisba." });
        return;
      }
      console.log(
        `Profil mentve → ${_savedTo || getProfilesFilePath()} | ${currentUser.email} | ${profile.firstName} ${profile.lastName}`
      );
      sendJson(res, 200, {
        profile,
        user,
        token,
        savedTo: _savedTo || getProfilesFilePath(),
      });
      return;
    }

    if (pathname === "/api/auth/account" && req.method === "DELETE") {
      if (!currentUser) {
        sendJson(res, 401, { error: "Nem vagy bejelentkezve." });
        return;
      }
      await deleteUserAccount(currentUser.id);
      sendJson(res, 200, { ok: true }, { "Set-Cookie": clearSessionCookieHeader() });
      return;
    }

    sendJson(res, 404, { error: "Ismeretlen auth API." });
  } catch (error) {
    const message = error.message ?? String(error);
    const status =
      message.includes("bejelentkezve") || message.includes("Hibás")
        ? 401
        : message.includes("már regisztrálva") || message.includes("kötelező") || message.includes("egyezik")
          ? 400
          : 400;
    sendJson(res, status, { error: message });
  }
}

export async function handleHttpRequest(req, res) {
  const pathname = req.url?.split("?")[0] || "/";

  if (req.method === "OPTIONS" && pathname.startsWith("/api/import")) {
    await handleImportExtracted(req, res);
    return;
  }

  if (pathname === "/api/health" && req.method === "GET") {
    let users = 0;
    let dbPath = "";
    let profilesPath = "";
    try {
      dbPath = await getDbPath();
      users = await countWebUsers();
      profilesPath = getProfilesFilePath();
    } catch {
      /* ignore */
    }
    sendJson(res, 200, {
      ok: true,
      version: readFileSync(join(PUBLIC, "version.txt"), "utf8").trim(),
      chrome: findChromeExecutable(),
      dbPath,
      profilesPath,
      users,
      backend: isSupabaseBackend() ? "supabase" : "sqlite",
      service: "bymy-autosweb",
      listingsMine: true,
    });
    return;
  }

  if (await rejectBlockedIp(req, res, pathname)) return;

  const gate = await enforceMembersGate(req, res, pathname, {
    getUserBySessionToken,
    getSessionTokenFromRequest,
    sendJson,
    sendRedirect,
  });
  if (!gate.allowed) return;

  if (pathname === "/api/visit" && req.method === "POST") {
    if (!assertAuthRate(req, res, "visit", { limit: 120, windowMs: 60 * 1000 })) return;
    try {
      const body = await readBody(req);
      const result = await recordPageVisit(req, body);
      if (result.blocked) {
        sendJson(res, 403, { ok: false, error: "Hozzáférés megtagadva." });
        return;
      }
      const headers = {};
      if (result.setCookie) headers["Set-Cookie"] = visitorCookieHeader(result.visitorId);
      sendJson(res, 200, { ok: true, visitorId: result.visitorId }, headers);
    } catch (error) {
      sendJson(res, 200, { ok: false, error: error.message ?? String(error) });
    }
    return;
  }

  if (pathname === "/api/media/proxy" && req.method === "GET") {
    await handleMediaProxy(req, res);
    return;
  }

  if (pathname === "/api/hub-promo" && req.method === "GET") {
    try {
      sendJson(res, 200, await getHubPromoPublic(), {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      });
    } catch (error) {
      sendJson(res, 500, { error: error.message ?? "Hub promo hiba." });
    }
    return;
  }

  if (pathname.startsWith("/api/level1")) {
    await handleLevel1Api(req, res, pathname);
    return;
  }

  if (pathname.startsWith("/api/auth")) {
    await handleAuthApi(req, res, pathname);
    return;
  }

  if (pathname.startsWith("/api/messages")) {
    await handleMessagesApi(req, res, pathname);
    return;
  }

  if (pathname === "/api/open-chrome" && req.method === "POST") {
    await handleOpenChrome(req, res);
    return;
  }

  if (pathname === "/api/import" && req.method === "POST") {
    await handleImport(req, res);
    return;
  }

  if (pathname === "/api/import/discover" && req.method === "POST") {
    await handleImportDiscover(req, res);
    return;
  }

  if (pathname === "/api/import/client" && req.method === "POST") {
    await handleImportClient(req, res);
    return;
  }

  if (pathname === "/api/import/extracted" && (req.method === "POST" || req.method === "OPTIONS")) {
    await handleImportExtracted(req, res);
    return;
  }

  if (pathname === "/api/site-blocks" && req.method === "GET") {
    try {
      const url = new URL(req.url ?? "", `http://${HOST}`);
      const page = url.searchParams.get("page");
      sendJson(res, 200, await getSiteBlocks(page));
    } catch (error) {
      sendJson(res, 500, { error: error.message ?? "Oldalsáv betöltés sikertelen." });
    }
    return;
  }

  if (pathname === "/api/site-blocks" && req.method === "PUT") {
    const admin = await getLevel1AdminBySession(getLevel1TokenFromRequest(req));
    if (!admin) {
      sendJson(res, 401, { error: "Admin belépés szükséges (Bocsatech)." });
      return;
    }
    let body;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { error: "Érvénytelen JSON." });
      return;
    }
    try {
      sendJson(res, 200, await saveSiteBlocks(body));
    } catch (error) {
      sendJson(res, 500, { error: error.message ?? "Oldalsáv mentés sikertelen." });
    }
    return;
  }

  if (pathname === "/api/site-hero" && req.method === "GET") {
    try {
      const url = new URL(req.url ?? "", `http://${HOST}`);
      sendJson(res, 200, await getSiteHero(url.searchParams.get("kind")));
    } catch (error) {
      sendJson(res, 500, { error: error.message ?? "Hero betöltés sikertelen." });
    }
    return;
  }

  if (pathname === "/api/site-hero" && req.method === "PUT") {
    const admin = await getLevel1AdminBySession(getLevel1TokenFromRequest(req));
    if (!admin) {
      sendJson(res, 401, { error: "Admin belépés szükséges (Bocsatech)." });
      return;
    }
    let body;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { error: "Érvénytelen JSON." });
      return;
    }
    try {
      const state = await setActiveHeroUrl(body.activeUrl ?? body.url, body.kind);
      sendJson(res, 200, state);
    } catch (error) {
      const status = error.code === "INVALID_URL" ? 400 : 500;
      sendJson(res, status, { error: error.message ?? "Mentés sikertelen." });
    }
    return;
  }

  if (pathname === "/api/site-hero/upload" && req.method === "POST") {
    const admin = await getLevel1AdminBySession(getLevel1TokenFromRequest(req));
    if (!admin) {
      sendJson(res, 401, { error: "Admin belépés szükséges (Bocsatech)." });
      return;
    }
    let body;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { error: "Érvénytelen JSON." });
      return;
    }
    try {
      const state = await uploadHeroImage(body.dataUrl ?? body.image, body.label, body.kind);
      sendJson(res, 200, state);
    } catch (error) {
      const status =
        error.code === "INVALID_IMAGE" || error.code === "UPLOAD_FAILED" ? 400 : 500;
      sendJson(res, status, { error: error.message ?? "Feltöltés sikertelen." });
    }
    return;
  }

  if (pathname === "/api/nav/counts" && req.method === "GET") {
    try {
      sendJson(res, 200, await countNavListings({ status: "feladott" }), {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
      });
    } catch (error) {
      console.warn("Nav counts:", error.message ?? error);
      sendJson(res, 500, { error: error.message ?? "Szerver hiba." });
    }
    return;
  }

  if (
    pathname === "/api/db/stats" ||
    pathname === "/api/field-defs" ||
    pathname === "/api/listings" ||
    pathname === "/api/listings/latest" ||
    pathname.startsWith("/api/listings/")
  ) {
    try {
      await handleListingsApi(req, res, pathname);
    } catch (error) {
      console.warn("Listings API:", error.message ?? error);
      if (!res.headersSent) {
        sendJson(res, 500, { error: error.message ?? "Szerver hiba." });
      }
    }
    return;
  }

  if (pathname.startsWith("/api/fugveny")) {
    await handleFugvenyApi(req, res, pathname);
    return;
  }

  if (pathname.startsWith("/api/valuation")) {
    await handleValuationApi(req, res, pathname);
    return;
  }

  if (pathname.startsWith("/api/vehicle-catalog")) {
    await handleVehicleCatalogApi(req, res, pathname);
    return;
  }

  if (pathname.startsWith("/api/partners") || pathname.startsWith("/api/postal-codes")) {
    await handlePartnersApi(req, res, pathname);
    return;
  }

  if (pathname.startsWith("/api/")) {
    sendJson(res, 404, { error: "Ismeretlen API." });
    return;
  }

  serveStatic(pathname, res);
}

const server = createServer(handleHttpRequest);

function shutdown(signal) {
  console.log(`\nLeállítás (${signal}) — adatbázis zárása…`);
  try {
    closeDb();
  } catch {
    /* ignore */
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

if (!process.env.VERCEL) {
server.listen(PORT, HOST, async () => {
  try {
    ensureProfilesStore();
    ensureSmtpExample();
    ensureOAuthExample();
    const imagesRoot = ensureServerImageDirs();
    console.log(`Képek: ${imagesRoot}/pkw  ${imagesRoot}/lkw`);
    await initMessagingSchema();
    console.log("Üzenetek API: /api/messages/*");
  } catch (error) {
    console.warn("Profil/SMTP/OAuth/Messages store:", error.message ?? error);
  }
  console.log(`Autosweb: http://${HOST}:${PORT}`);
  try {
    console.log(`User DB: ${await getDbPath()}`);
  } catch (error) {
    console.warn("DB path:", error.message ?? error);
  }
  try {
    console.log(`Hirdetésképek: ${listingImageDir()}`);
  } catch (error) {
    console.warn("Upload mappa:", error.message ?? error);
  }
  if (isSmtpConfigured()) {
    console.log(`SMTP: beállítva (${smtpConfigPath()})`);
  } else {
    console.warn(
      `SMTP: NINCS — másold ~/.autosweb/smtp.example.json → smtp.json (Gmail app jelszó). Futtasd: autosweb/mac/smtp-beallitas.command`
    );
  }
  const oauthProviders = listOAuthProviders();
  const enabledOauth = oauthProviders.filter((p) => p.enabled).map((p) => p.label);
  if (enabledOauth.length) {
    console.log(`OAuth: ${enabledOauth.join(", ")} (${oauthConfigPath()})`);
  } else {
    console.warn(
      `OAuth: nincs aktív provider — szerkeszd: ${oauthConfigPath()} (példa: ~/.autosweb/oauth.example.json). Futtasd: autosweb/mac/oauth-beallitas.command`
    );
  }
  console.log("Import: hasznaltauto.hu → helyi űrlap (nem ad fel hirdetést).");
  try {
    const stats = await dbStats();
    const users = await countWebUsers();
    console.log(
      `${isSupabaseBackend() ? "Supabase" : "SQLite"}: ${stats.path} (${stats.listings} hirdetés, ${stats.cells} cella, ${users} user)`
    );
    console.log(`Profil fájl: ${getProfilesFilePath()}`);
  } catch (error) {
    console.warn("SQLite inicializálás:", error.message ?? error);
  }
  try {
    const catalog = ensureVehicleCatalog();
    if (catalog?.gyartmanyok?.length) {
      const modelCount = Object.values(catalog.modellek ?? {}).reduce(
        (n, arr) => n + arr.length,
        0
      );
      console.log(
        `Járműkatalógus: ${catalog.gyartmanyok.length} márka, ${modelCount} modell (${catalog.source ?? "?"})`
      );
    } else {
      console.warn(
        "Járműkatalógus: nincs — futtasd: npm run import:catalog -- ~/Desktop/lista.csv"
      );
    }
  } catch (error) {
    console.warn("Járműkatalógus:", error.message ?? error);
  }
  try {
    const { seedDemoPartnersIfEmpty } = await import("./scripts/seed-partners.mjs");
    const seedResult = seedDemoPartnersIfEmpty();
    if (seedResult.seeded) {
      console.log(
        `Partnerek: demo adatok betöltve (${seedResult.stats.activePaid} fizetős aktív)`
      );
    }
  } catch (error) {
    console.warn("Partner seed:", error.message ?? error);
  }
});
}
