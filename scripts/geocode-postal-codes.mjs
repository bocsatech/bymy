/**
 * Fill placeholder HU-center coords in lib/postal-codes-hu.json via Photon.
 * Groups by city so each settlement is geocoded once.
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

function cityKey(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
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
  };
}

async function resolveCity(city, samplePostal) {
  const attempts = [
    samplePostal ? `${samplePostal} ${city}, Hungary` : null,
    `${city}, Hungary`,
    `${city}, Magyarország`,
  ].filter(Boolean);
  for (const q of attempts) {
    try {
      const hit = await photon(q);
      if (hit) return hit;
    } catch {
      await sleep(300);
    }
  }
  return null;
}

const rows = JSON.parse(readFileSync(PATH, "utf8"));
const byCity = new Map();
for (let i = 0; i < rows.length; i += 1) {
  const r = rows[i];
  if (!isDummy(r.lat, r.lon)) continue;
  const key = cityKey(r.city);
  if (!key) continue;
  const bucket = byCity.get(key) || { city: String(r.city || "").trim(), indices: [], postal: "" };
  bucket.indices.push(i);
  if (!bucket.postal) bucket.postal = String(r.postal_code || "");
  byCity.set(key, bucket);
}

const cities = [...byCity.values()];
console.log(`rows=${rows.length} dummy_cities=${cities.length} dummy_rows=${cities.reduce((n, c) => n + c.indices.length, 0)}`);

let ok = 0;
let fail = 0;
for (let n = 0; n < cities.length; n += 1) {
  const bucket = cities[n];
  const hit = await resolveCity(bucket.city, bucket.postal);
  if (hit) {
    for (const i of bucket.indices) {
      const r = rows[i];
      rows[i] = {
        ...r,
        lat: hit.lat,
        lon: hit.lon,
        megye: r.megye || hit.megye || "",
      };
    }
    ok += 1;
  } else {
    fail += 1;
    console.warn("FAIL", bucket.postal, bucket.city, `(${bucket.indices.length} irsz)`);
  }
  if ((n + 1) % 20 === 0 || n === cities.length - 1) {
    writeFileSync(PATH, `${JSON.stringify(rows)}\n`);
    console.log(`progress ${n + 1}/${cities.length} ok=${ok} fail=${fail}`);
  }
  await sleep(120);
}

writeFileSync(PATH, `${JSON.stringify(rows)}\n`);
const left = rows.filter((r) => isDummy(r.lat, r.lon)).length;
console.log(`done cities_ok=${ok} cities_fail=${fail} dummy_rows_left=${left}`);
