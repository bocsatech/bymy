import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

test("shared feed cache: write / read / expire / clear", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bymy-feed-cache-"));
  process.env.LISTINGS_FEED_CACHE_DIR = dir;
  const mod = await import(`./listings-feed-shared-cache.mjs?t=${Date.now()}`);
  const key = "feladott|auto|50";
  assert.equal(mod.readSharedFeedCache(key, 60_000), null);
  mod.writeSharedFeedCache(key, [{ id: 1 }, { id: 2 }]);
  const hit = mod.readSharedFeedCache(key, 60_000);
  assert.deepEqual(hit, [{ id: 1 }, { id: 2 }]);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(mod.readSharedFeedCache(key, 2), null);
  mod.clearSharedFeedCache();
  assert.equal(mod.readSharedFeedCache(key, 60_000), null);
  rmSync(dir, { recursive: true, force: true });
  delete process.env.LISTINGS_FEED_CACHE_DIR;
});
