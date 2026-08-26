/**
 * Autó oldal — Kivitel almenü (sorrend / címke / láthatóság).
 * Alapértelmezés: KIVITEL_OPTIONS; mentett állapot level1 kv-ban.
 */

import { KIVITEL_OPTIONS } from "./kivitel-options.mjs";

export const KIVITEL_MENU_KV_KEY = "kivitel_menu";

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export const DEFAULT_KIVITEL_MENU_ITEMS = KIVITEL_OPTIONS.map((label) => ({
  id: slugify(label) || "item",
  label,
  enabled: true,
}));

const DEFAULT_BY_ID = new Map(DEFAULT_KIVITEL_MENU_ITEMS.map((item) => [item.id, item]));

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeItem(raw, fallback) {
  const base = fallback || DEFAULT_KIVITEL_MENU_ITEMS[0];
  let id = cleanText(raw?.id, base.id);
  if (!id) id = slugify(raw?.label) || base.id;
  const def = DEFAULT_BY_ID.get(id);
  const label = cleanText(raw?.label, def?.label || base.label).slice(0, 80);
  if (!label) return null;
  return {
    id: id.slice(0, 48),
    label,
    enabled: raw?.enabled === false ? false : true,
  };
}

/**
 * @param {unknown} raw
 * @returns {{ version: number, items: Array<{ id: string, label: string, enabled: boolean }> }}
 */
export function normalizeKivitelMenu(raw) {
  const inputItems = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
  const seen = new Set();
  const items = [];

  for (const rawItem of inputItems) {
    const item = normalizeItem(rawItem, DEFAULT_BY_ID.get(String(rawItem?.id || "")));
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }

  for (const def of DEFAULT_KIVITEL_MENU_ITEMS) {
    if (seen.has(def.id)) continue;
    items.push({ ...def });
  }

  return { version: 1, items };
}

/** Publikus menü: csak engedélyezett címkék, sorrendben. */
export function publicKivitelLabels(menu) {
  return normalizeKivitelMenu(menu)
    .items.filter((item) => item.enabled !== false)
    .map((item) => item.label);
}
