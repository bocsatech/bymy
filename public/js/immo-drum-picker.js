/**
 * iOS-szerű függőleges kerék (drum picker) — mobil web ármezőhöz.
 */

const DRUM_ITEM_H = 44;
const DRUM_PAD = DRUM_ITEM_H * 2;

let measureEl;
let activeSheet = null;

function isDrumViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 800px)").matches;
}

function measureTexts(texts, fontCss) {
  if (!measureEl) {
    measureEl = document.createElement("span");
    measureEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(measureEl);
  }
  measureEl.style.cssText =
    "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;pointer-events:none;" + fontCss;
  let max = 0;
  for (const t of texts) {
    measureEl.textContent = t;
    max = Math.max(max, measureEl.getBoundingClientRect().width);
  }
  return max;
}

function formatTriggerShort(label, value) {
  if (!value) return label;
  const t = String(label || "").trim();
  if (!t) return label;
  return t.replace(/\s*Ft\s*$/i, "").replace(/\s*M\s*Ft\s*$/i, " M").trim() || t;
}

function ensureSheet() {
  let sheet = document.querySelector(".immo-drum-sheet");
  if (sheet) return sheet;
  sheet = document.createElement("div");
  sheet.className = "immo-drum-sheet";
  sheet.hidden = true;
  sheet.innerHTML =
    '<button type="button" class="immo-drum-backdrop" aria-label="Bezárás"></button>' +
    '<div class="immo-drum-panel" role="dialog" aria-modal="true">' +
    '<div class="immo-drum-highlight" aria-hidden="true"></div>' +
    '<div class="immo-drum-scroll" tabindex="-1"></div>' +
    "</div>";
  document.body.appendChild(sheet);
  sheet.querySelector(".immo-drum-backdrop").addEventListener("click", () => closeDrumSheet(true));
  return sheet;
}

function closeDrumSheet(commit = true) {
  if (!activeSheet) return;
  const { sheet, scrollEl, onPick, trigger } = activeSheet;
  if (commit && scrollEl && onPick) {
    const item = nearestItem(scrollEl);
    onPick(item?.dataset.value ?? "");
  }
  sheet.hidden = true;
  document.body.classList.remove("immo-drum-open");
  trigger?.setAttribute("aria-expanded", "false");
  activeSheet = null;
}

function nearestItem(scrollEl) {
  const center = scrollEl.scrollTop + scrollEl.clientHeight / 2;
  let best = null;
  let bestDist = Infinity;
  scrollEl.querySelectorAll(".immo-drum-item").forEach((item) => {
    const mid = item.offsetTop + item.offsetHeight / 2;
    const dist = Math.abs(mid - center);
    if (dist < bestDist) {
      bestDist = dist;
      best = item;
    }
  });
  return best;
}

function paintDrum(scrollEl) {
  const center = scrollEl.scrollTop + scrollEl.clientHeight / 2;
  scrollEl.querySelectorAll(".immo-drum-item").forEach((item) => {
    const mid = item.offsetTop + item.offsetHeight / 2;
    const dist = Math.abs(mid - center);
    const t = Math.min(dist / (DRUM_ITEM_H * 2.2), 1);
    const opacity = 1 - t * 0.72;
    const scale = 1 - t * 0.14;
    item.style.opacity = String(Math.max(0.22, opacity));
    item.style.transform = `scale(${scale})`;
  });
}

function snapDrum(scrollEl) {
  const item = nearestItem(scrollEl);
  if (!item) return null;
  const target =
    item.offsetTop - (scrollEl.clientHeight - item.offsetHeight) / 2;
  scrollEl.scrollTo({ top: target, behavior: "smooth" });
  return item;
}

