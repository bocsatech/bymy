
import { readWheel, readWheelList, setWheelValue, fillWheel } from "./ingatlan-wheels.js?v=immoClearAll1";
import { closeAllInlineDrums, syncDrumWheelDisplay } from "./immo-drum-picker.js?v=immoAdFormMenu1";

const ITEM_H = 52;
const MULTI_VISIBLE = 10;
let activePortal = null;
let paintFrame = 0;

document.addEventListener("immo-wheel-clear", (event) => {
  if (activePortal?.wheel && event.target === activePortal.wheel) {
    closeAutoDrumSheet(false);
  }
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function closeAutoDrumSheet(commit = false) {
  if (!activePortal) return;
  const { root, wheel, scrollEl, ring, wrap, trigger } = activePortal;
  const multiple = wheel?.dataset?.multiple === "1";
  if (commit && scrollEl && ring && wheel && !multiple) {
    const item = nearestPortalItem(scrollEl, ring);
    const value = item?.dataset.value ?? "";
    setWheelValue(wheel, value);
    syncDrumWheelDisplay(wheel);
    wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value } }));
  } else if (commit && multiple && wheel) {
    syncDrumWheelDisplay(wheel);
    wheel.dispatchEvent(
      new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: readWheel(wheel) } })
    );
  }
  wrap?.classList.remove("is-open", "has-drum-open");
  wrap?.closest(".immo-dual-range")?.classList.remove("has-drum-open");
  wrap?.closest(".immo-schema-cell")?.classList.remove("is-drum-active");
  wrap?.closest(".immo-dual-range__half")?.classList.remove("is-drum-active");
  trigger?.setAttribute("aria-expanded", "false");
  root.remove();
  activePortal = null;
  document.body.classList.remove("auto-drum-portal-open", "auto-drum-sheet-open");
}

function nearestPortalItem(scrollEl, ring) {
  const ringRect = ring.getBoundingClientRect();
  const centerY = ringRect.top + ringRect.height / 2;
  let best = null;
  let bestDist = Infinity;
  scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((item) => {
    const r = item.getBoundingClientRect();
    const mid = r.top + r.height / 2;
    const dist = Math.abs(mid - centerY);
    if (dist < bestDist) {
      bestDist = dist;
      best = item;
    }
  });
  return best;
}

function paintPortal(scrollEl, ring, wheel) {
  cancelAnimationFrame(paintFrame);
  paintFrame = requestAnimationFrame(() => {
    const ringRect = ring.getBoundingClientRect();
    const centerY = ringRect.top + ringRect.height / 2;
    const cellTop = ringRect.top + ringRect.height * 0.28;
    const cellBottom = ringRect.bottom - ringRect.height * 0.28;
    const selected = new Set(wheel ? readWheelList(wheel) : []);
    const multiple = wheel?.dataset?.multiple === "1";
    scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((item) => {
      const r = item.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      const inCell = mid >= cellTop && mid <= cellBottom;
      const dist = Math.abs(mid - centerY);
      const t = Math.min(dist / (ITEM_H * 1.15), 1);
      const v = item.dataset.value ?? "";
      const isSel = v === "" ? selected.size === 0 : selected.has(v);
      item.style.opacity = String(Math.max(0.38, 1 - t * 0.55));
      item.style.fontWeight = dist < ITEM_H * 0.42 || isSel ? "650" : "500";
      item.classList.toggle("is-in-cell", inCell);
      item.classList.toggle("is-selected", isSel);
      item.setAttribute("aria-selected", isSel ? "true" : "false");
      if (multiple) {
        item.setAttribute("aria-checked", isSel ? "true" : "false");
        const sw = item.querySelector(".auto-drum-switch");
        if (sw) sw.setAttribute("aria-checked", isSel ? "true" : "false");
      }
    });
  });
}

function paintSwitchRows(scrollEl, wheel) {
  paintPortal(scrollEl, activePortal?.ring || scrollEl.parentElement, wheel);
}

function scrollToPortalItem(scrollEl, ring, item) {
  if (!item) return;
  const ringRect = ring.getBoundingClientRect();
  const centerY = ringRect.top + ringRect.height / 2;
  const itemRect = item.getBoundingClientRect();
  const itemMid = itemRect.top + itemRect.height / 2;
  scrollEl.scrollTop += itemMid - centerY;
}

function syncRingWidth(ring, scrollEl) {
  let max = 0;
  scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((item) => {
    max = Math.max(max, item.scrollWidth);
  });
  const capped = Math.min(Math.max(11.25 * 16, Math.ceil(max + 42)), Math.min(300, Math.floor(window.innerWidth * 0.85)));
  ring.style.setProperty("--immo-drum-ring-w", `${capped}px`);
}

