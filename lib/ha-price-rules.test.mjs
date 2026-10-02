import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { loadHaPriceRules, summarizeHaPriceRules } from "./ha-price-rules.mjs";

test("loadHaPriceRules: parse igen / datum / prioritas", () => {
  const path = join(tmpdir(), `ha-rules-${Date.now()}.txt`);
  writeFileSync(
    path,
    `# comment
BMW | letolt:igen | alap:igen | reszletes:ev:2014 | prioritas:1 | megjegyzes:teszt
DACIA | letolt:igen | alap:igen | reszletes:nem | prioritas:3 | megjegyzes:csak alap
FERRARI | letolt: | alap: | reszletes: | prioritas: | megjegyzes:
`,
    "utf8"
  );
  try {
    const { rules } = loadHaPriceRules(path);
    assert.equal(rules.length, 3);
    assert.equal(rules[0].gyartmany, "BMW");
    assert.equal(rules[0].letolt, true);
    assert.equal(rules[0].reszletes, "ev");
    assert.equal(rules[0].reszletesFromYear, 2014);
    assert.equal(rules[1].reszletes, "nem");
    assert.equal(rules[2].letolt, null);
    const sum = summarizeHaPriceRules(rules);
    assert.equal(sum.download, 2);
    assert.equal(sum.undecided, 1);
  } finally {
    unlinkSync(path);
  }
});
