/**
 * Profilkép + Fiók menü (mobilapp mintára).
 * A dropdown tartalmát egységesen ide építjük — minden oldalon ugyanaz.
 */

const AUTH_KEY = "bymy-auth-user";
const PHOTO_KEY = "bymy-avatar-photos";
const MAX_BYTES = 2.5 * 1024 * 1024;
const AVATAR_SIZE = 256;

let initialized = false;

const ICONS = {
  messages: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 6.8h9.5a2.2 2.2 0 0 1 2.2 2.2v4.2a2.2 2.2 0 0 1-2.2 2.2H10l-3.2 2.4V15.2H5A2.2 2.2 0 0 1 2.8 13V9a2.2 2.2 0 0 1 2.2-2.2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14.2 8.2h4A2.2 2.2 0 0 1 20.4 10.4v3.4a2.2 2.2 0 0 1-2.2 2.2h-.7v1.7l-2.2-1.7" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  star: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3.6 2.1 4.4 4.8.5-3.6 3.1 1.1 4.7L12 14.2 7.6 16.3l1.1-4.7-3.6-3.1 4.8-.5L12 3.6Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  heart: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20s-6.8-4.2-9-7.7C1.4 9.7 2.7 6.5 5.7 5.6c1.8-.5 3.6.2 4.6 1.6 1-1.4 2.8-2.1 4.6-1.6 3 .9 4.3 4.1 2.7 6.7C18.8 15.8 12 20 12 20Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  car: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 14.5h2.2l1.3-2.5h7l1.4 2.5H18a2 2 0 0 1 2 2v2.2a1.3 1.3 0 0 1-1.3 1.3h-.7" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="7.2" cy="18.7" r="1.5" stroke="currentColor" stroke-width="1.5"/><circle cx="15.5" cy="18.7" r="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 14.5 6.5 9.8h11L19 14.5" stroke="currentColor" stroke-width="1.5"/></svg>`,
  import: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 15.5h16v3.2a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 18.7v-3.2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M7.2 15.2 8.5 10h7l1.3 5.2" stroke="currentColor" stroke-width="1.5"/><path d="M12 3.5v7.2M9.2 8.2 12 11l2.8-2.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  settings: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3.1" stroke="currentColor" stroke-width="1.6"/><path d="M12 4.5v1.6M12 17.9v1.6M4.5 12h1.6M17.9 12h1.6M6.8 6.8l1.1 1.1M16.1 16.1l1.1 1.1M17.2 6.8l-1.1 1.1M7.9 16.1l-1.1 1.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  print: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 8.2V4.8h10v3.4" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M6 14.8h12v5H6v-5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M4.8 9.5h14.4A1.7 1.7 0 0 1 21 11.2v4.2h-3M3 15.4V11.2A1.7 1.7 0 0 1 4.8 9.5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  rating: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 6.5h14a1.8 1.8 0 0 1 1.8 1.8v7.2A1.8 1.8 0 0 1 19 17.3h-5.2L9.2 20v-2.7H5A1.8 1.8 0 0 1 3.2 15.5V8.3A1.8 1.8 0 0 1 5 6.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m12 9.2.7 1.5 1.6.2-1.2 1 .4 1.6-1.5-.8-1.5.8.4-1.6-1.2-1 1.6-.2L12 9.2Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
  photo: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2.2" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.6"/><path d="M8 5.5 9.2 3.8h5.6L16 5.5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  chevron: `<svg class="site-avatar-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

function row(href, icon, label, extra = "") {
  const tag = href ? "a" : "button";
  const attrs = href
    ? `href="${href}"`
    : `type="button" ${extra}`;
  return `<${tag} class="site-avatar-item" ${attrs} role="menuitem">
    <span class="site-avatar-item-icon">${icon}</span>
    <span class="site-avatar-item-label">${label}</span>
    ${ICONS.chevron}
  </${tag}>`;
}

function fiokMenuInnerHtml() {
  return `
    <div class="site-avatar-sheet-head">
      <button type="button" class="site-avatar-sheet-back" data-avatar-close aria-label="Vissza">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 6 9 12l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>Vissza</span>
      </button>
      <p class="site-avatar-sheet-title">Fiók</p>
    </div>
    <p class="site-avatar-guest" data-avatar-guest>A menühöz jelentkezz be.</p>
    <div data-avatar-member hidden>
      <div class="site-avatar-card">
        ${row(null, ICONS.photo, "Profilkép", 'data-avatar-photo-btn')}
        <input type="file" accept="image/jpeg,image/png,image/webp" data-avatar-file hidden />
        ${row("/beallitasok.html?szekcio=uzenetek", ICONS.messages, "Üzenetek")}
        ${row("/beallitasok.html?szekcio=keresesek", ICONS.star, "Mentett kereséseim")}
        ${row("/beallitasok.html?szekcio=parkolo", ICONS.heart, "Kedvencek")}
        ${row("/beallitasok.html?szekcio=hirdetes", ICONS.car, "Hirdetéseim")}
        ${row("/import.html", ICONS.import, "Autóimport")}
        ${row("/beallitasok.html?szekcio=megjelenes", ICONS.photo, "Megjelenés")}
        ${row("/beallitasok.html?szekcio=fiok", ICONS.settings, "Beállítások")}
        ${row("/beallitasok.html?szekcio=nyomtatasok", ICONS.print, "Nyomtatások")}
        ${row("/beallitasok.html?szekcio=ertekelesek", ICONS.rating, "Értékelések")}
      </div>
      <div class="site-avatar-footer">
        <p class="site-avatar-logged">Bejelentkezve mint <strong data-avatar-user>—</strong></p>
        <button type="button" class="site-avatar-logout" data-auth-logout>Kijelentkezés</button>
      </div>
    </div>
  `;
}

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
  const local = readPhotos()[email];
  if (local) return local;
  const user = getAuthUser();
  return user?.profile?.avatarDataUrl || null;
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
  document.body.classList.remove("fiok-menu-open");
}

