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
import { buildListingDetailView } from "../listing-detail-view.mjs";
import { attachSellerProfile } from "../listing-detail-seller.mjs";
import { applyImporterProfileToListingForm } from "../listing-address-from-profile.mjs";
import { getUserById } from "../web-users-store.mjs";
import { getSupabase, supabaseBackendLabel } from "./client.mjs";
import { normalizeListingStatus } from "../listing-status.mjs";
import { sanitizeListingPostalCode } from "../postal-codes.mjs";
import {
  listingStatsFromForm,
  mergeProtectedCells,
  IMPORT_REPLACE_PRESERVE_KEYS,
  ownerCell,
} from "../listing-meta.mjs";
import {
  normalizeFormVertical,
  resolveListingVertical,
  resolveVerticalFromFields,
} from "../listing-vertical.mjs";
import { displayImageUrl, upgradeHaImageUrl } from "../listing-image.mjs";
import {
  clearSharedFeedCache,
  readSharedFeedCache,
  writeSharedFeedCache,
} from "../listings-feed-shared-cache.mjs";
import {
  countListingFeed,
  deleteListingFeedRow,
  listListingFeed,
  listingFeedTableExists,
  upsertListingFeedRow,
} from "../listing-feed.mjs";

const CHROME_FIELD_KEYS = new Set([
  "leiras",
  "hirdetes_cime",
  "gyartmany",
  "modell",
  "tipus",
  "telepules",
  "megye",
  "megtekintesi_cim",
]);

function sanitizeListingCell(cell) {
  if (!cell) return cell;
  const key = String(cell.field_key ?? "");
  if (key === "leiras" || key === "hirdetes_cime") {
    return { ...cell, value: sanitizeListingPlainText(cell.value) };
  }
  if (key === "iranyitoszam") {
    return { ...cell, value: sanitizeListingPostalCode(cell.value) };
  }
  if (CHROME_FIELD_KEYS.has(key)) {
    return { ...cell, value: sanitizeListingFieldValue(cell.value) };
  }
  return cell;
}

function sanitizeFormDataForSave(formData = {}) {
  const data = normalizeFormVertical({ ...formData });
  data.leiras = sanitizeListingPlainText(data.leiras) || "";
  data.gyartmany = sanitizeListingFieldValue(data.gyartmany);
  data.modell = sanitizeListingFieldValue(data.modell);
  data.tipus = sanitizeListingFieldValue(data.tipus);
  data.telepules = sanitizeListingFieldValue(data.telepules);
  data.megye = sanitizeListingFieldValue(data.megye);
  data.megtekintesi_cim = sanitizeListingFieldValue(data.megtekintesi_cim);
  data.iranyitoszam = sanitizeListingPostalCode(data.iranyitoszam);
  const vehicleTitle = composeVehicleTitle(data);
  data.hirdetes_cime = vehicleTitle
    ? `Eladó ${vehicleTitle}`
    : sanitizeListingPlainText(data.hirdetes_cime) || "";
  return data;
}

function sb() {
  return getSupabase();
}

/** PostgREST alapból max ~1000 sort ad vissza; lista-preview nélkül ez levágja az árat/km-t. */
const CELL_PAGE_SIZE = 1000;
/** `.in(listing_id, …)` URL-hossz miatt kisebb csomagokban. */
const LISTING_ID_CHUNK = 80;

/** Feed / mozaik: csak ezek a cellák kellenek (ne a teljes EAV). */
const FEED_CELL_KEYS = [
  "owner_user_id",
  "hirdetes_vertical",
  "hirdetes_alkategoria",
  "gyartmany",
  "modell",
  "tipus",
  "kivitel",
  "uzemanyag",
  "gyartasi_ev",
  "gyartasi_honap",
  "hengerurtartalom",
  "teljesitmeny_kw",
  "teljesitmeny_le",
  "km",
  "vetelar",
  "akcios_ar",
  "sebessegvalto",
  "hajtas",
  "allapot",
  "ingatlan_allapot",
  "ajtok",
  "ajtok_szama",
  "szemelyek",
  "szin",
  "klima",
  "teto",
  "csomagtarto",
  "megye",
  "iranyitoszam",
  "telepules",
  "okmany_jelleg",
  "tulajdonosok_szama",
  "fogyasztas_varosi",
  "fogyasztas_orszaguti",
  "fogyasztas_kombinalt",
  "sajat_tomeg",
  "ossztomeg",
  "nyomatek_nm",
  "hatotav",
  "akkumulator_kwh",
  "tolto_csatlakozas",
  "nem_dohanyzo",
  "holgy_tulajdonos",
  "alkudhato",
  "csere",
  "ulesek_szama",
  "ingatlan_uzletag",
  "ingatlan_lakas_tipus",
  "ingatlan_kora",
  "min_berleti_ido",
  "butorozott",
  "kilatas",
  "tajolas",
  "futes",
  "parkolas",
  "komfort",
  "tetoter",
  "furdo_wc",
  "emelet",
  "belmagassag",
  "koltozheto",
  "alapterulet",
  "szobaszam",
  "lift",
  "erkely",
  "szigeteles",
  "energiahatekonys",
  "akadalymentesitett",
  "legkondicionalo",
  "kertkapcsolatos",
  "panelprogram",
  "gepesitett",
  "kisallat_megengedett",
  "dohanyzas_megengedett",
  "leiras",
  // fotok szándékosan nincs: a feed fo_kep-et használ (nagy URL-lista nélkül)
  "felszereltseg",
  "promo_kiemelt",
  "promo_top_ajanlat",
  "villamtoltes",
  "zold_rendszam",
  "views_web",
  "views_app",
];

