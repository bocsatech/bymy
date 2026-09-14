import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";

const gyorsFixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures/ha-admin-gyorsnezet-full.html"),
  "utf8"
);

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

  const { saveDealerPhotoImportPages } = await import(`./ha-dealer-photo-import.mjs?t=${Date.now()}-b`);
  const result = await saveDealerPhotoImportPages({
    userId,
    pages: [
      {
        listingId: "23113337",
        url: "https://admin.hasznaltauto.hu/hirdetesfeladas/szemelyauto?id=23113337",
        visibleImage: "https://img.hasznaltautocdn.com/118x88/23113337/26375069.jpg",
        visibleTitle: "MERCEDES-BENZ E 250 CDI 4Matic Classic (Automata)",
        visibleDescription:
          "Ford Mondeo 1.5 dízel 120Le 6 sebességes manuális váltó, ajándék 4 db téligumi, Nagyon szép állapot, parkolóradar elől-hátul.",
        imageJpegBase64: "ignored-tiny-or-large",
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
  assert.equal(again.form.gyartmany, "MERCEDES-BENZ");
  assert.equal(again.form.modell, "E");
  assert.match(again.form.tipus || "", /250 CDI 4Matic Classic/i);
  assert.match(again.form.leiras || "", /parkolóradar/i);
  const fo = String(again.fo_kep || again.form?.fo_kep || "");
  assert.equal(fo, "https://img.hasznaltautocdn.com/2048x1536/23113337/26375069.jpg");
  const fotok = String(again.form?.fotok || "").trim().split(/\n+/).filter(Boolean);
  assert.ok(fotok.length <= 1);

  rmSync(dir, { recursive: true, force: true });
});

test("dealer photo import: gyorsnézet HTML → műszaki mezők + extrák", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bymy-dealer-gyors-"));
  process.env.DB_BACKEND = "sqlite";
  process.env.AUTOSWEB_DB_PATH = join(dir, "test.db");
  process.env.AUTOSWEB_UPLOADS_PATH = join(dir, "listings");

  const userId = await makeImportUser("dealer");
  const { getListing } = await import(`./db-store.mjs?t=${Date.now()}-gy`);
  const { saveDealerPhotoImportPages } = await import(`./ha-dealer-photo-import.mjs?t=${Date.now()}-gz`);

  const result = await saveDealerPhotoImportPages({
    userId,
    pages: [
      {
        listingId: "24112233",
        visibleTitle: "TOYOTA RAV4 2.5 Hybrid",
        gyartmany: "TOYOTA",
        modell: "RAV4",
        visibleImage: "https://img.hasznaltautocdn.com/118x88/24112233/29990001.jpg",
        html: gyorsFixture,
        photoOnly: true,
      },
    ],
  });

  assert.equal(result.savedCount, 1);
  const saved = await getListing(result.items[0].savedId);
  assert.equal(saved.form.vetelar, "8599000");
  assert.equal(saved.form.km, "94000");
  assert.equal(saved.form.gyartasi_ev, "2018");
  assert.equal(saved.form.gyartmany, "TOYOTA");
  assert.equal(saved.form.allapot, "Kitűnő");
  assert.equal(saved.form.kivitel, "Városi terepjáró (crossover)");
  assert.equal(saved.form.okmany_jelleg, "Magyar okmányokkal");
  assert.ok((saved.form.felszereltseg || []).includes("tempomat"));

  rmSync(dir, { recursive: true, force: true });
});
