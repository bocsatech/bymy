import { SEBESSEGVALTO_CATEGORIES } from "./equipment-data.js?v=5a39cb5ba3";
import { openStandaloneSwitchSheet, closeAutoDrumSheet } from "./auto-drum-sheet.js?v=sheetSample1";

function labelList(items) {
  if (!items.length) return "Mindegy";
  if (items.length === 1) return items[0];
  if (items.length <= 3) return items.join(", ");
  return `${items.length} váltó`;
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

export async function mountAutoSebessegvaltoPicker(form) {
  if (!form || !isAutoDesk() || form.dataset.sebessegvaltoPicker === "1") return;

  const existing = form.querySelector('[data-desk-field="sebessegvalto"], .auto-sebessegvalto-field');
  const host =
    existing?.closest(".auto-desk-fields") ||
    form.querySelector("#qs-more-layout") ||
    form.querySelector("#qs-layout-main") ||
    form.querySelector("#auto-search-desk-shell");
  if (!host) return;

  const deskQuick = existing?.dataset?.deskQuick || "0";
  existing?.remove();
  form.querySelectorAll(".auto-sebessegvalto-field").forEach((el) => el.remove());

  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.dataset.filterKey = "sebessegvaltok";
  hidden.setAttribute("data-filter-key", "sebessegvaltok");

  const wrap = document.createElement("div");
  wrap.className = "auto-desk-field auto-sebessegvalto-field";
  wrap.dataset.deskField = "sebessegvalto";
  wrap.dataset.deskQuick = deskQuick;
  wrap.innerHTML = `
    <span class="auto-desk-field__label">Sebességváltó</span>
    <button type="button" class="auto-bm-trigger" data-auto-valto-open aria-label="Sebességváltó">
      <span data-auto-valto-summary>Mindegy</span>
    </button>
  `;
  wrap.appendChild(hidden);
  host.appendChild(wrap);

  const summaryEl = wrap.querySelector("[data-auto-valto-summary]");
  const openBtn = wrap.querySelector("[data-auto-valto-open]");

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
      title: "Sebességváltó",
      emptyLabel: "Mindegy",
      items: SEBESSEGVALTO_CATEGORIES.map((c) => ({
        value: c.value || c.id,
        label: c.label,
      })),
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
    const list = Array.isArray(detail.sebessegvaltok)
      ? detail.sebessegvaltok.map((v) => String(v)).filter(Boolean)
      : parseJsonList(hidden.value);
    applyList(list);
  });

  form.dataset.sebessegvaltoPicker = "1";
  syncSummary(parseJsonList(hidden.value));
}

export function readSebessegvaltoFilterValues(form) {
  if (!form) return {};
  const el = form.querySelector('[data-filter-key="sebessegvaltok"]');
  if (!el) return {};
  const sebessegvaltok = parseJsonList(el.value);
  return sebessegvaltok.length ? { sebessegvaltok } : {};
}

function normalizeSebessegvalto(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function transmissionKind(text) {
  if (/felautomata|szekvencialis|robotizalt/.test(text)) return "felautomata";
  if (/manualis/.test(text)) return "manualis";
  if (/automata|tiptronic|fokozatmentes|cvt|e-cvt|dsg|pdk/.test(text)) return "automata";
  return "";
}

function sebessegvaltoCompatible(got, want) {
  if (!want) return true;
  if (!got) return false;
  if (got === want) return true;
  if (got.includes(want) || want.includes(got)) return true;

  const gotKind = transmissionKind(got);
  const wantKind = transmissionKind(want);
  if (wantKind && gotKind) return gotKind === wantKind;
  if (want === "manualis") return gotKind === "manualis";
  if (want === "automata") return gotKind === "automata";
  if (want === "felautomata") return gotKind === "felautomata";
  return false;
}

export function sebessegvaltoListMatches(listingValue, selectedValues) {
  if (!selectedValues?.length) return true;
  const got = normalizeSebessegvalto(listingValue);
  if (!got) return false;
  return selectedValues.some((raw) => sebessegvaltoCompatible(got, normalizeSebessegvalto(raw)));
}
