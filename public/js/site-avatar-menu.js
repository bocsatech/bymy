/**
 * Fejléc profilkép + név: a Beállítások oldal megfelelő szekciójára navigál.
 * Mobil weben ez nem fut (ott más UI elem van).
 */

const AUTH_KEY = "bymy-auth-user";
const PHOTO_KEY = "bymy-avatar-photos";
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
  toggle?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (toggle.dataset.navigating === "1") return;
    if (!isLoggedIn()) {
      toggle.dataset.navigating = "1";
      window.location.href = `/belepes.html?next=${encodeURIComponent(
        window.location.pathname + window.location.search
      )}`;
      return;
    }

    // Fiók menü külön oldalon (/fiok.html) — nem Beállítások, nem lenyíló.
    const target = "/fiok.html";
    const now = `${window.location.pathname}${window.location.search}`;
    if (now === target || window.location.pathname === "/fiok.html") return;
    toggle.dataset.navigating = "1";
    window.location.assign(target);
  });
}

export function initAvatarMenu() {
  const wraps = document.querySelectorAll("[data-avatar-menu]");
  if (!wraps.length) return;

  refreshAvatarMenuUi();
  if (initialized) return;
  initialized = true;

  wraps.forEach(bindWrap);
  window.addEventListener("bymy-auth-changed", () => refreshAvatarMenuUi());

  // Oldal kattintásra zárjuk a dropdownot (csak desktop "Fiók" menükre).
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
