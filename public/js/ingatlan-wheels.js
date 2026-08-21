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

function updateTrigger(wheel) {
  const wrap = wheel.closest(".immo-wheel-wrap");
  if (!wrap) return;
  const emptyLabel = wrap.querySelector(".immo-wheel-trigger")?.dataset.emptyLabel || "Mindegy";
  const multiple = wheel.dataset.multiple === "1";
  const custom = wheel.dataset.custom === "1";
  const values = parseValues(readWheel(wheel));
  const labels = values
    .map((v) => {
      const btn = [...wheel.querySelectorAll(".immo-wheel-opt")].find((b) => b.dataset.value === v);
      return btn?.textContent?.trim() || (custom ? formatPriceLabel(v) || v : v);
    })
    .filter(Boolean);

  const trigger = wrap.querySelector(".immo-wheel-trigger");
  const input = wrap.querySelector(".immo-wheel-custom");
  if (custom && input) {
    if (values.length === 1) {
      const btn = [...wheel.querySelectorAll(".immo-wheel-opt")].find((b) => b.dataset.value === values[0]);
      input.value = btn?.textContent?.trim() || formatPriceLabel(values[0]) || values[0];
    } else if (!values.length) {
      input.value = "";
      input.placeholder = emptyLabel;
    }
    return;
  }
  if (!trigger) return;
  if (!labels.length) trigger.textContent = emptyLabel;
  else if (multiple && labels.length > 2) trigger.textContent = `${labels.length} kiválasztva`;
  else trigger.textContent = labels.join(", ");
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

function ensureOutsideClose() {
  if (document.documentElement.dataset.immoMenuOutside) return;
  document.documentElement.dataset.immoMenuOutside = "1";
  document.addEventListener("click", (event) => {
    document.querySelectorAll(".immo-wheel-wrap--menu.is-open").forEach((openWrap) => {
      if (openWrap.contains(event.target)) return;
      openWrap.classList.remove("is-open");
      openWrap.querySelector(".immo-wheel")?.setAttribute("hidden", "");
      openWrap.querySelector(".immo-wheel-trigger")?.setAttribute("aria-expanded", "false");
      openWrap.querySelector(".immo-wheel-custom")?.setAttribute("aria-expanded", "false");
    });
  });
}

/**
 * Lenyíló menü. multiple: több érték; customInput: kézi szám (Ár).
 */
export function initMenuWheel(wheel, { emptyLabel = "Mindegy", multiple = false, customInput = false } = {}) {
  if (!wheel) return;
  const wrap = wheel.closest(".immo-wheel-wrap");
  if (!wrap) {
    initWheel(wheel);
    return;
  }

  // Újratöltéskor (pl. rövid bérlés) engedjük újra kötni a listát.
  wheel.dataset.bound = "";
  wrap.classList.add("immo-wheel-wrap--menu");
  if (multiple) wrap.classList.add("immo-wheel-wrap--multi");
  else wrap.classList.remove("immo-wheel-wrap--multi");
  if (customInput) wrap.classList.add("immo-wheel-wrap--custom");
  else wrap.classList.remove("immo-wheel-wrap--custom");

  wheel.dataset.menu = "1";
  wheel.dataset.multiple = multiple ? "1" : "0";
  wheel.dataset.custom = customInput ? "1" : "0";
  wheel.classList.add("immo-wheel--menu");
  wheel.setAttribute("hidden", "");
  wheel.setAttribute("role", multiple ? "listbox" : "listbox");
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
    trigger.addEventListener("focus", () => open());
    const commitCustom = () => {
      const parsed = parsePriceInput(trigger.value);
      if (parsed === "" && !String(trigger.value ?? "").trim()) {
        setWheelValue(wheel, "");
      } else if (parsed) {
        // Ha nincs listában, létrehozunk ideiglenes aktív jelölést a hiddenben.
        let opt = [...wheel.querySelectorAll(".immo-wheel-opt")].find((b) => b.dataset.value === parsed);
        if (!opt) {
          opt = document.createElement("button");
          opt.type = "button";
          opt.className = "immo-wheel-opt immo-wheel-opt--custom";
          opt.dataset.value = parsed;
          opt.textContent = formatPriceLabel(parsed) || parsed;
          wheel.appendChild(opt);
        }
        setWheelValue(wheel, parsed);
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
