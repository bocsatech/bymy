/**
 * Fiókom — mobile.de Mein mobile / Konto bearbeiten mintára.
 * Szekciók: attekintes | import | nyomtatasok | ertekelesek | parkolo | keresesek |
 *           uzenetek | hirdetes | megjelenes | fiok
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
} from "./fok-data.js?v=auth20260805localdb9";
import { initMessagesUi } from "./messages-ui.js?v=messagesWh2";
import { listConversations } from "./messages-api.js?v=messagesWh2";
import { initMyAdsPanel } from "./my-ads.js?v=hdView1";

const PHOTO_KEY = "bymy-avatar-photos";
const NOTIFY_KEY = "bymy-notify-prefs";
const SEARCH_POSTAL_KEY = "bymy_stats_postal";
const SEARCH_RADIUS_KEY = "bymy_stats_radius_km";
const REC_POSTAL_KEY = "bymy_partner_postal_code";
const REC_RADIUS_KEY = "bymy_partner_radius_km";
const MAX_BYTES = 2.5 * 1024 * 1024;
const HERO_MAX_BYTES = 8 * 1024 * 1024;
const AVATAR_SIZE = 256;
const SECTIONS = [
  "attekintes",
  "import",
  "nyomtatasok",
  "ertekelesek",
  "parkolo",
  "keresesek",
  "uzenetek",
  "hirdetes",
  "megjelenes",
  "fiok",
];
const CAT_STORAGE_KEY = "bymy-hirdetes-category";
const CAT_STORAGE_VERSION = 2;
const SEARCH_RADIUS_OPTIONS = [5, 10, 15, 20, 30, 50, 75, 100];
const REC_RADIUS_OPTIONS = [5, 10, 15, 20, 30];
const AUTH_TOKEN_KEY = "bymy-auth-token";

let lastLookedUpPostal = "";
let cityLookupBusy = false;
let heroState = null;

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
      messages: false,
      favorites: false,
      interests: false,
      newsletter: false,
      ...(all[email] ?? {}),
    };
  } catch {
    return { messages: false, favorites: false, interests: false, newsletter: false };
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
  document.body.classList.toggle("mm-messages-open", next === "uzenetek");
  document.title =
    {
      attekintes: "Áttekintés",
      import: "Autóimport",
      nyomtatasok: "Nyomtatások",
      ertekelesek: "Értékelések",
      parkolo: "Parkoló",
      keresesek: "Mentett kereséseim",
      uzenetek: "Üzenetek",
      hirdetes: "Saját hirdetések",
      megjelenes: "Megjelenés",
      fiok: "Beállítások",
    }[next] + " — Fiókom";
}

function authHeaders() {
  let token = "";
  try {
    token = localStorage.getItem(AUTH_TOKEN_KEY) || "";
  } catch {
    token = "";
  }
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function heroApi(url, options = {}) {
  const res = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Kérés sikertelen.");
  return data;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      reject(new Error("Csak JPG, PNG vagy WebP tölthető fel."));
      return;
    }
    if (file.size > HERO_MAX_BYTES) {
      reject(new Error("A kép maximum 8 MB lehet."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("A képet nem sikerült beolvasni."));
    reader.readAsDataURL(file);
  });
}

function renderHeroPickGrid(container, items, activeUrl, kind) {
  if (!container) return;
  container.innerHTML = "";
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hero-pick" + (item.url === activeUrl ? " is-active" : "");
    btn.setAttribute("role", "listitem");
    btn.setAttribute("data-hero-url", item.url);
    btn.setAttribute("data-hero-kind", kind);
    btn.title = item.label || "Kép";
    btn.innerHTML = `
      <img src="${String(item.url).replace(/"/g, "&quot;")}" alt="" loading="lazy" />
      <span>${String(item.label || "Kép")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</span>
    `;
    container.appendChild(btn);
  }
}

function renderHeroKindBox(kind, slice) {
  const box = document.querySelector(`[data-hero-kind="${kind}"]`);
  if (!box || !slice) return;
  const active = slice.activeUrl || "";
  renderHeroPickGrid(box.querySelector("[data-hero-presets]"), slice.presets || [], active, kind);
  const uploads = slice.uploads || [];
  renderHeroPickGrid(box.querySelector("[data-hero-uploads]"), uploads, active, kind);
  const empty = box.querySelector("[data-hero-upload-empty]");
  if (empty) empty.hidden = uploads.length > 0;
}

function renderHeroSettings(state) {
  heroState = state;
  renderHeroKindBox("pkw", state?.pkw);
  renderHeroKindBox("lkw", state?.lkw);
}

function mergeHeroKind(kind, slice) {
  return {
    ...(heroState || {}),
    [kind]: {
      ...(heroState?.[kind] || {}),
      ...slice,
    },
  };
}

async function loadHeroSettings() {
  const flash = document.querySelector("[data-hero-flash]");
  try {
    const data = await heroApi("/api/site-hero");
    renderHeroSettings(data);
  } catch (error) {
    showFlash(flash, error.message ?? "Nem sikerült betölteni a képeket.", false);
  }
}

function initHeroSettings() {
  const root = document.querySelector('[data-mm-panel="megjelenes"]');
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  root.addEventListener("click", async (event) => {
    const pick = event.target.closest("[data-hero-url]");
    if (!pick) return;
    const url = pick.getAttribute("data-hero-url");
    const kind = pick.getAttribute("data-hero-kind") || "pkw";
    const box = pick.closest(".hero-settings");
    const flash = box?.querySelector("[data-hero-flash]");
    try {
      const data = await heroApi("/api/site-hero", {
        method: "PUT",
        body: JSON.stringify({ kind, activeUrl: url }),
      });
      renderHeroSettings(mergeHeroKind(kind, data));
      showFlash(flash, "Háttérkép beállítva — minden látogató ezt látja.", true);
    } catch (error) {
      showFlash(flash, error.message ?? "Mentés sikertelen.", false);
    }
  });

  root.querySelectorAll("[data-hero-upload]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const box = btn.closest(".hero-settings");
      const kind = box?.getAttribute("data-hero-kind") || "pkw";
      const input = box?.querySelector("[data-hero-file]");
      const flash = box?.querySelector("[data-hero-flash]");
      const file = input?.files?.[0];
      if (!file) {
        showFlash(flash, "Válassz ki egy képfájlt.", false);
        return;
      }
      btn.disabled = true;
      try {
        const dataUrl = await fileToDataUrl(file);
        const data = await heroApi("/api/site-hero/upload", {
          method: "POST",
          body: JSON.stringify({
            kind,
            dataUrl,
            label: file.name.replace(/\.[^.]+$/, "").slice(0, 60),
          }),
        });
        if (input) input.value = "";
        renderHeroSettings(mergeHeroKind(kind, data));
        showFlash(flash, "Kép feltöltve és beállítva mindenkinek.", true);
      } catch (error) {
        showFlash(flash, error.message ?? "Feltöltés sikertelen.", false);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function fmtDate(ts) {
  try {
    return new Date(ts).toLocaleString("hu-HU");
  } catch {
    return "";
  }
}

async function refreshStats(email) {
  const park = getParkplatz(email);
  const searches = getSavedSearches(email);
  let unread = 0;
  try {
    const conversations = await listConversations();
    unread = conversations.reduce((sum, c) => sum + (Number(c.unread) || 0), 0);
  } catch {
    unread = 0;
  }

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

let messagesUi = null;

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

function updateProfileSummary(profile, user) {
  const el = document.getElementById("settings-profile-summary");
  const hint = document.getElementById("settings-profile-email-hint");
  if (!el) return;
  const name = [profile?.lastName, profile?.firstName].filter(Boolean).join(" ").trim();
  const email = user?.email || profile?.email || "";
  el.textContent = name || email || "Fiók";
  if (hint) {
    if (!profile?.firstName || !profile?.lastName) {
      hint.textContent = "Töltsd ki a neved a Személyes adatoknál, majd Mentés.";
    } else {
      hint.textContent = email || "";
    }
  }
}

async function lookupCityFromPostal(postalInput, cityInput, busyEl) {
  const digits = String(postalInput?.value ?? "")
    .replace(/\D/g, "")
    .slice(0, 4);
  if (postalInput) postalInput.value = digits;
  if (digits.length !== 4 || digits === lastLookedUpPostal || cityLookupBusy) return;
  cityLookupBusy = true;
  if (busyEl) busyEl.hidden = false;
  try {
    const params = new URLSearchParams({ postal_code: digits });
    const res = await fetch(`/api/postal-codes/lookup?${params}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.city) {
      lastLookedUpPostal = digits;
      if (cityInput) cityInput.value = data.city;
      document.querySelectorAll("[data-search-city], [data-rec-city], #mm-profile-form [name=city]").forEach((el) => {
        if (el !== cityInput) el.value = data.city;
      });
      document.querySelectorAll("[data-search-postal], [data-rec-postal], #mm-profile-form [name=postalCode]").forEach((el) => {
        if (el !== postalInput) el.value = digits;
      });
    }
  } catch {
    /* ignore */
  } finally {
    cityLookupBusy = false;
    if (busyEl) busyEl.hidden = true;
  }
}

