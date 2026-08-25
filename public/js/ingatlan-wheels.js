/** Közös kerék / lenyíló menü — kereső + feladás. */

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

/** Oldal görgetés zárolása, amíg a kerek menü / dobkerék nyitva van. */
let pageScrollLocked = false;
let scrollLockY = 0;
let lastTouchY = 0;
let scrollBlockerEl = null;

function isScrollableWheel(el) {
  if (!el?.closest) return null;
  return (
    el.closest(".immo-drum-inline-scroll") ||
    el.closest(".immo-drum-wheel-ring")?.querySelector(".immo-drum-inline-scroll") ||
    el.closest(".immo-wheel--menu") ||
    null
  );
}

function isCylinderSurface(el) {
  if (!el?.closest) return false;
  return Boolean(el.closest("[data-cyl-viewport], .cyl-drum, .cyl-face"));
}

function onLockedTouchStart(event) {
  if (event.touches?.[0]) lastTouchY = event.touches[0].clientY;
  /* iOS néha elengedi a zárat — nyitott keréknél újra ráhúzzuk */
  if (
    document.querySelector(".immo-wheel-wrap--drum-inline.is-open") ||
    document.querySelector(".immo-wheel-wrap--menu.is-open") ||
    document.body.classList.contains("immo-menu-open") ||
    document.body.classList.contains("immo-cyl-scroll-lock")
  ) {
    assertScrollLockStyles();
  }
}

function onLockedTouchMove(event) {
  if (!pageScrollLocked) return;
  /* Henger: csak húzáskor tiltjuk — koppintás így megy iOS-en is. */
  if (isCylinderSurface(event.target)) {
    if (!document.body.hasAttribute("data-cyl-dragging")) return;
    event.preventDefault();
    return;
  }
  /* Mindig tiltjuk az oldalgörgetést; a kerék scrollTop-ját kézzel állítjuk. */
  event.preventDefault();
  const touch = event.touches?.[0];
  if (!touch) return;
  const y = touch.clientY;
  const dy = y - lastTouchY;
  lastTouchY = y;
  const scrollEl = isScrollableWheel(event.target);
  if (!scrollEl || !dy) return;
  /* Ujj lefelé → tartalom lefelé (természetes iOS picker) */
  scrollEl.scrollTop -= dy;
}

function onLockedWheel(event) {
  if (!pageScrollLocked) return;
  event.preventDefault();
  const scrollEl = isScrollableWheel(event.target);
  if (!scrollEl) return;
  scrollEl.scrollTop += event.deltaY;
}

function onLockedScroll() {
  if (!pageScrollLocked) return;
  if ((window.scrollY || 0) !== scrollLockY) {
    window.scrollTo(0, scrollLockY);
  }
}

function ensureScrollBlocker() {
  let el = scrollBlockerEl || document.querySelector(".immo-scroll-blocker");
  if (el) {
    scrollBlockerEl = el;
    return el;
  }
  el = document.createElement("div");
  el.className = "immo-scroll-blocker";
  el.setAttribute("aria-hidden", "true");
  el.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
  el.addEventListener("wheel", (event) => event.preventDefault(), { passive: false });
  document.body.appendChild(el);
  scrollBlockerEl = el;
  return el;
}

function assertScrollLockStyles() {
  const html = document.documentElement;
  const body = document.body;
  html.style.setProperty("overflow", "hidden", "important");
  html.style.setProperty("overflow-x", "hidden", "important");
  html.style.setProperty("overflow-y", "hidden", "important");
  html.style.setProperty("overscroll-behavior", "none", "important");
  html.style.setProperty("touch-action", "none", "important");
  body.style.setProperty("overflow", "hidden", "important");
  body.style.setProperty("overflow-x", "hidden", "important");
  body.style.setProperty("overflow-y", "hidden", "important");
  body.style.setProperty("overscroll-behavior", "none", "important");
  body.style.setProperty("touch-action", "none", "important");
  /* position:fixed iOS-en pár mp után elengedheti — csak overflow + scrollTo */
  body.style.setProperty("position", "relative", "important");
  body.style.removeProperty("top");
  body.style.removeProperty("left");
  body.style.removeProperty("right");
  body.style.removeProperty("width");
  ensureScrollBlocker().hidden = false;
  window.scrollTo(0, scrollLockY);
}

