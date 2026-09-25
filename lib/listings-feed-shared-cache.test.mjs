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
  mod.writeSharedFeedCache("count|feladott|auto", 42);
  assert.equal(mod.readSharedFeedCache("count|feladott|auto", 60_000), 42);
  mod.writeSharedFeedCache("nav|feladott", { auto: 1, teher: 2, ingatlan: 3 });
  assert.deepEqual(mod.readSharedFeedCache("nav|feladott", 60_000), {
    auto: 1,
    teher: 2,
    ingatlan: 3,
  });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(mod.readSharedFeedCache(key, 2), null);
  mod.clearSharedFeedCache();
  assert.equal(mod.readSharedFeedCache(key, 60_000), null);
  rmSync(dir, { recursive: true, force: true });
  delete process.env.LISTINGS_FEED_CACHE_DIR;
});
