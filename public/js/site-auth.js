const AUTH_KEY = "autosweb-auth-user";
const TOKEN_KEY = "autosweb-auth-token";
const LEGACY_USERS_KEY = "autosweb-auth-users";
const PROFILE_BACKUP_KEY = "autosweb-profile-backup";

function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function setStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function backupProfileLocally(email, profile) {
  if (!email || !profile?.firstName) return;
  try {
    localStorage.setItem(
      PROFILE_BACKUP_KEY,
      JSON.stringify({ email, profile, savedAt: Date.now() })
    );
  } catch {
    /* ignore */
  }
}

function readLocalProfileBackup(email) {
  if (!email) return null;
  try {
    const raw = localStorage.getItem(PROFILE_BACKUP_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.email === email && data?.profile?.firstName) return data.profile;
  } catch {
    /* ignore */
  }
  return null;
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
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) {
    throw new Error(data.error || "Kérés sikertelen.");
  }
  if (data.token) setStoredToken(data.token);
  return data;
}

export async function refreshAuthSession() {
  try {
    const data = await authFetch("/api/auth/me");
    if (!data.user?.email) {
      sessionStorage.removeItem(AUTH_KEY);
      return null;
    }
    return rememberAuth(data);
  } catch {
    sessionStorage.removeItem(AUTH_KEY);
    return null;
  }
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
  if (user && !data.profile?.firstName) {
    await maybeRestoreProfile(user);
    return getProfile();
  }
  if (data.profile?.firstName && user?.email) {
    backupProfileLocally(user.email, data.profile);
  }
  return data.profile ?? getProfile();
}

async function maybeRestoreProfile(user) {
  if (!user?.email || user.profile?.firstName) return;
  const backup = readLocalProfileBackup(user.email);
  if (backup?.firstName && backup?.lastName) {
    try {
      await saveProfile(backup);
      return;
    } catch {
      /* try legacy next */
    }
  }
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_USERS_KEY) || "{}");
    const profile = legacy[user.email]?.profile;
    if (profile?.firstName && profile?.lastName) {
      await saveProfile(profile);
    }
  } catch {
    /* ignore */
  }
}

export async function register(email, password, passwordConfirm) {
  const data = await authFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      passwordConfirm,
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

export async function login(email, password) {
  const data = await authFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const user = rememberAuth(data);
  await maybeRestoreProfile(user);
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

export async function deleteAccount() {
  await authFetch("/api/auth/account", { method: "DELETE" });
  sessionStorage.removeItem(AUTH_KEY);
  setStoredToken("");
  try {
    localStorage.removeItem(PROFILE_BACKUP_KEY);
  } catch {
    /* ignore */
  }
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
  accountType: "private",
};

export function getProfile() {
  const user = getAuthUser();
  if (!user?.email) return { ...EMPTY_PROFILE };
  return { ...EMPTY_PROFILE, ...(user.profile || {}) };
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
      user.displayName = [data.profile.firstName, data.profile.lastName].filter(Boolean).join(" ");
      setCachedUser(user);
    }
  }
  if (!data.profile?.firstName) {
    throw new Error("A mentés nem sikerült — próbáld újra belépés után.");
  }
  const email = getAuthUser()?.email || data.user?.email;
  backupProfileLocally(email, data.profile);

  // Újraolvasás — ha a szerver üresen adná vissza, azonnal jelezzük.
  try {
    const verify = await authFetch("/api/auth/profile");
    if (!verify.profile?.firstName) {
      throw new Error("A mentés nem került a helyi adatbázisba.");
    }
    if (verify.user) rememberAuth(verify);
  } catch (error) {
    if (String(error.message || "").includes("adatbázisba")) throw error;
  }
  return { ...data.profile, _savedTo: data.savedTo || null };
}

function loginUrl(nextPath = "/hirdetesfeladas.html") {
  return `/belepes.html?next=${encodeURIComponent(nextPath)}`;
}