export function lockPageScroll() {
  if (!pageScrollLocked) {
    pageScrollLocked = true;
    scrollLockY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.classList.add("immo-scroll-locked");
    document.body.classList.add("immo-scroll-locked");
    document.addEventListener("touchstart", onLockedTouchStart, { passive: true, capture: true });
    document.addEventListener("touchmove", onLockedTouchMove, { passive: false, capture: true });
    document.addEventListener("wheel", onLockedWheel, { passive: false, capture: true });
    window.addEventListener("scroll", onLockedScroll, { passive: false });
  }
  assertScrollLockStyles();
}

export function unlockPageScroll(force = false) {
  if (!pageScrollLocked) return;
  if (
    !force &&
    (document.querySelector(".immo-wheel-wrap--drum-inline.is-open") ||
      document.querySelector(".immo-wheel-wrap--menu.is-open") ||
      document.body.classList.contains("immo-menu-open") ||
      document.body.classList.contains("immo-cyl-scroll-lock"))
  ) {
    return;
  }
  pageScrollLocked = false;
  document.documentElement.classList.remove("immo-scroll-locked");
  document.body.classList.remove("immo-scroll-locked");

  const html = document.documentElement;
  const body = document.body;
  for (const prop of ["overflow", "overflow-x", "overflow-y", "overscroll-behavior", "touch-action", "position"]) {
    html.style.removeProperty(prop);
    body.style.removeProperty(prop);
  }
  for (const prop of ["top", "left", "right", "width"]) {
    body.style.removeProperty(prop);
  }

  if (scrollBlockerEl) scrollBlockerEl.hidden = true;

  document.removeEventListener("touchstart", onLockedTouchStart, { capture: true });
  document.removeEventListener("touchmove", onLockedTouchMove, { capture: true });
  document.removeEventListener("wheel", onLockedWheel, { capture: true });
  window.removeEventListener("scroll", onLockedScroll);
  window.scrollTo(0, scrollLockY);
}

/** Többválasztós mezők (kereső). */
export const MULTI_WHEEL_KEYS = new Set([
  "ingatlan_lakas_tipus",
  "ingatlan_tipus_2",
  "allapot",
  "ingatlan_kora",
  "kilatas",
  "butorozott",
  "tajolas",
  "futes",
  "parkolas",
  "komfort",
  "tetoter",
  "furdo_wc",
  "koltozheto",
  "szobaszam",
]);

export function fillWheel(root, options, { emptyLabel = "Mindegy", includeEmpty = true } = {}) {
  if (!root) return;
  const list = includeEmpty ? [{ value: "", label: emptyLabel }, ...options.filter((o) => o.value !== "")] : options;
  root.innerHTML = list
    .map(
      (opt) =>
        `<button type="button" class="immo-wheel-opt" role="option" data-value="${escapeAttr(opt.value)}">${escapeHtml(
          opt.label
        )}</button>`
    )
    .join("");
}

function menuWrapFor(wheel) {
  return wheel?.closest?.(".immo-wheel-wrap") || wheel?._immoMenuHome?.parent || null;
}

function syncHidden(wheel, want) {
  const name = wheel.getAttribute("data-wheel");
  const host = menuWrapFor(wheel) || wheel.parentElement;
  const hidden =
    host?.querySelector(`input[type="hidden"][name="${name}"]`) ||
    host?.querySelector('input[type="hidden"]') ||
    (name ? document.getElementById(name) : null);
  if (hidden && hidden.type === "hidden") hidden.value = want;
}

function parseValues(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return value.map((v) => String(v)).filter((v) => v !== "");
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatPriceLabel(ft) {
  const n = Number(ft);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n >= 1_000_000_000 && n % 1_000_000_000 === 0) return `${n / 1_000_000_000} Mrd Ft`;
  if (n >= 1_000_000 && n % 1_000_000 === 0) return `${n / 1_000_000} M Ft`;
  return `${n.toLocaleString("hu-HU")} Ft`;
}

