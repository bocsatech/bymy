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

export function rememberListingOpen(listingId, cardEl) {
  const id = String(listingId ?? "").trim();
  if (!id) return;
  const rect = cardEl?.getBoundingClientRect?.();
  writeReturn({
    href: currentListHref(),
    listingId: id,
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

export function bindListingOpen(root = document) {
  root.addEventListener("click", (event) => {
    if (event.target.closest(".home-grid-card-media")) return;
    const el = event.target.closest("[data-listing-id]");
    if (!el || !root.contains(el)) return;
    const id = el.getAttribute("data-listing-id");
    if (!id) return;
    rememberListingOpen(id, el);
    if (el.tagName === "A" && el.getAttribute("href")) return;
    event.preventDefault();
    window.location.href = listingDetailHref(id);
  });
}

export function restoreListingReturn() {
  const data = readReturn();
  if (!data?.listingId) return;
  const here = currentListHref();
  if (data.href && data.href !== here) return;

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
