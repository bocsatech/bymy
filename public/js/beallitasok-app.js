/**
 * Fiókom — mobile.de Mein mobile / Konto bearbeiten mintára.
 * Szekciók: attekintes | parkolo | keresesek | uzenetek | hirdetes | fiok
 */

import {
  getAuthUser,
  getDisplayName,
  getProfile,
  loadProfileFromServer,
  saveProfile,
  changePassword,
  deleteAccount,
  requireAuthForPage,
  initSiteAuth,
} from "./site-auth.js?v=auth20260805localdb9";
import {
  getParkplatz,
  addParkplatzItem,
  removeParkplatzItem,
  updateParkplatzNote,
  getSavedSearches,
  addSavedSearch,
  removeSavedSearch,
  toggleSavedSearchNotify,
  ensureDemoMessages,
  markMessageRead,
  deleteMessage,
} from "./fok-data.js?v=auth20260805localdb9";

const PHOTO_KEY = "autosweb-avatar-photos";
const NOTIFY_KEY = "autosweb-notify-prefs";
const MAX_BYTES = 2.5 * 1024 * 1024;
const AVATAR_SIZE = 256;
const SECTIONS = ["attekintes", "parkolo", "keresesek", "uzenetek", "hirdetes", "fiok"];

function readPhotos() {
  try {
    return JSON.parse(localStorage.getItem(PHOTO_KEY) || "{}");
  } catch {
    return {};
  }
}

function writePhotos(map) {
  localStorage.setItem(PHOTO_KEY, JSON.stringify(map));
}

function readNotifyPrefs(email) {
  try {
    const all = JSON.parse(localStorage.getItem(NOTIFY_KEY) || "{}");
    return {
      messages: true,
      favorites: true,
      interests: true,
      newsletter: false,
      ...(all[email] ?? {}),
    };
  } catch {
    return { messages: true, favorites: true, interests: true, newsletter: false };
  }
}

function writeNotifyPrefs(email, prefs) {
  let all = {};
  try {
    all = JSON.parse(localStorage.getItem(NOTIFY_KEY) || "{}");
  } catch {
    all = {};
  }
  all[email] = prefs;
  localStorage.setItem(NOTIFY_KEY, JSON.stringify(all));
}

function showFlash(el, message, ok = true) {
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  el.classList.toggle("settings-flash--ok", ok);
  el.classList.toggle("settings-flash--err", !ok);
}

function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      reject(new Error("Csak JPG, PNG vagy WebP tölthető fel."));
      return;
    }
    if (file.size > MAX_BYTES) {
      reject(new Error("A kép maximum 2,5 MB lehet."));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      const ctx = canvas.getContext("2d");
      const side = Math.min(img.width, img.height);
      ctx.drawImage(
        img,
        (img.width - side) / 2,
        (img.height - side) / 2,
        side,
        side,
        0,
        0,
        AVATAR_SIZE,
        AVATAR_SIZE
      );
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("A képet nem sikerült beolvasni."));
    };
    img.src = url;
  });
}

function currentSection() {
  const raw = new URLSearchParams(window.location.search).get("szekcio") || "fiok";
  return SECTIONS.includes(raw) ? raw : "fiok";
}

function setSection(section) {
  const next = SECTIONS.includes(section) ? section : "fiok";
  const url = new URL(window.location.href);
  url.searchParams.set("szekcio", next);
  window.history.replaceState({}, "", url);
  document.querySelectorAll("[data-mm-panel]").forEach((panel) => {
    panel.hidden = panel.getAttribute("data-mm-panel") !== next;
  });
  document.querySelectorAll("[data-mm-nav]").forEach((link) => {
    link.classList.toggle("is-active", link.getAttribute("data-mm-nav") === next);
  });
  document.title =
    {
      attekintes: "Áttekintés",
      parkolo: "Parkoló",
      keresesek: "Mentett kereséseim",
      uzenetek: "Üzenetek",
      hirdetes: "Hirdetésem",
      fiok: "Fiók szerkesztése",
    }[next] + " — Fiókom";
}

