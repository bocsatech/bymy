/**
 * Kezdőlap promo képsáv — max 8 kép, opcionális linkkel.
 * Meta: level1 kv (Supabase) vagy ~/.autosweb/hub-promo/meta.json (helyi).
 * Fájlok: Supabase Storage `hub-promo` vagy ~/.autosweb/uploads/hub-promo/.
 */
import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { isSupabaseBackend, getSupabase } from "./supabase/client.mjs";
import { initLevel1 } from "./level1.mjs";
import { safeInternalPath } from "./safe-path.mjs";

const META_KEY = "hub_promo_v2";
const LEGACY_META_KEY = "hub_promo_v1";
const BUCKET = "hub-promo";
const MAX_BYTES = 6 * 1024 * 1024;
export const HUB_PROMO_MAX = 8;
export const HUB_PROMO_WIDTH = 1400;
export const HUB_PROMO_HEIGHT = 840;

const STOCK_IMAGES = [
  {
    id: "stock-ingatlan",
    url: "/images/hub-ingatlan.jpg",
    href: "/ingatlan.html",
    alt: "Ingatlan — Házak és lakások",
    stock: true,
    createdAt: "1970-01-01T00:00:00.000Z",
  },
  {
    id: "stock-auto",
    url: "/images/hub-auto-motor.jpg",
    href: "/auto.html",
    alt: "Autó és teherautó — Autók és teherautók",
    stock: true,
    createdAt: "1970-01-01T00:00:00.000Z",
  },
];

/** Régi slot modell kompatibilitás (export ha kell). */
export const HUB_PROMO_SLOTS = {
  ingatlan: {
    id: "ingatlan",
    label: "Ingatlan",
    href: "/ingatlan.html",
    alt: "Ingatlan — Házak és lakások",
    defaultUrl: "/images/hub-ingatlan.jpg",
  },
  auto: {
    id: "auto",
    label: "Autó és teherautó",
    href: "/auto.html",
    alt: "Autó és teherautó — Autók és teherautók",
    defaultUrl: "/images/hub-auto-motor.jpg",
  },
};

function defaultMeta() {
  return {
    version: 2,
    images: STOCK_IMAGES.map((img) => ({ ...img })),
  };
}

function hubPromoUploadDir() {
  if (process.env.VERCEL) {
    return join(process.env.TMPDIR || "/tmp", "autosweb-uploads", "hub-promo");
  }
  return join(homedir(), ".autosweb", "uploads", "hub-promo");
}

function hubPromoMetaPath() {
  if (process.env.AUTOSWEB_HUB_PROMO_META) return process.env.AUTOSWEB_HUB_PROMO_META;
  return join(homedir(), ".autosweb", "hub-promo", "meta-v2.json");
}

function ensureDirs() {
  mkdirSync(hubPromoUploadDir(), { recursive: true });
  mkdirSync(join(homedir(), ".autosweb", "hub-promo"), { recursive: true });
}

/**
 * Üres = nincs link (csak reklám).
 * Belső path (/...) vagy http(s) URL.
 */
export function normalizePromoHref(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      return u.toString().slice(0, 500);
    } catch {
      return "";
    }
  }
  if (raw.startsWith("/")) {
    const path = safeInternalPath(raw, "");
    return path || "";
  }
  return "";
}

function normalizeImage(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "").trim();
  const url = String(raw.url || "").trim();
  if (!id || !url) return null;
  return {
    id,
    url,
    href: normalizePromoHref(raw.href),
    alt: String(raw.alt || "Promo").slice(0, 200),
    stock: Boolean(raw.stock),
    createdAt: String(raw.createdAt || new Date().toISOString()),
    storagePath: raw.storagePath ? String(raw.storagePath) : undefined,
  };
}

function normalizeMeta(meta) {
  const images = Array.isArray(meta?.images)
    ? meta.images.map(normalizeImage).filter(Boolean).slice(0, HUB_PROMO_MAX)
    : [];
  return { version: 2, images };
}

