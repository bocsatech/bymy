import { getAuthUser, loginUrl } from "./site-auth.js?v=authMembersOnly1";
import { findConversationForListing } from "./messages-api.js?v=msgLive2";

export function isOwnListing(sellerId) {
  const me = Number(getAuthUser()?.id);
  const owner = Number(sellerId);
  return Boolean(me > 0 && owner > 0 && me === owner);
}

export function canMessageListing(sellerId, { listingId } = {}) {
  const owner = Number(sellerId);
  if (Number.isFinite(owner) && owner > 0) return !isOwnListing(owner);
  return Number(listingId) > 0;
}

export async function openListingMessage({
  listingId,
  title,
  priceLabel = "",
  meta = "",
  code,
  sellerId,
  sellerName = "",
  redirect = true,
} = {}) {
  const user = getAuthUser();
  if (!user?.email) {
    window.location.href = loginUrl(
      `${location.pathname}${location.search || ""}`
    );
    return null;
  }
  if (!canMessageListing(sellerId, { listingId })) {
    throw new Error(
      isOwnListing(sellerId)
        ? "Saját hirdetésedre nem küldhetsz üzenetet."
        : "Ehhez a hirdetéshez nem indítható üzenet."
    );
  }
  const lookup = {
    listingId: String(listingId),
    title: String(title || `Hirdetés #${listingId}`),
    priceLabel,
    meta,
    code,
    ...(Number(sellerId) > 0 ? { sellerId: Number(sellerId) } : {}),
  };
  const conv = await findConversationForListing(lookup);
  if (redirect) {
    if (conv?.id) {
      window.location.href = `/uzenetek.html?c=${encodeURIComponent(conv.id)}`;
    } else {
      const q = new URLSearchParams({
        compose: "1",
        listing_id: lookup.listingId,
        title: lookup.title,
        price: priceLabel,
        meta,
        code: code || `AEA-${listingId}`,
      });
      if (Number(sellerId) > 0) q.set("seller_id", String(sellerId));
      if (sellerName) q.set("seller_name", sellerName);
      window.location.href = `/uzenetek.html?${q.toString()}`;
    }
  }
  return conv?.id
    ? { conversationId: conv.id, conversation: conv }
    : { compose: true, ...lookup };
}
