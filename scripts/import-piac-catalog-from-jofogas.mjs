#!/usr/bin/env node
/**
 * Piactér kategóriafa import Jófogás `window.new_categories` JSON-ból.
 * Autó / Ingatlan (Jármű) kihagyva.
 *
 * Használat (böngésző console a https://www.jofogas.hu/ai/form/1 oldalon):
 *   copy(JSON.stringify(window.new_categories))
 * majd:
 *   node scripts/import-piac-catalog-from-jofogas.mjs /tmp/new_categories.json
 *
 * Vagy pipe:
 *   pbpaste | node scripts/import-piac-catalog-from-jofogas.mjs -
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTS = [
  join(ROOT, "public/data/piac-catalog.json"),
  join(ROOT, "data/piac-catalog.json"),
  join(ROOT, "docs/piac-ref/piac-catalog.json"),
];

const TOP_MAP = {
  6000: { slug: "allas", label: "Állásajánlatok, álláskeresés" },
  3000: { slug: "otthon-haztartas", label: "Otthon, háztartás" },
  5000: { slug: "muszaki-elektronika", label: "Műszaki cikkek, elektronika" },
  4000: { slug: "szabadido-sport", label: "Szabadidő, sport" },
  8000: { slug: "divat-ruhazat", label: "Divat, ruházat" },
  9000: { slug: "uzlet-szolgaltatas", label: "Üzlet, szolgáltatás" },
  8060: { slug: "baba-mama", label: "Baba-mama" },
};
const EXCLUDE = new Set(["1000", "2000"]);

function slugify(label) {
  return String(label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniquify(nodes) {
  const seen = new Map();
  for (const n of nodes || []) {
    let base = n.slug || slugify(n.label);
    let slug = base;
    let i = 2;
    while (seen.has(slug)) slug = `${base}-${i++}`;
    seen.set(slug, true);
    n.slug = slug;
    if (n.children?.length) {
      delete n.leafSkip;
      uniquify(n.children);
    } else {
      n.leafSkip = true;
    }
  }
}

function convert(node) {
  const children = (node.children || []).map(convert).filter(Boolean);
  const label = String(node.name || "").trim();
  if (!label) return null;
  const out = { slug: slugify(label), label, jfId: String(node.id || ""), children };
  if (!children.length) out.leafSkip = true;
  return out;
}

function countNodes(nodes) {
  let n = 0;
  for (const x of nodes || []) n += 1 + countNodes(x.children);
  return n;
}

function buildCatalog(raw) {
  const list = Array.isArray(raw) ? raw : raw?.categories || [];
  const categories = [];
  for (const top of list) {
    const id = String(top.id || "");
    if (EXCLUDE.has(id)) continue;
    const mapped = TOP_MAP[id];
    if (!mapped) continue;
    let kids = (top.children || []).map(convert).filter(Boolean);
    if (
      mapped.slug === "allas" &&
      kids.length === 1 &&
      (/allasajanlat/i.test(kids[0].slug) || /Állásajánlat/i.test(kids[0].label))
    ) {
      kids = kids[0].children || [];
    }
    uniquify(kids);
    categories.push({ slug: mapped.slug, label: mapped.label, jfId: id, children: kids });
  }
  return {
    version: 3,
    source: "jofogas new_categories (excl. Ingatlan, Jármű/Autó)",
    createdAt: new Date().toISOString().slice(0, 10),
    listing: {
      intent: [
        { slug: "kinal", label: "Kínál" },
        { slug: "keres", label: "Keres" },
      ],
      fields: [
        { key: "hirdetes_neve", label: "Hirdetés neve", type: "text", min: 12, max: 70, required: true },
        { key: "kepek", label: "Képek", type: "images", min_px: 640, max_px: 1920, max_count: 10, required: true },
      ],
    },
    categories,
    coverage: {
      excluded: ["ingatlan", "jarmu", "auto"],
      complete: categories.map((c) => c.slug),
    },
    stats: {
      topCategories: categories.length,
      nodeCount: countNodes(categories),
    },
  };
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Használat: node scripts/import-piac-catalog-from-jofogas.mjs <new_categories.json|->");
    process.exit(1);
  }
  const text = arg === "-" ? readFileSync(0, "utf8") : readFileSync(arg, "utf8");
  const catalog = buildCatalog(JSON.parse(text));
  const out = `${JSON.stringify(catalog, null, 2)}\n`;
  for (const file of OUTS) writeFileSync(file, out);
  console.log("piac-catalog:", catalog.stats, catalog.coverage.complete.join(", "));
}

main();
