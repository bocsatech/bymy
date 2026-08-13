/** Fő kép letöltés — tartós mappa: ~/.autosweb/uploads/listings/ (túléli a frissítést). */

import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEGACY_UPLOAD_DIR = join(__dirname, "..", "public", "uploads", "listings");

function stableUploadDir() {
  if (process.env.AUTOSWEB_UPLOADS_PATH) return process.env.AUTOSWEB_UPLOADS_PATH;
  return join(homedir(), ".autosweb", "uploads", "listings");
}

let migratedLegacy = false;

function migrateLegacyUploadsIfNeeded(destDir) {
  if (migratedLegacy) return;
  migratedLegacy = true;
  if (!existsSync(LEGACY_UPLOAD_DIR)) return;
  try {
    for (const name of readdirSync(LEGACY_UPLOAD_DIR)) {
      if (name.startsWith(".")) continue;
      const from = join(LEGACY_UPLOAD_DIR, name);
      const to = join(destDir, name);
      if (!existsSync(to)) {
        try {
          copyFileSync(from, to);
        } catch {
          /* ignore single file */
        }
      }
    }
  } catch {
    /* ignore */
  }
}

export function listingImageDir() {
  const dir = stableUploadDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  migrateLegacyUploadsIfNeeded(dir);
  return dir;
}

/** Törli a helyi hirdetésképeket (~/.autosweb/uploads/listings). */
export function clearListingImageFiles() {
  const dir = listingImageDir();
  let removed = 0;
  try {
    for (const name of readdirSync(dir)) {
      if (name.startsWith(".")) continue;
      try {
        unlinkSync(join(dir, name));
        removed += 1;
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  return { removed, dir };
}

export function listingImagePublicPath(fileName) {
  return `/uploads/listings/${fileName}`;
}

/** Abszolút fájlútvonal a /uploads/listings/… URL-hez, vagy null. */
export function resolveListingImageFile(urlPath) {
  const rel = String(urlPath || "").replace(/^\/+/, "");
  if (!rel.startsWith("uploads/listings/")) return null;
  const name = rel.slice("uploads/listings/".length);
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) return null;
  const primary = join(listingImageDir(), name);
  if (existsSync(primary)) return primary;
  const legacy = join(LEGACY_UPLOAD_DIR, name);
  if (existsSync(legacy)) return legacy;
  return null;
}

export function isAllowedRemoteImageUrl(raw) {
  try {
    const u = new URL(String(raw || "").trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    return (
      host === "hasznaltauto.hu" ||
      host.endsWith(".hasznaltauto.hu") ||
      host.includes("hasznaltauto")
    );
  } catch {
    return false;
  }
}

/** Böngészőben megjelenítendő URL — távoli kép proxyn át (hotlink ellen). */
export function displayImageUrl(foKep) {
  const path = String(foKep || "").trim();
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) {
    if (!isAllowedRemoteImageUrl(path)) return "";
    return `/api/media/proxy?url=${encodeURIComponent(path)}`;
  }
  if (path.startsWith("/uploads/listings/")) {
    return resolveListingImageFile(path) ? path : "";
  }
  if (path.startsWith("/api/media/proxy")) return path;
  return "";
}

/** True ha nincs fo_kep, vagy helyi fájl hiányzik. Távoli https URL = OK (proxyn keresztül). */
export function isListingImageMissing(foKep) {
  const path = String(foKep || "").trim();
  if (!path) return true;
  if (/^https?:\/\//i.test(path)) return !isAllowedRemoteImageUrl(path);
  if (path.startsWith("/api/media/proxy")) return false;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return !resolveListingImageFile(normalized);
}

export async function extractMainImageUrl(page) {
  return page.evaluate(() => {
    const pick = (src) => {
      if (!src || !/^https?:\/\//i.test(src)) return null;
      if (/logo|sprite|icon|pixel|avatar|badge|placeholder/i.test(src)) return null;
      return src;
    };

    const og = document.querySelector('meta[property="og:image"]')?.getAttribute("content");
    if (pick(og)) return pick(og);

    const twitter = document.querySelector('meta[name="twitter:image"]')?.getAttribute("content");
    if (pick(twitter)) return pick(twitter);

    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(script.textContent || "");
        const nodes = Array.isArray(data) ? data : [data];
        for (const node of nodes) {
          const img = node?.image;
          const candidate = Array.isArray(img) ? img[0] : typeof img === "string" ? img : img?.url;
          if (pick(candidate)) return pick(candidate);
        }
      } catch {
        /* ignore */
      }
    }

    const selectors = [
      ".swiper-slide-active img",
      ".swiper-slide img",
      "[class*='gallery'] img",
      "[class*='Gallery'] img",
      "[class*='kepek'] img",
      "[class*='foto'] img",
      "[class*='photo'] img",
      "picture source",
      "img[src*='hasznaltauto']",
      "img[data-src*='hasznaltauto']",
      "img[srcset*='hasznaltauto']",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      if (el.tagName === "SOURCE") {
        const srcset = el.getAttribute("srcset") || "";
        const first = srcset.split(",")[0]?.trim().split(/\s+/)[0];
        if (pick(first)) return pick(first);
      }
      const src =
        el.currentSrc ||
        el.src ||
        el.getAttribute("data-src") ||
        el.getAttribute("data-lazy") ||
        (el.getAttribute("srcset") || "").split(",")[0]?.trim().split(/\s+/)[0];
      if (pick(src)) return pick(src);
    }
    return null;
  });
}

function extFromUrl(url) {
  const path = String(url).split("?")[0];
  const m = path.match(/\.(jpe?g|png|webp)$/i);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
}

function sniffExt(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "jpg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "png";
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return "webp";
  }
  return null;
}

async function downloadViaPageFetch(page, imageUrl) {
  try {
    const bytes = await page.evaluate(async (url) => {
      const res = await fetch(url, { credentials: "include", mode: "cors" });
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 500) return null;
      return Array.from(new Uint8Array(buf));
    }, imageUrl);
    if (!bytes?.length) return null;
    return Buffer.from(bytes);
  } catch {
    return null;
  }
}