function setWheelValue(wheel, km) {
  if (!wheel) return;
  const value = Number(km);
  wheel.querySelectorAll("[data-km]").forEach((btn) => {
    btn.classList.toggle("is-active", Number(btn.dataset.km) === value);
  });
  const active = wheel.querySelector(".is-active");
  active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  const hidden = wheel.parentElement?.querySelector('input[type="hidden"]');
  if (hidden) hidden.value = String(value);
}

function initWheel(wheel) {
  if (!wheel || wheel.dataset.bound === "1") return;
  wheel.dataset.bound = "1";
  wheel.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-km]");
    if (!btn || !wheel.contains(btn)) return;
    setWheelValue(wheel, btn.dataset.km);
  });
}

function accountTypeLabel(type) {
  if (type === "business") return "Céges fiók";
  if (type === "dealer") return "Autókereskedő";
  if (type === "private") return "Privát fiók";
  return "—";
}

function accountTypeSidebarLabel(type) {
  if (type === "business" || type === "dealer") return "céges fiók";
  if (type === "private") return "magán fiók";
  return "";
}

function syncSidebarAccountType(type) {
  const el = document.querySelector("[data-mm-account-type]");
  if (!el) return;
  const label = accountTypeSidebarLabel(type);
  if (!label) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.textContent = label;
  el.hidden = false;
}

