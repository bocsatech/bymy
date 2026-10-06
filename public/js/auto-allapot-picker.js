import { ALLAPOT_CATEGORIES } from "./equipment-data.js?v=5a39cb5ba3";
import { openStandaloneSwitchSheet, closeAutoDrumSheet } from "./auto-drum-sheet.js?v=711df91eaf";

function labelList(items) {
  if (!items.length) return "Mindegy";
  if (items.length === 1) return items[0];
  if (items.length <= 3) return items.join(", ");
  return `${items.length} állapot`;
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

function normalizeAllapot(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function mountAutoAllapotPicker(form) {
  if (!form || !isAutoDesk() || form.dataset.allapotPicker === "1") return;

  const shell = form.querySelector("#auto-search-desk-shell");
  const alapHost =
    form.querySelector(".auto-desk-fields[data-desk-alap]") ||
    form.querySelector("#qs-layout-main") ||
    shell;
  if (!alapHost) return;

  form.querySelectorAll('[data-desk-field="allapot"], .auto-allapot-field').forEach((el) => el.remove());

  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.dataset.filterKey = "allapotok";
  hidden.setAttribute("data-filter-key", "allapotok");

  const wrap = document.createElement("div");
  wrap.className = "auto-desk-field auto-allapot-field";
  wrap.dataset.deskField = "allapot";
  wrap.dataset.deskQuick = "1";
  wrap.innerHTML = `
    <span class="auto-desk-field__label">Állapot</span>
    <button type="button" class="auto-bm-trigger" data-auto-allapot-open aria-label="Állapot">
      <span data-auto-allapot-summary>Mindegy</span>
    </button>
  `;
  wrap.appendChild(hidden);

  const after =
    alapHost.querySelector(".auto-kivitel-field, [data-desk-field='kivitel']") ||
    alapHost.querySelector(".auto-fuel-field, [data-desk-field='uzemanyag']");
  if (after?.nextSibling) alapHost.insertBefore(wrap, after.nextSibling);
  else if (after) alapHost.appendChild(wrap);
  else alapHost.appendChild(wrap);

  const summaryEl = wrap.querySelector("[data-auto-allapot-summary]");
  const openBtn = wrap.querySelector("[data-auto-allapot-open]");

  function syncSummary(list) {
    if (!summaryEl) return;
    const text = labelList(list);
    summaryEl.textContent = text;
    summaryEl.classList.toggle("is-placeholder", !list.length);
    openBtn?.classList.toggle("has-value", Boolean(list.length));
  }

  function applyList(list) {
    const clean = [...new Set((list || []).map((v) => String(v).trim()).filter(Boolean))];
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
      title: "Állapot",
      emptyLabel: "Mindegy",
      items: ALLAPOT_CATEGORIES.map((c) => ({
        value: c.children?.length ? c.id : c.value || c.id,
        label: c.label,
      })),
      initialSelected: parseJsonList(hidden.value),
      getChildren: (mainValue) => {
        const cat = ALLAPOT_CATEGORIES.find(
          (c) => c.id === mainValue || c.value === mainValue || c.label === mainValue
        );
        if (!cat?.children?.length) return null;
        return cat.children.map((ch) => ({ value: ch.value, label: ch.label }));
      },
      onDone: (list, mains) => {
        const selected = new Set((list || []).map(String).filter(Boolean));
        const openMains = new Set((mains || []).map(String).filter(Boolean));
        for (const cat of ALLAPOT_CATEGORIES) {
          if (openMains.has(cat.id) && !cat.children?.length && cat.value) selected.add(cat.value);
          if (openMains.has(cat.id) && cat.children?.length) {
            const kids = cat.children.map((c) => c.value);
            if (!kids.some((v) => selected.has(v))) kids.forEach((v) => selected.add(v));
          }
        }
        applyList([...selected]);
      },
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
    const list = Array.isArray(detail.allapotok)
      ? detail.allapotok.map((v) => String(v)).filter(Boolean)
      : parseJsonList(hidden.value);
    applyList(list);
  });

  form.dataset.allapotPicker = "1";
  syncSummary(parseJsonList(hidden.value));
}

export function readAllapotFilterValues(form) {
  if (!form) return {};
  const el = form.querySelector('[data-filter-key="allapotok"]');
  if (!el) return {};
  const allapotok = parseJsonList(el.value);
  return allapotok.length ? { allapotok } : {};
}

export function allapotValueMatches(listingAllapot, selectedValues) {
  if (!selectedValues?.length) return true;
  const got = normalizeAllapot(listingAllapot);
  if (!got) return false;
  return selectedValues.some((raw) => allapotokCompatible(got, normalizeAllapot(raw)));
}

function allapotokCompatible(got, want) {
  if (!want) return true;
  if (got === want) return true;
  if (want === "serult" || want === "serult") {
    return /serult|optikai|eleje|hatulja|baloldala|jobboldala/.test(got);
  }
  if (want === "fodarab" || want.includes("fodarab") || want.includes("motorhibas") || want.includes("valtohibas")) {
    return /fodarab|motorhibas|valtohibas/.test(got) || got === want;
  }
  return got.includes(want) || want.includes(got);
}
