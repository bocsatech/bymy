/** OAuth (Google / Apple / Facebook) — config: ~/.autosweb/oauth.json */

import {
  createHmac,
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { safeInternalPath } from "./safe-path.mjs";
import { isServerlessRuntime } from "./runtime.mjs";

export { isServerlessRuntime } from "./runtime.mjs";
export const OAUTH_PROVIDERS = ["google", "apple", "facebook"];
export const IOS_OAUTH_SCHEME = "bymy";
export const IOS_OAUTH_CALLBACK = `${IOS_OAUTH_SCHEME}://oauth-complete`;
export const IOS_BUNDLE_ID = "hu.bymy.app";

const EXAMPLE = {
  publicBaseUrl: "http://127.0.0.1:3456",
  stateSecret: "",
  google: {
    enabled: false,
    clientId: "",
    clientSecret: "",
  },
  facebook: {
    enabled: false,
    appId: "",
    appSecret: "",
  },
  apple: {
    enabled: false,
    clientId: "com.example.web",
    teamId: "",
    keyId: "",
    privateKeyPath: "~/.autosweb/AuthKey_XXXXX.p8",
  },
};

export function oauthConfigPath() {
  if (process.env.AUTOSWEB_OAUTH_PATH) return process.env.AUTOSWEB_OAUTH_PATH;
  return join(homedir(), ".autosweb", "oauth.json");
}

export function ensureOAuthExample() {
  if (isServerlessRuntime()) return null;
  try {
    const dir = join(homedir(), ".autosweb");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const examplePath = join(dir, "oauth.example.json");
    const example = {
      ...EXAMPLE,
      stateSecret: randomBytes(24).toString("hex"),
    };
    writeFileSync(examplePath, JSON.stringify(example, null, 2) + "\n", "utf8");
    return examplePath;
  } catch {
    return null;
  }
}

function expandHome(path) {
  const raw = String(path ?? "").trim();
  if (raw.startsWith("~/")) return join(homedir(), raw.slice(2));
  return raw;
}

function envValue(...names) {
  for (const name of names) {
    const v = String(process.env[name] ?? "").trim();
    if (v) return v;
  }
  return "";
}

function envPem(name) {
  return envValue(name).replace(/\\n/g, "\n");
}

function loadOAuthFromFile() {
  const path = oauthConfigPath();
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    return {
      publicBaseUrl: String(raw.publicBaseUrl || "").replace(/\/$/, ""),
      stateSecret: String(raw.stateSecret || "").trim(),
      google: {
        enabled: Boolean(raw.google?.enabled),
        clientId: String(raw.google?.clientId || "").trim(),
        clientSecret: String(raw.google?.clientSecret || "").trim(),
      },
      facebook: {
        enabled: Boolean(raw.facebook?.enabled),
        appId: String(raw.facebook?.appId || "").trim(),
        appSecret: String(raw.facebook?.appSecret || "").trim(),
      },
      apple: {
        enabled: Boolean(raw.apple?.enabled),
        clientId: String(raw.apple?.clientId || "").trim(),
        teamId: String(raw.apple?.teamId || "").trim(),
        keyId: String(raw.apple?.keyId || "").trim(),
        privateKeyPath: expandHome(raw.apple?.privateKeyPath || ""),
        privateKey: String(raw.apple?.privateKey || "").trim(),
      },
    };
  } catch {
    return null;
  }
}

