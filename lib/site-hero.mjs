/**
 * Hero háttérkép — PKW (autó oldal) és LKW (teherautó oldal).
 * Aktív URL kind szerint mindenkinek ugyanaz (GET /api/site-hero?kind=pkw|lkw).
 */
import { randomBytes } from "crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { isSupabaseBackend, getSupabase } from "./supabase/client.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const HERO_PATH = process.env.AUTOSWEB_HERO_PATH || join(DATA_DIR, "site-hero.json");
const BUCKET = "site-hero";
const META_OBJECT = "meta.json";
const MAX_BYTES = 8 * 1024 * 1024;

export const HERO_KINDS = ["pkw", "lkw"];

export const HERO_PRESETS = {
  pkw: [
    { id: "pkw-night", label: "Éjszakai autó", url: "/images/pkw/automax-panel-bg.png" },
    { id: "pkw-photo", label: "Autó fotó", url: "/images/pkw/hub-auto-photo.jpg" },
    { id: "pkw-motor", label: "Autó & motor", url: "/images/pkw/hub-auto-motor.png" },
  ],
  lkw: [
    { id: "lkw-photo", label: "Teherautó fotó", url: "/images/lkw/hub-auto-photo.jpg" },
    { id: "lkw-promo", label: "Autó & teherautó", url: "/images/lkw/hub-auto-motor.png" },
  ],
};

function defaultKindState(kind) {
  const presets = HERO_PRESETS[kind] || [];
  return {
    activeUrl: presets[0]?.url || "",
    uploads: [],
  };
}

function defaultState() {
  return {
    pkw: defaultKindState("pkw"),
    lkw: defaultKindState("lkw"),
  };
}

function normalizeKind(kind) {
  const raw = String(kind ?? "").trim().toLowerCase();
  return HERO_KINDS.includes(raw) ? raw : "pkw";
}

function heroUploadDir(kind) {
  const k = normalizeKind(kind);
  if (process.env.AUTOSWEB_HERO_UPLOADS_PATH) {
    return join(process.env.AUTOSWEB_HERO_UPLOADS_PATH, k);
  }
  return join(homedir(), ".autosweb", "uploads", "hero", k);
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function ensureUploadDir(kind) {
  const uploadDir = heroUploadDir(kind);
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
  return uploadDir;
}

function normalizeUploads(raw) {
  return Array.isArray(raw)
    ? raw
        .map((item) => ({
          id: String(item?.id ?? "").slice(0, 64),
          url: String(item?.url ?? "").slice(0, 500),
          label: String(item?.label ?? "Feltöltött kép").slice(0, 80),
          createdAt: String(item?.createdAt ?? new Date().toISOString()).slice(0, 40),
        }))
        .filter((item) => item.id && item.url)
        .slice(0, 40)
    : [];
}

function normalizeKindState(kind, raw) {
  const base = defaultKindState(kind);
  const activeUrl =
    String(raw?.activeUrl ?? base.activeUrl).trim().slice(0, 500) || base.activeUrl;
  return { activeUrl, uploads: normalizeUploads(raw?.uploads) };
}

function normalizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  // Régi, egyképes formátum → PKW-ba.
  if (!raw.pkw && !raw.lkw && (raw.activeUrl || Array.isArray(raw.uploads))) {
    return {
      pkw: normalizeKindState("pkw", raw),
      lkw: base.lkw,
    };
  }
  return {
    pkw: normalizeKindState("pkw", raw.pkw),
    lkw: normalizeKindState("lkw", raw.lkw),
  };
}

function readStateLocal() {
  ensureDataDir();
  if (!existsSync(HERO_PATH)) {
    const state = defaultState();
    writeFileSync(HERO_PATH, JSON.stringify(state, null, 2), "utf8");
    return state;
  }
  try {
    return normalizeState(JSON.parse(readFileSync(HERO_PATH, "utf8")));
  } catch {
    return defaultState();
  }
}

function writeStateLocal(state) {
  ensureDataDir();
  const next = normalizeState(state);
  writeFileSync(HERO_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}

async function ensureHeroBucket() {
  const sb = getSupabase();
  const { data: buckets } = await sb.storage.listBuckets();
  if (buckets?.some((b) => b.name === BUCKET)) return;
  const { error } = await sb.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
  });
  if (error && !/already exists|duplicate/i.test(error.message ?? "")) {
    throw error;
  }
}

async function readStateRemote() {
  await ensureHeroBucket();
  const sb = getSupabase();
  const { data, error } = await sb.storage.from(BUCKET).download(META_OBJECT);
  if (error || !data) return null;
  try {
    const text = await data.text();
    return normalizeState(JSON.parse(text));
  } catch {
    return null;
  }
}