/** Saját hirdetések lista: feed mezők + fotók/sablon, de leiras/felszereltseg nélkül (gyorsabb). */
const MY_LISTINGS_CELL_KEYS = [
  ...FEED_CELL_KEYS.filter((key) => key !== "leiras" && key !== "felszereltseg"),
  "fotok",
  "photo_overlay_template_id",
  "photo_overlay_base_url",
  "cim",
  "utca",
  "lakoterulet",
  "ingatlan_tipus",
];

/** Nyilvános related / kereskedő-készlet: vékony feed, nagy szövegmezők nélkül. */
export const RELATED_LISTINGS_CELL_KEYS = FEED_CELL_KEYS.filter(
  (key) => key !== "leiras" && key !== "felszereltseg"
);

let listingsVerticalColumn = null;

async function listingsHaveVerticalColumn() {
  if (listingsVerticalColumn != null) return listingsVerticalColumn;
  const { error } = await sb().from("listings").select("vertical").limit(1);
  listingsVerticalColumn = !error;
  return listingsVerticalColumn;
}

async function loadCells(listingId) {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb()
      .from("listing_cells")
      .select("field_key, label, value, step")
      .eq("listing_id", listingId)
      .order("step")
      .order("label")
      .range(from, from + CELL_PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < CELL_PAGE_SIZE) break;
    from += CELL_PAGE_SIZE;
  }
  return rows.map((cell) => sanitizeListingCell(cell));
}

async function loadCellsByListingIds(ids, { fieldKeys = null } = {}) {
  if (!ids.length) return new Map();
  const uniqueIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
  const keys = Array.isArray(fieldKeys) && fieldKeys.length ? fieldKeys : null;
  const map = new Map();
  for (let i = 0; i < uniqueIds.length; i += LISTING_ID_CHUNK) {
    const chunk = uniqueIds.slice(i, i + LISTING_ID_CHUNK);
    let from = 0;
    for (;;) {
      let q = sb()
        .from("listing_cells")
        .select("listing_id, field_key, label, value, step")
        .in("listing_id", chunk)
        .order("listing_id")
        .order("field_key")
        .range(from, from + CELL_PAGE_SIZE - 1);
      if (keys) q = q.in("field_key", keys);
      const { data, error } = await q;
      if (error) throw error;
      const page = data ?? [];
      for (const row of page) {
        const listingId = Number(row.listing_id);
        if (!map.has(listingId)) map.set(listingId, []);
        map.get(listingId).push(row);
      }
      if (page.length < CELL_PAGE_SIZE) break;
      from += CELL_PAGE_SIZE;
    }
  }
  return map;
}

async function loadVerticalFieldsByListingIds(ids) {
  const map = new Map();
  if (!ids.length) return map;
  const uniqueIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
  for (let i = 0; i < uniqueIds.length; i += LISTING_ID_CHUNK) {
    const chunk = uniqueIds.slice(i, i + LISTING_ID_CHUNK);
    const { data, error } = await sb()
      .from("listing_cells")
      .select("listing_id, field_key, value")
      .in("listing_id", chunk)
      .in("field_key", ["hirdetes_vertical", "hirdetes_alkategoria"]);
    if (error) throw error;
    for (const row of data ?? []) {
      const listingId = Number(row.listing_id);
      if (!map.has(listingId)) map.set(listingId, {});
      map.get(listingId)[row.field_key] = row.value;
    }
  }
  return map;
}

