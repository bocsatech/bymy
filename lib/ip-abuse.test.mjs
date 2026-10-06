import test from "node:test";
import assert from "node:assert/strict";
import { resetIpAbuseForTests, shouldAutoBlock, isScriptUserAgent, abuseNotifyPayload } from "./ip-abuse.mjs";

test("k6-like User-Agent is treated as script", () => {
  assert.equal(isScriptUserAgent("k6/0.54.0 (https://k6.io/)"), true);
  assert.equal(isScriptUserAgent("BymyLoadTest/detect-20261006"), true);
  assert.equal(isScriptUserAgent("Mozilla/5.0 (Macintosh) Safari/605.1.15"), false);
});

test("script UA auto-blocks immediately", () => {
  resetIpAbuseForTests();
  const hit = shouldAutoBlock({ ip: "203.0.113.9", userAgent: "k6/1.0.0" });
  assert.equal(hit?.reason, "script-ua");
});

test("localhost is never auto-blocked", () => {
  resetIpAbuseForTests();
  assert.equal(shouldAutoBlock({ ip: "127.0.0.1", userAgent: "k6/1.0" }), null);
});

test("allowlisted IP skips script UA", () => {
  resetIpAbuseForTests();
  process.env.BYMY_ABUSE_ALLOW_IPS = "198.51.100.10";
  assert.equal(shouldAutoBlock({ ip: "198.51.100.10", userAgent: "k6/1.0" }), null);
  delete process.env.BYMY_ABUSE_ALLOW_IPS;
});

test("rapid hits trip rate auto-block", () => {
  resetIpAbuseForTests();
  let last = null;
  const t0 = 1_000_000;
  for (let i = 0; i < 50; i += 1) {
    last = shouldAutoBlock({
      ip: "203.0.113.50",
      userAgent: "Mozilla/5.0 Safari",
      now: t0 + i,
    });
  }
  assert.equal(last?.reason, "rate");
});

test("slow human traffic does not trip rate auto-block", () => {
  resetIpAbuseForTests();
  const t0 = 2_000_000;
  for (let i = 0; i < 20; i += 1) {
    const hit = shouldAutoBlock({
      ip: "203.0.113.51",
      userAgent: "Mozilla/5.0 Safari",
      now: t0 + i * 1000,
    });
    assert.equal(hit, null);
  }
});

test("abuse notify mail uses SMTP_USER when dedicated env is empty", () => {
  const prev = process.env.SMTP_USER;
  const prevNotify = process.env.BYMY_ABUSE_NOTIFY_EMAIL;
  const prevFrom = process.env.SMTP_FROM;
  delete process.env.BYMY_ABUSE_NOTIFY_EMAIL;
  delete process.env.SMTP_FROM;
  process.env.SMTP_USER = "ops@bymy.hu";
  const mail = abuseNotifyPayload({
    ip: "203.0.113.9",
    reason: "script-ua",
    userAgent: "k6/1.0",
    path: "/api/health",
    at: new Date("2026-10-06T10:00:00.000Z"),
  });
  assert.equal(mail.to, "ops@bymy.hu");
  assert.match(mail.subject, /203\.0\.113\.9/);
  assert.match(mail.text, /k6/);
  assert.match(mail.text, /2026-10-06T10:00:00.000Z/);
  process.env.SMTP_USER = prev;
  if (prevNotify == null) delete process.env.BYMY_ABUSE_NOTIFY_EMAIL;
  else process.env.BYMY_ABUSE_NOTIFY_EMAIL = prevNotify;
  if (prevFrom == null) delete process.env.SMTP_FROM;
  else process.env.SMTP_FROM = prevFrom;
});
