/** Főmenü: kategória hirdetésszámok betöltése. */
const COUNT_BY_HREF = [
  { match: /\/auto\.html(?:$|\?)/, key: "auto" },
  { match: /\/teherauto\.html(?:$|\?)/, key: "teher" },
  { match: /\/ingatlan\.html(?:$|\?)/, key: "ingatlan" },
];

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

export async function initNavCounts() {
  const links = document.querySelectorAll(
    ".hub-nav-link, .import-nav-link, .home-nav-link, .site-app-nav-link"
  );
  if (!links.length) return;

  let counts = { auto: 0, teher: 0, ingatlan: 0 };
  try {
    const res = await fetch("/api/nav/counts");
    if (res.ok) counts = await res.json();
  } catch {
    /* leave zeros */
  }

  links.forEach((link) => {
    const href = link.getAttribute("href") || "";
    const hit = COUNT_BY_HREF.find((row) => row.match.test(href));
    if (!hit) return;
    const el = ensureCountEl(link);
    el.textContent = formatCount(counts[hit.key] ?? 0);
  });
}

initNavCounts();
