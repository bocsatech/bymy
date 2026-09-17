#!/usr/bin/env node
/** Meglévő hirdetések település/cím kitöltése a tulajdonos profiljából (közeli autók sáv). */

import { listListings, getListing, saveListing } from "../lib/db-store.mjs";

function blank(value) {
  return !String(value ?? "").trim();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limit = Math.min(Math.max(Number(process.argv.find((a) => /^\d+$/.test(a)) || 500), 1), 2000);
  const items = await listListings({ limit, status: "feladott" });
  let touched = 0;
  let skipped = 0;

  for (const item of items) {
    const full = await getListing(item.id);
    if (!full?.form) {
      skipped += 1;
      continue;
    }
    if (!blank(full.form.telepules)) {
      skipped += 1;
      continue;
    }
    const ownerId = Number(full.user_id ?? full.form.owner_user_id);
    if (!Number.isFinite(ownerId) || ownerId <= 0) {
      skipped += 1;
      console.log(`#${item.id}: nincs tulajdonos, kihagyva`);
      continue;
    }
    if (dryRun) {
      console.log(`#${item.id}: frissítené (tulaj: ${ownerId})`);
      touched += 1;
      continue;
    }
    await saveListing(full.form, item.id, { status: full.status || "feladott", userId: ownerId });
    const after = await getListing(item.id);
    console.log(
      `#${item.id}: ${after?.form?.telepules || "—"} ${after?.form?.iranyitoszam || ""}`.trim()
    );
    touched += 1;
  }

  console.log(`Kész: ${touched} frissítve, ${skipped} kihagyva (${items.length} hirdetésből).`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