function fmtDate(ts) {
  try {
    return new Date(ts).toLocaleString("hu-HU");
  } catch {
    return "";
  }
}

function refreshStats(email) {
  const park = getParkplatz(email);
  const searches = getSavedSearches(email);
  const messages = ensureDemoMessages(email);
  const unread = messages.filter((m) => !m.read).length;

  const parkStat = document.querySelector("[data-mm-stat-park]");
  const searchStat = document.querySelector("[data-mm-stat-search]");
  const msgStat = document.querySelector("[data-mm-stat-msg]");
  const badge = document.querySelector("[data-mm-msg-count]");
  if (parkStat) parkStat.textContent = `${park.length} jármű`;
  if (searchStat) searchStat.textContent = `${searches.length} keresés`;
  if (msgStat) msgStat.textContent = `${unread} olvasatlan`;
  if (badge) {
    badge.hidden = unread === 0;
    badge.textContent = String(unread);
  }
}

function renderPark(email) {
  const list = document.getElementById("mm-park-list");
  const empty = document.getElementById("mm-park-empty");
  const items = getParkplatz(email);
  if (!list) return;
  list.innerHTML = "";
  if (empty) empty.hidden = items.length > 0;
  for (const item of items) {
    const row = document.createElement("article");
    row.className = "mm-list-item";
    row.innerHTML = `
      <div class="mm-list-main">
        <strong>${escapeHtml(item.title)}</strong>
        <span class="mm-list-meta">${escapeHtml(item.price || "Ár nincs megadva")} · ${fmtDate(item.savedAt)}</span>
        <label class="mm-note-field">
          <span>Jegyzet</span>
          <input type="text" data-park-note value="${escapeAttr(item.note || "")}" />
        </label>
      </div>
      <div class="mm-list-actions">
        <button type="button" class="settings-link-btn" data-park-save>Jegyzet mentése</button>
        <button type="button" class="settings-danger-btn" data-park-del>Törlés</button>
      </div>`;
    row.querySelector("[data-park-save]")?.addEventListener("click", () => {
      const note = row.querySelector("[data-park-note]")?.value ?? "";
      updateParkplatzNote(email, item.id, note);
      renderPark(email);
      refreshStats(email);
    });
    row.querySelector("[data-park-del]")?.addEventListener("click", () => {
      removeParkplatzItem(email, item.id);
      renderPark(email);
      refreshStats(email);
    });
    list.appendChild(row);
  }
}

function renderSearches(email) {
  const list = document.getElementById("mm-search-list");
  const empty = document.getElementById("mm-search-empty");
  const items = getSavedSearches(email);
  if (!list) return;
  list.innerHTML = "";
  if (empty) empty.hidden = items.length > 0;
  for (const item of items) {
    const row = document.createElement("article");
    row.className = "mm-list-item";
    row.innerHTML = `
      <div class="mm-list-main">
        <strong>${escapeHtml(item.name)}</strong>
        <span class="mm-list-meta">${escapeHtml(item.query || "Nincs részletes szűrő")} · ${fmtDate(item.savedAt)}</span>
        <span class="mm-list-meta">Értesítés: ${item.notify ? "be" : "ki"}</span>
      </div>
      <div class="mm-list-actions">
        <a class="site-header-btn site-header-btn--outline" href="/">Keresés megnyitása</a>
        <button type="button" class="settings-link-btn" data-search-toggle>Értesítés</button>
        <button type="button" class="settings-danger-btn" data-search-del>Törlés</button>
      </div>`;
    row.querySelector("[data-search-toggle]")?.addEventListener("click", () => {
      toggleSavedSearchNotify(email, item.id);
      renderSearches(email);
    });
    row.querySelector("[data-search-del]")?.addEventListener("click", () => {
      removeSavedSearch(email, item.id);
      renderSearches(email);
      refreshStats(email);
    });
    list.appendChild(row);
  }
}

