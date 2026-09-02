/** Régi autosweb-* localStorage kulcsok átvezetése bymy-*-ra (adatvesztés nélkül). */
import { safeInternalPath } from "./safe-path.js?v=sec1";

function migrateLegacyAutoswebStorage() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }
    for (const key of keys) {
      if (!key.startsWith("autosweb")) continue;
      const next = `bymy${key.slice("autosweb".length)}`;
      if (localStorage.getItem(next) == null) {
        localStorage.setItem(next, localStorage.getItem(key));
      }
    }
  } catch {
    /* ignore */
  }
}
migrateLegacyAutoswebStorage();

const AUTH_KEY = "bymy-auth-user";
const TOKEN_KEY = "bymy-auth-token";
const PROFILE_BACKUP_KEY = "bymy-profile-backup";

/** Token ne legyen localStorage-ban (XSS). Cookie HttpOnly; Bearer csak memóriában (mobil). */
let memoryToken = "";

function clearLegacyTokenStorage() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("autosweb-auth-token");
  } catch {
    /* ignore */
  }
}

clearLegacyTokenStorage();

function getStoredToken() {
  return memoryToken || "";
}

function setStoredToken(token) {
  memoryToken = token ? String(token) : "";
  clearLegacyTokenStorage();
}

function clearSensitiveLocalData() {
  clearLegacyTokenStorage();
  try {
    localStorage.removeItem(PROFILE_BACKUP_KEY);
    localStorage.removeItem("autosweb-profile-backup");
  } catch {
    /* ignore */
  }
}

function setCachedUser(user) {
  if (!user?.email) {
    sessionStorage.removeItem(AUTH_KEY);
    return null;
  }
  const cached = {
    id: user.id,
    email: user.email,
    displayName: user.displayName || null,
    profile: user.profile || null,
    loggedInAt: Date.now(),
  };
  sessionStorage.setItem(AUTH_KEY, JSON.stringify(cached));
  return cached;
}

function rememberAuth(data) {
  // Token csak memóriában (mobil Bearer); web cookie-t használ.
  if (data?.token) setStoredToken(data.token);
  return setCachedUser(data?.user ?? null);
}

export function getAuthUser() {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return Boolean(getAuthUser()?.email);
}

async function authFetch(url, options = {}) {
  const token = getStoredToken();
  const { headers: optHeaders, ...rest } = options;
  const response = await fetch(url, {
    credentials: "same-origin",
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(optHeaders || {}),
    },
  });
  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }
  if (response.status === 401) {
    setStoredToken("");
    sessionStorage.removeItem(AUTH_KEY);
    clearSensitiveLocalData();
    const err = new Error(data.error || "Nem vagy bejelentkezve.");
    err.status = 401;
    throw err;
  }
  if (!response.ok) {
    const looksLikeAuthJson =
      Object.prototype.hasOwnProperty.call(data, "user") ||
      Object.prototype.hasOwnProperty.call(data, "error") ||
      Object.prototype.hasOwnProperty.call(data, "token");
    if (
      !looksLikeAuthJson &&
      (response.status === 404 || /NOT_FOUND|could not be found/i.test(raw))
    ) {
      throw new Error(
        "A belépő szerver most nem elérhető (API hiányzik). Próbáld újra pár perc múlva — nem a jelszó a gond."
      );
    }
    throw new Error(data.error || "Kérés sikertelen.");
  }
  if (data.token) setStoredToken(data.token);
  return data;
}

let refreshInflight = null;

export async function refreshAuthSession() {
  if (refreshInflight) return refreshInflight;
  refreshInflight = (async () => {
    try {
      const data = await authFetch("/api/auth/me");
      if (!data.user?.email) {
        setStoredToken("");
        sessionStorage.removeItem(AUTH_KEY);
        clearSensitiveLocalData();
        return null;
      }
      return rememberAuth(data);
    } catch (error) {
      if (error?.status === 401) {
        setStoredToken("");
        sessionStorage.removeItem(AUTH_KEY);
        clearSensitiveLocalData();
        return null;
      }
      /* Hálózati / átmeneti hiba: ne dobjunk loginra, maradjon a cache. */
      return getAuthUser();
    } finally {
      refreshInflight = null;
    }
  })();
  return refreshInflight;
}

