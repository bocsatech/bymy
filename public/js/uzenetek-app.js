import { requireAuthForPage, initSiteAuth } from "./site-auth.js";
import { initMessagesUi } from "./messages-ui.js?v=msgLive1";

if (!(await requireAuthForPage())) {
  throw new Error("Belépés szükséges");
}
initSiteAuth();

const openId = Number(new URLSearchParams(location.search).get("c"));
const root = document.getElementById("msg-page-root");
initMessagesUi(root, {
  openConversationId: Number.isFinite(openId) && openId > 0 ? openId : undefined,
  onUnreadChange(n) {
    document.querySelectorAll("[data-mm-msg-count], [data-nav-msg-count]").forEach((el) => {
      const count = Number(n) || 0;
      el.hidden = count <= 0;
      el.textContent = String(count);
    });
  },
});