function migrateFromV1(parsed) {
  const images = [];
  const slots = parsed?.slots || {};
  for (const [slotId, def] of Object.entries(HUB_PROMO_SLOTS)) {
    const slot = slots[slotId];
    if (!slot) continue;
    const list = Array.isArray(slot.images) ? slot.images : [];
    const active =
      list.find((img) => img.id === slot.activeId) ||
      list.find((img) => img.id === "stock") ||
      list[0];
    if (!active?.url) continue;
    const isStock = active.id === "stock" || active.stock;
    images.push({
      id: isStock ? `stock-${slotId}` : String(active.id),
      url: isStock ? def.defaultUrl : String(active.url),
      href: def.href,
      alt: def.alt,
      stock: isStock,
      createdAt: String(active.createdAt || new Date().toISOString()),
      storagePath: active.storagePath ? String(active.storagePath) : undefined,
    });
  }
  if (!images.length) return defaultMeta();
  return normalizeMeta({ images });
}

async function readKv(key) {
  if (isSupabaseBackend()) {
    await initLevel1();
    const { data, error } = await getSupabase()
      .from("level1_kv")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    return data?.value ?? null;
  }
  if (key === META_KEY) {
    const path = hubPromoMetaPath();
    if (!existsSync(path)) return null;
    try {
      return readFileSync(path, "utf8");
    } catch {
      return null;
    }
  }
  // legacy local: old meta.json
  const legacy = join(homedir(), ".autosweb", "hub-promo", "meta.json");
  if (!existsSync(legacy)) return null;
  try {
    return readFileSync(legacy, "utf8");
  } catch {
    return null;
  }
}

async function writeMetaRaw(json) {
  if (isSupabaseBackend()) {
    await initLevel1();
    const { error } = await getSupabase()
      .from("level1_kv")
      .upsert({ key: META_KEY, value: json }, { onConflict: "key" });
    if (error) throw error;
    return;
  }
  ensureDirs();
  writeFileSync(hubPromoMetaPath(), json, "utf8");
}

async function loadMeta() {
  const raw = await readKv(META_KEY);
  if (raw) {
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed?.images)) return normalizeMeta(parsed);
    } catch {
      /* fall through */
    }
  }

  const legacyRaw = await readKv(LEGACY_META_KEY);
  if (legacyRaw) {
    try {
      const parsed = typeof legacyRaw === "string" ? JSON.parse(legacyRaw) : legacyRaw;
      if (parsed?.slots) {
        const migrated = migrateFromV1(parsed);
        await saveMeta(migrated);
        return migrated;
      }
    } catch {
      /* fall through */
    }
  }

  return defaultMeta();
}

async function saveMeta(meta) {
  await writeMetaRaw(JSON.stringify(normalizeMeta(meta)));
}

function decodeImage(raw) {
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
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50;
  if (!isJpeg && !isPng && !isWebp) return null;
  const ext = isPng ? "png" : isWebp ? "webp" : "jpg";
  const contentType = isPng ? "image/png" : isWebp ? "image/webp" : "image/jpeg";
  return { buf, ext, contentType };
}

async function ensureBucket() {
  const sb = getSupabase();
  const { data: buckets } = await sb.storage.listBuckets();
  if (buckets?.some((b) => b.name === BUCKET)) return;
  const { error } = await sb.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (error && !/already exists|duplicate/i.test(error.message ?? "")) throw error;
}

async function saveUpload(photo) {
  const id = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const name = `home-${id}.${photo.ext}`;
  if (isSupabaseBackend()) {
    await ensureBucket();
    const path = `home/${name}`;
    const sb = getSupabase();
    const { error } = await sb.storage.from(BUCKET).upload(path, photo.buf, {
      contentType: photo.contentType,
      upsert: true,
    });
    if (error) throw error;
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return { id, url: data?.publicUrl || "", storagePath: path };
  }
  ensureDirs();
  writeFileSync(join(hubPromoUploadDir(), name), photo.buf);
  return { id, url: `/uploads/hub-promo/${name}`, storagePath: name };
}

