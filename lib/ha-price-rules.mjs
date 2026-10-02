/**
 * docs/ha-ar-letoltes-gyartmanyok.txt → letöltési szabályok.
 * Üres mező = nincs döntés / kihagyva.
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_RULES_PATH = join(__dirname, "..", "docs", "ha-ar-letoltes-gyartmanyok.txt");

function parseFieldMap(parts) {
  const out = {};
  for (const part of parts) {
    const idx = part.indexOf(":");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

function parseYesNo(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (!v) return null;
  if (v === "igen" || v === "yes" || v === "1" || v === "true") return true;
  if (v === "nem" || v === "no" || v === "0" || v === "false") return false;
  if (v === "kesobb" || v === "later") return "kesobb";
  return v;
}

function parseReszletes(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (!v) return { mode: null, days: null, fromYear: null };
  if (v === "igen" || v === "yes") return { mode: "igen", days: null, fromYear: null };
  if (v === "nem" || v === "no") return { mode: "nem", days: null, fromYear: null };
  const year = v.match(/^ev:(\d{4})$/i) || v.match(/^year:(\d{4})$/i);
  if (year) return { mode: "ev", days: null, fromYear: Number(year[1]) };
  const m = v.match(/^datum:(\d+)$/i) || v.match(/^day(?:s)?:(\d+)$/i);
  if (m) return { mode: "datum", days: Number(m[1]), fromYear: null };
  return { mode: v, days: null, fromYear: null };
}

/**
 * @returns {{ path: string, rules: Array<{ gyartmany: string, letolt: boolean|string|null, alap: boolean|null, reszletes: string|null, reszletesDays: number|null, reszletesFromYear: number|null, prioritas: number|null, megjegyzes: string }> }}
 */
export function loadHaPriceRules(filePath = DEFAULT_RULES_PATH) {
  const path = filePath || DEFAULT_RULES_PATH;
  if (!existsSync(path)) {
    return { path, rules: [] };
  }
  const text = readFileSync(path, "utf8");
  const rules = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split("|").map((p) => p.trim());
    if (!parts[0]) continue;
    const gyartmany = parts[0];
    const fields = parseFieldMap(parts.slice(1));
    const reszletes = parseReszletes(fields.reszletes);
    const prio = fields.prioritas ? Number(String(fields.prioritas).replace(/\D/g, "")) : null;
    rules.push({
      gyartmany,
      letolt: parseYesNo(fields.letolt),
      alap: parseYesNo(fields.alap) === true ? true : parseYesNo(fields.alap) === false ? false : null,
      reszletes: reszletes.mode,
      reszletesDays: reszletes.days,
      reszletesFromYear: reszletes.fromYear,
      prioritas: Number.isFinite(prio) ? prio : null,
      megjegyzes: fields.megjegyzes || "",
    });
  }
  return { path, rules };
}

export function summarizeHaPriceRules(rules) {
  const list = Array.isArray(rules) ? rules : [];
  const download = list.filter((r) => r.letolt === true);
  const skip = list.filter((r) => r.letolt === false);
  const later = list.filter((r) => r.letolt === "kesobb");
  const undecided = list.filter((r) => r.letolt == null || r.letolt === "");
  return {
    total: list.length,
    download: download.length,
    skip: skip.length,
    later: later.length,
    undecided: undecided.length,
    ready: download.slice().sort((a, b) => (a.prioritas || 99) - (b.prioritas || 99)),
  };
}