async function fetchListingRows({ limit = 50, offset = 0, status = null, vertical = null } = {}) {
  const wantVertical = String(vertical ?? "")
    .trim()
    .toLowerCase();
  const useVertical =
    (wantVertical === "auto" || wantVertical === "teher" || wantVertical === "ingatlan") &&
    (await listingsHaveVerticalColumn());
  const max = Math.min(Math.max(Number(limit) || 20, 1), 500);
  const off = Math.max(0, Math.floor(Number(offset) || 0));

  const selectCols = useVertical
    ? "id, hirdetes_cime, forras_url, hasznaltauto_hirdetes_id, fo_kep, status, created_at, updated_at, vertical"
    : "id, hirdetes_cime, forras_url, hasznaltauto_hirdetes_id, fo_kep, status, created_at, updated_at";

  let q = sb()
    .from("listings")
    .select(selectCols)
    .order("updated_at", { ascending: false })
    .range(off, off + max - 1);
  if (status) q = q.eq("status", normalizeListingStatus(status));
  if (useVertical) q = q.eq("vertical", wantVertical);
  const { data, error } = await q;
  if (error) {
    if (useVertical && /vertical/i.test(String(error.message || ""))) {
      listingsVerticalColumn = false;
      return fetchListingRows({ limit, offset, status, vertical: null });
    }
    throw error;
  }
  return data ?? [];
}

