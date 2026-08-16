/**
 * Autó oldal hero háttérkép — előre feltöltött + saját feltöltés.
 * Aktív URL mindenkinek ugyanaz (GET /api/site-hero).
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

export const HERO_PRESETS = [
  {
    id: "automax-panel",
    label: "Éjszakai autó",
    url: "/images/automax-panel-bg.png",
  },
  {
    id: "hub-auto-photo",
    label: "Autó fotó",
    url: "/images/hub-auto-photo.jpg",
  },
  {
    id: "hub-auto-motor",
    label: "Autó & motor",
    url: "/images/hub-auto-motor.png",
  },
];

const DEFAULT_ACTIVE = HERO_PRESETS[0].url;

function heroUploadDir() {
  if (process.env.AUTOSWEB_HERO_UPLOADS_PATH) return process.env.AUTOSWEB_HERO_UPLOADS_PATH;
  return join(homedir(), ".autosweb", "uploads", "hero");
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function ensureUploadDir() {
  const uploadDir = heroUploadDir();
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
  return uploadDir;
}

function defaultState() {
  return {
    activeUrl: DEFAULT_ACTIVE,
    uploads: [],
  };
}

function normalizeState(raw) {
  const base = defaultState();
  const uploads = Array.isArray(raw?.uploads)
    ? raw.uploads
        .map((item) => ({
          id: String(item?.id ?? "").slice(0, 64),
          url: String(item?.url ?? "").slice(0, 500),
          label: String(item?.label ?? "Feltöltött kép").slice(0, 80),
          createdAt: String(item?.createdAt ?? new Date().toISOString()).slice(0, 40),
        }))
        .filter((item) => item.id && item.url)
        .slice(0, 40)
    : [];
  const activeUrl = String(raw?.activeUrl ?? base.activeUrl).trim().slice(0, 500) || base.activeUrl;
  return { activeUrl, uploads };
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

async function saveUploadBuffer(photo) {
  const id = `hero-${Date.now()}-${randomBytes(4).toString("hex")}`;
  if (isSupabaseBackend()) {
    await ensureHeroBucket();
    const name = `${id}.${photo.ext}`;
    const sb = getSupabase();
    const { error } = await sb.storage.from(BUCKET).upload(name, photo.buf, {
      contentType: photo.contentType,
      upsert: true,
    });
    if (error) throw error;
    const { data } = sb.storage.from(BUCKET).getPublicUrl(name);
    return { id, url: data?.publicUrl || null };
  }
  const dir = ensureUploadDir();
  const name = `${id}.${photo.ext}`;
  writeFileSync(join(dir, name), photo.buf);
  return { id, url: `/uploads/hero/${name}` };
}

export async function getSiteHero() {
  const state = await readState();
  return {
    activeUrl: state.activeUrl,
    presets: HERO_PRESETS,
    uploads: state.uploads,
  };
}

export async function setActiveHeroUrl(url) {
  const nextUrl = String(url ?? "").trim().slice(0, 500);
  if (!nextUrl) {
    const err = new Error("Hiányzó kép URL.");
    err.code = "INVALID_URL";
    throw err;
  }
  const state = await readState();
  const allowed =
    HERO_PRESETS.some((p) => p.url === nextUrl) ||
    state.uploads.some((u) => u.url === nextUrl) ||
    nextUrl.startsWith("/images/") ||
    nextUrl.startsWith("/uploads/hero/") ||
    /^https?:\/\//i.test(nextUrl);
  if (!allowed) {
    const err = new Error("Ez a kép nem választható.");
    err.code = "INVALID_URL";
    throw err;
  }
  return writeState({ ...state, activeUrl: nextUrl });
}

export async function uploadHeroImage(dataUrl, label = "") {
  const photo = decodeBase64Photo(dataUrl);
  if (!photo) {
    const err = new Error("Érvénytelen kép (JPEG/PNG/WebP, max 8 MB).");
    err.code = "INVALID_IMAGE";
    throw err;
  }
  const saved = await saveUploadBuffer(photo);
  if (!saved.url) {
    const err = new Error("A feltöltés nem sikerült.");
    err.code = "UPLOAD_FAILED";
    throw err;
  }
  const state = await readState();
  const item = {
    id: saved.id,
    url: saved.url,
    label: String(label || "Feltöltött kép").slice(0, 80),
    createdAt: new Date().toISOString(),
  };
  const uploads = [item, ...state.uploads].slice(0, 40);
  return writeState({ activeUrl: item.url, uploads });
}

/** Helyi feltöltött fájl feloldása a /uploads/hero/… URL-hez. */
export function resolveHeroUploadFile(urlPath) {
  const rel = String(urlPath ?? "").replace(/^\//, "");
  if (!rel.startsWith("uploads/hero/")) return null;
  const name = rel.slice("uploads/hero/".length);
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) return null;
  const full = join(heroUploadDir(), name);
  if (!existsSync(full)) return null;
  return full;
}
