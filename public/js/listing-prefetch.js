/**
 * Hirdetés detail előtöltés (hover / közel viewport) — gyorsabb kattintás és vissza.
 * sessionStorage túléli a teljes oldalváltást; memória a listán belüli ismétléshez.
 */

const MEM = new Map();
const SS_PREFIX = "bymy-listing-pref:";
const TTL_MS = 90_000;
const MAX_SS = 8;

function now() {
  return Date.now();
}

function ssKey(id) {
  return `${SS_PREFIX}${id}`;
}

function readSs(id) {
  try {
    const raw = sessionStorage.getItem(ssKey(id));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.listing || !data.at || now() - data.at > TTL_MS) {
      sessionStorage.removeItem(ssKey(id));
      return null;
    }
    return data.listing;
  } catch {
    return null;
  }
}

function writeSs(id, listing) {
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(SS_PREFIX)) keys.push(k);
    }
    keys.sort();
    while (keys.length >= MAX_SS) {
      sessionStorage.removeItem(keys.shift());
    }
    sessionStorage.setItem(ssKey(id), JSON.stringify({ at: now(), listing }));
  } catch {
    /* quota / private mode */
  }
}

function readMem(id) {
  const hit = MEM.get(String(id));
  if (!hit) return null;
  if (now() - hit.at > TTL_MS) {
    MEM.delete(String(id));
    return null;
  }
  return hit.listing;
}

function writeMem(id, listing) {
  MEM.set(String(id), { at: now(), listing });
}

/** Előtöltött detail — hirdetés oldal szinkron induláshoz. */
export function takePrefetchedListing(id) {
  const key = String(id ?? "").trim();
  if (!key) return null;
  const mem = readMem(key);
  if (mem) return mem;
  return readSs(key);
}

export function peekPrefetchedListing(id) {
  return takePrefetchedListing(id);
}

export function storePrefetchedListing(id, listing) {
  const key = String(id ?? "").trim();
  if (!key || !listing) return;
  writeMem(key, listing);
  writeSs(key, listing);
}

const inflight = new Map();

/** API + HTML prefetch. Idempotens. */
export function prefetchListingDetail(id) {
  const key = String(id ?? "").trim();
  if (!key || !/^\d+$/.test(key)) return Promise.resolve(null);
  if (readMem(key) || readSs(key)) return Promise.resolve(readMem(key) || readSs(key));
  if (inflight.has(key)) return inflight.get(key);

  try {
    const href = `/hirdetes.html?id=${encodeURIComponent(key)}`;
    if (!document.querySelector(`link[data-bymy-prefetch="${key}"]`)) {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = href;
      link.as = "document";
      link.dataset.bymyPrefetch = key;
      document.head.appendChild(link);
    }
  } catch {
  }

  const task = fetch(`/api/listings/${encodeURIComponent(key)}?view=detail`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      const listing = data?.listing ?? null;
      if (listing) storePrefetchedListing(key, listing);
      return listing;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, task);
  return task;
}

/** Lista kártyák: hover + közeli viewport előtöltés. */
export function bindListingPrefetch(root = document) {
  if (!root || root.dataset?.bymyPrefetchBound === "1") return;
  if (root.dataset) root.dataset.bymyPrefetchBound = "1";

  const schedule = (id) => {
    if (!id) return;
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => prefetchListingDetail(id), { timeout: 1200 });
    } else {
      setTimeout(() => prefetchListingDetail(id), 50);
    }
  };

  root.addEventListener(
    "pointerenter",
    (event) => {
      const el = event.target?.closest?.("[data-listing-id]");
      if (!el || !root.contains(el)) return;
      schedule(el.getAttribute("data-listing-id"));
    },
    true
  );

  root.addEventListener(
    "focusin",
    (event) => {
      const el = event.target?.closest?.("[data-listing-id]");
      if (!el || !root.contains(el)) return;
      schedule(el.getAttribute("data-listing-id"));
    },
    true
  );

  if (typeof IntersectionObserver !== "function") return;
  const seen = new Set();
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = entry.target.getAttribute?.("data-listing-id");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        schedule(id);
      }
    },
    { root: null, rootMargin: "180px 0px", threshold: 0.01 }
  );

  const observeCards = () => {
    root.querySelectorAll("[data-listing-id]").forEach((el) => {
      if (el.dataset.bymyIo === "1") return;
      el.dataset.bymyIo = "1";
      io.observe(el);
    });
  };
  observeCards();
  const mo = new MutationObserver(() => observeCards());
  mo.observe(root, { childList: true, subtree: true });
}