function syncCompanyWrap(form) {
  const wrap = document.querySelector("[data-mm-company-wrap]");
  const label = document.querySelector("[data-mm-company-label]");
  const type = form?.elements?.namedItem("accountType")?.value || "private";
  if (wrap) wrap.hidden = type !== "business" && type !== "dealer";
  if (label) label.textContent = type === "dealer" ? "Kereskedés neve" : "Cégnév";
  const locked = document.querySelector("[data-account-type-locked]");
  if (locked) locked.textContent = accountTypeLabel(type);
}

function initAccordionExclusive() {
  const root = document.querySelector("[data-settings-accordion]");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";
  root.querySelectorAll("details.settings-acc").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (!details.open) return;
      root.querySelectorAll("details.settings-acc").forEach((other) => {
        if (other !== details) other.open = false;
      });
    });
  });

  const hash = String(window.location.hash || "").replace(/^#/, "");
  if (hash) {
    const target = root.querySelector(`details.settings-acc[data-acc="${hash}"]`);
    if (target) {
      target.open = true;
      target.scrollIntoView({ block: "nearest" });
    }
  }
}

function initPostalLookups(root = document) {
  root.querySelectorAll("[data-postal-lookup]").forEach((input) => {
    if (input.dataset.lookupBound === "1") return;
    input.dataset.lookupBound = "1";
    const row = input.closest(".settings-postal-row") || input.closest("form");
    const cityInput = row?.querySelector("[name=city], [data-search-city], [data-rec-city]");
    const busyEl = row?.querySelector("[data-city-busy]");
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 4);
      lookupCityFromPostal(input, cityInput, busyEl);
    });
  });
}

