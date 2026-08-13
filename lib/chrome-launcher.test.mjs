import { mkdtempSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import test from "node:test";
import assert from "node:assert/strict";
import { readCdpPortFromProfile } from "./chrome-launcher.mjs";

test("readCdpPortFromProfile DevToolsActivePort fájlból", () => {
  const dir = mkdtempSync(join(tmpdir(), "autosweb-chrome-"));
  writeFileSync(join(dir, "DevToolsActivePort"), "9222\n/dev/shm/test\n", "utf8");
  assert.equal(readCdpPortFromProfile(dir), 9222);
});

test("readCdpPortFromProfile hiányzó fájl", () => {
  const dir = mkdtempSync(join(tmpdir(), "autosweb-chrome-"));
  assert.equal(readCdpPortFromProfile(dir), null);
});
