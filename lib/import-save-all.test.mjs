import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

test("import.html: összes mentése gomb", () => {
  const html = readFileSync(join(PUBLIC, "import.html"), "utf8");
  assert.match(html, /Összes mentése az adatbázisba/);
  assert.match(html, /import-save-btn/);
});

test("import.js: getImportResults / setImportResults export", () => {
  const src = readFileSync(join(PUBLIC, "js", "import.js"), "utf8");
  assert.match(src, /export function getImportResults/);
  assert.match(src, /export function setImportResults/);
  assert.match(src, /onResultsChange/);
});

test("batch mentés: új ment + duplikátum skip", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "autosweb-batch-"));
  process.env.AUTOSWEB_DB_PATH = join(tempDir, "test.db");

  const { saveListing, listingSourceExists } = await import(`./db.mjs?t=${Date.now()}`);

  const first = saveListing(
    {
      hirdetes_cime: "Eladó TESZT A",
      forras_url: "https://www.hasznaltauto.hu/szemelyauto/teszt/a-11111111",
      hasznaltauto_hirdetes_id: "11111111",
      gyartmany: "FORD",
    },
    null,
    { status: "feladott" }
  );
  assert.ok(first.id);

  assert.equal(
    listingSourceExists({
      sourceUrl: "https://www.hasznaltauto.hu/szemelyauto/teszt/a-11111111",
    }),
    true
  );
  assert.equal(
    listingSourceExists({
      sourceUrl: "https://www.hasznaltauto.hu/szemelyauto/teszt/b-22222222",
      hasznaltautoId: "22222222",
    }),
    false
  );

  const second = saveListing(
    {
      hirdetes_cime: "Eladó TESZT B",
      forras_url: "https://www.hasznaltauto.hu/szemelyauto/teszt/b-22222222",
      hasznaltauto_hirdetes_id: "22222222",
      gyartmany: "BMW",
    },
    null,
    { status: "feladott" }
  );
  assert.ok(second.id);
  assert.notEqual(second.id, first.id);

  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.AUTOSWEB_DB_PATH;
});