function renderMessages(email) {
  const list = document.getElementById("mm-msg-list");
  const empty = document.getElementById("mm-msg-empty");
  const items = ensureDemoMessages(email);
  if (!list) return;
  list.innerHTML = "";
  if (empty) empty.hidden = items.length > 0;
  for (const item of items) {
    const row = document.createElement("article");
    row.className = `mm-list-item${item.read ? "" : " is-unread"}`;
    row.innerHTML = `
      <div class="mm-list-main">
        <strong>${escapeHtml(item.subject)}</strong>
        <span class="mm-list-meta">${escapeHtml(item.from)} · ${fmtDate(item.at)}</span>
        <p class="mm-msg-body">${escapeHtml(item.body)}</p>
      </div>
      <div class="mm-list-actions">
        <button type="button" class="settings-link-btn" data-msg-read>Olvasott</button>
        <button type="button" class="settings-danger-btn" data-msg-del>Törlés</button>
      </div>`;
    row.querySelector("[data-msg-read]")?.addEventListener("click", () => {
      markMessageRead(email, item.id);
      renderMessages(email);
      refreshStats(email);
    });
    row.querySelector("[data-msg-del]")?.addEventListener("click", () => {
      deleteMessage(email, item.id);
      renderMessages(email);
      refreshStats(email);
    });
    list.appendChild(row);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function updateProfileSummary(profile) {
  const el = document.getElementById("settings-profile-summary");
  if (!el) return;
  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();
  el.textContent = name ? `Mentett név: ${name}` : "Mentett név: még nincs — töltsd ki és mentsd el.";
}

async function refreshDbInspect() {
  const el = document.getElementById("settings-db-inspect");
  if (!el) return;
  try {
    const token = localStorage.getItem("autosweb-auth-token") || "";
    const res = await fetch("/api/auth/db", {
      credentials: "same-origin",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json();
    const lines = [];
    lines.push(`DB fájl: ${data.dbPath || "?"}`);
    lines.push(`Profil fájl: ${data.profilesPath || "?"}`);
    lines.push(`Userek száma: ${data.userCount ?? 0}`);
    lines.push(`Aktív session: ${data.sessionCount ?? 0}`);
    lines.push(`Te (bejelentkezve): ${data.currentEmail || "—"}`);
    lines.push(
      `Te profil (API): ${
        data.currentProfile?.firstName
          ? `${data.currentProfile.firstName} ${data.currentProfile.lastName || ""}`.trim()
          : "(üres)"
      }`
    );
    lines.push("");
    if (!data.users?.length) {
      lines.push("NINCS user a SQLite-ban. Regisztrálj újra ezen a gépen.");
    } else {
      for (const u of data.users) {
        const sqlName = [u.sqliteProfile?.firstName, u.sqliteProfile?.lastName].filter(Boolean).join(" ");
        const fileName = [u.fileProfile?.firstName, u.fileProfile?.lastName].filter(Boolean).join(" ");
        lines.push(`#${u.id} ${u.email}`);
        lines.push(`  SQLite név: ${sqlName || "(üres)"}`);
        lines.push(`  Fájl név:   ${fileName || "(üres)"}`);
        lines.push(`  frissítve:  ${u.updatedAt || "?"}`);
      }
    }
    el.textContent = lines.join("\n");
  } catch (error) {
    el.textContent = `Adatbázis nem olvasható: ${error.message || error}`;
  }
}

function applyProfileToForm(profile) {
  const form = document.getElementById("mm-profile-form");
  if (!form) return;
  const data = { ...getProfile(), ...(profile || {}) };
  const keys = [
    "salutation",
    "firstName",
    "lastName",
    "street",
    "postalCode",
    "city",
    "country",
    "phone",
    "company",
    "accountType",
  ];
  for (const key of keys) {
    const field = form.querySelector(`[name="${key}"]`);
    if (!field) continue;
    const value = data[key] ?? "";
    field.value = value;
  }
  updateProfileSummary(data);
}

function fillProfileForm(user, profileOverride = null) {
  const form = document.getElementById("mm-profile-form");
  if (!form) return;
  const profile = profileOverride || getProfile();
  applyProfileToForm(profile);
  const emailEl = document.getElementById("settings-email");
  if (emailEl) emailEl.textContent = user?.email || "—";
  const companyWrap = document.querySelector("[data-mm-company-wrap]");
  if (companyWrap) companyWrap.hidden = profile.accountType !== "business";

  const photo = user?.email ? readPhotos()[user.email] : null;
  const letterEl = document.getElementById("settings-avatar-letter");
  const imgEl = document.getElementById("settings-avatar-img");
  const letter = (user?.email?.charAt(0) || "A").toUpperCase();
  if (letterEl) {
    letterEl.textContent = letter;
    letterEl.hidden = Boolean(photo);
  }
  if (imgEl) {
    if (photo) {
      imgEl.src = photo;
      imgEl.hidden = false;
    } else {
      imgEl.removeAttribute("src");
      imgEl.hidden = true;
    }
  }
}

function initNotifyForm(email) {
  const form = document.getElementById("settings-notify-form");
  if (!form) return;
  const prefs = readNotifyPrefs(email);
  for (const [key, value] of Object.entries(prefs)) {
    const input = form.elements.namedItem(key);
    if (input && "checked" in input) input.checked = Boolean(value);
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    writeNotifyPrefs(email, {
      messages: Boolean(form.messages?.checked),
      favorites: Boolean(form.favorites?.checked),
      interests: Boolean(form.interests?.checked),
      newsletter: Boolean(form.newsletter?.checked),
    });
    showFlash(document.getElementById("settings-notify-flash"), "Értesítési beállítások mentve.", true);
  });
}

export async function initSettingsPage() {
  const ok = await requireAuthForPage();
  if (!ok) return;
  let loadedProfile = null;
  try {
    loadedProfile = await loadProfileFromServer();
  } catch {
    /* session már ellenőrizve */
  }
  const user = getAuthUser();
  if (!user?.email) return;

  const hello = document.querySelector("[data-mm-hello]");
  if (hello) hello.textContent = getDisplayName() || user.email.split("@")[0];

  setSection(currentSection());
  refreshStats(user.email);
  renderPark(user.email);
  renderSearches(user.email);
  renderMessages(user.email);
  fillProfileForm(user, loadedProfile);
  // Második kör: ha a panel most vált láthatóra, biztosan kitöltjük.
  requestAnimationFrame(() => fillProfileForm(getAuthUser(), loadedProfile || getProfile()));
  initNotifyForm(user.email);
  refreshDbInspect();
  document.getElementById("settings-db-refresh")?.addEventListener("click", () => {
    refreshDbInspect();
  });

  document.querySelectorAll("[data-mm-nav]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      setSection(link.getAttribute("data-mm-nav"));
      if (link.getAttribute("data-mm-nav") === "fiok") {
        fillProfileForm(getAuthUser(), getProfile());
      }
    });
  });

  document.getElementById("mm-park-add")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    addParkplatzItem(user.email, {
      title: data.get("title"),
      price: data.get("price"),
    });
    event.currentTarget.reset();
    renderPark(user.email);
    refreshStats(user.email);
  });

  document.getElementById("mm-search-add")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    addSavedSearch(user.email, {
      name: data.get("name"),
      query: data.get("query"),
      notify: Boolean(data.get("notify")),
    });
    event.currentTarget.reset();
    renderSearches(user.email);
    refreshStats(user.email);
  });

  const profileForm = document.getElementById("mm-profile-form");
  profileForm?.elements?.namedItem("accountType")?.addEventListener("change", () => {
    const wrap = document.querySelector("[data-mm-company-wrap]");
    if (wrap) wrap.hidden = profileForm.accountType.value !== "business";
  });

  // A submit listener korán kötődik (bindProfileFormEarly) — itt csak a hello frissül mentés után.

  document.getElementById("settings-password-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const flash = document.getElementById("settings-password-flash");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await changePassword(data.get("current_password"), data.get("new_password"), data.get("new_password_confirm"));
      form.reset();
      showFlash(flash, "Jelszó sikeresen módosítva.", true);
    } catch (error) {
      showFlash(flash, error.message ?? "Jelszó módosítás sikertelen.", false);
    }
  });

  const fileInput = document.getElementById("settings-avatar-file");
  document.getElementById("settings-avatar-upload")?.addEventListener("click", () => fileInput?.click());
  document.getElementById("settings-avatar-remove")?.addEventListener("click", () => {
    const map = readPhotos();
    delete map[user.email];
    writePhotos(map);
    fillProfileForm(user);
    window.dispatchEvent(new CustomEvent("autosweb-auth-changed"));
    showFlash(document.getElementById("settings-avatar-flash"), "Profilkép törölve.", true);
  });
  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    const flash = document.getElementById("settings-avatar-flash");
    try {
      const dataUrl = await resizeImageFile(file);
      const map = readPhotos();
      map[user.email] = dataUrl;
      writePhotos(map);
      fillProfileForm(user);
      window.dispatchEvent(new CustomEvent("autosweb-auth-changed"));
      showFlash(flash, "Profilkép feltöltve.", true);
    } catch (error) {
      showFlash(flash, error.message ?? "Feltöltés sikertelen.", false);
    }
  });

  document.getElementById("settings-delete-account")?.addEventListener("click", async () => {
    if (!window.confirm("Biztosan törölni szeretnéd a fiókodat? Ez a helyi demó-fiókot törli.")) return;
    try {
      await deleteAccount();
      window.location.href = "/";
    } catch (error) {
      window.alert(error.message ?? "Törlés sikertelen.");
    }
  });

  window.addEventListener("popstate", () => setSection(currentSection()));
}