function listingRowWithPreview(row, cells) {
  const sanitized = cells.map((cell) => sanitizeListingCell(cell));
  const hirdetes_cime =
    sanitizeListingPlainText(row.hirdetes_cime) || `Hirdetés #${row.id}`;
  const preview = buildPreviewFromCells(sanitized, { ...row, hirdetes_cime });
  const rawFo = String(row.fo_kep ?? "").trim();
  const foKep = upgradeHaImageUrl(rawFo) || rawFo;
  const urls = [...(preview.imageUrls ?? [])]
    .map((url) => upgradeHaImageUrl(url) || url)
    .filter(Boolean);
  if (foKep && !urls.includes(foKep)) urls.unshift(foKep);
  const displayUrls = urls
    .map((url) => displayImageUrl(url))
    .filter(Boolean);
  preview.imageUrl = displayUrls[0] || "";
  preview.imageUrls = displayUrls;
  preview.photoCount = displayUrls.length;
  const form = cellsToFormData(sanitized);
  const stats = listingStatsFromForm(form, row);
  preview.views = stats.views;
  preview.promo = {
    kiemelt: String(form.promo_kiemelt ?? "").trim() === "1",
    top: String(form.promo_top_ajanlat ?? "").trim() === "1",
  };
  // Kliensnek csak megjeleníthető fo_kep (halott /uploads Vercelen → ne törött img)
  const displayFo = displayImageUrl(foKep) || displayUrls[0] || "";
  return {
    ...row,
    fo_kep: displayFo || (/^https?:\/\//i.test(foKep) ? foKep : ""),
    ...stats,
    hirdetes_cime,
    preview,
    form,
  };
}

async function replaceCells(listingId, cells, { replaceImport = false } = {}) {
  const existing = await loadCells(listingId);
  const merged = mergeProtectedCells(
    cells,
    existing,
    replaceImport
      ? { preserveKeys: IMPORT_REPLACE_PRESERVE_KEYS, dropEmptyFotok: true }
      : undefined
  );
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

async function upsertListingMeta(id, formData, status, { replaceImport = false } = {}) {
  const { data: existing } = await sb().from("listings").select("fo_kep").eq("id", id).maybeSingle();
  const fromForm = String(formData.fo_kep ?? "").trim();
  const nextFoKep = replaceImport ? fromForm : fromForm || existing?.fo_kep || "";
  const vertical = resolveVerticalFromFields(formData.hirdetes_vertical, formData.hirdetes_alkategoria);
  const patch = {
    hirdetes_cime: formData.hirdetes_cime ?? "",
    forras_url: formData.forras_url ?? "",
    hasznaltauto_hirdetes_id: formData.hasznaltauto_hirdetes_id ?? "",
    fo_kep: nextFoKep,
    status: normalizeListingStatus(status ?? formData.status),
    updated_at: new Date().toISOString(),
  };
  if (await listingsHaveVerticalColumn()) patch.vertical = vertical;
  const { error } = await sb().from("listings").update(patch).eq("id", id);
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
  const rows = await fetchListingRows({ limit, status });
  const cellsById = await loadCellsByListingIds(rows.map((r) => r.id));
  return rows.map((row) => ({
    ...row,
    cell_count: (cellsById.get(Number(row.id)) ?? []).length,
  }));
}

/** Publikus feed cache — 300 párhuzamos user ugyanazt a listát kéri. */
const FEED_CACHE_TTL_MS = Math.max(5_000, Number(process.env.LISTINGS_FEED_CACHE_TTL_MS) || 60_000);
const FEED_COUNT_TTL_MS = Math.max(5_000, Number(process.env.LISTINGS_FEED_COUNT_TTL_MS) || FEED_CACHE_TTL_MS);
const feedCache = new Map();
const feedInflight = new Map();
const feedCountCache = new Map();
const feedCountInflight = new Map();
/** Menü számlálók — listing_feed count (gyors), cellás út csak fallback. */
let navCountsCache = { at: 0, value: null, ttlMs: 60_000 };

function feedCacheKey({ limit, offset, status, vertical }) {
  return `${normalizeListingStatus(status || "")}|${String(vertical || "").trim().toLowerCase()}|${Number(limit) || 20}|${Number(offset) || 0}`;
}

function feedCountKey({ status, vertical }) {
  return `count|${normalizeListingStatus(status || "")}|${String(vertical || "").trim().toLowerCase()}`;
}

function navCountsKey(status) {
  return `nav|${normalizeListingStatus(status || "feladott")}`;
}

export function invalidateListingsFeedCache() {
  feedCache.clear();
  feedInflight.clear();
  feedCountCache.clear();
  feedCountInflight.clear();
  clearSharedFeedCache();
}

export function invalidateNavCountsCache() {
  navCountsCache = { at: 0, value: null, ttlMs: 60_000 };
  invalidateListingsFeedCache();
}

async function refreshListingFeedById(listingId) {
  const id = Number(listingId);
  if (!Number.isFinite(id) || id <= 0) return;
  try {
    if (!(await listingFeedTableExists(sb()))) return;
    const { data: listing, error } = await sb()
      .from("listings")
      .select(
        "id, hirdetes_cime, forras_url, hasznaltauto_hirdetes_id, fo_kep, status, created_at, updated_at, vertical"
      )
      .eq("id", id)
      .maybeSingle();
    if (error && /vertical/i.test(String(error.message || ""))) {
      const retry = await sb()
        .from("listings")
        .select(
          "id, hirdetes_cime, forras_url, hasznaltauto_hirdetes_id, fo_kep, status, created_at, updated_at"
        )
        .eq("id", id)
        .maybeSingle();
      if (retry.error) throw retry.error;
      if (!retry.data) {
        await deleteListingFeedRow(sb(), id);
        return;
      }
      const cellsById = await loadCellsByListingIds([id], { fieldKeys: FEED_CELL_KEYS });
      const cells = cellsById.get(id) ?? [];
      await upsertListingFeedRow(sb(), listingRowWithPreview(retry.data, cells));
      return;
    }
    if (error) throw error;
    if (!listing) {
      await deleteListingFeedRow(sb(), id);
      return;
    }
    const cellsById = await loadCellsByListingIds([id], { fieldKeys: FEED_CELL_KEYS });
    const cells = cellsById.get(id) ?? [];
    await upsertListingFeedRow(sb(), listingRowWithPreview(listing, cells));
  } catch (error) {
    console.warn("[listing_feed] refresh failed", id, error?.message || error);
  }
}

export async function backfillListingFeed({ limit = 5000 } = {}) {
  if (!(await listingFeedTableExists(sb()))) {
    return { ok: false, error: "listing_feed tábla nincs", upserted: 0 };
  }
  const max = Math.min(Math.max(Number(limit) || 5000, 1), 20000);
  const { data: rows, error } = await sb()
    .from("listings")
    .select("id")
    .order("id", { ascending: true })
    .limit(max);
  if (error) throw error;
  let upserted = 0;
  for (const row of rows ?? []) {
    await refreshListingFeedById(row.id);
    upserted += 1;
  }
  invalidateListingsFeedCache();
  return { ok: true, upserted };
}

async function listListingsWithPreviewUncached({
  limit = 50,
  offset = 0,
  status = null,
  vertical = null,
} = {}) {
  const off = Math.max(0, Math.floor(Number(offset) || 0));
  const max = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const fromFeed = await listListingFeed(sb(), { limit: max, offset: off, status, vertical });
  if (fromFeed) {
    if (fromFeed.length === 0 && off === 0) {
      // Üres feed + vannak listings → még nincs backfill, régi út.
      let q = sb().from("listings").select("*", { count: "exact", head: true });
      if (status) q = q.eq("status", normalizeListingStatus(status));
      const { count } = await q;
      if ((count || 0) > 0) {
        /* fall through to legacy path */
      } else {
        return [];
      }
    } else {
      // listing_feed payload már tartalmazza a csempehez kellő mezőket
      return fromFeed;
    }
  }

  const want = String(vertical ?? "")
    .trim()
    .toLowerCase();
  const needFilter = want === "teher" || want === "auto" || want === "ingatlan";
  const hasVerticalCol = needFilter && (await listingsHaveVerticalColumn());

  let selectedRows;
  if (hasVerticalCol) {
    selectedRows = await fetchListingRows({ limit: max, offset: off, status, vertical: want });
  } else if (needFilter) {
    // Régi út: sok ID + könnyű vertical cellák, teljes EAV csak a végső limithoz.
    const fetchLimit = Math.min(Math.max((off + max) * 40, 400), 5000);
    const rows = await fetchListingRows({ limit: fetchLimit, status });
    if (!rows.length) return [];
    const verticalById = await loadVerticalFieldsByListingIds(rows.map((r) => r.id));
    selectedRows = rows
      .filter((row) => {
        const fields = verticalById.get(Number(row.id)) || {};
        return resolveVerticalFromFields(fields.hirdetes_vertical, fields.hirdetes_alkategoria) === want;
      })
      .slice(off, off + max);
  } else {
    selectedRows = await fetchListingRows({ limit: max, offset: off, status });
  }
  if (!selectedRows.length) return [];

  const cellsById = await loadCellsByListingIds(selectedRows.map((r) => r.id), {
    fieldKeys: FEED_CELL_KEYS,
  });
  return selectedRows.map((row) => {
    const cells = (cellsById.get(Number(row.id)) ?? []).map((cell) => sanitizeListingCell(cell));
    return listingRowWithPreview(row, cells);
  });
}

export async function listListingsWithPreview({
  limit = 50,
  offset = 0,
  status = null,
  vertical = null,
} = {}) {
  const key = feedCacheKey({ limit, offset, status, vertical });
  const now = Date.now();
  const hit = feedCache.get(key);
  if (hit && now - hit.at < FEED_CACHE_TTL_MS) {
    return hit.value;
  }
  const shared = readSharedFeedCache(key, FEED_CACHE_TTL_MS);
  if (Array.isArray(shared)) {
    feedCache.set(key, { at: now, value: shared });
    return shared;
  }
  const pending = feedInflight.get(key);
  if (pending) return pending;

  const task = listListingsWithPreviewUncached({ limit, offset, status, vertical })
    .then((value) => {
      feedCache.set(key, { at: Date.now(), value });
      writeSharedFeedCache(key, value);
      feedInflight.delete(key);
      return value;
    })
    .catch((error) => {
      feedInflight.delete(key);
      throw error;
    });
  feedInflight.set(key, task);
  return task;
}

/** Olcsó publikus total — listing_feed HEAD count + cache (nem cellás nav scan). */
export async function countListingsPublic({ status = null, vertical = null } = {}) {
  const key = feedCountKey({ status, vertical });
  const now = Date.now();
  const hit = feedCountCache.get(key);
  if (hit && now - hit.at < FEED_COUNT_TTL_MS) {
    return hit.value;
  }
  const shared = readSharedFeedCache(key, FEED_COUNT_TTL_MS);
  if (typeof shared === "number" && Number.isFinite(shared)) {
    feedCountCache.set(key, { at: now, value: shared });
    return shared;
  }
  const pending = feedCountInflight.get(key);
  if (pending) return pending;

  const task = (async () => {
    const fromFeed = await countListingFeed(sb(), { status, vertical });
    if (fromFeed != null) return fromFeed;
    const counts = await countNavListingsLegacy({ status: status || "feladott" });
    const v = String(vertical || "")
      .trim()
      .toLowerCase();
    if (v === "auto") return counts.auto;
    if (v === "teher") return counts.teher;
    if (v === "ingatlan") return counts.ingatlan;
    return counts.auto + counts.teher + counts.ingatlan;
  })()
    .then((value) => {
      const n = Math.max(0, Number(value) || 0);
      feedCountCache.set(key, { at: Date.now(), value: n });
      writeSharedFeedCache(key, n);
      feedCountInflight.delete(key);
      return n;
    })
    .catch((error) => {
      feedCountInflight.delete(key);
      throw error;
    });
  feedCountInflight.set(key, task);
  return task;
}

async function countNavListingsFromFeed(wantStatus) {
  if (!(await listingFeedTableExists(sb()))) return null;
  const [auto, teher, ingatlan, total] = await Promise.all([
    countListingFeed(sb(), { status: wantStatus, vertical: "auto" }),
    countListingFeed(sb(), { status: wantStatus, vertical: "teher" }),
    countListingFeed(sb(), { status: wantStatus, vertical: "ingatlan" }),
    countListingFeed(sb(), { status: wantStatus }),
  ]);
  if (auto == null || teher == null || ingatlan == null || total == null) return null;
  const known = auto + teher + ingatlan;
  // Null / ismeretlen vertical → autó (régi resolveVerticalFromFields viselkedés)
  const counts = {
    auto: auto + Math.max(0, total - known),
    teher,
    ingatlan,
  };
  return counts;
}

async function countNavListingsLegacy({ status = "feladott" } = {}) {
  const wantStatus = normalizeListingStatus(status);
  const { data: rows, error } = await sb()
    .from("listings")
    .select("id")
    .eq("status", wantStatus)
    .limit(5000);
  if (error) throw error;
  const ids = (rows ?? []).map((row) => Number(row.id)).filter((id) => id > 0);
  const counts = { auto: 0, teher: 0, ingatlan: 0 };
  if (!ids.length) return counts;

  const vertById = new Map();
  const chunks = [];
  for (let i = 0; i < ids.length; i += LISTING_ID_CHUNK) {
    chunks.push(ids.slice(i, i + LISTING_ID_CHUNK));
  }

  async function loadChunk(chunk) {
    const { data, error: cellErr } = await sb()
      .from("listing_cells")
      .select("listing_id, field_key, value")
      .in("listing_id", chunk)
      .in("field_key", ["hirdetes_vertical", "hirdetes_alkategoria"]);
    if (cellErr) throw cellErr;
    return data ?? [];
  }

  const CONCURRENCY = 8;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const pages = await Promise.all(batch.map(loadChunk));
    for (const page of pages) {
      for (const cell of page) {
        const listingId = Number(cell.listing_id);
        const cur = vertById.get(listingId) || { vertical: "", alkategoria: "" };
        if (cell.field_key === "hirdetes_vertical") cur.vertical = cell.value;
        if (cell.field_key === "hirdetes_alkategoria") cur.alkategoria = cell.value;
        vertById.set(listingId, cur);
      }
    }
  }

  for (const id of ids) {
    const cur = vertById.get(id) || {};
    const resolved = resolveVerticalFromFields(cur.vertical, cur.alkategoria);
    if (resolved === "teher") counts.teher += 1;
    else if (resolved === "ingatlan") counts.ingatlan += 1;
    else counts.auto += 1;
  }
  return counts;
}

export async function countNavListings({ status = "feladott" } = {}) {
  const now = Date.now();
  if (navCountsCache.value && now - navCountsCache.at < navCountsCache.ttlMs) {
    return { ...navCountsCache.value };
  }
  const sharedKey = navCountsKey(status);
  const shared = readSharedFeedCache(sharedKey, 60_000);
  if (
    shared &&
    typeof shared === "object" &&
    Number.isFinite(Number(shared.auto)) &&
    Number.isFinite(Number(shared.teher)) &&
    Number.isFinite(Number(shared.ingatlan))
  ) {
    const counts = {
      auto: Number(shared.auto) || 0,
      teher: Number(shared.teher) || 0,
      ingatlan: Number(shared.ingatlan) || 0,
    };
    navCountsCache = { at: now, value: counts, ttlMs: 60_000 };
    return { ...counts };
  }

  const wantStatus = normalizeListingStatus(status);
  let counts = await countNavListingsFromFeed(wantStatus);
  if (!counts) {
    counts = await countNavListingsLegacy({ status: wantStatus });
  }
  const total = counts.auto + counts.teher + counts.ingatlan;
  navCountsCache = {
    at: now,
    value: { ...counts },
    ttlMs: total === 0 ? 5_000 : 60_000,
  };
  writeSharedFeedCache(sharedKey, counts);
  return counts;
}

export async function getListing(id, { mode = "full" } = {}) {
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
  const detail = await attachSellerProfile(
    buildListingDetailView({ ...listing, hirdetes_cime, form, ...stats }),
    stats.user_id
  );
  const base = {
    ...listing,
    ...stats,
    hirdetes_cime,
    detail,
  };
  if (mode === "detail") return base;
  return {
    ...base,
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
    .limit(1);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? getListing(row.id) : null;
}

export async function findListingByHasznaltautoId(adId) {
  const id = String(adId || "").replace(/\D/g, "");
  if (id.length < 5) return null;
  const { data, error } = await sb()
    .from("listings")
    .select("id")
    .eq("hasznaltauto_hirdetes_id", id)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (data?.[0]) return getListing(data[0].id);
  const { data: byUrl, error: urlErr } = await sb()
    .from("listings")
    .select("id")
    .like("forras_url", `%${id}%`)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (urlErr) throw urlErr;
  if (byUrl?.[0]) return getListing(byUrl[0].id);
  const { data: cells, error: cellErr } = await sb()
    .from("listing_cells")
    .select("listing_id")
    .eq("field_key", "hasznaltauto_hirdetes_id")
    .eq("value", id)
    .limit(1);
  if (cellErr) throw cellErr;
  return cells?.[0]?.listing_id ? getListing(cells[0].listing_id) : null;
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
  const listing = await getListing(id);
  await refreshListingFeedById(id);
  return listing;
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
  const listing = await getListing(id);
  await refreshListingFeedById(id);
  return listing;
}

export async function clearListingPhotos(listingId) {
  const id = Number(listingId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const { error: listErr } = await sb()
    .from("listings")
    .update({ fo_kep: "", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (listErr) throw listErr;
  const { error: cellErr } = await sb()
    .from("listing_cells")
    .delete()
    .eq("listing_id", id)
    .eq("field_key", "fotok");
  if (cellErr) throw cellErr;
  const listing = await getListing(id);
  await refreshListingFeedById(id);
  return listing;
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

/** Csak megadott mezők írása — nem törli a többi cellát (promó / sablon meta). */
export async function patchListingFormFields(listingId, fields = {}) {
  const id = Number(listingId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const listing = await getListing(id);
  if (!listing) return null;
  const entries = Object.entries(fields || {});
  for (const [fieldKey, raw] of entries) {
    const key = String(fieldKey || "").trim();
    if (!key) continue;
    const value = raw == null ? "" : String(raw).trim();
    if (!value) {
      await sb().from("listing_cells").delete().eq("listing_id", id).eq("field_key", key);
      continue;
    }
    const label =
      key === "promo_kiemelt"
        ? "Kiemelés"
        : key === "promo_top_ajanlat"
          ? "TOP ajánlat"
          : key === "photo_overlay_template_id"
            ? "Kép sablon"
            : key === "photo_overlay_base_url"
              ? "Kép sablon alapkép"
              : key;
    await sb().from("listing_cells").delete().eq("listing_id", id).eq("field_key", key);
    const { error } = await sb().from("listing_cells").insert({
      listing_id: id,
      field_key: key,
      label,
      value,
      step: 9,
    });
    if (error) throw error;
  }
  invalidateNavCountsCache();
  const nextListing = await getListing(id);
  await refreshListingFeedById(id);
  return nextListing;
}

export async function recordListingView(listingId, source = "web") {
  const id = Number(listingId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const { data: row, error: listErr } = await sb().from("listings").select("id").eq("id", id).maybeSingle();
  if (listErr) throw listErr;
  if (!row) return null;

  const key = source === "app" ? "views_app" : "views_web";
  const label = key === "views_app" ? "App megtekintés" : "Web megtekintés";
  const { data: viewCells, error: cellErr } = await sb()
    .from("listing_cells")
    .select("field_key, value")
    .eq("listing_id", id)
    .in("field_key", ["views_web", "views_app"]);
  if (cellErr) throw cellErr;

  let views_web = 0;
  let views_app = 0;
  for (const cell of viewCells ?? []) {
    if (cell.field_key === "views_web") views_web = Math.max(0, Number(cell.value) || 0);
    if (cell.field_key === "views_app") views_app = Math.max(0, Number(cell.value) || 0);
  }
  if (key === "views_web") views_web += 1;
  else views_app += 1;

  await sb().from("listing_cells").delete().eq("listing_id", id).eq("field_key", key);
  const { error: insErr } = await sb().from("listing_cells").insert({
    listing_id: id,
    field_key: key,
    label,
    value: String(key === "views_web" ? views_web : views_app),
    step: 9,
  });
  if (insErr) throw insErr;

  return {
    views: views_web + views_app,
    views_web,
    views_app,
  };
}

export async function listMyListings({ userId, limit = 200 } = {}) {
  return listListingsByOwner({ userId, limit, status: null, cellKeys: MY_LISTINGS_CELL_KEYS });
}

/** Nyilvános: egy hirdető összes (vagy feladott) hirdetése. */
export async function listListingsByOwner({
  userId,
  limit = 200,
  excludeId = null,
  status = "feladott",
  cellKeys = RELATED_LISTINGS_CELL_KEYS,
} = {}) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return [];
  const max = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const listingIds = new Set();

  const { data: exact, error: exactErr } = await sb()
    .from("listing_cells")
    .select("listing_id, value")
    .eq("field_key", "owner_user_id")
    .eq("value", String(uid))
    .limit(Math.min(max + 40, 550));
  if (exactErr) throw exactErr;
  for (const cell of exact || []) {
    const id = Number(cell.listing_id);
    if (Number.isFinite(id) && id > 0) listingIds.add(id);
  }

  // Fallback csak ha az exact egyezés üres (régi „ 7 ” / „7.0” értékek).
  if (!listingIds.size) {
    const { data: all, error: allErr } = await sb()
      .from("listing_cells")
      .select("listing_id, value")
      .eq("field_key", "owner_user_id")
      .limit(5000);
    if (allErr) throw allErr;
    for (const cell of all || []) {
      if (Number(String(cell.value ?? "").trim()) !== uid) continue;
      const id = Number(cell.listing_id);
      if (Number.isFinite(id) && id > 0) listingIds.add(id);
    }
  }

  const skip = Number(excludeId);
  let ids = [...listingIds].filter(
    (id) => !(Number.isFinite(skip) && skip > 0 && id === skip)
  );
  if (!ids.length) return [];

  let q = sb()
    .from("listings")
    .select(
      "id, hirdetes_cime, forras_url, hasznaltauto_hirdetes_id, fo_kep, status, created_at, updated_at"
    )
    .in("id", ids)
    .order("updated_at", { ascending: false })
    .limit(max);
  if (status) q = q.eq("status", normalizeListingStatus(status));
  const { data: rows, error: listErr } = await q;
  if (listErr) throw listErr;
  const list = rows ?? [];
  if (!list.length) return [];
  const cellsById = await loadCellsByListingIds(list.map((row) => row.id), {
    fieldKeys: cellKeys,
  });
  return list.map((row) => {
    const cells = (cellsById.get(Number(row.id)) ?? []).map((cell) => sanitizeListingCell(cell));
    return listingRowWithPreview(row, cells);
  });
}

/** Könnyű owner + status — related / seller-contact / rating. */
export async function getListingOwnerMeta(listingId) {
  const id = Number(listingId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const { data: listing, error } = await sb()
    .from("listings")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!listing) return null;
  const { data: cell, error: cellErr } = await sb()
    .from("listing_cells")
    .select("value")
    .eq("listing_id", id)
    .eq("field_key", "owner_user_id")
    .maybeSingle();
  if (cellErr) throw cellErr;
  const ownerId = Number(String(cell?.value ?? "").trim());
  return {
    id: listing.id,
    status: listing.status,
    user_id: Number.isFinite(ownerId) && ownerId > 0 ? ownerId : null,
  };
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
  invalidateNavCountsCache();
  const nextListing = await getListing(listingId);
  await refreshListingFeedById(listingId);
  return nextListing;
}

async function maybeFillOwnerLocationFromProfile(clean, userId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return clean;
  if (String(clean.telepules ?? "").trim()) return clean;
  try {
    const user = await getUserById(uid);
    if (user?.profile) applyImporterProfileToListingForm(clean, user.profile);
  } catch {
  }
  return clean;
}

export async function saveListing(
  formData,
  listingId = null,
  { status = null, userId = null, replaceImport = false } = {}
) {
  let clean = sanitizeFormDataForSave(formData);
  clean = await maybeFillOwnerLocationFromProfile(clean, userId);
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
    await upsertListingMeta(listingId, clean, listingStatus, { replaceImport });
    await replaceCells(listingId, cells, { replaceImport });
    invalidateNavCountsCache();
    const listing = await getListing(listingId);
    await refreshListingFeedById(listingId);
    return listing;
  }

  if (owner) cells.push(owner);
  const vertical = resolveVerticalFromFields(clean.hirdetes_vertical, clean.hirdetes_alkategoria);
  const insertRow = {
    hirdetes_cime: clean.hirdetes_cime ?? "",
    forras_url: clean.forras_url ?? "",
    hasznaltauto_hirdetes_id: clean.hasznaltauto_hirdetes_id ?? "",
    fo_kep: clean.fo_kep ?? formData.fo_kep ?? "",
    status: listingStatus,
  };
  if (await listingsHaveVerticalColumn()) insertRow.vertical = vertical;
  const { data: inserted, error } = await sb()
    .from("listings")
    .insert(insertRow)
    .select("id")
    .single();
  if (error) throw new Error(error.message || error.code || "Mentés sikertelen (adatbázis).");
  await replaceCells(inserted.id, cells);
  invalidateNavCountsCache();
  const listing = await getListing(inserted.id);
  await refreshListingFeedById(inserted.id);
  return listing;
}

export async function deleteListing(id) {
  const { error } = await sb().from("listings").delete().eq("id", id);
  if (error) throw error;
  invalidateNavCountsCache();
  return { ok: true };
}

export async function deleteAllListings() {
  const { count, error: countErr } = await sb()
    .from("listings")
    .select("*", { count: "exact", head: true });
  if (countErr) throw countErr;
  const { error: listErr } = await sb().from("listings").delete().gte("id", 1);
  if (listErr) throw listErr;
  invalidateNavCountsCache();
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
