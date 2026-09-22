
export const PHOTO_OVERLAY_TEMPLATES = [
  {
    id: "soft-left-v1",
    label: "Bymy bal sáv",
    description: "Gradiens + ikonos adatsorok (hiányzó mező kimarad)",
  },
];

export const DEFAULT_PHOTO_OVERLAY_ID = PHOTO_OVERLAY_TEMPLATES[0].id;

const OVERLAY_ICONS = {
  calendar: (ctx, x, y, s) => {
    ctx.strokeRect(x + 2, y + 3, s - 4, s - 6);
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 6);
    ctx.lineTo(x + s - 2, y + 6);
    ctx.stroke();
  },
  odometer: (ctx, x, y, s) => {
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s / 2 - 2, 0, Math.PI * 1.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + s / 2, y + s / 2);
    ctx.lineTo(x + s / 2 + 4, y + 4);
    ctx.stroke();
  },
  engine: (ctx, x, y, s) => {
    ctx.strokeRect(x + 3, y + 4, s - 8, s - 8);
    ctx.beginPath();
    ctx.moveTo(x + s / 2, y + 2);
    ctx.lineTo(x + s / 2, y + 4);
    ctx.stroke();
  },
  drive: (ctx, x, y, s) => {
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2 + 1, 4, 0, Math.PI * 2);
    ctx.moveTo(x + 3, y + s - 3);
    ctx.lineTo(x + s - 3, y + s - 3);
    ctx.stroke();
  },
  gearbox: (ctx, x, y, s) => {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x + 5 + i * 5, y + s / 2, 2.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  },
  body: (ctx, x, y, s) => {
    ctx.beginPath();
    ctx.moveTo(x + 2, y + s - 3);
    ctx.lineTo(x + 5, y + 5);
    ctx.lineTo(x + s - 5, y + 5);
    ctx.lineTo(x + s - 2, y + s - 3);
    ctx.closePath();
    ctx.stroke();
  },
  door: (ctx, x, y, s) => {
    ctx.strokeRect(x + 4, y + 3, s - 8, s - 6);
    ctx.beginPath();
    ctx.arc(x + s - 6, y + s / 2, 1.2, 0, Math.PI * 2);
    ctx.fill();
  },
  seat: (ctx, x, y, s) => {
    ctx.beginPath();
    ctx.moveTo(x + 3, y + s - 2);
    ctx.quadraticCurveTo(x + s / 2, y + 2, x + s - 3, y + s - 2);
    ctx.stroke();
    ctx.strokeRect(x + 5, y + 5, s - 10, 4);
  },
};

