/**
 * Hirdetés CRUD — Supabase Postgres (001_initial_schema.sql).
 */
import { formDataToCells, cellsToFormData } from "../form-field-catalog.mjs";
import {
  buildPreviewFromCells,
  composeVehicleTitle,
  sanitizeListingFieldValue,
  sanitizeListingPlainText,
} from "../listing-preview.mjs";
import { getSupabase, supabaseBackendLabel } from "./client.mjs";
import { normalizeListingStatus } from "../listing-status.mjs";
import {
  listingStatsFromForm,
  mergeProtectedCells,
  ownerCell,
} from "../listing-meta.mjs";

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
  data.leiras = sanitizeListingPlainText(data.leiras) || "";
  data.gyartmany = sanitizeListingFieldValue(data.gyartmany);
  data.modell = sanitizeListingFieldValue(data.modell);
  data.tipus = sanitizeListingFieldValue(data.tipus);
  data.telepules = sanitizeListingFieldValue(data.telepules);
  data.megye = sanitizeListingFieldValue(data.megye);
  data.megtekintesi_cim = sanitizeListingFieldValue(data.megtekintesi_cim);
  data.iranyitoszam = sanitizeListingFieldValue(data.iranyitoszam);
  const vehicleTitle = composeVehicleTitle(data);
  data.hirdetes_cime = vehicleTitle
    ? `Eladó ${vehicleTitle}`
    : sanitizeListingPlainText(data.hirdetes_cime) || "";
  return data;
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
  const urls = [...(preview.imageUrls ?? [])];
  if (foKep && !urls.includes(foKep)) urls.unshift(foKep);
  preview.imageUrl = urls[0] || foKep || preview.imageUrl || "";
  preview.imageUrls = urls.length ? urls : preview.imageUrl ? [preview.imageUrl] : [];
  preview.photoCount = preview.imageUrls.length;
  const form = cellsToFormData(sanitized);
  const stats = listingStatsFromForm(form, row);
  preview.views = stats.views;
  return {
    ...row,
    ...stats,
    hirdetes_cime,
    preview,
  };
}

async function replaceCells(listingId, cells) {
  const existing = await loadCells(listingId);
  const merged = mergeProtectedCells(cells, existing);
  const { error: delErr } = await sb().from("listing_cells").delete().eq("listing_id", listingId);
  if (delErr) throw delErr;
  if (!merged.length) return;
  const rows = merged.map((cell) => ({
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
  const form = cellsToFormData(cells);
  const stats = listingStatsFromForm(form, listing);
  return {
    ...listing,
    ...stats,
    hirdetes_cime,
    cells,
    form,
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

export async function updateListingPhotoUrls(listingId, urls) {
  const list = [...new Set((urls ?? []).map((url) => String(url ?? "").trim()).filter(Boolean))];
  if (!list.length) return null;
  const updated = await updateListingFoKep(listingId, list[0]);
  if (!updated) return null;
  const id = Number(listingId);
  await sb().from("listing_cells").delete().eq("listing_id", id).eq("field_key", "fotok");
  const { error } = await sb().from("listing_cells").insert({
    listing_id: id,
    field_key: "fotok",
    label: "Fotók",
    value: list.join("\n"),
    step: 4,
  });
  if (error) throw error;
  return getListing(id);
}

export async function upsertListingCell(listingId, fieldKey, label, value, step = 9) {
  const id = Number(listingId);
  if (!Number.isFinite(id) || id <= 0) return null;
  await sb().from("listing_cells").delete().eq("listing_id", id).eq("field_key", fieldKey);
  const { error } = await sb().from("listing_cells").insert({
    listing_id: id,
    field_key: fieldKey,
    label,
    value: String(value ?? ""),
    step,
  });
  if (error) throw error;
  return getListing(id);
}

export async function recordListingView(listingId, source = "web") {
  const listing = await getListing(listingId);
  if (!listing) return null;
  const key = source === "app" ? "views_app" : "views_web";
  const label = key === "views_app" ? "App megtekintés" : "Web megtekintés";
  const next = (Number(listing.form?.[key]) || 0) + 1;
  return upsertListingCell(listingId, key, label, String(next), 9);
}

export async function listMyListings({ userId, limit = 200 } = {}) {
  const uid = Number(userId);
  const rows = await listListingsWithPreview({ limit });
  if (!Number.isFinite(uid) || uid <= 0) return rows;
  return rows.filter((row) => !row.user_id || Number(row.user_id) === uid);
}

export async function updateListingStatus(listingId, status, userId = null) {
  const listing = await getListing(listingId);
  if (!listing) return null;
  const next = normalizeListingStatus(status);
  const { error } = await sb()
    .from("listings")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", listingId);
  if (error) throw error;
  const owner = ownerCell(userId);
  if (owner && !listing.form?.owner_user_id) {
    await upsertListingCell(listingId, owner.field_key, owner.label, owner.value, owner.step);
  }
  return getListing(listingId);
}

export async function saveListing(formData, listingId = null, { status = null, userId = null } = {}) {
  const clean = sanitizeFormDataForSave(formData);
  const cells = formDataToCells(clean);
  const owner = ownerCell(userId);
  const listingStatus = normalizeListingStatus(status ?? clean.status);

  if (listingId) {
    const { data: existing } = await sb().from("listings").select("id").eq("id", listingId).maybeSingle();
    if (!existing) return null;
    const existingCells = await loadCells(listingId);
    if (owner && !existingCells.some((cell) => cell.field_key === "owner_user_id")) {
      cells.push(owner);
    }
    await upsertListingMeta(listingId, clean, listingStatus);
    await replaceCells(listingId, cells);
    return getListing(listingId);
  }

  if (owner) cells.push(owner);
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
