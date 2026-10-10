import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let catalogCache = null;
let propFieldsCache = null;

function loadJson(rel) {
  try {
    return JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
  } catch {
    return null;
  }
}

export function loadPiacCatalog() {
  if (catalogCache) return catalogCache;
  catalogCache = loadJson("public/data/piac-catalog.json") || loadJson("docs/piac-ref/piac-catalog.json") || { categories: [] };
  return catalogCache;
}

export function loadPiacPropFields() {
  if (propFieldsCache) return propFieldsCache;
  propFieldsCache = loadJson("public/data/piac-prop-fields.json") || { fields: {} };
  return propFieldsCache;
}

export function splitPiacPath(path) {
  return String(path || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isPiacAllasPath(path) {
  return /^allas(\/|$)/i.test(String(path || "").trim());
}

/** Slug útvonal → emberi címkék a katalógusból. */
export function formatPiacPathLabels(path) {
  const parts = splitPiacPath(path);
  if (!parts.length) return "";
  const tops = loadPiacCatalog().categories || [];
  const labels = [];
  let nodes = tops;
  for (const slug of parts) {
    const hit = (nodes || []).find((n) => n?.slug === slug) || null;
    labels.push(hit?.label || slug.replace(/-/g, " "));
    nodes = hit?.children || [];
  }
  return labels.join(" › ");
}

export function piacPropLabel(key) {
  const short = String(key || "").replace(/^piac_prop_/, "");
  if (/^position_/.test(short)) return "Munkakör";
  if (short === "job_documents") return "Jelentkezéshez szükséges dokumentumok";
  const fields = loadPiacPropFields().fields || {};
  if (fields[short]?.label) return String(fields[short].label);
  const FALLBACK = {
    carrier_level: "Tapasztalat",
    jobtype: "Foglalkoztatás jellege",
    education: "Elvárt végzettség",
    language: "Szükséges nyelvtudás",
  };
  return FALLBACK[short] || short.replace(/_/g, " ");
}

export function firstPiacPositionValue(form = {}) {
  for (const [key, raw] of Object.entries(form || {})) {
    if (!key.startsWith("piac_prop_position_")) continue;
    const v = String(raw ?? "").trim();
    if (v) return v;
  }
  return "";
}

export function collectPiacPropRows(form = {}) {
  const rows = [];
  for (const [key, raw] of Object.entries(form || {})) {
    if (!key.startsWith("piac_prop_")) continue;
    if (key === "piac_prop_job_documents") continue;
    const value = Array.isArray(raw)
      ? raw.map((x) => String(x ?? "").trim()).filter(Boolean).join(", ")
      : String(raw ?? "").trim();
    if (!value || value === "—") continue;
    const short = key.slice("piac_prop_".length);
    if (/^position_/.test(short)) {
      rows.push({ label: "Munkakör", value, key: short });
      continue;
    }
    rows.push({ label: piacPropLabel(short), value, key: short });
  }
  return rows;
}

/** Highlight chip prioritás termék / állás szerint. */
export function pickPiacHighlightRows(form = {}, { isAllas = false, city = "", priceLabel = "" } = {}) {
  const props = collectPiacPropRows(form);
  const byKey = Object.fromEntries(props.map((r) => [r.key, r]));
  const pick = (...keys) => {
    for (const k of keys) {
      if (byKey[k]?.value) return byKey[k];
    }
    return null;
  };

  if (isAllas) {
    const munkakor =
      firstPiacPositionValue(form) ||
      String(form.allas_munkakor || "").trim() ||
      pick(...Object.keys(byKey).filter((k) => /^position_/.test(k)))?.value ||
      "";
    return [
      munkakor ? { key: "generic", label: "Munkakör", value: munkakor } : null,
      (() => {
        const r = pick("carrier_level");
        return r ? { key: "condition", label: "Tapasztalat", value: r.value } : null;
      })(),
      (() => {
        const r = pick("jobtype");
        return r ? { key: "year", label: "Munkaidő", value: r.value } : null;
      })(),
      city ? { key: "area", label: "Település", value: city } : null,
    ].filter(Boolean);
  }

  return [
    (() => {
      const r = pick("electronic_condition_one", "condition", "allapot");
      const v = r?.value || String(form.allapot || "").trim();
      return v ? { key: "condition", label: "Állapot", value: v } : null;
    })(),
    (() => {
      const r = pick("mobile_memory", "memory", "storage");
      return r ? { key: "generic", label: r.label, value: r.value } : null;
    })(),
    (() => {
      const r = pick("mobile_color", "color", "colour");
      const v = r?.value || String(form.szin || "").trim();
      return v ? { key: "color", label: "Szín", value: v } : null;
    })(),
    city
      ? { key: "area", label: "Település", value: city }
      : priceLabel
        ? { key: "generic", label: "Ár", value: priceLabel }
        : null,
  ].filter(Boolean);
}
