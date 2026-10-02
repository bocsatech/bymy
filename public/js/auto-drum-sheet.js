
import { readWheel, readWheelList, setWheelValue, fillWheel } from "./ingatlan-wheels.js?v=6952ba469c";
import { closeAllInlineDrums, syncDrumWheelDisplay } from "./immo-drum-picker.js?v=c4c7ac29a2";
import {
  UZEMANYAG_CATEGORIES,
  flattenUzemanyagOptions,
  ALLAPOT_CATEGORIES,
  flattenAllapotOptions,
  TEHER_35_KIVITEL_CATEGORIES,
  flattenTeher35KivitelOptions,
} from "./equipment-data.js?v=5a39cb5ba3";

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

/** Auto oldal: sheet chrome mobilon; desk split tartomány külön mindig sheet (lásd openSplitRangeDrumSheet). */
function isMobileDrumSheet() {
  return !window.matchMedia("(min-width: 901px)").matches;
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

  const useSheet = isMobileDrumSheet();
  let root;
  let stage;
  let ring;
  let yearScroll;
  let monthScroll;
  let dayScroll;
  let chip;
  let doneBtn;
  let closeBtn;
  let sheetScroll = null;
  let ringEl = null;

  if (useSheet) {
    ({ root, stage, ring: ringEl, sheetScroll, doneBtn, closeBtn } = createSheetPortalShell(sheetTitle));
    root.classList.add("auto-drum-portal--ym", "auto-drum-portal--date3");
    ringEl.innerHTML = `
        <div class="auto-drum-split__chips auto-drum-date3__chips auto-drum-ym__chips">
          <button type="button" class="auto-drum-split__chip auto-drum-date3__chip" aria-label="Dátum">
            <span class="auto-drum-split__chip-label"></span>
            <span class="auto-drum-split__chip-clear" hidden aria-hidden="true">×</span>
          </button>
        </div>
        <div class="auto-drum-date3__heads auto-drum-ym__heads" aria-hidden="true">
          <span>Év</span><span>Hó</span><span>Nap</span>
        </div>
        <div class="auto-drum-split__body auto-drum-date3__body auto-drum-ym__body" style="width:100%;max-width:100%;box-sizing:border-box;">
          <div class="immo-drum-inline-highlight auto-drum-split__highlight auto-drum-ym__highlight" aria-hidden="true" style="left:0.4rem;right:0.4rem;width:auto;transform:translateY(-50%);"></div>
          <div class="auto-drum-split__cols auto-drum-date3__cols auto-drum-ym__cols" style="width:100%;max-width:100%;">
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
        </div>`;
    ring = root.querySelector(".auto-drum-split__highlight");
    yearScroll = root.querySelector('.auto-drum-split__col[data-half="year"] .auto-drum-split__scroll');
    monthScroll = root.querySelector('.auto-drum-split__col[data-half="month"] .auto-drum-split__scroll');
    dayScroll = root.querySelector('.auto-drum-split__col[data-half="day"] .auto-drum-split__scroll');
    chip = root.querySelector(".auto-drum-date3__chip");
  } else {
    root = document.createElement("div");
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

    stage = root.querySelector(".auto-drum-portal__stage");
    ring = root.querySelector(".auto-drum-split__highlight");
    yearScroll = root.querySelector('.auto-drum-split__col[data-half="year"] .auto-drum-split__scroll');
    monthScroll = root.querySelector('.auto-drum-split__col[data-half="month"] .auto-drum-split__scroll');
    dayScroll = root.querySelector('.auto-drum-split__col[data-half="day"] .auto-drum-split__scroll');
    chip = root.querySelector(".auto-drum-date3__chip");
    doneBtn = root.querySelector(".auto-drum-portal__done");
  }

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
  closeBtn?.addEventListener("click", () => closeAutoDrumSheet(false));
  doneBtn?.addEventListener("click", () => closeAutoDrumSheet(true));

  if (useSheet) {
    if (sheetScroll) {
      sheetScroll.style.overflow = "hidden";
      sheetScroll.scrollTop = 0;
    }
    mountSheetPortalChrome(root, { stage, wrap, trigger, ring: ringEl, sheetScroll });
    block?.classList.add("has-drum-open");
    block?.querySelectorAll(".immo-triple-date__half").forEach((half) => half.classList.add("is-drum-active"));
  } else {
    document.body.appendChild(root);
    document.body.classList.add("auto-drum-portal-open");
    wrap?.classList.add("is-open", "has-drum-open");
    block?.classList.add("has-drum-open");
    block?.querySelectorAll(".immo-triple-date__half").forEach((half) => half.classList.add("is-drum-active"));
    trigger.setAttribute("aria-expanded", "true");
    positionPortal(stage, trigger);
  }

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
    if (!useSheet) {
      root
        .querySelector(".auto-drum-portal__ring--date3")
        ?.style.setProperty("--immo-drum-ring-w", `${Math.min(360, Math.floor(window.innerWidth * 0.92))}px`);
    }
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
  const resetPageAfterClose = () => {
    const restoreY = sheetScrollLockY || 0;
    document.body.classList.remove("auto-drum-portal-open", "auto-drum-sheet-open");
    unlockSheetPageAxes();
    const stick = () => {
      window.scrollTo(0, restoreY);
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
    };
    stick();
    requestAnimationFrame(() => {
      unlockSheetPageAxes();
      stick();
    });
  };
  if (!wheel && kind !== "split" && kind !== "date3" && kind !== "ym-sheet" && kind !== "tire-sheet") {
    /* Standalone sheet — done handler already owns commit. */
    wrap?.classList.remove("is-open", "has-drum-open");
    trigger?.setAttribute("aria-expanded", "false");
    root.remove();
    activePortal = null;
    resetPageAfterClose();
    return;
  }
  if (kind === "ym-sheet") {
    if (commit && yearWheel && monthWheel && yearScroll && monthScroll && ring) {
      let y = nearestPortalItem(yearScroll, ring)?.dataset.value ?? "";
      let m = nearestPortalItem(monthScroll, ring)?.dataset.value ?? "";
      if (activePortal?.pendingY != null) y = String(activePortal.pendingY);
      if (activePortal?.pendingM != null) m = String(activePortal.pendingM);
      if (!y) m = "";
      else if (!m) {
        /* év megvan, hónap üres — így hagyjuk (nem force-olunk első hónapot) */
      }
      if (m) m = matchWheelOptionValue(monthWheel, m) || m;
      if (y) y = matchWheelOptionValue(yearWheel, y) || y;
      setWheelValue(yearWheel, y);
      setWheelValue(monthWheel, m);
      syncDrumWheelDisplay(yearWheel);
      syncDrumWheelDisplay(monthWheel);
      yearWheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: y } }));
      monthWheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: m } }));
    }
    wrap?.classList.remove("is-open", "has-drum-open");
    wrap?.closest(".immo-dual-range, .ad-form-split-ym, .immo-triple-date")?.classList.remove("has-drum-open");
    document
      .querySelectorAll(".immo-dual-range__half.is-drum-active, .immo-triple-date__half.is-drum-active")
      .forEach((el) => el.classList.remove("is-drum-active"));
    trigger?.setAttribute("aria-expanded", "false");
    root.remove();
    activePortal = null;
    resetPageAfterClose();
    return;
  }
  if (kind === "tire-sheet") {
    const {
      widthWheel,
      aspectWheel,
      rimWheel,
      widthSelect,
      aspectSelect,
      rimSelect,
      widthScroll,
      aspectScroll,
      rimScroll,
    } = activePortal;
    if (commit && widthScroll && aspectScroll && rimScroll && ring) {
      let w = nearestPortalItem(widthScroll, ring)?.dataset.value ?? "";
      let a = nearestPortalItem(aspectScroll, ring)?.dataset.value ?? "";
      let r = nearestPortalItem(rimScroll, ring)?.dataset.value ?? "";
      if (activePortal?.pendingW != null) w = String(activePortal.pendingW);
      if (activePortal?.pendingA != null) a = String(activePortal.pendingA);
      if (activePortal?.pendingR != null) r = String(activePortal.pendingR);
      if (widthSelect || aspectSelect || rimSelect) {
        const writeSelect = (select, value) => {
          if (!(select instanceof HTMLSelectElement)) return;
          const v = String(value ?? "");
          if (v && ![...select.options].some((o) => o.value === v)) {
            const opt = document.createElement("option");
            opt.value = v;
            opt.textContent = v;
            select.appendChild(opt);
          }
          if (select.value !== v) {
            select.value = v;
            select.dispatchEvent(new Event("input", { bubbles: true }));
            select.dispatchEvent(new Event("change", { bubbles: true }));
          }
        };
        writeSelect(widthSelect, w);
        writeSelect(aspectSelect, a);
        writeSelect(rimSelect, r);
        widthSelect?.closest?.(".ad-form-tire-split")?.dispatchEvent?.(
          new CustomEvent("ad-tire-change", { bubbles: true, detail: { w, a, r } })
        );
      } else if (widthWheel && aspectWheel && rimWheel) {
        if (w) w = matchWheelOptionValue(widthWheel, w) || w;
        if (a) a = matchWheelOptionValue(aspectWheel, a) || a;
        if (r) r = matchWheelOptionValue(rimWheel, r) || r;
        setWheelValue(widthWheel, w);
        setWheelValue(aspectWheel, a);
        setWheelValue(rimWheel, r);
        syncDrumWheelDisplay(widthWheel);
        syncDrumWheelDisplay(aspectWheel);
        syncDrumWheelDisplay(rimWheel);
        widthWheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: w } }));
        aspectWheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: a } }));
        rimWheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: r } }));
      }
    }
    wrap?.classList.remove("is-open", "has-drum-open");
    wrap?.closest(".ad-form-split-ym, .ad-form-tire-split")?.classList.remove("has-drum-open");
    document
      .querySelectorAll(".immo-dual-range__half.is-drum-active, .ad-form-tire-split__half.is-drum-active")
      .forEach((el) => el.classList.remove("is-drum-active"));
    trigger?.setAttribute("aria-expanded", "false");
    root.remove();
    activePortal = null;
    resetPageAfterClose();
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
    resetPageAfterClose();
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
    resetPageAfterClose();
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
  resetPageAfterClose();
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

