import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedQrTarget, resolveQrTargetUrl, qrPngBuffer } from "./qr.mjs";

test("isAllowedQrTarget: relatív path ok", () => {
  assert.equal(isAllowedQrTarget("/hirdetes.html?id=59&src=qr"), true);
  assert.equal(isAllowedQrTarget("//evil.com"), false);
});

test("isAllowedQrTarget: bymy host ok", () => {
  assert.equal(isAllowedQrTarget("https://bymy.hu/hirdetes.html?id=1"), true);
  assert.equal(isAllowedQrTarget("https://bymy.vercel.app/auto.html?hirdeto=1"), true);
  assert.equal(isAllowedQrTarget("https://evil.example/x"), false);
});

test("resolveQrTargetUrl: relatív + origin", () => {
  assert.equal(
    resolveQrTargetUrl("/hirdetes.html?id=1", { origin: "https://bymy.hu" }),
    "https://bymy.hu/hirdetes.html?id=1"
  );
});

test("qrPngBuffer: PNG header", async () => {
  const buf = await qrPngBuffer("https://bymy.hu/hirdetes.html?id=1&src=qr", { size: 120 });
  assert.ok(Buffer.isBuffer(buf));
  assert.equal(buf[0], 0x89);
  assert.equal(buf[1], 0x50);
});
