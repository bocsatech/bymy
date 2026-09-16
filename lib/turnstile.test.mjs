import test from "node:test";
import assert from "node:assert/strict";
import {
  isTurnstileEnabled,
  isTurnstileRequired,
  turnstilePublicConfig,
  verifyTurnstileToken,
} from "./turnstile.mjs";

function withoutTurnstileEnv(fn) {
  const prevSite = process.env.TURNSTILE_SITE_KEY;
  const prevSecret = process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  try {
    return fn();
  } finally {
    if (prevSite === undefined) delete process.env.TURNSTILE_SITE_KEY;
    else process.env.TURNSTILE_SITE_KEY = prevSite;
    if (prevSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = prevSecret;
  }
}

test("turnstile disabled without env keys", () => {
  withoutTurnstileEnv(() => {
    assert.equal(isTurnstileEnabled(), false);
    assert.deepEqual(turnstilePublicConfig(), { enabled: false, siteKey: "", required: false });
  });
});

test("verifyTurnstileToken skips when disabled in dev", async () => {
  const prevNode = process.env.NODE_ENV;
  const prevVercel = process.env.VERCEL;
  delete process.env.VERCEL;
  process.env.NODE_ENV = "development";
  await withoutTurnstileEnv(async () => {
    const result = await verifyTurnstileToken("");
    assert.equal(result.ok, true);
  });
  if (prevNode === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNode;
  if (prevVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = prevVercel;
});

test("verifyTurnstileToken rejects in production without keys", async () => {
  const prevNode = process.env.NODE_ENV;
  const prevVercel = process.env.VERCEL;
  delete process.env.VERCEL;
  process.env.NODE_ENV = "production";
  await withoutTurnstileEnv(async () => {
    assert.equal(isTurnstileRequired(), true);
    const result = await verifyTurnstileToken("");
    assert.equal(result.ok, false);
    assert.match(result.error, /nincs beállítva/);
  });
  if (prevNode === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNode;
  if (prevVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = prevVercel;
});

test("verifyTurnstileToken rejects empty token when enabled", async () => {
  const prevSite = process.env.TURNSTILE_SITE_KEY;
  const prevSecret = process.env.TURNSTILE_SECRET_KEY;
  process.env.TURNSTILE_SITE_KEY = "site";
  process.env.TURNSTILE_SECRET_KEY = "secret";
  try {
    const result = await verifyTurnstileToken("");
    assert.equal(result.ok, false);
    assert.match(result.error, /Biztonsági ellenőrzés/);
  } finally {
    if (prevSite === undefined) delete process.env.TURNSTILE_SITE_KEY;
    else process.env.TURNSTILE_SITE_KEY = prevSite;
    if (prevSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = prevSecret;
  }
});