/** Mentés listener AZONNAL — ne várjon az auth hálózatra (különben natív submit = nincs mentés). */
function bindProfileFormEarly() {
  const profileForm = document.getElementById("mm-profile-form");
  if (!profileForm || profileForm.dataset.bound === "1") return;
  profileForm.dataset.bound = "1";

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const flash = document.getElementById("settings-profile-flash");
    const pathEl = document.getElementById("settings-profile-path");
    const btn = document.getElementById("mm-profile-save");
    const data = Object.fromEntries(new FormData(profileForm).entries());
    if (!String(data.firstName || "").trim() || !String(data.lastName || "").trim()) {
      showFlash(flash, "Keresztnév és vezetéknév kötelező.", false);
      return;
    }
    if (btn) btn.disabled = true;
    try {
      const saved = await saveProfile(data);
      applyProfileToForm(saved);
      const user = getAuthUser();
      if (user) fillProfileForm(user, saved);
      const hello = document.querySelector("[data-mm-hello]");
      if (hello) hello.textContent = getDisplayName();
      window.dispatchEvent(new CustomEvent("autosweb-auth-changed"));
      showFlash(
        flash,
        `Mentve: ${saved.firstName} ${saved.lastName}. Újraindítás után is megmarad.`,
        true
      );
      if (pathEl) {
        pathEl.hidden = false;
        pathEl.textContent = saved._savedTo
          ? `Fájl: ${saved._savedTo}`
          : "Helyi profil fájlba írva (~/.autosweb/profiles.json).";
      }
      // Görgetés a visszajelzéshez (a kártya tetején van).
      flash?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      await refreshDbInspect();
    } catch (error) {
      showFlash(flash, error.message ?? "Mentés sikertelen.", false);
      flash?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      await refreshDbInspect();
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

bindProfileFormEarly();
initSiteAuth({ skipRefresh: true });
initSettingsPage();
