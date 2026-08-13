/**
 * iOS / web hirdetésképek — base64 JPEG → helyi fájl vagy Supabase Storage.
 */
import { randomBytes } from "crypto";
import { writeFileSync } from "fs";
import { join } from "path";
import { isSupabaseBackend, getSupabase } from "./supabase/client.mjs";
import { listingImageDir, listingImagePublicPath } from "./listing-image.mjs";

const BUCKET = "listings";
const MAX_PHOTOS = 20;
const MAX_BYTES = 8 * 1024 * 1024;

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
  if (!isJpeg && !isPng) return null;
  return { buf, ext: isPng ? "png" : "jpg", contentType: isPng ? "image/png" : "image/jpeg" };
}

async function ensureListingsBucket() {
  const sb = getSupabase();
  const { data: buckets } = await sb.storage.listBuckets();
  if (buckets?.some((b) => b.name === BUCKET)) return;
  const { error } = await sb.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (error && !/already exists|duplicate/i.test(error.message ?? "")) {
    throw error;
  }
}

async function saveToSupabase(listingId, photo, index) {
  await ensureListingsBucket();
  const name = `${listingId}/${Date.now()}-${index}-${randomBytes(4).toString("hex")}.${photo.ext}`;
  const sb = getSupabase();
  const { error } = await sb.storage.from(BUCKET).upload(name, photo.buf, {
    contentType: photo.contentType,
    upsert: true,
  });
  if (error) throw error;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(name);
  return data?.publicUrl || null;
}

function saveLocal(listingId, photo, index) {
  const name = `${listingId}-${index}-${randomBytes(4).toString("hex")}.${photo.ext}`;
  writeFileSync(join(listingImageDir(), name), photo.buf);
  return listingImagePublicPath(name);
}

/**
 * Ment base64 fotókat. Vissza: nyilvános URL-ek (első = fo_kep).
 * @param {number|string} listingId
 * @param {string[]} photosBase64
 */
export async function saveListingPhotos(listingId, photosBase64) {
  const id = Number(listingId);
  if (!Number.isFinite(id) || id <= 0) return [];
  const list = Array.isArray(photosBase64) ? photosBase64.slice(0, MAX_PHOTOS) : [];
  const urls = [];
  for (let i = 0; i < list.length; i += 1) {
    const photo = decodeBase64Photo(list[i]);
    if (!photo) continue;
    const url = isSupabaseBackend()
      ? await saveToSupabase(id, photo, i)
      : saveLocal(id, photo, i);
    if (url) urls.push(url);
  }
  return urls;
}
