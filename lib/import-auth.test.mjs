import test from "node:test";
import assert from "node:assert/strict";
import {
  createImportToken,
  parseImportToken,
  isImportScopedToken,
  importTokenTtlMs,
} from "./import-auth.mjs";

test("import token round-trip", () => {
  const prev = process.env.OAUTH_STATE_SECRET;
  process.env.OAUTH_STATE_SECRET = "test-import-secret";
  try {
    const token = createImportToken(42);
    assert.ok(isImportScopedToken(token));
    const parsed = parseImportToken(token);
    assert.equal(parsed?.userId, 42);
    assert.ok(parsed.exp > Date.now());
  } finally {
    if (prev === undefined) delete process.env.OAUTH_STATE_SECRET;
    else process.env.OAUTH_STATE_SECRET = prev;
  }
});

test("import token rejects tamper", () => {
  const prev = process.env.OAUTH_STATE_SECRET;
  process.env.OAUTH_STATE_SECRET = "test-import-secret";
  try {
    const token = createImportToken(1);
    assert.equal(parseImportToken(token + "x"), null);
  } finally {
    if (prev === undefined) delete process.env.OAUTH_STATE_SECRET;
    else process.env.OAUTH_STATE_SECRET = prev;
  }
});

test("importTokenTtlMs default 4h", () => {
  delete process.env.BYMY_IMPORT_TOKEN_TTL_MS;
  assert.equal(importTokenTtlMs(), 4 * 60 * 60 * 1000);
});