function createSheetPortalShell(title) {
  const root = document.createElement("div");
  root.className = "auto-drum-portal auto-drum-portal--multi auto-drum-portal--sheet";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", title);
  root.style.setProperty("--auto-drum-multi-h", `${ITEM_H * MULTI_VISIBLE}px`);
  root.style.setProperty("--auto-drum-item-h", `44px`);
  /* Fehér ring középen a kéken — margin:auto, nincs translateX / right:auto. */
  root.innerHTML = `
    <button type="button" class="auto-drum-portal__backdrop" aria-label="Bezárás"></button>
    <div class="auto-drum-portal__stage auto-drum-portal__stage--multi auto-drum-portal__stage--sheet" style="left:0;right:0;top:0;bottom:0;width:100%;max-width:100%;margin-left:auto;margin-right:auto;transform:none;box-sizing:border-box;">
      <header class="auto-drum-portal__sheet-head" style="position:absolute;top:0;left:0;right:0;width:100%;max-width:100%;z-index:30;background:#e8eef3;display:grid;visibility:visible;opacity:1;">
        <button type="button" class="auto-drum-portal__close" aria-label="Bezárás">×</button>
        <h2 class="auto-drum-portal__sheet-title"></h2>
        <button type="button" class="auto-drum-portal__done auto-drum-portal__done--sheet-top">Kész</button>
      </header>
      <div class="auto-drum-portal__sheet-scroll" data-sheet-scroll tabindex="-1" style="left:0;right:0;width:100%;max-width:100%;margin-left:auto;margin-right:auto;padding-left:1rem;padding-right:1rem;box-sizing:border-box;overflow-x:hidden;display:flex;flex-direction:column;align-items:center;">
        <div class="auto-drum-portal__sheet-top-space" aria-hidden="true"></div>
        <div class="immo-drum-wheel-ring auto-drum-portal__ring auto-drum-portal__ring--multi auto-drum-portal__ring--sheet" style="width:100%;max-width:100%;min-width:0;margin-left:auto;margin-right:auto;left:0;right:0;transform:none;box-sizing:border-box;">
          <div class="auto-drum-portal__toolbar auto-drum-portal__toolbar--sheet">
            <button type="button" class="auto-drum-portal__back" hidden>Vissza</button>
            <p class="auto-drum-portal__sub" hidden></p>
          </div>
          <div class="auto-drum-portal__scroll immo-drum-inline-scroll" data-sheet-list></div>
        </div>
      </div>
    </div>`;
  const titleEl = root.querySelector(".auto-drum-portal__sheet-title");
  if (titleEl) titleEl.textContent = title;
  return {
    root,
    stage: root.querySelector(".auto-drum-portal__stage"),
    ring: root.querySelector(".auto-drum-portal__ring"),
    scrollEl: root.querySelector("[data-sheet-list]"),
    sheetScroll: root.querySelector("[data-sheet-scroll]"),
    backBtn: root.querySelector(".auto-drum-portal__back"),
    subEl: root.querySelector(".auto-drum-portal__sub"),
    doneBtn: root.querySelector(".auto-drum-portal__done"),
    closeBtn: root.querySelector(".auto-drum-portal__close"),
    toolbarEl: root.querySelector(".auto-drum-portal__toolbar--sheet"),
  };
}

function lockSheetWhiteToBlue(root, stage) {
  if (!root || !stage) return;
  const scroll = root.querySelector?.("[data-sheet-scroll]");
  const ring = root.querySelector?.(".auto-drum-portal__ring--sheet");
  const head = root.querySelector?.(".auto-drum-portal__sheet-head");
  const ym = Boolean(root?.classList?.contains("auto-drum-portal--ym"));
  const desk = window.matchMedia("(min-width: 901px)").matches;
  /* Kék stage középen; fehér ring a kéken belül mindig középen — nincs left-only / translateX. */
  stage.style.setProperty("left", "0", "important");
  stage.style.setProperty("right", "0", "important");
  stage.style.setProperty("margin-left", "auto", "important");
  stage.style.setProperty("margin-right", "auto", "important");
  if (scroll) {
    scroll.style.setProperty("left", "0", "important");
    scroll.style.setProperty("right", "0", "important");
    scroll.style.setProperty("width", "100%", "important");
    scroll.style.setProperty("max-width", "100%", "important");
    scroll.style.setProperty("margin-left", "auto", "important");
    scroll.style.setProperty("margin-right", "auto", "important");
    scroll.style.setProperty("overflow-x", "hidden", "important");
    scroll.style.setProperty("display", "flex", "important");
    scroll.style.setProperty("flex-direction", "column", "important");
    scroll.style.setProperty("align-items", "center", "important");
    /* Egyenlő oldalsó padding = fehér középen a kéken */
    scroll.style.setProperty("padding-left", "1rem", "important");
    scroll.style.setProperty("padding-right", "1rem", "important");
  }
  if (ring) {
    ring.style.setProperty("width", "100%", "important");
    ring.style.setProperty("max-width", "100%", "important");
    ring.style.setProperty("min-width", "0", "important");
    ring.style.setProperty("margin-left", "auto", "important");
    ring.style.setProperty("margin-right", "auto", "important");
    ring.style.setProperty("left", "0", "important");
    ring.style.setProperty("right", "0", "important");
    ring.style.setProperty("transform", "none", "important");
  }
  /* Felső gombsor MINDIG a kék tetején, abszolút, átlátszatlan — nem csúszhat el / nem takarodhat. */
  if (head) {
    head.style.setProperty("position", "absolute", "important");
    head.style.setProperty("top", "0", "important");
    head.style.setProperty("left", "0", "important");
    head.style.setProperty("right", "0", "important");
    head.style.setProperty("width", "100%", "important");
    head.style.setProperty("max-width", "100%", "important");
    head.style.setProperty("z-index", "30", "important");
    head.style.setProperty("background", "#e8eef3", "important");
    head.style.setProperty("display", "grid", "important");
    head.style.setProperty("visibility", "visible", "important");
    head.style.setProperty("opacity", "1", "important");
  }
  if (ym && desk && stage) {
    stage.style.setProperty("padding-top", "var(--sheet-head-h)", "important");
  }
}