function bindPortalNativeScroll(scrollEl, ring, wheel) {
  let startY = 0;
  let moved = false;

  scrollEl.addEventListener(
    "touchstart",
    (event) => {
      startY = event.touches?.[0]?.clientY ?? 0;
      moved = false;
    },
    { passive: true }
  );

  scrollEl.addEventListener(
    "touchmove",
    (event) => {
      const y = event.touches?.[0]?.clientY ?? startY;
      if (Math.abs(y - startY) > 4) moved = true;
    },
    { passive: true }
  );

  const snapEnd = () => {
    if (!moved) return;
    const snap = nearestPortalItem(scrollEl, ring);
    if (snap) scrollToPortalItem(scrollEl, ring, snap);
    paintPortal(scrollEl, ring, wheel);
  };
  scrollEl.addEventListener("touchend", snapEnd);
  scrollEl.addEventListener("touchcancel", snapEnd);

  scrollEl.addEventListener(
    "wheel",
    () => {
      requestAnimationFrame(() => paintPortal(scrollEl, ring, wheel));
    },
    { passive: true }
  );
}

function positionPortal(stage, trigger) {
  void trigger;
  stage.style.left = "50%";
  stage.style.top = "48%";
}

/** @typedef {{ value: string, label: string }} DrumSheetItem */

/** @param {HTMLElement[] | DrumSheetItem[]} opts */
function normalizeSheetItems(opts, emptyLabel) {
  if (!opts?.length) return [{ value: "", label: emptyLabel }];
  const first = opts[0];
  if (first && typeof first === "object" && "value" in first && !("dataset" in first)) {
    return /** @type {DrumSheetItem[]} */ (opts);
  }
  return opts.map((btn) => ({
    value: btn.dataset?.value ?? "",
    label: (btn.textContent || "").trim() || emptyLabel,
  }));
}

function openMultiSwitchSheet(wheel, trigger, wrap, emptyLabel, opts) {
  const items = normalizeSheetItems(opts, emptyLabel);
  const selected = readWheelList(wheel);
  const root = document.createElement("div");
  root.className = "auto-drum-portal auto-drum-portal--multi";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", emptyLabel);
  const drumH = ITEM_H * MULTI_VISIBLE;
  root.style.setProperty("--auto-drum-multi-h", `${drumH}px`);
  root.style.setProperty("--auto-drum-item-h", `${ITEM_H}px`);

  root.innerHTML = `
    <button type="button" class="auto-drum-portal__backdrop" aria-label="Bezárás"></button>
    <div class="auto-drum-portal__stage auto-drum-portal__stage--multi">
      <div class="immo-drum-wheel-ring auto-drum-portal__ring auto-drum-portal__ring--multi">
        <div class="immo-drum-inline-highlight" aria-hidden="true"></div>
        <div class="auto-drum-portal__scroll immo-drum-inline-scroll" tabindex="-1"></div>
      </div>
      <button type="button" class="auto-drum-portal__done">Kész</button>
    </div>`;

  const stage = root.querySelector(".auto-drum-portal__stage");
  const ring = root.querySelector(".auto-drum-portal__ring");
  const scrollEl = root.querySelector(".auto-drum-portal__scroll");

  scrollEl.innerHTML = items
    .map(({ value, label }) => {
      return `<div class="immo-drum-inline-item auto-drum-inline-item--switch" role="option" data-value="${escapeHtml(
        value
      )}">
        <span class="immo-drum-inline-text">${escapeHtml(label)}</span>
        <span class="auto-drum-switch" aria-hidden="true"><span class="auto-drum-switch__knob"></span></span>
      </div>`;
    })
    .join("");

  function toggleItem(item) {
    if (!item) return;
    const value = item.dataset.value ?? "";
    if (value === "") {
      setWheelValue(wheel, "");
    } else {
      const cur = new Set(readWheelList(wheel));
      if (cur.has(value)) cur.delete(value);
      else cur.add(value);
      setWheelValue(wheel, [...cur]);
    }
    syncDrumWheelDisplay(wheel);
    paintPortal(scrollEl, ring, wheel);
  }

  scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((item) => {
    let tapStart = null;
    item.addEventListener(
      "pointerdown",
      (event) => {
        tapStart = { x: event.clientX, y: event.clientY };
      },
      { passive: true }
    );
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      if (tapStart) {
        const dx = Math.abs(event.clientX - tapStart.x);
        const dy = Math.abs(event.clientY - tapStart.y);
        if (dx > 10 || dy > 10) return;
      }
      toggleItem(item);
    });
  });

  root.querySelector(".auto-drum-portal__backdrop")?.addEventListener("click", () => closeAutoDrumSheet(true));
  root.querySelector(".auto-drum-portal__done")?.addEventListener("click", () => closeAutoDrumSheet(true));

  scrollEl.addEventListener("scroll", () => paintPortal(scrollEl, ring, wheel), { passive: true });
  bindPortalNativeScroll(scrollEl, ring, wheel);

  document.body.appendChild(root);
  document.body.classList.add("auto-drum-portal-open");
  wrap?.classList.add("is-open", "has-drum-open");
  wrap?.closest(".immo-dual-range")?.classList.add("has-drum-open");
  (wrap?.closest(".immo-dual-range__half") || wrap?.closest(".immo-schema-cell"))?.classList.add("is-drum-active");
  trigger.setAttribute("aria-expanded", "true");

  positionPortal(stage, trigger);
  activePortal = { root, wheel, scrollEl, ring, wrap, trigger };

  const start =
    (selected.length
      ? [...scrollEl.querySelectorAll(".immo-drum-inline-item")].find((el) => selected.includes(el.dataset.value ?? ""))
      : null) ||
    scrollEl.querySelector('.immo-drum-inline-item[data-value=""]') ||
    scrollEl.querySelector(".immo-drum-inline-item");

  requestAnimationFrame(() => {
    ring.style.setProperty("--immo-drum-ring-w", `${Math.min(340, Math.floor(window.innerWidth * 0.9))}px`);
    scrollToPortalItem(scrollEl, ring, start);
    paintPortal(scrollEl, ring, wheel);
  });
}

