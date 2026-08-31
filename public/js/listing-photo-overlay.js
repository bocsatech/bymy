/**
 * Hirdetés fotó sablon overlay (előnézet / mentés).
 * Egyelőre egy sablon; később több választható + előnézet.
 */

export const PHOTO_OVERLAY_TEMPLATES = [
  {
    id: "soft-left-v1",
    label: "Soft bal sáv",
    description: "Félig átlátszó bal gradiens + adatok",
  },
];

export const DEFAULT_PHOTO_OVERLAY_ID = PHOTO_OVERLAY_TEMPLATES[0].id;

/**
 * @param {string} src image URL or data URL
 * @param {{
 *   templateId?: string,
 *   brand?: string,
 *   model?: string,
 *   year?: string,
 *   km?: string,
 *   power?: string,
 *   fuel?: string,
 *   price?: string,
 *   place?: string,
 * }} [info]
 * @returns {Promise<string>} PNG data URL
 */
export async function renderListingPhotoOverlay(src, info = {}) {
  const templateId = info.templateId || DEFAULT_PHOTO_OVERLAY_ID;
  if (templateId !== "soft-left-v1") {
    throw new Error("Ismeretlen sablon.");
  }

  const img = await loadImage(src);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error("A kép mérete nem olvasható.");

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("A sablon nem rajzolható.");

  ctx.drawImage(img, 0, 0, w, h);

  // Soft bal + alsó veil
  const left = ctx.createLinearGradient(0, 0, w, 0);
  left.addColorStop(0, "rgba(11,18,32,0.82)");
  left.addColorStop(0.42, "rgba(11,18,32,0.48)");
  left.addColorStop(0.72, "rgba(11,18,32,0.08)");
  left.addColorStop(1, "rgba(11,18,32,0)");
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, w, h);

  const bottom = ctx.createLinearGradient(0, 0, 0, h);
  bottom.addColorStop(0, "rgba(11,18,32,0)");
  bottom.addColorStop(0.45, "rgba(11,18,32,0)");
  bottom.addColorStop(1, "rgba(11,18,32,0.55)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, 0, w, h);

  const pad = Math.round(w * 0.035);
  const brand = clean(info.brand) || "Autó";
  const model = clean(info.model);
  const year = clean(info.year);
  const km = formatKm(info.km);
  const power = clean(info.power);
  const fuel = clean(info.fuel);
  const price = formatPrice(info.price);
  const place = clean(info.place) || "bymy";

  // Badge
  const badgeH = Math.max(22, Math.round(h * 0.036));
  const badgeW = Math.round(badgeH * 4.2);
  roundRect(ctx, pad, pad, badgeW, badgeH, Math.round(badgeH * 0.28));
  ctx.fillStyle = "#f0c52c";
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.font = `800 ${Math.round(badgeH * 0.48)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SABLON", pad + badgeW / 2, pad + badgeH / 2 + 0.5);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  const titleSize = Math.max(28, Math.round(w * 0.042));
  ctx.font = `800 ${titleSize}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(clip(ctx, brand, w * 0.55), pad, pad + badgeH + titleSize + 18);

  let y = pad + badgeH + titleSize + 18;
  if (model) {
    const modelSize = Math.max(16, Math.round(w * 0.026));
    ctx.font = `600 ${modelSize}px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = "#f0f3f8";
    y += modelSize + 10;
    ctx.fillText(clip(ctx, model, w * 0.55), pad, y);
  }

  const lines = [
    year ? `${year} · első forgalomba helyezés` : "",
    km,
    [power, fuel].filter(Boolean).join(" · "),
  ].filter(Boolean);

  const lineSize = Math.max(14, Math.round(w * 0.016));
  ctx.font = `500 ${lineSize}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = "#e8edf5";
  y += lineSize + 18;
  for (const line of lines) {
    ctx.fillText(clip(ctx, `●  ${line}`, w * 0.52), pad, y);
    y += lineSize + 12;
  }

  if (price) {
    const priceSize = Math.max(20, Math.round(w * 0.028));
    ctx.font = `800 ${priceSize}px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = "#f0c52c";
    ctx.fillText(price, pad, h - pad - lineSize - 8);
  }
  ctx.font = `500 ${Math.max(12, Math.round(w * 0.014))}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = "#d7deea";
  ctx.fillText(clip(ctx, place, w * 0.55), pad, h - pad);

  return canvas.toDataURL("image/jpeg", 0.88);
}

function clean(value) {
  return String(value ?? "").trim();
}

function formatKm(value) {
  const n = Number(String(value ?? "").replace(/\D/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${n.toLocaleString("hu-HU")} km`;
}

function formatPrice(value) {
  const n = Number(String(value ?? "").replace(/\D/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${n.toLocaleString("hu-HU")} Ft`;
}

function clip(ctx, text, maxWidth) {
  const raw = String(text ?? "");
  if (ctx.measureText(raw).width <= maxWidth) return raw;
  let out = raw;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const isRemote = /^https?:/i.test(src);
    if (isRemote) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("A kép nem tölthető be a sablonhoz."));
    img.src = src;
  });
}
