/**
 * Ingatlan — típus → mezők admin config (KV).
 * Alapértelmezés: INGATLAN_FIELDS_BY_TIPUS a kódból.
 */

import {
  INGATLAN_LAKAS_TIPUS,
  INGATLAN_FIELDS_BY_TIPUS,
  INGATLAN_ASSIGNABLE_FIELD_DEFS,
  INGATLAN_CORE_FIELD_KEYS,
} from "./ingatlan-fields.mjs";

export const INGATLAN_TIPUS_FIELDS_KV_KEY = "ingatlan_tipus_fields_v1";

const PARENT_KEYS = INGATLAN_LAKAS_TIPUS.map((o) => o.value).filter(Boolean);
const ALLOWED = new Set(INGATLAN_ASSIGNABLE_FIELD_DEFS.map((d) => d.field_key));

export function defaultIngatlanTipusFieldsConfig() {
  const by_tipus = {};
  for (const key of PARENT_KEYS) {
    const list = INGATLAN_FIELDS_BY_TIPUS[key];
    by_tipus[key] = list == null ? null : [...list];
  }
  return { version: 1, by_tipus };
}

function cleanFieldList(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const key = String(item ?? "").trim();
    if (!key || !ALLOWED.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/**
 * @param {unknown} raw
 * @returns {{ version: number, by_tipus: Record<string, string[]|null>, core: string[], catalog: typeof INGATLAN_ASSIGNABLE_FIELD_DEFS, parents: Array<{value:string,label:string}> }}
 */
export function normalizeIngatlanTipusFieldsConfig(raw) {
  const defaults = defaultIngatlanTipusFieldsConfig();
  const incoming = raw && typeof raw === "object" ? raw : {};
  const src = incoming.by_tipus && typeof incoming.by_tipus === "object" ? incoming.by_tipus : {};
  const by_tipus = {};
  for (const key of PARENT_KEYS) {
    if (!(key in src)) {
      by_tipus[key] = defaults.by_tipus[key] ?? [];
      continue;
    }
    const val = src[key];
    if (key === "egyeb" && (val == null || val === "all")) {
      by_tipus[key] = null;
      continue;
    }
    const cleaned = cleanFieldList(val);
    by_tipus[key] = cleaned == null ? defaults.by_tipus[key] ?? [] : cleaned;
  }
  return {
    version: 1,
    by_tipus,
    core: [...INGATLAN_CORE_FIELD_KEYS],
    catalog: INGATLAN_ASSIGNABLE_FIELD_DEFS.map((d) => ({ ...d })),
    parents: INGATLAN_LAKAS_TIPUS.filter((o) => o.value).map((o) => ({
      value: o.value,
      label: o.label,
    })),
  };
}

export function publicIngatlanTipusFieldsConfig(config) {
  const full = normalizeIngatlanTipusFieldsConfig(config);
  return {
    version: full.version,
    by_tipus: full.by_tipus,
    core: full.core,
  };
}