export function resolveHubPromoFile(urlPath) {
  const rel = String(urlPath || "").replace(/^\//, "");
  if (!rel.startsWith("uploads/hub-promo/")) return null;
  const name = rel.slice("uploads/hub-promo/".length);
  if (!name || name.includes("..") || name.includes("/")) return null;
  const abs = join(hubPromoUploadDir(), name);
  return existsSync(abs) ? abs : null;
}

function publicImages(meta) {
  return (meta.images || []).map((img) => ({
    id: img.id,
    url: img.url,
    href: img.href || "",
    alt: img.alt || "Promo",
  }));
}

export async function getHubPromoPublic() {
  const meta = await loadMeta();
  return {
    images: publicImages(meta),
    max: HUB_PROMO_MAX,
    size: { width: HUB_PROMO_WIDTH, height: HUB_PROMO_HEIGHT },
  };
}

export async function getHubPromoAdmin() {
  const meta = await loadMeta();
  return {
    images: meta.images,
    max: HUB_PROMO_MAX,
    size: { width: HUB_PROMO_WIDTH, height: HUB_PROMO_HEIGHT },
    count: meta.images.length,
  };
}

export async function uploadHubPromoImage(imageBase64, { href = "", alt = "" } = {}) {
  const meta = await loadMeta();
  if (meta.images.length >= HUB_PROMO_MAX) {
    const err = new Error(`Maximum ${HUB_PROMO_MAX} kép lehet a főoldalon.`);
    err.status = 400;
    throw err;
  }
  const photo = decodeImage(imageBase64);
  if (!photo) {
    const err = new Error("Érvénytelen kép (JPG/PNG/WebP, max 6 MB).");
    err.status = 400;
    throw err;
  }
  const saved = await saveUpload(photo);
  if (!saved.url) {
    const err = new Error("A feltöltés nem sikerült.");
    err.status = 500;
    throw err;
  }
  meta.images.push({
    id: saved.id,
    url: saved.url,
    href: normalizePromoHref(href),
    alt: String(alt || "Promo").slice(0, 200),
    stock: false,
    createdAt: new Date().toISOString(),
    storagePath: saved.storagePath,
  });
  await saveMeta(meta);
  return getHubPromoAdmin();
}

export async function updateHubPromoImage(imageId, { href, alt } = {}) {
  const id = String(imageId || "").trim();
  const meta = await loadMeta();
  const img = meta.images.find((item) => item.id === id);
  if (!img) {
    const err = new Error("Nincs ilyen kép.");
    err.status = 404;
    throw err;
  }
  if (href !== undefined) img.href = normalizePromoHref(href);
  if (alt !== undefined) img.alt = String(alt || "Promo").slice(0, 200);
  await saveMeta(meta);
  return getHubPromoAdmin();
}

export async function deleteHubPromoImage(imageId) {
  const id = String(imageId || "").trim();
  if (!id) {
    const err = new Error("Kép azonosító kötelező.");
    err.status = 400;
    throw err;
  }
  const meta = await loadMeta();
  const idx = meta.images.findIndex((item) => item.id === id);
  if (idx < 0) {
    const err = new Error("Nincs ilyen kép.");
    err.status = 404;
    throw err;
  }
  const [removed] = meta.images.splice(idx, 1);
  await saveMeta(meta);

  if (!removed?.stock && removed?.storagePath) {
    try {
      if (isSupabaseBackend()) {
        await getSupabase().storage.from(BUCKET).remove([removed.storagePath]);
      } else {
        const abs = join(hubPromoUploadDir(), removed.storagePath);
        if (existsSync(abs)) unlinkSync(abs);
      }
    } catch {
      /* meta már mentve */
    }
  }
  return getHubPromoAdmin();
}

/** Régi API kompatibilitás — ne használjuk új kódban. */
export async function setHubPromoActive() {
  return getHubPromoAdmin();
}
