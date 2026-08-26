/**
 * Autó oldal — Kivitel menü (minden kategóriában), URL ?kivitel=…
 * Opciók: /api/level1/kivitel-menu (admin), fallback: KIVITEL_OPTIONS.
 */

import { KIVITEL_OPTIONS, kivitelMenuHref, normalizeKivitel } from "./kivitel-options.js?v=kivitel1";

const CATEGORY_TABS = [
  { key: "", label: "Személyautók", match: (k) => !k },
  { key: "berauto", label: "Bérautók", match: (k) => k === "berauto" },
  { key: "leasing", label: "Leasingautók", match: (k) => k === "leasing" },
  { key: "lakoauto-berles", label: "Lakóautó bérlés", match: (k) => k === "lakoauto-berles" },
];

let kivitelLabels = [...KIVITEL_OPTIONS];

function currentKategoria() {
  return String(new URLSearchParams(window.location.search).get("kategoria") || "")
    .trim()
    .toLowerCase();
}

function currentKivitel() {
  return normalizeKivitel(new URLSearchParams(window.location.search).get("kivitel") || "");
}

function categoryHref(kategoriaKey) {
  const params = new URLSearchParams(window.location.search);
  if (kategoriaKey) params.set("kategoria", kategoriaKey);
  else params.delete("kategoria");
  const q = params.toString();
  return q ? `/auto.html?${q}` : "/auto.html";
}

function syncCategoryTabs(root) {
  const kat = currentKategoria();
  root.querySelectorAll("[data-auto-kat]").forEach((link) => {
    const key = link.getAttribute("data-auto-kat") || "";
    const active = CATEGORY_TABS.find((t) => t.key === key)?.match(kat);
    link.classList.toggle("is-active", Boolean(active));
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
    link.setAttribute("href", categoryHref(key));
  });
}

function renderKivitelMenu(nav) {
  const active = currentKivitel();
  const toggle = nav.querySelector("[data-kivitel-toggle]");
  const panel = nav.querySelector("[data-kivitel-panel]");
  const list = nav.querySelector("[data-kivitel-list]");
  if (!toggle || !panel || !list) return;

  list.innerHTML = "";

  const allLi = document.createElement("li");
  const allLink = document.createElement("a");
  allLink.href = kivitelMenuHref("", { searchParams: window.location.search });
  allLink.textContent = "Összes kivitel";
  allLink.className = "auto-kivitel-link" + (active ? "" : " is-active");
  allLi.appendChild(allLink);
  list.appendChild(allLi);

  for (const opt of kivitelLabels) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = kivitelMenuHref(opt, { searchParams: window.location.search });
    a.textContent = opt;
    a.className = "auto-kivitel-link" + (active === opt ? " is-active" : "");
    if (active === opt) a.setAttribute("aria-current", "true");
    li.appendChild(a);
    list.appendChild(li);
  }

  if (active) {
    toggle.textContent = `Kivitel: ${active}`;
    toggle.classList.add("has-value");
  } else {
    toggle.textContent = "Kivitel";
    toggle.classList.remove("has-value");
  }
}

function initKivitelToggle(nav) {
  const toggle = nav.querySelector("[data-kivitel-toggle]");
  const panel = nav.querySelector("[data-kivitel-panel]");
  if (!toggle || !panel) return;

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    panel.hidden = !open;
  });

  document.addEventListener("click", (event) => {
    if (nav.contains(event.target)) return;
    if (!nav.classList.contains("is-open")) return;
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    panel.hidden = true;
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!nav.classList.contains("is-open")) return;
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    panel.hidden = true;
  });
}

async function loadKivitelLabels() {
  try {
    const res = await fetch("/api/level1/kivitel-menu", { credentials: "same-origin" });
    if (!res.ok) return;
    const data = await res.json();
    const labels = Array.isArray(data.labels)
      ? data.labels.map((v) => String(v || "").trim()).filter(Boolean)
      : [];
    if (labels.length) kivitelLabels = labels;
  } catch {
    /* fallback: KIVITEL_OPTIONS */
  }
}

export async function initAutoKivitelMenu() {
  if (document.body?.getAttribute("data-site-page") !== "auto") return;

  const tabs = document.querySelector(".auto-search-tabs");
  if (tabs) syncCategoryTabs(tabs);

  const nav = document.querySelector("[data-auto-kivitel-nav]");
  if (!nav) return;

  await loadKivitelLabels();
  renderKivitelMenu(nav);
  initKivitelToggle(nav);
}

initAutoKivitelMenu();
