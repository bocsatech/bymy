/**
 * Kezdőlap / hub promo képek — slotonkénti képtár (ingatlan, auto).
 * Meta: level1 kv (Supabase) vagy ~/.autosweb/hub-promo/meta.json (helyi).
 * Fájlok: Supabase Storage `hub-promo` vagy ~/.autosweb/uploads/hub-promo/.
 */
import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { isSupabaseBackend, getSupabase } from "./supabase/client.mjs";
import { initLevel1 } from "./level1.mjs";

const META_KEY = "hub_promo_v1";
const BUCKET = "hub-promo";
const MAX_BYTES = 6 * 1024 * 1024;

export const HUB_PROMO_SLOTS = {
  ingatlan: {
    id: "ingatlan",
    label: "Ingatlan",
    href: "/ingatlan.html",
    alt: "Ingatlan — Házak és lakások",
    defaultUrl: "/images/hub-ingatlan.png",
  },
  auto: {
    id: "auto",
    label: "Autó és teherautó",
    href: "/auto.html",
    alt: "Autó és teherautó — Autók és teherautók",
    defaultUrl: "/images/hub-auto-motor.png",
  },
};

function stockImage(slotId) {
  const slot = HUB_PROMO_SLOTS[slotId];
  return {
    id: "stock",
    url: slot.defaultUrl,
    stock: true,
    createdAt: "1970-01-01T00:00:00.000Z",
  };
}

function defaultMeta() {
  return {
    slots: {
      ingatlan: { activeId: "stock", images: [stockImage("ingatlan")] },
      auto: { activeId: "stock", images: [stockImage("auto")] },
    },
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
  return join(homedir(), ".autosweb", "hub-promo", "meta.json");
}

function ensureDirs() {
  mkdirSync(hubPromoUploadDir(), { recursive: true });
  mkdirSync(join(homedir(), ".autosweb", "hub-promo"), { recursive: true });
}

function normalizeSlot(slotId) {
  const id = String(slotId || "").trim().toLowerCase();
  if (!HUB_PROMO_SLOTS[id]) {
    const err = new Error("Ismeretlen promo slot (ingatlan | auto).");
    err.status = 400;
    throw err;
  }
  return id;
}

function ensureSlotShape(meta, slotId) {
  if (!meta.slots) meta.slots = {};
  if (!meta.slots[slotId]) {
    meta.slots[slotId] = { activeId: "stock", images: [stockImage(slotId)] };
  }
  const slot = meta.slots[slotId];
  if (!Array.isArray(slot.images)) slot.images = [];
  if (!slot.images.some((img) => img.id === "stock")) {
    slot.images.unshift(stockImage(slotId));
  } else {
    // stock URL always current default
    const stock = slot.images.find((img) => img.id === "stock");
    if (stock) stock.url = HUB_PROMO_SLOTS[slotId].defaultUrl;
  }
  if (!slot.activeId || !slot.images.some((img) => img.id === slot.activeId)) {
    slot.activeId = "stock";
  }
  return slot;
}

async function readMetaRaw() {
  if (isSupabaseBackend()) {
    await initLevel1();
    const { data, error } = await getSupabase()
      .from("level1_kv")
      .select("value")
      .eq("key", META_KEY)
      .maybeSingle();
    if (error) throw error;
    return data?.value ?? null;
  }
  const path = hubPromoMetaPath();
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
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
  const raw = await readMetaRaw();
  let meta = defaultMeta();
  if (raw) {
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed?.slots) meta = parsed;
    } catch {
      /* keep default */
    }
  }
  for (const id of Object.keys(HUB_PROMO_SLOTS)) ensureSlotShape(meta, id);
  return meta;
}

async function saveMeta(meta) {
  await writeMetaRaw(JSON.stringify(meta));
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

async function saveUpload(slotId, photo) {
  const id = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const name = `${slotId}-${id}.${photo.ext}`;
  if (isSupabaseBackend()) {
    await ensureBucket();
    const path = `${slotId}/${name}`;
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

export async function getHubPromoPublic() {
  const meta = await loadMeta();
  const out = {};
  for (const [id, def] of Object.entries(HUB_PROMO_SLOTS)) {
    const slot = ensureSlotShape(meta, id);
    const active = slot.images.find((img) => img.id === slot.activeId) || stockImage(id);
    out[id] = {
      id,
      href: def.href,
      alt: def.alt,
      label: def.label,
      url: active.url || def.defaultUrl,
      activeId: slot.activeId,
    };
  }
  return { slots: out };
}

export async function getHubPromoAdmin() {
  const meta = await loadMeta();
  const slots = {};
  for (const id of Object.keys(HUB_PROMO_SLOTS)) {
    const def = HUB_PROMO_SLOTS[id];
    const slot = ensureSlotShape(meta, id);
    slots[id] = {
      id,
      label: def.label,
      href: def.href,
      alt: def.alt,
      defaultUrl: def.defaultUrl,
      activeId: slot.activeId,
      images: slot.images,
    };
  }
  return { slots };
}

export async function uploadHubPromoImage(slotId, imageBase64) {
  const id = normalizeSlot(slotId);
  const photo = decodeImage(imageBase64);
  if (!photo) {
    const err = new Error("Érvénytelen kép (JPG/PNG/WebP, max 6 MB).");
    err.status = 400;
    throw err;
  }
  const saved = await saveUpload(id, photo);
  if (!saved.url) {
    const err = new Error("A feltöltés nem sikerült.");
    err.status = 500;
    throw err;
  }
  const meta = await loadMeta();
  const slot = ensureSlotShape(meta, id);
  slot.images.push({
    id: saved.id,
    url: saved.url,
    stock: false,
    createdAt: new Date().toISOString(),
    storagePath: saved.storagePath,
  });
  slot.activeId = saved.id;
  await saveMeta(meta);
  return getHubPromoAdmin();
}

export async function setHubPromoActive(slotId, imageId) {
  const id = normalizeSlot(slotId);
  const meta = await loadMeta();
  const slot = ensureSlotShape(meta, id);
  const imgId = String(imageId || "").trim();
  if (!slot.images.some((img) => img.id === imgId)) {
    const err = new Error("Nincs ilyen kép a slotban.");
    err.status = 404;
    throw err;
  }
  slot.activeId = imgId;
  await saveMeta(meta);
  return getHubPromoAdmin();
}

export async function deleteHubPromoImage(slotId, imageId) {
  const id = normalizeSlot(slotId);
  const imgId = String(imageId || "").trim();
  if (imgId === "stock") {
    const err = new Error("Az eredeti stock kép nem törölhető.");
    err.status = 400;
    throw err;
  }
  const meta = await loadMeta();
  const slot = ensureSlotShape(meta, id);
  const idx = slot.images.findIndex((img) => img.id === imgId);
  if (idx < 0) {
    const err = new Error("Nincs ilyen kép.");
    err.status = 404;
    throw err;
  }
  const [removed] = slot.images.splice(idx, 1);
  if (slot.activeId === imgId) slot.activeId = "stock";
  await saveMeta(meta);

  try {
    if (removed?.storagePath) {
      if (isSupabaseBackend()) {
        await getSupabase().storage.from(BUCKET).remove([removed.storagePath]);
      } else {
        const abs = join(hubPromoUploadDir(), removed.storagePath);
        if (existsSync(abs)) unlinkSync(abs);
      }
    }
  } catch {
    /* meta már mentve */
  }
  return getHubPromoAdmin();
}
