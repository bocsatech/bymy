/**
 * Járműkatalógus: ~/Letöltések/mentesmarka/jarmu-katalogus.csv
 * Gyartmany → Modell → Tipus (EvTol/EvIg opcionális; legördülőkhöz unió)
 */
import { existsSync, mkdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";

let cache = null;

export function letoltesekRoot() {
  const home = homedir();
  const candidates = [join(home, "Letöltések"), join(home, "Downloads")];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  const created = join(home, "Letöltések");
  mkdirSync(created, { recursive: true });
  return created;
}

export function mentesmarkaDir() {
  return join(letoltesekRoot(), "mentesmarka");
}

export function catalogCandidateDirs() {
  const home = homedir();
  const dirs = [
    join(home, "Letöltések", "mentesmarka"),
    join(home, "Downloads", "mentesmarka"),
  ];
  return [...new Set(dirs)];
}

export function catalogPaths() {
  const dir = mentesmarkaDir();
  return {
    dir,
    csv: join(dir, "jarmu-katalogus.csv"),
    appendCsv: join(dir, "jarmu-katalogus.append.csv"),
    json: join(dir, "jarmu-katalogus.json"),
  };
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** CSV → { brands: string[], tree: { [brand]: { [model]: string[] } }, rowCount } */
export function parseCatalogCsv(text) {
  const lines = String(text ?? "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { brands: [], tree: {}, rowCount: 0 };
  }

  const header = parseCsvLine(lines[0]).map(normalizeHeader);
  let iGy = header.findIndex((h) => h === "gyartmany" || h === "marka" || h === "gyarto");
  let iMo = header.findIndex((h) => h === "modell");
  let iTi = header.findIndex((h) => h === "tipus");
  // Új formátum: Gyartmany,Modell,EvTol,EvIg,Tipus — régi: Gyartmany,Modell,Tipus
  const iEvTol = header.findIndex((h) => h === "evtol" || h === "ev_tol");
  const iEvIg = header.findIndex((h) => h === "evig" || h === "ev_ig");
  if (iGy < 0) iGy = 0;
  if (iMo < 0) iMo = 1;
  if (iTi < 0) iTi = iEvTol >= 0 || iEvIg >= 0 ? 4 : 2;

  const tree = {};
  let rowCount = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    const brand = String(cells[iGy] ?? "").trim();
    const model = String(cells[iMo] ?? "").trim();
    const type = String(cells[iTi] ?? "").trim();
    // EvTol/EvIg: legördülőkhöz unió — minden évjárat típusa megjelenik
    if (!brand) continue;
    rowCount += 1;
    if (!tree[brand]) tree[brand] = {};
    if (!model) continue;
    if (!tree[brand][model]) tree[brand][model] = [];
    if (type && !/^egy[eé]b\b/i.test(type) && !tree[brand][model].includes(type)) {
      tree[brand][model].push(type);
    }
  }

  for (const brand of Object.keys(tree)) {
    for (const model of Object.keys(tree[brand])) {
      tree[brand][model].sort((a, b) => a.localeCompare(b, "hu"));
    }
  }

  const brands = Object.keys(tree).sort((a, b) => a.localeCompare(b, "hu"));
  return { brands, tree, rowCount };
}

function parseCatalogJson(text) {
  const data = JSON.parse(text);
  const tree = {};
  const gyartmanyok = data.gyartmanyok ?? {};
  for (const brandEntry of Object.values(gyartmanyok)) {
    const brand = String(brandEntry.nev ?? "").trim();
    if (!brand) continue;
    tree[brand] = {};
    for (const modelEntry of Object.values(brandEntry.modellek ?? {})) {
      const model = String(modelEntry.nev ?? "").trim();
      if (!model) continue;
      const types = Object.values(modelEntry.tipusok ?? {})
        .map((t) => String(t.nev ?? "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "hu"));
      tree[brand][model] = types;
    }
  }
  const brands = Object.keys(tree).sort((a, b) => a.localeCompare(b, "hu"));
  let rowCount = 0;
  for (const brand of brands) {
    for (const model of Object.keys(tree[brand])) {
      rowCount += Math.max(1, tree[brand][model].length);
    }
  }
  return { brands, tree, rowCount };
}

function fileMtime(path) {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

function mergeTrees(into, from) {
  for (const [brand, models] of Object.entries(from ?? {})) {
    if (!into[brand]) into[brand] = {};
    for (const [model, types] of Object.entries(models ?? {})) {
      if (!into[brand][model]) into[brand][model] = [];
      for (const type of types ?? []) {
        if (type && !into[brand][model].includes(type)) {
          into[brand][model].push(type);
        }
      }
    }
  }
}

function finalizeTree(tree) {
  for (const brand of Object.keys(tree)) {
    for (const model of Object.keys(tree[brand])) {
      tree[brand][model].sort((a, b) => a.localeCompare(b, "hu"));
    }
  }
  const brands = Object.keys(tree).sort((a, b) => a.localeCompare(b, "hu"));
  let rowCount = 0;
  for (const brand of brands) {
    for (const model of Object.keys(tree[brand])) {
      const n = tree[brand][model].length;
      rowCount += n > 0 ? n : 1;
    }
  }
  return { brands, tree, rowCount };
}

function listCatalogFiles() {
  const files = [];
  for (const dir of catalogCandidateDirs()) {
    for (const name of ["jarmu-katalogus.csv", "jarmu-katalogus.append.csv", "jarmu-katalogus.json"]) {
      const path = join(dir, name);
      if (existsSync(path)) files.push(path);
    }
  }
  return files;
}

export function loadJarmuKatalogus({ force = false } = {}) {
  const paths = catalogPaths();
  const files = listCatalogFiles();
  const mtime = files.reduce((max, path) => Math.max(max, fileMtime(path)), 0);
  const cacheKey = files.join("|");

  if (!force && cache && cache.cacheKey === cacheKey && cache.mtime === mtime) {
    return cache.payload;
  }

  if (!files.length) {
    const payload = {
      ok: false,
      error:
        "Nincs járműkatalógus. Futtasd a mentesmarka programot — kimenet: ~/Letöltések/mentesmarka/jarmu-katalogus.csv",
      path: paths.csv,
      dir: paths.dir,
      brands: [],
      tree: {},
      rowCount: 0,
      source: null,
      files: [],
    };
    cache = { cacheKey: "", mtime: 0, payload };
    return payload;
  }

  const tree = {};
  for (const filePath of files) {
    const raw = readFileSync(filePath, "utf8");
    const parsed = filePath.endsWith(".json") ? parseCatalogJson(raw) : parseCatalogCsv(raw);
    mergeTrees(tree, parsed.tree);
  }

  const finalized = finalizeTree(tree);
  const payload = {
    ok: finalized.brands.length > 0,
    path: files[0],
    dir: paths.dir,
    brands: finalized.brands,
    tree: finalized.tree,
    rowCount: finalized.rowCount,
    source: "merged",
    files,
    updatedAt: new Date(mtime || Date.now()).toISOString(),
    error:
      finalized.brands.length > 0
        ? undefined
        : "A katalógus fájlok üresek. Futtasd újra a mentesmarka programot.",
  };
  cache = { cacheKey, mtime, payload };
  return payload;
}

function resolveBrandInTree(tree, brand) {
  if (!brand) return "";
  if (tree[brand]) return brand;
  if (tree[brand.toUpperCase()]) return brand.toUpperCase();
  return Object.keys(tree).find((key) => key.toLowerCase() === brand.toLowerCase()) ?? "";
}

function resolveModelInTree(models, model) {
  if (!model || !models) return "";
  if (models[model]) return model;
  return Object.keys(models).find((key) => key.toLowerCase() === model.toLowerCase()) ?? "";
}

export function getModels(gyartmany) {
  const catalog = loadJarmuKatalogus();
  const brand = resolveBrandInTree(catalog.tree, String(gyartmany ?? "").trim());
  if (!brand) return [];
  return Object.keys(catalog.tree[brand] ?? {}).sort((a, b) => a.localeCompare(b, "hu"));
}

export function getTypes(gyartmany, modell) {
  const catalog = loadJarmuKatalogus();
  const brand = resolveBrandInTree(catalog.tree, String(gyartmany ?? "").trim());
  if (!brand) return [];
  const model = resolveModelInTree(catalog.tree[brand], String(modell ?? "").trim());
  if (!model) return [];
  return [...(catalog.tree[brand][model] ?? [])];
}
