import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

async function makeImportUser(accountType = "dealer") {
  const { registerUser, activateUserByToken } = await import(`./web-users.mjs?t=${Date.now()}-${Math.random()}`);
  const email = `dealer-photo-${Date.now()}-${Math.random().toString(16).slice(2)}@local.dev`;
  const reg = await registerUser(email, "titok1titok12", "titok1titok12", accountType);
  const activated = await activateUserByToken(reg.activationToken);
  return activated.user.id;
}

test("dealer photo import: frissítés törli a régi mezőket, képet ment", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bymy-dealer-photo-"));
  process.env.DB_BACKEND = "sqlite";
  process.env.AUTOSWEB_DB_PATH = join(dir, "test.db");
  process.env.AUTOSWEB_UPLOADS_PATH = join(dir, "listings");

  const { saveListing, getListing } = await import(`./db-store.mjs?t=${Date.now()}-a`);
  const userId = await makeImportUser("dealer");

  const first = await saveListing(
    {
      hirdetes_vertical: "auto",
      gyartmany: "MERCEDES-BENZ",
      modell: "E",
      km: "358200",
      vetelar: "3999990",
      karpit1: "Szürke",
      hasznaltauto_hirdetes_id: "23113337",
      forras_url: "https://www.hasznaltauto.hu/szemelyauto/import-23113337",
      hirdetes_cime: "Eladó MERCEDES-BENZ E (2013)",
    },
    null,
    { status: "feladott", userId }
  );
  assert.ok(first?.id);
  assert.equal(first.form.karpit1, "Szürke");

  const tinyJpeg =
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z";

  const { saveDealerPhotoImportPages } = await import(`./ha-dealer-photo-import.mjs?t=${Date.now()}-b`);
  const result = await saveDealerPhotoImportPages({
    userId,
    pages: [
      {
        listingId: "23113337",
        url: "https://admin.hasznaltauto.hu/hirdetesfeladas/szemelyauto?id=23113337",
        imageJpegBase64: tinyJpeg,
        photoOnly: true,
      },
    ],
  });

  assert.equal(result.savedCount, 1);
  assert.equal(result.items[0].updated, true);
  assert.equal(result.items[0].savedId, first.id);

  const again = await getListing(first.id);
  assert.equal(again.form.hasznaltauto_hirdetes_id, "23113337");
  assert.equal(again.form.karpit1 || "", "");
  assert.equal(again.form.km || "", "");
  assert.equal(again.form.vetelar || "", "");
  assert.equal(again.form.gyartmany || "", "");
  assert.equal(again.form.modell || "", "");
  assert.ok(again.fo_kep || again.form?.fo_kep || again.form?.fotok);
  const fotok = String(again.form?.fotok || "").trim().split(/\n+/).filter(Boolean);
  assert.equal(fotok.length, 1);

  rmSync(dir, { recursive: true, force: true });
});