/** Profil mindig a szerverről (SQLite), ne a böngésző cache-ből. */
export async function loadProfileFromServer() {
  const data = await authFetch("/api/auth/profile");
  if (data.user) rememberAuth(data);
  else {
    const user = getAuthUser() || { email: null };
    setCachedUser({
      ...user,
      displayName: data.displayName ?? user.displayName ?? null,
      profile: data.profile,
    });
  }
  const user = getAuthUser();
  return data.profile ?? getProfile();
}

export async function register(email, password, passwordConfirm, accountType) {
  const data = await authFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      passwordConfirm,
      accountType,
    }),
  });
  // Aktiválás előtt nincs session.
  return data;
}

export async function activateAccount(token) {
  const data = await authFetch("/api/auth/activate", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  return rememberAuth(data);
}

export async function resendActivation(email) {
  return authFetch("/api/auth/resend-activation", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function requestPasswordReset(email) {
  return authFetch("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPasswordByToken(token, password, passwordConfirm) {
  return authFetch("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password, passwordConfirm }),
  });
}

export async function login(email, password) {
  const data = await authFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  rememberAuth(data);
  clearSensitiveLocalData();
  return getAuthUser();
}

export async function logout() {
  try {
    await authFetch("/api/auth/logout", { method: "POST", body: "{}" });
  } catch {
    /* ignore */
  }
  sessionStorage.removeItem(AUTH_KEY);
  setStoredToken("");
  clearSensitiveLocalData();
}

export async function changePassword(currentPassword, newPassword, newPasswordConfirm) {
  await authFetch("/api/auth/password", {
    method: "POST",
    body: JSON.stringify({
      currentPassword,
      newPassword,
      newPasswordConfirm,
    }),
  });
}

export function getDisplayName() {
  const user = getAuthUser();
  if (!user?.email) return "";
  if (user.displayName) return String(user.displayName);
  const profile = user.profile;
  const fromProfile = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");
  if (fromProfile) return fromProfile;
  const local = user.email.split("@")[0] || user.email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export async function setDisplayName(name) {
  const data = await authFetch("/api/auth/profile", {
    method: "PUT",
    body: JSON.stringify({ displayName: name }),
  });
  if (data.user) rememberAuth(data);
  else {
    const user = getAuthUser();
    if (user) {
      user.displayName = data.displayName;
      setCachedUser(user);
    }
  }
  return data.displayName;
}

/** Profilkép mentése a szerverre (hirdetés oldalon is látszódjon). */
export async function saveAvatarPhoto(avatarDataUrl) {
  const data = await authFetch("/api/auth/avatar", {
    method: "PUT",
    body: JSON.stringify({ avatarDataUrl: String(avatarDataUrl ?? "") }),
  });
  if (data.user) rememberAuth(data);
  return data.user;
}

export async function deleteAccount() {
  await authFetch("/api/auth/account", { method: "DELETE" });
  sessionStorage.removeItem(AUTH_KEY);
  setStoredToken("");
  clearSensitiveLocalData();
}

const EMPTY_PROFILE = {
  salutation: "",
  firstName: "",
  lastName: "",
  street: "",
  postalCode: "",
  city: "",
  country: "Magyarország",
  phone: "",
  company: "",
  companyTaxId: "",
  companyStreet: "",
  companyPostalCode: "",
  companyCity: "",
  companyCountry: "Magyarország",
  companyAddress: "",
  companyPhone: "",
  companyPhone2: "",
  companyEmail: "",
  companyEmail2: "",
  salespersonName: "",
  salespersonName2: "",
  accountType: "private",
};

export function getProfile() {
  const user = getAuthUser();
  if (!user?.email) return { ...EMPTY_PROFILE };
  return { ...EMPTY_PROFILE, ...(user.profile || {}) };
}

function profileSaveLooksOk(profile) {
  if (!profile) return false;
  if (profile.accountType === "business") {
    return Boolean(
      String(profile.company || "").trim() ||
        String(profile.companyTaxId || "").trim() ||
        String(profile.companyStreet || "").trim() ||
        String(profile.companyPostalCode || "").trim() ||
        String(profile.firstName || "").trim()
    );
  }
  return Boolean(String(profile.firstName || "").trim());
}

export async function saveProfile(profile) {
  const data = await authFetch("/api/auth/profile", {
    method: "PUT",
    body: JSON.stringify({ profile }),
  });
  if (data.user) rememberAuth(data);
  else {
    const user = getAuthUser();
    if (user) {
      user.profile = data.profile;
      user.displayName =
        [data.profile.firstName, data.profile.lastName].filter(Boolean).join(" ") ||
        String(data.profile.company || "").trim() ||
        user.displayName;
      setCachedUser(user);
    }
  }
  if (!profileSaveLooksOk(data.profile)) {
    throw new Error("A mentés nem sikerült — próbáld újra belépés után.");
  }

  // Újraolvasás — ha a szerver üresen adná vissza, azonnal jelezzük.
  try {
    const verify = await authFetch("/api/auth/profile");
    if (!profileSaveLooksOk(verify.profile)) {
      throw new Error("A mentés nem került a helyi adatbázisba.");
    }
    if (verify.user) rememberAuth(verify);
  } catch (error) {
    if (String(error.message || "").includes("adatbázisba")) throw error;
  }
  return { ...data.profile, _savedTo: data.savedTo || null };
}

export function loginUrl(nextPath = "/hirdetesfeladas.html") {
  const safe = safeInternalPath(nextPath, "/hirdetesfeladas.html");
  return `/belepes.html?next=${encodeURIComponent(safe)}`;
}

function firstNameFromUser(user) {
  const fromProfile = String(user?.profile?.firstName || "").trim();
  if (fromProfile) return fromProfile;
  const display = String(user?.displayName || "").trim();
  if (display && !display.includes("@")) {
    const first = display.split(/\s+/)[0];
    if (first) return first;
  }
  const email = String(user?.email || "").trim();
  if (!email) return "";
  const local = email.split("@")[0] || "";
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : "";
}

function lastNameFromUser(user) {
  return String(user?.profile?.lastName || "").trim();
}

function updateHeaderAuthUi() {
  const registerBtns = document.querySelectorAll("[data-auth-register]");
  const loginBtns = document.querySelectorAll("[data-auth-login]");
  const guestBlocks = document.querySelectorAll("[data-auth-guest]");
  const memberBlocks = document.querySelectorAll("[data-auth-member], [data-avatar-menu]");
  const firstNameEls = document.querySelectorAll("span[data-auth-firstname]");
  const lastNameEls = document.querySelectorAll("[data-auth-lastname]");
  const user = getAuthUser();
  const loggedIn = Boolean(user?.email);
  const firstName = firstNameFromUser(user);
  const lastName = lastNameFromUser(user);

  try {
    document.documentElement.setAttribute("data-auth", loggedIn ? "member" : "guest");
  } catch {
    /* ignore */
  }

  registerBtns.forEach((btn) => {
    btn.hidden = loggedIn;
  });

  loginBtns.forEach((btn) => {
    btn.hidden = loggedIn;
    btn.textContent = "Belépés";
    btn.href = "/belepes.html";
    btn.setAttribute("data-auth-login", "");
    btn.removeAttribute("data-auth-logout");
    if (btn.classList.contains("site-header-btn")) {
      btn.classList.add("site-header-btn--ghost");
      btn.classList.remove("site-header-btn--outline");
    }
    btn.removeAttribute("title");
  });

  guestBlocks.forEach((el) => {
    el.hidden = loggedIn;
  });

  memberBlocks.forEach((el) => {
    el.hidden = !loggedIn;
  });

  firstNameEls.forEach((el) => {
    el.textContent = firstName || "";
  });

  lastNameEls.forEach((el) => {
    el.textContent = lastName || "";
  });

  // Az avatar menü külön script (site-avatar-menu.js) — ne importáld újra (különben dupla listener).
  window.dispatchEvent(new CustomEvent("bymy-auth-changed"));
}

function paintUnreadMessageCount(count) {
  const unread = Math.max(0, Number(count) || 0);
  document.querySelectorAll("[data-mm-msg-count], [data-nav-msg-count]").forEach((el) => {
    el.hidden = unread <= 0;
    el.textContent = String(unread);
  });

  document.querySelectorAll(".hub-header-msg").forEach((link) => {
    let badge = link.querySelector("[data-nav-msg-count]");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "site-message-badge";
      badge.setAttribute("data-nav-msg-count", "");
      badge.setAttribute("aria-label", "Olvasatlan üzenetek");
      link.appendChild(badge);
    }
    badge.hidden = unread <= 0;
    badge.textContent = String(unread);
  });
}

async function refreshUnreadMessageCount() {
  if (!isLoggedIn()) {
    paintUnreadMessageCount(0);
    return;
  }
  try {
    const response = await fetch("/api/messages/conversations", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const unread = (data.conversations || []).reduce((total, conversation) => total + (Number(conversation.unread) || 0), 0);
    paintUnreadMessageCount(unread);
  } catch {
    /* Az üzenetoldal hibája ne akadályozza a globális fejlécet. */
  }
}

export function initSiteAuth(options = {}) {
  // Azonnali UI a session cache-ből — ne várjuk meg a hálózatot (FOUC / Belépés-villanás).
  updateHeaderAuthUi();
  try {
    document.documentElement.setAttribute(
      "data-auth",
      isLoggedIn() ? "member" : "guest"
    );
  } catch {
    /* ignore */
  }

  if (!options.skipRefresh) {
    refreshAuthSession().finally(() => {
      updateHeaderAuthUi();
      refreshUnreadMessageCount();
      try {
        document.documentElement.setAttribute(
          "data-auth",
          isLoggedIn() ? "member" : "guest"
        );
      } catch {
        /* ignore */
      }
    });
  }

  document.querySelectorAll("[data-auth-guard]").forEach((el) => {
    el.addEventListener("click", (event) => {
      if (isLoggedIn()) return;
      event.preventDefault();
      const target = el.getAttribute("href") || "/hirdetesfeladas.html";
      window.location.href = loginUrl(target);
    });
  });

  document.addEventListener("click", async (event) => {
    const logoutBtn = event.target.closest("[data-auth-logout]");
    if (!logoutBtn) return;
    event.preventDefault();
    await logout();
    updateHeaderAuthUi();
    window.location.href = "/";
  });

  window.addEventListener("bymy-auth-changed", refreshUnreadMessageCount);
}

export async function requireAuthForPage() {
  const user = await refreshAuthSession();
  if (user?.email) {
    updateHeaderAuthUi();
    return true;
  }
  const next = window.location.pathname + window.location.search;
  window.location.replace(loginUrl(next));
  return false;
}

function isAuthGatePage() {
  const p = document.body?.dataset?.sitePage;
  return (
    p === "belepes" ||
    p === "regisztracio" ||
    p === "aktivalas" ||
    p === "jelszo-elfelejtve" ||
    p === "jelszo-visszaallitas"
  );
}

function isPublicClientPage() {
  const path = window.location.pathname;
  return path === "/partner-profil.html" || /^\/partner\/[a-z0-9-]+\/?$/.test(path);
}

async function enforceClientMembersGate() {
  if (isAuthGatePage() || isPublicClientPage()) return;
  const user = await refreshAuthSession();
  if (user?.email) return;
  /* Csak tényleges kijelentkezésnél — ne villanjon a login oldal hálózati hibánál. */
  if (getAuthUser()?.email) return;
  window.location.replace(loginUrl(window.location.pathname + window.location.search));
}

export function initRegisterPage() {
  const form = document.getElementById("register-form");
  const errorEl = document.getElementById("register-error");
  const okEl = document.getElementById("register-ok");
  const submitBtn = form?.querySelector('button[type="submit"]');
  if (!form) return;

  // Már belépve: ne mutassuk a regisztrációs űrlapot.
  refreshAuthSession().then((user) => {
    if (user?.email) window.location.replace("/");
  });

  const params = new URLSearchParams(window.location.search);
  const oauthError = params.get("oauth_error");
  if (oauthError && errorEl) {
    errorEl.hidden = false;
    errorEl.textContent = oauthError;
  }

  function selectedAccountType() {
    const checked = document.querySelector('input[name="accountType"]:checked');
    return checked?.value || "";
  }

  function syncAccountTypeUi() {
    const type = selectedAccountType();
    document.querySelectorAll("[data-account-type-option]").forEach((el) => {
      el.classList.toggle("is-selected", el.getAttribute("data-account-type-option") === type);
    });
    if (submitBtn) submitBtn.disabled = !type;
    if (errorEl && type) {
      // típus kiválasztva — töröld a „válassz típust” hibát, oauth_error-t hagyd
      if (errorEl.textContent.includes("Privát") || errorEl.textContent.includes("Céges") || errorEl.textContent.includes("fióktípus")) {
        errorEl.hidden = true;
        errorEl.textContent = "";
      }
    }
  }

  initOAuthButtons({
    next: "/",
    requireAccountType: true,
    getAccountType: selectedAccountType,
    onMissingAccountType: () => {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = "Előbb válaszd ki: Privát fiók vagy Céges fiók — utána Folytatás Google-lal.";
      }
      document.getElementById("account-type-pick")?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
  });

  document.querySelectorAll('input[name="accountType"]').forEach((input) => {
    input.addEventListener("change", syncAccountTypeUi);
  });
  syncAccountTypeUi();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (errorEl) errorEl.hidden = true;
    if (okEl) okEl.hidden = true;
    const accountType = selectedAccountType();
    if (!accountType) {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = "Válaszd ki: Privát fiók vagy Céges fiók.";
      }
      return;
    }
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    try {
      const result = await register(email, data.get("password"), data.get("password_confirm"), accountType);

      // Felhő + nincs SMTP: a szerver azonnal aktivál + session tokent ad → „be vagy lépve”.
      const autoLoggedIn = Boolean(result.token || result.user || result.needsActivation === false);
      if (autoLoggedIn) {
        if (result.user) rememberAuth(result);
        else await refreshAuthSession();
        window.alert(
          "Regisztráció sikeres — a fiók aktiválva, be is léptél.\n\n" +
            "Aktiváló email most nincs beállítva a szerveren, ezért mail nélkül is kész a fiók."
        );
        window.location.href = "/";
        return;
      }

      const msg = result.message || "Regisztráció sikeres.";
      const extra = result.activationLink
        ? `\n\nHa a leveleződ nem tölti be a képeket, nyisd meg:\n${result.activationLink}`
        : "\n\nNyisd meg az aktiváló emailt (spam mappa is) — a megnyitás aktiválja a fiókot.";
      window.alert(`${msg}${extra}`);
      window.location.href = "/belepes.html";
    } catch (error) {
      if (errorEl) {
        errorEl.hidden = false;
        const msg = error.message ?? "Sikertelen regisztráció.";
        // Már létező fiók: nincs új mail — irányítsuk belépésre / újraküldésre.
        if (String(msg).includes("már regisztrálva")) {
          const q = encodeURIComponent(email);
          errorEl.innerHTML =
            `Ez az email már regisztrálva van — ezért nem megy ki új aktiváló email.<br>` +
            `<a href="/belepes.html">Belépés</a>` +
            (email
              ? ` · <a href="/aktivalas.html?email=${q}">Aktiváló email újraküldése</a>`
              : "");
        } else {
          errorEl.textContent = msg;
        }
      }
    }
  });
}

export function initLoginPage() {
  const form = document.getElementById("login-form");
  const errorEl = document.getElementById("login-error");
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const next = safeInternalPath(params.get("next") || "/", "/");
  const oauthError = params.get("oauth_error");
  const okEl = document.getElementById("login-ok");
  if (oauthError && errorEl) {
    errorEl.hidden = false;
    errorEl.textContent = oauthError;
  }
  if (params.get("activated") === "1" && okEl) {
    okEl.hidden = false;
    okEl.textContent = "Fiók aktiválva. Most már beléphetsz.";
  }

  refreshAuthSession().then((user) => {
    if (user?.email) window.location.replace(next);
  });

  initOAuthButtons({ next });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.hidden = true;
    const data = new FormData(form);
    const email = data.get("email");
    try {
      await login(email, data.get("password"));
      window.location.href = next;
    } catch (error) {
      errorEl.hidden = false;
      let msg = error.message ?? "Sikertelen belépés.";
      if (String(msg).includes("aktiváld") || String(msg).includes("aktivál")) {
        errorEl.textContent = "";
        errorEl.append(
          document.createTextNode(
            "Előbb nyisd meg az aktiváló emailt (a megnyitás aktivál) — nézd a spam mappát is. "
          )
        );
        const a = document.createElement("a");
        a.href = `/aktivalas.html?email=${encodeURIComponent(String(email || ""))}`;
        a.textContent = "Aktiváló email újraküldése";
        errorEl.appendChild(a);
      } else {
        errorEl.textContent = msg;
      }
    }
  });
}

