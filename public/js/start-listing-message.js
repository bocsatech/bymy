/**
 * Hirdetés → belső üzenet (éles: valódi tulajdonos).
 */
import { getAuthUser, loginUrl } from "./site-auth.js";
import { startConversation } from "./messages-api.js?v=msgLive1";

export function isOwnListing(sellerId) {
  const me = Number(getAuthUser()?.id);
  const owner = Number(sellerId);
  return Boolean(me > 0 && owner > 0 && me === owner);
}

export function canMessageListing(sellerId) {
  const owner = Number(sellerId);
  if (!Number.isFinite(owner) || owner <= 0) return false;
  return !isOwnListing(owner);
}

/**
 * @returns {Promise<{ conversationId: number } | null>}
 */
export async function openListingMessage({
  listingId,
  title,
  priceLabel = "",
  meta = "",
  code,
  sellerId,
  redirect = true,
} = {}) {
  const user = getAuthUser();
  if (!user?.email) {
    window.location.href = loginUrl(
      `${location.pathname}${location.search || ""}`
    );
    return null;
  }
  if (!canMessageListing(sellerId)) {
    throw new Error(
      isOwnListing(sellerId)
        ? "Saját hirdetésedre nem küldhetsz üzenetet."
        : "Ehhez a hirdetéshez nem indítható üzenet."
    );
  }
  const conv = await startConversation({
    listingId: String(listingId),
    title: String(title || `Hirdetés #${listingId}`),
    priceLabel,
    meta,
    code,
    sellerId: Number(sellerId),
  });
  if (redirect && conv?.id) {
    window.location.href = `/uzenetek.html?c=${encodeURIComponent(conv.id)}`;
  }
  return conv?.id ? { conversationId: conv.id, conversation: conv } : null;
}