async function writeStateRemote(state) {
  await ensureHeroBucket();
  const next = normalizeState(state);
  const sb = getSupabase();
  const body = Buffer.from(JSON.stringify(next, null, 2), "utf8");
  const { error } = await sb.storage.from(BUCKET).upload(META_OBJECT, body, {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw error;
  return next;
}

async function readState() {
  if (isSupabaseBackend()) {
    const remote = await readStateRemote();
    if (remote) return remote;
    const seeded = defaultState();
    try {
      await writeStateRemote(seeded);
    } catch {
      /* ignore seed failure */
    }
    return seeded;
  }
  return readStateLocal();
}

async function writeState(state) {
  if (isSupabaseBackend()) {
    return writeStateRemote(state);
  }
  return writeStateLocal(state);
}

function decodeBase64Photo(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const cleaned = s.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
  let buf;
  try {
    buf = Buffer.from(cleaned, "base64");
  } catch {
    return null;
  }
  if (!buf.length || buf.length > MAX_BYTES) return null;
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  const isWebp =
    buf.length > 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP";
  if (!isJpeg && !isPng && !isWebp) return null;
  const ext = isPng ? "png" : isWebp ? "webp" : "jpg";
  const contentType = isPng ? "image/png" : isWebp ? "image/webp" : "image/jpeg";
  return { buf, ext, contentType };
}

async function saveUploadBuffer(kind, photo) {
  const k = normalizeKind(kind);
  const id = `hero-${Date.now()}-${randomBytes(4).toString("hex")}`;
  if (isSupabaseBackend()) {
    await ensureHeroBucket();
    const name = `${k}/${id}.${photo.ext}`;
    const sb = getSupabase();
    const { error } = await sb.storage.from(BUCKET).upload(name, photo.buf, {
      contentType: photo.contentType,
      upsert: true,
    });
    if (error) throw error;
    const { data } = sb.storage.from(BUCKET).getPublicUrl(name);
    return { id, url: data?.publicUrl || null };
  }
  const dir = ensureUploadDir(k);
  const name = `${id}.${photo.ext}`;
  writeFileSync(join(dir, name), photo.buf);
  return { id, url: `/uploads/hero/${k}/${name}` };
}

function kindPayload(kind, state) {
  const k = normalizeKind(kind);
  const slice = state[k] || defaultKindState(k);
  return {
    kind: k,
    activeUrl: slice.activeUrl,
    presets: HERO_PRESETS[k],
    uploads: slice.uploads,
  };
}

export async function getSiteHero(kind) {
  const state = await readState();
  if (kind) return kindPayload(kind, state);
  return {
    pkw: kindPayload("pkw", state),
    lkw: kindPayload("lkw", state),
  };
}

export async function setActiveHeroUrl(url, kind = "pkw") {
  const k = normalizeKind(kind);
  const nextUrl = String(url ?? "").trim().slice(0, 500);
  if (!nextUrl) {
    const err = new Error("Hiányzó kép URL.");
    err.code = "INVALID_URL";
    throw err;
  }
  const state = await readState();
  const slice = state[k] || defaultKindState(k);
  const allowed =
    (HERO_PRESETS[k] || []).some((p) => p.url === nextUrl) ||
    slice.uploads.some((u) => u.url === nextUrl) ||
    nextUrl.startsWith(`/images/${k}/`) ||
    nextUrl.startsWith(`/uploads/hero/${k}/`) ||
    nextUrl.startsWith("/images/") ||
    nextUrl.startsWith("/uploads/hero/") ||
    /^https?:\/\//i.test(nextUrl);
  if (!allowed) {
    const err = new Error("Ez a kép nem választható.");
    err.code = "INVALID_URL";
    throw err;
  }
  const next = await writeState({
    ...state,
    [k]: { ...slice, activeUrl: nextUrl },
  });
  return kindPayload(k, next);
}

export async function uploadHeroImage(dataUrl, label = "", kind = "pkw") {
  const k = normalizeKind(kind);
  const photo = decodeBase64Photo(dataUrl);
  if (!photo) {
    const err = new Error("Érvénytelen kép (JPEG/PNG/WebP, max 8 MB).");
    err.code = "INVALID_IMAGE";
    throw err;
  }
  const saved = await saveUploadBuffer(k, photo);
  if (!saved.url) {
    const err = new Error("A feltöltés nem sikerült.");
    err.code = "UPLOAD_FAILED";
    throw err;
  }
  const state = await readState();
  const slice = state[k] || defaultKindState(k);
  const item = {
    id: saved.id,
    url: saved.url,
    label: String(label || "Feltöltött kép").slice(0, 80),
    createdAt: new Date().toISOString(),
  };
  const uploads = [item, ...slice.uploads].slice(0, 40);
  const next = await writeState({
    ...state,
    [k]: { activeUrl: item.url, uploads },
  });
  return kindPayload(k, next);
}

/** Helyi feltöltött fájl feloldása a /uploads/hero/… URL-hez. */
export function resolveHeroUploadFile(urlPath) {
  const rel = String(urlPath ?? "").replace(/^\//, "");
  if (!rel.startsWith("uploads/hero/")) return null;
  const rest = rel.slice("uploads/hero/".length);
  const parts = rest.split("/").filter(Boolean);
  if (parts.length === 2 && HERO_KINDS.includes(parts[0])) {
    const [kind, name] = parts;
    if (!name || name.includes("..") || name.includes("\\")) return null;
    const full = join(heroUploadDir(kind), name);
    return existsSync(full) ? full : null;
  }
  if (parts.length === 1) {
    const name = parts[0];
    if (!name || name.includes("..") || name.includes("\\")) return null;
    const full = join(heroUploadDir("pkw"), name);
    if (existsSync(full)) return full;
    const legacy = join(homedir(), ".autosweb", "uploads", "hero", name);
    return existsSync(legacy) ? legacy : null;
  }
  return null;
}
