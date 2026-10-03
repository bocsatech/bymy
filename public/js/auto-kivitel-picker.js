import { KIVITEL_OPTIONS, normalizeKivitel } from "./kivitel-options.js?v=be03aefc2e";
import {
  TEHER_KISTEHER_KIVITEL,
  TEHER_35_KIVITEL_CATEGORIES,
  flattenTeher35KivitelOptions,
} from "./equipment-data.js?v=5a39cb5ba3";
import { openStandaloneSwitchSheet, closeAutoDrumSheet } from "./auto-drum-sheet.js?v=sheetSample1";

const EMPTY_LABEL = "Mindegy";
const SUMMARY_EMPTY = "Mindegy";

function labelList(items) {
  if (!items.length) return SUMMARY_EMPTY;
  if (items.length === 1) return items[0];
  if (items.length <= 3) return items.join(", ");
  return `${items.length} kivitel`;
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

function isVehicleSearchPage() {
  const page = document.body?.getAttribute("data-site-page");
  return page === "auto" || page === "teherauto";
}

function isAutoDesk() {
  return isVehicleSearchPage() && window.matchMedia("(min-width: 901px)").matches;
}

function truckKategoria() {
  const fromBody = document.body?.dataset?.truckKategoria;
  if (fromBody === "35-felett" || fromBody === "35-alatt") return fromBody;
  const activeTab = document.querySelector("[data-truck-tab].is-active");
  const fromTab = activeTab?.getAttribute("data-truck-tab");
  if (fromTab === "35-felett" || fromTab === "35-alatt") return fromTab;
  return new URLSearchParams(window.location.search).get("kategoria") || "35-alatt";
}

/** HA Kishaszon (3,5-ig) hierarchikus kivitel — 3,5-tól később. */
function useKisteherKivitelCategories() {
  return document.body?.getAttribute("data-site-page") === "teherauto" && truckKategoria() === "35-alatt";
}

function shouldMountKivitelPicker() {
  return isVehicleSearchPage() && isAutoDesk();
}

function flatOptionsForPage() {
  if (document.body?.getAttribute("data-site-page") !== "teherauto") return KIVITEL_OPTIONS;
  if (useKisteherKivitelCategories()) return flattenTeher35KivitelOptions();
  return TEHER_KISTEHER_KIVITEL;
}

function normKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function mountAutoKivitelPicker(form) {
  if (!form || !shouldMountKivitelPicker()) return;

  if (form.dataset.kivitelPicker === "1") {
    form.querySelectorAll(".auto-kivitel-field, .auto-kivitel-panel").forEach((el) => el.remove());
    document.querySelectorAll(".auto-kivitel-panel").forEach((el) => el.remove());
    delete form.dataset.kivitelPicker;
  }

  let alapHost = form.querySelector(".auto-desk-fields[data-desk-alap]");
  const muszakiHost = form.querySelector(".auto-desk-fields[data-desk-muszaki]");

  const legacyKivitel =
    form.querySelector('[data-qs-field="kivitel"]') ||
    form.querySelector("#qs-kivitel")?.closest(".home-qs-field, .immo-schema-cell, [data-qs-field], label") ||
    form.querySelector('[data-desk-field="kivitel"]');

  if (!alapHost && !muszakiHost && !legacyKivitel) {
    const accBody = form.querySelector('[data-desk-acc="alap"] .auto-desk-acc__body') || form;
    alapHost = document.createElement("div");
    alapHost.className = "auto-desk-fields";
    alapHost.dataset.deskAlap = "1";
    accBody.insertBefore(alapHost, accBody.firstChild);
  }

  const host = alapHost || muszakiHost || legacyKivitel?.parentElement || form;
  if (!host) return;

  form.querySelectorAll('[data-desk-field="kivitel"]').forEach((el) => el.remove());
  form.querySelectorAll('[data-qs-field="kivitel"]').forEach((el) => el.remove());
  form.querySelector("#qs-kivitel")?.remove();
  form.querySelector('[data-wheel="kivitel"]')?.closest(".immo-schema-cell, .home-qs-drum-cell, .auto-cell-drum")?.remove();
  document.querySelectorAll(".auto-kivitel-panel").forEach((el) => el.remove());

  const hierarchical = useKisteherKivitelCategories();
  const categories = hierarchical ? TEHER_35_KIVITEL_CATEGORIES : null;
  const flatOptions = hierarchical ? null : flatOptionsForPage();

  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.dataset.filterKey = "kivitelek";
  hidden.setAttribute("data-filter-key", "kivitelek");

  const wrap = document.createElement("div");
  wrap.className = "auto-desk-field auto-kivitel-field";
  wrap.dataset.deskField = "kivitel";
  wrap.dataset.deskQuick = "1";
  wrap.hidden = false;
  wrap.innerHTML = `
    <span class="auto-desk-field__label">Kivitel</span>
    <button type="button" class="auto-bm-trigger" data-auto-kivitel-open aria-label="Kivitel">
      <span data-auto-kivitel-summary>${SUMMARY_EMPTY}</span>
    </button>
  `;
  wrap.appendChild(hidden);

  const insertHost = alapHost || host;
  const fuelField =
    insertHost.querySelector?.(".auto-fuel-field, [data-desk-field='uzemanyag'], [data-qs-field='uzemanyag']") ||
    form.querySelector(".auto-fuel-field, [data-desk-field='uzemanyag'], [data-qs-field='uzemanyag']");
  if (fuelField?.parentElement === insertHost && fuelField.nextSibling) {
    insertHost.insertBefore(wrap, fuelField.nextSibling);
  } else if (fuelField?.parentElement === insertHost) {
    insertHost.appendChild(wrap);
  } else if (legacyKivitel?.parentElement) {
    legacyKivitel.replaceWith(wrap);
  } else {
    insertHost.appendChild(wrap);
  }

  const summaryEl = wrap.querySelector("[data-auto-kivitel-summary]");
  const openBtn = wrap.querySelector("[data-auto-kivitel-open]");

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

  const urlKivitel = String(new URLSearchParams(window.location.search).get("kivitel") || "").trim();
  if (urlKivitel) {
    if (hierarchical && categories) {
      const cat = categories.find(
        (c) =>
          c.value === urlKivitel ||
          c.label === urlKivitel ||
          c.children?.some((ch) => ch.value === urlKivitel)
      );
      if (cat?.children?.length) {
        const child = cat.children.find((ch) => ch.value === urlKivitel);
        applyList(child ? [child.value] : cat.children.map((ch) => ch.value));
      } else if (cat?.value) {
        applyList([cat.value]);
      } else {
        applyList([urlKivitel]);
      }
    } else {
      applyList([normalizeKivitel(urlKivitel) || urlKivitel]);
    }
  } else {
    syncSummary(parseJsonList(hidden.value));
  }

  function openSheet() {
    if (document.querySelector(".auto-drum-portal--sheet")) {
      closeAutoDrumSheet(true);
      return;
    }
    if (hierarchical && categories) {
      openStandaloneSwitchSheet({
        trigger: openBtn,
        title: "Kivitel",
        emptyLabel: EMPTY_LABEL,
        items: categories.map((c) => ({ value: c.id, label: c.label })),
        initialSelected: parseJsonList(hidden.value),
        getChildren: (id) => {
          const cat = categories.find((c) => c.id === id);
          if (!cat?.children?.length) return null;
          return cat.children.map((c) => ({ value: c.value, label: c.label }));
        },
        onDone: (list, mains) => {
          const selected = new Set((list || []).map(String).filter(Boolean));
          const openMains = new Set((mains || []).map(String).filter(Boolean));
          for (const cat of categories) {
            if (openMains.has(cat.id) && !cat.children?.length && cat.value) selected.add(cat.value);
            if (openMains.has(cat.id) && cat.children?.length) {
              const kids = cat.children.map((c) => c.value);
              if (!kids.some((v) => selected.has(v))) kids.forEach((v) => selected.add(v));
            }
          }
          applyList([...selected]);
        },
      });
      return;
    }
    openStandaloneSwitchSheet({
      trigger: openBtn,
      title: "Kivitel",
      emptyLabel: EMPTY_LABEL,
      items: (flatOptions || []).map((opt) => ({ value: opt, label: opt })),
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
    const list = Array.isArray(detail.kivitelek)
      ? detail.kivitelek.map((v) => String(v)).filter(Boolean)
      : parseJsonList(hidden.value);
    applyList(list);
  });

  form.dataset.kivitelPicker = "1";
}

export function readKivitelFilterValues(form) {
  if (!form) return {};
  const el = form.querySelector('[data-filter-key="kivitelek"]');
  if (!el) return {};
  const kivitelek = parseJsonList(el.value)
    .map((x) => String(x).trim())
    .filter(Boolean);
  return kivitelek.length ? { kivitelek } : {};
}

export function kivitelListMatches(listingValue, selectedValues) {
  if (!selectedValues?.length) return true;
  const got = String(listingValue ?? "").trim();
  if (!got) return false;
  const gotN = normKey(got);
  const gotCar = normalizeKivitel(got);
  return selectedValues.some((raw) => {
    const want = String(raw ?? "").trim();
    if (!want) return false;
    if (gotCar && normalizeKivitel(want) === gotCar) return true;
    const wantN = normKey(want);
    return gotN === wantN || gotN.includes(wantN) || wantN.includes(gotN);
  });
}
