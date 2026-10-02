#!/usr/bin/env node
/**
 * HA ár-letöltés — szabályok a docs/ha-ar-letoltes-gyartmanyok.txt-ből.
 *
 * Most: beolvassa a txt-t, kiírja a tervet (melyik márka, alap/részletes).
 * A tényleges lista/detail letöltés a kitöltött szabályok után jön.
 *
 *   node scripts/ha-price-download.mjs
 *   node scripts/ha-price-download.mjs --path docs/ha-ar-letoltes-gyartmanyok.txt
 */
import { loadHaPriceRules, summarizeHaPriceRules } from "../lib/ha-price-rules.mjs";

const args = process.argv.slice(2);
let pathArg = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--path" && args[i + 1]) {
    pathArg = args[++i];
  }
}

const { path, rules } = loadHaPriceRules(pathArg || undefined);
const sum = summarizeHaPriceRules(rules);

console.log(`Szabályfájl: ${path}`);
console.log(`Gyártmányok: ${sum.total}`);
console.log(`  letöltendő: ${sum.download}`);
console.log(`  kihagyva:   ${sum.skip}`);
console.log(`  később:     ${sum.later}`);
console.log(`  üres:       ${sum.undecided}`);

if (!sum.download) {
  console.log("\nNincs kitöltött „letolt:igen” sor. Töltsd ki a txt-t, aztán futtasd újra.");
  process.exit(0);
}

console.log("\nLetöltési terv (prioritás szerint):");
for (const r of sum.ready) {
  const alap = r.alap === false ? "alap:nem" : "alap:igen";
  let reszletes = "reszletes:?";
  if (r.reszletes === "nem") reszletes = "reszletes:nem";
  else if (r.reszletes === "igen") reszletes = "reszletes:igen";
  else if (r.reszletes === "ev") reszletes = `reszletes:ev:${r.reszletesFromYear}`;
  else if (r.reszletes === "datum") reszletes = `reszletes:datum:${r.reszletesDays}`;
  const prio = r.prioritas != null ? `P${r.prioritas}` : "P?";
  const note = r.megjegyzes ? ` — ${r.megjegyzes}` : "";
  console.log(`  [${prio}] ${r.gyartmany} · ${alap} · ${reszletes}${note}`);
}

console.log("\n(A tényleges HA lista/detail letöltő a szabályok után kapcsolódik ide.)");
