/**
 * Üzenetek / chat — Supabase Postgres.
 */
import { randomBytes } from "crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { getSupabase } from "./client.mjs";
import { getUserById } from "./users.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ATTACH_DIR = process.env.VERCEL
  ? join(tmpdir(), "bymy-attachments")
  : join(__dirname, "..", "..", "data", "message-attachments");
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

function sb() {
  return getSupabase();
}

export async function initMessagingSchema() {
  await ensureDemoSeller();
  if (!existsSync(ATTACH_DIR)) mkdirSync(ATTACH_DIR, { recursive: true });
}

async function ensureDemoSeller() {
  const { data: existing } = await sb().from("web_users").select("id").eq("email", DEMO_SELLER_EMAIL).maybeSingle();
  if (existing) return existing.id;
  const salt = randomBytes(16).toString("hex");
  const hash = randomBytes(32).toString("hex");
  const { data, error } = await sb()
    .from("web_users")
    .insert({
      email: DEMO_SELLER_EMAIL,
      password_salt: salt,
      password_hash: hash,
      display_name: "Bymy Eladó",
      profile_json: JSON.stringify({ firstName: "Eladó", lastName: "Demo", accountType: "dealer" }),
      email_verified: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function isBlocked(a, b) {
  const { data } = await sb()
    .from("message_blocks")
    .select("blocker_id")
    .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`)
    .limit(1);
  return Boolean(data?.length);
}

async function userPublic(id) {
  const user = await getUserById(id);
  if (!user) return { id, email: "", displayName: "Ismeretlen" };
  const first = [user.profile?.lastName, user.profile?.firstName].filter(Boolean).join(" ");
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName || first || user.email.split("@")[0],
  };
}

async function conversationForUser(id, userId) {
  const { data: row } = await sb().from("conversations").select("*").eq("id", id).maybeSingle();
  if (!row) return null;
  if (row.buyer_id !== userId && row.seller_id !== userId) return null;
  return row;
}

async function unreadCount(conv, userId) {
  const lastRead = userId === conv.buyer_id ? conv.buyer_last_read_at : conv.seller_last_read_at;
  let q = sb()
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", conv.id)
    .neq("sender_id", userId);
  if (lastRead) q = q.gt("created_at", lastRead);
  const { count } = await q;
  return count ?? 0;
}

async function lastMessage(conversationId) {
  const { data } = await sb()
    .from("messages")
    .select("id, sender_id, body, attachment_name, created_at")
    .eq("conversation_id", conversationId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function publicConversation(conv, userId) {
  const peerId = conv.buyer_id === userId ? conv.seller_id : conv.buyer_id;
  const peer = await userPublic(peerId);
  const last = await lastMessage(conv.id);
  const unread = await unreadCount(conv, userId);
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

function publicMessage(row) {
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

async function enqueuePush(userId, title, body, payload = {}) {
  await sb().from("push_outbox").insert({
    user_id: userId,
    title,
    body,
    payload_json: JSON.stringify(payload),
  });
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
  return { name, mime, path: join(String(conversationId), stored), size: buf.length };
}

export async function listConversations(userId) {
  await initMessagingSchema();
  const { data, error } = await sb()
    .from("conversations")
    .select("*")
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  return Promise.all(rows.map((c) => publicConversation(c, userId)));
}

export async function startConversation(userId, input) {
  await initMessagingSchema();
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
    const { data: seller } = await sb().from("web_users").select("id").eq("email", sellerEmail).maybeSingle();
    sellerId = seller?.id ?? (await ensureDemoSeller());
  }
  if (sellerId === userId) {
    const err = new Error("Saját hirdetésedre nem küldhetsz üzenetet.");
    err.status = 400;
    throw err;
  }
  if (await isBlocked(userId, sellerId)) {
    const err = new Error("Ez a felhasználó blokkolva van.");
    err.status = 403;
    throw err;
  }

  const { data: existing } = await sb()
    .from("conversations")
    .select("*")
    .eq("listing_id", listingId)
    .eq("buyer_id", userId)
    .eq("seller_id", sellerId)
    .maybeSingle();
  if (existing) return publicConversation(existing, userId);

  const code = String(input.listing_code ?? input.listingCode ?? `AEA-${listingId}`).trim();
  const now = new Date().toISOString();
  const { data: inserted, error } = await sb()
    .from("conversations")
    .insert({
      listing_id: listingId,
      listing_title: title,
      listing_price_label: String(input.listing_price_label ?? input.listingPriceLabel ?? ""),
      listing_code: code,
      listing_meta: String(input.listing_meta ?? input.listingMeta ?? ""),
      buyer_id: userId,
      seller_id: sellerId,
      buyer_last_read_at: now,
    })
    .select("*")
    .single();
  if (error) throw error;
  return publicConversation(inserted, userId);
}

export async function listMessages(userId, conversationId) {
  await initMessagingSchema();
  const conv = await conversationForUser(conversationId, userId);
  if (!conv) {
    const err = new Error("Beszélgetés nem található.");
    err.status = 404;
    throw err;
  }
  const peerId = conv.buyer_id === userId ? conv.seller_id : conv.buyer_id;
  if (await isBlocked(userId, peerId)) {
    const err = new Error("Ez a felhasználó blokkolva van.");
    err.status = 403;
    throw err;
  }
  const { data: rows, error } = await sb()
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("id", { ascending: true });
  if (error) throw error;
  return {
    conversation: await publicConversation(conv, userId),
    messages: (rows ?? []).map(publicMessage),
  };
}

export async function sendMessage(userId, conversationId, { body, attachment }) {
  await initMessagingSchema();
  const conv = await conversationForUser(conversationId, userId);
  if (!conv) {
    const err = new Error("Beszélgetés nem található.");
    err.status = 404;
    throw err;
  }
  const peerId = conv.buyer_id === userId ? conv.seller_id : conv.buyer_id;
  if (await isBlocked(userId, peerId)) {
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

  const now = new Date().toISOString();
  const { data: row, error } = await sb()
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      body: text,
      attachment_name: saved?.name ?? null,
      attachment_mime: saved?.mime ?? null,
      attachment_path: saved?.path ?? null,
      attachment_size: saved?.size ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  const readPatch =
    userId === conv.buyer_id
      ? { buyer_last_read_at: now, updated_at: now }
      : { seller_last_read_at: now, updated_at: now };
  await sb().from("conversations").update(readPatch).eq("id", conversationId);

  const preview = text || (saved ? `Csatolmány: ${saved.name}` : "Új üzenet");
  await enqueuePush(peerId, "Új üzenet érkezett", preview, { conversationId, listingId: conv.listing_id });

  return publicMessage(row);
}

export async function markRead(userId, conversationId) {
  await initMessagingSchema();
  const conv = await conversationForUser(conversationId, userId);
  if (!conv) {
    const err = new Error("Beszélgetés nem található.");
    err.status = 404;
    throw err;
  }
  const now = new Date().toISOString();
  if (userId === conv.buyer_id) {
    await sb().from("conversations").update({ buyer_last_read_at: now }).eq("id", conversationId);
  } else {
    await sb().from("conversations").update({ seller_last_read_at: now }).eq("id", conversationId);
  }
  return { ok: true };
}

export async function markUnread(userId, conversationId) {
  await initMessagingSchema();
  const conv = await conversationForUser(conversationId, userId);
  if (!conv) {
    const err = new Error("Beszélgetés nem található.");
    err.status = 404;
    throw err;
  }
  const last = await lastMessage(conversationId);
  let stamp = "1970-01-01T00:00:00.000Z";
  if (last) {
    const { data: prev } = await sb()
      .from("messages")
      .select("created_at")
      .eq("conversation_id", conversationId)
      .lt("id", last.id)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    stamp = prev?.created_at ?? stamp;
  }
  if (userId === conv.buyer_id) {
    await sb().from("conversations").update({ buyer_last_read_at: stamp }).eq("id", conversationId);
  } else {
    await sb().from("conversations").update({ seller_last_read_at: stamp }).eq("id", conversationId);
  }
  return { ok: true };
}

export async function deleteConversation(userId, conversationId) {
  await initMessagingSchema();
  const conv = await conversationForUser(conversationId, userId);
  if (!conv) {
    const err = new Error("Beszélgetés nem található.");
    err.status = 404;
    throw err;
  }
  await sb().from("messages").delete().eq("conversation_id", conversationId);
  await sb().from("conversations").delete().eq("id", conversationId);
  return { ok: true };
}

export async function blockUser(blockerId, blockedId) {
  await initMessagingSchema();
  const id = Number(blockedId);
  if (!id || id === blockerId) {
    const err = new Error("Érvénytelen felhasználó.");
    err.status = 400;
    throw err;
  }
  await sb().from("message_blocks").upsert({ blocker_id: blockerId, blocked_id: id });
  return { ok: true };
}

export async function unblockUser(blockerId, blockedId) {
  await initMessagingSchema();
  await sb().from("message_blocks").delete().eq("blocker_id", blockerId).eq("blocked_id", Number(blockedId));
  return { ok: true };
}

export async function listBlocks(userId) {
  await initMessagingSchema();
  const { data } = await sb().from("message_blocks").select("blocked_id").eq("blocker_id", userId);
  return Promise.all((data ?? []).map((r) => userPublic(r.blocked_id)));
}

export async function registerDeviceToken(userId, { token, platform = "ios" }) {
  await initMessagingSchema();
  const t = String(token ?? "").trim();
  if (!t) {
    const err = new Error("Device token kötelező.");
    err.status = 400;
    throw err;
  }
  await sb().from("device_tokens").upsert({
    user_id: userId,
    token: t,
    platform: String(platform || "ios"),
    updated_at: new Date().toISOString(),
  });
  return { ok: true };
}

export async function getAttachmentForUser(userId, messageId) {
  await initMessagingSchema();
  const { data: row } = await sb().from("messages").select("*").eq("id", Number(messageId)).maybeSingle();
  if (!row?.attachment_path) {
    const err = new Error("Csatolmány nem található.");
    err.status = 404;
    throw err;
  }
  const conv = await conversationForUser(row.conversation_id, userId);
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
  await initMessagingSchema();
  const { data: rows } = await sb()
    .from("push_outbox")
    .select("id, title, body, payload_json, created_at")
    .eq("user_id", userId)
    .is("sent_at", null)
    .order("id", { ascending: true })
    .limit(20);
  const list = rows ?? [];
  if (list.length) {
    const ids = list.map((r) => r.id);
    await sb().from("push_outbox").update({ sent_at: new Date().toISOString() }).in("id", ids);
  }
  return list.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    payload: JSON.parse(r.payload_json || "{}"),
    createdAt: r.created_at,
  }));
}
