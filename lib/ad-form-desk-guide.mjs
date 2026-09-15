import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { isSupabaseBackend, getSupabase } from "./supabase/client.mjs";
import { rewritePublicStorageUrl } from "./supabase/public-url.mjs";
import { initLevel1 } from "./level1.mjs";

const META_KEY = "ad_form_desk_guide_v1";
const BUCKET = "hub-promo";
const MAX_BYTES = 6 * 1024 * 1024;

export const AD_FORM_DESK_GUIDE_SLOTS = {
  alap: { id: "alap", label: "Alap adatok" },
  muszaki: { id: "muszaki", label: "Műszaki adatok" },
  extrak: { id: "extrak", label: "Extrák" },
  hirdetes: { id: "hirdetes", label: "Hirdetés" },
  kepek: { id: "kepek", label: "Képek" },
};

export const AD_FORM_DESK_GUIDE_SLOT_IDS = Object.keys(AD_FORM_DESK_GUIDE_SLOTS);

export const GUIDE_SLOT_BY_STEP = {
  1: "alap",
  2: "muszaki",
  3: "extrak",
  4: "kepek",
  5: "hirdetes",
};

function guideUploadDir() {
  if (process.env.VERCEL) {
    return join(process.env.TMPDIR || "/tmp", "autosweb-uploads", "ad-form-desk-guide");
  }
  return join(homedir(), ".autosweb", "uploads", "ad-form-desk-guide");
}

function guideMetaPath() {
  return join(homedir(), ".autosweb", "ad-form-desk-guide", "meta.json");
}

function ensureDirs() {
  mkdirSync(guideUploadDir(), { recursive: true });
  mkdirSync(join(homedir(), ".autosweb", "ad-form-desk-guide"), { recursive: true });
}

function normalizeSlotId(raw) {
  const id = String(raw ?? "").trim().toLowerCase();
  return AD_FORM_DESK_GUIDE_SLOT_IDS.includes(id) ? id : "";
}

function normalizeSlotImage(raw) {
  if (!raw || typeof raw !== "object") return null;
  const slot = normalizeSlotId(raw.slot);
  const url = String(raw.url || "").trim();
  if (!slot || !url) return null;
  return {
    slot,
    url,
    alt: String(raw.alt || AD_FORM_DESK_GUIDE_SLOTS[slot].label).slice(0, 200),
    storagePath: raw.storagePath ? String(raw.storagePath) : undefined,
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  };
}

function defaultMeta() {
  return { version: 1, slots: {} };
}

function normalizeMeta(meta) {
  const slots = {};
  const src = meta?.slots && typeof meta.slots === "object" ? meta.slots : {};
  for (const slotId of AD_FORM_DESK_GUIDE_SLOT_IDS) {
    const normalized = normalizeSlotImage({ ...src[slotId], slot: slotId });
    if (normalized) slots[slotId] = normalized;
  }
  return { version: 1, slots };
}

async function readKv() {
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
  const path = guideMetaPath();
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
  writeFileSync(guideMetaPath(), json, "utf8");
}

async function loadMeta() {
  const raw = await readKv();
  if (!raw) return defaultMeta();
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return normalizeMeta(parsed);
  } catch {
    return defaultMeta();
  }
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

async function saveUpload(slotId, photo) {
  const id = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const name = `${slotId}-${id}.${photo.ext}`;
  if (isSupabaseBackend()) {
    await ensureBucket();
    const path = `desk-guide/${name}`;
    const sb = getSupabase();
    const { error } = await sb.storage.from(BUCKET).upload(path, photo.buf, {
      contentType: photo.contentType,
      upsert: true,
    });
    if (error) throw error;
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return { url: rewritePublicStorageUrl(data?.publicUrl || ""), storagePath: path };
  }
  ensureDirs();
  writeFileSync(join(guideUploadDir(), name), photo.buf);
  return { url: `/uploads/ad-form-desk-guide/${name}`, storagePath: name };
}

