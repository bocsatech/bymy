import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("listing-image: tartós útvonal + resolve", async () => {
  const dir = mkdtempSync(join(tmpdir(), "autosweb-up-"));
  process.env.AUTOSWEB_UPLOADS_PATH = join(dir, "listings");
  const mod = await import(`./listing-image.mjs?t=${Date.now()}`);
  assert.equal(mod.listingImagePublicPath("123.jpg"), "/uploads/listings/123.jpg");
  const uploadDir = mod.listingImageDir();
  assert.ok(existsSync(uploadDir));
  writeFileSync(join(uploadDir, "abc.jpg"), Buffer.alloc(600, 1));
  assert.equal(mod.resolveListingImageFile("/uploads/listings/abc.jpg"), join(uploadDir, "abc.jpg"));
  assert.equal(mod.displayImageUrl("/uploads/listings/abc.jpg"), "/uploads/listings/abc.jpg");
  assert.equal(mod.displayImageUrl("/uploads/listings/hianyzik.jpg"), "");
  assert.equal(mod.resolveListingImageFile("/uploads/listings/../secret"), null);
  assert.equal(mod.isListingImageMissing("/uploads/listings/abc.jpg"), false);
  assert.equal(mod.isListingImageMissing("/uploads/listings/hianyzik.jpg"), true);
  assert.equal(mod.isListingImageMissing(""), true);
  rmSync(dir, { recursive: true, force: true });
  delete process.env.AUTOSWEB_UPLOADS_PATH;
});

test("isListingImageMissing / displayImageUrl: https → proxy", async () => {
  const dir = mkdtempSync(join(tmpdir(), "autosweb-up2-"));
  process.env.AUTOSWEB_UPLOADS_PATH = join(dir, "listings");
  const mod = await import(`./listing-image.mjs?t=${Date.now() + 9}`);
  const remote = "https://www.hasznaltauto.hu/kepek/auto.jpg";
  assert.equal(mod.isListingImageMissing(remote), false);
  assert.match(mod.displayImageUrl(remote), /^\/api\/media\/proxy\?url=/);
  assert.equal(mod.isAllowedRemoteImageUrl("https://evil.example/x.jpg"), false);
  assert.equal(mod.displayImageUrl("https://evil.example/x.jpg"), "");
  assert.equal(mod.isListingImageMissing(""), true);
  rmSync(dir, { recursive: true, force: true });
  delete process.env.AUTOSWEB_UPLOADS_PATH;
});

test("listing-image forrás: ~/.autosweb", () => {
  const src = readFileSync(join(__dirname, "listing-image.mjs"), "utf8");
  assert.match(src, /\.autosweb/);
  assert.match(src, /AUTOSWEB_UPLOADS_PATH/);
  assert.match(src, /resolveListingImageFile/);
  assert.match(src, /displayImageUrl/);
  assert.match(src, /fetchRemoteListingImage/);
  assert.match(src, /isServerlessRuntime/);
  assert.match(src, /VERCEL/);
});

test("listingImageDir Vercel alatt nem a home mappába ír", async () => {
  const prevVercel = process.env.VERCEL;
  const prevUploads = process.env.AUTOSWEB_UPLOADS_PATH;
  process.env.VERCEL = "1";
  delete process.env.AUTOSWEB_UPLOADS_PATH;
  const mod = await import(`./listing-image.mjs?t=${Date.now() + 21}`);
  const dir = mod.listingImageDir();
  assert.match(dir, /autosweb-uploads\/listings/);
  assert.equal(dir.includes(".autosweb"), false);
  if (prevVercel == null) delete process.env.VERCEL;
  else process.env.VERCEL = prevVercel;
  if (prevUploads == null) delete process.env.AUTOSWEB_UPLOADS_PATH;
  else process.env.AUTOSWEB_UPLOADS_PATH = prevUploads;
});

test("import-listings: alap limit 20, max 80", () => {
  const src = readFileSync(join(__dirname, "import-listings.mjs"), "utf8");
  assert.match(src, /DEFAULT_IMPORT_LIMIT = 20/);
  assert.match(src, /MAX_IMPORT_LIMIT = 80/);
});