function applySheetStageLayout(stage) {
  if (!stage) return;
  const root = stage.closest?.(".auto-drum-portal--sheet") || stage.parentElement;
  const desk = window.matchMedia("(min-width: 901px)").matches;
  const ym = Boolean(root?.classList?.contains("auto-drum-portal--ym"));
  if (desk) {
    const deskW = "min(28rem, calc(100% - 2rem))";
    /* Desk: kék stage fix szélesség HTML/inline-ban — nincs left%/translateX. */
    stage.style.setProperty("left", "0", "important");
    stage.style.setProperty("right", "0", "important");
    stage.style.setProperty("width", deskW, "important");
    stage.style.setProperty("max-width", deskW, "important");
    stage.style.setProperty("margin-left", "auto", "important");
    stage.style.setProperty("margin-right", "auto", "important");
    stage.style.setProperty("transform", "none", "important");
    if (ym) {
      stage.style.setProperty("top", "50%", "important");
      stage.style.setProperty("bottom", "auto", "important");
      stage.style.setProperty("height", "fit-content", "important");
      stage.style.setProperty("transform", "translateY(-50%)", "important");
    } else {
      stage.style.setProperty("top", "0", "important");
      stage.style.setProperty("bottom", "0", "important");
      stage.style.setProperty("height", "min(86vh, 48rem)", "important");
      stage.style.setProperty("margin-top", "auto", "important");
      stage.style.setProperty("margin-bottom", "auto", "important");
    }
    lockSheetWhiteToBlue(root, stage);
    return;
  }
  /* Mobil: kék full-bleed, fehér ugyanakkora szélesség. */
  stage.style.setProperty("left", "0", "important");
  stage.style.setProperty("right", "0", "important");
  stage.style.setProperty("top", "0", "important");
  stage.style.setProperty("bottom", "0", "important");
  stage.style.setProperty("width", "100%", "important");
  stage.style.setProperty("max-width", "100%", "important");
  stage.style.setProperty("height", "100%", "important");
  stage.style.setProperty("transform", "none", "important");
  stage.style.setProperty("margin", "0", "important");
  lockSheetWhiteToBlue(root, stage);
}

let sheetScrollLockY = 0;
let sheetScrollLocked = false;

function lockSheetPageAxes() {
  try {
    /* Ha már locked, NE írd felül a mentett Y-t — a második hívás (rAF) scrollY=0 lenne. */
    if (!sheetScrollLocked) {
      sheetScrollLockY = window.scrollY || window.pageYOffset || 0;
      sheetScrollLocked = true;
    }
    const y = sheetScrollLockY;
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
    /* iOS/Android: body fixed + left:0 — menü nyitáskor ne csússzon jobbra. */
    document.body.style.setProperty("position", "fixed", "important");
    document.body.style.setProperty("top", `-${y}px`, "important");
    document.body.style.setProperty("left", "0", "important");
    document.body.style.setProperty("right", "0", "important");
    document.body.style.setProperty("width", "100%", "important");
    document.body.style.setProperty("max-width", "100%", "important");
    document.body.style.setProperty("margin-left", "0", "important");
    document.body.style.setProperty("margin-right", "0", "important");
    document.body.style.setProperty("overflow", "hidden", "important");
    document.body.style.setProperty("overflow-x", "hidden", "important");
    document.documentElement.style.setProperty("overflow-x", "hidden", "important");
    window.scrollTo(0, 0);
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
  } catch {
    /* ignore */
  }
}

function unlockSheetPageAxes() {
  try {
    const clear = (el, props) => {
      if (!el) return;
      for (const p of props) el.style.removeProperty(p);
    };
    clear(document.body, [
      "position",
      "top",
      "left",
      "right",
      "width",
      "max-width",
      "margin-left",
      "margin-right",
      "overflow",
      "overflow-x",
      "touch-action",
    ]);
    clear(document.documentElement, ["overflow", "overflow-x"]);
    document.body.classList.remove("auto-drum-portal-open", "auto-drum-sheet-open");
    const y = sheetScrollLockY || 0;
    sheetScrollLocked = false;
    window.scrollTo(0, y);
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
  } catch {
    sheetScrollLocked = false;
  }
}

function mountSheetPortalChrome(root, { stage, wrap, trigger, ring, sheetScroll }) {
  lockSheetPageAxes();
  root.style.setProperty("position", "fixed", "important");
  root.style.setProperty("left", "0", "important");
  root.style.setProperty("right", "0", "important");
  root.style.setProperty("top", "0", "important");
  root.style.setProperty("bottom", "0", "important");
  root.style.setProperty("width", "100%", "important");
  root.style.setProperty("max-width", "100%", "important");
  root.style.setProperty("margin", "0", "important");
  root.style.setProperty("transform", "none", "important");
  document.body.appendChild(root);
  document.body.classList.add("auto-drum-portal-open", "auto-drum-sheet-open");
  wrap?.classList.add("is-open", "has-drum-open");
  wrap?.closest(".immo-dual-range")?.classList.add("has-drum-open");
  (wrap?.closest(".immo-dual-range__half") || wrap?.closest(".immo-schema-cell"))?.classList.add("is-drum-active");
  trigger?.setAttribute("aria-expanded", "true");
  applySheetStageLayout(stage);
  positionSheetOverSearchPanel(stage, trigger);
  if (stage) {
    const ym = Boolean(stage.closest?.(".auto-drum-portal--ym"));
    const desk = window.matchMedia("(min-width: 901px)").matches;
    const overSearch = Boolean(
      trigger?.closest?.(".auto-search-panel, .auto-search-desk-shell") ||
        document.body.classList.contains("auto-desk-active")
    );
    stage.style.setProperty("position", desk ? "absolute" : "fixed", "important");
    if (!overSearch) {
      stage.style.setProperty("left", "0", "important");
      stage.style.setProperty("right", "0", "important");
      if (!(ym && desk)) {
        stage.style.setProperty("transform", "none", "important");
        stage.style.setProperty("margin-left", desk ? "auto" : "0", "important");
        stage.style.setProperty("margin-right", desk ? "auto" : "0", "important");
      }
    }
  }
  lockSheetPageAxes();
  requestAnimationFrame(() => {
    applySheetStageLayout(stage);
    positionSheetOverSearchPanel(stage, trigger);
    lockSheetPageAxes();
  });
  const scroll = sheetScroll || root.querySelector?.("[data-sheet-scroll]");
  if (scroll) {
    scroll.style.overflow = "hidden";
    scroll.scrollTop = 0;
    scroll.addEventListener(
      "touchmove",
      (event) => {
        /* Külső kék ne mozogjon — csak a fehér ring / oszlopok görgessenek */
        if (event.target?.closest?.(".auto-drum-portal__ring, .auto-drum-split__scroll, .immo-drum-inline-scroll, [data-sheet-list]")) {
          return;
        }
        event.preventDefault();
      },
      { passive: false }
    );
  }
  requestAnimationFrame(() => {
    ring?.style.setProperty("--immo-drum-ring-w", `${Math.min(420, Math.floor(window.innerWidth - 32))}px`);
  });
}

/** Desk autó kereső: ne szűkítsük a sheetet a bal panelre — ugyanaz a chrome mint mobil weben. */
function positionSheetOverSearchPanel(stage, trigger) {
  return;
}

function ymOptionRows(wheel, emptyLabel) {
  const rows = wheelOptionRows(wheel, emptyLabel).filter((r) => String(r.value ?? "") !== "" || r.label);
  const filled = rows.filter((r) => String(r.value ?? "") !== "");
  return [{ value: "", label: emptyLabel }, ...filled];
}

/**
 * Ad-form év|hó: gyártmány sheet chrome + kereső-stílusú 2 oszlopos dobkerék (nap nélkül).
 */
