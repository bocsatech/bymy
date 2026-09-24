import { upgradeHaImageUrl } from "./listing-image.mjs";

function escAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function plain(value, max = 200) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

/** Facebook / WhatsApp / iMessage előnézet crawler. */
export function isSocialShareCrawler(req) {
  const ua = String(req?.headers?.["user-agent"] ?? "");
  return /facebookexternalhit|Facebot|FacebookBot|Twitterbot|LinkedInBot|Slackbot|WhatsApp|TelegramBot|Discordbot|Pinterest|vkShare|Googlebot/i.test(
    ua
  );
}

function absoluteImageUrl(raw, baseUrl) {
  let path = String(raw ?? "").trim();
  if (!path || path.startsWith("data:")) return "";
  if (path.startsWith("/api/media/proxy")) {
    try {
      const inner = new URL(path, baseUrl).searchParams.get("url");
      if (inner) path = inner;
    } catch {
      /* keep */
    }
  }
  path = upgradeHaImageUrl(path) || path;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/")) return `${baseUrl}${path}`;
  return "";
}

/**
 * @param {{ listing: object, baseUrl: string }} opts
 * listing: getListing(..., { mode: "detail" }) eredmény
 */
export function buildListingOpenGraph({ listing, baseUrl } = {}) {
  const root = String(baseUrl || "").replace(/\/$/, "");
  const id = Number(listing?.id);
  if (!root || !Number.isFinite(id) || id <= 0) return null;

  const detail = listing.detail || {};
  const title = plain(detail.title || listing.hirdetes_cime || `Hirdetés #${id}`, 110);
  const price = plain(detail.price, 40);
  const year = plain(detail.year, 8);
  const km = plain(detail.km, 24);
  const city = plain(
    (Array.isArray(detail.addressLines) && detail.addressLines.slice(-1)[0]) || "",
    60
  );
  const bits = [price !== "—" ? price : "", year !== "—" ? year : "", km !== "—" ? km : "", city].filter(
    Boolean
  );
  const description =
    plain(detail.description, 160) ||
    plain(bits.length ? `${bits.join(" · ")} — Bymy` : "Hirdetés a Bymy-n", 180);

  const image =
    absoluteImageUrl(listing.fo_kep, root) ||
    absoluteImageUrl(detail.imageUrl || detail.images?.[0], root) ||
    "";

  const url = `${root}/hirdetes.html?id=${id}`;

  return {
    title: `${title} | Bymy`,
    description,
    url,
    image,
    siteName: "Bymy",
  };
}

export function openGraphHeadHtml(og) {
  if (!og) return "";
  const tags = [
    `<title>${escAttr(og.title)}</title>`,
    `<meta name="description" content="${escAttr(og.description)}" />`,
    `<link rel="canonical" href="${escAttr(og.url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escAttr(og.siteName || "Bymy")}" />`,
    `<meta property="og:locale" content="hu_HU" />`,
    `<meta property="og:url" content="${escAttr(og.url)}" />`,
    `<meta property="og:title" content="${escAttr(og.title)}" />`,
    `<meta property="og:description" content="${escAttr(og.description)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escAttr(og.title)}" />`,
    `<meta name="twitter:description" content="${escAttr(og.description)}" />`,
  ];
  if (og.image) {
    tags.push(`<meta property="og:image" content="${escAttr(og.image)}" />`);
    tags.push(`<meta property="og:image:secure_url" content="${escAttr(og.image)}" />`);
    tags.push(`<meta name="twitter:image" content="${escAttr(og.image)}" />`);
  }
  return tags.join("\n    ");
}

/** Beilleszti / lecseréli a title + OG meta blokkot a </head> elé. */
export function injectOpenGraphIntoHtml(html, og) {
  if (!html || !og) return html;
  const block = openGraphHeadHtml(og);
  let next = String(html);
  next = next.replace(/<title>[^<]*<\/title>/i, "");
  next = next.replace(/\s*<meta\s+name="description"[^>]*>/gi, "");
  next = next.replace(/\s*<link\s+rel="canonical"[^>]*>/gi, "");
  next = next.replace(/\s*<meta\s+property="og:[^"]+"[^>]*>/gi, "");
  next = next.replace(/\s*<meta\s+name="twitter:[^"]+"[^>]*>/gi, "");
  if (/<\/head>/i.test(next)) {
    return next.replace(/<\/head>/i, `    ${block}\n  </head>`);
  }
  return `${block}\n${next}`;
}