function openMenu(root) {
  const dropdown = root.querySelector("[data-avatar-dropdown]");
  const toggle = root.querySelector("[data-avatar-toggle]");
  if (dropdown) dropdown.hidden = false;
  if (toggle) toggle.setAttribute("aria-expanded", "true");
  document.body.classList.add("fiok-menu-open");
}

function ensureFiokMarkup(wrap) {
  let dropdown = wrap.querySelector("[data-avatar-dropdown]");
  if (!dropdown) {
    dropdown = document.createElement("div");
    dropdown.className = "site-avatar-dropdown site-avatar-dropdown--fiok";
    dropdown.setAttribute("data-avatar-dropdown", "");
    dropdown.setAttribute("role", "menu");
    dropdown.hidden = true;
    wrap.appendChild(dropdown);
  }
  if (dropdown.dataset.fiokMenu === "1") return;
  dropdown.classList.add("site-avatar-dropdown--fiok");
  dropdown.innerHTML = fiokMenuInnerHtml();
  dropdown.dataset.fiokMenu = "1";
}

export function refreshAvatarMenuUi(root = document) {
  const wraps = root.querySelectorAll("[data-avatar-menu]");
  const user = getAuthUser();
  const loggedIn = Boolean(user?.email);
  const photo = getAvatarPhoto(user?.email);

  wraps.forEach((wrap) => {
    ensureFiokMarkup(wrap);
    const letterEl = wrap.querySelector("[data-avatar-letter]");
    const imgEl = wrap.querySelector("[data-avatar-img]");
    const nameEl = wrap.querySelector("[data-avatar-user]");
    const guestNote = wrap.querySelector("[data-avatar-guest]");
    const memberBlock = wrap.querySelector("[data-avatar-member]");

    if (letterEl) letterEl.textContent = letterFromUser(user);
    if (nameEl) nameEl.textContent = displayName(user);
    const firstNameEl = wrap.querySelector("[data-auth-firstname]");
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

    if (guestNote) guestNote.hidden = loggedIn;
    if (memberBlock) memberBlock.hidden = !loggedIn;
    wrap.dataset.loggedIn = loggedIn ? "1" : "0";
  });

  /* Mobil app fejléc avatar (nincs dropdown menü) — ugyanaz a betű / fotó */
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
  ensureFiokMarkup(wrap);
  const toggle = wrap.querySelector("[data-avatar-toggle]");
  const dropdown = wrap.querySelector("[data-avatar-dropdown]");

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

  wrap.addEventListener("click", (event) => {
    const closeBtn = event.target.closest("[data-avatar-close]");
    if (closeBtn && wrap.contains(closeBtn)) {
      event.preventDefault();
      closeMenu(wrap);
      return;
    }
    const photoBtn = event.target.closest("[data-avatar-photo-btn]");
    if (!photoBtn || !wrap.contains(photoBtn)) return;
    event.preventDefault();
    event.stopPropagation();
    if (!isLoggedIn()) {
      window.location.href = "/belepes.html";
      return;
    }
    wrap.querySelector("[data-avatar-file]")?.click();
  });

  const fileInput = wrap.querySelector("[data-avatar-file]");
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
}

export function initAvatarMenu() {
  const wraps = document.querySelectorAll("[data-avatar-menu]");
  if (!wraps.length) return;

  refreshAvatarMenuUi();
  if (initialized) return;
  initialized = true;

  wraps.forEach(bindWrap);

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-avatar-menu]")) return;
    document.querySelectorAll("[data-avatar-menu]").forEach(closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll("[data-avatar-menu]").forEach(closeMenu);
  });

  window.addEventListener("bymy-auth-changed", () => refreshAvatarMenuUi());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAvatarMenu);
} else {
  initAvatarMenu();
}