export function openYmDualSheet(yearWheel, monthWheel, trigger, { title = null } = {}) {
  if (!yearWheel || !monthWheel || !trigger) return;
  closeAutoDrumSheet(false);
  closeAllInlineDrums(false);

  const dual =
    yearWheel.closest(".immo-dual-range, .ad-form-split-ym, .immo-triple-date") ||
    monthWheel.closest(".immo-dual-range, .ad-form-split-ym, .immo-triple-date");
  const wrap = yearWheel.closest(".immo-wheel-wrap") || monthWheel.closest(".immo-wheel-wrap");
  const sheetTitle =
    title ||
    dual?.querySelector(".immo-dual-range__title, .immo-triple-date__title, .immo-label")?.textContent?.trim() ||
    trigger.getAttribute("aria-label") ||
    "Dátum";
  const yearEmpty =
    dual?.querySelector(".immo-dual-range__half--min .immo-wheel-trigger, .immo-triple-date__half--year .immo-wheel-trigger")
      ?.dataset.emptyLabel || "év";
  const monthEmpty =
    dual?.querySelector(".immo-dual-range__half--max .immo-wheel-trigger, .immo-triple-date__half--month .immo-wheel-trigger")
      ?.dataset.emptyLabel || "hó";

  let pendingY = String(readWheel(yearWheel) ?? "");
  let pendingM = String(readWheel(monthWheel) ?? "");

  const { root, stage, ring, sheetScroll, doneBtn, closeBtn } = createSheetPortalShell(sheetTitle);
  root.classList.add("auto-drum-portal--ym");
  document.body.classList.add("auto-drum-sheet-open");

  ring.innerHTML = `
    <div class="auto-drum-ym__chips">
      <button type="button" class="auto-drum-split__chip auto-drum-ym__chip" aria-label="Dátum">
        <span class="auto-drum-split__chip-label"></span>
        <span class="auto-drum-split__chip-clear" hidden aria-hidden="true">×</span>
      </button>
    </div>
    <div class="auto-drum-ym__heads" aria-hidden="true"><span>Év</span><span>Hó</span></div>
    <div class="auto-drum-ym__body" style="width:100%;max-width:100%;box-sizing:border-box;">
      <div class="immo-drum-inline-highlight auto-drum-ym__highlight" aria-hidden="true" style="left:0.4rem;right:0.4rem;width:auto;transform:translateY(-50%);"></div>
      <div class="auto-drum-ym__cols" style="width:100%;max-width:100%;">
        <div class="auto-drum-split__col" data-half="year">
          <div class="auto-drum-portal__scroll auto-drum-split__scroll immo-drum-inline-scroll" tabindex="-1"></div>
        </div>
        <div class="auto-drum-split__col" data-half="month">
          <div class="auto-drum-portal__scroll auto-drum-split__scroll immo-drum-inline-scroll" tabindex="-1"></div>
        </div>
      </div>
    </div>`;

  if (sheetScroll) {
    sheetScroll.style.overflow = "hidden";
    sheetScroll.scrollTop = 0;
    sheetScroll.style.setProperty("padding-left", "1rem", "important");
    sheetScroll.style.setProperty("padding-right", "1rem", "important");
    sheetScroll.style.setProperty("width", "100%", "important");
    sheetScroll.style.setProperty("margin-left", "auto", "important");
    sheetScroll.style.setProperty("margin-right", "auto", "important");
    sheetScroll.style.setProperty("align-items", "center", "important");
  }
  ring.style.overflow = "hidden";
  ring.style.setProperty("width", "100%", "important");
  ring.style.setProperty("max-width", "100%", "important");
  ring.style.setProperty("margin-left", "auto", "important");
  ring.style.setProperty("margin-right", "auto", "important");
  ring.style.setProperty("left", "0", "important");
  ring.style.setProperty("right", "0", "important");
  ring.style.setProperty("transform", "none", "important");

  const highlight = root.querySelector(".auto-drum-ym__highlight");
  const yearScroll = root.querySelector('.auto-drum-split__col[data-half="year"] .auto-drum-split__scroll');
  const monthScroll = root.querySelector('.auto-drum-split__col[data-half="month"] .auto-drum-split__scroll');
  const chip = root.querySelector(".auto-drum-ym__chip");

  function itemHtml(row) {
    return `<div class="immo-drum-inline-item" data-value="${escapeHtml(row.value)}"><span class="immo-drum-inline-text">${escapeHtml(row.label)}</span></div>`;
  }

  yearScroll.innerHTML = ymOptionRows(yearWheel, yearEmpty).map(itemHtml).join("");
  monthScroll.innerHTML = ymOptionRows(monthWheel, monthEmpty).map(itemHtml).join("");

  function syncChip() {
    const label = chip.querySelector(".auto-drum-split__chip-label");
    const clear = chip.querySelector(".auto-drum-split__chip-clear");
    if (!pendingY) {
      label.textContent = yearEmpty;
      clear.hidden = true;
    } else {
      const mLabel = pendingM ? pad2(pendingM) || pendingM : "—";
      label.textContent = `${pendingY}. ${mLabel}`;
      clear.hidden = false;
    }
    clear.setAttribute("aria-hidden", clear.hidden ? "true" : "false");
  }

  function paintBoth() {
    cancelAnimationFrame(paintFrame);
    paintFrame = requestAnimationFrame(() => {
      paintSplitColSync(yearScroll, highlight);
      paintSplitColSync(monthScroll, highlight);
      pendingY = nearestPortalItem(yearScroll, highlight)?.dataset.value ?? "";
      pendingM = nearestPortalItem(monthScroll, highlight)?.dataset.value ?? "";
      if (activePortal?.kind === "ym-sheet") {
        activePortal.pendingY = pendingY;
        activePortal.pendingM = pendingM;
      }
      syncChip();
    });
  }

  function scrollHalfToValue(scrollEl, value) {
    const want = String(value ?? "");
    const items = [...scrollEl.querySelectorAll(".immo-drum-inline-item")];
    const start =
      items.find((el) => (el.dataset.value ?? "") === want) ||
      (want
        ? items.find((el) => Number(el.dataset.value) === Number(want.replace(/\D/g, "")))
        : null) ||
      scrollEl.querySelector('.immo-drum-inline-item[data-value=""]') ||
      scrollEl.querySelector(".immo-drum-inline-item");
    scrollToPortalItem(scrollEl, highlight, start);
  }

  function bindCol(scrollEl, half) {
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
      const snap = nearestPortalItem(scrollEl, highlight);
      if (snap) scrollToPortalItem(scrollEl, highlight, snap);
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
        event.preventDefault();
        event.stopPropagation();
        if (tapStart) {
          const dx = Math.abs(event.clientX - tapStart.x);
          const dy = Math.abs(event.clientY - tapStart.y);
          if (dx > 10 || dy > 10) return;
        }
        const value = item.dataset.value ?? "";
        if (half === "year") pendingY = value;
        if (half === "month") pendingM = value;
        if (activePortal?.kind === "ym-sheet") {
          activePortal.pendingY = pendingY;
          activePortal.pendingM = pendingM;
        }
        syncChip();
        scrollToPortalItem(scrollEl, highlight, item);
        requestAnimationFrame(() => paintBoth());
      });
    });
  }

  bindCol(yearScroll, "year");
  bindCol(monthScroll, "month");

  chip.addEventListener("click", (event) => {
    if (!event.target.closest(".auto-drum-split__chip-clear")) return;
    event.preventDefault();
    event.stopPropagation();
    pendingY = "";
    pendingM = "";
    scrollHalfToValue(yearScroll, "");
    scrollHalfToValue(monthScroll, "");
    paintBoth();
  });

  /* Kész + háttér: ment; X: eldob */
  root.querySelector(".auto-drum-portal__backdrop")?.addEventListener("click", () => closeAutoDrumSheet(true));
  closeBtn?.addEventListener("click", () => closeAutoDrumSheet(false));
  doneBtn?.addEventListener("click", () => closeAutoDrumSheet(true));

  mountSheetPortalChrome(root, { stage, wrap, trigger, ring });
  dual?.classList.add("has-drum-open");
  dual
    ?.querySelectorAll?.(".immo-dual-range__half, .immo-triple-date__half, .immo-schema-cell")
    ?.forEach?.((half) => half.classList.add("is-drum-active"));

  activePortal = {
    kind: "ym-sheet",
    root,
    wheel: yearWheel,
    yearWheel,
    monthWheel,
    yearScroll,
    monthScroll,
    scrollEl: yearScroll,
    ring: highlight,
    wrap,
    trigger,
    pendingY,
    pendingM,
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollHalfToValue(yearScroll, pendingY);
      scrollHalfToValue(monthScroll, pendingM);
      paintBoth();
    });
  });
}

/**
 * Gumi méret: műszaki érvényesség sheet chrome + 3 oszlop.
 * Fogad selecteket VAGY meglévő wheel elemeket.
 */
