import test from "node:test";
import assert from "node:assert/strict";
import { safeInternalPath } from "./safe-path.mjs";

test("safeInternalPath: belső útvonal OK", () => {
  assert.equal(safeInternalPath("/hirdetesfeladas.html"), "/hirdetesfeladas.html");
  assert.equal(safeInternalPath("/auto.html?cat=1"), "/auto.html?cat=1");
});

test("safeInternalPath: open redirect tiltva", () => {
  assert.equal(safeInternalPath("//evil.example"), "/");
  assert.equal(safeInternalPath("//evil.example/phish"), "/");
  assert.equal(safeInternalPath("https://evil.example/"), "/");
  assert.equal(safeInternalPath("\\\\evil"), "/");
  assert.equal(safeInternalPath("/\\evil"), "/");
});
