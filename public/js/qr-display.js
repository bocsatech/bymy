/** QR cél-URL + img src a /api/qr.png végponthoz. */

export function withQrSource(url) {
  try {
    const u = new URL(url, window.location.origin);
    u.searchParams.set("src", "qr");
    u.hash = "";
    return u.toString();
  } catch {
    return String(url || "");
  }
}

export function qrImageSrc(absoluteOrPath, { size = 200 } = {}) {
  const target = withQrSource(absoluteOrPath);
  return `/api/qr.png?u=${encodeURIComponent(target)}&size=${encodeURIComponent(String(size))}`;
}

export function qrBlockHtml({ url, label = "QR kód", size = 160 } = {}) {
  const src = qrImageSrc(url, { size });
  const safeLabel = String(label || "QR kód")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
  return `<div class="bymy-qr" data-bymy-qr>
    <img class="bymy-qr__img" src="${src}" width="${size}" height="${size}" alt="${safeLabel}" decoding="async" />
    <p class="bymy-qr__label">${safeLabel}</p>
  </div>`;
}
