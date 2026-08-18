import { nextLockState, LEVEL1_MAX_FAILED } from "./level1.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

test("level1: 3. hiba után zárol", () => {
  assert.deepEqual(nextLockState(0), { failedAttempts: 1, locked: false });
  assert.deepEqual(nextLockState(1), { failedAttempts: 2, locked: false });
  assert.deepEqual(nextLockState(2), { failedAttempts: 3, locked: true });
  assert.equal(LEVEL1_MAX_FAILED, 3);
});
