/** Hirdetéskép: JPEG-re kicsinyítés, hogy a Vercel body limit alá férjen. */

const MAX_PHOTOS = 8;
const MAX_SIDE = 1280;
const TARGET_BYTES = 280_000;

function isProbablyImage(file) {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  return type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(name);
}

async function decodeToBitmap(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* HEIC / egyes böngészők */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("A kép nem olvasható."));
      el.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("A kép tömörítése sikertelen."));
      },
      "image/jpeg",
      quality
    );
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error ?? new Error("Kép olvasása sikertelen."));
    reader.readAsDataURL(blob);
  });
}

export async function compressListingPhoto(file) {
  const source = await decodeToBitmap(file);
  const w = source.width || source.naturalWidth || 0;
  const h = source.height || source.naturalHeight || 0;
  if (!w || !h) throw new Error("A kép mérete nem olvasható.");

  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const width = Math.max(1, Math.round(w * scale));
  const height = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("A kép rajzolása sikertelen.");
  ctx.drawImage(source, 0, 0, width, height);
  source.close?.();

  let quality = 0.72;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > TARGET_BYTES && quality > 0.42) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }
  return blobToDataUrl(blob);
}

export async function compressListingPhotos(files, max = MAX_PHOTOS) {
  const list = [...(files ?? [])].filter(isProbablyImage).slice(0, max);
  const photos = [];
  for (const file of list) {
    try {
      const dataUrl = await compressListingPhoto(file);
      if (dataUrl.startsWith("data:image/")) photos.push(dataUrl);
    } catch (error) {
      throw new Error(error?.message ?? "A kép feltöltése sikertelen. JPG vagy PNG kell.");
    }
  }
  return photos;
}