function fillAreaForms(profile) {
  const postal =
    String(profile?.postalCode || localStorage.getItem(SEARCH_POSTAL_KEY) || localStorage.getItem(REC_POSTAL_KEY) || "")
      .replace(/\D/g, "")
      .slice(0, 4);
  const city = profile?.city || "";
  const searchRadius = Number(localStorage.getItem(SEARCH_RADIUS_KEY) || profile?.searchRadiusKm || 30);
  const recRadius = Math.min(
    30,
    Number(localStorage.getItem(REC_RADIUS_KEY) || profile?.recommendationsRadiusKm || 30)
  );

  const searchForm = document.getElementById("settings-search-area-form");
  if (searchForm) {
    if (searchForm.postalCode) searchForm.postalCode.value = postal;
    if (searchForm.city) searchForm.city.value = city;
    const km = SEARCH_RADIUS_OPTIONS.includes(searchRadius) ? searchRadius : 30;
    searchForm.radiusKm.value = String(km);
    setWheelValue(searchForm.querySelector("[data-wheel=search]"), km);
  }

  const recForm = document.getElementById("settings-rec-area-form");
  if (recForm) {
    if (recForm.postalCode) recForm.postalCode.value = postal;
    if (recForm.city) recForm.city.value = city;
    const km = REC_RADIUS_OPTIONS.includes(recRadius) ? recRadius : 30;
    recForm.radiusKm.value = String(km);
    setWheelValue(recForm.querySelector("[data-wheel=rec]"), km);
  }
}

function initAreaForms() {
  document.querySelectorAll("[data-wheel]").forEach(initWheel);

  document.getElementById("settings-search-area-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const flash = document.getElementById("settings-search-area-flash");
    const postal = String(form.postalCode?.value || "")
      .replace(/\D/g, "")
      .slice(0, 4);
    const city = String(form.city?.value || "").trim();
    const radiusKm = Number(form.radiusKm?.value || 30);
    if (postal.length !== 4) {
      showFlash(flash, "Adj meg egy 4 jegyű irányítószámot.", false);
      return;
    }
    if (!SEARCH_RADIUS_OPTIONS.includes(radiusKm)) {
      showFlash(flash, "Érvénytelen sugár.", false);
      return;
    }
    try {
      localStorage.setItem(SEARCH_POSTAL_KEY, postal);
      localStorage.setItem(SEARCH_RADIUS_KEY, String(radiusKm));
      const profile = { ...getProfile(), postalCode: postal, city, searchRadiusKm: radiusKm };
      await saveProfile(profile).catch(() => null);
      fillAreaForms(profile);
      showFlash(flash, "Keresési körzet mentve.", true);
    } catch (error) {
      showFlash(flash, error.message ?? "Mentés sikertelen.", false);
    }
  });

  document.getElementById("settings-rec-area-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const flash = document.getElementById("settings-rec-area-flash");
    const postal = String(form.postalCode?.value || "")
      .replace(/\D/g, "")
      .slice(0, 4);
    const city = String(form.city?.value || "").trim();
    let radiusKm = Number(form.radiusKm?.value || 30);
    if (radiusKm > 30) radiusKm = 30;
    if (postal.length !== 4) {
      showFlash(flash, "Adj meg egy 4 jegyű irányítószámot.", false);
      return;
    }
    if (!REC_RADIUS_OPTIONS.includes(radiusKm)) {
      showFlash(flash, "Érvénytelen sugár (max 30 km).", false);
      return;
    }
    try {
      localStorage.setItem(REC_POSTAL_KEY, postal);
      localStorage.setItem(REC_RADIUS_KEY, String(radiusKm));
      const profile = {
        ...getProfile(),
        postalCode: postal,
        city,
        recommendationsRadiusKm: radiusKm,
      };
      await saveProfile(profile).catch(() => null);
      fillAreaForms(profile);
      showFlash(flash, "Ajánlások körzete mentve.", true);
    } catch (error) {
      showFlash(flash, error.message ?? "Mentés sikertelen.", false);
    }
  });
}

async function refreshDbInspect() {
  /* Fejlesztői DB panel eltávolítva a mobil UI-ból. */
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
  updateProfileSummary(data, getAuthUser());
}

