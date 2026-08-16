const FALLBACK = "/images/automax-panel-bg.png";

function withCacheBust(url) {
  const raw = String(url || "").trim() || FALLBACK;
  const sep = raw.includes("?") ? "&" : "?";
  return `${raw}${sep}v=${Date.now()}`;
}

async function loadActiveHeroImage() {
  const img = document.querySelector("[data-auto-hero-image]");
  if (!img) return;

  try {
    const res = await fetch("/api/site-hero", { cache: "no-store" });
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
