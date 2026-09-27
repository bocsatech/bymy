#!/usr/bin/env node
/**
 * Használtautó Márka → Modell → almenü (3 szint).
 * Forrás: api.hasznaltauto.hu/v2/tomb (a kereső ugyanezt hívja).
 * Cloudflare cookie kell → saját debug Chrome.
 *
 * Személyautó:
 *   1) bash mac/chrome-debug-hasznaltauto.command
 *   2) Chrome-ban engedd át a CF-t (www.hasznaltauto.hu)
 *   3) npm run scrape:ha-brands-models
 *
 * Kisteher / Kishaszon (3,5 t-ig):
 *   npm run scrape:ha-brands-models:kisteher
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import {
  normalizeBrand,
  saveVehicleCatalogForKind,
  normalizeVehicleCatalogKind,
} from "../lib/vehicle-catalog.mjs";

const WWW = "https://www.hasznaltauto.hu";
const API = "https://api.hasznaltauto.hu";
const CDP_URL = process.env.CDP_URL || process.env.HA_CDP || "http://127.0.0.1:9222";

const KIND = normalizeVehicleCatalogKind(process.env.HA_KIND || process.argv[2] || "szemelyauto");

const TOMB_BY_KIND = {
  szemelyauto: {
    path: "markakSzemelyautoFilter,modellekSzemelyautoFilter",
    brandKey: "markakSzemelyautoFilter",
    modelKey: "modellekSzemelyautoFilter",
    haCategory: "szemelyauto",
  },
  kisteher: {
    path: "markakKishaszonjarmuFilter,modellekKishaszonjarmuFilter",
    brandKey: "markakKishaszonjarmuFilter",
    modelKey: "modellekKishaszonjarmuFilter",
    haCategory: "kishaszonjarmu",
  },
};

const tombCfg = TOMB_BY_KIND[KIND] || TOMB_BY_KIND.szemelyauto;
const TOMB_URL = `${API}/v2/tomb/${tombCfg.path}`;
const RAW_OUT = resolve(
  process.env.HA_BM_RAW ||
    (KIND === "kisteher" ? "data/ha-brands-models-kisteher.json" : "data/ha-brands-models.json")
);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function cleanLabel(value) {
  return String(value ?? "")
    .replace(/\s*\(\d+\)\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mapNode(node) {
  const id = String(node?.k ?? "");
  const name = cleanLabel(node?.v ?? "");
  const kids = Array.isArray(node?.i) ? node.i : [];
  const children = kids.map(mapNode).filter((c) => c.name);
  return {
    id,
    name,
    searchSelectable: true,
    postRequiresChild: children.length > 0,
    children,
  };
}

function flattenNames(models) {
  const out = [];
  for (const m of models) {
    if (m.name) out.push(m.name);
    for (const c of m.children || []) {
      if (c.name) out.push(c.name);
      for (const cc of c.children || []) {
        if (cc.name) out.push(cc.name);
      }
    }
  }
  return [...new Set(out)].sort((a, b) => a.localeCompare(b, "hu", { sensitivity: "base" }));
}

function countChildren(models) {
  let n = 0;
  let groups = 0;
  for (const m of models) {
    if (m.children?.length) {
      groups += 1;
      n += m.children.length;
      for (const c of m.children) n += c.children?.length || 0;
    }
  }
  return { childCount: n, groupsWithChildren: groups };
}

async function connectChrome() {
  try {
    const browser = await chromium.connectOverCDP(CDP_URL);
    const context = browser.contexts()[0];
    if (!context) throw new Error("Nincs Chrome kontextus.");
    return { browser, context };
  } catch (err) {
    throw new Error(
      `Nem sikerült csatlakozni a Chrome-hoz (${CDP_URL}).\n` +
        `1) bash mac/chrome-debug-hasznaltauto.command\n` +
        `2) Engedd át a Cloudflare-t\n` +
        `3) npm run scrape:ha-brands-models\n` +
        `Hiba: ${err.message}`
    );
  }
}

async function ensureWwwPage(context) {
  let page = context.pages().find((p) => p.url().includes("hasznaltauto.hu")) || context.pages()[0];
  if (!page) page = await context.newPage();
  await page.bringToFront();

  if (!page.url().includes("hasznaltauto.hu")) {
    console.log(`Navigálás: ${WWW}`);
    await page.goto(WWW, { waitUntil: "domcontentloaded", timeout: 90000 });
  }

  for (let i = 0; i < 90; i += 1) {
    const st = await page.evaluate(() => ({
      title: document.title,
      host: location.hostname,
      cf: /pillanat|just a moment|attention required|cloudflare/i.test(document.title),
    }));
    if (!st.cf && /hasznaltauto\.hu$/i.test(st.host)) {
      console.log(`Chrome oldal OK: ${st.title.slice(0, 60)}`);
      return page;
    }
    if (i % 5 === 0) {
      console.log(`Várakozás Cloudflare-re… (${i}s) — kattints a Chrome-ban ha kell`);
    }
    await sleep(1000);
  }
  throw new Error("Cloudflare nem ment át. Engedd át a debug Chrome-ban, majd futtasd újra.");
}

async function fetchTomb(page) {
  const result = await page.evaluate(async (url) => {
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Accept-Language": "hu-HU",
        "x-use-locale": "true",
      },
    });
    const text = await res.text();
    return { status: res.status, text };
  }, TOMB_URL);

  if (result.status !== 200) {
    throw new Error(
      `tomb API HTTP ${result.status}. Cloudflare / cookie hiány. Engedd át a CF-t a www-n, maradj a debug Chrome-ban.\n` +
        result.text.slice(0, 200)
    );
  }
  try {
    return JSON.parse(result.text);
  } catch {
    writeFileSync("/tmp/ha-tomb-raw.txt", result.text);
    throw new Error("tomb válasz nem JSON. Mentve: /tmp/ha-tomb-raw.txt");
  }
}

async function main() {
  const { context } = await connectChrome();
  const page = await ensureWwwPage(context);

  console.log(`Kind: ${KIND}`);
  console.log(`API: ${TOMB_URL}`);
  const data = await fetchTomb(page);
  writeFileSync("/tmp/ha-tomb.json", `${JSON.stringify(data).slice(0, 2_000_000)}\n`);

  const brandRaw = data[tombCfg.brandKey] ?? data.brands ?? [];
  const modelRaw = data[tombCfg.modelKey] ?? data.models ?? [];

  if (!Array.isArray(brandRaw) || brandRaw.length < 5) {
    console.log("Válasz kulcsok:", Object.keys(data));
    throw new Error(`Keves gyártmány a tomb API-ból (${Array.isArray(brandRaw) ? brandRaw.length : "?"}).`);
  }

  const modelsByBrandId = new Map();
  if (Array.isArray(modelRaw)) {
    for (const entry of modelRaw) {
      if (entry && entry.k != null && Array.isArray(entry.i)) {
        modelsByBrandId.set(String(entry.k), entry.i);
      }
    }
  } else if (modelRaw && typeof modelRaw === "object") {
    for (const [k, v] of Object.entries(modelRaw)) {
      modelsByBrandId.set(String(k), Array.isArray(v) ? v : v?.i || []);
    }
  }

  const brandRows = [];
  const modellekFlat = {};
  const modellekTree = {};
  let modelCount = 0;
  let childCount = 0;
  let groupsWithChildren = 0;

  for (const b of brandRaw) {
    const label = cleanLabel(b.v ?? b.label ?? "");
    if (!label) continue;
    const id = String(b.k ?? b.value ?? "");
    const name = normalizeBrand(label) || label;
    const tree = (modelsByBrandId.get(id) || []).map(mapNode).filter((m) => m.name);
    const stats = countChildren(tree);
    modelCount += tree.length;
    childCount += stats.childCount;
    groupsWithChildren += stats.groupsWithChildren;

    brandRows.push({
      source_id: id,
      name,
      label,
      models: tree,
    });
    modellekTree[name] = tree;
    modellekFlat[name] = flattenNames(tree);
  }

  brandRows.sort((a, b) => a.name.localeCompare(b.name, "hu"));
  const gyartmanyok = brandRows.map((b) => b.name);

  const sampleBrand = brandRows.find((b) => /FORD|MERCEDES|VOLKSWAGEN|FIAT/i.test(b.name));
  if (sampleBrand) {
    console.log(
      `Ellenőrzés: ${sampleBrand.name} →`,
      sampleBrand.models
        .slice(0, 6)
        .map((m) => `${m.name}(${m.children?.length || 0})`)
        .join(", ")
    );
  }

  const catalog = {
    source: "api.hasznaltauto.hu/v2/tomb",
    category: KIND,
    imported_at: new Date().toISOString(),
    count_rows: modelCount + childCount,
    count_brands: gyartmanyok.length,
    count_models: modelCount,
    count_model_children: childCount,
    count_groups_with_children: groupsWithChildren,
    gyartmanyok,
    modellek: modellekFlat,
    modellekTree,
    tipusok: {},
    meta: {
      levels: ["gyartmany", "modell", "modell_almenu"],
      search: "csoport (modell) önmagában is szűrhető",
      post: "ha postRequiresChild=true, feladáskor gyermek kötelező",
      tombUrl: TOMB_URL,
      haCategory: tombCfg.haCategory,
    },
  };

  mkdirSync(dirname(RAW_OUT), { recursive: true });
  writeFileSync(
    RAW_OUT,
    `${JSON.stringify(
      {
        imported_at: catalog.imported_at,
        source: catalog.source,
        kind: KIND,
        meta: catalog.meta,
        count_brands: catalog.count_brands,
        count_models: catalog.count_models,
        count_model_children: catalog.count_model_children,
        brands: brandRows,
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const saved = saveVehicleCatalogForKind(catalog, KIND);
  const fullBytes = Buffer.byteLength(JSON.stringify(catalog));

  console.log(`\nNyers: ${RAW_OUT}`);
  console.log(`Katalógus: ${saved}`);
  console.log(
    `Gyártmány: ${catalog.count_brands}, modell: ${catalog.count_models}, almenü-elem: ${catalog.count_model_children} (${groupsWithChildren} csoport almenüvel)`
  );
  console.log(`Méret: ${(fullBytes / 1024).toFixed(1)} KB`);
}

main().catch((error) => {
  console.error(`Sikertelen:\n${error.message}`);
  process.exitCode = 1;
});
