/**
 * Profil avatar menü — egyetlen példányban töltődik (script tag).
 * A site-auth `autosweb-auth-changed` eseménnyel frissíti.
 */

const AUTH_KEY = "autosweb-auth-user";
const PHOTO_KEY = "autosweb-avatar-photos";
const MAX_BYTES = 2.5 * 1024 * 1024;
const AVATAR_SIZE = 256;

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

function writePhotos(map) {
  localStorage.setItem(PHOTO_KEY, JSON.stringify(map));
}

function getAvatarPhoto(email) {
  if (!email) return null;
  return readPhotos()[email] ?? null;
}

function setAvatarPhoto(email, dataUrl) {
  if (!email) return;
  const map = readPhotos();
  if (dataUrl) map[email] = dataUrl;
  else delete map[email];
  writePhotos(map);
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

function letterFromUser(user) {
  const email = String(user?.email ?? "A").trim();
  return (email.charAt(0) || "A").toUpperCase();
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
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("A képet nem sikerült beolvasni."));
    };
    img.src = url;
  });
}

function closeMenu(root) {
  const dropdown = root.querySelector("[data-avatar-dropdown]");
  const toggle = root.querySelector("[data-avatar-toggle]");
  if (dropdown) dropdown.hidden = true;
  if (toggle) toggle.setAttribute("aria-expanded", "false");
}

function openMenu(root) {
  const dropdown = root.querySelector("[data-avatar-dropdown]");
  const toggle = root.querySelector("[data-avatar-toggle]");
  if (dropdown) dropdown.hidden = false;
  if (toggle) toggle.setAttribute("aria-expanded", "true");
}

export function refreshAvatarMenuUi(root = document) {
  const wraps = root.querySelectorAll("[data-avatar-menu]");
  const user = getAuthUser();
  const loggedIn = Boolean(user?.email);
  const photo = getAvatarPhoto(user?.email);

  wraps.forEach((wrap) => {
    const letterEl = wrap.querySelector("[data-avatar-letter]");
    const imgEl = wrap.querySelector("[data-avatar-img]");
    const nameEl = wrap.querySelector("[data-avatar-user]");
    const guestNote = wrap.querySelector("[data-avatar-guest]");
    const memberBlock = wrap.querySelector("[data-avatar-member]");

    if (letterEl) letterEl.textContent = letterFromUser(user);
    if (nameEl) nameEl.textContent = displayName(user);

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

    if (guestNote) guestNote.hidden = loggedIn;
    if (memberBlock) memberBlock.hidden = !loggedIn;
    wrap.dataset.loggedIn = loggedIn ? "1" : "0";
  });
}

export function initAvatarMenu() {
  const wraps = document.querySelectorAll("[data-avatar-menu]");
  if (!wraps.length) return;

  refreshAvatarMenuUi();
  if (initialized) return;
  initialized = true;

  wraps.forEach((wrap) => {
    const toggle = wrap.querySelector("[data-avatar-toggle]");
    const dropdown = wrap.querySelector("[data-avatar-dropdown]");
    const fileInput = wrap.querySelector("[data-avatar-file]");
    const photoBtns = wrap.querySelectorAll("[data-avatar-photo-btn]");

    toggle?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!isLoggedIn()) {
        window.location.href = `/belepes.html?next=${encodeURIComponent(
          window.location.pathname + window.location.search
        )}`;
        return;
      }
      const isOpen = dropdown && !dropdown.hidden;
      document.querySelectorAll("[data-avatar-menu]").forEach(closeMenu);
      if (!isOpen) openMenu(wrap);
    });

    photoBtns.forEach((photoBtn) => {
      photoBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isLoggedIn()) {
          window.location.href = "/belepes.html";
          return;
        }
        fileInput?.click();
      });
    });

    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (!file) return;
      const user = getAuthUser();
      if (!user?.email) return;
      try {
        const dataUrl = await resizeImageFile(file);
        setAvatarPhoto(user.email, dataUrl);
        refreshAvatarMenuUi();
      } catch (error) {
        window.alert(error.message ?? "Feltöltés sikertelen.");
      }
    });
  });

  // Csak valódi „kívül” kattintásra zárjon — nem capture pointerdown a toggle-lal ütközve.
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-avatar-menu]")) return;
    document.querySelectorAll("[data-avatar-menu]").forEach(closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll("[data-avatar-menu]").forEach(closeMenu);
  });

  window.addEventListener("autosweb-auth-changed", () => {
    refreshAvatarMenuUi();
  });
}

function boot() {
  initAvatarMenu();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
