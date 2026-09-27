/**
 * Fill placeholder HU-center coords in lib/postal-codes-hu.json via Photon.
 * Usage: node scripts/geocode-postal-codes.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PATH = join(root, "lib/postal-codes-hu.json");
const HU = { lat: 47.1625, lon: 19.5033 };
const EPS = 1e-4;

function isDummy(lat, lon) {
  return Math.abs(Number(lat) - HU.lat) < EPS && Math.abs(Number(lon) - HU.lon) < EPS;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function photon(q) {
  const url = `https://photon.komoot.io/api/?limit=1&lang=en&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": "bymy.hu/1.0 (postal-seed)" } });
  if (!res.ok) return null;
  const data = await res.json();
  const f = data?.features?.[0];
  const coords = f?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lon = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < 45.5 || lat > 49 || lon < 16 || lon > 23) return null;
  const p = f.properties || {};
  return {
    lat,
    lon,
    megye: String(p.state || p.county || "").trim(),
    city: String(p.name || p.city || p.town || "").trim(),
  };
}

const rows = JSON.parse(readFileSync(PATH, "utf8"));
const badIdx = [];
for (let i = 0; i < rows.length; i += 1) {
  const r = rows[i];
  if (isDummy(r.lat, r.lon)) badIdx.push(i);
}
console.log(`rows=${rows.length} dummy=${badIdx.length}`);

let ok = 0;
let fail = 0;
for (let n = 0; n < badIdx.length; n += 1) {
  const i = badIdx[n];
  const r = rows[i];
  const q = `${r.postal_code} ${r.city}, Hungary`;
  let hit = null;
  for (let attempt = 0; attempt < 3 && !hit; attempt += 1) {
    try {
      hit = await photon(q);
      if (!hit) hit = await photon(`${r.city}, Hungary`);
    } catch (e) {
      console.warn("retry", r.postal_code, e.message);
      await sleep(400);
    }
  }
  if (hit) {
    rows[i] = {
      ...r,
      lat: hit.lat,
      lon: hit.lon,
      megye: r.megye || hit.megye || "",
    };
    ok += 1;
  } else {
    fail += 1;
    console.warn("FAIL", r.postal_code, r.city);
  }
  if ((n + 1) % 25 === 0 || n === badIdx.length - 1) {
    writeFileSync(PATH, JSON.stringify(rows));
    console.log(`progress ${n + 1}/${badIdx.length} ok=${ok} fail=${fail}`);
  }
  await sleep(250);
}

writeFileSync(PATH, JSON.stringify(rows));
const left = rows.filter((r) => isDummy(r.lat, r.lon)).length;
console.log(`done ok=${ok} fail=${fail} dummy_left=${left}`);
