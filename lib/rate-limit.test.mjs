import test from "node:test";
import assert from "node:assert/strict";
import { clientIp } from "./rate-limit.mjs";

test("clientIp prefers CF-Connecting-IP over X-Forwarded-For", () => {
  const req = {
    headers: {
      "cf-connecting-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.1, 10.0.0.1",
      "x-real-ip": "198.51.100.99",
    },
    socket: { remoteAddress: "127.0.0.1" },
  };
  assert.equal(clientIp(req), "203.0.113.10");
});

test("clientIp falls back to X-Real-IP then first X-Forwarded-For hop", () => {
  assert.equal(
    clientIp({
      headers: { "x-real-ip": "198.51.100.2", "x-forwarded-for": "10.0.0.5, 10.0.0.6" },
      socket: { remoteAddress: "127.0.0.1" },
    }),
    "198.51.100.2"
  );
  assert.equal(
    clientIp({
      headers: { "x-forwarded-for": "10.0.0.5, 10.0.0.6" },
      socket: { remoteAddress: "127.0.0.1" },
    }),
    "10.0.0.5"
  );
});

test("clientIp uses socket remoteAddress as last resort", () => {
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: "::1" } }), "::1");
});
