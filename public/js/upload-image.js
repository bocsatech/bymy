export const IMAGE_BUCKET_MAP = {
  listing: 'listing-images',
  listings: 'listing-images',
  profile: 'profile-images',
  profiles: 'profile-images',
  recommendation: 'recommendation-images',
  recommendations: 'recommendation-images',
  partner: 'partner-images',
  partners: 'partner-images',
};

export function resolveUploadBucket(kind) {
  const key = String(kind ?? 'listing').trim().toLowerCase();
  return IMAGE_BUCKET_MAP[key] || IMAGE_BUCKET_MAP.listing;
}

export function isImageFile(file) {
  if (!(file instanceof File)) return false;
  const type = String(file.type || '').toLowerCase();
  if (type.startsWith('image/')) return true;
  const name = String(file.name || '').toLowerCase();
  return /\.(jpe?g|png|webp|avif|gif)$/i.test(name);
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error ?? new Error('A kép olvasása sikertelen.'));
    reader.readAsDataURL(file);
  });
}

export function imageDimensionsFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('A kép mérete nem olvasható.'));
    img.src = dataUrl;
  });
}

function canvasToDataUrl(canvas, mimeType = 'image/jpeg', quality = 0.82) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('A kép tömörítése sikertelen.'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error ?? new Error('A tömörített kép mentése sikertelen.'));
        reader.readAsDataURL(blob);
      },
      mimeType,
      quality
    );
  });
}

export async function prepareUploadDataUrl(file, options = {}) {
  if (!isImageFile(file)) {
    throw new Error('Csak képfájlok engedélyezettek.');
  }

  const maxSide = Number(options.maxSide ?? 1600);
  const targetBytes = Number(options.targetBytes ?? 360_000);
  const qualityStart = Number(options.qualityStart ?? 0.82);
  const minQuality = Number(options.minQuality ?? 0.52);
  const dataUrl = await readFileAsDataUrl(file);
  const dims = await imageDimensionsFromDataUrl(dataUrl);
  if (!dims.width || !dims.height) {
    throw new Error('A kép mérete nem olvasható.');
  }

  const scale = Math.min(1, maxSide / Math.max(dims.width, dims.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(dims.width * scale));
  canvas.height = Math.max(1, Math.round(dims.height * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('A kép feldolgozása sikertelen.');
  }

  const img = new Image();
  const loaded = await new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('A kép betöltése sikertelen.'));
    img.src = dataUrl;
  });

  if (!loaded) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let quality = qualityStart;
  let result = await canvasToDataUrl(canvas, 'image/jpeg', quality);
  while (result.length > targetBytes * 1.2 && quality > minQuality) {
    quality -= 0.08;
    result = await canvasToDataUrl(canvas, 'image/jpeg', quality);
  }

  return result;
}

export async function uploadImage({
  file,
  bucket,
  kind,
  entityType = 'listing',
  entityId = null,
  folder = '',
  fileName = '',
  onProgress,
  fetchImpl = fetch,
}) {
  if (!file) {
    throw new Error('Hiányzó fájl.');
  }

  const prepared = await prepareUploadDataUrl(file, {
    maxSide: 1600,
    targetBytes: 360_000,
    qualityStart: 0.82,
    minQuality: 0.52,
  });

  const payload = {
    bucket: resolveUploadBucket(kind ?? bucket),
    entityType,
    entityId,
    folder,
    fileName: fileName || file.name || `upload-${Date.now()}`,
    dataUrl: prepared,
  };

  onProgress?.({ step: 'uploading', done: 1, total: 1 });

  const response = await fetchImpl('/api/uploads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.ok) {
    throw new Error(json.error || 'A kép feltöltése sikertelen.');
  }

  onProgress?.({ step: 'done', done: 1, total: 1 });
  return json;
}

export async function uploadImages({
  files,
  bucket,
  kind,
  entityType,
  entityId,
  folder,
  onProgress,
  fetchImpl = fetch,
}) {
  const list = Array.from(files || []).filter(isImageFile);
  const results = [];
  for (let i = 0; i < list.length; i += 1) {
    onProgress?.({ step: 'uploading', index: i, done: i, total: list.length });
    const result = await uploadImage({
      file: list[i],
      bucket,
      kind,
      entityType,
      entityId,
      folder,
      fileName: list[i].name,
      onProgress,
      fetchImpl,
    });
    results.push(result);
  }
  return results;
}
