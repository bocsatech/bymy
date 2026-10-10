/** Demó képek: docs/design-demos/piac-alkategoria-dobkerek-4.html A–D */
import { chromium } from "playwright";
import path from "node:path";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const ROOT = path.resolve("docs/design-demos");
const HTML = "piac-alkategoria-dobkerek-4.html";
const OUT = ROOT;
const VARIANTS = ["a", "b", "c", "d"];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = urlPath === "/" ? HTML : urlPath.replace(/^\//, "");
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT)) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      try {
        const buf = await readFile(file);
        res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
        res.end(buf);
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

const { server, base } = await startServer();
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.HOME +
    "/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
});
const page = await browser.newPage({
  viewport: { width: 1100, height: 980 },
  deviceScaleFactor: 2,
});

await page.goto(`${base}/${HTML}`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(600);

for (const v of VARIANTS) {
  const el = page.locator(`[data-shot="${v}"] [data-frame]`);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const file = path.join(OUT, `piac-alkategoria-dobkerek-${v}.png`);
  await el.screenshot({ path: file, type: "png" });
  console.log(`ok ${v} -> ${file}`);
}

const all = page.locator("body");
await page.evaluate(() => window.scrollTo(0, 0));
await page.setViewportSize({ width: 1100, height: 3200 });
await page.waitForTimeout(200);
await all.screenshot({
  path: path.join(OUT, "piac-alkategoria-dobkerek-4-all.png"),
  type: "png",
  fullPage: true,
});
console.log("ok all");

await browser.close();
server.close();