function loadOAuthFromEnv() {
  const googleId = envValue("GOOGLE_CLIENT_ID", "OAUTH_GOOGLE_CLIENT_ID");
  const googleSecret = envValue("GOOGLE_CLIENT_SECRET", "OAUTH_GOOGLE_CLIENT_SECRET");
  const fbId = envValue("FACEBOOK_APP_ID", "OAUTH_FACEBOOK_APP_ID");
  const fbSecret = envValue("FACEBOOK_APP_SECRET", "OAUTH_FACEBOOK_APP_SECRET");
  const appleId = envValue("APPLE_CLIENT_ID", "OAUTH_APPLE_CLIENT_ID");
  const appleTeam = envValue("APPLE_TEAM_ID");
  const appleKeyId = envValue("APPLE_KEY_ID");
  const appleKey = envPem("APPLE_PRIVATE_KEY");
  const applePath = expandHome(envValue("APPLE_PRIVATE_KEY_PATH"));
  return {
    publicBaseUrl: envValue("OAUTH_PUBLIC_BASE_URL", "PUBLIC_BASE_URL").replace(/\/$/, ""),
    stateSecret: envValue("OAUTH_STATE_SECRET"),
    google: {
      enabled: Boolean(googleId && googleSecret),
      clientId: googleId,
      clientSecret: googleSecret,
    },
    facebook: {
      enabled: Boolean(fbId && fbSecret),
      appId: fbId,
      appSecret: fbSecret,
    },
    apple: {
      enabled: Boolean(appleId && appleTeam && appleKeyId && (appleKey || applePath)),
      clientId: appleId,
      teamId: appleTeam,
      keyId: appleKeyId,
      privateKeyPath: applePath,
      privateKey: appleKey,
    },
  };
}

