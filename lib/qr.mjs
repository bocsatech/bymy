/**
 * Same-origin QR cél-URL ellenőrzés + PNG buffer.
 */
import QRCode from "qrcode";

const ALLOWED_HOST_SUFFIXES = ["bymy.hu", "bymy.vercel.app", "localhost", "127.0.0.1"];

export function isAllowedQrTarget(raw, { requestHost = "" } = {}) {
  const s = String(raw || "").trim();
  if (!s) return false;
  try {
    if (s.startsWith("/")) {
      if (s.startsWith("//")) return false;
      return s.length < 2000;
    }
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    const req = String(requestHost || "")
      .split(":")[0]
      .toLowerCase();
    if (req && host === req) return true;
    return ALLOWED_HOST_SUFFIXES.some((sfx) => host === sfx || host.endsWith(`.${sfx}`));
  } catch {
    return false;
  }
}

/** Relatív path → abszolút URL a request origin alapján. */
export function resolveQrTargetUrl(raw, { origin = "" } = {}) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (s.startsWith("/")) {
    const base = String(origin || "").replace(/\/$/, "");
    if (!base) return null;
    return `${base}${s}`;
  }
  return s;
}

export async function qrPngBuffer(text, { size = 240, margin = 1 } = {}) {
  return QRCode.toBuffer(String(text), {
    type: "png",
    width: Math.min(512, Math.max(120, Number(size) || 240)),
    margin: Math.min(4, Math.max(0, Number(margin) || 1)),
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}