export async function initOAuthButtons({
  next = "/hirdetesfeladas.html",
  requireAccountType = false,
  getAccountType = null,
  onMissingAccountType = null,
} = {}) {
  const root = document.querySelector("[data-oauth-buttons]");
  if (!root) return;
  const hint = root.querySelector("[data-oauth-hint]");
  const buttons = [...root.querySelectorAll("[data-oauth-provider]")];

  let providers = [];
  try {
    const data = await authFetch("/api/auth/oauth/providers");
    providers = data.providers ?? [];
  } catch {
    providers = [];
  }

  const byId = new Map(providers.map((p) => [p.id, p]));
  const enabledCount = providers.filter((p) => p.enabled).length;

  for (const btn of buttons) {
    const id = btn.getAttribute("data-oauth-provider");
    const info = byId.get(id);
    const enabled = Boolean(info?.enabled);
    btn.hidden = false;
    btn.disabled = !enabled;
    btn.title = enabled
      ? `Belépés ${info?.label}-lal`
      : `${info?.label || id} még nincs beállítva a szerveren`;
    btn.addEventListener("click", () => {
      if (!enabled) {
        if (hint) {
          hint.hidden = false;
          hint.textContent =
            `${info?.label || id} belépés nincs bekapcsolva. Állítsd be a Google OAuth env változókat (mac/vercel-oauth-env.command), vagy használd az email regisztrációt.`;
        }
        return;
      }
      let accountType = "";
      if (typeof getAccountType === "function") {
        accountType = String(getAccountType() || "").trim();
      }
      if (requireAccountType && accountType !== "private" && accountType !== "business") {
        if (typeof onMissingAccountType === "function") onMissingAccountType();
        return;
      }
      const safeNext = safeInternalPath(next, "/hirdetesfeladas.html");
      const params = new URLSearchParams({ next: safeNext });
      if (accountType === "private" || accountType === "business") {
        params.set("accountType", accountType);
      }
      window.location.href = `/api/auth/oauth/start/${id}?${params}`;
    });
  }

  if (hint) {
    hint.hidden = enabledCount > 0;
    hint.textContent =
      enabledCount > 0
        ? ""
        : "Social belépés: állítsd be a Google OAuth env változókat (mac/vercel-oauth-env.command). Email regisztráció továbbra is működik.";
  }
}

