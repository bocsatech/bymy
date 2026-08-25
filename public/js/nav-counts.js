/** Főmenü: kategória hirdetésszámok betöltése. */
const COUNT_BY_HREF = [
  { match: /\/auto\.html(?:$|\?)/, key: "auto" },
  { match: /\/teherauto\.html(?:$|\?)/, key: "teher" },
  { match: /\/ingatlan\.html(?:$|\?)/, key: "ingatlan" },
];

const STORAGE_KEY = "bymy.navCounts.v1";

function formatCount(n) {
  const num = Number(n) || 0;
  return new Intl.NumberFormat("hu-HU").format(num);
}

function ensureCountEl(link) {
  let el = link.querySelector(".nav-count");
  if (!el) {
    el = document.createElement("span");
    el.className = "nav-count";
    el.setAttribute("aria-hidden", "true");
    link.append(" ", el);
  }
  return el;
}

function readStoredCounts() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      auto: Number(parsed.auto) || 0,
      teher: Number(parsed.teher) || 0,
      ingatlan: Number(parsed.ingatlan) || 0,
    };
  } catch {
    return null;
  }
}

function writeStoredCounts(counts) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {
    /* private mode / quota */
  }
}

function paintCounts(counts) {
  const links = document.querySelectorAll(
    ".hub-nav-link, .import-nav-link, .home-nav-link, .site-app-nav-link"
  );
  links.forEach((link) => {
    const href = link.getAttribute("href") || "";
    const hit = COUNT_BY_HREF.find((row) => row.match.test(href));
    if (!hit) return;
    const el = ensureCountEl(link);
    el.textContent = formatCount(counts[hit.key] ?? 0);
  });
}

/** Lista / más forrás felülírhat egy vagy több kategóriát. */
export function applyNavCounts(partial = {}) {
  const base = readStoredCounts() || { auto: 0, teher: 0, ingatlan: 0 };
  const next = { ...base };
  for (const key of ["auto", "teher", "ingatlan"]) {
    if (partial[key] != null && Number.isFinite(Number(partial[key]))) {
      next[key] = Number(partial[key]) || 0;
    }
  }
  writeStoredCounts(next);
  paintCounts(next);
  return next;
}

async function fetchCountsOnce() {
  const res = await fetch("/api/nav/counts", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error(String(data.error));
  return {
    auto: Number(data.auto) || 0,
    teher: Number(data.teher) || 0,
    ingatlan: Number(data.ingatlan) || 0,
  };
}

async function fetchCountsWithRetry(attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fetchCountsOnce();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 350 * (i + 1)));
    }
  }
  throw lastError;
}

export async function initNavCounts() {
  const links = document.querySelectorAll(
    ".hub-nav-link, .import-nav-link, .home-nav-link, .site-app-nav-link"
  );
  if (!links.length) return;

  const stored = readStoredCounts();
  if (stored) paintCounts(stored);

  try {
    const counts = await fetchCountsWithRetry();
    const prev = readStoredCounts();
    const apiTotal = counts.auto + counts.teher + counts.ingatlan;
    const prevTotal = prev ? prev.auto + prev.teher + prev.ingatlan : 0;
    // Üres API választ ne írjuk a listából már ismert szám fölé (cache / hideg start).
    if (apiTotal === 0 && prevTotal > 0) {
      paintCounts(prev);
      return;
    }
    writeStoredCounts(counts);
    paintCounts(counts);
  } catch {
    /* Ne írjunk 0-t hiba esetén — marad a sessionStorage / üres. */
  }
}

// Rövid idle — a lista API továbbra is előnyben, de ne várjunk 4 mp-et.
if (typeof requestIdleCallback === "function") {
  requestIdleCallback(() => initNavCounts(), { timeout: 1200 });
} else {
  setTimeout(initNavCounts, 400);
}