function pickStr(...values) {
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

export function loadOAuthConfig() {
  const file = loadOAuthFromFile();
  const env = loadOAuthFromEnv();
  const googleId = pickStr(env.google.clientId, file?.google?.clientId);
  const googleSecret = pickStr(env.google.clientSecret, file?.google?.clientSecret);
  const fbId = pickStr(env.facebook.appId, file?.facebook?.appId);
  const fbSecret = pickStr(env.facebook.appSecret, file?.facebook?.appSecret);
  const appleId = pickStr(env.apple.clientId, file?.apple?.clientId);
  const appleTeam = pickStr(env.apple.teamId, file?.apple?.teamId);
  const appleKeyId = pickStr(env.apple.keyId, file?.apple?.keyId);
  const applePath = pickStr(env.apple.privateKeyPath, file?.apple?.privateKeyPath);
  const appleKey = pickStr(env.apple.privateKey, file?.apple?.privateKey);
  const publicBase = pickStr(
    env.publicBaseUrl,
    file?.publicBaseUrl,
    String(process.env.PUBLIC_BASE_URL ?? "").trim().replace(/\/$/, ""),
    process.env.VERCEL ? "https://bymy.vercel.app" : "",
    process.env.VERCEL_URL ? `https://${String(process.env.VERCEL_URL).replace(/\/$/, "")}` : "",
    "http://127.0.0.1:3456"
  );
  return {
    publicBaseUrl: publicBase.replace(/\/$/, ""),
    stateSecret: pickStr(env.stateSecret, file?.stateSecret),
    google: {
      enabled: Boolean(file?.google?.enabled || env.google.enabled) && Boolean(googleId && googleSecret),
      clientId: googleId,
      clientSecret: googleSecret,
    },
    facebook: {
      enabled: Boolean(file?.facebook?.enabled || env.facebook.enabled) && Boolean(fbId && fbSecret),
      appId: fbId,
      appSecret: fbSecret,
    },
    apple: {
      enabled:
        Boolean(file?.apple?.enabled || env.apple.enabled) &&
        Boolean(appleId && appleTeam && appleKeyId && (appleKey || applePath)),
      clientId: appleId,
      teamId: appleTeam,
      keyId: appleKeyId,
      privateKeyPath: applePath,
      privateKey: appleKey,
    },
  };
}

function getStateSecret(cfg) {
  if (cfg?.stateSecret) return cfg.stateSecret;
  return "autosweb-dev-oauth-state";
}

export function isProviderConfigured(provider, cfg = loadOAuthConfig()) {
  if (!cfg) return false;
  const p = String(provider || "").toLowerCase();
  if (p === "google") {
    return Boolean(cfg.google.enabled && cfg.google.clientId && cfg.google.clientSecret);
  }
  if (p === "facebook") {
    return Boolean(cfg.facebook.enabled && cfg.facebook.appId && cfg.facebook.appSecret);
  }
  if (p === "apple") {
    return Boolean(
      cfg.apple.enabled &&
        cfg.apple.clientId &&
        cfg.apple.teamId &&
        cfg.apple.keyId &&
        applePrivateKeyPem(cfg, false)
    );
  }
  return false;
}

export function listOAuthProviders(cfg = loadOAuthConfig()) {
  return OAUTH_PROVIDERS.map((id) => ({
    id,
    label: id === "google" ? "Google" : id === "apple" ? "Apple" : "Facebook",
    enabled: isProviderConfigured(id, cfg),
  }));
}

export function callbackUrl(provider, cfg = loadOAuthConfig()) {
  const base = cfg?.publicBaseUrl || "http://127.0.0.1:3456";
  return `${base}/api/auth/oauth/callback/${provider}`;
}

function b64urlJson(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

export function isMobileOAuthNext(next) {
  return String(next || "").startsWith(`${IOS_OAUTH_SCHEME}://`);
}

export function mobileOAuthCompleteUrl({ token = "", error = "" } = {}) {
  const url = new URL(IOS_OAUTH_CALLBACK);
  if (token) url.searchParams.set("token", token);
  if (error) url.searchParams.set("error", String(error).slice(0, 300));
  return url.toString();
}

export function createOAuthState(provider, nextPath = "/hirdetesfeladas.html", cfg = loadOAuthConfig(), accountType = "") {
  const rawNext = String(nextPath || "/hirdetesfeladas.html").slice(0, 200);
  const next = isMobileOAuthNext(rawNext) ? rawNext : safeInternalPath(rawNext, "/hirdetesfeladas.html");
  const payload = {
    p: String(provider).toLowerCase(),
    n: next,
    m: isMobileOAuthNext(next) ? 1 : 0,
    t: accountType === "business" ? "b" : accountType === "private" ? "p" : "",
    e: Date.now() + 15 * 60 * 1000,
    r: randomBytes(8).toString("hex"),
  };
  const data = b64urlJson(payload);
  const sig = createHmac("sha256", getStateSecret(cfg)).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function parseOAuthState(state, expectedProvider, cfg = loadOAuthConfig()) {
  const raw = String(state || "");
  const [data, sig] = raw.split(".");
  if (!data || !sig) throw new Error("Érvénytelen OAuth state.");
  const expected = createHmac("sha256", getStateSecret(cfg)).update(data).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Érvénytelen OAuth state aláírás.");
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    throw new Error("Érvénytelen OAuth state.");
  }
  if (!payload?.e || Date.now() > Number(payload.e)) {
    throw new Error("Az OAuth belépés lejárt — próbáld újra.");
  }
  if (expectedProvider && payload.p !== expectedProvider) {
    throw new Error("OAuth provider eltérés.");
  }
  return {
    provider: payload.p,
    next: payload.n || "/hirdetesfeladas.html",
    mobile: Boolean(payload.m) || isMobileOAuthNext(payload.n),
    accountType: payload.t === "b" ? "business" : payload.t === "p" ? "private" : "",
  };
}

function applePrivateKeyPem(cfg, required = true) {
  const pem = String(cfg?.apple?.privateKey || "").trim();
  if (pem.includes("BEGIN")) return pem;
  const path = String(cfg?.apple?.privateKeyPath || "").trim();
  if (path && existsSync(path)) return readFileSync(path, "utf8");
  if (required) throw new Error("Apple private key hiányzik.");
  return "";
}

function appleClientSecret(cfg) {
  const apple = cfg.apple;
  const pem = applePrivateKeyPem(cfg);
  const key = createPrivateKey(pem);
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlJson({ alg: "ES256", kid: apple.keyId });
  const body = b64urlJson({
    iss: apple.teamId,
    iat: now,
    exp: now + 60 * 50,
    aud: "https://appleid.apple.com",
    sub: apple.clientId,
  });
  const unsigned = `${header}.${body}`;
  const signer = createSign("SHA256");
  signer.update(unsigned);
  signer.end();
  const sig = signer.sign({ key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${unsigned}.${sig}`;
}

function decodeJwtPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function buildAuthorizeUrl(provider, state, cfg = loadOAuthConfig()) {
  if (!isProviderConfigured(provider, cfg)) {
    const p = String(provider || "").toLowerCase();
    const label = p === "google" ? "Google" : p === "apple" ? "Apple" : p === "facebook" ? "Facebook" : provider;
    if (isServerlessRuntime()) {
      throw new Error(
        `${label} belépés nincs beállítva. Állítsd be a Vercel env változókat (APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY).`
      );
    }
    throw new Error(`${label} OAuth nincs beállítva (~/.autosweb/oauth.json).`);
  }
  const redirectUri = callbackUrl(provider, cfg);

  if (provider === "google") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", cfg.google.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "online");
    url.searchParams.set("prompt", "select_account");
    return url.toString();
  }

  if (provider === "facebook") {
    const url = new URL("https://www.facebook.com/v19.0/dialog/oauth");
    url.searchParams.set("client_id", cfg.facebook.appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "email,public_profile");
    return url.toString();
  }

  if (provider === "apple") {
    const url = new URL("https://appleid.apple.com/auth/authorize");
    url.searchParams.set("client_id", cfg.apple.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("response_mode", "form_post");
    url.searchParams.set("scope", "name email");
    url.searchParams.set("state", state);
    return url.toString();
  }

  throw new Error(`Ismeretlen OAuth provider: ${provider}`);
}

async function postForm(url, params) {
  const body = new URLSearchParams(params);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = Object.fromEntries(new URLSearchParams(text));
  }
  if (!response.ok) {
    const msg = data.error_description || data.error || text.slice(0, 200);
    throw new Error(`Token csere sikertelen (${providerLabel(url)}): ${msg}`);
  }
  return data;
}

function providerLabel(url) {
  if (String(url).includes("apple")) return "Apple";
  if (String(url).includes("facebook") || String(url).includes("graph")) return "Facebook";
  return "Google";
}

export async function exchangeOAuthCode(provider, code, cfg = loadOAuthConfig()) {
  if (!isProviderConfigured(provider, cfg)) {
    throw new Error(`${provider} OAuth nincs beállítva.`);
  }
  const redirectUri = callbackUrl(provider, cfg);
  const authCode = String(code || "").trim();
  if (!authCode) throw new Error("Hiányzó OAuth authorization code.");

  if (provider === "google") {
    const token = await postForm("https://oauth2.googleapis.com/token", {
      code: authCode,
      client_id: cfg.google.clientId,
      client_secret: cfg.google.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const info = await infoRes.json();
    if (!infoRes.ok || !info.sub) {
      throw new Error("Google userinfo sikertelen.");
    }
    return {
      provider: "google",
      subject: String(info.sub),
      email: info.email || "",
      name: info.name || [info.given_name, info.family_name].filter(Boolean).join(" "),
      emailVerified: info.email_verified !== false,
      profile: info,
    };
  }

  if (provider === "facebook") {
    const token = await postForm("https://graph.facebook.com/v19.0/oauth/access_token", {
      code: authCode,
      client_id: cfg.facebook.appId,
      client_secret: cfg.facebook.appSecret,
      redirect_uri: redirectUri,
    });
    const meUrl = new URL("https://graph.facebook.com/me");
    meUrl.searchParams.set("fields", "id,name,email");
    meUrl.searchParams.set("access_token", token.access_token);
    const meRes = await fetch(meUrl);
    const me = await meRes.json();
    if (!meRes.ok || !me.id) {
      throw new Error(me.error?.message || "Facebook profil lekérés sikertelen.");
    }
    return {
      provider: "facebook",
      subject: String(me.id),
      email: me.email || "",
      name: me.name || "",
      emailVerified: Boolean(me.email),
      profile: me,
    };
  }

  if (provider === "apple") {
    const token = await postForm("https://appleid.apple.com/auth/token", {
      code: authCode,
      client_id: cfg.apple.clientId,
      client_secret: appleClientSecret(cfg),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const claims = decodeJwtPayload(token.id_token) || {};
    if (!claims.sub) throw new Error("Apple id_token érvénytelen.");
    return {
      provider: "apple",
      subject: String(claims.sub),
      email: claims.email || "",
      name: "",
      emailVerified: claims.email_verified === true || claims.email_verified === "true",
      profile: claims,
    };
  }

  throw new Error(`Ismeretlen OAuth provider: ${provider}`);
}

/** Apple form_post name mező (JSON string) összefűzése. */
export function appleNameFromForm(userJson) {
  if (!userJson) return "";
  try {
    const parsed = typeof userJson === "string" ? JSON.parse(userJson) : userJson;
    const name = parsed?.name;
    if (!name) return "";
    return [name.firstName, name.lastName].filter(Boolean).join(" ").trim();
  } catch {
    return "";
  }
}

let appleJwksCache = { keys: null, fetchedAt: 0 };

async function applePublicKey(kid) {
  if (!appleJwksCache.keys || Date.now() - appleJwksCache.fetchedAt > 60 * 60 * 1000) {
    const res = await fetch("https://appleid.apple.com/auth/keys");
    if (!res.ok) throw new Error("Apple kulcsok lekérése sikertelen.");
    appleJwksCache = { keys: await res.json(), fetchedAt: Date.now() };
  }
  const jwk = (appleJwksCache.keys?.keys || []).find((k) => k.kid === kid);
  if (!jwk) throw new Error("Apple kulcs nem található.");
  return createPublicKey({ key: jwk, format: "jwk" });
}

function allowedAppleAudiences(cfg = loadOAuthConfig()) {
  return new Set(
    [IOS_BUNDLE_ID, cfg?.apple?.clientId, envValue("APPLE_BUNDLE_ID")]
      .map((s) => String(s || "").trim())
      .filter(Boolean)
  );
}

/** Native Sign in with Apple — identity token ellenőrzése Apple JWKS-sel. */
export async function verifyAppleIdentityToken(idToken, cfg = loadOAuthConfig()) {
  const raw = String(idToken || "").trim();
  const parts = raw.split(".");
  if (parts.length !== 3) throw new Error("Érvénytelen Apple token.");
  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("Érvénytelen Apple token.");
  }
  const key = await applePublicKey(header.kid);
  const verifier = createVerify("SHA256");
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  const ok = verifier.verify({ key, dsaEncoding: "ieee-p1363" }, parts[2], "base64url");
  if (!ok) throw new Error("Apple aláírás érvénytelen.");
  if (payload.iss !== "https://appleid.apple.com") {
    throw new Error("Apple token kibocsátó érvénytelen.");
  }
  if (payload.exp && Date.now() / 1000 > Number(payload.exp)) {
    throw new Error("Apple token lejárt.");
  }
  const aud = payload.aud;
  const audList = Array.isArray(aud) ? aud : [aud];
  const allowed = allowedAppleAudiences(cfg);
  if (!audList.some((a) => allowed.has(String(a)))) {
    throw new Error("Apple token audience érvénytelen.");
  }
  if (!payload.sub) throw new Error("Apple token érvénytelen.");
  return {
    provider: "apple",
    subject: String(payload.sub),
    email: payload.email || "",
    name: "",
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    profile: payload,
  };
}