export function initForgotPasswordPage() {
  const form = document.getElementById("forgot-form");
  const statusEl = document.getElementById("forgot-status");
  const errorEl = document.getElementById("forgot-error");
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const emailParam = params.get("email") || "";
  if (form.email && emailParam) form.email.value = emailParam;

  refreshAuthSession().then((user) => {
    if (user?.email) window.location.replace("/");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (errorEl) errorEl.hidden = true;
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = "Küldés…";
    }
    const email = new FormData(form).get("email");
    try {
      const result = await requestPasswordReset(email);
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "";
        statusEl.appendChild(
          document.createTextNode(
            result.message ||
              "Ha van ilyen email-jelszavas fiók, küldtünk visszaállító linket. Nézd a spam mappát is."
          )
        );
        const link = String(result.resetLink || "").trim();
        if (link) {
          try {
            const u = new URL(link, window.location.origin);
            const sameOrigin = u.origin === window.location.origin;
            const pathOk = safeInternalPath(u.pathname + u.search, "") === u.pathname + u.search;
            if (sameOrigin && pathOk && u.pathname.includes("jelszo-visszaallitas")) {
              statusEl.appendChild(document.createElement("br"));
              const a = document.createElement("a");
              a.href = u.pathname + u.search;
              a.textContent = "Visszaállító link";
              statusEl.appendChild(a);
            }
          } catch {
            /* ignore unsafe link */
          }
        }
      }
    } catch (error) {
      if (statusEl) statusEl.hidden = true;
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = error.message ?? "Küldés sikertelen.";
      }
    }
  });
}

