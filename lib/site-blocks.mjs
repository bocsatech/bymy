import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { normalizeVideoList } from "./youtube-embed.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const BLOCKS_PATH = process.env.AUTOSWEB_BLOCKS_PATH || join(DATA_DIR, "site-blocks.json");

export const SITE_PAGES = ["home", "import", "listings", "hirdetesfeladas"];
export const VIDEOS_PER_SIDE = 3;

const PAGE_DEFAULT_TITLES = {
  home: { left: "Hasznos információ", right: "Hasznos videók", center: "Aktív tartalom" },
  import: { left: "Import tippek", right: "Útmutatók" },
  listings: { left: "Hirdetés videók", right: "További videók" },
  hirdetesfeladas: { left: "Feladás tippek", right: "Segítség videók" },
};

const PAGE_DEFAULT_CENTER_HTML = {
  home: "<p>Itt jelenik meg a hirdetésrács alatti szerkeszthető tartalom — hírek, promóciók, szövegek.</p>",
};

function emptyCenter(page) {
  return {
    title: PAGE_DEFAULT_TITLES[page]?.center ?? "Aktív tartalom",
    html: PAGE_DEFAULT_CENTER_HTML[page] ?? "<p>Szerkeszthető tartalom.</p>",
  };
}

function emptySide(page, side) {
  return {
    title: PAGE_DEFAULT_TITLES[page]?.[side] ?? "Videók",
    videos: normalizeVideoList([]),
  };
}

function defaultPages() {
  const pages = {};
  for (const page of SITE_PAGES) {
    pages[page] = {
      left: emptySide(page, "left"),
      right: emptySide(page, "right"),
    };
    if (page === "home") {
      pages[page].center = emptyCenter(page);
    }
  }
  return pages;
}

function normalizeCenter(value, fallback) {
  if (!fallback) return null;
  return {
    title: String(value?.title ?? fallback.title).slice(0, 120),
    html: String(value?.html ?? fallback.html).slice(0, 24000),
  };
}

function normalizeSide(value, fallback) {
  return {
    title: String(value?.title ?? fallback.title).slice(0, 120),
    videos: normalizeVideoList(value?.videos, VIDEOS_PER_SIDE),
  };
}

function normalizePages(input) {
  const defaults = defaultPages();
  const pages = {};
  for (const page of SITE_PAGES) {
    pages[page] = {
      left: normalizeSide(input?.[page]?.left, defaults[page].left),
      right: normalizeSide(input?.[page]?.right, defaults[page].right),
    };
    if (defaults[page].center) {
      pages[page].center = normalizeCenter(input?.[page]?.center, defaults[page].center);
    }
  }
  return pages;
}

function migrateLegacyFormat(parsed) {
  if (parsed?.pages) return normalizePages(parsed.pages);
  if (parsed?.left || parsed?.right) {
    const pages = defaultPages();
    pages.home = {
      left: normalizeSide(parsed.left, pages.home.left),
      right: normalizeSide(parsed.right, pages.home.right),
    };
    return pages;
  }
  return defaultPages();
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function getSiteBlocks(page = null) {
  ensureDataDir();
  let pages;
  if (!existsSync(BLOCKS_PATH)) {
    pages = defaultPages();
    writeFileSync(BLOCKS_PATH, JSON.stringify({ pages }, null, 2), "utf8");
  } else {
    try {
      const parsed = JSON.parse(readFileSync(BLOCKS_PATH, "utf8"));
      pages = migrateLegacyFormat(parsed);
    } catch {
      pages = defaultPages();
    }
  }

  if (page && SITE_PAGES.includes(page)) {
    return { page, ...pages[page] };
  }
  return { pages };
}

export function saveSiteBlocks(payload) {
  ensureDataDir();
  const current = getSiteBlocks().pages;
  let pages = current;

  if (payload?.page && SITE_PAGES.includes(payload.page)) {
    const currentPage = current[payload.page];
    pages = {
      ...current,
      [payload.page]: {
        left: normalizeSide(payload.left, currentPage.left),
        right: normalizeSide(payload.right, currentPage.right),
      },
    };
    if (currentPage.center) {
      pages[payload.page].center = normalizeCenter(payload.center, currentPage.center);
    }
  } else if (payload?.pages) {
    pages = normalizePages({ ...current, ...payload.pages });
  }

  writeFileSync(BLOCKS_PATH, JSON.stringify({ pages }, null, 2), "utf8");
  return { pages };
}
