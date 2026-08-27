/**
 * Település typeahead — HU posta lista + Budapest I–XXIII. kerület.
 * Használat: wireTelepulesSuggest(input)
 */

const ROMAN = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV",
  "XVI",
  "XVII",
  "XVIII",
  "XIX",
  "XX",
  "XXI",
  "XXII",
  "XXIII",
];

const BUDAPEST_KERULETEK = ROMAN.map((r) => `Budapest ${r}. kerület`);

let cityNamesPromise = null;

function fold(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadCityNames() {
  if (cityNamesPromise) return cityNamesPromise;
  cityNamesPromise = (async () => {
    const names = new Set();
    try {
      const res = await fetch("/api/postal-codes/cities", {
        credentials: "same-origin",
        cache: "force-cache",
      });
      const data = await res.json().catch(() => ({}));
      for (const row of data.cities || []) {
        const city = String(row?.city || "").trim();
        if (city) names.add(city);
      }
    } catch {
      /* offline */
    }
    names.add("Budapest");
    for (const k of BUDAPEST_KERULETEK) names.add(k);
    return [...names];
  })();
  return cityNamesPromise;
}

function matchScore(name, query) {
  const n = fold(name);
  const q = fold(query);
  if (!q || !n) return -1;
  if (n === q) return 10000;
  if (n.startsWith(q)) return 8000 - Math.min(n.length, 400);
  if (n.includes(` ${q}`) || n.includes(`,${q}`)) return 6000 - Math.min(n.length, 400);
  if (n.includes(q)) return 4000 - Math.min(n.length, 400);
  return -1;
}

function districtIndex(name) {
  const m = String(name).match(/^Budapest\s+([IVX]+)\.\s+kerület$/i);
  if (!m) return -1;
  return ROMAN.indexOf(m[1].toUpperCase());
}

function suggestNames(all, query, limit = 12) {
  const q = fold(query);
  if (q.length < 1) return [];

  const scored = [];
  for (const name of all) {
    const score = matchScore(name, q);
    if (score < 0) continue;
    let bonus = 0;
    const di = districtIndex(name);
    if (di >= 0) {
      /* bud / kerület / római → kerületek is jöjjenek, sorrend I→XXIII */
      if (q.startsWith("bud") || q.includes("ker") || /^[ivx]+$/.test(q)) {
        bonus = 200 - di;
      }
    } else if (fold(name) === "budapest" && q.startsWith("bud")) {
      bonus = 500;
    }
    scored.push({ name, score: score + bonus, di });
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.di >= 0 && b.di >= 0) return a.di - b.di;
    return a.name.localeCompare(b.name, "hu");
  });
  return scored.slice(0, limit).map((s) => s.name);
}

/**
 * @param {HTMLInputElement} input
 * @param {{ onPick?: (value: string) => void }} [opts]
 */
export function wireTelepulesSuggest(input, opts = {}) {
  if (!input || input.dataset.telepulesSuggestBound === "1") return;
  input.dataset.telepulesSuggestBound = "1";
  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocapitalize", "words");
  input.setAttribute("spellcheck", "false");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");

  const field = input.closest(".immo-field") || input.parentElement;
  if (field && getComputedStyle(field).position === "static") {
    field.style.position = "relative";
  }

  const listId = `telepules-suggest-${Math.random().toString(36).slice(2, 9)}`;
  const list = document.createElement("ul");
  list.id = listId;
  list.className = "telepules-suggest";
  list.hidden = true;
  list.setAttribute("role", "listbox");
  input.setAttribute("aria-controls", listId);
  (field || input.parentElement)?.appendChild(list);

  let active = -1;
  let items = [];
  let allNames = [];

  void loadCityNames().then((names) => {
    allNames = names;
  });

  function close() {
    list.hidden = true;
    list.innerHTML = "";
    active = -1;
    items = [];
    input.setAttribute("aria-expanded", "false");
  }

  function open(matches) {
    items = matches;
    active = -1;
    if (!matches.length) {
      close();
      return;
    }
    list.innerHTML = matches
      .map(
        (name, i) =>
          `<li class="telepules-suggest__item" role="option" id="${listId}-${i}" data-index="${i}" aria-selected="false">${escapeHtml(name)}</li>`
      )
      .join("");
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function setActive(index) {
    const optsEls = [...list.querySelectorAll(".telepules-suggest__item")];
    active = index;
    optsEls.forEach((el, i) => {
      const on = i === active;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-selected", on ? "true" : "false");
      if (on) input.setAttribute("aria-activedescendant", el.id);
    });
    if (active < 0) input.removeAttribute("aria-activedescendant");
  }

  function pick(name) {
    input.value = name;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    close();
    opts?.onPick?.(name);
  }

  async function refresh() {
    if (!allNames.length) allNames = await loadCityNames();
    const q = String(input.value || "").trim();
    if (q.length < 1) {
      close();
      return;
    }
    open(suggestNames(allNames, q));
  }

  let timer = 0;
  input.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      void refresh();
    }, 120);
  });

  input.addEventListener("focus", () => {
    void refresh();
  });

  input.addEventListener("keydown", (event) => {
    if (list.hidden || !items.length) {
      if (event.key === "ArrowDown") void refresh();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(active < items.length - 1 ? active + 1 : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(active > 0 ? active - 1 : items.length - 1);
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      pick(items[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  });

  list.addEventListener("mousedown", (event) => {
    const li = event.target?.closest?.("[data-index]");
    if (!li) return;
    event.preventDefault();
    const idx = Number(li.getAttribute("data-index"));
    if (Number.isFinite(idx) && items[idx]) pick(items[idx]);
  });

  document.addEventListener("click", (event) => {
    if (event.target === input || list.contains(event.target)) return;
    close();
  });
}

export function wireTelepulesSuggestIn(root) {
  if (!root) return;
  root.querySelectorAll('#immo-keresesi_hely, [name="keresesi_hely"]').forEach((el) => {
    if (el instanceof HTMLInputElement) wireTelepulesSuggest(el);
  });
}
