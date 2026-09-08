import test from "node:test";
import assert from "node:assert/strict";
import {
  isTurnstileEnabled,
  turnstilePublicConfig,
  verifyTurnstileToken,
} from "./turnstile.mjs";

test("turnstile disabled without env keys", () => {
  const prevSite = process.env.TURNSTILE_SITE_KEY;
  const prevSecret = process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  try {
    assert.equal(isTurnstileEnabled(), false);
    assert.deepEqual(turnstilePublicConfig(), { enabled: false, siteKey: "" });
  } finally {
    if (prevSite === undefined) delete process.env.TURNSTILE_SITE_KEY;
    else process.env.TURNSTILE_SITE_KEY = prevSite;
    if (prevSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = prevSecret;
  }
});

test("verifyTurnstileToken skips when disabled", async () => {
  const prevSite = process.env.TURNSTILE_SITE_KEY;
  const prevSecret = process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  try {
    const result = await verifyTurnstileToken("");
    assert.equal(result.ok, true);
  } finally {
    if (prevSite === undefined) delete process.env.TURNSTILE_SITE_KEY;
    else process.env.TURNSTILE_SITE_KEY = prevSite;
    if (prevSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = prevSecret;
  }
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
