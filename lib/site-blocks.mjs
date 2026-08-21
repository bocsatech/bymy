import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { normalizeVideoList } from "./youtube-embed.mjs";
import { isSupabaseBackend, getSupabase } from "./supabase/client.mjs";
import { initLevel1 } from "./level1.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const BLOCKS_PATH = process.env.AUTOSWEB_BLOCKS_PATH || join(DATA_DIR, "site-blocks.json");
const KV_KEY = "site_blocks_v1";

/** Ismert oldalak + bármely data-site-page érték menthető. */
export const SITE_PAGES = [
  "home",
  "hub",
  "import",
  "listings",
  "hirdetesfeladas",
  "auto",
  "teherauto",
  "ingatlan",
];
export const VIDEOS_PER_SIDE = 3;

const PAGE_DEFAULT_TITLES = {
  home: { left: "Hasznos információ", right: "Hasznos videók", center: "Aktív tartalom" },
  hub: { left: "Hasznos információ", right: "Hasznos videók", center: "Aktív tartalom" },
  import: { left: "Import tippek", right: "Útmutatók" },
  listings: { left: "Hirdetés videók", right: "További videók" },
  hirdetesfeladas: { left: "Feladás tippek", right: "Segítség videók" },
  auto: { left: "Autó tippek", right: "Autó videók" },
  teherauto: { left: "Teherautó tippek", right: "Teherautó videók" },
  ingatlan: { left: "Ingatlan tippek", right: "Ingatlan videók" },
};

const PAGE_DEFAULT_CENTER_HTML = {
  home: "<p>Itt jelenik meg a hirdetésrács alatti szerkeszthető tartalom — hírek, promóciók, szövegek.</p>",
  hub: "<p>Itt jelenik meg a hirdetésrács alatti szerkeszthető tartalom — hírek, promóciók, szövegek.</p>",
};

const CENTER_PAGES = new Set(["home", "hub"]);

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

function wantsCenter(page) {
  return CENTER_PAGES.has(page);
}

function defaultPages() {
  const pages = {};
  for (const page of SITE_PAGES) {
    pages[page] = {
      left: emptySide(page, "left"),
      right: emptySide(page, "right"),
    };
    if (wantsCenter(page)) {
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

function normalizePageId(page) {
  const raw = String(page ?? "").trim().toLowerCase();
  return raw || "home";
}

function ensurePageShape(pages, page) {
  const key = normalizePageId(page);
  if (!pages[key]) {
    pages[key] = {
      left: emptySide(key, "left"),
      right: emptySide(key, "right"),
    };
    if (wantsCenter(key)) {
      pages[key].center = emptyCenter(key);
    }
  } else if (wantsCenter(key) && !pages[key].center) {
    pages[key].center = emptyCenter(key);
  }
  return pages[key];
}

function normalizePages(input) {
  const defaults = defaultPages();
  const pages = {};
  const keys = new Set([...SITE_PAGES, ...Object.keys(input || {})]);
  for (const page of keys) {
    const key = normalizePageId(page);
    const fallback = defaults[key] || {
      left: emptySide(key, "left"),
      right: emptySide(key, "right"),
      ...(wantsCenter(key) ? { center: emptyCenter(key) } : {}),
    };
    pages[key] = {
      left: normalizeSide(input?.[page]?.left ?? input?.[key]?.left, fallback.left),
      right: normalizeSide(input?.[page]?.right ?? input?.[key]?.right, fallback.right),
    };
    if (fallback.center || wantsCenter(key)) {
      pages[key].center = normalizeCenter(
        input?.[page]?.center ?? input?.[key]?.center,
        fallback.center || emptyCenter(key)
      );
    }
  }
  // Régi "home" → "hub" (kezdőlap) öröklés, ha hub még üres default.
  if (pages.home && pages.hub) {
    const hubLooksDefault =
      !String(pages.hub.center?.html || "").trim() ||
      pages.hub.center?.html === PAGE_DEFAULT_CENTER_HTML.hub;
    const homeHasCustom = pages.home.center?.html && pages.home.center.html !== PAGE_DEFAULT_CENTER_HTML.home;
    if (hubLooksDefault && homeHasCustom) {
      pages.hub = {
        left: { ...pages.home.left },
        right: { ...pages.home.right },
        center: pages.home.center ? { ...pages.home.center } : emptyCenter("hub"),
      };
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
    if (pages.home.center) {
      pages.home.center = normalizeCenter(parsed.center, pages.home.center);
    }
    return pages;
  }
  return defaultPages();
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

async function readStoreRaw() {
  if (isSupabaseBackend()) {
    await initLevel1();
    const { data, error } = await getSupabase()
      .from("level1_kv")
      .select("value")
      .eq("key", KV_KEY)
      .maybeSingle();
    if (error) throw error;
    return data?.value ?? null;
  }
  if (!existsSync(BLOCKS_PATH)) return null;
  try {
    return readFileSync(BLOCKS_PATH, "utf8");
  } catch {
    return null;
  }
}

async function writeStore(pages) {
  const payload = JSON.stringify({ pages }, null, 2);
  if (isSupabaseBackend()) {
    await initLevel1();
    const { error } = await getSupabase()
      .from("level1_kv")
      .upsert({ key: KV_KEY, value: payload }, { onConflict: "key" });
    if (error) throw error;
    return;
  }
  try {
    ensureDataDir();
    writeFileSync(BLOCKS_PATH, payload, "utf8");
  } catch (error) {
    const err = new Error(
      `Oldalsáv mentés sikertelen (csak olvasható fájlrendszer?). Állítsd be a Supabase backendet. ${error.message || ""}`
    );
    err.status = 500;
    throw err;
  }
}

function parseStore(raw) {
  if (raw == null) return defaultPages();
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return migrateLegacyFormat(parsed);
  } catch {
    return defaultPages();
  }
}

export async function getSiteBlocks(page = null) {
  let pages;
  try {
    pages = parseStore(await readStoreRaw());
  } catch {
    pages = defaultPages();
  }

  if (page) {
    const key = normalizePageId(page);
    const block = ensurePageShape(pages, key);
    return { page: key, ...block };
  }
  return { pages };
}

export async function saveSiteBlocks(payload) {
  const current = (await getSiteBlocks()).pages;
  let pages = current;

  const pageKey = payload?.page ? normalizePageId(payload.page) : "";
  if (pageKey) {
    const currentPage = ensurePageShape({ ...current }, pageKey);
    pages = {
      ...current,
      [pageKey]: {
        left: normalizeSide(payload.left, currentPage.left),
        right: normalizeSide(payload.right, currentPage.right),
      },
    };
    if (currentPage.center || wantsCenter(pageKey) || payload.center) {
      pages[pageKey].center = normalizeCenter(
        payload.center,
        currentPage.center || emptyCenter(pageKey)
      );
    }
  } else if (payload?.pages) {
    pages = normalizePages({ ...current, ...payload.pages });
  }

  await writeStore(pages);
  return { pages };
}