function updateHeaderAuthUi() {
  const loginBtn = document.querySelector("[data-auth-login], [data-auth-logout]");
  const registerBtns = document.querySelectorAll("[data-auth-register]");
  const user = getAuthUser();
  const loggedIn = Boolean(user?.email);

  registerBtns.forEach((btn) => {
    btn.hidden = loggedIn;
  });

  if (loginBtn) {
    if (loggedIn) {
      loginBtn.textContent = "Kijelentkezés";
      loginBtn.href = "#";
      loginBtn.removeAttribute("data-auth-login");
      loginBtn.setAttribute("data-auth-logout", "");
      loginBtn.classList.remove("site-header-btn--ghost");
      loginBtn.classList.add("site-header-btn--outline");
      loginBtn.title = user.email;
    } else {
      loginBtn.textContent = "Belépés";
      loginBtn.href = "/belepes.html";
      loginBtn.setAttribute("data-auth-login", "");
      loginBtn.removeAttribute("data-auth-logout");
      loginBtn.classList.add("site-header-btn--ghost");
      loginBtn.classList.remove("site-header-btn--outline");
      loginBtn.removeAttribute("title");
    }
  }

  // Az avatar menü külön script (site-avatar-menu.js) — ne importáld újra (különben dupla listener).
  window.dispatchEvent(new CustomEvent("autosweb-auth-changed"));
}

export function initSiteAuth(options = {}) {
  if (options.skipRefresh) {
    updateHeaderAuthUi();
  } else {
    refreshAuthSession().finally(() => {
      updateHeaderAuthUi();
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

export function initRegisterPage() {
  const form = document.getElementById("register-form");
  const errorEl = document.getElementById("register-error");
  const okEl = document.getElementById("register-ok");
  if (!form) return;

  initOAuthButtons();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (errorEl) errorEl.hidden = true;
    if (okEl) okEl.hidden = true;
    const data = new FormData(form);
    try {
      const result = await register(data.get("email"), data.get("password"), data.get("password_confirm"));
      form.hidden = true;
      if (okEl) {
        okEl.hidden = false;
        const linkHint = result.activationLink
          ? `<p class="login-hint">SMTP nincs beállítva — használd a linket:<br/><a href="${result.activationLink}">${result.activationLink}</a></p>`
          : `<p class="login-hint">Nézd meg a postaládát (és a spam mappát).</p>`;
        okEl.innerHTML = `<strong>${result.message || "Regisztráció sikeres."}</strong>${linkHint}<p class="login-hint"><a href="/belepes.html">Tovább a belépéshez</a></p>`;
      }
    } catch (error) {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = error.message ?? "Sikertelen regisztráció.";
      }
    }
  });
}

export function initLoginPage() {
  const form = document.getElementById("login-form");
  const errorEl = document.getElementById("login-error");
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const next = params.get("next") || "/hirdetesfeladas.html";
  const oauthError = params.get("oauth_error");
  if (oauthError && errorEl) {
    errorEl.hidden = false;
    errorEl.textContent = oauthError;
  }

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
        msg += ` — <a href="/aktivalas.html?email=${encodeURIComponent(String(email || ""))}">Aktiváló email újraküldése</a>`;
        errorEl.innerHTML = msg;
      } else {
        errorEl.textContent = msg;
      }
    }
  });
}

export async function initOAuthButtons({ next = "/hirdetesfeladas.html" } = {}) {
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
    btn.disabled = !enabled;
    btn.title = enabled
      ? `Belépés ${info.label}-lal`
      : `${info?.label || id} még nincs beállítva (~/.autosweb/oauth.json)`;
    btn.addEventListener("click", () => {
      if (!enabled) {
        if (hint) {
          hint.hidden = false;
          hint.textContent =
            `${info?.label || id} OAuth nincs bekapcsolva. Futtasd: autosweb/mac/oauth-beallitas.command, majd töltsd ki a ~/.autosweb/oauth.json fájlt.`;
        }
        return;
      }
      const params = new URLSearchParams({ next });
      window.location.href = `/api/auth/oauth/start/${id}?${params}`;
    });
  }

  if (hint && enabledCount === 0) {
    hint.hidden = false;
    hint.textContent =
      "Social belépés: állítsd be a Google / Apple / Facebook appokat (~/.autosweb/oauth.json). Email regisztráció továbbra is működik.";
  }
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
      statusEl.textContent = "Fiók aktiválva. Átirányítás…";
      window.location.href = "/beallitasok.html?szekcio=fiok";
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
        statusEl.innerHTML = result.activationLink
          ? `${result.message}<br/><a href="${result.activationLink}">Aktiváló link</a>`
          : result.message || "Elküldve.";
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
    });
  } else if (document.body?.dataset?.authInit !== "manual") {
    initSiteAuth();
  }
}