function fillProfileForm(user, profileOverride = null) {
  const form = document.getElementById("mm-profile-form");
  if (!form) return;
  const profile = profileOverride || getProfile();
  applyProfileToForm(profile);
  const emailEl = document.getElementById("settings-email");
  if (emailEl) {
    if ("value" in emailEl) emailEl.value = user?.email || "";
    else emailEl.textContent = user?.email || "—";
  }
  syncCompanyWrap(form);
  syncSidebarAccountType(profile?.accountType || "private");
  updateProfileSummary(profile, user);
  fillAreaForms(profile);

  const photo = user?.email ? readPhotos()[user.email] : null;
  const letterEl = document.getElementById("settings-avatar-letter");
  const imgEl = document.getElementById("settings-avatar-img");
  const removeBtn = document.getElementById("settings-avatar-remove");
  const uploadBtn = document.getElementById("settings-avatar-upload");
  const letter = (
    profile?.lastName?.charAt(0) ||
    profile?.firstName?.charAt(0) ||
    user?.email?.charAt(0) ||
    "A"
  ).toUpperCase();
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
  if (removeBtn) removeBtn.hidden = !photo;
  if (uploadBtn) uploadBtn.textContent = photo ? "Csere" : "Feltöltés";
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
  await refreshStats(user.email);
  renderPark(user.email);
  renderSearches(user.email);
  messagesUi = initMessagesUi(document.getElementById("mm-msg-root"), {
    onUnreadChange: (n) => {
      const badge = document.querySelector("[data-mm-msg-count]");
      const msgStat = document.querySelector("[data-mm-stat-msg]");
      if (badge) {
        badge.hidden = n === 0;
        badge.textContent = String(n);
      }
      if (msgStat) msgStat.textContent = `${n} olvasatlan`;
    },
  });
  fillProfileForm(user, loadedProfile);
  initMyAdsPanel(document.getElementById("mm-ad-list")).reload();
  // Második kör: ha a panel most vált láthatóra, biztosan kitöltjük.
  requestAnimationFrame(() => fillProfileForm(getAuthUser(), loadedProfile || getProfile()));
  initNotifyForm(user.email);
  initAccordionExclusive();
  initPostalLookups();
  initAreaForms();
  initHeroSettings();
  if (currentSection() === "megjelenes") {
    loadHeroSettings();
  }

  document.querySelectorAll("[data-mm-nav]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const next = link.getAttribute("data-mm-nav");
      if (!SECTIONS.includes(next)) return;
      event.preventDefault();
      setSection(next);
      if (next === "fiok") {
        fillProfileForm(getAuthUser(), getProfile());
      }
      if (next === "uzenetek") {
        messagesUi?.refresh?.();
      }
      if (next === "megjelenes") {
        loadHeroSettings();
      }
      if (next === "hirdetes") {
        initMyAdsPanel(document.getElementById("mm-ad-list")).reload();
      }
    });
  });

  document.querySelectorAll("[data-mm-subtoggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const group = btn.closest(".mm-nav-group");
      const sub = group?.querySelector("[data-mm-sub]");
      if (!sub) return;
      const open = sub.hidden;
      document.querySelectorAll("[data-mm-sub]").forEach((el) => {
        el.hidden = true;
      });
      document.querySelectorAll("[data-mm-subtoggle]").forEach((el) => {
        el.setAttribute("aria-expanded", "false");
      });
      if (open) {
        sub.hidden = false;
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });

  document.querySelectorAll("[data-post-ad-category]").forEach((link) => {
    link.addEventListener("click", () => {
      try {
        const raw = link.getAttribute("data-post-ad-category") || "";
        const parsed = JSON.parse(raw);
        if (!parsed.v) parsed.v = CAT_STORAGE_VERSION;
        sessionStorage.setItem(CAT_STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        /* ignore */
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
  syncCompanyWrap(profileForm);

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
    window.dispatchEvent(new CustomEvent("bymy-auth-changed"));
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
      window.dispatchEvent(new CustomEvent("bymy-auth-changed"));
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
    const btn = document.getElementById("mm-profile-save");
    const data = Object.fromEntries(new FormData(profileForm).entries());
    data.postalCode = String(data.postalCode || "")
      .replace(/\D/g, "")
      .slice(0, 4);
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
      window.dispatchEvent(new CustomEvent("bymy-auth-changed"));
      showFlash(
        flash,
        `Adatok mentve: ${saved.lastName} ${saved.firstName}.`.trim(),
        true
      );
      flash?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
      showFlash(flash, error.message ?? "Mentés sikertelen.", false);
      flash?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

bindProfileFormEarly();
initSiteAuth({ skipRefresh: true });
initSettingsPage();
