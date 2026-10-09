import { OKMANY_JELLEG_OPTIONS, normalizeOkmanyJelleg } from "./equipment-data.js?v=5a39cb5ba3";
import { openStandaloneSwitchSheet, closeAutoDrumSheet } from "./auto-drum-sheet.js?v=e2b3931112";

function labelList(items) {
  if (!items.length) return "Mindegy";
  if (items.length === 1) return items[0];
  if (items.length <= 3) return items.join(", ");
  return `${items.length} okmány`;
}

function parseJsonList(raw) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
  } catch {
    return String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

function writeJsonList(input, list) {
  if (!input) return;
  input.value = list.length ? JSON.stringify(list) : "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function isAutoDesk() {
  return (
    (document.body?.getAttribute("data-site-page") === "auto" ||
      document.body?.getAttribute("data-site-page") === "teherauto") &&
    window.matchMedia("(min-width: 901px)").matches
  );
}

export async function mountAutoOkmanyPicker(form) {
  if (!form || !isAutoDesk() || form.dataset.okmanyPicker === "1") return;
  if (form.querySelector('[data-qs-field="okmany_jelleg"] .immo-wheel-trigger, [data-wheel="okmany_jelleg"]')) {
    form.querySelectorAll(".auto-okmany-field").forEach((el) => el.remove());
    return;
  }

  const existing = form.querySelector('[data-desk-field="okmany_jelleg"], .auto-okmany-field');
  const host =
    existing?.closest(".auto-desk-fields") ||
    form.querySelector("#qs-more-layout") ||
    form.querySelector("#qs-layout-main") ||
    form.querySelector("#auto-search-desk-shell");
  if (!host) return;

  const deskQuick = existing?.dataset?.deskQuick || "0";
  existing?.remove();
  form.querySelectorAll(".auto-okmany-field").forEach((el) => el.remove());

  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.dataset.filterKey = "okmany_jellegek";
  hidden.setAttribute("data-filter-key", "okmany_jellegek");

  const wrap = document.createElement("div");
  wrap.className = "auto-desk-field auto-okmany-field";
  wrap.dataset.deskField = "okmany_jelleg";
  wrap.dataset.deskQuick = deskQuick;
  wrap.innerHTML = `
    <span class="auto-desk-field__label">Okmányok jellege</span>
    <button type="button" class="auto-bm-trigger" data-auto-okmany-open aria-label="Okmányok jellege">
      <span data-auto-okmany-summary>Mindegy</span>
    </button>
  `;
  wrap.appendChild(hidden);
  host.appendChild(wrap);

  const summaryEl = wrap.querySelector("[data-auto-okmany-summary]");
  const openBtn = wrap.querySelector("[data-auto-okmany-open]");

  function syncSummary(list) {
    if (!summaryEl) return;
    const text = labelList(list);
    summaryEl.textContent = text;
    summaryEl.classList.toggle("is-placeholder", !list.length);
    openBtn?.classList.toggle("has-value", Boolean(list.length));
  }

  function applyList(list) {
    const clean = [
      ...new Set((list || []).map((v) => normalizeOkmanyJelleg(v)).filter(Boolean)),
    ];
    writeJsonList(hidden, clean);
    syncSummary(clean);
  }

  function openSheet() {
    if (document.querySelector(".auto-drum-portal--sheet")) {
      closeAutoDrumSheet(true);
      return;
    }
    openStandaloneSwitchSheet({
      trigger: openBtn,
      title: "Okmányok jellege",
      emptyLabel: "Mindegy",
      items: OKMANY_JELLEG_OPTIONS.map((opt) => ({ value: opt, label: opt })),
      initialSelected: parseJsonList(hidden.value),
      onDone: (list) => applyList(list || []),
    });
  }

  openBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    openSheet();
  });

  form.addEventListener("reset", () => {
    requestAnimationFrame(() => applyList([]));
  });

  form.addEventListener("bymy-saved-search-applied", (event) => {
    const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
    const list = Array.isArray(detail.okmany_jellegek)
      ? detail.okmany_jellegek.map((v) => String(v)).filter(Boolean)
      : parseJsonList(hidden.value);
    applyList(list);
  });

  form.dataset.okmanyPicker = "1";
  syncSummary(parseJsonList(hidden.value));
}

export function readOkmanyFilterValues(form) {
  if (!form) return {};
  const el = form.querySelector('[data-filter-key="okmany_jellegek"]');
  if (!el) return {};
  const okmany_jellegek = parseJsonList(el.value).map(normalizeOkmanyJelleg).filter(Boolean);
  return okmany_jellegek.length ? { okmany_jellegek } : {};
}

export function okmanyListMatches(listingValue, selectedValues) {
  if (!selectedValues?.length) return true;
  const got = normalizeOkmanyJelleg(listingValue);
  if (!got) return false;
  return selectedValues.some((want) => normalizeOkmanyJelleg(want) === got);
}
