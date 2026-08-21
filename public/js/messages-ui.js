/**
 * Üzenetek UI — willhaben Nachrichten/chat másolat (fehér, magyar).
 * Adat: /api/messages/*
 */

import { getAuthUser } from "./site-auth.js?v=auth20260805localdb9";
import {
  listConversations,
  listMessages,
  sendMessage,
  markRead,
  markUnread,
  deleteConversation,
  reportConversation,
  blockUser,
  fileToAttachment,
} from "./messages-api.js?v=msgLive1";

const ICONS = {
  unread: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.8 7.2h11.2A2.4 2.4 0 0 1 18.4 9.6v5.6a2.4 2.4 0 0 1-2.4 2.4H9.2L6 20v-2.4H4.8A2.4 2.4 0 0 1 2.4 15.2V9.6A2.4 2.4 0 0 1 4.8 7.2Z" stroke="currentColor" stroke-width="1.6"/><path d="M7 11.2h7.2M7 14h4.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  block: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.7"/><path d="M6.4 6.4 17.6 17.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  report: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4 20 18.5H4L12 4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 10v4.5M12 16.8h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  trash: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7.2h14M9.5 7.2V5.6h5v1.6M8.4 7.2l.7 11h6l.7-11" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M10.4 11v4.8M13.6 11v4.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  checks: `<svg width="18" height="12" viewBox="0 0 18 12" fill="none" aria-hidden="true"><path d="m1 6.2 2.4 2.4L8.2 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="m6.2 6.2 2.4 2.4L14.8 2.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  menu: `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5.5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="18.5" r="1.6"/></svg>`,
  back: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15.2 5.5 9 12l6.2 6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  paperclip: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M16.2 7.8v7.8a4.2 4.2 0 0 1-8.4 0V7.5a2.8 2.8 0 1 1 5.6 0v7.7a1.4 1.4 0 0 1-2.8 0V8.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  send: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.2 10.8 20.4 3.4c.75-.32 1.45.42 1.1 1.15L14.2 20.8c-.32.7-1.35.62-1.55-.12l-1.7-6.4-6.55-1.75c-.78-.2-.85-1.25-.2-1.73Z"/></svg>`,
  car: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.8 14h2.2l1.2-2.5h8l1.3 2.5h2.1a1.7 1.7 0 0 1 1.7 1.7v1.9a1.1 1.1 0 0 1-1.1 1.1h-.7" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/><circle cx="7.1" cy="18.5" r="1.35" stroke="currentColor" stroke-width="1.35"/><circle cx="15.4" cy="18.5" r="1.35" stroke="currentColor" stroke-width="1.35"/><path d="M4.8 14 6.3 9.6h11.4L19.2 14" stroke="currentColor" stroke-width="1.35"/></svg>`,
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shortDate(iso) {
  const raw = String(iso || "").slice(0, 10);
  if (!raw) return "";
  const [y, m, d] = raw.split("-");
  return `${d}.${m}.${String(y).slice(2)}`;
}

function dayLabel(iso) {
  const day = String(iso || "").slice(0, 10);
  if (!day) return "";
  const today = new Date();
  const ymd = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (day === ymd(today)) return "Ma";
  if (day === ymd(yesterday)) return "Tegnap";
  return day.replaceAll("-", ".");
}

function timeOnly(iso) {
  const s = String(iso || "");
  if (s.length >= 16) return s.slice(11, 16);
  return s;
}

function currentUserId() {
  return Number(getAuthUser()?.id) || 0;
}

function peerLetter(name) {
  return String(name || "?").trim().charAt(0).toUpperCase() || "?";
}

export function initMessagesUi(root, { onUnreadChange, openConversationId } = {}) {
  if (!root) return { refresh: async () => {} };

  let conversations = [];
  let editing = false;
  let openConv = null;
  let messages = [];
  let busy = false;
  const options = { openConversationId };

  root.innerHTML = `
    <div class="wh-msg" data-msg-view="inbox">
      <aside class="wh-msg__list">
        <header class="wh-msg__list-head">
          <h1 class="wh-msg__title">Üzenetek</h1>
          <button type="button" class="wh-msg__edit" data-msg-edit>Szerkesztés</button>
        </header>
        <div class="wh-msg__state" data-msg-state hidden></div>
        <div class="wh-msg__rows" data-msg-list></div>
        <div class="wh-msg__empty" data-msg-empty hidden>
          <p><strong>Nincs még üzeneted.</strong></p>
          <p>Egy hirdetésnél kattints az Üzenet gombra.</p>
        </div>
      </aside>

      <section class="wh-msg__chat" data-msg-thread>
        <div class="wh-msg__idle" data-msg-placeholder>
          <p>Válassz egy beszélgetést.</p>
        </div>

        <div class="wh-msg__active" data-msg-thread-main hidden>
          <header class="wh-msg__chat-head">
            <button type="button" class="wh-msg__icon-btn wh-msg__back" data-msg-back aria-label="Vissza">${ICONS.back}</button>
            <div class="wh-msg__peer">
              <strong data-msg-peer>—</strong>
              <span data-msg-peer-status></span>
            </div>
            <div class="wh-msg__menu-wrap">
              <button type="button" class="wh-msg__icon-btn" data-msg-menu aria-label="Műveletek" aria-haspopup="menu" aria-expanded="false">${ICONS.menu}</button>
              <div class="wh-msg__menu" data-msg-actions role="menu" hidden>
                <button type="button" role="menuitem" data-msg-action="unread">
                  <span class="wh-msg__menu-ico">${ICONS.unread}</span>
                  <span>Megjelölés olvasatlanként</span>
                </button>
                <button type="button" role="menuitem" data-msg-action="block">
                  <span class="wh-msg__menu-ico">${ICONS.block}</span>
                  <span>Felhasználó tiltása</span>
                </button>
                <button type="button" role="menuitem" data-msg-action="report">
                  <span class="wh-msg__menu-ico">${ICONS.report}</span>
                  <span>Beszélgetés jelentése</span>
                </button>
                <button type="button" role="menuitem" class="is-danger" data-msg-action="delete">
                  <span class="wh-msg__menu-ico">${ICONS.trash}</span>
                  <span>Beszélgetés törlése</span>
                </button>
              </div>
            </div>
          </header>

          <div class="wh-msg__ad" data-msg-listing></div>
          <div class="wh-msg__stream" data-msg-bubbles></div>
          <p class="wh-msg__error" data-msg-thread-error hidden></p>

          <form class="wh-msg__composer" data-msg-composer>
            <label class="wh-msg__attach" title="Csatolmány">
              ${ICONS.paperclip}
              <input type="file" accept="image/*,.pdf,.doc,.docx,application/pdf" hidden data-msg-file />
            </label>
            <input type="text" class="wh-msg__input" name="body" placeholder="Üzenet írása…" autocomplete="off" data-msg-draft />
            <button type="submit" class="wh-msg__send" data-msg-send aria-label="Küldés">${ICONS.send}</button>
          </form>
        </div>
      </section>
    </div>
  `;

  const els = {
    shell: root.querySelector(".wh-msg"),
    editBtn: root.querySelector("[data-msg-edit]"),
    state: root.querySelector("[data-msg-state]"),
    list: root.querySelector("[data-msg-list]"),
    empty: root.querySelector("[data-msg-empty]"),
    placeholder: root.querySelector("[data-msg-placeholder]"),
    threadMain: root.querySelector("[data-msg-thread-main]"),
    peer: root.querySelector("[data-msg-peer]"),
    peerStatus: root.querySelector("[data-msg-peer-status]"),
    listing: root.querySelector("[data-msg-listing]"),
    bubbles: root.querySelector("[data-msg-bubbles]"),
    threadError: root.querySelector("[data-msg-thread-error]"),
    draft: root.querySelector("[data-msg-draft]"),
    file: root.querySelector("[data-msg-file]"),
    menuBtn: root.querySelector("[data-msg-menu]"),
    actions: root.querySelector("[data-msg-actions]"),
  };

  function setUnreadBadge() {
    const n = conversations.reduce((sum, c) => sum + (Number(c.unread) || 0), 0);
    onUnreadChange?.(n);
  }

  function showState(text, isError = false) {
    if (!els.state) return;
    if (!text) {
      els.state.hidden = true;
      els.state.textContent = "";
      return;
    }
    els.state.hidden = false;
    els.state.textContent = text;
    els.state.classList.toggle("is-error", isError);
  }

  function closeMenu() {
    if (els.actions) els.actions.hidden = true;
    els.menuBtn?.setAttribute("aria-expanded", "false");
  }

  function showInboxOnly() {
    openConv = null;
    els.shell?.setAttribute("data-msg-view", "inbox");
    if (els.placeholder) els.placeholder.hidden = false;
    if (els.threadMain) els.threadMain.hidden = true;
    closeMenu();
    renderList();
  }

  function showThreadPane() {
    els.shell?.setAttribute("data-msg-view", "thread");
    if (els.placeholder) els.placeholder.hidden = true;
    if (els.threadMain) els.threadMain.hidden = false;
  }

  function renderList() {
    if (!els.list) return;
    els.list.innerHTML = "";
    const has = conversations.length > 0;
    if (els.empty) els.empty.hidden = has;
    els.list.hidden = !has;
    setUnreadBadge();

    for (const conv of conversations) {
      const active = openConv && Number(openConv.id) === Number(conv.id);
      const row = document.createElement("button");
      row.type = "button";
      row.className = `wh-msg__row${conv.unread > 0 ? " is-unread" : ""}${active ? " is-active" : ""}`;
      const peerName = conv.peer?.displayName || "Ismeretlen";
      const letter = peerLetter(peerName);
      const preview = conv.lastMessage?.body || "Új beszélgetés";
      row.innerHTML = `
        <span class="wh-msg__thumb" aria-hidden="true">
          <span class="wh-msg__thumb-img">${ICONS.car}</span>
          <span class="wh-msg__thumb-avatar">${escapeHtml(letter)}</span>
        </span>
        <span class="wh-msg__row-body">
          <span class="wh-msg__row-top">
            <span class="wh-msg__row-name">${escapeHtml(peerName)}</span>
            <time class="wh-msg__row-date">${escapeHtml(shortDate(conv.updatedAt))}</time>
          </span>
          <span class="wh-msg__row-ad">${escapeHtml(conv.listing?.title || "")}</span>
          <span class="wh-msg__row-bottom">
            <span class="wh-msg__row-preview">${escapeHtml(preview)}</span>
            ${
              conv.unread > 0
                ? `<span class="wh-msg__badge">${escapeHtml(String(conv.unread))}</span>`
                : conv.lastMessage
                  ? `<span class="wh-msg__ticks" aria-hidden="true">${ICONS.checks}</span>`
                  : ""
            }
          </span>
        </span>
        ${editing ? `<span class="wh-msg__row-del" data-msg-del="${conv.id}">Törlés</span>` : ""}
      `;
      row.addEventListener("click", (event) => {
        if (event.target.closest("[data-msg-del]")) return;
        openConversation(conv);
      });
      row.querySelector("[data-msg-del]")?.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!window.confirm("Törlöd a beszélgetést?")) return;
        try {
          await deleteConversation(conv.id);
          if (openConv && Number(openConv.id) === Number(conv.id)) showInboxOnly();
          await refresh();
        } catch (error) {
          showState(error.message || "Törlés sikertelen.", true);
        }
      });
      els.list.appendChild(row);
    }
  }

  function renderBubbles() {
    if (!els.bubbles || !openConv) return;
    const myId = currentUserId();
    const letter = peerLetter(openConv.peer?.displayName);
    const groups = new Map();
    for (const msg of messages) {
      const day = String(msg.createdAt || "").slice(0, 10);
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day).push(msg);
    }
    const parts = [];
    for (const [day, items] of groups) {
      parts.push(`<div class="wh-msg__day"><span>${escapeHtml(dayLabel(day))}</span></div>`);
      for (const msg of items) {
        const mine = Number(msg.senderId) === myId;
        const att = msg.attachment
          ? `<a class="wh-msg__file" href="${escapeHtml(msg.attachment.url || "#")}" target="_blank" rel="noopener">${escapeHtml(msg.attachment.name || "csatolmány")}</a>`
          : "";
        parts.push(`
          <div class="wh-msg__bubble-row ${mine ? "is-out" : "is-in"}">
            ${mine ? "" : `<span class="wh-msg__bubble-avatar" aria-hidden="true">${escapeHtml(letter)}</span>`}
            <div class="wh-msg__bubble-col">
              <div class="wh-msg__bubble">
                ${msg.body ? `<p>${escapeHtml(msg.body)}</p>` : ""}
                ${att}
              </div>
              <div class="wh-msg__meta">
                <time>${escapeHtml(timeOnly(msg.createdAt))}</time>
                ${mine ? `<span class="wh-msg__ticks" aria-hidden="true">${ICONS.checks}</span>` : ""}
              </div>
            </div>
          </div>
        `);
      }
    }
    els.bubbles.innerHTML = parts.join("");
    els.bubbles.scrollTop = els.bubbles.scrollHeight;
  }

  function renderListingBar() {
    if (!els.listing || !openConv) return;
    els.listing.innerHTML = `
      <div class="wh-msg__ad-img" aria-hidden="true">${ICONS.car}</div>
      <div class="wh-msg__ad-text">
        <strong>${escapeHtml(openConv.listing?.title || "")}</strong>
        <span class="wh-msg__ad-price">${escapeHtml(openConv.listing?.priceLabel || "")}</span>
        <span class="wh-msg__ad-code">Bymy kód: ${escapeHtml(openConv.listing?.code || "")}</span>
      </div>
    `;
  }

  async function openConversation(conv) {
    openConv = conv;
    if (els.peer) els.peer.textContent = conv.peer?.displayName || "—";
    if (els.peerStatus) els.peerStatus.textContent = "Bymy üzenet";
    renderListingBar();
    showThreadPane();
    showThreadError("");
    closeMenu();
    renderList();
    try {
      const data = await listMessages(conv.id);
      openConv = data.conversation || conv;
      messages = data.messages;
      if (els.peer) els.peer.textContent = openConv.peer?.displayName || "—";
      renderListingBar();
      renderBubbles();
      await markRead(conv.id);
      const row = conversations.find((c) => Number(c.id) === Number(conv.id));
      if (row) row.unread = 0;
      setUnreadBadge();
      renderList();
    } catch (error) {
      showThreadError(error.message || "Betöltés sikertelen.");
    }
  }

  function showThreadError(text) {
    if (!els.threadError) return;
    els.threadError.hidden = !text;
    els.threadError.textContent = text || "";
  }

  async function refresh() {
    showState("Betöltés…");
    try {
      conversations = await listConversations();
      showState("");
      renderList();
      if (openConv) {
        const still = conversations.find((c) => Number(c.id) === Number(openConv.id));
        if (!still) showInboxOnly();
      }
    } catch (error) {
      conversations = [];
      renderList();
      showState(error.message || "Betöltés sikertelen.", true);
      if (els.empty) els.empty.hidden = true;
    }
  }

  els.editBtn?.addEventListener("click", () => {
    editing = !editing;
    els.editBtn.textContent = editing ? "Kész" : "Szerkesztés";
    renderList();
  });

  root.querySelector("[data-msg-back]")?.addEventListener("click", async () => {
    showInboxOnly();
    await refresh();
  });

  els.menuBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!els.actions) return;
    const open = els.actions.hidden;
    els.actions.hidden = !open;
    els.menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  document.addEventListener("click", (event) => {
    if (!root.contains(event.target)) return;
    if (event.target.closest("[data-msg-menu], [data-msg-actions]")) return;
    closeMenu();
  });

  els.actions?.addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-msg-action]");
    if (!btn || !openConv) return;
    const action = btn.getAttribute("data-msg-action");
    closeMenu();
    try {
      if (action === "unread") {
        await markUnread(openConv.id);
        showInboxOnly();
        await refresh();
      } else if (action === "block") {
        if (!window.confirm(`Tiltod a felhasználót: ${openConv.peer?.displayName || ""}?`)) return;
        await blockUser(openConv.peer?.id);
        showInboxOnly();
        await refresh();
      } else if (action === "report") {
        const reason = window.prompt("Miért jelented a beszélgetést? (opcionális)", "") ?? "";
        const result = await reportConversation(openConv.id, reason);
        window.alert(result.message || "Köszönjük, a jelentést megkaptuk.");
      } else if (action === "delete") {
        if (!window.confirm("Törlöd a beszélgetést?")) return;
        await deleteConversation(openConv.id);
        showInboxOnly();
        await refresh();
      }
    } catch (error) {
      showThreadError(error.message || "Művelet sikertelen.");
    }
  });

  root.querySelector("[data-msg-composer]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!openConv || busy) return;
    const text = String(els.draft?.value || "").trim();
    if (!text) return;
    busy = true;
    try {
      await sendMessage(openConv.id, { body: text });
      if (els.draft) els.draft.value = "";
      const data = await listMessages(openConv.id);
      openConv = data.conversation || openConv;
      messages = data.messages;
      renderBubbles();
      await markRead(openConv.id);
      await refresh();
    } catch (error) {
      showThreadError(error.message || "Küldés sikertelen.");
    } finally {
      busy = false;
    }
  });

  els.file?.addEventListener("change", async () => {
    const file = els.file.files?.[0];
    els.file.value = "";
    if (!file || !openConv || busy) return;
    busy = true;
    try {
      const attachment = await fileToAttachment(file);
      const text = String(els.draft?.value || "").trim();
      await sendMessage(openConv.id, { body: text, attachment });
      if (els.draft) els.draft.value = "";
      const data = await listMessages(openConv.id);
      openConv = data.conversation || openConv;
      messages = data.messages;
      renderBubbles();
      await markRead(openConv.id);
    } catch (error) {
      showThreadError(error.message || "Csatolmány küldése sikertelen.");
    } finally {
      busy = false;
    }
  });

  showInboxOnly();
  refresh().then(async () => {
    const openId = Number(options?.openConversationId);
    if (Number.isFinite(openId) && openId > 0) {
      const found = conversations.find((c) => Number(c.id) === openId);
      if (found) openConversation(found);
    }
  });
  return {
    refresh,
    showInbox: showInboxOnly,
    openById: async (id) => {
      await refresh();
      const found = conversations.find((c) => Number(c.id) === Number(id));
      if (found) await openConversation(found);
    },
  };
}
