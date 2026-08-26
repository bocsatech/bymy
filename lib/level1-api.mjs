import { sendMail, isSmtpConfigured } from "./mail.mjs";
import {
  startLevel1Login,
  resendLevel1Otp,
  verifyLevel1Otp,
  getLevel1TokenFromRequest,
  getLevel1AdminBySession,
  destroyLevel1Session,
  level1CookieHeader,
  clearLevel1CookieHeader,
  getFormLayout,
  saveFormLayout,
  getIngatlanWheelSchema,
  saveIngatlanWheelSchema,
  getSearchCylinderMenu,
  saveSearchCylinderMenu,
  getSearchCylinderPublic,
  getKivitelMenu,
  saveKivitelMenu,
  getKivitelMenuPublic,
  listLayoutCategories,
  normalizeLayoutCategory,
  level1UnlockSql,
  maskEmail,
} from "./level1.mjs";
import { SEARCH_CYLINDER_IMAGE_PRESETS } from "./search-cylinder-menu.mjs";
import {
  listWebUsersForAdmin,
  deleteUserAccount,
  getUserDetailsForAdmin,
  updateWebUserForAdmin,
} from "./web-users-store.mjs";
import { listListingsWithPreview, updateListingStatus, deleteListing } from "./db-store.mjs";
import { resolveListingVertical } from "./listing-vertical.mjs";
import {
  getHubPromoAdmin,
  uploadHubPromoImage,
  updateHubPromoImage,
  deleteHubPromoImage,
} from "./hub-promo.mjs";
import { getVisitorAdminStats, getVisitorPageHits } from "./site-visitors.mjs";
import { ensureSupabaseVisitorSchema } from "./supabase/visitor-schema.mjs";
import { listBlockedIps, blockIp, unblockIp } from "./site-ip-blocks.mjs";

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(data));
}

async function requireAdmin(req, res) {
  const admin = await getLevel1AdminBySession(getLevel1TokenFromRequest(req));
  if (!admin) {
    sendJson(res, 401, { error: "Admin belépés szükséges." });
    return null;
  }
  return admin;
}

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

async function deliverLevel1Otp(pending) {
  const emailMasked = pending.emailMasked || maskEmail(pending.email);
  const base = { ok: true, username: pending.username, emailMasked };
  if (isSmtpConfigured()) {
    try {
      await sendMail({
        to: pending.email,
        subject: "Bocsatech belépési kód",
        text: `A belépési kódod: ${pending.code}\n10 percig érvényes.\nHa nem te kérted, hagyd figyelmen kívül.`,
        html: `<p>A belépési kódod: <strong>${pending.code}</strong></p><p>10 percig érvényes.</p>`,
      });
      return { ...base, otpSent: true };
    } catch (mailErr) {
      /* Jelszó már jó — ha az email nem megy, a kód megjelenik az admin UI-ban. */
      return {
        ...base,
        otpSent: false,
        devCode: pending.code,
        smtpWarning: String(mailErr.message ?? mailErr),
      };
    }
  }
  return {
    ...base,
    otpSent: false,
    devCode: pending.code,
    smtpRequired: true,
  };
}

