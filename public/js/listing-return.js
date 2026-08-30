const RETURN_KEY = "bymy-listing-return";

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
      /* ignore */
    }
  }
  return fallback;
}

/**
 * Előző / következő hirdetés a keresési listából.
 * @returns {{ returnHref: string, prevId: string|null, nextId: string|null, index: number, total: number }}
 */
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

/** Előző/következő hirdetésre lépéskor a lista-kontextus megmaradjon. */
export function touchListingReturnId(listingId) {
  const id = String(listingId ?? "").trim();
  if (!id) return;
  const data = readReturn();
  if (!data) {
    writeReturn({ href: listingReturnHref(), listingId: id, listingIds: [id] });
    return;
  }
  writeReturn({ ...data, listingId: id });
}

export function bindListingOpen(root = document) {
  root.addEventListener("click", (event) => {
    if (event.target.closest(".home-grid-card-media")) return;
    const el = event.target.closest("[data-listing-id]");
    if (!el || !root.contains(el)) return;
    const id = el.getAttribute("data-listing-id");
    if (!id) return;
    rememberListingOpen(id, el, root);
    if (el.tagName === "A" && el.getAttribute("href")) return;
    event.preventDefault();
    window.location.href = listingDetailHref(id);
  });
}

export function restoreListingReturn() {
  const data = readReturn();
  if (!data?.listingId) return;

  // Csak hirdetésről visszaérkezve állítsuk vissza a scrollt — menüből /auto.html nyitásnál maradjon a lap teteje.
  let fromDetail = false;
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    fromDetail = !!(ref && ref.origin === window.location.origin && /\/hirdetes\.html$/i.test(ref.pathname));
  } catch {
    fromDetail = false;
  }
  if (!fromDetail) {
    sessionStorage.removeItem(RETURN_KEY);
    return;
  }

  const here = currentListHref();
  if (data.href && data.href !== here) {
    sessionStorage.removeItem(RETURN_KEY);
    return;
  }

  sessionStorage.removeItem(RETURN_KEY);

  const card = document.querySelector(`[data-listing-id="${CSS.escape(String(data.listingId))}"]`);
  if (card) {
    card.classList.add("is-return-target");
    card.scrollIntoView({ block: "center" });
    return;
  }
  if (Number.isFinite(data.cardTop)) {
    window.scrollTo(0, Math.max(0, data.cardTop - 120));
  } else if (Number.isFinite(data.scrollY)) {
    window.scrollTo(0, data.scrollY);
  }
}