export function initResetPasswordPage() {
  const form = document.getElementById("reset-form");
  const errorEl = document.getElementById("reset-error");
  const statusEl = document.getElementById("reset-status");
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";

  if (!token) {
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent =
        "Hiányzó vagy érvénytelen link. Kérj újat az elfelejtett jelszó oldalon.";
    }
    if (form) form.hidden = true;
    return;
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (errorEl) errorEl.hidden = true;
    const data = new FormData(form);
    try {
      const result = await resetPasswordByToken(
        token,
        data.get("password"),
        data.get("password_confirm")
      );
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = result.message || "Az új jelszó mentve. Átirányítás a belépéshez…";
      }
      window.setTimeout(() => {
        window.location.href = "/belepes.html";
      }, 1200);
    } catch (error) {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = error.message ?? "Sikertelen visszaállítás.";
      }
    }
  });
}

export function initActivatePage() {
  const statusEl = document.getElementById("activate-status");
  const form = document.getElementById("resend-form");
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const emailParam = params.get("email") || "";

  if (form?.email && emailParam) form.email.value = emailParam;

  async function activate(tok) {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.textContent = "Aktiválás…";
    try {
      await activateAccount(tok);
      statusEl.textContent = "Fiók aktiválva. Átirányítás a belépéshez…";
      window.location.href = "/belepes.html?activated=1";
    } catch (error) {
      statusEl.textContent = error.message ?? "Aktiválás sikertelen.";
    }
  }

  if (token) activate(token);

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = new FormData(form).get("email");
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = "Küldés…";
    }
    try {
      const result = await resendActivation(email);
      if (statusEl) {
        statusEl.textContent = "";
        statusEl.appendChild(document.createTextNode(result.message || "Elküldve."));
        const link = String(result.activationLink || "").trim();
        if (link && safeInternalPath(new URL(link, window.location.origin).pathname) !== "/") {
          // Only show link if same-origin relative activation path
        }
        if (link) {
          try {
            const u = new URL(link, window.location.origin);
            const sameOrigin = u.origin === window.location.origin;
            const pathOk = safeInternalPath(u.pathname + u.search, "") === u.pathname + u.search;
            if (sameOrigin && pathOk && u.pathname.includes("aktivalas")) {
              statusEl.appendChild(document.createElement("br"));
              const a = document.createElement("a");
              a.href = u.pathname + u.search;
              a.textContent = "Aktiváló link";
              statusEl.appendChild(a);
            }
          } catch {
            /* ignore unsafe link */
          }
        }
      }
    } catch (error) {
      if (statusEl) statusEl.textContent = error.message ?? "Küldés sikertelen.";
    }
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (document.body?.dataset?.authInit !== "manual") initSiteAuth();
      enforceClientMembersGate();
    });
  } else {
    if (document.body?.dataset?.authInit !== "manual") initSiteAuth();
    enforceClientMembersGate();
  }
  if (!window.__bymyVisitBoot && !isAuthGatePage()) {
    window.__bymyVisitBoot = true;
    const s = document.createElement("script");
    s.src = "/js/site-visit.js?v=visit2";
    s.defer = true;
    (document.head || document.documentElement).appendChild(s);
  }
}