/**
 * Letölti a fő képet. Vissza: publikus útvonal vagy null.
 * @param {import('playwright').Page} page
 * @param {string} imageUrl
 * @param {string} listingKey — pl. hasznaltauto id
 */
export async function downloadMainImage(page, imageUrl, listingKey) {
  if (!imageUrl || !listingKey) return null;
  const safeKey = String(listingKey).replace(/[^\w.-]+/g, "_").slice(0, 64);
  if (!safeKey) return null;

  let buffer = null;
  try {
    const response = await page.context().request.get(imageUrl, {
      timeout: 30000,
      headers: {
        Referer: "https://www.hasznaltauto.hu/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });
    if (response.ok()) {
      buffer = Buffer.from(await response.body());
      if (buffer.length < 500) buffer = null;
    }
  } catch {
    buffer = null;
  }

  if (!buffer && page) {
    buffer = await downloadViaPageFetch(page, imageUrl);
  }

  if (!buffer) return null;

  const ext = sniffExt(buffer) || extFromUrl(imageUrl);
  const fileName = `${safeKey}.${ext}`;
  const dest = join(listingImageDir(), fileName);
  writeFileSync(dest, buffer);
  return listingImagePublicPath(fileName);
}

/** Szerver oldali proxy: távoli kép lekérése Referer-rel. */
export async function fetchRemoteListingImage(imageUrl) {
  if (!isAllowedRemoteImageUrl(imageUrl)) {
    const err = new Error("Nem engedélyezett kép URL.");
    err.code = "FORBIDDEN_IMAGE";
    throw err;
  }
  const response = await fetch(imageUrl, {
    headers: {
      Referer: "https://www.hasznaltauto.hu/",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
  });
  if (!response.ok) {
    const err = new Error(`Kép letöltés sikertelen (${response.status}).`);
    err.code = "FETCH_FAILED";
    throw err;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 500) {
    const err = new Error("Üres / túl kicsi kép.");
    err.code = "EMPTY_IMAGE";
    throw err;
  }
  const contentType =
    response.headers.get("content-type") ||
    (sniffExt(buffer) === "png"
      ? "image/png"
      : sniffExt(buffer) === "webp"
        ? "image/webp"
        : "image/jpeg");
  return { buffer, contentType };
}
