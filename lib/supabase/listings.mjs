/**
 * Hirdetés CRUD — Supabase Postgres (001_initial_schema.sql).
 */
import { formDataToCells, cellsToFormData } from "../form-field-catalog.mjs";
import {
  buildPreviewFromCells,
  sanitizeListingFieldValue,
  sanitizeListingPlainText,
} from "../listing-preview.mjs";
import { getSupabase, supabaseBackendLabel } from "./client.mjs";

const CHROME_FIELD_KEYS = new Set([
  "leiras",
  "hirdetes_cime",
  "gyartmany",
  "modell",
  "tipus",
  "telepules",
  "megye",
  "megtekintesi_cim",
  "iranyitoszam",
]);

function sanitizeListingCell(cell) {
  if (!cell) return cell;
  const key = String(cell.field_key ?? "");
  if (key === "leiras" || key === "hirdetes_cime") {
    return { ...cell, value: sanitizeListingPlainText(cell.value) };
  }
  if (CHROME_FIELD_KEYS.has(key)) {
    return { ...cell, value: sanitizeListingFieldValue(cell.value) };
  }
  return cell;
}

function sanitizeFormDataForSave(formData = {}) {
  const data = { ...formData };
  data.hirdetes_cime = sanitizeListingPlainText(data.hirdetes_cime) || "";
  data.leiras = sanitizeListingPlainText(data.leiras) || "";
  data.gyartmany = sanitizeListingFieldValue(data.gyartmany);
  data.modell = sanitizeListingFieldValue(data.modell);
  data.tipus = sanitizeListingFieldValue(data.tipus);
  data.telepules = sanitizeListingFieldValue(data.telepules);
  data.megye = sanitizeListingFieldValue(data.megye);
  data.megtekintesi_cim = sanitizeListingFieldValue(data.megtekintesi_cim);
  data.iranyitoszam = sanitizeListingFieldValue(data.iranyitoszam);
  return data;
}

function normalizeListingStatus(status) {
  const value = String(status ?? "mentett").trim().toLowerCase();
  return ["mentett", "feladott"].includes(value) ? value : "mentett";
}

function sb() {
  return getSupabase();
}

async function loadCells(listingId) {
  const { data, error } = await sb()
    .from("listing_cells")
    .select("field_key, label, value, step")
    .eq("listing_id", listingId)
    .order("step")
    .order("label");
  if (error) throw error;
  return (data ?? []).map((cell) => sanitizeListingCell(cell));
}

async function loadCellsByListingIds(ids) {
  if (!ids.length) return new Map();
  const { data, error } = await sb()
    .from("listing_cells")
    .select("listing_id, field_key, label, value, step")
    .in("listing_id", ids);
  if (error) throw error;
  const map = new Map();
  for (const row of data ?? []) {
    if (!map.has(row.listing_id)) map.set(row.listing_id, []);
    map.get(row.listing_id).push(row);
  }
  return map;
}

function listingRowWithPreview(row, cells) {
  const sanitized = cells.map((cell) => sanitizeListingCell(cell));
  const hirdetes_cime =
    sanitizeListingPlainText(row.hirdetes_cime) || `Hirdetés #${row.id}`;
  const preview = buildPreviewFromCells(sanitized, { ...row, hirdetes_cime });
  const foKep = String(row.fo_kep ?? "").trim();
  if (foKep) {
    preview.imageUrl = foKep;
    preview.imageUrls = preview.imageUrls?.length ? preview.imageUrls : [foKep];
  }
  return {
    ...row,
    hirdetes_cime,
    preview,
  };
}

async function replaceCells(listingId, cells) {
  const { error: delErr } = await sb().from("listing_cells").delete().eq("listing_id", listingId);
  if (delErr) throw delErr;
  if (!cells.length) return;
  const rows = cells.map((cell) => ({
    listing_id: listingId,
    field_key: cell.field_key,
    label: cell.label,
    value: cell.value,
    step: cell.step ?? 1,
  }));
  const { error: insErr } = await sb().from("listing_cells").insert(rows);
  if (insErr) throw insErr;
}

