import { createGzip, createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import { getSupabase, isSupabaseBackend } from "./supabase/client.mjs";
import { getListing, listListings } from "./db-store.mjs";
import { resolveListingVertical } from "./listing-vertical.mjs";
import { listWebUsersForAdmin } from "./web-users-store.mjs";

const KEEP_DAYS = 30;

async function emailByUserIdMap() {
  const users = await listWebUsersForAdmin();
  const byId = new Map();
  for (const user of users) {
    const id = Number(user.id);
    if (Number.isFinite(id) && id > 0) byId.set(id, String(user.email || "").trim());
  }
  return byId;
}

async function userIdForEmail(email) {
  const want = String(email || "").trim().toLowerCase();
  if (!want) return null;
  const users = await listWebUsersForAdmin();
  const hit = users.find((user) => String(user.email || "").trim().toLowerCase() === want);
  const id = Number(hit?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function backupRoot() {
  const fromEnv = String(process.env.BYMY_ADMIN_BACKUP_DIR || "").trim();
  if (fromEnv) return fromEnv;
  if (existsSync("/root/backups")) return "/root/backups/bymy-admin";
  return join(homedir(), ".autosweb", "backups", "bymy-admin");
}

function ensureDir() {
  const dir = backupRoot();
  mkdirSync(dir, { recursive: true });
  return dir;
}

function stampNow() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function cellMap(cells = []) {
  const out = {};
  for (const cell of cells) out[String(cell.field_key || "")] = String(cell.value ?? "");
  return out;
}

function listingCategoryMeta(row) {
  const form = row.form || row.preview?.filter || {};
  const cells = cellMap(row.cells || []);
  const vertical = resolveListingVertical(row) || String(form.hirdetes_vertical || cells.hirdetes_vertical || "").toLowerCase();
  const subtype = String(
    form.hirdetes_alkategoria || cells.hirdetes_alkategoria || row.subtype || ""
  )
    .trim()
    .toLowerCase();
  const ownerUserId = Number(row.owner_user_id || form.owner_user_id || cells.owner_user_id || 0) || null;
  return { vertical, subtype, ownerUserId };
}

function matchesCategory(meta, category) {
  const cat = String(category || "all").trim().toLowerCase();
  if (!cat || cat === "all") return true;
  if (cat === "szemelyauto") {
    return meta.vertical === "auto" && (!meta.subtype || meta.subtype === "szemelyauto");
  }
  if (cat === "leasing") {
    return meta.vertical === "auto" && meta.subtype === "leasing";
  }
  if (cat === "teherauto" || cat === "teher") {
    return meta.vertical === "teher" || meta.subtype === "teherauto" || meta.subtype === "kisteher";
  }
  if (cat === "ingatlan") {
    return meta.vertical === "ingatlan";
  }
  return meta.subtype === cat || meta.vertical === cat;
}

function snapshotPath(id) {
  const safe = String(id || "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) throw Object.assign(new Error("Érvénytelen mentés azonosító."), { status: 400 });
  return join(ensureDir(), `listings-${safe}.json.gz`);
}

async function readGzipJson(filePath) {
  const chunks = [];
  await pipeline(
    createReadStream(filePath),
    createGunzip(),
    new Writable({
      write(chunk, _enc, cb) {
        chunks.push(chunk);
        cb();
      },
    })
  );
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function writeGzipJson(filePath, data) {
  const body = Buffer.from(JSON.stringify(data), "utf8");
  await pipeline(Readable.from([body]), createGzip(), createWriteStream(filePath));
}

function pruneOldSnapshots(dir) {
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  for (const name of readdirSync(dir)) {
    if (!/^listings-.*\.json\.gz$/.test(name)) continue;
    const full = join(dir, name);
    try {
      if (statSync(full).mtimeMs < cutoff) unlinkSync(full);
    } catch {
    }
  }
}

export function listAdminBackups() {
  const dir = ensureDir();
  pruneOldSnapshots(dir);
  const items = [];
  for (const name of readdirSync(dir)) {
    const m = name.match(/^listings-(.+)\.json\.gz$/);
    if (!m) continue;
    const full = join(dir, name);
    const st = statSync(full);
    items.push({
      id: m[1],
      fileName: name,
      sizeBytes: st.size,
      mtime: st.mtime.toISOString(),
      path: full,
    });
  }
  items.sort((a, b) => String(b.mtime).localeCompare(String(a.mtime)));
  return { dir, keepDays: KEEP_DAYS, backups: items };
}

export async function createAdminBackup({ createdBy = null, note = "" } = {}) {
  const listings = await listListings({ limit: 2000, status: null });
  const emails = await emailByUserIdMap();
  const packed = [];
  for (const row of listings) {
    const full = await getListing(row.id, { mode: "full" });
    if (!full) continue;
    const cells = full.cells || [];
    const meta = listingCategoryMeta({ ...full, cells });
    packed.push({
      id: Number(full.id),
      hirdetes_cime: full.hirdetes_cime || "",
      forras_url: full.forras_url || "",
      hasznaltauto_hirdetes_id: full.hasznaltauto_hirdetes_id || "",
      fo_kep: full.fo_kep || "",
      status: full.status || "mentett",
      created_at: full.created_at || null,
      updated_at: full.updated_at || null,
      vertical: meta.vertical,
      subtype: meta.subtype,
      ownerUserId: meta.ownerUserId,
      ownerEmail: (meta.ownerUserId && emails.get(meta.ownerUserId)) || "",
      cells: cells.map((c) => ({
        field_key: c.field_key,
        label: c.label || c.field_key,
        value: String(c.value ?? ""),
        step: Number(c.step) || 1,
      })),
    });
  }

  const id = stampNow();
  const payload = {
    version: 1,
    id,
    createdAt: new Date().toISOString(),
    createdBy: createdBy || null,
    note: String(note || "").slice(0, 200),
    counts: {
      listings: packed.length,
      cells: packed.reduce((n, row) => n + row.cells.length, 0),
    },
    listings: packed,
  };
  const filePath = snapshotPath(id);
  await writeGzipJson(filePath, payload);
  pruneOldSnapshots(ensureDir());
  const st = statSync(filePath);
  return {
    ok: true,
    backup: {
      id,
      fileName: `listings-${id}.json.gz`,
      sizeBytes: st.size,
      mtime: st.mtime.toISOString(),
      counts: payload.counts,
    },
  };
}

function filterListings(listings, { category = "all", userId = null, userEmail = null, listingId = null } = {}) {
  let rows = Array.isArray(listings) ? listings : [];
  const lid = listingId != null && String(listingId).trim() !== "" ? Number(listingId) : null;
  if (Number.isFinite(lid) && lid > 0) {
    rows = rows.filter((row) => Number(row.id) === lid);
  }
  const emailWant = String(userEmail || "").trim().toLowerCase();
  if (emailWant) {
    rows = rows.filter((row) => {
      const rowEmail = String(row.ownerEmail || "").trim().toLowerCase();
      if (rowEmail && rowEmail === emailWant) return true;
      const uid = userId != null && String(userId).trim() !== "" ? Number(userId) : null;
      return Number.isFinite(uid) && uid > 0 && Number(row.ownerUserId) === uid;
    });
  } else {
    const uid = userId != null && String(userId).trim() !== "" ? Number(userId) : null;
    if (Number.isFinite(uid) && uid > 0) {
      rows = rows.filter((row) => Number(row.ownerUserId) === uid);
    }
  }
  if (category && category !== "all") {
    rows = rows.filter((row) =>
      matchesCategory(
        {
          vertical: row.vertical,
          subtype: row.subtype,
          ownerUserId: row.ownerUserId,
        },
        category
      )
    );
  }
  return rows;
}

export async function previewAdminBackup(id, filters = {}) {
  const data = await readGzipJson(snapshotPath(id));
  const emailWant = String(filters.userEmail || "").trim();
  let resolvedUserId = filters.userId ?? null;
  if (emailWant) {
    resolvedUserId = await userIdForEmail(emailWant);
    if (!resolvedUserId) {
      resolvedUserId = null;
    }
  }
  const matched = filterListings(data.listings || [], {
    ...filters,
    userId: resolvedUserId,
    userEmail: emailWant || null,
  });
  const emails = await emailByUserIdMap();
  return {
    id: data.id,
    createdAt: data.createdAt,
    createdBy: data.createdBy,
    note: data.note || "",
    counts: data.counts,
    filter: {
      category: filters.category || "all",
      userEmail: emailWant || null,
      listingId: filters.listingId || null,
    },
    matchCount: matched.length,
    listings: matched.map((row) => ({
      id: row.id,
      title: row.hirdetes_cime || `Hirdetés #${row.id}`,
      status: row.status,
      vertical: row.vertical,
      subtype: row.subtype,
      ownerUserId: row.ownerUserId,
      ownerEmail:
        row.ownerEmail ||
        (row.ownerUserId && emails.get(Number(row.ownerUserId))) ||
        "",
      foKep: row.fo_kep || "",
      cellCount: row.cells?.length || 0,
      updatedAt: row.updated_at,
    })),
  };
}

async function restoreOneListing(row, { forceStatus = null } = {}) {
  if (!isSupabaseBackend()) {
    throw Object.assign(new Error("Visszaállítás csak Supabase módban érhető el."), { status: 503 });
  }
  const sb = getSupabase();
  const id = Number(row.id);
  if (!Number.isFinite(id) || id <= 0) {
    throw Object.assign(new Error("Érvénytelen hirdetés ID a mentésben."), { status: 400 });
  }

  const status =
    forceStatus === "feladott" || forceStatus === "mentett" || forceStatus === "inaktiv"
      ? forceStatus
      : row.status || "mentett";

  const { error: upErr } = await sb.from("listings").upsert(
    {
      id,
      hirdetes_cime: row.hirdetes_cime || "",
      forras_url: row.forras_url || "",
      hasznaltauto_hirdetes_id: row.hasznaltauto_hirdetes_id || "",
      fo_kep: row.fo_kep || "",
      status,
      created_at: row.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (upErr) throw upErr;

  const { error: delErr } = await sb.from("listing_cells").delete().eq("listing_id", id);
  if (delErr) throw delErr;

  const cells = Array.isArray(row.cells) ? row.cells : [];
  if (cells.length) {
    const { error: insErr } = await sb.from("listing_cells").insert(
      cells.map((c) => ({
        listing_id: id,
        field_key: c.field_key,
        label: c.label || c.field_key,
        value: String(c.value ?? ""),
        step: Number(c.step) || 1,
      }))
    );
    if (insErr) throw insErr;
  }

  return { id, status };
}

export async function restoreAdminBackup(id, filters = {}) {
  const data = await readGzipJson(snapshotPath(id));
  const explicitIds = Array.isArray(filters.listingIds)
    ? filters.listingIds.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  let matched;
  if (explicitIds.length) {
    const want = new Set(explicitIds);
    matched = (data.listings || []).filter((row) => want.has(Number(row.id)));
  } else {
    const emailWant = String(filters.userEmail || "").trim();
    let resolvedUserId = filters.userId ?? null;
    if (emailWant) resolvedUserId = await userIdForEmail(emailWant);
    matched = filterListings(data.listings || [], {
      ...filters,
      userId: resolvedUserId,
      userEmail: emailWant || null,
    });
  }
  if (!matched.length) {
    throw Object.assign(new Error("Nincs visszatöltendő hirdetés a szűrőkkel."), { status: 400 });
  }

  const forceStatus = filters.forceStatus || null;
  const restored = [];
  for (const row of matched) {
    restored.push(await restoreOneListing(row, { forceStatus }));
  }

  const byStatus = restored.reduce((acc, row) => {
    const key = row.status || "ismeretlen";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    ok: true,
    restoredCount: restored.length,
    restoredIds: restored.map((row) => row.id),
    statuses: byStatus,
    backupId: data.id,
  };
}

export const ADMIN_BACKUP_CATEGORIES = [
  { id: "all", label: "Összes" },
  { id: "szemelyauto", label: "Személyautók" },
  { id: "leasing", label: "Leasing" },
  { id: "teherauto", label: "Teherautók" },
  { id: "ingatlan", label: "Ingatlanok" },
];
