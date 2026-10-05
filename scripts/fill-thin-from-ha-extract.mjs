#!/usr/bin/env node
/**
 * Fill thin Bymy listings from HA public-page extracts (JSON array).
 * Usage: node scripts/fill-thin-from-ha-extract.mjs path/to/extracts.json
 * Each item: { id, ha, userId?, extract: { title, price, pairs, equip, desc, hq } }
 */
import { readFileSync } from "fs";
import { saveListing, getListing, getListingOwnerMeta } from "../lib/db-store.mjs";
import { loadEnvFiles } from "../lib/load-env.mjs";

loadEnvFiles();

function digits(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function pick(pairs, ...keys) {
  for (const key of keys) {
    if (pairs[key]) return String(pairs[key]).trim();
  }
  // case-insensitive
  const lower = Object.fromEntries(Object.entries(pairs).map(([k, v]) => [k.toLowerCase(), v]));
  for (const key of keys) {
    const hit = lower[key.toLowerCase()];
    if (hit) return String(hit).trim();
  }
  return "";
}

function parseTire(raw) {
  const m = String(raw || "").match(/(\d{3})\s*\/\s*(\d{2})\s*R\s*(\d{2})/i);
  if (!m) return {};
  return {
    nyari_gumi_szelesseg: m[1],
    nyari_gumi_magassag: m[2],
    nyari_gumi_atmero: m[3],
  };
}

function parsePower(raw) {
  const kw = String(raw || "").match(/(\d+)\s*kW/i);
  const le = String(raw || "").match(/(\d+)\s*LE/i);
  return {
    ...(kw ? { teljesitmeny_kw: kw[1] } : {}),
    ...(le ? { teljesitmeny_le: le[1] } : {}),
  };
}

function yearFrom(raw) {
  const m = String(raw || "").match(/(19|20)\d{2}/);
  return m ? m[0] : "";
}

function cleanEquip(list) {
  const bad =
    /település|fiókom|hirdetésfeladás|süti|cookie|belép|regisztr|parkoló|kilépés|menü|kapcsolat/i;
  return [...new Set((Array.isArray(list) ? list : []).map((x) => String(x || "").trim()).filter((t) => t.length >= 2 && t.length <= 90 && !bad.test(t)))].slice(0, 300);
}

function formFromExtract(item) {
  const ex = item.extract || {};
  const pairs = ex.pairs || {};
  const ha = String(item.ha || "").replace(/\D/g, "");
  const title = String(ex.title || item.title || "").replace(/^Eladó\s+/i, "").trim();
  const price = digits(ex.priceText || pick(pairs, "Vételár", "Ár"));
  const km = digits(pick(pairs, "Km. óra állás", "Km. óra állása", "Futásteljesítmény"));
  const year = yearFrom(pick(pairs, "Évjárat", "Gyártási év") || ex.year || "");
  const fuel = pick(pairs, "Üzemanyag", "Uzemanyag");
  const gear = pick(pairs, "Sebességváltó", "Sebessegvalto");
  const tire = parseTire(pick(pairs, "Nyári gumi méret", "Nyári gumi"));
  const power = parsePower(pick(pairs, "Teljesítmény"));
  const henger = digits(pick(pairs, "Hengerűrtartalom"));
  const hq = Array.isArray(ex.hq) && ex.hq[0] ? ex.hq[0] : "";
  const equip = cleanEquip(ex.equip);
  const desc = String(ex.desc || "").trim();

  const form = {
    hirdetes_vertical: "auto",
    hirdetes_alkategoria: "szemelyauto",
    jarmu_kategoria: "szemelyauto",
    hasznaltauto_hirdetes_id: ha,
    forras_url: ex.url || `https://www.hasznaltauto.hu/szemelyauto/import-${ha}`,
    hirdetes_cime: title ? `Eladó ${title}` : `Eladó importált autó (${ha})`,
    ...(price ? { vetelar: price } : {}),
    ...(km ? { km } : {}),
    ...(year ? { gyartasi_ev: year } : {}),
    ...(fuel ? { uzemanyag: fuel } : {}),
    ...(gear ? { sebessegvalto: gear } : {}),
    ...(henger ? { hengerurtartalom: henger } : {}),
    ...power,
    ...tire,
    ...(hq ? { fo_kep: hq } : {}),
    ...(desc ? { leiras: desc } : {}),
    ...(equip.length ? { felszereltseg: equip } : {}),
  };

  const allapot = pick(pairs, "Állapot");
  const kivitel = pick(pairs, "Kivitel", "Jármű típusa");
  const hajtas = pick(pairs, "Hajtás");
  const klima = pick(pairs, "Klíma fajtája");
  const okmany = pick(pairs, "Okmányok jellege");
  const szemelyek = digits(pick(pairs, "Szállítható szem. száma"));
  const ajtok = digits(pick(pairs, "Ajtók száma"));
  const sajat = digits(pick(pairs, "Saját tömeg"));
  const ossz = digits(pick(pairs, "Teljes tömeg"));
  const csomag = digits(pick(pairs, "Csomagtartó"));
  const szin = pick(pairs, "Szín");
  const hengerEl = pick(pairs, "Henger-elrendezés", "Henger elrendezés");

  if (allapot) form.allapot = allapot;
  if (kivitel) form.kivitel = kivitel;
  if (hajtas) form.hajtas = hajtas;
  if (klima) form.klima = klima;
  if (okmany) form.okmany_jelleg = okmany;
  if (szemelyek) form.szemelyek = szemelyek;
  if (ajtok) form.ajtok = ajtok;
  if (sajat) form.sajat_tomeg = sajat;
  if (ossz) form.ossztomeg = ossz;
  if (csomag) form.csomagtarto = csomag;
  if (szin) form.szin = szin;
  if (hengerEl) form.henger_elrendezes = hengerEl;

  const muszaki = pick(pairs, "Műszaki érvényesség");
  const mm = String(muszaki || "").match(/(\d{1,2})\.(\d{4})|(\d{4})[./-](\d{1,2})/);
  if (mm) {
    if (mm[2]) {
      form.muszaki_honap = String(Number(mm[1]));
      form.muszaki_ev = mm[2];
    } else {
      form.muszaki_ev = mm[3];
      form.muszaki_honap = String(Number(mm[4]));
    }
  }

  return form;
}

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/fill-thin-from-ha-extract.mjs extracts.json");
  process.exit(1);
}

