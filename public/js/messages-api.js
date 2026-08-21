/**
 * Üzenetek API — ugyanaz, mint a mobil MessagesAPI.swift:
 * /api/messages/* (szerver SQLite, később VPS).
 */

const TOKEN_KEY = "bymy-auth-token";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

async function messagesFetch(path, { method = "GET", body } = {}) {
  const token = getToken();
  if (!token) {
    const err = new Error("Jelentkezz be az üzenetekhez.");
    err.code = "not_logged_in";
    throw err;
  }
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const err = new Error("A szerver most nem elérhető. Próbáld újra.");
    err.code = "unreachable";
    throw err;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      data.error === "Ismeretlen API."
        ? "Az üzenetek most nem elérhetők. Próbáld újra."
        : data.error || `HTTP ${response.status}`;
    const err = new Error(msg);
    err.status = response.status;
    throw err;
  }
  return data;
}

export async function listConversations() {
  const data = await messagesFetch("/api/messages/conversations");
  return Array.isArray(data.conversations) ? data.conversations : [];
}

export async function startConversation({
  listingId,
  title,
  priceLabel = "",
  meta = "",
  code,
  sellerId,
}) {
  const body = {
    listing_id: listingId,
    listing_title: title,
    listing_price_label: priceLabel,
    listing_meta: meta,
    listing_code: code || `AEA-${listingId}`,
  };
  const sid = Number(sellerId);
  if (Number.isFinite(sid) && sid > 0) body.seller_id = sid;
  const data = await messagesFetch("/api/messages/conversations", {
    method: "POST",
    body,
  });
  return data.conversation;
}

export async function listMessages(conversationId) {
  const data = await messagesFetch(
    `/api/messages/conversations/${conversationId}/messages`
  );
  return {
    conversation: data.conversation,
    messages: Array.isArray(data.messages) ? data.messages : [],
  };
}

export async function sendMessage(conversationId, { body = "", attachment = null } = {}) {
  const payload = { body };
  if (attachment) {
    payload.attachment = {
      filename: attachment.filename,
      mime: attachment.mime,
      data_base64: attachment.dataBase64,
    };
  }
  const data = await messagesFetch(
    `/api/messages/conversations/${conversationId}/messages`,
    { method: "POST", body: payload }
  );
  return data.message;
}

export async function markRead(conversationId) {
  return messagesFetch(`/api/messages/conversations/${conversationId}/read`, {
    method: "POST",
    body: {},
  });
}

export async function markUnread(conversationId) {
  return messagesFetch(`/api/messages/conversations/${conversationId}/unread`, {
    method: "POST",
    body: {},
  });
}

export async function deleteConversation(conversationId) {
  return messagesFetch(`/api/messages/conversations/${conversationId}`, {
    method: "DELETE",
  });
}

export async function reportConversation(conversationId, reason = "") {
  return messagesFetch(`/api/messages/conversations/${conversationId}/report`, {
    method: "POST",
    body: { reason },
  });
}

export async function blockUser(userId) {
  return messagesFetch("/api/messages/block", {
    method: "POST",
    body: { user_id: userId },
  });
}

export function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Nincs fájl."));
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      reject(new Error("A csatolmány maximum 10 MB lehet."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const dataBase64 = result.includes(",") ? result.split(",")[1] : result;
      resolve({
        filename: file.name || "file",
        mime: file.type || "application/octet-stream",
        dataBase64,
      });
    };
    reader.onerror = () => reject(new Error("A fájlt nem sikerült beolvasni."));
    reader.readAsDataURL(file);
  });
}