async function upsertListingMeta(id, formData, status) {
  const { data: existing } = await sb().from("listings").select("fo_kep").eq("id", id).maybeSingle();
  const nextFoKep = String(formData.fo_kep ?? "").trim() || existing?.fo_kep || "";
  const { error } = await sb()
    .from("listings")
    .update({
      hirdetes_cime: formData.hirdetes_cime ?? "",
      forras_url: formData.forras_url ?? "",
      hasznaltauto_hirdetes_id: formData.hasznaltauto_hirdetes_id ?? "",
      fo_kep: nextFoKep,
      status: normalizeListingStatus(status ?? formData.status),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function listFieldDefs() {
  const { data, error } = await sb()
    .from("field_defs")
    .select("field_key, label, step")
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function listListings({ limit = 50, status = null } = {}) {
  let q = sb()
    .from("listings")
    .select(
      "id, hirdetes_cime, forras_url, hasznaltauto_hirdetes_id, fo_kep, status, created_at, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (status) q = q.eq("status", normalizeListingStatus(status));
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const cellsById = await loadCellsByListingIds(rows.map((r) => r.id));
  return rows.map((row) => ({
    ...row,
    cell_count: (cellsById.get(row.id) ?? []).length,
  }));
}

export async function listListingsWithPreview(opts) {
  const rows = await listListings(opts);
  const cellsById = await loadCellsByListingIds(rows.map((r) => r.id));
  return rows.map((row) => {
    const cells = (cellsById.get(row.id) ?? []).map((cell) => sanitizeListingCell(cell));
    return listingRowWithPreview(row, cells);
  });
}

export async function getListing(id) {
  const { data: listing, error } = await sb()
    .from("listings")
    .select(
      "id, hirdetes_cime, forras_url, hasznaltauto_hirdetes_id, fo_kep, status, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!listing) return null;
  const cells = await loadCells(id);
  const hirdetes_cime =
    sanitizeListingPlainText(listing.hirdetes_cime) || `Hirdetés #${listing.id}`;
  return {
    ...listing,
    hirdetes_cime,
    cells,
    form: cellsToFormData(cells),
  };
}

export async function getLatestListing() {
  const { data, error } = await sb()
    .from("listings")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? getListing(data.id) : null;
}

export async function findListingBySourceUrl(url) {
  if (!url) return null;
  const { data, error } = await sb()
    .from("listings")
    .select("id")
    .eq("forras_url", url)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? getListing(data.id) : null;
}

export async function findListingByHasznaltautoId(adId) {
  const id = String(adId || "").trim();
  if (!id) return null;
  const { data, error } = await sb()
    .from("listings")
    .select("id")
    .eq("hasznaltauto_hirdetes_id", id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? getListing(data.id) : null;
}

export async function findListingBySource({ sourceUrl = "", hasznaltautoId = "" } = {}) {
  const byUrl = await findListingBySourceUrl(sourceUrl);
  if (byUrl) return byUrl;
  return findListingByHasznaltautoId(hasznaltautoId);
}

export async function listingSourceExists(opts) {
  return Boolean(await findListingBySource(opts));
}

export async function updateListingFoKep(listingId, foKep) {
  const id = Number(listingId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const path = String(foKep || "").trim();
  if (!path) return null;
  const { data, error } = await sb()
    .from("listings")
    .update({ fo_kep: path, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return getListing(id);
}

export async function saveListing(formData, listingId = null, { status = null } = {}) {
  const clean = sanitizeFormDataForSave(formData);
  const cells = formDataToCells(clean);
  const listingStatus = normalizeListingStatus(status ?? clean.status);

  if (listingId) {
    const { data: existing } = await sb().from("listings").select("id").eq("id", listingId).maybeSingle();
    if (!existing) return null;
    await upsertListingMeta(listingId, clean, listingStatus);
    await replaceCells(listingId, cells);
    return getListing(listingId);
  }

  const { data: inserted, error } = await sb()
    .from("listings")
    .insert({
      hirdetes_cime: clean.hirdetes_cime ?? "",
      forras_url: clean.forras_url ?? "",
      hasznaltauto_hirdetes_id: clean.hasznaltauto_hirdetes_id ?? "",
      fo_kep: clean.fo_kep ?? formData.fo_kep ?? "",
      status: listingStatus,
    })
    .select("id")
    .single();
  if (error) throw error;
  await replaceCells(inserted.id, cells);
  return getListing(inserted.id);
}

export async function deleteListing(id) {
  const { error } = await sb().from("listings").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}

export async function deleteAllListings() {
  const { count, error: countErr } = await sb()
    .from("listings")
    .select("*", { count: "exact", head: true });
  if (countErr) throw countErr;
  const { error: listErr } = await sb().from("listings").delete().gte("id", 1);
  if (listErr) throw listErr;
  return { ok: true, deleted: count ?? 0 };
}

export async function dbStats() {
  const sbClient = sb();
  const [listingsRes, cellsRes, mentettRes, feladottRes] = await Promise.all([
    sbClient.from("listings").select("*", { count: "exact", head: true }),
    sbClient.from("listing_cells").select("*", { count: "exact", head: true }),
    sbClient.from("listings").select("*", { count: "exact", head: true }).eq("status", "mentett"),
    sbClient.from("listings").select("*", { count: "exact", head: true }).eq("status", "feladott"),
  ]);
  for (const r of [listingsRes, cellsRes, mentettRes, feladottRes]) {
    if (r.error) throw r.error;
  }
  return {
    listings: listingsRes.count ?? 0,
    cells: cellsRes.count ?? 0,
    mentett: mentettRes.count ?? 0,
    feladott: feladottRes.count ?? 0,
    path: `supabase://${supabaseBackendLabel()}`,
  };
}

export function getDbPath() {
  return `supabase://${supabaseBackendLabel()}`;
}

export function closeDb() {
  /* no-op */
}
