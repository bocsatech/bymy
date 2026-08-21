import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

test("getSiteBlocks és saveSiteBlocks oldalanként 3 videóval", async () => {
  const dir = mkdtempSync(join(tmpdir(), "autosweb-blocks-"));
  process.env.AUTOSWEB_BLOCKS_PATH = join(dir, "site-blocks.json");
  process.env.DB_BACKEND = "sqlite";

  const { getSiteBlocks, saveSiteBlocks, VIDEOS_PER_SIDE } = await import(`./site-blocks.mjs?t=${Date.now()}`);

  const initial = await getSiteBlocks();
  assert.ok(initial.pages.home.left.videos.length === VIDEOS_PER_SIDE);
  assert.ok(initial.pages.home.center?.html);

  const saved = await saveSiteBlocks({
    page: "home",
    left: {
      title: "Bal videók",
      videos: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "", ""],
    },
    right: { title: "Jobb videók", videos: ["", "", ""] },
  });
  assert.equal(saved.pages.home.left.videos[0], "https://www.youtube.com/watch?v=dQw4w9WgXcQ");

  const page = await getSiteBlocks("import");
  assert.equal(page.page, "import");
  assert.equal(page.left.videos.length, VIDEOS_PER_SIDE);

  const auto = await saveSiteBlocks({
    page: "auto",
    left: { title: "Autó bal", videos: ["https://youtu.be/abcdefghijk", "", ""] },
    right: { title: "Autó jobb", videos: ["", "", ""] },
  });
  assert.equal(auto.pages.auto.left.title, "Autó bal");

  delete process.env.AUTOSWEB_BLOCKS_PATH;
  delete process.env.DB_BACKEND;
  rmSync(dir, { recursive: true, force: true });
});
