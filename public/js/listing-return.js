const RETURN_KEY = "bymy-listing-return";
const SEARCH_STATE_KEY = "bymy-vehicle-search-state";
const RESTORE_FLAG_KEY = "bymy-vehicle-search-restore";
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

export function markVehicleSearchRestorePending(page) {
  try {
    sessionStorage.setItem(
      RESTORE_FLAG_KEY,
      JSON.stringify({ page: page || "", at: Date.now() })
    );
  } catch {
  }
}

export function consumeVehicleSearchRestorePending(page) {
  try {
    const raw = sessionStorage.getItem(RESTORE_FLAG_KEY);
    if (!raw) return false;
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw === "1" ? { page: "", at: Date.now() } : null;
    }
    if (!data || typeof data !== "object") {
      sessionStorage.removeItem(RESTORE_FLAG_KEY);
      return false;
    }
    if (data.at && Date.now() - data.at > RETURN_TTL_MS) {
      sessionStorage.removeItem(RESTORE_FLAG_KEY);
      return false;
    }
    if (page && data.page && data.page !== page) return false;
    sessionStorage.removeItem(RESTORE_FLAG_KEY);
    return true;
  } catch {
    return false;
  }
}

function peekVehicleSearchRestorePending(page) {
  try {
    const raw = sessionStorage.getItem(RESTORE_FLAG_KEY);
    if (!raw) return false;
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {
      return raw === "1";
    }
    if (!data || typeof data !== "object") return false;
    if (data.at && Date.now() - data.at > RETURN_TTL_MS) return false;
    if (page && data.page && data.page !== page) return false;
    return true;
  } catch {
    return false;
  }
}

/** Hub / más oldal: ne maradjon fent a visszaállító flag. */
export function sweepVehicleSearchRestoreFlag() {
  try {
    const page = document.body?.dataset?.sitePage || "";
    if (!page || page === "auto" || page === "teherauto" || page === "hirdetes") return;
    sessionStorage.removeItem(RESTORE_FLAG_KEY);
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
    if (nav?.type === "back_forward") return true;
  } catch {
  }
  try {
    if (typeof performance !== "undefined" && performance.navigation) {
      return performance.navigation.type === 2;
    }
  } catch {
  }
  return false;
}

/**
 * Vissza gomb / hirdetésről listára.
 * A pending flag a legmegbízhatóbb (referrer gyakran üres vissza gombnál).
 */
export function shouldRestoreVehicleSearch(page) {
  const state = readVehicleSearchState();
  if (!state?.committed) return false;
  if (page && state.page && state.page !== page) return false;

  if (peekVehicleSearchRestorePending(page)) return true;
  if (referrerIsListingDetail()) return true;
  if (navigationIsBackForward()) return true;
  return false;
}

export function rememberListingOpen(listingId, cardEl, root = document, page = "") {
  const id = String(listingId ?? "").trim();
  if (!id) return;
  const rect = cardEl?.getBoundingClientRect?.();
  const scope = root?.querySelectorAll ? root : document;
  const sitePage =
    page ||
    document.body?.getAttribute("data-site-page") ||
    "";
  writeReturn({
    href: currentListHref(),
    listingId: id,
    listingIds: collectListingIds(scope),
    scrollY: window.scrollY,
    cardTop: rect ? rect.top + window.scrollY : null,
    at: Date.now(),
    page: sitePage,
  });
  markVehicleSearchRestorePending(sitePage);
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
  const page = document.body?.getAttribute("data-site-page") || data?.page || "";
  if (!data) {
    writeReturn({ href: listingReturnHref(), listingId: id, listingIds: [id], at: Date.now(), page });
    markVehicleSearchRestorePending(page);
    return;
  }
  writeReturn({ ...data, listingId: id, at: Date.now() });
  markVehicleSearchRestorePending(data.page || page);
}

export function bindListingOpen(root = document) {
  root.addEventListener("click", (event) => {
    if (event.target.closest(".home-grid-card-save")) return;
    if (event.target.closest(".home-grid-card-photo-nav")) return;
    if (event.target.closest(".home-grid-card-photo-hit")) return;
    const el = event.target.closest("[data-listing-id]");
    if (!el || !root.contains(el)) return;
    const id = el.getAttribute("data-listing-id");
    if (!id) return;
    rememberListingOpen(id, el, root);
    try {
      window.dispatchEvent(new CustomEvent("bymy-listing-open", { detail: { id } }));
    } catch {
    }
    const anchor = event.target.closest("a[href]");
    if (anchor && root.contains(anchor) && anchor.getAttribute("href")) return;
    if (event.target.closest(".home-grid-card-media")) {
      event.preventDefault();
      window.location.href = listingDetailHref(id);
      return;
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
  const pending = peekVehicleSearchRestorePending(data.page || "");
  if (!fromDetail && !backNav && !pending) {
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