export function openTireTripleSheet(widthSrc, aspectSrc, rimSrc, trigger, { title = null } = {}) {
  if (!widthSrc || !aspectSrc || !rimSrc || !trigger) return;
  closeAutoDrumSheet(false);
  closeAllInlineDrums(false);

  const widthIsSelect = widthSrc instanceof HTMLSelectElement;
  const aspectIsSelect = aspectSrc instanceof HTMLSelectElement;
  const rimIsSelect = rimSrc instanceof HTMLSelectElement;

  function rowsFromSelect(select, emptyLabel) {
    const rows = [...(select?.options || [])].map((opt) => ({
      value: opt.value,
      label: (opt.textContent || "").trim() || opt.value || emptyLabel,
    }));
    const filled = rows.filter((r) => String(r.value ?? "") !== "");
    return [{ value: "", label: emptyLabel }, ...filled];
  }

  const dual = widthIsSelect
    ? widthSrc.closest(".ad-form-tire-split, .tire-block")
    : widthSrc.closest(".ad-form-split-ym, .ad-form-tire-split") ||
      aspectSrc.closest(".ad-form-split-ym, .ad-form-tire-split") ||
      rimSrc.closest(".ad-form-split-ym, .ad-form-tire-split");
  const wrap = widthIsSelect
    ? trigger.closest(".ad-form-tire-split") || dual
    : widthSrc.closest(".immo-wheel-wrap") ||
      aspectSrc.closest(".immo-wheel-wrap") ||
      rimSrc.closest(".immo-wheel-wrap");
  const sheetTitle =
    title ||
    dual?.querySelector(".immo-dual-range__title, .immo-label, .tire-block-label")?.textContent?.trim() ||
    trigger.getAttribute("aria-label") ||
    "Gumi méret";
  const widthEmpty = "—";
  const aspectEmpty = "—";
  const rimEmpty = "—";

  let pendingW = widthIsSelect
    ? String(widthSrc.value ?? "")
    : String(readWheel(widthSrc) ?? "");
  let pendingA = aspectIsSelect
    ? String(aspectSrc.value ?? "")
    : String(readWheel(aspectSrc) ?? "");
  let pendingR = rimIsSelect
    ? String(rimSrc.value ?? "")
    : String(readWheel(rimSrc) ?? "");

  const { root, stage, ring, sheetScroll, doneBtn, closeBtn } = createSheetPortalShell(sheetTitle);
  root.classList.add("auto-drum-portal--ym", "auto-drum-portal--tire");
  document.body.classList.add("auto-drum-sheet-open");

  ring.innerHTML = `
    <div class="auto-drum-ym__chips">
      <button type="button" class="auto-drum-split__chip auto-drum-ym__chip" aria-label="Gumi méret">
        <span class="auto-drum-split__chip-label"></span>
        <span class="auto-drum-split__chip-clear" hidden aria-hidden="true">×</span>
      </button>
    </div>
    <div class="auto-drum-ym__heads auto-drum-tire__heads" aria-hidden="true"><span>Szél.</span><span>Mag.</span><span>Átm.</span></div>
    <div class="auto-drum-ym__body">
      <div class="immo-drum-inline-highlight auto-drum-ym__highlight" aria-hidden="true"></div>
      <div class="auto-drum-ym__cols auto-drum-tire__cols">
        <div class="auto-drum-split__col" data-half="width">
          <div class="auto-drum-portal__scroll auto-drum-split__scroll immo-drum-inline-scroll" tabindex="-1"></div>
        </div>
        <div class="auto-drum-split__col" data-half="aspect">
          <div class="auto-drum-portal__scroll auto-drum-split__scroll immo-drum-inline-scroll" tabindex="-1"></div>
        </div>
        <div class="auto-drum-split__col" data-half="rim">
          <div class="auto-drum-portal__scroll auto-drum-split__scroll immo-drum-inline-scroll" tabindex="-1"></div>
        </div>
      </div>
    </div>`;

  if (sheetScroll) {
    sheetScroll.style.overflow = "hidden";
    sheetScroll.scrollTop = 0;
  }
  ring.style.overflow = "hidden";

  const highlight = root.querySelector(".auto-drum-ym__highlight");
  const widthScroll = root.querySelector('.auto-drum-split__col[data-half="width"] .auto-drum-split__scroll');
  const aspectScroll = root.querySelector('.auto-drum-split__col[data-half="aspect"] .auto-drum-split__scroll');
  const rimScroll = root.querySelector('.auto-drum-split__col[data-half="rim"] .auto-drum-split__scroll');
  const chip = root.querySelector(".auto-drum-ym__chip");

  function itemHtml(row) {
    return `<div class="immo-drum-inline-item" data-value="${escapeHtml(row.value)}"><span class="immo-drum-inline-text">${escapeHtml(row.label)}</span></div>`;
  }

  const widthRows = widthIsSelect
    ? rowsFromSelect(widthSrc, widthEmpty)
    : ymOptionRows(widthSrc, widthEmpty);
  const aspectRows = aspectIsSelect
    ? rowsFromSelect(aspectSrc, aspectEmpty)
    : ymOptionRows(aspectSrc, aspectEmpty);
  const rimRows = rimIsSelect ? rowsFromSelect(rimSrc, rimEmpty) : ymOptionRows(rimSrc, rimEmpty);

  widthScroll.innerHTML = widthRows.map(itemHtml).join("");
  aspectScroll.innerHTML = aspectRows.map(itemHtml).join("");
  rimScroll.innerHTML = rimRows.map(itemHtml).join("");

  function formatTireChip(w, a, r) {
    if (!w && !a && !r) return widthEmpty;
    return `${w || "—"} / ${a || "—"} R ${r || "—"}`;
  }

  function syncChip() {
    const label = chip.querySelector(".auto-drum-split__chip-label");
    const clear = chip.querySelector(".auto-drum-split__chip-clear");
    label.textContent = formatTireChip(pendingW, pendingA, pendingR);
    clear.hidden = !(pendingW || pendingA || pendingR);
    clear.setAttribute("aria-hidden", clear.hidden ? "true" : "false");
  }

  function paintAll() {
    cancelAnimationFrame(paintFrame);
    paintFrame = requestAnimationFrame(() => {
      paintSplitColSync(widthScroll, highlight);
      paintSplitColSync(aspectScroll, highlight);
      paintSplitColSync(rimScroll, highlight);
      pendingW = nearestPortalItem(widthScroll, highlight)?.dataset.value ?? "";
      pendingA = nearestPortalItem(aspectScroll, highlight)?.dataset.value ?? "";
      pendingR = nearestPortalItem(rimScroll, highlight)?.dataset.value ?? "";
      if (activePortal?.kind === "tire-sheet") {
        activePortal.pendingW = pendingW;
        activePortal.pendingA = pendingA;
        activePortal.pendingR = pendingR;
      }
      syncChip();
    });
  }

  function scrollHalfToValue(scrollEl, value) {
    const want = String(value ?? "");
    const items = [...scrollEl.querySelectorAll(".immo-drum-inline-item")];
    const start =
      items.find((el) => (el.dataset.value ?? "") === want) ||
      (want
        ? items.find((el) => Number(el.dataset.value) === Number(want.replace(/\D/g, "")))
        : null) ||
      scrollEl.querySelector('.immo-drum-inline-item[data-value=""]') ||
      scrollEl.querySelector(".immo-drum-inline-item");
    scrollToPortalItem(scrollEl, highlight, start);
  }

  function bindCol(scrollEl, half) {
    scrollEl.addEventListener("scroll", () => paintAll(), { passive: true });
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
      const snap = nearestPortalItem(scrollEl, highlight);
      if (snap) scrollToPortalItem(scrollEl, highlight, snap);
      paintAll();
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
        event.preventDefault();
        event.stopPropagation();
        if (tapStart) {
          const dx = Math.abs(event.clientX - tapStart.x);
          const dy = Math.abs(event.clientY - tapStart.y);
          if (dx > 10 || dy > 10) return;
        }
        const value = item.dataset.value ?? "";
        if (half === "width") pendingW = value;
        if (half === "aspect") pendingA = value;
        if (half === "rim") pendingR = value;
        if (activePortal?.kind === "tire-sheet") {
          activePortal.pendingW = pendingW;
          activePortal.pendingA = pendingA;
          activePortal.pendingR = pendingR;
        }
        syncChip();
        scrollToPortalItem(scrollEl, highlight, item);
        requestAnimationFrame(() => paintAll());
      });
    });
  }

  bindCol(widthScroll, "width");
  bindCol(aspectScroll, "aspect");
  bindCol(rimScroll, "rim");

  chip.addEventListener("click", (event) => {
    if (!event.target.closest(".auto-drum-split__chip-clear")) return;
    event.preventDefault();
    event.stopPropagation();
    pendingW = "";
    pendingA = "";
    pendingR = "";
    scrollHalfToValue(widthScroll, "");
    scrollHalfToValue(aspectScroll, "");
    scrollHalfToValue(rimScroll, "");
    paintAll();
  });

  root.querySelector(".auto-drum-portal__backdrop")?.addEventListener("click", () => closeAutoDrumSheet(true));
  closeBtn?.addEventListener("click", () => closeAutoDrumSheet(false));
  doneBtn?.addEventListener("click", () => closeAutoDrumSheet(true));

  mountSheetPortalChrome(root, { stage, wrap: wrap || trigger, trigger, ring });
  dual?.classList.add("has-drum-open");

  activePortal = {
    kind: "tire-sheet",
    root,
    wheel: widthIsSelect ? null : widthSrc,
    widthWheel: widthIsSelect ? null : widthSrc,
    aspectWheel: aspectIsSelect ? null : aspectSrc,
    rimWheel: rimIsSelect ? null : rimSrc,
    widthSelect: widthIsSelect ? widthSrc : null,
    aspectSelect: aspectIsSelect ? aspectSrc : null,
    rimSelect: rimIsSelect ? rimSrc : null,
    widthScroll,
    aspectScroll,
    rimScroll,
    scrollEl: widthScroll,
    ring: highlight,
    wrap: wrap || trigger,
    trigger,
    pendingW,
    pendingA,
    pendingR,
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollHalfToValue(widthScroll, pendingW);
      scrollHalfToValue(aspectScroll, pendingA);
      scrollHalfToValue(rimScroll, pendingR);
      paintAll();
    });
  });
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

  const { root, stage, ring, scrollEl, sheetScroll, backBtn, subEl, doneBtn, closeBtn, toolbarEl } =
    createSheetPortalShell("Gyártmány / Modell");
  root.classList.add("auto-drum-portal--bm");

  let view = "brands";
  let modelBrand = null;

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
  }

  function renderModels(brand) {
    view = "models";
    modelBrand = brand;
    ring.dataset.view = "models";
    subEl.hidden = false;
    subEl.textContent = brand;
    backBtn.hidden = false;
    syncToolbarChrome();
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
    });
    scrollEl.scrollTop = 0;
    paintSwitchList(scrollEl, modelWheel);
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
  ring?.addEventListener(
    "scroll",
    () => paintSwitchList(scrollEl, view === "models" ? modelWheel : brandWheel),
    { passive: true }
  );

  mountSheetPortalChrome(root, { stage, wrap, trigger, ring });
  activePortal = { root, wheel: brandWheel, scrollEl, ring, wrap, trigger, modelWheel };

  renderBrands();
}

