import { sendMail, isSmtpConfigured } from "./mail.mjs";
import {
  startLevel1Login,
  verifyLevel1Otp,
  getLevel1TokenFromRequest,
  getLevel1AdminBySession,
  destroyLevel1Session,
  level1CookieHeader,
  clearLevel1CookieHeader,
  getFormLayout,
  saveFormLayout,
  listLayoutCategories,
  normalizeLayoutCategory,
  level1UnlockSql,
} from "./level1.mjs";
import {
  listWebUsersForAdmin,
  deleteUserAccount,
  getUserDetailsForAdmin,
  updateWebUserForAdmin,
} from "./web-users-store.mjs";
import { listListingsWithPreview, updateListingStatus, deleteListing } from "./db-store.mjs";

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
      const allowDevCode = !process.env.VERCEL;
      if (isSmtpConfigured()) {
        try {
          await sendMail({
            to: pending.email,
            subject: "Bocsatech belépési kód",
            text: `A belépési kódod: ${pending.code}\n10 percig érvényes.\nHa nem te kérted, hagyd figyelmen kívül.`,
            html: `<p>A belépési kódod: <strong>${pending.code}</strong></p><p>10 percig érvényes.</p>`,
          });
        } catch (mailErr) {
          const err = new Error(
            `A jelszó jó, de a kódot nem sikerült elküldeni: ${mailErr.message ?? mailErr}`
          );
          err.code = "SMTP";
          throw err;
        }
        sendJson(res, 200, { ok: true, otpSent: true, username: pending.username });
        return;
      }
      if (!allowDevCode) {
        sendJson(res, 503, {
          error: "Email küldés nincs beállítva. Vercel env: SMTP_USER, SMTP_PASS.",
        });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        otpSent: false,
        username: pending.username,
        devCode: pending.code,
      });
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

    const admin = await requireAdmin(req, res);
    if (!admin) return;

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

    if (pathname === "/api/level1/users" && req.method === "GET") {
      sendJson(res, 200, { users: await listWebUsersForAdmin() });
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
      const listings = await listListingsWithPreview({ limit: 300 });
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
    const status = code === "LOCKED" ? 423 : code === "INVALID" ? 401 : 400;
    sendJson(res, status, { error: message, code: code || null });
  }
}
