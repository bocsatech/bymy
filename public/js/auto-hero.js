const FALLBACK = {
  pkw: "/images/pkw/automax-panel-bg.png",
  lkw: "/images/lkw/hub-auto-photo.jpg",
};

function heroKindFromPage() {
  const page = document.body?.getAttribute("data-site-page") || "";
  return page === "teherauto" ? "lkw" : "pkw";
}

function withCacheBust(url) {
  const raw = String(url || "").trim() || FALLBACK.pkw;
  const sep = raw.includes("?") ? "&" : "?";
  return `${raw}${sep}v=${Date.now()}`;
}

async function loadActiveHeroImage() {
  const img = document.querySelector("[data-auto-hero-image]");
  if (!img) return;

  const kind = heroKindFromPage();
  try {
    const res = await fetch(`/api/site-hero?kind=${encodeURIComponent(kind)}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const url = String(data?.activeUrl || "").trim();
    if (!url) return;
    img.src = withCacheBust(url);
  } catch {
    /* keep default src from HTML */
  }
}

const hero = document.querySelector("[data-auto-search-hero]");
if (hero) {
  loadActiveHeroImage();
}