const CATALOG_STATIC_BUST = "brandCatalog4";

async function loadGyartmanyCatalog(form) {
  let catalog = form?._autoDrumCatalog;
  if (catalog?.gyartmanyok?.length > 20) return catalog;
  try {
    const page = document.body?.getAttribute("data-site-page");
    const kind = page === "teherauto" ? "kisteher" : "szemelyauto";
    const staticUrl =
      kind === "kisteher"
        ? `/data/vehicle-catalog-kisteher.json?v=${CATALOG_STATIC_BUST}`
        : `/data/vehicle-catalog.json?v=${CATALOG_STATIC_BUST}`;
    const res = await fetch(staticUrl, { cache: "no-store" });
    const data = await res.json();
    if (data?.gyartmanyok?.length) catalog = data;
    else {
      const { fetchVehicleCatalog } = await import(`./vehicle-catalog-client.js?v=${CATALOG_STATIC_BUST}`);
      catalog = await fetchVehicleCatalog({ kind });
    }
    if (form) form._autoDrumCatalog = catalog;
    return catalog;
  } catch {
    return catalog?.gyartmanyok?.length ? catalog : null;
  }
}

async function refreshGyartmanyWheelIfNeeded(wheel, form) {
  if (!wheel || wheel.getAttribute("data-wheel") !== "gyartmany") return null;
  const catalog = await loadGyartmanyCatalog(form);
  const brands = (catalog?.gyartmanyok || []).map((b) => ({ value: b, label: b }));
  if (brands.length) {
    fillWheel(wheel, brands, { emptyLabel: "Mindegy" });
    wheel.dataset.multiple = "1";
    syncDrumWheelDisplay(wheel);
  }
  return catalog;
}

function gyartmanySheetItems(form, wheel, emptyLabel) {
  const catalog = form?._autoDrumCatalog;
  if (catalog?.gyartmanyok?.length) {
    return [{ value: "", label: emptyLabel }, ...catalog.gyartmanyok.map((b) => ({ value: b, label: b }))];
  }
  return normalizeSheetItems([...wheel.querySelectorAll(".immo-wheel-opt")], emptyLabel);
}

