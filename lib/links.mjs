const HASZNALTAUTO_HOST = "hasznaltauto.hu";
const LISTING_PATH_RE = /\/szemelyauto\/.+-\d{5,}$/i;
const LISTING_URL_RE = /https?:\/\/(?:www\.)?hasznaltauto\.hu\/szemelyauto\/.+-\d{5,}/gi;

export function isHasznaltautoUrl(input) {
  try {
    const url = new URL(String(input ?? "").trim());
    return url.hostname.replace(/^www\./, "") === HASZNALTAUTO_HOST;
  } catch {
    return false;
  }
}

export function isListingUrl(input) {
  if (!isHasznaltautoUrl(input)) return false;
  return LISTING_PATH_RE.test(new URL(input).pathname);
}

export function isListPageUrl(input) {
  return isHasznaltautoUrl(input) && !isListingUrl(input);
}

export function normalizeListingHref(href, baseUrl) {
  try {
    const absolute = new URL(href, baseUrl);
    if (absolute.hostname.replace(/^www\./, "") !== HASZNALTAUTO_HOST) return null;
    if (!LISTING_PATH_RE.test(absolute.pathname)) return null;
    absolute.hash = "";
    absolute.search = "";
    return absolute.toString();
  } catch {
    return null;
  }
}

export function extractListingLinksFromHtml(html, baseUrl) {
  const found = new Set();
  for (const pattern of [/href="([^"]+)"/gi, /href='([^']+)'/gi]) {
    for (const match of html.matchAll(pattern)) {
      const normalized = normalizeListingHref(match[1], baseUrl);
      if (normalized) found.add(normalized);
    }
  }
  for (const match of html.matchAll(LISTING_URL_RE)) {
    const normalized = normalizeListingHref(match[0], baseUrl);
    if (normalized) found.add(normalized);
  }
  return [...found].sort((a, b) => a.localeCompare(b, "hu"));
}

export async function collectListingLinksFromPage(page, baseUrl) {
  const hrefs = await page.evaluate(() => {
    const found = new Set();
    document.querySelectorAll("a[href]").forEach((a) => found.add(a.href));
    document.querySelectorAll("[data-href], [data-url]").forEach((node) => {
      const v = node.getAttribute("data-href") || node.getAttribute("data-url");
      if (v) found.add(v);
    });
    return [...found];
  });

  const unique = new Set();
  for (const href of hrefs) {
    const normalized = normalizeListingHref(href, baseUrl);
    if (normalized) unique.add(normalized);
  }
  for (const link of extractListingLinksFromHtml(await page.content(), baseUrl)) {
    unique.add(link);
  }
  return [...unique].sort((a, b) => a.localeCompare(b, "hu"));
}

export async function extractListingCardsFromPage(page) {
  return page.evaluate(() => {
    const listingRe = /\/szemelyauto\/[^?#]+-\d{5,}/i;
    const seen = new Set();
    const cards = [];

    const addCard = (url, container, title) => {
      try {
        const absolute = new URL(url, window.location.href);
        if (!listingRe.test(absolute.pathname)) return;
        const clean = `${absolute.origin}${absolute.pathname}`;
        if (seen.has(clean)) return;
        seen.add(clean);
        const text = (container || document.body).innerText?.replace(/\s+/g, " ").trim() ?? "";
        let kmText = "";
        const infoNodes = (container || document.body).querySelectorAll(
          ".talalatisor-infokontener, .talalatisor-infokontener span, [class*='infokontener'], [class*='summary'], [class*='spec'], .pricefield-secondary, [class*='km'], [class*='futas'], .hirdetes-km"
        );
        for (const node of infoNodes.length ? infoNodes : [container || document.body]) {
          const t = node.innerText?.replace(/\s+/g, " ").trim() ?? "";
          if (/\d[\d\s.]*\s*km/i.test(t) || /\b0\s*km/i.test(t)) {
            kmText = t.match(/(\d[\d\s.]*\s*km|\b0\s*km)/i)?.[0] ?? t;
            break;
          }
        }
        const fullText = text.length >= 40 ? text : [title, text, kmText].filter(Boolean).join(" ");
        let imageUrl = "";
        const img =
          (container || document.body).querySelector(
            "img[src*='http'], img[data-src*='http'], img[src*='hasznaltauto'], img[data-src*='hasznaltauto']"
          ) || null;
        const rawImg =
          img?.currentSrc ||
          img?.src ||
          img?.getAttribute("data-src") ||
          img?.getAttribute("data-lazy") ||
          "";
        if (rawImg && /^https?:\/\//i.test(rawImg) && !/logo|sprite|icon|pixel/i.test(rawImg)) {
          imageUrl = rawImg;
        }
        cards.push({
          url: clean,
          text: fullText,
          title: title?.trim() || "",
          kmText,
          imageUrl,
        });
      } catch {
        /* skip */
      }
    };

    for (const row of document.querySelectorAll(".row.talalati-sor, .talalati-sor")) {
      const anchor =
        row.querySelector(".cim-kontener h3 a") ||
        row.querySelector("h3 a[href*='/szemelyauto/']") ||
        row.querySelector("a[href*='/szemelyauto/']");
      if (!anchor) continue;
      addCard(anchor.href, row, anchor.innerText);
    }

    for (const anchor of document.querySelectorAll("a[href*='/szemelyauto/']")) {
      addCard(anchor.href, anchor.closest(".row, article, li") || anchor.parentElement, anchor.innerText);
    }

    return cards;
  });
}

export function countListingLinksInHtml(html, baseUrl) {
  return extractListingLinksFromHtml(html, baseUrl).length;
}

export function hasListingLinksInHtml(html, baseUrl) {
  return countListingLinksInHtml(html, baseUrl) > 0;
}

export async function countListingLinksOnPage(page) {
  return page.evaluate(() => {
    const re = /\/szemelyauto\/[^?#]+-\d{5,}/i;
    const seen = new Set();
    for (const anchor of document.querySelectorAll("a[href]")) {
      try {
        const absolute = new URL(anchor.href, window.location.href);
        if (absolute.hostname.replace(/^www\./, "") !== "hasznaltauto.hu") continue;
        if (!re.test(absolute.pathname)) continue;
        seen.add(`${absolute.origin}${absolute.pathname}`);
      } catch {
        /* skip */
      }
    }
    return seen.size;
  });
}

export function normalizeInputUrl(input) {
  const url = String(input ?? "").trim();
  if (!url) return null;
  if (!/^https?:\/\/(www\.)?hasznaltauto\.hu\//i.test(url)) {
    throw new Error("Csak hasznaltauto.hu link támogatott.");
  }
  return url;
}

export { isListPageUrl as isListUrl, isListingUrl as isSingleListingUrl };
