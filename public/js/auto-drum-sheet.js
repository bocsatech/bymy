
import { readWheel, readWheelList, setWheelValue, fillWheel } from "./ingatlan-wheels.js?v=immoClearAll1";
import { closeAllInlineDrums, syncDrumWheelDisplay } from "./immo-drum-picker.js?v=immoAdFormMenu1";
import { UZEMANYAG_CATEGORIES, flattenUzemanyagOptions, ALLAPOT_CATEGORIES, flattenAllapotOptions } from "./equipment-data.js";

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

function daysInMonth(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return 31;
  return new Date(y, m, 0).getDate();
}

function pad2(value) {
  const n = Number(String(value ?? "").replace(/\D/g, ""));
  if (!Number.isFinite(n) || n < 1) return "";
  return String(n).padStart(2, "0");
}

function matchWheelOptionValue(wheel, raw) {
  const want = String(raw ?? "").trim();
  if (!want || !wheel) return "";
  const opts = [...wheel.querySelectorAll(".immo-wheel-opt")].map((o) => o.dataset.value ?? "");
  if (opts.includes(want)) return want;
  const n = Number(want.replace(/\D/g, ""));
  if (!Number.isFinite(n) || n < 1) return want;
  const asNum = String(n);
  if (opts.includes(asNum)) return asNum;
  const asPad = asNum.padStart(2, "0");
  if (opts.includes(asPad)) return asPad;
  return want;
}

function matchDayOptionValue(raw, maxDay) {
  const n = Number(String(raw ?? "").replace(/\D/g, ""));
  if (!Number.isFinite(n) || n < 1) return "1";
  const clamped = Math.min(n, maxDay || 31);
  return String(clamped);
}

export function syncMuszakiDateSummary(block) {
  if (!block) return;
  const y = String(readWheel(block.querySelector('[data-wheel="muszaki_ev"]')) ?? "");
  const mRaw = String(readWheel(block.querySelector('[data-wheel="muszaki_honap"]')) ?? "");
  const dRaw = String(readWheel(block.querySelector('[data-wheel="muszaki_nap"]')) ?? "");
  const m = mRaw ? pad2(mRaw) || mRaw : "";
  const d = dRaw ? pad2(dRaw) || dRaw : "";
  const summary = block.querySelector("[data-muszaki-summary]");
  if (!summary) return;
  const emptyLabel = summary.dataset.emptyLabel || "Mindegy";
  summary.textContent = y ? `${y}. ${m || "—"}. ${d || "—"}` : emptyLabel;
}

function muszakiYearOptions() {
  const start = new Date().getFullYear();
  const out = [{ value: "", label: "Mindegy" }];
  for (let y = start; y <= start + 5; y += 1) out.push({ value: String(y), label: String(y) });
  return out;
}

function muszakiMonthOptions() {
  const out = [{ value: "", label: "Mindegy" }];
  for (let m = 1; m <= 12; m += 1) {
    const v = String(m).padStart(2, "0");
    out.push({ value: v, label: v });
  }
  return out;
}

function muszakiDayOptions(year, month) {
  const out = [{ value: "", label: "Mindegy" }];
  const max = daysInMonth(year, month);
  for (let d = 1; d <= max; d += 1) {
    const v = String(d).padStart(2, "0");
    out.push({ value: v, label: v });
  }
  return out;
}

