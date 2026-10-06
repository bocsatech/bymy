import sharp from "sharp";

/**
 * Halvány, középre égetett "Bymy" vízjel (HA-szerű védelem).
 * Listing képekre feltöltéskor.
 */
export async function applyCenteredBymyWatermark(imageBuffer) {
  const rotated = await sharp(imageBuffer).rotate().toBuffer();
  const meta = await sharp(rotated).metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  if (!width || !height) return rotated;

  const fontSize = Math.max(28, Math.round(width * 0.07));
  const x = width / 2;
  const y = height / 2;
  const label = "Bymy";

  const svg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="${x + 2}" y="${y + 2}" text-anchor="middle" dominant-baseline="middle"
    font-family="Arial Narrow, Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700"
    font-style="italic" letter-spacing="1"
    fill="#000000" fill-opacity="0.10">${label}</text>
  <text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle"
    font-family="Arial Narrow, Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700"
    font-style="italic" letter-spacing="1"
    fill="#ffffff" fill-opacity="0.22">${label}</text>
</svg>`);

  const overlay = await sharp(svg).png().toBuffer();
  return sharp(rotated).composite([{ input: overlay, left: 0, top: 0 }]).toBuffer();
}