export async function handleLevel1Api(req, res, pathname) {
  try {
    if (pathname === "/api/level1/me" && req.method === "GET") {
      const admin = await getLevel1AdminBySession(getLevel1TokenFromRequest(req));
      sendJson(res, 200, { admin });
      return;
    }

    if (pathname === "/api/level1/login" && req.method === "POST") {
      const body = await readBody(req);
      const pending = await startLevel1Login(body.username, body.password);
      // IDEIGLENES localhost: localadmin → azonnal session, nincs OTP
      if (pending.skipOtp && pending.session && pending.admin) {
        sendJson(
          res,
          200,
          { ok: true, skipOtp: true, admin: pending.admin, username: pending.username },
          { "Set-Cookie": level1CookieHeader(pending.session.token, pending.session.expires) }
        );
        return;
      }
      sendJson(res, 200, await deliverLevel1Otp(pending));
      return;
    }

    if (pathname === "/api/level1/resend-otp" && req.method === "POST") {
      const body = await readBody(req);
      const pending = await resendLevel1Otp(body.username);
      sendJson(res, 200, await deliverLevel1Otp(pending));
      return;
    }

    if (pathname === "/api/level1/otp" && req.method === "POST") {
      const body = await readBody(req);
      const { admin, session } = await verifyLevel1Otp(body.username, body.code);
      sendJson(
        res,
        200,
        { ok: true, admin },
        { "Set-Cookie": level1CookieHeader(session.token, session.expires) }
      );
      return;
    }

    if (pathname === "/api/level1/logout" && req.method === "POST") {
      await destroyLevel1Session(getLevel1TokenFromRequest(req));
      sendJson(res, 200, { ok: true }, { "Set-Cookie": clearLevel1CookieHeader() });
      return;
    }

    if (pathname === "/api/level1/form-layout" && req.method === "GET") {
      const url = new URL(req.url || "/", "http://localhost");
      const category = normalizeLayoutCategory(url.searchParams.get("category") || "szemelyauto");
      sendJson(res, 200, {
        layout: await getFormLayout(category),
        category,
        categories: listLayoutCategories(),
      });
      return;
    }

    if (pathname === "/api/level1/ingatlan-wheel-schema" && req.method === "GET") {
      const url = new URL(req.url || "/", "http://localhost");
      const variant = url.searchParams.get("variant") || "ingatlan";
      sendJson(res, 200, {
        schema: await getIngatlanWheelSchema(variant),
        variant,
      });
      return;
    }

    if (pathname === "/api/level1/search-cylinder" && req.method === "GET") {
      const data = await getSearchCylinderPublic();
      sendJson(res, 200, data);
      return;
    }

    if (pathname === "/api/level1/kivitel-menu" && req.method === "GET") {
      sendJson(res, 200, await getKivitelMenuPublic());
      return;
    }

    const admin = await requireAdmin(req, res);
    if (!admin) return;

    if (pathname === "/api/level1/hub-promo" && req.method === "GET") {
      sendJson(res, 200, await getHubPromoAdmin());
      return;
    }

    if (pathname === "/api/level1/hub-promo/upload" && req.method === "POST") {
      const body = await readBody(req);
      sendJson(
        res,
        200,
        await uploadHubPromoImage(body.image, { href: body.href, alt: body.alt })
      );
      return;
    }

    if (pathname === "/api/level1/hub-promo/image" && req.method === "PATCH") {
      const body = await readBody(req);
      sendJson(
        res,
        200,
        await updateHubPromoImage(body.id || body.imageId, { href: body.href, alt: body.alt })
      );
      return;
    }

    if (pathname === "/api/level1/hub-promo/image" && req.method === "DELETE") {
      const body = await readBody(req);
      sendJson(res, 200, await deleteHubPromoImage(body.id || body.imageId));
      return;
    }

    if (pathname === "/api/level1/unlock-sql" && req.method === "GET") {
      sendJson(res, 200, { sql: level1UnlockSql(admin.username) });
      return;
    }

    if (pathname === "/api/level1/form-layout" && req.method === "PUT") {
      const body = await readBody(req);
      const category = normalizeLayoutCategory(body.category || "szemelyauto");
      const layout = await saveFormLayout(body.layout || body, category);
      sendJson(res, 200, { ok: true, layout, category });
      return;
    }

    if (pathname === "/api/level1/ingatlan-wheel-schema" && req.method === "PUT") {
      const body = await readBody(req);
      const variant = body.variant || "ingatlan";
      const schema = await saveIngatlanWheelSchema(body.schema || body, variant);
      sendJson(res, 200, { ok: true, schema, variant });
      return;
    }

    if (pathname === "/api/level1/search-cylinder" && req.method === "PUT") {
      const body = await readBody(req);
      const menu = await saveSearchCylinderMenu(body.menu || body);
      sendJson(res, 200, {
        ok: true,
        menu,
        items: menu.items,
        imagePresets: SEARCH_CYLINDER_IMAGE_PRESETS,
      });
      return;
    }

    if (pathname === "/api/level1/search-cylinder/admin" && req.method === "GET") {
      const menu = await getSearchCylinderMenu();
      sendJson(res, 200, {
        menu,
        items: menu.items,
        imagePresets: SEARCH_CYLINDER_IMAGE_PRESETS,
      });
      return;
    }

    if (pathname === "/api/level1/kivitel-menu/admin" && req.method === "GET") {
      const menu = await getKivitelMenu();
      sendJson(res, 200, { menu, items: menu.items });
      return;
    }

    if (pathname === "/api/level1/kivitel-menu" && req.method === "PUT") {
      const body = await readBody(req);
      const menu = await saveKivitelMenu(body.menu || body);
      sendJson(res, 200, { ok: true, menu, items: menu.items });
      return;
    }

    if (pathname === "/api/level1/users" && req.method === "GET") {
      sendJson(res, 200, { users: await listWebUsersForAdmin() });
      return;
    }

    if (pathname === "/api/level1/visitors" && req.method === "GET") {
      const stats = await getVisitorAdminStats();
      sendJson(res, 200, { ...stats, blockedIps: await listBlockedIps() });
      return;
    }

    if (pathname === "/api/level1/visitors/block" && req.method === "POST") {
      const body = await readBody(req);
      sendJson(res, 200, { ok: true, blockedIps: await blockIp(body.ip) });
      return;
    }

    if (pathname === "/api/level1/visitors/unblock" && req.method === "POST") {
      const body = await readBody(req);
      sendJson(res, 200, { ok: true, blockedIps: await unblockIp(body.ip) });
      return;
    }

    if (pathname === "/api/level1/visitors/init" && req.method === "POST") {
      const result = await ensureSupabaseVisitorSchema({ force: true });
      if (!result.ok) {
        sendJson(res, 503, result);
        return;
      }
      sendJson(res, 200, { ok: true, ...result, stats: await getVisitorAdminStats() });
      return;
    }

    const visitorHitsMatch = pathname.match(/^\/api\/level1\/visitors\/([a-f0-9]{32})\/hits$/i);
    if (visitorHitsMatch && req.method === "GET") {
      sendJson(res, 200, { hits: await getVisitorPageHits(visitorHitsMatch[1]) });
      return;
    }

    const userMatch = pathname.match(/^\/api\/level1\/users\/(\d+)$/);
    if (userMatch) {
      const userId = Number(userMatch[1]);
      if (req.method === "GET") {
        sendJson(res, 200, { user: await getUserDetailsForAdmin(userId) });
        return;
      }
      if (req.method === "PATCH") {
        const body = await readBody(req);
        const user = await updateWebUserForAdmin(userId, {
          email: body.email,
          displayName: body.displayName,
          emailVerified: body.emailVerified,
          profileJson: body.profileJson,
        });
        sendJson(res, 200, { user });
        return;
      }
      if (req.method === "DELETE") {
        await deleteUserAccount(userId);
        sendJson(res, 200, { ok: true });
        return;
      }
    }

    if (pathname === "/api/level1/listings" && req.method === "GET") {
      const url = new URL(req.url || "/", "http://localhost");
      const vertical = url.searchParams.get("vertical") || null;
      const listings = await listListingsWithPreview({ limit: 300, vertical });
      sendJson(
        res,
        200,
        {
          listings: listings.map((row) => ({
            id: row.id,
            title: row.hirdetes_cime,
            status: row.status,
            gyartmany: row.gyartmany,
            tipus: row.tipus,
            vertical: resolveListingVertical(row),
            subtype:
              row.hirdetes_alkategoria ||
              row.preview?.filter?.hirdetes_alkategoria ||
              row.form?.hirdetes_alkategoria ||
              "",
            ownerUserId: row.owner_user_id,
            updatedAt: row.updated_at,
            imageUrl: row.preview?.imageUrl || "",
          })),
        }
      );
      return;
    }

    const listingMatch = pathname.match(/^\/api\/level1\/listings\/(\d+)$/);
    if (listingMatch && req.method === "PATCH") {
      const body = await readBody(req);
      await updateListingStatus(Number(listingMatch[1]), body.status);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (listingMatch && req.method === "DELETE") {
      await deleteListing(Number(listingMatch[1]));
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 404, { error: "Ismeretlen admin API." });
  } catch (error) {
    const code = error.code;
    const message = error.message ?? "Szerver hiba.";
    const status =
      error.status ||
      (code === "LOCKED" ? 423 : code === "INVALID" ? 401 : code === "SMTP_NOT_CONFIGURED" ? 503 : 400);
    sendJson(res, status, { error: message, code: code || null });
  }
}