function openTripleDateDrumSheet(yearWheel, monthWheel, dayWheel, trigger) {
  if (!yearWheel || !monthWheel || !dayWheel || !trigger) return;
  closeAutoDrumSheet(false);
  closeAllInlineDrums(false);

  const block = yearWheel.closest(".immo-triple-date");
  const wrap = yearWheel.closest(".immo-wheel-wrap") || trigger.closest(".immo-wheel-wrap");
  const sheetTitle =
    block?.querySelector(".immo-triple-date__title")?.textContent?.trim() || "Műszaki érvényesség";
  const emptyLabel =
    trigger?.dataset?.emptyLabel ||
    [...yearWheel.querySelectorAll(".immo-wheel-opt")].find((o) => (o.dataset.value ?? "") === "")?.textContent?.trim() ||
    "Mindegy";
  let pendingY = String(readWheel(yearWheel) ?? "");
  let pendingM = String(readWheel(monthWheel) ?? "");
  let pendingD = String(readWheel(dayWheel) ?? "");
  if (pendingM && !pendingM.includes("") && Number(pendingM)) {
    /* keep select value as stored on wheel */
  }

  const root = document.createElement("div");
  root.className = "auto-drum-portal auto-drum-portal--multi auto-drum-portal--split auto-drum-portal--date3";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", sheetTitle);

  root.innerHTML = `
    <button type="button" class="auto-drum-portal__backdrop" aria-label="Bezárás"></button>
    <div class="auto-drum-portal__stage auto-drum-portal__stage--multi auto-drum-portal__stage--split auto-drum-portal__stage--date3">
      <div class="immo-drum-wheel-ring auto-drum-portal__ring auto-drum-portal__ring--multi auto-drum-portal__ring--split auto-drum-portal__ring--date3">
        <div class="auto-drum-portal__toolbar">
          <button type="button" class="auto-drum-portal__back" hidden>Vissza</button>
          <p class="auto-drum-portal__sub">${escapeHtml(sheetTitle)}</p>
          <button type="button" class="auto-drum-portal__done">Kész</button>
        </div>
        <div class="auto-drum-split__chips auto-drum-date3__chips">
          <button type="button" class="auto-drum-split__chip auto-drum-date3__chip" aria-label="Dátum">
            <span class="auto-drum-split__chip-label"></span>
            <span class="auto-drum-split__chip-clear" hidden aria-hidden="true">×</span>
          </button>
        </div>
        <div class="auto-drum-date3__heads" aria-hidden="true">
          <span>Év</span><span>Hó</span><span>Nap</span>
        </div>
        <div class="auto-drum-split__body auto-drum-date3__body">
          <div class="immo-drum-inline-highlight auto-drum-split__highlight" aria-hidden="true"></div>
          <div class="auto-drum-split__cols auto-drum-date3__cols">
            <div class="auto-drum-split__col" data-half="year">
              <div class="auto-drum-portal__scroll auto-drum-split__scroll immo-drum-inline-scroll" tabindex="-1"></div>
            </div>
            <div class="auto-drum-split__col" data-half="month">
              <div class="auto-drum-portal__scroll auto-drum-split__scroll immo-drum-inline-scroll" tabindex="-1"></div>
            </div>
            <div class="auto-drum-split__col" data-half="day">
              <div class="auto-drum-portal__scroll auto-drum-split__scroll immo-drum-inline-scroll" tabindex="-1"></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  const stage = root.querySelector(".auto-drum-portal__stage");
  const ring = root.querySelector(".auto-drum-split__highlight");
  const yearScroll = root.querySelector('.auto-drum-split__col[data-half="year"] .auto-drum-split__scroll');
  const monthScroll = root.querySelector('.auto-drum-split__col[data-half="month"] .auto-drum-split__scroll');
  const dayScroll = root.querySelector('.auto-drum-split__col[data-half="day"] .auto-drum-split__scroll');
  const chip = root.querySelector(".auto-drum-date3__chip");
  const doneBtn = root.querySelector(".auto-drum-portal__done");

  function itemHtml(row) {
    return `<div class="immo-drum-inline-item" data-value="${escapeHtml(row.value)}"><span class="immo-drum-inline-text">${escapeHtml(row.label)}</span></div>`;
  }

  function fillCol(scrollEl, rows) {
    scrollEl.innerHTML = rows.map(itemHtml).join("");
  }

  function syncChip() {
    const label = chip.querySelector(".auto-drum-split__chip-label");
    const clear = chip.querySelector(".auto-drum-split__chip-clear");
    if (!pendingY) {
      label.textContent = emptyLabel;
      clear.hidden = true;
    } else {
      label.textContent = `${pendingY}. ${pendingM || "—"}. ${pendingD || "—"}`;
      clear.hidden = false;
    }
    clear.setAttribute("aria-hidden", clear.hidden ? "true" : "false");
  }

  function rebuildDayCol(keepScroll = true) {
    const prev = pendingD;
    const rows = muszakiDayOptions(pendingY, pendingM);
    fillCol(dayScroll, rows);
    bindColClicks(dayScroll);
    const max = daysInMonth(pendingY, pendingM);
    const dayN = Number(prev) || 0;
    if (!pendingY || !pendingM) pendingD = "";
    else if (dayN > max) pendingD = String(max).padStart(2, "0");
    else if (dayN >= 1) pendingD = String(dayN).padStart(2, "0");
    requestAnimationFrame(() => {
      scrollHalfToValue(dayScroll, pendingD);
      paintBoth();
    });
    void keepScroll;
  }

  function paintBoth() {
    cancelAnimationFrame(paintFrame);
    paintFrame = requestAnimationFrame(() => {
      paintSplitColSync(yearScroll, ring);
      paintSplitColSync(monthScroll, ring);
      paintSplitColSync(dayScroll, ring);
      pendingY = nearestPortalItem(yearScroll, ring)?.dataset.value ?? "";
      pendingM = nearestPortalItem(monthScroll, ring)?.dataset.value ?? "";
      pendingD = nearestPortalItem(dayScroll, ring)?.dataset.value ?? "";
      syncChip();
    });
  }

  function scrollHalfToValue(scrollEl, value) {
    const start =
      [...scrollEl.querySelectorAll(".immo-drum-inline-item")].find((el) => (el.dataset.value ?? "") === value) ||
      scrollEl.querySelector('.immo-drum-inline-item[data-value=""]') ||
      scrollEl.querySelector(".immo-drum-inline-item");
    scrollToPortalItem(scrollEl, ring, start);
  }

  function bindColClicks(scrollEl) {
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
        scrollToPortalItem(scrollEl, ring, item);
        const half = scrollEl.closest("[data-half]")?.dataset.half;
        if (half === "year" || half === "month") {
          pendingY = nearestPortalItem(yearScroll, ring)?.dataset.value ?? "";
          pendingM = nearestPortalItem(monthScroll, ring)?.dataset.value ?? "";
          rebuildDayCol();
        } else {
          paintBoth();
        }
      });
    });
  }

  function bindColScroll(scrollEl) {
    let startY = 0;
    let moved = false;
    scrollEl.addEventListener(
      "scroll",
      () => {
        paintBoth();
      },
      { passive: true }
    );
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
      const half = scrollEl.closest("[data-half]")?.dataset.half;
      pendingY = nearestPortalItem(yearScroll, ring)?.dataset.value ?? "";
      pendingM = nearestPortalItem(monthScroll, ring)?.dataset.value ?? "";
      pendingD = nearestPortalItem(dayScroll, ring)?.dataset.value ?? "";
      if (half === "year" || half === "month") rebuildDayCol();
      else paintBoth();
    };
    scrollEl.addEventListener("touchend", snapEnd);
    scrollEl.addEventListener("touchcancel", snapEnd);
  }

  fillCol(yearScroll, wheelOptionRows(yearWheel, emptyLabel));
  fillCol(monthScroll, wheelOptionRows(monthWheel, emptyLabel));
  fillCol(dayScroll, muszakiDayOptions(pendingY, pendingM));
  bindColClicks(yearScroll);
  bindColClicks(monthScroll);
  bindColClicks(dayScroll);
  bindColScroll(yearScroll);
  bindColScroll(monthScroll);
  bindColScroll(dayScroll);

  chip.addEventListener("click", (event) => {
    if (!event.target.closest(".auto-drum-split__chip-clear")) return;
    event.preventDefault();
    event.stopPropagation();
    pendingY = "";
    pendingM = "";
    pendingD = "";
    scrollHalfToValue(yearScroll, "");
    scrollHalfToValue(monthScroll, "");
    rebuildDayCol();
  });

  root.querySelector(".auto-drum-portal__backdrop")?.addEventListener("click", () => closeAutoDrumSheet(true));
  doneBtn?.addEventListener("click", () => closeAutoDrumSheet(true));

  document.body.appendChild(root);
  document.body.classList.add("auto-drum-portal-open");
  wrap?.classList.add("is-open", "has-drum-open");
  block?.classList.add("has-drum-open");
  block?.querySelectorAll(".immo-triple-date__half").forEach((half) => half.classList.add("is-drum-active"));
  trigger.setAttribute("aria-expanded", "true");

  positionPortal(stage, trigger);
  activePortal = {
    kind: "date3",
    root,
    wheel: yearWheel,
    yearWheel,
    monthWheel,
    dayWheel,
    yearScroll,
    monthScroll,
    dayScroll,
    scrollEl: yearScroll,
    ring,
    wrap,
    trigger,
  };

  requestAnimationFrame(() => {
    root
      .querySelector(".auto-drum-portal__ring--date3")
      ?.style.setProperty("--immo-drum-ring-w", `${Math.min(360, Math.floor(window.innerWidth * 0.92))}px`);
    scrollHalfToValue(yearScroll, pendingY);
    scrollHalfToValue(monthScroll, pendingM);
    scrollHalfToValue(dayScroll, pendingD);
    paintBoth();
  });
}

export function closeAutoDrumSheet(commit = false) {
  if (!activePortal) return;
  const {
    root,
    wheel,
    scrollEl,
    ring,
    wrap,
    trigger,
    modelWheel,
    kind,
    minWheel,
    maxWheel,
    minScroll,
    maxScroll,
    yearWheel,
    monthWheel,
    dayWheel,
    yearScroll,
    monthScroll,
    dayScroll,
  } = activePortal;
  if (!wheel && kind !== "split" && kind !== "date3") {
    /* Standalone sheet — done handler already owns commit. */
    wrap?.classList.remove("is-open", "has-drum-open");
    trigger?.setAttribute("aria-expanded", "false");
    root.remove();
    activePortal = null;
    document.body.classList.remove("auto-drum-portal-open", "auto-drum-sheet-open");
    return;
  }
  if (kind === "date3") {
    if (commit && yearWheel && monthWheel && dayWheel && yearScroll && monthScroll && dayScroll && ring) {
      let y = nearestPortalItem(yearScroll, ring)?.dataset.value ?? "";
      let m = nearestPortalItem(monthScroll, ring)?.dataset.value ?? "";
      let d = nearestPortalItem(dayScroll, ring)?.dataset.value ?? "";
      if (!y) {
        m = "";
        d = "";
      } else {
        if (!m) {
          const firstMonth = [...monthWheel.querySelectorAll(".immo-wheel-opt")]
            .map((o) => o.dataset.value ?? "")
            .find((v) => v !== "");
          m = firstMonth || "1";
        }
        const maxDay = daysInMonth(y, m);
        const dayN = Number(d) || 0;
        if (!d || dayN < 1) d = "1";
        else if (dayN > maxDay) d = String(maxDay);
        else d = String(dayN);
        /* Match existing wheel option formatting (1 vs 01). */
        m = matchWheelOptionValue(monthWheel, m);
        d = matchWheelOptionValue(dayWheel, d) || matchDayOptionValue(d, maxDay);
      }
      setWheelValue(yearWheel, y);
      setWheelValue(monthWheel, m);
      setWheelValue(dayWheel, d);
      syncDrumWheelDisplay(yearWheel);
      syncDrumWheelDisplay(monthWheel);
      syncDrumWheelDisplay(dayWheel);
      syncMuszakiDateSummary(yearWheel.closest(".immo-triple-date"));
      yearWheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: y } }));
      monthWheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: m } }));
      dayWheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: d } }));
    }
    wrap?.classList.remove("is-open", "has-drum-open");
    wrap?.closest(".immo-triple-date")?.classList.remove("has-drum-open");
    document.querySelectorAll(".immo-triple-date__half.is-drum-active").forEach((el) => el.classList.remove("is-drum-active"));
    trigger?.setAttribute("aria-expanded", "false");
    root.remove();
    activePortal = null;
    document.body.classList.remove("auto-drum-portal-open", "auto-drum-sheet-open");
    return;
  }
  if (kind === "split") {
    if (commit && minWheel && maxWheel && minScroll && maxScroll && ring) {
      let minVal = nearestPortalItem(minScroll, ring)?.dataset.value ?? "";
      let maxVal = nearestPortalItem(maxScroll, ring)?.dataset.value ?? "";
      const minN = minVal === "" ? null : Number(String(minVal).replace(/\D/g, ""));
      const maxN = maxVal === "" ? null : Number(String(maxVal).replace(/\D/g, ""));
      if (minN != null && maxN != null && Number.isFinite(minN) && Number.isFinite(maxN) && minN > maxN) {
        const tmp = minVal;
        minVal = maxVal;
        maxVal = tmp;
      }
      setWheelValue(minWheel, minVal);
      setWheelValue(maxWheel, maxVal);
      syncDrumWheelDisplay(minWheel);
      syncDrumWheelDisplay(maxWheel);
      minWheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: minVal } }));
      maxWheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: maxVal } }));
    }
    wrap?.classList.remove("is-open", "has-drum-open");
    wrap?.closest(".immo-dual-range")?.classList.remove("has-drum-open");
    wrap?.closest(".immo-schema-cell")?.classList.remove("is-drum-active");
    wrap?.closest(".immo-dual-range__half")?.classList.remove("is-drum-active");
    root.querySelectorAll(".immo-dual-range__half.is-drum-active").forEach((el) => el.classList.remove("is-drum-active"));
    document.querySelectorAll(".immo-dual-range.has-drum-open").forEach((el) => {
      if (el.contains(minWheel) || el.contains(maxWheel)) el.classList.remove("has-drum-open");
    });
    trigger?.setAttribute("aria-expanded", "false");
    root.remove();
    activePortal = null;
    document.body.classList.remove("auto-drum-portal-open", "auto-drum-sheet-open");
    return;
  }
  const multiple = wheel?.dataset?.multiple === "1";
  const isBmPortal = Boolean(modelWheel);
  if (commit && scrollEl && ring && wheel && !multiple && !isBmPortal) {
    const item = nearestPortalItem(scrollEl, ring);
    const value = item?.dataset.value ?? "";
    setWheelValue(wheel, value);
    syncDrumWheelDisplay(wheel);
    wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value } }));
  } else if (commit && (multiple || isBmPortal) && wheel) {
    syncDrumWheelDisplay(wheel);
    if (modelWheel) syncDrumWheelDisplay(modelWheel);
    wheel.dispatchEvent(
      new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: readWheel(wheel) } })
    );
    modelWheel?.dispatchEvent(
      new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: readWheel(modelWheel) } })
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
      if (multiple) {
        /* Lista + kapcsoló: nincs dobkerék-fade / pipa — fekete szöveg. */
        item.style.opacity = "1";
        item.style.fontWeight = isSel ? "700" : "500";
        item.style.color = "#000";
      } else {
        item.style.opacity = String(Math.max(0.38, 1 - t * 0.55));
        item.style.fontWeight = dist < ITEM_H * 0.42 || isSel ? "650" : "500";
      }
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

function paintSwitchList(scrollEl, selectionWheel) {
  cancelAnimationFrame(paintFrame);
  paintFrame = requestAnimationFrame(() => {
    const soft = Boolean(scrollEl?.closest?.(".auto-drum-portal--sheet"));
    const selected = new Set(selectionWheel ? readWheelList(selectionWheel) : []);
    scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((item) => {
      const v = item.dataset.value ?? "";
      const isSel = v === "" ? selected.size === 0 : selected.has(v);
      item.style.opacity = "1";
      item.style.fontWeight = soft ? (isSel ? "500" : "400") : isSel ? "700" : "500";
      item.style.fontSize = soft ? "0.9375rem" : "";
      item.style.color = soft ? "#1f2937" : "#000";
      item.classList.toggle("is-selected", isSel);
      item.setAttribute("aria-selected", isSel ? "true" : "false");
      item.setAttribute("aria-checked", isSel ? "true" : "false");
      const sw = item.querySelector(".auto-drum-switch");
      if (sw) sw.setAttribute("aria-checked", isSel ? "true" : "false");
    });
  });
}

function bindSwitchRowClicks(scrollEl, onToggle) {
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
      onToggle(item);
    });
  });
}

function switchRowHtml({ value, label, child = false }) {
  return `<div class="immo-drum-inline-item auto-drum-inline-item--switch${
    child ? " auto-drum-inline-item--child" : ""
  }" role="option" data-value="${escapeHtml(value)}">
    <span class="immo-drum-inline-text">${escapeHtml(label)}</span>
    <span class="auto-drum-switch" aria-hidden="true"><span class="auto-drum-switch__knob"></span></span>
  </div>`;
}

function modelsForBrandFromCatalog(catalog, brand) {
  const tree = catalog?.modellekTree?.[brand];
  if (Array.isArray(tree) && tree.length) {
    const rows = [];
    const sorted = [...tree].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "hu", { sensitivity: "base" })
    );
    for (const node of sorted) {
      if (!node?.name) continue;
      rows.push({ value: node.name, label: node.name, child: false });
      const kids = [...(node.children || [])].sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), "hu", { sensitivity: "base" })
      );
      for (const child of kids) {
        if (!child?.name) continue;
        rows.push({ value: child.name, label: child.name, child: true });
      }
    }
    return rows;
  }
  return (catalog?.modellek?.[brand] || []).map((m) => ({ value: m, label: m, child: false }));
}

/**
 * Desk flow a mobilon: ugyanazon a panelen Gyártmány → Modell váltás.
 * Márka bekapcsolásakor a lista a modellekre vált (katalógusból).
 * AutoScout-stílusú teljes sheet (#e8eef3, fehér kártya, nincs vastag keret).
 */
export function openBrandModelCatalogSheet(brandWheel, trigger, wrap, emptyLabel, form, { singleSelect = false } = {}) {
  const catalog = form?._autoDrumCatalog || form?._adFormVehicleCatalog;
  const modelWheel =
    form?.querySelector?.('[data-wheel="modell"]') ||
    brandWheel.closest("form")?.querySelector('[data-wheel="modell"]');
  const brandItems = catalog?.gyartmanyok?.length
    ? [{ value: "", label: emptyLabel }, ...catalog.gyartmanyok.map((b) => ({ value: b, label: b }))]
    : normalizeSheetItems([...brandWheel.querySelectorAll(".immo-wheel-opt")], emptyLabel);

  const root = document.createElement("div");
  root.className = "auto-drum-portal auto-drum-portal--multi auto-drum-portal--bm auto-drum-portal--sheet";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Gyártmány / Modell");
  const drumH = ITEM_H * MULTI_VISIBLE;
  root.style.setProperty("--auto-drum-multi-h", `${drumH}px`);
  root.style.setProperty("--auto-drum-item-h", `44px`);

  root.innerHTML = `
    <button type="button" class="auto-drum-portal__backdrop" aria-label="Bezárás"></button>
    <div class="auto-drum-portal__stage auto-drum-portal__stage--multi auto-drum-portal__stage--sheet">
      <header class="auto-drum-portal__sheet-head">
        <button type="button" class="auto-drum-portal__close" aria-label="Bezárás">×</button>
        <h2 class="auto-drum-portal__sheet-title">Gyártmány / Modell</h2>
        <span class="auto-drum-portal__sheet-head-spacer" aria-hidden="true"></span>
      </header>
      <div class="auto-drum-portal__sheet-scroll" data-sheet-scroll tabindex="-1">
        <div class="auto-drum-portal__sheet-sticky">
          <p class="auto-drum-portal__sheet-section" data-sheet-section>Népszerű gyártmányok</p>
          <div class="auto-drum-portal__toolbar auto-drum-portal__toolbar--sheet">
            <button type="button" class="auto-drum-portal__back" hidden>Vissza</button>
            <p class="auto-drum-portal__sub" hidden></p>
          </div>
        </div>
        <div class="immo-drum-wheel-ring auto-drum-portal__ring auto-drum-portal__ring--multi auto-drum-portal__ring--sheet">
          <div class="auto-drum-portal__scroll immo-drum-inline-scroll" data-sheet-list></div>
        </div>
      </div>
      <footer class="auto-drum-portal__sheet-foot">
        <span class="auto-drum-portal__count" data-sheet-count>0 kiválasztva</span>
        <button type="button" class="auto-drum-portal__done">Kész</button>
      </footer>
    </div>`;

  const stage = root.querySelector(".auto-drum-portal__stage");
  const ring = root.querySelector(".auto-drum-portal__ring");
  const scrollEl = root.querySelector("[data-sheet-list]");
  const sheetScroll = root.querySelector("[data-sheet-scroll]");
  const backBtn = root.querySelector(".auto-drum-portal__back");
  const subEl = root.querySelector(".auto-drum-portal__sub");
  const doneBtn = root.querySelector(".auto-drum-portal__done");
  const closeBtn = root.querySelector(".auto-drum-portal__close");
  const sectionEl = root.querySelector("[data-sheet-section]");
  const countEl = root.querySelector("[data-sheet-count]");
  const stickyEl = root.querySelector(".auto-drum-portal__sheet-sticky");
  const toolbarEl = root.querySelector(".auto-drum-portal__toolbar--sheet");

  let view = "brands";
  let modelBrand = null;

  function updateCount() {
    if (!countEl) return;
    const brandN = singleSelect
      ? String(readWheel(brandWheel) ?? "").trim()
        ? 1
        : 0
      : readWheelList(brandWheel).length;
    const modelN = modelWheel
      ? singleSelect
        ? String(readWheel(modelWheel) ?? "").trim()
          ? 1
          : 0
        : readWheelList(modelWheel).length
      : 0;
    const n = view === "models" ? Math.max(brandN, modelN) : brandN;
    countEl.textContent = `${n} kiválasztva`;
  }

  function syncModelWheelFromCatalog(brands) {
    if (!modelWheel || !catalog) return;
    let list = [];
    if (brands.length === 1) list = catalog.modellek?.[brands[0]] ?? [];
    else if (brands.length > 1) {
      const set = new Set();
      brands.forEach((b) => (catalog.modellek?.[b] || []).forEach((m) => set.add(m)));
      list = [...set].sort((a, b) => a.localeCompare(b, "hu", { sensitivity: "base" }));
    }
    const prev = new Set(readWheelList(modelWheel));
    fillWheel(
      modelWheel,
      list.map((m) => ({ value: m, label: m })),
      { emptyLabel: singleSelect ? "—" : "Mindegy" }
    );
    modelWheel.dataset.multiple = singleSelect ? "0" : "1";
    if (singleSelect) {
      const cur = String(readWheel(modelWheel) ?? "");
      setWheelValue(modelWheel, list.includes(cur) ? cur : "");
    } else {
      const keep = list.filter((m) => prev.has(m));
      setWheelValue(modelWheel, keep);
    }
    syncDrumWheelDisplay(modelWheel);
  }

  function syncToolbarChrome() {
    const showBar = view === "models";
    toolbarEl?.classList.toggle("is-visible", showBar);
    stickyEl?.classList.toggle("has-toolbar", showBar);
    root.dataset.sheetView = view;
  }

  function renderBrands() {
    view = "brands";
    modelBrand = null;
    ring.dataset.view = "brands";
    subEl.hidden = true;
    subEl.textContent = "";
    backBtn.hidden = true;
    syncToolbarChrome();
    if (sectionEl) sectionEl.textContent = "Népszerű gyártmányok";
    root.setAttribute("aria-label", "Gyártmány / Modell");
    if (sheetScroll) sheetScroll.scrollTop = 0;
    const selected = singleSelect
      ? (() => {
          const v = String(readWheel(brandWheel) ?? "").trim();
          return v ? [v] : [];
        })()
      : readWheelList(brandWheel);
    scrollEl.innerHTML = brandItems.map((row) => switchRowHtml(row)).join("");
    bindSwitchRowClicks(scrollEl, (item) => {
      const value = item.dataset.value ?? "";
      if (value === "") {
        setWheelValue(brandWheel, "");
        if (modelWheel) {
          setWheelValue(modelWheel, "");
          syncDrumWheelDisplay(modelWheel);
        }
        syncDrumWheelDisplay(brandWheel);
        paintSwitchList(scrollEl, brandWheel);
        updateCount();
        return;
      }
      if (singleSelect) {
        const prev = String(readWheel(brandWheel) ?? "");
        setWheelValue(brandWheel, value);
        brandWheel.dataset.multiple = "0";
        syncDrumWheelDisplay(brandWheel);
        if (prev !== value && modelWheel) {
          setWheelValue(modelWheel, "");
          syncDrumWheelDisplay(modelWheel);
        }
        syncModelWheelFromCatalog([value]);
        updateCount();
        renderModels(value);
        return;
      }
      const cur = new Set(readWheelList(brandWheel));
      const turningOn = !cur.has(value);
      if (turningOn) cur.add(value);
      else cur.delete(value);
      setWheelValue(brandWheel, [...cur]);
      syncDrumWheelDisplay(brandWheel);
      syncModelWheelFromCatalog([...cur]);
      updateCount();
      if (turningOn) {
        renderModels(value);
        return;
      }
      paintSwitchList(scrollEl, brandWheel);
    });
    scrollEl.scrollTop = 0;
    if (selected.length) {
      const el = [...scrollEl.querySelectorAll(".immo-drum-inline-item")].find((n) =>
        selected.includes(n.dataset.value ?? "")
      );
      el?.scrollIntoView({ block: "nearest" });
    }
    paintSwitchList(scrollEl, brandWheel);
    updateCount();
  }

  function renderModels(brand) {
    view = "models";
    modelBrand = brand;
    ring.dataset.view = "models";
    subEl.hidden = false;
    subEl.textContent = brand;
    backBtn.hidden = false;
    syncToolbarChrome();
    if (sectionEl) sectionEl.textContent = "Modellek";
    root.setAttribute("aria-label", `Modell — ${brand}`);
    if (sheetScroll) sheetScroll.scrollTop = 0;
    const emptyRow = { value: "", label: singleSelect ? "—" : "Mindegy" };
    const rows = [emptyRow, ...modelsForBrandFromCatalog(catalog, brand)];
    scrollEl.innerHTML = rows.map((row) => switchRowHtml(row)).join("");
    bindSwitchRowClicks(scrollEl, (item) => {
      if (!modelWheel) return;
      const value = item.dataset.value ?? "";
      if (singleSelect) {
        setWheelValue(modelWheel, value);
        modelWheel.dataset.multiple = "0";
        syncDrumWheelDisplay(modelWheel);
        paintSwitchList(scrollEl, modelWheel);
        updateCount();
        return;
      }
      if (value === "") {
        setWheelValue(modelWheel, "");
      } else {
        const cur = new Set(readWheelList(modelWheel));
        if (cur.has(value)) cur.delete(value);
        else cur.add(value);
        setWheelValue(modelWheel, [...cur]);
      }
      syncDrumWheelDisplay(modelWheel);
      paintSwitchList(scrollEl, modelWheel);
      updateCount();
    });
    scrollEl.scrollTop = 0;
    paintSwitchList(scrollEl, modelWheel);
    updateCount();
  }

  backBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    renderBrands();
  });

  root.querySelector(".auto-drum-portal__backdrop")?.addEventListener("click", () => closeAutoDrumSheet(true));
  closeBtn?.addEventListener("click", () => closeAutoDrumSheet(true));
  doneBtn?.addEventListener("click", () => closeAutoDrumSheet(true));
  sheetScroll?.addEventListener(
    "scroll",
    () => paintSwitchList(scrollEl, view === "models" ? modelWheel : brandWheel),
    { passive: true }
  );

  document.body.appendChild(root);
  document.body.classList.add("auto-drum-portal-open");
  wrap?.classList.add("is-open", "has-drum-open");
  wrap?.closest(".immo-dual-range")?.classList.add("has-drum-open");
  (wrap?.closest(".immo-dual-range__half") || wrap?.closest(".immo-schema-cell"))?.classList.add("is-drum-active");
  trigger.setAttribute("aria-expanded", "true");

  stage.style.left = "50%";
  stage.style.top = "auto";
  stage.style.bottom = "0";
  stage.style.transform = "translateX(-50%)";
  activePortal = { root, wheel: brandWheel, scrollEl, ring, wrap, trigger, modelWheel };

  renderBrands();
  requestAnimationFrame(() => {
    ring.style.setProperty("--immo-drum-ring-w", `${Math.min(420, Math.floor(window.innerWidth - 32))}px`);
    updateCount();
  });
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
        <div class="auto-drum-portal__toolbar">
          <button type="button" class="auto-drum-portal__back" hidden>Vissza</button>
          <p class="auto-drum-portal__sub" hidden></p>
          <button type="button" class="auto-drum-portal__done">Kész</button>
        </div>
        <div class="auto-drum-portal__scroll immo-drum-inline-scroll" tabindex="-1"></div>
      </div>
    </div>`;

  const stage = root.querySelector(".auto-drum-portal__stage");
  const ring = root.querySelector(".auto-drum-portal__ring");
  const scrollEl = root.querySelector(".auto-drum-portal__scroll");
  const doneBtn = root.querySelector(".auto-drum-portal__done");

  scrollEl.innerHTML = items.map((row) => switchRowHtml(row)).join("");

  bindSwitchRowClicks(scrollEl, (item) => {
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
    paintSwitchList(scrollEl, wheel);
  });

  root.querySelector(".auto-drum-portal__backdrop")?.addEventListener("click", () => closeAutoDrumSheet(true));
  doneBtn?.addEventListener("click", () => closeAutoDrumSheet(true));

  scrollEl.addEventListener("scroll", () => paintSwitchList(scrollEl, wheel), { passive: true });

  document.body.appendChild(root);
  document.body.classList.add("auto-drum-portal-open");
  wrap?.classList.add("is-open", "has-drum-open");
  wrap?.closest(".immo-dual-range")?.classList.add("has-drum-open");
  (wrap?.closest(".immo-dual-range__half") || wrap?.closest(".immo-schema-cell"))?.classList.add("is-drum-active");
  trigger.setAttribute("aria-expanded", "true");

  positionPortal(stage, trigger);
  activePortal = { root, wheel, scrollEl, ring, wrap, trigger };

  requestAnimationFrame(() => {
    ring.style.setProperty("--immo-drum-ring-w", `${Math.min(340, Math.floor(window.innerWidth * 0.9))}px`);
    if (selected.length) {
      const start = [...scrollEl.querySelectorAll(".immo-drum-inline-item")].find((el) =>
        selected.includes(el.dataset.value ?? "")
      );
      start?.scrollIntoView({ block: "nearest" });
    } else {
      scrollEl.scrollTop = 0;
    }
    paintSwitchList(scrollEl, wheel);
  });
}

