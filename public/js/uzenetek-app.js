import { requireAuthForPage, initSiteAuth } from "./site-auth.js";
import { initMessagesUi } from "./messages-ui.js?v=inboxInline1";

if (!(await requireAuthForPage())) {
  throw new Error("Belépés szükséges");
}
initSiteAuth();

const params = new URLSearchParams(location.search);
const openId = Number(params.get("c"));
const composeDraft =
  params.get("compose") === "1" && params.get("listing_id")
    ? {
        listingId: params.get("listing_id"),
        title: params.get("title") || `Hirdetés #${params.get("listing_id")}`,
        priceLabel: params.get("price") || "",
        meta: params.get("meta") || "",
        code: params.get("code") || `AEA-${params.get("listing_id")}`,
        sellerId: Number(params.get("seller_id")) || 0,
        sellerName: params.get("seller_name") || "",
      }
    : null;
const root = document.getElementById("msg-page-root");
initMessagesUi(root, {
  openConversationId: Number.isFinite(openId) && openId > 0 ? openId : undefined,
  composeDraft,
  onUnreadChange(n) {
    document.querySelectorAll("[data-mm-msg-count], [data-nav-msg-count]").forEach((el) => {
      const count = Number(n) || 0;
      el.hidden = count <= 0;
      el.textContent = String(count);
    });
  },
});
