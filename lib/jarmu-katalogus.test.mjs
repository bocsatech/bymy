import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCatalogCsv, getTypes, loadJarmuKatalogus } from "./jarmu-katalogus.mjs";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

test("parseCatalogCsv — Gyartmany/Modell/Tipus fa", () => {
  const csv = [
    "Gyartmany,Modell,Tipus",
    "AUDI,A6,A6 1.8",
    'AUDI,A6,"A6 2.0, Automata"',
    "AUDI,A4,A4 1.9 TDI",
    "BMW,3,320d",
  ].join("\n");

  const { brands, tree, rowCount } = parseCatalogCsv(csv);
  assert.deepEqual(brands, ["AUDI", "BMW"]);
  assert.equal(rowCount, 4);
  assert.deepEqual(tree.AUDI.A6, ["A6 1.8", "A6 2.0, Automata"]);
  assert.deepEqual(tree.AUDI.A4, ["A4 1.9 TDI"]);
  assert.deepEqual(tree.BMW["3"], ["320d"]);
});

test("loadJarmuKatalogus — csv + append merge", () => {
  const root = join(tmpdir(), `katalogus-test-${Date.now()}`);
  const dir = join(root, "Letöltések", "mentesmarka");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "jarmu-katalogus.csv"),
    "Gyartmany,Modell,Tipus\nALFA ROMEO,GIULIETTA,\n",
    "utf8"
  );
  writeFileSync(
    join(dir, "jarmu-katalogus.append.csv"),
    "Gyartmany,Modell,Tipus\nALFA ROMEO,GIULIETTA,1.4 TB\nALFA ROMEO,GIULIETTA,1.6 JTDM\n",
    "utf8"
  );

  const prevHome = process.env.HOME;
  process.env.HOME = root;
  try {
    const catalog = loadJarmuKatalogus({ force: true });
    assert.equal(catalog.ok, true);
    assert.ok(catalog.tree["ALFA ROMEO"]?.GIULIETTA?.includes("1.4 TB"));
    assert.deepEqual(getTypes("ALFA ROMEO", "GIULIETTA").sort(), ["1.4 TB", "1.6 JTDM"]);
  } finally {
    process.env.HOME = prevHome;
    rmSync(root, { recursive: true, force: true });
  }
});
