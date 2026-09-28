const RETURN_KEY = "bymy-listing-return";
const SEARCH_STATE_KEY = "bymy-vehicle-search-state";
const RETURN_TTL_MS = 45 * 60 * 1000;

function readReturn() {
  try {
    return JSON.parse(sessionStorage.getItem(RETURN_KEY) || "null");
  } catch {
    return null;
  }
}

function writeReturn(data) {
  sessionStorage.setItem(RETURN_KEY, JSON.stringify(data));
}

export function listingDetailHref(id) {
  return `/hirdetes.html?id=${encodeURIComponent(id)}`;
}

export function currentListHref() {
  const url = new URL(window.location.href);
  url.searchParams.delete("id");
  return `${url.pathname}${url.search}${url.hash}`;
}

function collectListingIds(root) {
  if (!root?.querySelectorAll) return [];
  const ids = [];
  const seen = new Set();
  root.querySelectorAll("[data-listing-id]").forEach((el) => {
    const id = String(el.getAttribute("data-listing-id") || "").trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  });
  return ids;
}

export function saveVehicleSearchState(state) {
  if (!state || typeof state !== "object") return;
  try {
    sessionStorage.setItem(
      SEARCH_STATE_KEY,
      JSON.stringify({ ...state, at: Date.now() })
    );
  } catch {
  }
}

export function readVehicleSearchState() {
  try {
    const data = JSON.parse(sessionStorage.getItem(SEARCH_STATE_KEY) || "null");
    if (!data || typeof data !== "object") return null;
    if (data.at && Date.now() - data.at > RETURN_TTL_MS) {
      sessionStorage.removeItem(SEARCH_STATE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearVehicleSearchState() {
  try {
    sessionStorage.removeItem(SEARCH_STATE_KEY);
  } catch {
  }
}

function referrerIsListingDetail() {
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    return !!(
      ref &&
      ref.origin === window.location.origin &&
      /\/hirdetes\.html$/i.test(ref.pathname)
    );
  } catch {
    return false;
  }
}

function navigationIsBackForward() {
  try {
    const nav = performance.getEntriesByType?.("navigation")?.[0];
    return nav?.type === "back_forward";
  } catch {
    return false;
  }
}

/** Böngésző vissza / hirdetésről listára — keresés visszaállítandó. */
export function shouldRestoreVehicleSearch(page) {
  const state = readVehicleSearchState();
  if (!state?.committed) return false;
  if (page && state.page && state.page !== page) return false;
  if (referrerIsListingDetail()) return true;
  if (navigationIsBackForward()) return true;
  const data = readReturn();
  if (data?.listingId && data.at && Date.now() - data.at < RETURN_TTL_MS && referrerIsListingDetail()) {
    return true;
  }
  return false;
}

export function rememberListingOpen(listingId, cardEl, root = document) {
  const id = String(listingId ?? "").trim();
  if (!id) return;
  const rect = cardEl?.getBoundingClientRect?.();
  const scope = root?.querySelectorAll ? root : document;
  writeReturn({
    href: currentListHref(),
    listingId: id,
    listingIds: collectListingIds(scope),
    scrollY: window.scrollY,
    cardTop: rect ? rect.top + window.scrollY : null,
    at: Date.now(),
  });
}

export function listingReturnHref(fallback = "/auto.html") {
  const data = readReturn();
  if (data?.href && !data.href.startsWith("/hirdetes.html")) return data.href;
  if (document.referrer) {
    try {
      const ref = new URL(document.referrer);
      if (ref.origin === window.location.origin && !ref.pathname.endsWith("/hirdetes.html")) {
        return `${ref.pathname}${ref.search}${ref.hash}`;
      }
    } catch {
    }
  }
  return fallback;
}

export function getListingSearchNav(currentId, fallbackHref = "/auto.html") {
  const data = readReturn();
  const returnHref = listingReturnHref(fallbackHref);
  const ids = Array.isArray(data?.listingIds)
    ? data.listingIds.map((id) => String(id)).filter(Boolean)
    : [];
  const current = String(currentId ?? "").trim();
  const index = current ? ids.indexOf(current) : -1;
  if (index < 0 || ids.length < 2) {
    return { returnHref, prevId: null, nextId: null, index: Math.max(0, index), total: ids.length };
  }
  return {
    returnHref,
    prevId: index > 0 ? ids[index - 1] : null,
    nextId: index < ids.length - 1 ? ids[index + 1] : null,
    index,
    total: ids.length,
  };
}

export function touchListingReturnId(listingId) {
  const id = String(listingId ?? "").trim();
  if (!id) return;
  const data = readReturn();
  if (!data) {
    writeReturn({ href: listingReturnHref(), listingId: id, listingIds: [id], at: Date.now() });
    return;
  }
  writeReturn({ ...data, listingId: id, at: Date.now() });
}

export function bindListingOpen(root = document) {
  root.addEventListener("click", (event) => {
    if (event.target.closest(".home-grid-card-media")) return;
    const el = event.target.closest("[data-listing-id]");
    if (!el || !root.contains(el)) return;
    const id = el.getAttribute("data-listing-id");
    if (!id) return;
    rememberListingOpen(id, el, root);
    try {
      window.dispatchEvent(new CustomEvent("bymy-listing-open", { detail: { id } }));
    } catch {
    }
    if (el.tagName === "A" && el.getAttribute("href")) return;
    event.preventDefault();
    window.location.href = listingDetailHref(id);
  });
}

export function restoreListingReturn() {
  const data = readReturn();
  if (!data?.listingId) return false;

  const fromDetail = referrerIsListingDetail();
  const backNav = navigationIsBackForward();
  if (!fromDetail && !backNav) {
    sessionStorage.removeItem(RETURN_KEY);
    return false;
  }

  const here = currentListHref();
  if (data.href && data.href !== here) {
    try {
      const a = new URL(data.href, window.location.origin);
      const b = new URL(here, window.location.origin);
      if (a.pathname !== b.pathname) {
        sessionStorage.removeItem(RETURN_KEY);
        return false;
      }
    } catch {
      sessionStorage.removeItem(RETURN_KEY);
      return false;
    }
  }

  const card = document.querySelector(`[data-listing-id="${CSS.escape(String(data.listingId))}"]`);
  if (card) {
    card.classList.add("is-return-target");
    card.scrollIntoView({ block: "center" });
    sessionStorage.removeItem(RETURN_KEY);
    return true;
  }
  if (Number.isFinite(data.cardTop)) {
    window.scrollTo(0, Math.max(0, data.cardTop - 120));
    return false;
  }
  if (Number.isFinite(data.scrollY)) {
    window.scrollTo(0, data.scrollY);
    return false;
  }
  return false;
}