function openMultiSwitchSheet(wheel, trigger, wrap, emptyLabel, opts) {
  const items = normalizeSheetItems(opts, emptyLabel);
  const selected = readWheelList(wheel);
  const title =
    wrap?.querySelector(".immo-label")?.textContent?.trim() ||
    wheel.getAttribute("aria-label") ||
    emptyLabel ||
    "Választás";
  const { root, stage, ring, scrollEl, sheetScroll, doneBtn, closeBtn } = createSheetPortalShell(title);

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
  closeBtn?.addEventListener("click", () => closeAutoDrumSheet(true));
  doneBtn?.addEventListener("click", () => closeAutoDrumSheet(true));
  const repaint = () => paintSwitchList(scrollEl, wheel);
  sheetScroll?.addEventListener("scroll", repaint, { passive: true });
  ring?.addEventListener("scroll", repaint, { passive: true });

  mountSheetPortalChrome(root, { stage, wrap, trigger, ring });
  activePortal = { root, wheel, scrollEl, ring, wrap, trigger };

  requestAnimationFrame(() => {
    if (selected.length) {
      const start = [...scrollEl.querySelectorAll(".immo-drum-inline-item")].find((el) =>
        selected.includes(el.dataset.value ?? "")
      );
      start?.scrollIntoView({ block: "nearest" });
    } else if (sheetScroll) sheetScroll.scrollTop = 0;
    paintSwitchList(scrollEl, wheel);
  });
}

/**
 * Önálló kapcsolós dobkerék (nincs immo-wheel) — pl. mobil kivitel picker.
 * getChildren(value) → almenü sorok; ha van, Vissza gombbal vissza.
 * singleSelect: csak 1 érték lehet bekapcsolva (hirdetésfeladás Alapadatok).
 */