/**
 * Önálló kapcsolós dobkerék (nincs immo-wheel) — pl. mobil kivitel picker.
 * getChildren(value) → almenü sorok; ha van, Vissza gombbal vissza.
 */
export function openStandaloneSwitchSheet({
  trigger,
  emptyLabel = "Mindegy",
  items = [],
  initialSelected = [],
  onDone,
  getChildren = null,
} = {}) {
  if (!trigger) return;
  closeAutoDrumSheet(false);
  closeAllInlineDrums(false);

  const selected = new Set((initialSelected || []).map(String).filter(Boolean));
  const root = document.createElement("div");
  root.className = "auto-drum-portal auto-drum-portal--multi";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  const drumH = ITEM_H * MULTI_VISIBLE;
  root.style.setProperty("--auto-drum-multi-h", `${drumH}px`);
  root.style.setProperty("--auto-drum-item-h", `${ITEM_H}px`);

  root.innerHTML = `
    <button type="button" class="auto-drum-portal__backdrop" aria-label="Bezárás"></button>
    <div class="auto-drum-portal__stage auto-drum-portal__stage--multi">
      <div class="immo-drum-wheel-ring auto-drum-portal__ring auto-drum-portal__ring--multi">
        <div class="auto-drum-portal__toolbar">
          <button type="button" class="auto-drum-portal__back" hidden>Vissza</button>
          <p class="auto-drum-portal__sub" hidden></p>
          <button type="button" class="auto-drum-portal__done">Kész</button>
        </div>
        <div class="auto-drum-portal__scroll immo-drum-inline-scroll" tabindex="-1"></div>
      </div>
    </div>`;

  const stage = root.querySelector(".auto-drum-portal__stage");
  const ring = root.querySelector(".auto-drum-portal__ring");
  const scrollEl = root.querySelector(".auto-drum-portal__scroll");
  const backBtn = root.querySelector(".auto-drum-portal__back");
  const subEl = root.querySelector(".auto-drum-portal__sub");
  const doneBtn = root.querySelector(".auto-drum-portal__done");
  const wrap = trigger.closest(".immo-wheel-wrap, .auto-desk-field, .auto-kivitel-field") || trigger.parentElement;

  let view = "main";
  let parentValue = null;
  const openMains = new Set();
  /* Korábbi gyerek-választás → fő kategória kapcsolója bekapcsolva legyen. */
  if (typeof getChildren === "function") {
    for (const item of items) {
      const kids = getChildren(item.value);
      if (!kids?.length) continue;
      if (kids.some((k) => selected.has(String(k.value)))) openMains.add(item.value);
    }
  }

  function paintStandalone(listRows) {
    cancelAnimationFrame(paintFrame);
    paintFrame = requestAnimationFrame(() => {
      scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((item) => {
        const v = item.dataset.value ?? "";
        let isSel = false;
        if (v === "") isSel = selected.size === 0 && openMains.size === 0;
        else if (view === "main" && getChildren) isSel = openMains.has(v) || selected.has(v);
        else isSel = selected.has(v);
        item.style.opacity = "1";
        item.style.fontWeight = isSel ? "700" : "500";
        item.style.color = "#000";
        item.classList.toggle("is-selected", isSel);
        item.querySelector(".auto-drum-switch")?.setAttribute("aria-checked", isSel ? "true" : "false");
      });
    });
  }

  function renderMain() {
    view = "main";
    parentValue = null;
    backBtn.hidden = true;
    subEl.hidden = true;
    const rows = [{ value: "", label: emptyLabel }, ...items];
    scrollEl.innerHTML = rows.map((row) => switchRowHtml(row)).join("");
    bindSwitchRowClicks(scrollEl, (item) => {
      const value = item.dataset.value ?? "";
      if (value === "") {
        selected.clear();
        openMains.clear();
        paintStandalone();
        return;
      }
      if (typeof getChildren === "function") {
        const kids = getChildren(value);
        if (kids?.length) {
          const turningOn = !openMains.has(value);
          if (turningOn) {
            openMains.add(value);
            renderKids(value, kids);
            return;
          }
          openMains.delete(value);
          kids.forEach((k) => selected.delete(k.value));
          paintStandalone();
          return;
        }
      }
      if (selected.has(value)) selected.delete(value);
      else selected.add(value);
      paintStandalone();
    });
    scrollEl.scrollTop = 0;
    paintStandalone();
  }

  function renderKids(parent, kids) {
    view = "kids";
    parentValue = parent;
    backBtn.hidden = false;
    subEl.hidden = false;
    subEl.textContent = items.find((i) => i.value === parent)?.label || parent;
    const rows = [{ value: "", label: emptyLabel }, ...kids];
    scrollEl.innerHTML = rows.map((row) => switchRowHtml(row)).join("");
    bindSwitchRowClicks(scrollEl, (item) => {
      const value = item.dataset.value ?? "";
      if (value === "") {
        kids.forEach((k) => selected.delete(k.value));
        paintStandalone();
        return;
      }
      if (selected.has(value)) selected.delete(value);
      else {
        selected.add(value);
        openMains.add(parent);
      }
      paintStandalone();
    });
    scrollEl.scrollTop = 0;
    paintStandalone();
  }

  function finish(commit) {
    if (commit && typeof getChildren === "function") {
      for (const main of [...openMains]) {
        const kids = getChildren(main);
        if (!kids?.length) continue;
        if (!kids.some((k) => selected.has(String(k.value)))) {
          kids.forEach((k) => selected.add(String(k.value)));
        }
      }
    }
    const list = commit ? [...selected] : [...initialSelected];
    wrap?.classList.remove("is-open", "has-drum-open");
    trigger.setAttribute("aria-expanded", "false");
    root.remove();
    activePortal = null;
    document.body.classList.remove("auto-drum-portal-open", "auto-drum-sheet-open");
    if (commit && typeof onDone === "function") onDone(list, [...openMains]);
  }

  backBtn.addEventListener("click", (event) => {
    event.preventDefault();
    renderMain();
  });
  root.querySelector(".auto-drum-portal__backdrop")?.addEventListener("click", () => finish(true));
  doneBtn?.addEventListener("click", () => finish(true));

  document.body.appendChild(root);
  document.body.classList.add("auto-drum-portal-open");
  wrap?.classList.add("is-open", "has-drum-open");
  trigger.setAttribute("aria-expanded", "true");
  positionPortal(stage, trigger);
  activePortal = { root, wheel: null, scrollEl, ring, wrap, trigger };

  requestAnimationFrame(() => {
    ring.style.setProperty("--immo-drum-ring-w", `${Math.min(340, Math.floor(window.innerWidth * 0.9))}px`);
    renderMain();
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

function paintSplitColSync(scrollEl, ring) {
  if (!scrollEl || !ring) return;
  const ringRect = ring.getBoundingClientRect();
  const centerY = ringRect.top + ringRect.height / 2;
  const nearest = nearestPortalItem(scrollEl, ring);
  scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((item) => {
    const r = item.getBoundingClientRect();
    const mid = r.top + r.height / 2;
    const dist = Math.abs(mid - centerY);
    const t = Math.min(dist / (ITEM_H * 1.15), 1);
    const isSel = item === nearest;
    item.style.opacity = String(Math.max(0.38, 1 - t * 0.55));
    item.style.fontWeight = dist < ITEM_H * 0.42 || isSel ? "650" : "500";
    item.style.color = "#0f172a";
    item.classList.toggle("is-in-cell", isSel);
    item.classList.toggle("is-selected", isSel);
    item.setAttribute("aria-selected", isSel ? "true" : "false");
  });
}

function wheelOptionRows(wheel, emptyLabel = "Mindegy") {
  return normalizeSheetItems([...wheel.querySelectorAll(".immo-wheel-opt")], emptyLabel);
}

function labelForWheelValue(wheel, value, emptyLabel = "Mindegy") {
  const v = String(value ?? "");
  if (v === "") return emptyLabel;
  const row = wheelOptionRows(wheel, emptyLabel).find((r) => String(r.value) === v);
  return row?.label || v;
}

function openSplitRangeDrumSheet(minWheel, maxWheel, trigger) {
  if (!minWheel || !maxWheel || !trigger) return;
  closeAutoDrumSheet(false);
  closeAllInlineDrums(false);

  const dual = minWheel.closest(".immo-dual-range") || maxWheel.closest(".immo-dual-range");
  const wrap = minWheel.closest(".immo-wheel-wrap") || maxWheel.closest(".immo-wheel-wrap");
  const title =
    dual?.querySelector(".immo-dual-range__title")?.textContent?.trim() ||
    trigger.getAttribute("aria-label") ||
    "Tartomány";
  const unit = dual?.querySelector(".immo-dual-range__unit")?.textContent?.trim() || "";
  const splitKind = dual?.dataset.splitKind || "";
  const sheetTitle =
    splitKind === "ym"
      ? title
      : unit
        ? `${title} (-tól -ig) · ${unit}`
        : `${title} (-tól -ig)`;
  const emptyLabel =
    splitKind === "ym"
      ? trigger.dataset.emptyLabel || "—"
      : "Mindegy";
  const minEmpty =
    dual?.querySelector(".immo-dual-range__half--min .immo-wheel-trigger")?.dataset.emptyLabel || emptyLabel;
  const maxEmpty =
    dual?.querySelector(".immo-dual-range__half--max .immo-wheel-trigger")?.dataset.emptyLabel || emptyLabel;
  const minItems = wheelOptionRows(minWheel, minEmpty);
  const maxItems = wheelOptionRows(maxWheel, maxEmpty);
  let pendingMin = String(readWheel(minWheel) ?? "");
  let pendingMax = String(readWheel(maxWheel) ?? "");

  const root = document.createElement("div");
  root.className = "auto-drum-portal auto-drum-portal--multi auto-drum-portal--split";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", sheetTitle);

  root.innerHTML = `
    <button type="button" class="auto-drum-portal__backdrop" aria-label="Bezárás"></button>
    <div class="auto-drum-portal__stage auto-drum-portal__stage--multi auto-drum-portal__stage--split">
      <div class="immo-drum-wheel-ring auto-drum-portal__ring auto-drum-portal__ring--multi auto-drum-portal__ring--split">
        <div class="auto-drum-portal__toolbar">
          <button type="button" class="auto-drum-portal__back" hidden>Vissza</button>
          <p class="auto-drum-portal__sub">${escapeHtml(sheetTitle)}</p>
          <button type="button" class="auto-drum-portal__done">Kész</button>
        </div>
        <div class="auto-drum-split__chips">
          <button type="button" class="auto-drum-split__chip" data-half="min" aria-label="${escapeHtml(splitKind === "ym" ? minEmpty : "Érték -tól")}">
            <span class="auto-drum-split__chip-label"></span>
            <span class="auto-drum-split__chip-clear" hidden aria-hidden="true">×</span>
          </button>
          <button type="button" class="auto-drum-split__chip" data-half="max" aria-label="${escapeHtml(splitKind === "ym" ? maxEmpty : "Érték -ig")}">
            <span class="auto-drum-split__chip-label"></span>
            <span class="auto-drum-split__chip-clear" hidden aria-hidden="true">×</span>
          </button>
        </div>
        <div class="auto-drum-split__body">
          <div class="immo-drum-inline-highlight auto-drum-split__highlight" aria-hidden="true"></div>
          <div class="auto-drum-split__cols">
            <div class="auto-drum-split__col" data-half="min">
              <div class="auto-drum-portal__scroll auto-drum-split__scroll immo-drum-inline-scroll" tabindex="-1"></div>
            </div>
            <div class="auto-drum-split__col" data-half="max">
              <div class="auto-drum-portal__scroll auto-drum-split__scroll immo-drum-inline-scroll" tabindex="-1"></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  const stage = root.querySelector(".auto-drum-portal__stage");
  const ring = root.querySelector(".auto-drum-split__highlight");
  const minScroll = root.querySelector('.auto-drum-split__col[data-half="min"] .auto-drum-split__scroll');
  const maxScroll = root.querySelector('.auto-drum-split__col[data-half="max"] .auto-drum-split__scroll');
  const chipMin = root.querySelector('.auto-drum-split__chip[data-half="min"]');
  const chipMax = root.querySelector('.auto-drum-split__chip[data-half="max"]');
  const doneBtn = root.querySelector(".auto-drum-portal__done");

  function itemHtml(row) {
    return `<div class="immo-drum-inline-item" data-value="${escapeHtml(row.value)}"><span class="immo-drum-inline-text">${escapeHtml(row.label)}</span></div>`;
  }

  minScroll.innerHTML = minItems.map(itemHtml).join("");
  maxScroll.innerHTML = maxItems.map(itemHtml).join("");

  function syncChips() {
    const minLabel = labelForWheelValue(minWheel, pendingMin, minEmpty);
    const maxLabel = labelForWheelValue(maxWheel, pendingMax, maxEmpty);
    chipMin.querySelector(".auto-drum-split__chip-label").textContent = minLabel;
    chipMax.querySelector(".auto-drum-split__chip-label").textContent = maxLabel;
    const clearMin = chipMin.querySelector(".auto-drum-split__chip-clear");
    const clearMax = chipMax.querySelector(".auto-drum-split__chip-clear");
    clearMin.hidden = pendingMin === "";
    clearMax.hidden = pendingMax === "";
    clearMin.setAttribute("aria-hidden", pendingMin === "" ? "true" : "false");
    clearMax.setAttribute("aria-hidden", pendingMax === "" ? "true" : "false");
  }

  function readPendingFromScrolls() {
    pendingMin = nearestPortalItem(minScroll, ring)?.dataset.value ?? "";
    pendingMax = nearestPortalItem(maxScroll, ring)?.dataset.value ?? "";
    syncChips();
  }

  function paintBoth() {
    cancelAnimationFrame(paintFrame);
    paintFrame = requestAnimationFrame(() => {
      paintSplitColSync(minScroll, ring);
      paintSplitColSync(maxScroll, ring);
      const minItem = nearestPortalItem(minScroll, ring);
      const maxItem = nearestPortalItem(maxScroll, ring);
      if (minItem) pendingMin = minItem.dataset.value ?? "";
      if (maxItem) pendingMax = maxItem.dataset.value ?? "";
      syncChips();
    });
  }

  function scrollHalfToValue(scrollEl, value) {
    const start =
      [...scrollEl.querySelectorAll(".immo-drum-inline-item")].find((el) => (el.dataset.value ?? "") === value) ||
      scrollEl.querySelector('.immo-drum-inline-item[data-value=""]') ||
      scrollEl.querySelector(".immo-drum-inline-item");
    scrollToPortalItem(scrollEl, ring, start);
  }

  function bindCol(scrollEl) {
    scrollEl.addEventListener("scroll", () => paintBoth(), { passive: true });
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
      paintBoth();
    };
    scrollEl.addEventListener("touchend", snapEnd);
    scrollEl.addEventListener("touchcancel", snapEnd);
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
        scrollToPortalItem(scrollEl, ring, item);
        paintBoth();
      });
    });
  }

  bindCol(minScroll);
  bindCol(maxScroll);

  function onChipClear(half, event) {
    event.preventDefault();
    event.stopPropagation();
    if (half === "min") {
      pendingMin = "";
      scrollHalfToValue(minScroll, "");
    } else {
      pendingMax = "";
      scrollHalfToValue(maxScroll, "");
    }
    paintBoth();
  }

  chipMin.addEventListener("click", (event) => {
    if (event.target.closest(".auto-drum-split__chip-clear")) onChipClear("min", event);
  });
  chipMax.addEventListener("click", (event) => {
    if (event.target.closest(".auto-drum-split__chip-clear")) onChipClear("max", event);
  });

  root.querySelector(".auto-drum-portal__backdrop")?.addEventListener("click", () => closeAutoDrumSheet(true));
  doneBtn?.addEventListener("click", () => {
    readPendingFromScrolls();
    closeAutoDrumSheet(true);
  });

  document.body.appendChild(root);
  document.body.classList.add("auto-drum-portal-open");
  wrap?.classList.add("is-open", "has-drum-open");
  dual?.classList.add("has-drum-open");
  dual?.querySelectorAll(".immo-dual-range__half").forEach((half) => half.classList.add("is-drum-active"));
  trigger.setAttribute("aria-expanded", "true");

  positionPortal(stage, trigger);
  activePortal = {
    kind: "split",
    root,
    wheel: minWheel,
    minWheel,
    maxWheel,
    minScroll,
    maxScroll,
    scrollEl: minScroll,
    ring,
    wrap,
    trigger,
  };

  requestAnimationFrame(() => {
    root
      .querySelector(".auto-drum-portal__ring--split")
      ?.style.setProperty("--immo-drum-ring-w", `${Math.min(360, Math.floor(window.innerWidth * 0.92))}px`);
    scrollHalfToValue(minScroll, pendingMin);
    scrollHalfToValue(maxScroll, pendingMax);
    paintBoth();
  });
}

/**
 * Kategória + almenü kapcsolós dobkerék (üzemanyag, állapot).
 * @param {HTMLElement} wheel
 * @param {HTMLElement} trigger
 * @param {string} emptyLabel
 * @param {{ id: string, label: string, value?: string, children?: { label: string, value: string }[] }[]} categories
 * @param {() => string[]} flattenFn
 */
function openHierarchyCategorySheet(wheel, trigger, emptyLabel, categories, flattenFn) {
  const flat = flattenFn().map((v) => ({ value: v, label: v }));
  fillWheel(wheel, flat, { emptyLabel });
  wheel.dataset.multiple = "1";
  openStandaloneSwitchSheet({
    trigger,
    emptyLabel,
    items: categories.map((c) => ({
      value: c.children?.length ? c.id : c.value || c.id,
      label: c.label,
    })),
    initialSelected: readWheelList(wheel),
    getChildren: (mainValue) => {
      const cat = categories.find(
        (c) => c.id === mainValue || c.value === mainValue || c.label === mainValue
      );
      if (!cat?.children?.length) return null;
      return cat.children.map((ch) => ({ value: ch.value, label: ch.label }));
    },
    onDone: (list) => {
      const values = [...new Set((list || []).map(String).filter(Boolean))];
      setWheelValue(wheel, values);
      syncDrumWheelDisplay(wheel);
      wheel.dispatchEvent(
        new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: readWheel(wheel) } })
      );
    },
  });
}

export function openAutoDrumSheet(wheel, trigger, { sheetItems = null, form = null } = {}) {
  if (!wheel || !trigger) return;
  closeAutoDrumSheet(false);
  closeAllInlineDrums(false);

  const wrap = wheel.closest(".immo-wheel-wrap");
  const emptyLabel = trigger.dataset.emptyLabel || "Mindegy";
  const wheelKey = wheel.getAttribute("data-wheel") || "";
  const host = form || wheel.closest("form") || document.getElementById("home-qs-form");
  const multiple = wheel.dataset.multiple === "1" || wheelKey === "gyartmany" || wheelKey === "modell";
  if (multiple) wheel.dataset.multiple = "1";
  const current = String(readWheel(wheel) ?? "");
  const opts = [...wheel.querySelectorAll(".immo-wheel-opt")];

  const dual = wheel.closest(".immo-dual-range");
  if (dual && !multiple) {
    const minW = dual.querySelector(".immo-dual-range__half--min [data-wheel]");
    const maxW = dual.querySelector(".immo-dual-range__half--max [data-wheel]");
    if (minW && maxW) {
      openSplitRangeDrumSheet(minW, maxW, trigger);
      return;
    }
  }

  const triple = wheel.closest(".immo-triple-date");
  if (triple && !multiple) {
    const yW = triple.querySelector('[data-wheel="muszaki_ev"]');
    const mW = triple.querySelector('[data-wheel="muszaki_honap"]');
    const dW = triple.querySelector('[data-wheel="muszaki_nap"]');
    if (yW && mW && dW) {
      openTripleDateDrumSheet(yW, mW, dW, trigger);
      return;
    }
  }

  if (wheelKey === "gyartmany" && host?._autoDrumCatalog?.gyartmanyok?.length) {
    openBrandModelCatalogSheet(wheel, trigger, wrap, emptyLabel, host);
    return;
  }

  if (multiple && (wheelKey === "uzemanyag" || wheelKey === "uzemanyagQuick")) {
    openHierarchyCategorySheet(wheel, trigger, emptyLabel, UZEMANYAG_CATEGORIES, flattenUzemanyagOptions);
    return;
  }

  if (multiple && wheelKey === "allapot") {
    openHierarchyCategorySheet(wheel, trigger, emptyLabel, ALLAPOT_CATEGORIES, flattenAllapotOptions);
    return;
  }

  if (multiple) {
    const items = sheetItems ?? normalizeSheetItems(opts, emptyLabel);
    openMultiSwitchSheet(wheel, trigger, wrap, emptyLabel, items);
    return;
  }

  const sheetTitle =
    wrap?.querySelector(".immo-label")?.textContent?.trim() ||
    wheel.getAttribute("aria-label") ||
    emptyLabel;
  const root = document.createElement("div");
  root.className = "auto-drum-portal auto-drum-portal--multi auto-drum-portal--single";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", sheetTitle);
  root.style.setProperty("--auto-drum-single-h", "13.5rem");
  root.style.setProperty("--auto-drum-item-h", `${ITEM_H}px`);

  root.innerHTML = `
    <button type="button" class="auto-drum-portal__backdrop" aria-label="Bezárás"></button>
    <div class="auto-drum-portal__stage auto-drum-portal__stage--multi auto-drum-portal__stage--single">
      <div class="immo-drum-wheel-ring auto-drum-portal__ring auto-drum-portal__ring--multi auto-drum-portal__ring--single">
        <div class="auto-drum-portal__toolbar">
          <button type="button" class="auto-drum-portal__back" hidden>Vissza</button>
          <p class="auto-drum-portal__sub">${escapeHtml(sheetTitle)}</p>
          <button type="button" class="auto-drum-portal__done">Kész</button>
        </div>
        <div class="auto-drum-single__body">
          <div class="immo-drum-inline-highlight auto-drum-single__highlight" aria-hidden="true"></div>
          <div class="auto-drum-portal__scroll auto-drum-single__scroll immo-drum-inline-scroll" tabindex="-1"></div>
        </div>
      </div>
    </div>`;

  const stage = root.querySelector(".auto-drum-portal__stage");
  const ring = root.querySelector(".auto-drum-single__highlight");
  const scrollEl = root.querySelector(".auto-drum-single__scroll");
  const outerRing = root.querySelector(".auto-drum-portal__ring--single");

  scrollEl.innerHTML = opts
    .map((btn) => {
      const value = btn.dataset.value ?? "";
      const label = (btn.textContent || "").trim() || emptyLabel;
      return `<div class="immo-drum-inline-item" data-value="${escapeHtml(value)}"><span class="immo-drum-inline-text">${escapeHtml(label)}</span></div>`;
    })
    .join("");

  root.querySelector(".auto-drum-portal__backdrop")?.addEventListener("click", () => closeAutoDrumSheet(true));
  root.querySelector(".auto-drum-portal__done")?.addEventListener("click", () => closeAutoDrumSheet(true));

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
      scrollToPortalItem(scrollEl, ring, item);
      paintPortal(scrollEl, ring, wheel);
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
    outerRing?.style.setProperty(
      "--immo-drum-ring-w",
      `${Math.min(320, Math.floor(window.innerWidth * 0.88))}px`
    );
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
    openAutoDrumSheet(current, next, { sheetItems, form: host });
  });
}
