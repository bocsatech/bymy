import test from "node:test";
import assert from "node:assert/strict";
import { parseUserAgent, parseClientHints } from "../lib/site-visitors.mjs";

test("parseUserAgent: iPhone = telefon", () => {
  const ua =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
  const p = parseUserAgent(ua);
  assert.equal(p.deviceType, "telefon");
  assert.equal(p.deviceName, "iPhone");
  assert.match(p.browser, /Safari/);
  assert.match(p.os, /iOS/);
});

test("parseUserAgent: desktop Chrome = asztali", () => {
  const ua =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const p = parseUserAgent(ua);
  assert.equal(p.deviceType, "asztali");
  assert.match(p.browser, /Chrome/);
  assert.equal(p.os, "Windows");
});

test("parseClientHints merges path and screen", () => {
  const h = parseClientHints(
    { path: "/auto.html", screenWidth: 390, screenHeight: 844, language: "hu-HU" },
    { headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Version/16.0 Mobile/15E148 Safari/604.1" } }
  );
  assert.equal(h.path, "/auto.html");
  assert.equal(h.screen, "390×844");
  assert.equal(h.language, "hu-HU");
  assert.equal(h.deviceType, "telefon");
});