export function resolveAdFormDeskGuideFile(urlPath) {
  const rel = String(urlPath || "").replace(/^\//, "");
  if (!rel.startsWith("uploads/ad-form-desk-guide/")) return null;
  const name = rel.slice("uploads/ad-form-desk-guide/".length);
  if (!name || name.includes("..") || name.includes("/")) return null;
  const abs = join(guideUploadDir(), name);
  return existsSync(abs) ? abs : null;
}

function publicPayload(meta) {
  const slots = {};
  for (const slotId of AD_FORM_DESK_GUIDE_SLOT_IDS) {
    const img = meta.slots[slotId];
    slots[slotId] = {
      id: slotId,
      label: AD_FORM_DESK_GUIDE_SLOTS[slotId].label,
      url: rewritePublicStorageUrl(img?.url || ""),
      alt: img?.alt || AD_FORM_DESK_GUIDE_SLOTS[slotId].label,
    };
  }
  return { slots, slotOrder: AD_FORM_DESK_GUIDE_SLOT_IDS };
}

function adminPayload(meta) {
  const pub = publicPayload(meta);
  return {
    ...pub,
    images: AD_FORM_DESK_GUIDE_SLOT_IDS.map((slotId) => {
      const img = meta.slots[slotId];
      return {
        slot: slotId,
        label: AD_FORM_DESK_GUIDE_SLOTS[slotId].label,
        url: pub.slots[slotId]?.url || "",
        alt: img?.alt || AD_FORM_DESK_GUIDE_SLOTS[slotId].label,
        storagePath: img?.storagePath,
        updatedAt: img?.updatedAt,
      };
    }),
  };
}

export async function getAdFormDeskGuidePublic() {
  return publicPayload(await loadMeta());
}

export async function getAdFormDeskGuideAdmin() {
  return adminPayload(await loadMeta());
}

async function removeStoredFile(storagePath) {
  if (!storagePath) return;
  try {
    if (isSupabaseBackend()) {
      await getSupabase().storage.from(BUCKET).remove([storagePath]);
    } else {
      const abs = join(guideUploadDir(), storagePath);
      if (existsSync(abs)) unlinkSync(abs);
    }
  } catch {
  }
}

export async function uploadAdFormDeskGuideImage(slotRaw, imageBase64, { alt = "" } = {}) {
  const slot = normalizeSlotId(slotRaw);
  if (!slot) {
    const err = new Error("Érvénytelen szekció.");
    err.status = 400;
    throw err;
  }
  const photo = decodeImage(imageBase64);
  if (!photo) {
    const err = new Error("Érvénytelen kép (JPG/PNG/WebP, max 6 MB).");
    err.status = 400;
    throw err;
  }
  const meta = await loadMeta();
  const prev = meta.slots[slot];
  const saved = await saveUpload(slot, photo);
  if (!saved.url) {
    const err = new Error("A feltöltés nem sikerült.");
    err.status = 500;
    throw err;
  }
  meta.slots[slot] = {
    slot,
    url: saved.url,
    alt: String(alt || AD_FORM_DESK_GUIDE_SLOTS[slot].label).slice(0, 200),
    storagePath: saved.storagePath,
    updatedAt: new Date().toISOString(),
  };
  await saveMeta(meta);
  if (prev?.storagePath && prev.storagePath !== saved.storagePath) {
    await removeStoredFile(prev.storagePath);
  }
  return adminPayload(meta);
}

export async function updateAdFormDeskGuideImage(slotRaw, { alt } = {}) {
  const slot = normalizeSlotId(slotRaw);
  const meta = await loadMeta();
  const img = meta.slots[slot];
  if (!slot || !img) {
    const err = new Error("Nincs kép ehhez a szekcióhoz.");
    err.status = 404;
    throw err;
  }
  if (alt !== undefined) img.alt = String(alt || AD_FORM_DESK_GUIDE_SLOTS[slot].label).slice(0, 200);
  img.updatedAt = new Date().toISOString();
  await saveMeta(meta);
  return adminPayload(meta);
}

export async function deleteAdFormDeskGuideImage(slotRaw) {
  const slot = normalizeSlotId(slotRaw);
  if (!slot) {
    const err = new Error("Érvénytelen szekció.");
    err.status = 400;
    throw err;
  }
  const meta = await loadMeta();
  const prev = meta.slots[slot];
  if (!prev) {
    const err = new Error("Nincs kép ehhez a szekcióhoz.");
    err.status = 404;
    throw err;
  }
  delete meta.slots[slot];
  await saveMeta(meta);
  await removeStoredFile(prev.storagePath);
  return adminPayload(meta);
}
