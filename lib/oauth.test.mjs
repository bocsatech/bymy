import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import test from "node:test";
import assert from "node:assert/strict";

const dir = mkdtempSync(join(tmpdir(), "autosweb-oauth-"));
process.env.AUTOSWEB_DB_PATH = join(dir, "test.db");
process.env.AUTOSWEB_PROFILES_PATH = join(dir, "profiles.json");
process.env.AUTOSWEB_OAUTH_PATH = join(dir, "oauth.json");

writeFileSync(
  process.env.AUTOSWEB_OAUTH_PATH,
  JSON.stringify(
    {
      publicBaseUrl: "http://127.0.0.1:3456",
      stateSecret: "test-secret-123",
      google: { enabled: true, clientId: "gid", clientSecret: "gsec" },
      facebook: { enabled: false, appId: "", appSecret: "" },
      apple: {
        enabled: false,
        clientId: "",
        teamId: "",
        keyId: "",
        privateKeyPath: "",
      },
    },
    null,
    2
  )
);

const {
  createOAuthState,
  parseOAuthState,
  listOAuthProviders,
  buildAuthorizeUrl,
  isProviderConfigured,
  callbackUrl,
} = await import(`./oauth.mjs?t=${Date.now()}`);

const { findOrCreateOAuthUser, loginUser, getUserBySessionToken, listUserIdentities } = await import(
  `./web-users.mjs?t=${Date.now()}`
);

test("OAuth state aláírás roundtrip", () => {
  const state = createOAuthState("google", "/beallitasok.html");
  const parsed = parseOAuthState(state, "google");
  assert.equal(parsed.provider, "google");
  assert.equal(parsed.next, "/beallitasok.html");
  assert.throws(() => parseOAuthState(state + "x", "google"), /aláírás|state/i);
});

test("provider lista: csak Google enabled", () => {
  const list = listOAuthProviders();
  assert.equal(list.find((p) => p.id === "google")?.enabled, true);
  assert.equal(list.find((p) => p.id === "facebook")?.enabled, false);
  assert.equal(isProviderConfigured("google"), true);
  assert.equal(isProviderConfigured("apple"), false);
});

test("Google authorize URL", () => {
  const state = createOAuthState("google");
  const url = buildAuthorizeUrl("google", state);
  assert.match(url, /accounts\.google\.com/);
  assert.match(url, /client_id=gid/);
  assert.ok(url.includes(encodeURIComponent(callbackUrl("google"))));
});

test("findOrCreateOAuthUser: létrehoz + újra belép + email link", () => {
  const first = findOrCreateOAuthUser({
    provider: "google",
    subject: "sub-100",
    email: "oauth@local.dev",
    name: "OAuth Teszt",
    emailVerified: true,
  });
  assert.equal(first.created, true);
  assert.equal(first.user.email, "oauth@local.dev");
  assert.ok(first.session.token);
  assert.ok(getUserBySessionToken(first.session.token));

  const again = findOrCreateOAuthUser({
    provider: "google",
    subject: "sub-100",
    email: "oauth@local.dev",
  });
  assert.equal(again.created, false);
  assert.equal(again.user.id, first.user.id);

  const linked = findOrCreateOAuthUser({
    provider: "facebook",
    subject: "fb-9",
    email: "oauth@local.dev",
    name: "FB",
  });
  assert.equal(linked.user.id, first.user.id);
  const ids = listUserIdentities(first.user.id);
  assert.equal(ids.length, 2);

  assert.throws(() => loginUser("oauth@local.dev", "barmi"), /social|Google|Apple|Facebook/i);
});

test.after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});
