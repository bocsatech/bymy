/** Régi autosweb-* localStorage kulcsok átvezetése bymy-*-ra (adatvesztés nélkül). */
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
const LEGACY_USERS_KEY = "bymy-auth-users";
const PROFILE_BACKUP_KEY = "bymy-profile-backup";

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
  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
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

export async function refreshAuthSession() {
  try {
    const data = await authFetch("/api/auth/me");
    if (!data.user?.email) {
      setStoredToken("");
      sessionStorage.removeItem(AUTH_KEY);
      return null;
    }
    return rememberAuth(data);
  } catch {
    const cached = getAuthUser();
    if (cached?.email) return cached;
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
  companyTaxId: "",
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
  const email = getAuthUser()?.email || data.user?.email;
  if (data.profile?.firstName) backupProfileLocally(email, data.profile);

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
  return `/belepes.html?next=${encodeURIComponent(nextPath)}`;
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

function updateHeaderAuthUi() {
  const registerBtns = document.querySelectorAll("[data-auth-register]");
  const loginBtns = document.querySelectorAll("[data-auth-login]");
  const guestBlocks = document.querySelectorAll("[data-auth-guest]");
  const memberBlocks = document.querySelectorAll("[data-auth-member], [data-avatar-menu]");
  const firstNameEls = document.querySelectorAll("span[data-auth-firstname]");
  const user = getAuthUser();
  const loggedIn = Boolean(user?.email);
  const firstName = firstNameFromUser(user);

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

  // Az avatar menü külön script (site-avatar-menu.js) — ne importáld újra (különben dupla listener).
  window.dispatchEvent(new CustomEvent("bymy-auth-changed"));
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
  const next = params.get("next") || "/";
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
    if (user?.email) window.location.replace(next.startsWith("/") ? next : "/");
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
        msg =
          `Előbb nyisd meg az aktiváló emailt (a megnyitás aktivál) — nézd a spam mappát is.` +
          ` — <a href="/aktivalas.html?email=${encodeURIComponent(String(email || ""))}">Aktiváló email újraküldése</a>`;
        errorEl.innerHTML = msg;
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

  for (const btn of buttons) {
    const id = btn.getAttribute("data-oauth-provider");
    const info = byId.get(id);
    const enabled = Boolean(info?.enabled);
    btn.disabled = !enabled;
    btn.title = enabled ? `Belépés ${info.label}-lal` : `${info?.label || id} jelenleg nem elérhető`;
    btn.addEventListener("click", () => {
      if (!enabled) return;
      let accountType = "";
      if (typeof getAccountType === "function") {
        accountType = String(getAccountType() || "").trim();
      }
      if (requireAccountType && accountType !== "private" && accountType !== "business") {
        if (typeof onMissingAccountType === "function") onMissingAccountType();
        return;
      }
      const params = new URLSearchParams({ next });
      if (accountType === "private" || accountType === "business") {
        params.set("accountType", accountType);
      }
      window.location.href = `/api/auth/oauth/start/${id}?${params}`;
    });
  }

  if (hint) {
    hint.hidden = true;
    hint.textContent = "";
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
