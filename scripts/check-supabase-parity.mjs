#!/usr/bin/env node
/** Helyi Supabase vs bymy.hu — ugyanaz az adat? */
import { loadEnvFiles } from "../lib/load-env.mjs";
import { getSupabase, supabaseBackendLabel } from "../lib/supabase/client.mjs";

loadEnvFiles();

const LIVE = "https://bymy.hu";

async function liveFirstListingId() {
  const res = await fetch(`${LIVE}/api/listings?limit=1`);
  if (!res.ok) throw new Error(`bymy.hu API ${res.status}`);
  const json = await res.json();
  return json.listings?.[0]?.id ?? null;
}

async function liveHasListing(id) {
  const res = await fetch(`${LIVE}/api/listings/${id}`);
  return res.ok;
}

const sb = getSupabase();
const host = supabaseBackendLabel();
const { count, error } = await sb.from("listings").select("*", { count: "exact", head: true });
if (error) {
  console.error("Helyi Supabase hiba:", error.message);
  process.exit(1);
}

const liveId = await liveFirstListingId();
const { data: localRow } = liveId
  ? await sb.from("listings").select("id,hirdetes_cime").eq("id", liveId).maybeSingle()
  : { data: null };

console.log("Helyi Supabase:", host);
console.log("Helyi hirdetésszám:", count ?? "?");
console.log("bymy.hu első id:", liveId ?? "?");
console.log("bymy.hu id a helyi DB-ben:", localRow ? "IGEN ✓" : "NEM ✗");

if (!localRow && liveId) {
  const ok471 = await liveHasListing(471);
  const { data: local471 } = await sb.from("listings").select("id").eq("id", 471).maybeSingle();
  if (local471 && !ok471) {
    console.log("");
    console.log("→ A .env.local felhős Supabase projektet használ (pl. kinyhx…), nem az S1 élesét.");
    console.log("→ Futtasd: mac/s1-pull-supabase-env.command");
  }
  process.exit(1);
}

console.log("OK — ugyanaz az adatbázis.");
