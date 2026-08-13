/**
 * Üzenetek / chat — SQLite (később ugyanazzal az API-val VPS-re költöztethető).
 * Csatolmány: max 10 MB, image/* + PDF + DOC/DOCX.
 */
import { randomBytes } from "crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";
import { getDb } from "./db.mjs";
import { isSupabaseBackend } from "./supabase/client.mjs";
import * as sbMessaging from "./supabase/messaging.mjs";
import {
  getUserBySessionToken,
  getSessionTokenFromRequest,
  initWebUsersSchema,
} from "./web-users.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ATTACH_DIR = join(__dirname, "..", "data", "message-attachments");
const MAX_ATTACH_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const DEMO_SELLER_EMAIL = "eladas@addelautod.demo";

export function initMessagingSchema(db) {
  if (isSupabaseBackend()) return sbMessaging.initMessagingSchema();
  const database = db ?? getDb();
  initWebUsersSchema(database);
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id TEXT NOT NULL,
      listing_title TEXT NOT NULL,
      listing_price_label TEXT NOT NULL DEFAULT '',
      listing_code TEXT NOT NULL DEFAULT '',
      listing_meta TEXT NOT NULL DEFAULT '',
      buyer_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      buyer_last_read_at TEXT,
      seller_last_read_at TEXT,
      FOREIGN KEY (buyer_id) REFERENCES web_users(id) ON DELETE CASCADE,
      FOREIGN KEY (seller_id) REFERENCES web_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      attachment_name TEXT,
      attachment_mime TEXT,
      attachment_path TEXT,
      attachment_size INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES web_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS message_blocks (
      blocker_id INTEGER NOT NULL,
      blocked_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (blocker_id, blocked_id),
      FOREIGN KEY (blocker_id) REFERENCES web_users(id) ON DELETE CASCADE,
      FOREIGN KEY (blocked_id) REFERENCES web_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS device_tokens (
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'ios',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, token),
      FOREIGN KEY (user_id) REFERENCES web_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS push_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      sent_at TEXT,
      FOREIGN KEY (user_id) REFERENCES web_users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_buyer ON conversations(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_seller ON conversations(seller_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_push_outbox_user ON push_outbox(user_id);
  `);

  ensureDemoSeller(db);
  if (!existsSync(ATTACH_DIR)) mkdirSync(ATTACH_DIR, { recursive: true });
}

function ensureDemoSeller(db) {
  const existing = db.prepare("SELECT id FROM web_users WHERE email = ?").get(DEMO_SELLER_EMAIL);
  if (existing) return existing.id;
  // jelszó: nem belépésre szánt demo eladó; hash placeholder
  const salt = randomBytes(16).toString("hex");
  const hash = randomBytes(32).toString("hex");
  const info = db
    .prepare(
      `INSERT INTO web_users (email, password_salt, password_hash, display_name, profile_json, email_verified)
       VALUES (?, ?, ?, 'Add el autod Eladó', ?, 1)`
    )
    .run(
      DEMO_SELLER_EMAIL,
      salt,
      hash,
      JSON.stringify({ firstName: "Eladó", lastName: "Demo", accountType: "dealer" })
    );
  return info.lastInsertRowid;
}

async function requireUserAsync(req) {
  const user = await getUserBySessionToken(getSessionTokenFromRequest(req));
  if (!user) {
    const err = new Error("Nem vagy bejelentkezve.");
    err.status = 401;
    throw err;
  }
  return user;
}

function isBlocked(db, a, b) {
  return Boolean(
    db
      .prepare(
        `SELECT 1 FROM message_blocks
         WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`
      )
      .get(a, b, b, a)
  );
}

function userPublic(db, id) {
  const row = db.prepare("SELECT id, email, display_name, profile_json FROM web_users WHERE id = ?").get(id);
  if (!row) return { id, email: "", displayName: "Ismeretlen" };
  let first = "";
  try {
    const p = JSON.parse(row.profile_json || "{}");
    first = [p.lastName, p.firstName].filter(Boolean).join(" ");
  } catch {
    /* ignore */
  }
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name || first || row.email.split("@")[0],
  };
}

function conversationForUser(db, id, userId) {
  const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id);
  if (!row) return null;
  if (row.buyer_id !== userId && row.seller_id !== userId) return null;
  return row;
}

function unreadCount(db, conv, userId) {
  const lastRead =
    userId === conv.buyer_id ? conv.buyer_last_read_at : conv.seller_last_read_at;
  if (!lastRead) {
    return db
      .prepare(
        `SELECT COUNT(*) AS n FROM messages
         WHERE conversation_id = ? AND sender_id != ?`
      )
      .get(conv.id, userId).n;
  }
  return db
    .prepare(
      `SELECT COUNT(*) AS n FROM messages
       WHERE conversation_id = ? AND sender_id != ? AND created_at > ?`
    )
    .get(conv.id, userId, lastRead).n;
}

function lastMessage(db, conversationId) {
  return (
    db
      .prepare(
        `SELECT id, sender_id, body, attachment_name, created_at
         FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1`
      )
      .get(conversationId) ?? null
  );
}

function publicConversation(db, conv, userId) {
  const peerId = conv.buyer_id === userId ? conv.seller_id : conv.buyer_id;
  const peer = userPublic(db, peerId);
  const last = lastMessage(db, conv.id);
  const unread = unreadCount(db, conv, userId);
  return {
    id: conv.id,
    listing: {
      id: conv.listing_id,
      title: conv.listing_title,
      priceLabel: conv.listing_price_label,
      code: conv.listing_code || `AEA-${conv.listing_id}`,
      meta: conv.listing_meta,
    },
    peer,
    role: conv.buyer_id === userId ? "buyer" : "seller",
    unread,
    updatedAt: conv.updated_at,
    lastMessage: last
      ? {
          id: last.id,
          senderId: last.sender_id,
          body: last.body || (last.attachment_name ? `📎 ${last.attachment_name}` : ""),
          createdAt: last.created_at,
        }
      : null,
  };
}

function publicMessage(db, row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    attachment: row.attachment_path
      ? {
          name: row.attachment_name,
          mime: row.attachment_mime,
          size: row.attachment_size,
          url: `/api/messages/attachments/${row.id}`,
        }
      : null,
  };
}

function enqueuePush(db, userId, title, body, payload = {}) {
  db.prepare(
    `INSERT INTO push_outbox (user_id, title, body, payload_json) VALUES (?, ?, ?, ?)`
  ).run(userId, title, body, JSON.stringify(payload));
}

function saveAttachment(conversationId, attachment) {
  if (!attachment) return null;
  const name = String(attachment.filename || attachment.name || "file").slice(0, 180);
  const mime = String(attachment.mime || attachment.content_type || "").toLowerCase();
  const b64 = String(attachment.data_base64 || attachment.data || "").replace(/^data:[^;]+;base64,/, "");
  if (!b64) {
    const err = new Error("Érvénytelen csatolmány.");
    err.status = 400;
    throw err;
  }
  if (!ALLOWED_MIME.has(mime)) {
    const err = new Error("Csak kép, PDF vagy DOC/DOCX csatolható.");
    err.status = 400;
    throw err;
  }
  const buf = Buffer.from(b64, "base64");
  if (!buf.length || buf.length > MAX_ATTACH_BYTES) {
    const err = new Error("A csatolmány maximum 10 MB lehet.");
    err.status = 400;
    throw err;
  }
  const dir = join(ATTACH_DIR, String(conversationId));
  mkdirSync(dir, { recursive: true });
  const ext = extname(name) || (mime.includes("pdf") ? ".pdf" : mime.includes("word") ? ".doc" : ".bin");
  const stored = `${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
  const abs = join(dir, stored);
  writeFileSync(abs, buf);
  return {
    name,
    mime,
    path: join(String(conversationId), stored),
    size: buf.length,
  };
}

export async function listConversations(userId) {
  if (isSupabaseBackend()) return sbMessaging.listConversations(userId);
  initMessagingSchema();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM conversations
       WHERE buyer_id = ? OR seller_id = ?
       ORDER BY updated_at DESC, id DESC`
    )
    .all(userId, userId);
  return rows.map((c) => publicConversation(db, c, userId));
}

export async function startConversation(userId, input) {
  if (isSupabaseBackend()) return sbMessaging.startConversation(userId, input);
  initMessagingSchema();
  const db = getDb();
  const listingId = String(input.listing_id ?? input.listingId ?? "").trim();
  const title = String(input.listing_title ?? input.listingTitle ?? "").trim();
  if (!listingId || !title) {
    const err = new Error("A hirdetés azonosítója és címe kötelező.");
    err.status = 400;
    throw err;
  }

  let sellerId = Number(input.seller_id ?? input.sellerId ?? 0);
  if (!sellerId) {
    const sellerEmail = String(input.seller_email ?? input.sellerEmail ?? DEMO_SELLER_EMAIL)
      .trim()
      .toLowerCase();
    const seller = db.prepare("SELECT id FROM web_users WHERE email = ?").get(sellerEmail);
    sellerId = seller?.id ?? ensureDemoSeller(db);
  }
  if (sellerId === userId) {
    const err = new Error("Saját hirdetésedre nem küldhetsz üzenetet.");
    err.status = 400;
    throw err;
  }
  if (isBlocked(db, userId, sellerId)) {
    const err = new Error("Ez a felhasználó blokkolva van.");
    err.status = 403;
    throw err;
  }

  const existing = db
    .prepare(
      `SELECT * FROM conversations
       WHERE listing_id = ? AND buyer_id = ? AND seller_id = ?`
    )
    .get(listingId, userId, sellerId);
  if (existing) return publicConversation(db, existing, userId);

  const code = String(input.listing_code ?? input.listingCode ?? `AEA-${listingId}`).trim();
  const info = db
    .prepare(
      `INSERT INTO conversations
        (listing_id, listing_title, listing_price_label, listing_code, listing_meta, buyer_id, seller_id, buyer_last_read_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(
      listingId,
      title,
      String(input.listing_price_label ?? input.listingPriceLabel ?? ""),
      code,
      String(input.listing_meta ?? input.listingMeta ?? ""),
      userId,
      sellerId
    );

  const conv = db.prepare("SELECT * FROM conversations WHERE id = ?").get(info.lastInsertRowid);
  return publicConversation(db, conv, userId);
}

export async function listMessages(userId, conversationId) {
  if (isSupabaseBackend()) return sbMessaging.listMessages(userId, conversationId);
  initMessagingSchema();
  const db = getDb();
  const conv = conversationForUser(db, conversationId, userId);
  if (!conv) {
    const err = new Error("Beszélgetés nem található.");
    err.status = 404;
    throw err;
  }
  const peerId = conv.buyer_id === userId ? conv.seller_id : conv.buyer_id;
  if (isBlocked(db, userId, peerId)) {
    const err = new Error("Ez a felhasználó blokkolva van.");
    err.status = 403;
    throw err;
  }
  const rows = db
    .prepare(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC`)
    .all(conversationId);
  return {
    conversation: publicConversation(db, conv, userId),
    messages: rows.map((r) => publicMessage(db, r)),
  };
}

export async function sendMessage(userId, conversationId, { body, attachment }) {
  if (isSupabaseBackend()) return sbMessaging.sendMessage(userId, conversationId, { body, attachment });
  initMessagingSchema();
  const db = getDb();
  const conv = conversationForUser(db, conversationId, userId);
  if (!conv) {
    const err = new Error("Beszélgetés nem található.");
    err.status = 404;
    throw err;
  }
  const peerId = conv.buyer_id === userId ? conv.seller_id : conv.buyer_id;
  if (isBlocked(db, userId, peerId)) {
    const err = new Error("Ez a felhasználó blokkolva van.");
    err.status = 403;
    throw err;
  }
  const text = String(body ?? "").trim();
  const saved = attachment ? saveAttachment(conversationId, attachment) : null;
  if (!text && !saved) {
    const err = new Error("Üzenet szöveg vagy csatolmány kell.");
    err.status = 400;
    throw err;
  }

  const info = db
    .prepare(
      `INSERT INTO messages
        (conversation_id, sender_id, body, attachment_name, attachment_mime, attachment_path, attachment_size)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      conversationId,
      userId,
      text,
      saved?.name ?? null,
      saved?.mime ?? null,
      saved?.path ?? null,
      saved?.size ?? null
    );

  db.prepare(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`).run(conversationId);
  if (userId === conv.buyer_id) {
    db.prepare(`UPDATE conversations SET buyer_last_read_at = datetime('now') WHERE id = ?`).run(
      conversationId
    );
  } else {
    db.prepare(`UPDATE conversations SET seller_last_read_at = datetime('now') WHERE id = ?`).run(
      conversationId
    );
  }

  const preview = text || (saved ? `Csatolmány: ${saved.name}` : "Új üzenet");
  enqueuePush(db, peerId, "Új üzenet érkezett", preview, {
    conversationId,
    listingId: conv.listing_id,
  });

  const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(info.lastInsertRowid);
  return publicMessage(db, row);
}

export async function markRead(userId, conversationId) {
  if (isSupabaseBackend()) return sbMessaging.markRead(userId, conversationId);
  initMessagingSchema();
  const db = getDb();
  const conv = conversationForUser(db, conversationId, userId);
  if (!conv) {
    const err = new Error("Beszélgetés nem található.");
    err.status = 404;
    throw err;
  }
  if (userId === conv.buyer_id) {
    db.prepare(`UPDATE conversations SET buyer_last_read_at = datetime('now') WHERE id = ?`).run(
      conversationId
    );
  } else {
    db.prepare(`UPDATE conversations SET seller_last_read_at = datetime('now') WHERE id = ?`).run(
      conversationId
    );
  }
  return { ok: true };
}

export async function markUnread(userId, conversationId) {
  if (isSupabaseBackend()) return sbMessaging.markUnread(userId, conversationId);
  initMessagingSchema();
  const db = getDb();
  const conv = conversationForUser(db, conversationId, userId);
  if (!conv) {
    const err = new Error("Beszélgetés nem található.");
    err.status = 404;
    throw err;
  }
  // Utolsó előttire állítjuk, hogy legyen olvasatlan
  const last = lastMessage(db, conversationId);
  const stamp = last
    ? db
        .prepare(
          `SELECT created_at FROM messages WHERE conversation_id = ? AND id < ? ORDER BY id DESC LIMIT 1`
        )
        .get(conversationId, last.id)?.created_at ?? "1970-01-01"
    : "1970-01-01";
  if (userId === conv.buyer_id) {
    db.prepare(`UPDATE conversations SET buyer_last_read_at = ? WHERE id = ?`).run(stamp, conversationId);
  } else {
    db.prepare(`UPDATE conversations SET seller_last_read_at = ? WHERE id = ?`).run(stamp, conversationId);
  }
  return { ok: true };
}

export async function deleteConversation(userId, conversationId) {
  if (isSupabaseBackend()) return sbMessaging.deleteConversation(userId, conversationId);
  initMessagingSchema();
  const db = getDb();
  const conv = conversationForUser(db, conversationId, userId);
  if (!conv) {
    const err = new Error("Beszélgetés nem található.");
    err.status = 404;
    throw err;
  }
  db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(conversationId);
  db.prepare("DELETE FROM conversations WHERE id = ?").run(conversationId);
  return { ok: true };
}

export async function blockUser(blockerId, blockedId) {
  if (isSupabaseBackend()) return sbMessaging.blockUser(blockerId, blockedId);
  initMessagingSchema();
  const db = getDb();
  const id = Number(blockedId);
  if (!id || id === blockerId) {
    const err = new Error("Érvénytelen felhasználó.");
    err.status = 400;
    throw err;
  }
  db.prepare(
    `INSERT OR IGNORE INTO message_blocks (blocker_id, blocked_id) VALUES (?, ?)`
  ).run(blockerId, id);
  return { ok: true };
}

export async function unblockUser(blockerId, blockedId) {
  if (isSupabaseBackend()) return sbMessaging.unblockUser(blockerId, blockedId);
  initMessagingSchema();
  getDb()
    .prepare(`DELETE FROM message_blocks WHERE blocker_id = ? AND blocked_id = ?`)
    .run(blockerId, Number(blockedId));
  return { ok: true };
}

export async function listBlocks(userId) {
  if (isSupabaseBackend()) return sbMessaging.listBlocks(userId);
  initMessagingSchema();
  const db = getDb();
  const rows = db
    .prepare(`SELECT blocked_id FROM message_blocks WHERE blocker_id = ?`)
    .all(userId);
  return rows.map((r) => userPublic(db, r.blocked_id));
}

export async function registerDeviceToken(userId, { token, platform = "ios" }) {
  if (isSupabaseBackend()) return sbMessaging.registerDeviceToken(userId, { token, platform });
  initMessagingSchema();
  const t = String(token ?? "").trim();
  if (!t) {
    const err = new Error("Device token kötelező.");
    err.status = 400;
    throw err;
  }
  getDb()
    .prepare(
      `INSERT INTO device_tokens (user_id, token, platform, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, token) DO UPDATE SET
         platform = excluded.platform,
         updated_at = datetime('now')`
    )
    .run(userId, t, String(platform || "ios"));
  return { ok: true };
}

export async function getAttachmentForUser(userId, messageId) {
  if (isSupabaseBackend()) return sbMessaging.getAttachmentForUser(userId, messageId);
  initMessagingSchema();
  const db = getDb();
  const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(Number(messageId));
  if (!row?.attachment_path) {
    const err = new Error("Csatolmány nem található.");
    err.status = 404;
    throw err;
  }
  const conv = conversationForUser(db, row.conversation_id, userId);
  if (!conv) {
    const err = new Error("Nincs jogosultság.");
    err.status = 403;
    throw err;
  }
  const abs = join(ATTACH_DIR, row.attachment_path);
  if (!existsSync(abs)) {
    const err = new Error("Fájl hiányzik.");
    err.status = 404;
    throw err;
  }
  return {
    mime: row.attachment_mime || "application/octet-stream",
    name: row.attachment_name || "file",
    buffer: readFileSync(abs),
  };
}

export async function pendingPushForUser(userId) {
  if (isSupabaseBackend()) return sbMessaging.pendingPushForUser(userId);
  initMessagingSchema();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, title, body, payload_json, created_at FROM push_outbox
       WHERE user_id = ? AND sent_at IS NULL ORDER BY id ASC LIMIT 20`
    )
    .all(userId);
  if (rows.length) {
    const ids = rows.map((r) => r.id);
    db.prepare(
      `UPDATE push_outbox SET sent_at = datetime('now') WHERE id IN (${ids.map(() => "?").join(",")})`
    ).run(...ids);
  }
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    payload: JSON.parse(r.payload_json || "{}"),
    createdAt: r.created_at,
  }));
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  });
  res.end(JSON.stringify(data));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

export async function handleMessagesApi(req, res, pathname) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    });
    res.end();
    return true;
  }

  try {
    await initMessagingSchema();

    if (pathname === "/api/messages/conversations" && req.method === "GET") {
      const user = await requireUserAsync(req);
      sendJson(res, 200, { ok: true, conversations: await listConversations(user.id) });
      return true;
    }

    if (pathname === "/api/messages/conversations" && req.method === "POST") {
      const user = await requireUserAsync(req);
      const body = await readJsonBody(req);
      sendJson(res, 201, { ok: true, conversation: await startConversation(user.id, body) });
      return true;
    }

    const convMsg = pathname.match(/^\/api\/messages\/conversations\/(\d+)\/messages$/);
    if (convMsg && req.method === "GET") {
      const user = await requireUserAsync(req);
      sendJson(res, 200, { ok: true, ...(await listMessages(user.id, Number(convMsg[1]))) });
      return true;
    }
    if (convMsg && req.method === "POST") {
      const user = await requireUserAsync(req);
      const body = await readJsonBody(req);
      sendJson(res, 201, {
        ok: true,
        message: await sendMessage(user.id, Number(convMsg[1]), body),
      });
      return true;
    }

    const convRead = pathname.match(/^\/api\/messages\/conversations\/(\d+)\/read$/);
    if (convRead && req.method === "POST") {
      const user = await requireUserAsync(req);
      sendJson(res, 200, await markRead(user.id, Number(convRead[1])));
      return true;
    }

    const convUnread = pathname.match(/^\/api\/messages\/conversations\/(\d+)\/unread$/);
    if (convUnread && req.method === "POST") {
      const user = await requireUserAsync(req);
      sendJson(res, 200, await markUnread(user.id, Number(convUnread[1])));
      return true;
    }

    const convId = pathname.match(/^\/api\/messages\/conversations\/(\d+)$/);
    if (convId && req.method === "DELETE") {
      const user = await requireUserAsync(req);
      sendJson(res, 200, await deleteConversation(user.id, Number(convId[1])));
      return true;
    }

    if (pathname === "/api/messages/block" && req.method === "POST") {
      const user = await requireUserAsync(req);
      const body = await readJsonBody(req);
      sendJson(res, 200, await blockUser(user.id, body.user_id ?? body.userId));
      return true;
    }

    if (pathname === "/api/messages/blocks" && req.method === "GET") {
      const user = await requireUserAsync(req);
      sendJson(res, 200, { ok: true, blocks: await listBlocks(user.id) });
      return true;
    }

    const unblock = pathname.match(/^\/api\/messages\/block\/(\d+)$/);
    if (unblock && req.method === "DELETE") {
      const user = await requireUserAsync(req);
      sendJson(res, 200, await unblockUser(user.id, Number(unblock[1])));
      return true;
    }

    if (pathname === "/api/messages/device-token" && req.method === "POST") {
      const user = await requireUserAsync(req);
      const body = await readJsonBody(req);
      sendJson(res, 200, await registerDeviceToken(user.id, body));
      return true;
    }

    if (pathname === "/api/messages/push-pending" && req.method === "GET") {
      const user = await requireUserAsync(req);
      sendJson(res, 200, { ok: true, notifications: await pendingPushForUser(user.id) });
      return true;
    }

    const attach = pathname.match(/^\/api\/messages\/attachments\/(\d+)$/);
    if (attach && req.method === "GET") {
      const user = await requireUserAsync(req);
      const file = await getAttachmentForUser(user.id, Number(attach[1]));
      res.writeHead(200, {
        "Content-Type": file.mime,
        "Content-Disposition": `inline; filename="${file.name.replace(/"/g, "")}"`,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "private, max-age=3600",
      });
      res.end(file.buffer);
      return true;
    }

    sendJson(res, 404, { ok: false, error: "Ismeretlen messages API." });
    return true;
  } catch (error) {
    const status = error.status || (error instanceof SyntaxError ? 400 : 500);
    sendJson(res, status, { ok: false, error: error.message ?? String(error) });
    return true;
  }
}