function openDrumSheet({ wheel, trigger, onPick }) {
  if (!isDrumViewport()) return false;
  const sheet = ensureSheet();
  const panel = sheet.querySelector(".immo-drum-panel");
  const scrollEl = sheet.querySelector(".immo-drum-scroll");
  const opts = [...wheel.querySelectorAll(".immo-wheel-opt")];

  scrollEl.innerHTML = opts
    .map((btn) => {
      const v = btn.dataset.value ?? "";
      const esc = v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      return `<button type="button" class="immo-drum-item" data-value="${esc}">${btn.textContent}</button>`;
    })
    .join("");

  const texts = opts.map((b) => b.textContent?.trim() || "");
  const drumW = Math.ceil(
    measureTexts(texts, "font:600 1.35rem/1 Inter,system-ui,sans-serif;font-variant-numeric:tabular-nums;") + 40
  );
  panel.style.setProperty("--immo-drum-w", `${drumW}px`);

  const hidden = wheel.closest(".immo-wheel-wrap")?.querySelector('input[type="hidden"]');
  const current = hidden?.value ?? "";
  let start = [...scrollEl.querySelectorAll(".immo-drum-item")].find((el) => el.dataset.value === current);
  if (!start) start = scrollEl.querySelector(".immo-drum-item");

  let scrollTimer = 0;

  const onScroll = () => {
    paintDrum(scrollEl);
    clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      snapDrum(scrollEl);
      paintDrum(scrollEl);
    }, 100);
  };

  scrollEl.onscroll = onScroll;
  scrollEl.onclick = (event) => {
    const item = event.target.closest(".immo-drum-item");
    if (!item) return;
    const target = item.offsetTop - (scrollEl.clientHeight - item.offsetHeight) / 2;
    scrollEl.scrollTo({ top: target, behavior: "smooth" });
    window.setTimeout(() => {
      onPick(item.dataset.value ?? "");
      closeDrumSheet(false);
    }, 200);
  };

  if (start) {
    scrollEl.scrollTop = start.offsetTop - (scrollEl.clientHeight - start.offsetHeight) / 2;
  }
  paintDrum(scrollEl);

  sheet.hidden = false;
  document.body.classList.add("immo-drum-open");
  trigger?.setAttribute("aria-expanded", "true");
  activeSheet = { sheet, scrollEl, onPick, trigger };

  return true;
}

/**
 * Ármező: mobil drum picker, asztali marad a lenyíló menü.
 */
export function initDrumWheel(wheel, { emptyLabel = "Mindegy", onChange } = {}) {
  if (!wheel) return;
  const wrap = wheel.closest(".immo-wheel-wrap");
  if (!wrap) return;

  if (wheel.dataset.drumBound === "1") {
    wrap.querySelector(".immo-wheel-trigger")?.remove();
  }
  wheel.dataset.drumBound = "1";
  wheel.dataset.menu = "1";
  wheel.classList.add("immo-wheel--drum-source");
  wheel.setAttribute("hidden", "");

  wrap.classList.add("immo-wheel-wrap--drum");
  wrap.querySelector(".immo-wheel-trigger")?.remove();

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "immo-wheel-trigger";
  trigger.dataset.emptyLabel = emptyLabel;
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const labelEl = wrap.querySelector(".immo-label");
  if (labelEl?.nextSibling) wrap.insertBefore(trigger, labelEl.nextSibling);
  else wrap.insertBefore(trigger, wheel);

  function syncTrigger(value) {
    const btn = [...wheel.querySelectorAll(".immo-wheel-opt")].find((b) => (b.dataset.value ?? "") === String(value ?? ""));
    if (!btn || !value) {
      trigger.textContent = emptyLabel;
      return;
    }
    trigger.textContent = formatTriggerShort(btn.textContent?.trim(), value);
  }

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!isDrumViewport()) return;
    const opened = openDrumSheet({
      wheel,
      trigger,
      onPick: (value) => {
        wheel.querySelectorAll(".immo-wheel-opt").forEach((btn) => {
          btn.classList.toggle("is-active", (btn.dataset.value ?? "") === value);
        });
        const hidden = wrap.querySelector('input[type="hidden"]');
        if (hidden) hidden.value = value;
        syncTrigger(value);
        onChange?.(value);
        wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value } }));
      },
    });
    if (!opened) return;
  });

  const hidden = wrap.querySelector('input[type="hidden"]');
  syncTrigger(hidden?.value ?? "");
}

export function syncDrumWheelDisplay(wheel) {
  if (!wheel || wheel.dataset.drumBound !== "1") return;
  const wrap = wheel.closest(".immo-wheel-wrap");
  const trigger = wrap?.querySelector(".immo-wheel-trigger");
  if (!trigger) return;
  const emptyLabel = trigger.dataset.emptyLabel || "Mindegy";
  const hidden = wrap.querySelector('input[type="hidden"]');
  const value = hidden?.value ?? "";
  wheel.querySelectorAll(".immo-wheel-opt").forEach((b) => {
    b.classList.toggle("is-active", (b.dataset.value ?? "") === value);
  });
  if (!value) {
    trigger.textContent = emptyLabel;
    return;
  }
  const btn = [...wheel.querySelectorAll(".immo-wheel-opt")].find((b) => (b.dataset.value ?? "") === value);
  trigger.textContent = btn ? formatTriggerShort(btn.textContent?.trim(), value) : value;
}

export { isDrumViewport, formatTriggerShort };
