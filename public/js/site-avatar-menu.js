/**
 * Fejléc profilkép + név (asztali):
 * — Beállítások oldal megnyitása (/beallitasok.html)
 * — Bezáráskor visszatérés az előző oldalra
 * Mobil weben: Fiókom menü (/fiok.html)
 */

const AUTH_KEY = "bymy-auth-user";
const PHOTO_KEY = "bymy-avatar-photos";
const RETURN_KEY = "bymy-settings-return";
const DESKTOP_MQ = "(min-width: 801px)";
let initialized = false;

function getAuthUser() {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isLoggedIn() {
  return Boolean(getAuthUser()?.email);
}

function isDesktop() {
  return typeof window !== "undefined" && window.matchMedia(DESKTOP_MQ).matches;
}

function readPhotos() {
  try {
    const raw = localStorage.getItem(PHOTO_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getAvatarPhoto(email) {
  if (!email) return null;
  const local = readPhotos()[email];
  if (local) return local;
  const user = getAuthUser();
  return user?.profile?.avatarDataUrl || null;
}

/** Egyszeri: helyi profilkép feltöltése a szerverre, ha még nincs ott. */
async function syncLocalAvatarOnce() {
  if (sessionStorage.getItem("bymy-avatar-server-sync") === "1") return;
  const user = getAuthUser();
  const email = user?.email;
  if (!email) return;
  const local = readPhotos()[email];
  if (!local || user?.profile?.avatarDataUrl) {
    sessionStorage.setItem("bymy-avatar-server-sync", "1");
    return;
  }
  sessionStorage.setItem("bymy-avatar-server-sync", "1");
  try {
    const response = await fetch("/api/auth/avatar", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarDataUrl: local }),
    });
    if (!response.ok) return;
    const data = await response.json().catch(() => ({}));
    if (data.user) {
      try {
        sessionStorage.setItem(AUTH_KEY, JSON.stringify({
          id: data.user.id,
          email: data.user.email,
          displayName: data.user.displayName || null,
          profile: data.user.profile || null,
          loggedInAt: Date.now(),
        }));
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent("bymy-auth-changed"));
    }
  } catch {
    /* ignore */
  }
}

function displayName(user) {
  const email = String(user?.email ?? "").trim();
  if (!email) return "vendég";
  if (user?.displayName) return String(user.displayName);
  const profile = user?.profile;
  const fromProfile = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");
  if (fromProfile) return fromProfile;
  const local = email.split("@")[0] || email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function firstName(user) {
  const fromProfile = String(user?.profile?.firstName || "").trim();
  if (fromProfile) return fromProfile;
  const display = String(user?.displayName || "").trim();
  if (display && !display.includes("@")) {
    const part = display.split(/\s+/)[0];
    if (part) return part;
  }
  const email = String(user?.email || "").trim();
  if (!email) return "";
  const local = email.split("@")[0] || "";
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : "";
}

function letterFromUser(user) {
  const name = firstName(user) || displayName(user);
  return (name.charAt(0) || "A").toUpperCase();
}

function hideDropdown(wrap) {
  wrap.querySelectorAll("[data-avatar-dropdown]").forEach((el) => {
    el.hidden = true;
    el.innerHTML = "";
  });
  wrap.querySelector("[data-avatar-toggle]")?.setAttribute("aria-expanded", "false");
}

function currentPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function isSettingsPath(path = window.location.pathname) {
  return path === "/beallitasok.html" || path.endsWith("/beallitasok.html");
}

function isFiokPath(path = window.location.pathname) {
  return path === "/fiok.html" || path.endsWith("/fiok.html");
}

/** Csak same-origin relatív útvonal; ne loopoljon vissza a Beállításokra. */
export function safeSettingsReturnUrl(raw) {
  const s = String(raw || "").trim();
  if (!s.startsWith("/") || s.startsWith("//")) return "/";
  const path = s.split(/[?#]/)[0] || "/";
  if (path === "/beallitasok.html" || path.endsWith("/beallitasok.html")) return "/";
  if (path === "/fiok.html" || path.endsWith("/fiok.html")) return "/";
  if (path === "/belepes.html" || path.endsWith("/belepes.html")) return "/";
  if (path === "/regisztracio.html" || path.endsWith("/regisztracio.html")) return "/";
  return s;
}

export function rememberSettingsReturn(url = currentPath()) {
  try {
    sessionStorage.setItem(RETURN_KEY, safeSettingsReturnUrl(url));
  } catch {
    /* ignore */
  }
}

export function consumeSettingsReturn() {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return safeSettingsReturnUrl(raw);
  } catch {
    return "/";
  }
}

export function peekSettingsReturn() {
  try {
    return safeSettingsReturnUrl(sessionStorage.getItem(RETURN_KEY));
  } catch {
    return "";
  }
}

export function hasSettingsReturn() {
  try {
    return Boolean(sessionStorage.getItem(RETURN_KEY));
  } catch {
    return false;
  }
}

function settingsTargetHref() {
  return "/beallitasok.html?szekcio=szemelyes";
}

export function refreshAvatarMenuUi(root = document) {
  const wraps = root.querySelectorAll("[data-avatar-menu]");
  const user = getAuthUser();
  const loggedIn = Boolean(user?.email);
  const photo = getAvatarPhoto(user?.email);

  wraps.forEach((wrap) => {
    hideDropdown(wrap);
    const letterEl = wrap.querySelector("[data-avatar-letter]");
    const imgEl = wrap.querySelector("[data-avatar-img]");
    const firstNameEl = wrap.querySelector("[data-auth-firstname]");
    const toggle = wrap.querySelector("[data-avatar-toggle]");
    if (letterEl) letterEl.textContent = letterFromUser(user);
    if (firstNameEl) firstNameEl.textContent = firstName(user);

    if (imgEl) {
      if (photo) {
        imgEl.src = photo;
        imgEl.hidden = false;
        if (letterEl) letterEl.hidden = true;
      } else {
        imgEl.removeAttribute("src");
        imgEl.hidden = true;
        if (letterEl) letterEl.hidden = false;
      }
    }

    if (toggle) {
      toggle.setAttribute("aria-haspopup", "false");
      toggle.setAttribute("aria-label", "Beállítások");
      toggle.setAttribute("title", "Beállítások");
    }

    wrap.dataset.loggedIn = loggedIn ? "1" : "0";
  });

  root.querySelectorAll(".mw-app-avatar").forEach((el) => {
    const letterEl = el.querySelector("[data-avatar-letter]");
    const imgEl = el.querySelector("[data-avatar-img]");
    if (letterEl) {
      letterEl.textContent = letterFromUser(user);
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
  });
}

function bindWrap(wrap) {
  hideDropdown(wrap);
  const toggle = wrap.querySelector("[data-avatar-toggle]");
  if (!toggle || toggle.dataset.bound === "1") return;
  toggle.dataset.bound = "1";
  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (toggle.dataset.navigating === "1") return;
    if (!isLoggedIn()) {
      toggle.dataset.navigating = "1";
      window.location.href = `/belepes.html?next=${encodeURIComponent(currentPath())}`;
      return;
    }

    if (isDesktop()) {
      if (isSettingsPath()) return;
      rememberSettingsReturn(currentPath());
      toggle.dataset.navigating = "1";
      window.location.assign(settingsTargetHref());
      return;
    }

    /* Mobil: Fiókom menü */
    if (isFiokPath()) return;
    toggle.dataset.navigating = "1";
    window.location.assign("/fiok.html");
  });
}

export function initAvatarMenu() {
  const wraps = document.querySelectorAll("[data-avatar-menu]");
  if (!wraps.length) return;

  refreshAvatarMenuUi();
  void syncLocalAvatarOnce();
  if (initialized) return;
  initialized = true;

  wraps.forEach(bindWrap);
  window.addEventListener("bymy-auth-changed", () => refreshAvatarMenuUi());

  document.addEventListener("click", (event) => {
    const wrap = event.target?.closest?.("[data-avatar-menu]");
    if (wrap) return;
    document.querySelectorAll("[data-avatar-menu]").forEach(hideDropdown);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAvatarMenu);
} else {
  initAvatarMenu();
}
