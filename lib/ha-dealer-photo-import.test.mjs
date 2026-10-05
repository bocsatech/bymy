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

test("dealer photo import: thin + kép → skip (ne hozzon létre vékony hirdetést)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bymy-dealer-photo-"));
  process.env.DB_BACKEND = "sqlite";
  process.env.AUTOSWEB_DB_PATH = join(dir, "test.db");
  process.env.AUTOSWEB_UPLOADS_PATH = join(dir, "listings");

  const { listMyListings } = await import(`./db-store.mjs?t=${Date.now()}-a`);
  const userId = await makeImportUser("dealer");

  const { saveDealerPhotoImportPages } = await import(`./ha-dealer-photo-import.mjs?t=${Date.now()}-b`);
  const result = await saveDealerPhotoImportPages({
    userId,
    pages: [
      {
        listingId: "29998877",
        url: "https://admin.hasznaltauto.hu/hirdetesfeladas/szemelyauto?id=29998877",
        visibleImage: "https://img.hasznaltautocdn.com/118x88/29998877/26375069.jpg",
        visibleTitle: "MERCEDES-BENZ E 250 CDI 4Matic Classic (Automata)",
        visibleDescription:
          "Ford Mondeo 1.5 dízel 120Le 6 sebességes manuális váltó, ajándék 4 db téligumi, Nagyon szép állapot, parkolóradar elől-hátul.",
        vetelar: "3999990",
        photoOnly: true,
      },
    ],
  });

  assert.equal(result.savedCount, 0);
  assert.ok(result.skippedCount >= 1);
  assert.match(result.errors?.[0]?.message || "", /gyorsnézet/i);
  const mine = await listMyListings({ userId, limit: 20 });
  assert.equal((mine || []).length, 0);

  rmSync(dir, { recursive: true, force: true });
});

test("dealer photo import: gyorsnézet HTML → műszaki mezők + extrák + fo_kep", async () => {
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
  const fo = String(saved.fo_kep || saved.form?.fo_kep || "");
  assert.equal(fo, "https://img.hasznaltautocdn.com/2048x1536/24112233/29990001.jpg");

  rmSync(dir, { recursive: true, force: true });
});

test("dealer photo import: üres leírás + km + extrák + fo_kep = mentés", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bymy-dealer-noleiras-"));
  process.env.DB_BACKEND = "sqlite";
  process.env.AUTOSWEB_DB_PATH = join(dir, "test.db");
  process.env.AUTOSWEB_UPLOADS_PATH = join(dir, "listings");

  const userId = await makeImportUser("dealer");
  const { getListing } = await import(`./db-store.mjs?t=${Date.now()}-nl`);
  const { saveDealerPhotoImportPages } = await import(`./ha-dealer-photo-import.mjs?t=${Date.now()}-nl2`);

  const result = await saveDealerPhotoImportPages({
    userId,
    pages: [
      {
        listingId: "23577532",
        visibleTitle: "MERCEDES-BENZ E 300 de 4Matic",
        visibleImage: "https://img.hasznaltautocdn.com/2048x1536/23577532/31934615.jpg",
        leiras: "",
        map: {
          "Km. óra állás": "247700 km",
          Vételár: "9499990 Ft",
          "Gyártási év": "2020",
          Üzemanyag: "Hibrid (Dízel)",
          Hengerűrtartalom: "1950 cm³",
          "Okmányok jellege": "Érvényes magyar okmányokkal",
          Teljesítmény: "143 kW",
        },
        felszereltseg: [
          "ABS (blokkolásgátló)",
          "ESP (menetstabilizátor)",
          "tempomat",
          "Apple CarPlay",
          "360 fokos kamerarendszer",
        ],
        photoOnly: true,
      },
    ],
  });

  assert.equal(result.savedCount, 1, JSON.stringify(result.errors || []));
  const saved = await getListing(result.items[0].savedId);
  assert.equal(saved.form.km, "247700");
  assert.equal(String(saved.form.leiras || "").trim(), "");
  assert.ok((saved.form.felszereltseg || []).length >= 5);
  assert.equal(
    String(saved.fo_kep || saved.form?.fo_kep || ""),
    "https://img.hasznaltautocdn.com/2048x1536/23577532/31934615.jpg"
  );

  rmSync(dir, { recursive: true, force: true });
});
