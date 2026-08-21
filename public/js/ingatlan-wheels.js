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

/** Többválasztós mezők (kereső). */
export const MULTI_WHEEL_KEYS = new Set([
  "ingatlan_lakas_tipus",
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

function syncHidden(wheel, want) {
  const name = wheel.getAttribute("data-wheel");
  const host = wheel.closest(".immo-wheel-wrap") || wheel.parentElement;
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
  const wrap = wheel.closest(".immo-wheel-wrap");
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
  const host = wheel.closest(".immo-wheel-wrap") || wheel.parentElement;
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
  return typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches;
}

function ensureMenuBackdrop() {
  let el = document.querySelector(".immo-menu-backdrop");
  if (el) return el;
  el = document.createElement("button");
  el.type = "button";
  el.className = "immo-menu-backdrop";
  el.setAttribute("aria-label", "Menü bezárása");
  el.hidden = true;
  el.addEventListener("click", () => {
    document.querySelectorAll(".immo-wheel-wrap--menu.is-open").forEach((openWrap) => {
      openWrap.classList.remove("is-open");
      openWrap.querySelector(".immo-wheel")?.setAttribute("hidden", "");
      openWrap.querySelector(".immo-wheel-trigger")?.setAttribute("aria-expanded", "false");
    });
    hideMenuBackdrop();
  });
  document.body.appendChild(el);
  return el;
}

function showMenuBackdrop() {
  if (!isMobileMenuViewport()) return;
  const el = ensureMenuBackdrop();
  el.hidden = false;
  document.body.classList.add("immo-menu-open");
}

function hideMenuBackdrop() {
  const el = document.querySelector(".immo-menu-backdrop");
  if (el) el.hidden = true;
  document.body.classList.remove("immo-menu-open");
}

function ensureOutsideClose() {
  if (document.documentElement.dataset.immoMenuOutside) return;
  document.documentElement.dataset.immoMenuOutside = "1";
  document.addEventListener("click", (event) => {
    if (event.target.closest?.(".immo-menu-backdrop")) return;
    document.querySelectorAll(".immo-wheel-wrap--menu.is-open").forEach((openWrap) => {
      if (openWrap.contains(event.target)) return;
      openWrap.classList.remove("is-open");
      openWrap.querySelector(".immo-wheel")?.setAttribute("hidden", "");
      openWrap.querySelector(".immo-wheel-trigger")?.setAttribute("aria-expanded", "false");
    });
    if (!document.querySelector(".immo-wheel-wrap--menu.is-open")) hideMenuBackdrop();
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
    if (!document.querySelector(".immo-wheel-wrap--menu.is-open")) hideMenuBackdrop();
  }

  function open() {
    document.querySelectorAll(".immo-wheel-wrap--menu.is-open").forEach((other) => {
      if (other === wrap) return;
      other.classList.remove("is-open");
      other.querySelector(".immo-wheel")?.setAttribute("hidden", "");
      other.querySelector(".immo-wheel-trigger")?.setAttribute("aria-expanded", "false");
    });
    wrap.classList.add("is-open");
    wheel.removeAttribute("hidden");
    trigger.setAttribute("aria-expanded", "true");
    showMenuBackdrop();
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
      // Többválasztásnál nyitva marad.
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
