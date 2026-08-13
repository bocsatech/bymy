import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

test("getSiteBlocks és saveSiteBlocks oldalanként 3 videóval", async () => {
  const dir = mkdtempSync(join(tmpdir(), "autosweb-blocks-"));
  process.env.AUTOSWEB_BLOCKS_PATH = join(dir, "site-blocks.json");

  const { getSiteBlocks, saveSiteBlocks, VIDEOS_PER_SIDE } = await import(`./site-blocks.mjs?t=${Date.now()}`);

  const initial = getSiteBlocks();
  assert.ok(initial.pages.home.left.videos.length === VIDEOS_PER_SIDE);
  assert.ok(initial.pages.home.center?.html);

  const saved = saveSiteBlocks({
    page: "home",
    left: {
      title: "Bal videók",
      videos: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "", ""],
    },
    right: { title: "Jobb videók", videos: ["", "", ""] },
  });
  assert.equal(saved.pages.home.left.videos[0], "https://www.youtube.com/watch?v=dQw4w9WgXcQ");

  const page = getSiteBlocks("import");
  assert.equal(page.page, "import");
  assert.equal(page.left.videos.length, VIDEOS_PER_SIDE);

  delete process.env.AUTOSWEB_BLOCKS_PATH;
  rmSync(dir, { recursive: true, force: true });
});