function formatAreaLabel(m2) {
  const n = Number(m2);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${n} m²`;
}

function parsePriceInput(raw) {
  const t = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/ft/g, "");
  if (!t) return "";
  const mrd = t.match(/^(\d+(?:[.,]\d+)?)\s*mrd$/);
  if (mrd) return String(Math.round(Number(mrd[1].replace(",", ".")) * 1_000_000_000));
  const mil = t.match(/^(\d+(?:[.,]\d+)?)\s*m$/);
  if (mil) return String(Math.round(Number(mil[1].replace(",", ".")) * 1_000_000));
  const digits = t.replace(/[^\d]/g, "");
  if (!digits) return "";
  return String(Number(digits));
}

function parseAreaInput(raw) {
  const t = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/m²/g, "")
    .replace(/m2/g, "");
  if (!t) return "";
  const n = Number(t.replace(",", ".").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.round(n));
}

function formatRoomLabel(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw === "6" || raw === "6+") return "6+";
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return raw;
  if (Number.isInteger(n)) return String(n);
  return String(n).replace(".", ",");
}

function parseRoomInput(raw) {
  const t = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s/g, "");
  if (!t) return "";
  if (t === "6+" || t === "6plus") return "6";
  const n = Number(t.replace(",", ".").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n >= 6) return "6";
  // 1, 1.5, 2, … fél szobák
  const rounded = Math.round(n * 2) / 2;
  return String(rounded);
}

function formatCustomLabel(value, kind) {
  if (kind === "area") return formatAreaLabel(value) || String(value ?? "");
  if (kind === "rooms") return formatRoomLabel(value) || String(value ?? "");
  return formatPriceLabel(value) || String(value ?? "");
}

function parseCustomInput(raw, kind) {
  if (kind === "area") return parseAreaInput(raw);
  if (kind === "rooms") return parseRoomInput(raw);
  return parsePriceInput(raw);
}

function updateTrigger(wheel) {
  const wrap = menuWrapFor(wheel);
  if (!wrap) return;
  const emptyLabel = wrap.querySelector(".immo-wheel-trigger")?.dataset.emptyLabel || "Mindegy";
  const multiple = wheel.dataset.multiple === "1";
  const custom = wheel.dataset.custom === "1";
  const customKind = wheel.dataset.customKind || "price";
  const values = parseValues(readWheel(wheel));
  const labels = values
    .map((v) => {
      const btn = [...wheel.querySelectorAll(".immo-wheel-opt")].find((b) => b.dataset.value === v);
      return btn?.textContent?.trim() || (custom ? formatCustomLabel(v, customKind) || v : v);
    })
    .filter(Boolean);

  const trigger = wrap.querySelector(".immo-wheel-trigger");
  const input = wrap.querySelector(".immo-wheel-custom");
  if (custom && input) {
    if (!values.length) {
      input.value = "";
      input.placeholder = emptyLabel;
      input.removeAttribute("title");
    } else if (multiple && values.length > 1) {
      input.value = `${values.length} kiválasztva`;
      input.title = labels.join(", ");
    } else {
      const btn = [...wheel.querySelectorAll(".immo-wheel-opt")].find((b) => b.dataset.value === values[0]);
      const shown = btn?.textContent?.trim() || formatCustomLabel(values[0], customKind) || values[0];
      input.value = shown;
      input.title = shown;
    }
    return;
  }
  if (!trigger) return;
  if (!labels.length) {
    trigger.textContent = emptyLabel;
    trigger.removeAttribute("title");
  } else if (multiple && values.length > 1) {
    trigger.textContent = `${values.length} kiválasztva`;
    trigger.title = labels.join(", ");
  } else {
    trigger.textContent = labels.join(", ");
    trigger.title = labels.join(", ");
  }
}

export function setWheelValue(wheel, value) {
  if (!wheel) return;
  const multiple = wheel.dataset.multiple === "1";
  let values = parseValues(value);
  if (!multiple) values = values.slice(0, 1);
  if (multiple && values.includes("")) values = [];

  wheel.querySelectorAll(".immo-wheel-opt").forEach((btn) => {
    const v = btn.dataset.value ?? "";
    const on = v === "" ? values.length === 0 : values.includes(v);
    btn.classList.toggle("is-active", on);
  });

  const stored = values.join(",");
  syncHidden(wheel, stored);
  if (wheel.dataset.menu !== "1") {
    wheel.querySelector(".immo-wheel-opt.is-active")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  updateTrigger(wheel);
}

export function readWheel(wheel) {
  if (!wheel) return "";
  if (wheel.dataset.multiple === "1") {
    const selected = [...wheel.querySelectorAll(".immo-wheel-opt.is-active")]
      .map((b) => b.dataset.value ?? "")
      .filter((v) => v !== "");
    if (selected.length) return selected.join(",");
  } else {
    const active = wheel.querySelector(".immo-wheel-opt.is-active");
    if (active && active.dataset.value !== "") return active.dataset.value ?? "";
    if (active && active.dataset.value === "") return "";
  }
  const name = wheel.getAttribute("data-wheel");
  const host = menuWrapFor(wheel) || wheel.parentElement;
  const hidden =
    host?.querySelector(`input[type="hidden"][name="${name}"]`) ||
    host?.querySelector('input[type="hidden"]') ||
    (name ? document.getElementById(name) : null);
  return hidden?.value ?? "";
}

export function readWheelList(wheel) {
  return parseValues(readWheel(wheel));
}

export function initWheel(wheel) {
  if (!wheel || wheel.dataset.bound === "1") return;
  wheel.dataset.bound = "1";
  wheel.addEventListener("click", (event) => {
    const btn = event.target.closest(".immo-wheel-opt");
    if (!btn || !wheel.contains(btn)) return;
    setWheelValue(wheel, btn.dataset.value ?? "");
    wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: btn.dataset.value ?? "" } }));
  });
  if (!wheel.querySelector(".immo-wheel-opt.is-active")) {
    const first = wheel.querySelector(".immo-wheel-opt");
    if (first) setWheelValue(wheel, first.dataset.value ?? "");
  }
}

function isMobileMenuViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 800px)").matches;
}

const PRICE_WHEEL_KEYS = new Set(["ar_tol", "ar_ig"]);
let menuMeasureEl;

/** Ár kerékmenü: szélesség = legszélesebb opció (nem teljes képernyő). */
export function syncCompactPriceMenuWidth(wheel, extraLabels = []) {
  if (!wheel || !PRICE_WHEEL_KEYS.has(wheel.getAttribute("data-wheel") || "")) return;
  wheel.classList.add("immo-wheel--menu-compact");

  const opt = wheel.querySelector(".immo-wheel-opt");
  const cs = opt ? getComputedStyle(opt) : null;
  if (!menuMeasureEl) {
    menuMeasureEl = document.createElement("span");
    menuMeasureEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(menuMeasureEl);
  }
  menuMeasureEl.style.cssText =
    "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;pointer-events:none;" +
    (cs
      ? `font:${cs.font};letter-spacing:${cs.letterSpacing};font-variant-numeric:${cs.fontVariantNumeric};`
      : "font-family:Inter,system-ui,sans-serif;font-size:1rem;");

  const texts = [
    ...extraLabels,
    ...[...wheel.querySelectorAll(".immo-wheel-opt")].map((b) => b.textContent?.trim() || ""),
  ].filter(Boolean);

  let max = 0;
  for (const text of texts) {
    menuMeasureEl.textContent = text;
    max = Math.max(max, menuMeasureEl.getBoundingClientRect().width);
  }
  const menuW = Math.ceil(max + 28);
  wheel.style.setProperty("--immo-wheel-menu-w", `${menuW}px`);
}

function parkWheelInWrap(wheel) {
  const home = wheel._immoMenuHome;
  if (!home?.parent?.isConnected) return;
  if (wheel.parentElement === home.parent) return;
  if (home.next && home.next.parentNode === home.parent) {
    home.parent.insertBefore(wheel, home.next);
  } else {
    home.parent.appendChild(wheel);
  }
}

function portalWheelToBody(wheel, wrap) {
  if (wheel.parentElement === document.body) return;
  wheel._immoMenuHome = { parent: wrap, next: wheel.nextSibling };
  document.body.appendChild(wheel);
}

function closeAllMenuWheels() {
  document.querySelectorAll(".immo-wheel-wrap--menu.is-open").forEach((openWrap) => {
    openWrap.classList.remove("is-open");
    openWrap.querySelector(".immo-wheel-trigger")?.setAttribute("aria-expanded", "false");
  });
  document.querySelectorAll(".immo-wheel.immo-wheel--menu").forEach((w) => {
    if (w.hasAttribute("hidden")) return;
    w.setAttribute("hidden", "");
    parkWheelInWrap(w);
  });
  hideMenuBackdrop();
}

function ensureMenuBackdrop() {
  let el = document.querySelector(".immo-menu-backdrop");
  if (el) return el;
  el = document.createElement("button");
  el.type = "button";
  el.className = "immo-menu-backdrop";
  el.setAttribute("aria-label", "Menü bezárása");
  el.hidden = true;
  el.addEventListener("click", () => closeAllMenuWheels());
  document.body.appendChild(el);
  return el;
}

function showMenuBackdrop() {
  if (!isMobileMenuViewport()) return;
  const el = ensureMenuBackdrop();
  el.hidden = false;
  document.body.classList.add("immo-menu-open");
  lockPageScroll();
}

function hideMenuBackdrop() {
  const el = document.querySelector(".immo-menu-backdrop");
  if (el) el.hidden = true;
  document.body.classList.remove("immo-menu-open");
  unlockPageScroll(true);
}

function ensureOutsideClose() {
  if (document.documentElement.dataset.immoMenuOutside) return;
  document.documentElement.dataset.immoMenuOutside = "1";
  document.addEventListener("click", (event) => {
    if (event.target.closest?.(".immo-menu-backdrop")) return;
    if (event.target.closest?.(".immo-wheel--menu")) return;
    if (event.target.closest?.(".immo-wheel-wrap--menu.is-open")) return;
    closeAllMenuWheels();
  });
}

/**
 * Lenyíló menü. multiple: több érték; customInput: kézi szám (Ár).
 */
export function initMenuWheel(wheel, { emptyLabel = "Mindegy", multiple = false, customInput = false, customKind = "price" } = {}) {
  if (!wheel) return;
  let wrap = wheel.closest(".immo-wheel-wrap");
  if (!wrap) {
    initWheel(wheel);
    return;
  }

  // Újratöltéskor ne halmozódjanak a listenerok.
  if (wheel.dataset.menuBound === "1") {
    const clone = wheel.cloneNode(true);
    wheel.replaceWith(clone);
    wheel = clone;
    wrap = wheel.closest(".immo-wheel-wrap");
  }
  wheel.dataset.menuBound = "1";

  wrap.classList.add("immo-wheel-wrap--menu");
  if (multiple) wrap.classList.add("immo-wheel-wrap--multi");
  else wrap.classList.remove("immo-wheel-wrap--multi");
  if (customInput) wrap.classList.add("immo-wheel-wrap--custom");
  else wrap.classList.remove("immo-wheel-wrap--custom");

  wheel.dataset.menu = "1";
  wheel.dataset.multiple = multiple ? "1" : "0";
  wheel.dataset.custom = customInput ? "1" : "0";
  wheel.dataset.customKind = customKind;
  wheel.classList.add("immo-wheel--menu");
  wheel.setAttribute("hidden", "");
  wheel.setAttribute("role", "listbox");
  if (multiple) wheel.setAttribute("aria-multiselectable", "true");
  else wheel.removeAttribute("aria-multiselectable");

  wrap.querySelector(".immo-wheel-trigger")?.remove();
  wrap.querySelector(".immo-wheel-custom")?.remove();

  let trigger;
  if (customInput) {
    trigger = document.createElement("input");
    trigger.type = "text";
    trigger.className = "immo-wheel-trigger immo-wheel-custom";
    trigger.placeholder = emptyLabel;
    trigger.inputMode = "numeric";
    trigger.autocomplete = "off";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
  } else {
    trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "immo-wheel-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
  }
  trigger.dataset.emptyLabel = emptyLabel;
  const labelEl = wrap.querySelector(".immo-label");
  if (labelEl?.nextSibling) wrap.insertBefore(trigger, labelEl.nextSibling);
  else wrap.insertBefore(trigger, wheel);

  function close() {
    wrap.classList.remove("is-open");
    wheel.setAttribute("hidden", "");
    trigger.setAttribute("aria-expanded", "false");
    parkWheelInWrap(wheel);
    if (!document.querySelector(".immo-wheel-wrap--menu.is-open")) hideMenuBackdrop();
  }

  function open() {
    document.querySelectorAll(".immo-wheel-wrap--menu.is-open").forEach((other) => {
      if (other === wrap) return;
      other.classList.remove("is-open");
      other.querySelector(".immo-wheel-trigger")?.setAttribute("aria-expanded", "false");
    });
    document.querySelectorAll(".immo-wheel.immo-wheel--menu").forEach((w) => {
      if (w === wheel) return;
      if (!w.hasAttribute("hidden")) {
        w.setAttribute("hidden", "");
        parkWheelInWrap(w);
      }
    });
    wrap.classList.add("is-open");
    wheel.removeAttribute("hidden");
    trigger.setAttribute("aria-expanded", "true");
    if (isMobileMenuViewport()) {
      if (PRICE_WHEEL_KEYS.has(wheel.getAttribute("data-wheel") || "")) {
        const emptyLabel = trigger.dataset.emptyLabel || "";
        syncCompactPriceMenuWidth(wheel, emptyLabel ? [emptyLabel] : []);
      }
      portalWheelToBody(wheel, wrap);
      showMenuBackdrop();
    } else {
      parkWheelInWrap(wheel);
      hideMenuBackdrop();
    }
  }

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    if (customInput) {
      open();
      return;
    }
    if (wrap.classList.contains("is-open")) close();
    else open();
  });

  if (customInput) {
    trigger.addEventListener("focus", () => {
      open();
      if (wheel.dataset.multiple === "1") {
        // Íráshoz ürítjük a összefoglalót; Enter hozzáad, Escape / üres blur visszaállít.
        trigger.dataset.wasSummary = trigger.value;
        trigger.value = "";
        trigger.placeholder = "Pl. 2,5 — Enter";
      }
    });
    const commitCustom = () => {
      const kind = wheel.dataset.customKind || "price";
      const multiple = wheel.dataset.multiple === "1";
      const typed = String(trigger.value ?? "").trim();
      // Többválasztásnál a „3 kiválasztva” / összefűzött címke ne írja felül a választást blur-kor.
      if (multiple && (/^\d+\s*kiválasztva$/i.test(typed) || typed.includes(","))) {
        close();
        updateTrigger(wheel);
        return;
      }
      if (multiple && !typed) {
        close();
        updateTrigger(wheel);
        return;
      }
      const parsed = parseCustomInput(trigger.value, kind);
      if (parsed === "" && !typed) {
        setWheelValue(wheel, "");
      } else if (parsed) {
        let opt = [...wheel.querySelectorAll(".immo-wheel-opt")].find((b) => b.dataset.value === parsed);
        if (!opt) {
          opt = document.createElement("button");
          opt.type = "button";
          opt.className = "immo-wheel-opt immo-wheel-opt--custom";
          opt.dataset.value = parsed;
          opt.textContent = formatCustomLabel(parsed, kind) || parsed;
          wheel.appendChild(opt);
        }
        if (multiple) {
          const cur = new Set(readWheelList(wheel));
          cur.add(parsed);
          setWheelValue(wheel, [...cur]);
        } else {
          setWheelValue(wheel, parsed);
        }
      }
      wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: readWheel(wheel) } }));
      close();
    };
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitCustom();
      }
      if (event.key === "Escape") close();
    });
    trigger.addEventListener("blur", () => {
      // Késleltetés: lista kattintás előbb fusson.
      setTimeout(() => {
        if (!wrap.contains(document.activeElement)) commitCustom();
      }, 150);
    });
  }

  wheel.addEventListener("click", (event) => {
    const btn = event.target.closest(".immo-wheel-opt");
    if (!btn || !wheel.contains(btn)) return;
    event.preventDefault();
    event.stopPropagation();
    const v = btn.dataset.value ?? "";
    if (multiple) {
      if (v === "") {
        setWheelValue(wheel, "");
      } else {
        const cur = new Set(readWheelList(wheel));
        if (cur.has(v)) cur.delete(v);
        else cur.add(v);
        setWheelValue(wheel, [...cur]);
      }
      wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: readWheel(wheel) } }));
      close();
      return;
    }
    setWheelValue(wheel, v);
    wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: v } }));
    close();
  });

  ensureOutsideClose();

  const prev = readWheel(wheel);
  if (prev) setWheelValue(wheel, prev);
  else setWheelValue(wheel, "");
  close();
}

export function wheelFieldHtml(name, label) {
  return `<div class="immo-wheel-wrap">
    <span class="immo-label">${escapeHtml(label)}</span>
    <div class="immo-wheel" data-wheel="${escapeAttr(name)}" role="listbox" aria-label="${escapeAttr(label)}"></div>
    <input type="hidden" id="${escapeAttr(name)}" name="${escapeAttr(name)}" value="" />
  </div>`;
}