export function openStandaloneSwitchSheet({
  trigger,
  emptyLabel = "Mindegy",
  items = [],
  initialSelected = [],
  onDone,
  getChildren = null,
  title = null,
  singleSelect = false,
} = {}) {
  if (!trigger) return;
  closeAutoDrumSheet(false);
  closeAllInlineDrums(false);

  const selected = new Set(
    singleSelect
      ? (() => {
          const first = (initialSelected || []).map(String).filter(Boolean)[0];
          return first ? [first] : [];
        })()
      : (initialSelected || []).map(String).filter(Boolean)
  );
  const sheetTitle =
    title ||
    trigger.getAttribute("aria-label") ||
    trigger.closest(".auto-desk-field, .ad-form-bm-field, .immo-schema-cell")?.querySelector("label, .immo-label, .auto-desk-label")?.textContent?.trim() ||
    emptyLabel ||
    "Választás";
  const { root, stage, ring, scrollEl, sheetScroll, backBtn, subEl, doneBtn, closeBtn, toolbarEl } =
    createSheetPortalShell(sheetTitle);
  const wrap = trigger.closest(".immo-wheel-wrap, .auto-desk-field, .auto-kivitel-field, .ad-form-bm-field") || trigger.parentElement;

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

  function syncToolbar() {
    const show = view === "kids";
    toolbarEl?.classList.toggle("is-visible", show);
    root.dataset.sheetView = view;
  }

  function paintStandalone() {
    cancelAnimationFrame(paintFrame);
    paintFrame = requestAnimationFrame(() => {
      scrollEl.querySelectorAll(".immo-drum-inline-item").forEach((item) => {
        const v = item.dataset.value ?? "";
        let isSel = false;
        if (v === "") isSel = selected.size === 0 && openMains.size === 0;
        else if (view === "main" && getChildren) isSel = openMains.has(v) || selected.has(v);
        else isSel = selected.has(v);
        item.style.opacity = "1";
        item.style.fontWeight = isSel ? "500" : "400";
        item.style.fontSize = "0.9375rem";
        item.style.color = "#1f2937";
        item.classList.toggle("is-selected", isSel);
        item.querySelector(".auto-drum-switch")?.setAttribute("aria-checked", isSel ? "true" : "false");
      });
    });
  }

  function selectOnly(value) {
    selected.clear();
    openMains.clear();
    if (value) selected.add(value);
  }

  function renderMain() {
    view = "main";
    parentValue = null;
    backBtn.hidden = true;
    subEl.hidden = true;
    syncToolbar();
    const seen = new Set();
    const uniqueItems = [];
    for (const row of items || []) {
      const value = String(row?.value ?? "");
      if (value !== "" && seen.has(value)) continue;
      if (value !== "") seen.add(value);
      uniqueItems.push(row);
    }
    const rows = [{ value: "", label: emptyLabel }, ...uniqueItems.filter((r) => String(r?.value ?? "") !== "")];
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
          if (singleSelect) {
            /* Más kategória gyerekeit töröljük; ebbe belépünk */
            const keep = new Set(kids.map((k) => String(k.value)));
            [...selected].forEach((v) => {
              if (!keep.has(v)) selected.delete(v);
            });
            openMains.clear();
            openMains.add(value);
            renderKids(value, kids);
            return;
          }
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
      if (singleSelect) {
        if (selected.has(value) && selected.size === 1) selectOnly("");
        else selectOnly(value);
        paintStandalone();
        return;
      }
      if (selected.has(value)) selected.delete(value);
      else selected.add(value);
      paintStandalone();
    });
    if (sheetScroll) sheetScroll.scrollTop = 0;
    if (ring) ring.scrollTop = 0;
    paintStandalone();
  }

  function renderKids(parent, kids) {
    view = "kids";
    parentValue = parent;
    backBtn.hidden = false;
    subEl.hidden = false;
    subEl.textContent = items.find((i) => i.value === parent)?.label || parent;
    syncToolbar();
    const rows = [{ value: "", label: emptyLabel }, ...kids];
    scrollEl.innerHTML = rows.map((row) => switchRowHtml(row)).join("");
    bindSwitchRowClicks(scrollEl, (item) => {
      const value = item.dataset.value ?? "";
      if (value === "") {
        if (singleSelect) {
          selected.clear();
          openMains.clear();
        } else {
          kids.forEach((k) => selected.delete(k.value));
        }
        paintStandalone();
        return;
      }
      if (singleSelect) {
        if (selected.has(value) && selected.size === 1) {
          selected.clear();
          openMains.clear();
        } else {
          selected.clear();
          selected.add(value);
          openMains.clear();
          openMains.add(parent);
        }
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
    if (sheetScroll) sheetScroll.scrollTop = 0;
    if (ring) ring.scrollTop = 0;
    paintStandalone();
  }

  function finish(commit) {
    if (commit && !singleSelect && typeof getChildren === "function") {
      for (const main of [...openMains]) {
        const kids = getChildren(main);
        if (!kids?.length) continue;
        if (!kids.some((k) => selected.has(String(k.value)))) {
          kids.forEach((k) => selected.add(String(k.value)));
        }
      }
    }
    wrap?.classList.remove("is-open", "has-drum-open");
    trigger.setAttribute("aria-expanded", "false");
    root.remove();
    activePortal = null;
    document.body.classList.remove("auto-drum-portal-open", "auto-drum-sheet-open");
    const restoreY = sheetScrollLockY || 0;
    unlockSheetPageAxes();
    if (commit && typeof onDone === "function") {
      const list = singleSelect
        ? (() => {
            const only = [...selected].filter(Boolean)[0];
            return only ? [only] : [];
          })()
        : [...selected];
      onDone(list, [...openMains]);
    }
    /* Kész után maradj ugyanott — ne ugorjon a lap tetejére. */
    const stick = () => {
      window.scrollTo(0, restoreY);
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
    };
    stick();
    requestAnimationFrame(() => {
      stick();
      unlockSheetPageAxes();
      stick();
    });
  }

  backBtn.addEventListener("click", (event) => {
    event.preventDefault();
    renderMain();
  });
  root.querySelector(".auto-drum-portal__backdrop")?.addEventListener("click", () => finish(true));
  closeBtn?.addEventListener("click", () => finish(true));
  doneBtn?.addEventListener("click", () => finish(true));
  sheetScroll?.addEventListener("scroll", () => paintStandalone(), { passive: true });
  ring?.addEventListener("scroll", () => paintStandalone(), { passive: true });

  mountSheetPortalChrome(root, { stage, wrap, trigger, ring });
  activePortal = { root, wheel: null, scrollEl, ring, wrap, trigger };
  renderMain();
}

const CATALOG_STATIC_BUST = "brandCatalog5";

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
    const res = await fetch(staticUrl, { cache: "force-cache" });
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
  return normalizeSheetItems([...wheel.querySelectorAll(".immo-wheel-opt")], emptyLabel).map((row) =>
    String(row.value ?? "") === "" ? { value: "", label: emptyLabel } : row
  );
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
    dual?.closest(".immo-dual-range-block")?.querySelector(":scope > .immo-dual-range__title")?.textContent?.trim() ||
    dual?.querySelector(".immo-dual-range__title")?.textContent?.trim() ||
    dual?.getAttribute("aria-label")?.replace(/\s*tartomány\s*$/i, "").trim() ||
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
  const chipMinEmpty =
    dual?.querySelector(".immo-dual-range__half--min .immo-wheel-trigger")?.dataset.emptyLabel ||
    (splitKind === "ym" ? "év" : "tól");
  const chipMaxEmpty =
    dual?.querySelector(".immo-dual-range__half--max .immo-wheel-trigger")?.dataset.emptyLabel ||
    (splitKind === "ym" ? "hó" : "ig");
  /* Kerék üres sora: ne „tól/ig” legyen a kiválasztott érték — mint a feladás sheet. */
  const wheelMinEmpty = splitKind === "ym" ? chipMinEmpty : "—";
  const wheelMaxEmpty = splitKind === "ym" ? chipMaxEmpty : "—";
  const minItems = wheelOptionRows(minWheel, wheelMinEmpty);
  const maxItems = wheelOptionRows(maxWheel, wheelMaxEmpty);
  let pendingMin = String(readWheel(minWheel) ?? "");
  let pendingMax = String(readWheel(maxWheel) ?? "");

  const headMin = splitKind === "ym" ? chipMinEmpty : "tól";
  const headMax = splitKind === "ym" ? chipMaxEmpty : "ig";
  /* Mindig feladás sheet chrome — ne a desk középre úszó fekete-Kész split portal. */
  const useSheet = true;
  let root;
  let stage;
  let ring;
  let minScroll;
  let maxScroll;
  let chipMin;
  let chipMax;
  let chipSummary = null;
  let doneBtn;
  let closeBtn;
  let sheetScroll = null;
  let ringEl = null;

  if (useSheet) {
    ({ root, stage, ring: ringEl, sheetScroll, doneBtn, closeBtn } = createSheetPortalShell(sheetTitle));
    root.classList.add("auto-drum-portal--ym", "auto-drum-portal--range-sheet");
    /* Feladás év|hó mintája: 1 chip + oszlopfejek + 2 dob */
    ringEl.innerHTML = `
        <div class="auto-drum-ym__chips">
          <button type="button" class="auto-drum-split__chip auto-drum-ym__chip auto-drum-range__chip" aria-label="${escapeHtml(sheetTitle)}">
            <span class="auto-drum-split__chip-label"></span>
            <span class="auto-drum-split__chip-clear" hidden aria-hidden="true">×</span>
          </button>
        </div>
        <div class="auto-drum-ym__heads" aria-hidden="true"><span>${escapeHtml(headMin)}</span><span>${escapeHtml(headMax)}</span></div>
        <div class="auto-drum-ym__body" style="width:100%;max-width:100%;box-sizing:border-box;">
          <div class="immo-drum-inline-highlight auto-drum-split__highlight auto-drum-ym__highlight" aria-hidden="true" style="left:0.4rem;right:0.4rem;width:auto;transform:translateY(-50%);"></div>
          <div class="auto-drum-ym__cols" style="width:100%;max-width:100%;">
            <div class="auto-drum-split__col" data-half="min">
              <div class="auto-drum-portal__scroll auto-drum-split__scroll immo-drum-inline-scroll" tabindex="-1"></div>
            </div>
            <div class="auto-drum-split__col" data-half="max">
              <div class="auto-drum-portal__scroll auto-drum-split__scroll immo-drum-inline-scroll" tabindex="-1"></div>
            </div>
          </div>
        </div>`;
    ring = root.querySelector(".auto-drum-split__highlight");
    minScroll = root.querySelector('.auto-drum-split__col[data-half="min"] .auto-drum-split__scroll');
    maxScroll = root.querySelector('.auto-drum-split__col[data-half="max"] .auto-drum-split__scroll');
    chipSummary = root.querySelector(".auto-drum-range__chip");
    chipMin = null;
    chipMax = null;
  } else {
    root = document.createElement("div");
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
          <button type="button" class="auto-drum-split__chip" data-half="min" aria-label="${escapeHtml(splitKind === "ym" ? chipMinEmpty : "Érték -tól")}">
            <span class="auto-drum-split__chip-label"></span>
            <span class="auto-drum-split__chip-clear" hidden aria-hidden="true">×</span>
          </button>
          <button type="button" class="auto-drum-split__chip" data-half="max" aria-label="${escapeHtml(splitKind === "ym" ? chipMaxEmpty : "Érték -ig")}">
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

    stage = root.querySelector(".auto-drum-portal__stage");
    ring = root.querySelector(".auto-drum-split__highlight");
    minScroll = root.querySelector('.auto-drum-split__col[data-half="min"] .auto-drum-split__scroll');
    maxScroll = root.querySelector('.auto-drum-split__col[data-half="max"] .auto-drum-split__scroll');
    chipMin = root.querySelector('.auto-drum-split__chip[data-half="min"]');
    chipMax = root.querySelector('.auto-drum-split__chip[data-half="max"]');
    doneBtn = root.querySelector(".auto-drum-portal__done");
  }

  function itemHtml(row) {
    return `<div class="immo-drum-inline-item" data-value="${escapeHtml(row.value)}"><span class="immo-drum-inline-text">${escapeHtml(row.label)}</span></div>`;
  }

  minScroll.innerHTML = minItems.map(itemHtml).join("");
  maxScroll.innerHTML = maxItems.map(itemHtml).join("");

  function syncChips() {
    const minLabel = labelForWheelValue(minWheel, pendingMin, chipMinEmpty);
    const maxLabel = labelForWheelValue(maxWheel, pendingMax, chipMaxEmpty);
    if (chipSummary) {
      const hasAny = pendingMin !== "" || pendingMax !== "";
      const summary =
        !hasAny
          ? "—"
          : `${pendingMin !== "" ? minLabel : chipMinEmpty} – ${pendingMax !== "" ? maxLabel : chipMaxEmpty}`;
      chipSummary.querySelector(".auto-drum-split__chip-label").textContent = summary;
      const clearSum = chipSummary.querySelector(".auto-drum-split__chip-clear");
      clearSum.hidden = !hasAny;
      clearSum.setAttribute("aria-hidden", hasAny ? "false" : "true");
      return;
    }
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

  if (chipSummary) {
    chipSummary.addEventListener("click", (event) => {
      if (!event.target.closest(".auto-drum-split__chip-clear")) return;
      event.preventDefault();
      event.stopPropagation();
      pendingMin = "";
      pendingMax = "";
      scrollHalfToValue(minScroll, "");
      scrollHalfToValue(maxScroll, "");
      paintBoth();
    });
  } else {
    chipMin.addEventListener("click", (event) => {
      if (event.target.closest(".auto-drum-split__chip-clear")) onChipClear("min", event);
    });
    chipMax.addEventListener("click", (event) => {
      if (event.target.closest(".auto-drum-split__chip-clear")) onChipClear("max", event);
    });
  }

  root.querySelector(".auto-drum-portal__backdrop")?.addEventListener("click", () => closeAutoDrumSheet(true));
  closeBtn?.addEventListener("click", () => closeAutoDrumSheet(false));
  doneBtn?.addEventListener("click", () => {
    readPendingFromScrolls();
    closeAutoDrumSheet(true);
  });

  if (useSheet) {
    if (sheetScroll) {
      sheetScroll.style.overflow = "hidden";
      sheetScroll.scrollTop = 0;
    }
    mountSheetPortalChrome(root, { stage, wrap, trigger, ring: ringEl, sheetScroll });
    dual?.classList.add("has-drum-open");
    dual?.querySelectorAll(".immo-dual-range__half").forEach((half) => half.classList.add("is-drum-active"));
  } else {
    document.body.appendChild(root);
    document.body.classList.add("auto-drum-portal-open");
    wrap?.classList.add("is-open", "has-drum-open");
    dual?.classList.add("has-drum-open");
    dual?.querySelectorAll(".immo-dual-range__half").forEach((half) => half.classList.add("is-drum-active"));
    trigger.setAttribute("aria-expanded", "true");
    positionPortal(stage, trigger);
  }

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
    if (!useSheet) {
      root
        .querySelector(".auto-drum-portal__ring--split")
        ?.style.setProperty("--immo-drum-ring-w", `${Math.min(360, Math.floor(window.innerWidth * 0.92))}px`);
    }
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

  if (
    multiple &&
    wheelKey === "kivitel" &&
    document.body?.getAttribute("data-site-page") === "teherauto"
  ) {
    const truckKat =
      document.body?.dataset?.truckKategoria ||
      document.querySelector("[data-truck-tab].is-active")?.getAttribute("data-truck-tab") ||
      new URLSearchParams(window.location.search).get("kategoria") ||
      "35-alatt";
    if (truckKat === "35-alatt" || truckKat === "35-ig") {
      openHierarchyCategorySheet(
        wheel,
        trigger,
        emptyLabel,
        TEHER_35_KIVITEL_CATEGORIES,
        flattenTeher35KivitelOptions
      );
      return;
    }
  }

  if (multiple) {
    const items = sheetItems ?? normalizeSheetItems(opts, emptyLabel);
    openMultiSwitchSheet(wheel, trigger, wrap, emptyLabel, items);
    return;
  }

  const sheetTitle =
    wrap?.closest(".immo-schema-cell, .immo-dual-range-block, .home-qs-field")?.querySelector(
      ":scope > .immo-label, :scope > .home-qs-label, :scope > .immo-dual-range__title"
    )?.textContent?.trim() ||
    wrap?.querySelector(".immo-label")?.textContent?.trim() ||
    wheel.getAttribute("aria-label") ||
    emptyLabel;
  const useSheet = isMobileDrumSheet();
  let root;
  let stage;
  let ring;
  let scrollEl;
  let outerRing;
  let doneBtn;
  let closeBtn;
  let sheetScroll = null;

  if (useSheet) {
    ({ root, stage, ring: outerRing, sheetScroll, doneBtn, closeBtn } = createSheetPortalShell(sheetTitle));
    root.classList.add("auto-drum-portal--single", "auto-drum-portal--single-sheet");
    root.style.setProperty("--auto-drum-single-h", "13.5rem");
    root.style.setProperty("--auto-drum-item-h", `${ITEM_H}px`);
    outerRing.innerHTML = `
        <div class="auto-drum-single__body" style="width:100%;max-width:100%;box-sizing:border-box;">
          <div class="immo-drum-inline-highlight auto-drum-single__highlight" aria-hidden="true" style="left:0.4rem;right:0.4rem;width:auto;transform:translateY(-50%);"></div>
          <div class="auto-drum-portal__scroll auto-drum-single__scroll immo-drum-inline-scroll" tabindex="-1"></div>
        </div>`;
    ring = root.querySelector(".auto-drum-single__highlight");
    scrollEl = root.querySelector(".auto-drum-single__scroll");
  } else {
    root = document.createElement("div");
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

    stage = root.querySelector(".auto-drum-portal__stage");
    ring = root.querySelector(".auto-drum-single__highlight");
    scrollEl = root.querySelector(".auto-drum-single__scroll");
    outerRing = root.querySelector(".auto-drum-portal__ring--single");
    doneBtn = root.querySelector(".auto-drum-portal__done");
  }

  scrollEl.innerHTML = opts
    .map((btn) => {
      const value = btn.dataset.value ?? "";
      const label = (btn.textContent || "").trim() || emptyLabel;
      return `<div class="immo-drum-inline-item" data-value="${escapeHtml(value)}"><span class="immo-drum-inline-text">${escapeHtml(label)}</span></div>`;
    })
    .join("");

  root.querySelector(".auto-drum-portal__backdrop")?.addEventListener("click", () => closeAutoDrumSheet(true));
  closeBtn?.addEventListener("click", () => closeAutoDrumSheet(false));
  doneBtn?.addEventListener("click", () => closeAutoDrumSheet(true));

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

  if (useSheet) {
    if (sheetScroll) {
      sheetScroll.style.overflow = "hidden";
      sheetScroll.scrollTop = 0;
    }
    mountSheetPortalChrome(root, { stage, wrap, trigger, ring: outerRing, sheetScroll });
  } else {
    document.body.appendChild(root);
    document.body.classList.add("auto-drum-portal-open");
    wrap?.classList.add("is-open", "has-drum-open");
    wrap?.closest(".immo-dual-range")?.classList.add("has-drum-open");
    (wrap?.closest(".immo-dual-range__half") || wrap?.closest(".immo-schema-cell"))?.classList.add("is-drum-active");
    trigger.setAttribute("aria-expanded", "true");
    positionPortal(stage, trigger);
  }

  activePortal = { kind: "single", root, wheel, scrollEl, ring, wrap, trigger };

  const start =
    [...scrollEl.querySelectorAll(".immo-drum-inline-item")].find((el) => (el.dataset.value ?? "") === current) ||
    scrollEl.querySelector(".immo-drum-inline-item");

  requestAnimationFrame(() => {
    if (!useSheet) {
      outerRing?.style.setProperty(
        "--immo-drum-ring-w",
        `${Math.min(320, Math.floor(window.innerWidth * 0.88))}px`
      );
    }
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
