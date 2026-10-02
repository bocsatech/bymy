#!/usr/bin/env node
/**
 * Content-hash fingerprint: ?v=… cseréje fájltartalom hash-re.
 * HTML script/link + JS import/from URL-ek. Deploy előtt / Vercel build-ben fut.
 *
 *   node scripts/asset-fingerprint.mjs
 */
import { createHash } from "crypto";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, dirname, extname, resolve, relative } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");

const hashCache = new Map();

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else out.push(abs);
  }
  return out;
}

function shortHash(absPath) {
  if (hashCache.has(absPath)) return hashCache.get(absPath);
  const buf = readFileSync(absPath);
  const h = createHash("sha1").update(buf).digest("hex").slice(0, 10);
  hashCache.set(absPath, h);
  return h;
}

function resolvePublicAsset(spec, fromFile) {
  const clean = String(spec || "").split("?")[0].split("#")[0];
  if (!clean) return null;
  let abs;
  if (clean.startsWith("/")) {
    abs = join(PUBLIC, clean.replace(/^\/+/, ""));
  } else {
    abs = resolve(dirname(fromFile), clean);
  }
  if (!abs.startsWith(PUBLIC)) return null;
  if (!existsSync(abs) || !statSync(abs).isFile()) return null;
  return abs;
}

function withHash(url, fromFile) {
  const m = String(url).match(/^([^?#]+)(\?[^#]*)?(#.*)?$/);
  if (!m) return url;
  const pathPart = m[1];
  const hashPart = m[3] || "";
  if (!/\.(js|css|mjs|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf)$/i.test(pathPart)) {
    return url;
  }
  const abs = resolvePublicAsset(pathPart, fromFile);
  if (!abs) return url;
  const v = shortHash(abs);
  return `${pathPart}?v=${v}${hashPart}`;
}

function rewriteHtml(text, fromFile) {
  return text.replace(
    /\b(href|src)=["']([^"']+)["']/gi,
    (full, attr, url) => {
      if (/^https?:\/\//i.test(url) || url.startsWith("data:") || url.startsWith("#")) {
        return full;
      }
      const next = withHash(url, fromFile);
      if (next === url) return full;
      return `${attr}="${next}"`;
    }
  );
}

function rewriteJs(text, fromFile) {
  // import/export from "…?v="
  let out = text.replace(
    /(\bfrom\s+|import\s*\(\s*)(["'])([^"']+\.(?:js|mjs|css))(\?[^"']*)?(["'])/g,
    (full, prefix, q1, pathPart, _qv, q2) => {
      const next = withHash(pathPart, fromFile);
      return `${prefix}${q1}${next}${q2}`;
    }
  );
  // bare import "….js?v="
  out = out.replace(
    /(\bimport\s+)(["'])([^"']+\.(?:js|mjs|css))(\?[^"']*)?(["'])/g,
    (full, prefix, q1, pathPart, _qv, q2) => {
      const next = withHash(pathPart, fromFile);
      return `${prefix}${q1}${next}${q2}`;
    }
  );
  return out;
}

function main() {
  let totalChanged = 0;
  for (let pass = 1; pass <= 8; pass += 1) {
    hashCache.clear();
    const htmlFiles = walk(PUBLIC).filter((f) => extname(f).toLowerCase() === ".html");
    const jsFiles = walk(join(PUBLIC, "js")).filter((f) => /\.(js|mjs)$/i.test(f));
    let changed = 0;

    for (const file of [...jsFiles, ...htmlFiles]) {
      const before = readFileSync(file, "utf8");
      const after =
        extname(file).toLowerCase() === ".html" ? rewriteHtml(before, file) : rewriteJs(before, file);
      if (after !== before) {
        writeFileSync(file, after);
        changed += 1;
      }
    }
    totalChanged += changed;
    console.log(`pass ${pass}: ${changed} fájl`);
    if (changed === 0) break;
  }

  const manifest = {};
  for (const [abs, h] of hashCache) {
    manifest["/" + relative(PUBLIC, abs).split("\\").join("/")] = h;
  }
  writeFileSync(join(PUBLIC, "asset-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`asset-fingerprint: összesen ${totalChanged} írás, ${Object.keys(manifest).length} hash`);
}

main();