export async function renderListingPhotoOverlay(src, info = {}) {
  const templateId = info.templateId || DEFAULT_PHOTO_OVERLAY_ID;
  if (templateId !== "soft-left-v1") {
    throw new Error("Ismeretlen sablon.");
  }

  const img = await loadImageForCanvas(src);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error("A kép mérete nem olvasható.");

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("A sablon nem rajzolható.");

  drawCoverImage(ctx, img, w, h);

  const panelW = Math.round(w * 0.34);
  const grad = ctx.createLinearGradient(0, 0, panelW + 80, 0);
  grad.addColorStop(0, "rgba(11, 18, 32, 0.88)");
  grad.addColorStop(1, "rgba(11, 18, 32, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const pad = Math.round(w * 0.028);
  let y = pad;

  roundRect(ctx, pad, y, Math.round(w * 0.11), 28, 8);
  ctx.fillStyle = "#f0c52c";
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.font = `800 13px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("BYMY", pad + Math.round(w * 0.055), y + 14);
  ctx.textAlign = "left";
  y += 44;

  const dealer = clean(info.dealer);
  if (dealer) {
    ctx.fillStyle = "#f0f3f8";
    ctx.font = `600 ${Math.round(w * 0.013)}px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText(clip(ctx, dealer, panelW - pad), pad, y);
    y += 22;
  }

  const brand = clean(info.brand);
  const model = clean(info.model);
  ctx.fillStyle = "#fff";
  ctx.font = `800 ${Math.round(w * 0.034)}px "Helvetica Neue", Arial, sans-serif`;
  if (brand) {
    ctx.fillText(clip(ctx, brand, panelW - pad), pad, y + 32);
    y += 40;
  }
  if (model) {
    ctx.font = `600 ${Math.round(w * 0.017)}px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = "#dce4f0";
    ctx.fillText(clip(ctx, model, panelW - pad), pad, y);
    y += 26;
  }

  const rows = buildSpecRows(info);
  drawSpecList(ctx, rows, pad, y + 16, panelW - pad, Math.round(h * 0.038), 18, Math.round(w * 0.015));

  return canvas.toDataURL("image/jpeg", 0.88);
}

function buildSpecRows(info) {
  const rows = [];
  const year = clean(info.year);
  const km = formatKm(info.km);
  const power = formatPowerLine(info);
  const drive = clean(info.drive);
  const gearbox = clean(info.gearbox);
  const body = clean(info.body);
  const doors = clean(info.doors);
  const seats = clean(info.seats);

  if (year) rows.push({ icon: "calendar", text: `Évjárat: ${year}` });
  if (km) rows.push({ icon: "odometer", text: km });
  if (power) rows.push({ icon: "engine", text: power });
  if (drive) rows.push({ icon: "drive", text: `Hajtás: ${drive}` });
  if (gearbox) rows.push({ icon: "gearbox", text: `Váltó: ${gearbox}` });
  if (body) rows.push({ icon: "body", text: `Kivitel: ${body}` });
  if (doors) rows.push({ icon: "door", text: `Ajtók: ${doors}` });
  if (seats) rows.push({ icon: "seat", text: `Személy: ${seats}` });
  return rows;
}

function formatPowerLine(info) {
  const kw = clean(info.kw);
  const le = clean(info.le);
  const fuel = clean(info.fuel);
  const legacy = clean(info.power);
  const parts = [];
  if (kw) parts.push(`${kw} kW`);
  if (le) parts.push(`(${le} LE)`);
  if (fuel) parts.push(fuel);
  if (parts.length) return parts.join(" ");
  return legacy;
}

function drawIcon(ctx, name, x, y, size) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const fn = OVERLAY_ICONS[name] || OVERLAY_ICONS.engine;
  fn(ctx, x, y, size);
  ctx.restore();
}

function drawSpecList(ctx, rows, x, y, maxW, lineH, iconSize, fontSize) {
  ctx.font = `500 ${fontSize}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = "#e8edf5";
  ctx.textBaseline = "middle";
  let cy = y;
  for (const row of rows) {
    drawIcon(ctx, row.icon, x, cy - iconSize / 2, iconSize);
    ctx.fillText(clip(ctx, row.text, maxW - iconSize - 14), x + iconSize + 10, cy);
    cy += lineH;
  }
  return cy;
}

function drawCoverImage(ctx, img, w, h) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (w - dw) / 2;
  const dy = (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function clean(value) {
  return String(value ?? "").trim();
}

function formatKm(value) {
  const n = Number(String(value ?? "").replace(/\D/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${n.toLocaleString("hu-HU")} km`;
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

function isCrossOriginSrc(src) {
  const raw = String(src ?? "").trim();
  if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return false;
  try {
    return new URL(raw, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (isCrossOriginSrc(src)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("A kép nem tölthető be a sablonhoz."));
    img.src = src;
  });
}

async function fetchImageDataUrl(url) {
  let fetchUrl = String(url ?? "").trim();
  if (!fetchUrl) throw new Error("A kép nem tölthető be a sablonhoz.");
  try {
    const parsed = new URL(fetchUrl, window.location.href);
    if (parsed.origin !== window.location.origin) {
      fetchUrl = `/api/media/proxy?url=${encodeURIComponent(fetchUrl)}`;
    }
  } catch {
    fetchUrl = `/api/media/proxy?url=${encodeURIComponent(fetchUrl)}`;
  }
  const res = await fetch(fetchUrl, { credentials: "same-origin" });
  if (!res.ok) throw new Error("A kép nem tölthető be a sablonhoz.");
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("A kép nem tölthető be a sablonhoz."));
    reader.readAsDataURL(blob);
  });
}

export async function loadImageForCanvas(src) {
  const raw = String(src ?? "").trim();
  if (!raw) throw new Error("A kép nem tölthető be a sablonhoz.");
  if (raw.startsWith("data:") || raw.startsWith("blob:") || !isCrossOriginSrc(raw)) {
    try {
      return await loadImage(raw);
    } catch (error) {
      if (raw.startsWith("data:") || raw.startsWith("blob:")) throw error;
    }
  }
  const dataUrl = await fetchImageDataUrl(raw);
  return loadImage(dataUrl);
}

/** Baked-in soft-left-v1 overlay (sárga BYMY badge a bal felső sarokban). */
export async function detectBymyPhotoOverlay(src) {
  try {
    const img = await loadImageForCanvas(src);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return false;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, w, h);

    const maxX = Math.min(Math.floor(w * 0.16), w);
    const maxY = Math.min(Math.floor(h * 0.14), h);
    let yellowHits = 0;
    for (let y = 2; y < maxY; y += 2) {
      for (let x = 2; x < maxX; x += 2) {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        if (r > 195 && g > 150 && g < 235 && b < 95) yellowHits += 1;
      }
    }
    if (yellowHits >= 3) return true;

    const lx = Math.max(2, Math.floor(w * 0.04));
    const rx = Math.min(w - 2, Math.floor(w * 0.72));
    const cy = Math.floor(h * 0.35);
    const left = ctx.getImageData(lx, cy, 1, 1).data;
    const right = ctx.getImageData(rx, cy, 1, 1).data;
    const lum = (p) => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
    return lum(left) < 55 && lum(right) - lum(left) > 35 && yellowHits >= 1;
  } catch {
    return false;
  }
}