export function openAutoDrumSheet(wheel, trigger, { sheetItems = null } = {}) {
  if (!wheel || !trigger) return;
  closeAutoDrumSheet(false);
  closeAllInlineDrums(false);

  const wrap = wheel.closest(".immo-wheel-wrap");
  const emptyLabel = trigger.dataset.emptyLabel || "Mindegy";
  const wheelKey = wheel.getAttribute("data-wheel") || "";
  const multiple = wheel.dataset.multiple === "1" || wheelKey === "gyartmany";
  if (multiple) wheel.dataset.multiple = "1";
  const current = String(readWheel(wheel) ?? "");
  const selected = readWheelList(wheel);
  const opts = [...wheel.querySelectorAll(".immo-wheel-opt")];

  if (multiple) {
    const items = sheetItems ?? normalizeSheetItems(opts, emptyLabel);
    openMultiSwitchSheet(wheel, trigger, wrap, emptyLabel, items);
    return;
  }

  const root = document.createElement("div");
  root.className = "auto-drum-portal";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", emptyLabel);

  root.innerHTML = `
    <button type="button" class="auto-drum-portal__backdrop" aria-label="Bezárás"></button>
    <div class="auto-drum-portal__stage">
      <div class="immo-drum-wheel-ring auto-drum-portal__ring">
        <div class="immo-drum-inline-highlight" aria-hidden="true"></div>
        <div class="auto-drum-portal__scroll immo-drum-inline-scroll" tabindex="-1"></div>
      </div>
      <button type="button" class="auto-drum-portal__done">Kész</button>
    </div>`;

  const stage = root.querySelector(".auto-drum-portal__stage");
  const ring = root.querySelector(".auto-drum-portal__ring");
  const scrollEl = root.querySelector(".auto-drum-portal__scroll");

  scrollEl.innerHTML = opts
    .map((btn) => {
      const value = btn.dataset.value ?? "";
      const label = (btn.textContent || "").trim() || emptyLabel;
      return `<div class="immo-drum-inline-item" data-value="${escapeHtml(value)}"><span class="immo-drum-inline-text">${escapeHtml(label)}</span></div>`;
    })
    .join("");

  root.querySelector(".auto-drum-portal__backdrop")?.addEventListener("click", () => closeAutoDrumSheet(true));
  root.querySelector(".auto-drum-portal__done")?.addEventListener("click", () => closeAutoDrumSheet(true));

  function selectPortalItem(item) {
    if (!item) return;
    const value = item.dataset.value ?? "";
    setWheelValue(wheel, value);
    syncDrumWheelDisplay(wheel);
    wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value } }));
    closeAutoDrumSheet(false);
  }

  scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((item) => {
    let tapStart = null;
    item.addEventListener(
      "pointerdown",
      (event) => {
        tapStart = { x: event.clientX, y: event.clientY };
      },
      { passive: true }
    );
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      if (tapStart) {
        const dx = Math.abs(event.clientX - tapStart.x);
        const dy = Math.abs(event.clientY - tapStart.y);
        if (dx > 10 || dy > 10) return;
      }
      selectPortalItem(item);
    });
  });

  scrollEl.addEventListener("scroll", () => paintPortal(scrollEl, ring, wheel), { passive: true });
  bindPortalNativeScroll(scrollEl, ring, wheel);

  document.body.appendChild(root);
  document.body.classList.add("auto-drum-portal-open");
  wrap?.classList.add("is-open", "has-drum-open");
  wrap?.closest(".immo-dual-range")?.classList.add("has-drum-open");
  (wrap?.closest(".immo-dual-range__half") || wrap?.closest(".immo-schema-cell"))?.classList.add("is-drum-active");
  trigger.setAttribute("aria-expanded", "true");

  positionPortal(stage, trigger);
  activePortal = { root, wheel, scrollEl, ring, wrap, trigger };

  const start =
    [...scrollEl.querySelectorAll(".immo-drum-inline-item")].find((el) => (el.dataset.value ?? "") === current) ||
    scrollEl.querySelector(".immo-drum-inline-item");

  requestAnimationFrame(() => {
    syncRingWidth(ring, scrollEl);
    scrollToPortalItem(scrollEl, ring, start);
    paintPortal(scrollEl, ring, wheel);
  });
}

export function bindAutoDrumSheet(wheel) {
  if (!wheel) return;
  const name = wheel.getAttribute?.("data-wheel") || "";
  const form = wheel.closest?.("form") || document.getElementById("immo-search-form");
  const live =
    (name && form?.querySelector(`[data-wheel="${name}"]`)) ||
    (wheel.isConnected ? wheel : null) ||
    wheel;
  const wrap = live?.closest?.(".immo-wheel-wrap");
  const trigger = wrap?.querySelector(".immo-wheel-trigger");
  if (!trigger) return;

  const next = trigger.cloneNode(true);
  next.dataset.sheetBound = "1";
  trigger.replaceWith(next);

  next.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (activePortal) {
      closeAutoDrumSheet(true);
      return;
    }
    const host = next.closest("form") || document;
    const current =
      (name && host.querySelector?.(`[data-wheel="${name}"]`)) ||
      next.closest(".immo-wheel-wrap")?.querySelector("[data-wheel]");
    if (!current) return;
    let sheetItems = null;
    if (name === "gyartmany") {
      await refreshGyartmanyWheelIfNeeded(current, host);
      const emptyLabel = next.dataset.emptyLabel || "Mindegy";
      sheetItems = gyartmanySheetItems(host, current, emptyLabel);
    }
    openAutoDrumSheet(current, next, { sheetItems });
  });
}