const KEEP = [
  "telefon1_orszag",
  "telefon1_korzet",
  "telefon1_szam",
  "telefon2_orszag",
  "telefon2_korzet",
  "telefon2_szam",
  "telepules",
  "megye",
  "iranyitoszam",
  "cim",
  "owner_user_id",
  "partner_slug",
  "cegnev",
  "fotok",
];

const items = JSON.parse(readFileSync(path, "utf8"));
const list = (Array.isArray(items) ? items : items.items || []).filter(
  (item) => item?.extract && !item.error
);
let ok = 0;
let fail = 0;
for (const item of list) {
  const id = Number(item.id);
  const ha = String(item.ha || "").replace(/\D/g, "");
  try {
    if (!(id > 0) || ha.length < 5) throw new Error("bad id/ha");
    const meta = await getListingOwnerMeta(id);
    const existing = await getListing(id);
    const userId = meta?.user_id || meta?.userId || existing?.user_id || item.userId;
    if (!userId) throw new Error("no owner");
    const form = formFromExtract(item);
    if (!form.km && !form.leiras && !(form.felszereltseg || []).length) {
      throw new Error("extract too thin");
    }
    const prev = existing?.form || {};
    for (const key of KEEP) {
      if (form[key] == null && prev[key] != null && prev[key] !== "") form[key] = prev[key];
    }
    if (!form.gyartmany && prev.gyartmany) form.gyartmany = prev.gyartmany;
    if (!form.modell && prev.modell) form.modell = prev.modell;
    if (!form.tipus && prev.tipus) form.tipus = prev.tipus;
    // Keep gallery: fo_kep + remaining HQ urls into fotok if empty
    if ((!Array.isArray(form.fotok) || !form.fotok.length) && Array.isArray(item.extract?.hq)) {
      form.fotok = item.extract.hq.slice(0, 40);
    }
    const saved = await saveListing(form, id, { status: "feladott", userId, replaceImport: true });
    ok += 1;
    console.log(
      JSON.stringify({
        ok: true,
        id: saved?.id ?? id,
        ha,
        km: saved?.form?.km || form.km,
        eq: (saved?.form?.felszereltseg || form.felszereltseg || []).length,
        price: saved?.form?.vetelar || form.vetelar,
      })
    );
  } catch (error) {
    fail += 1;
    console.log(JSON.stringify({ ok: false, id, ha, error: error.message || String(error) }));
  }
}
console.log(JSON.stringify({ done: true, ok, fail, total: list.length }));
