/** Közös kerék-picker — kereső + feladás. */

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

export function setWheelValue(wheel, value) {
  if (!wheel) return;
  const want = value == null ? "" : String(value);
  wheel.querySelectorAll(".immo-wheel-opt").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.value === want);
  });
  const active = wheel.querySelector(".immo-wheel-opt.is-active");
  if (wheel.dataset.menu !== "1") {
    active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  syncHidden(wheel, want);
  const wrap = wheel.closest(".immo-wheel-wrap");
  const trigger = wrap?.querySelector(".immo-wheel-trigger");
  if (trigger) {
    const label = active?.textContent?.trim() || trigger.dataset.emptyLabel || "Mindegy";
    trigger.textContent = label;
  }
}

export function readWheel(wheel) {
  const active = wheel?.querySelector(".immo-wheel-opt.is-active");
  if (active) return active.dataset.value ?? "";
  const name = wheel?.getAttribute("data-wheel");
  const host = wheel?.closest(".immo-wheel-wrap") || wheel?.parentElement;
  const hidden =
    host?.querySelector(`input[type="hidden"][name="${name}"]`) ||
    host?.querySelector('input[type="hidden"]') ||
    (name ? document.getElementById(name) : null);
  return hidden?.value ?? "";
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

/**
 * Ár-szerű menü: zárt gomb → kattintásra lenyílik → máshova kattintva becsukódik.
 * Egy kattintás = egy érték (min és max külön mező).
 */
export function initMenuWheel(wheel, { emptyLabel = "Mindegy" } = {}) {
  if (!wheel) return;
  const wrap = wheel.closest(".immo-wheel-wrap");
  if (!wrap) {
    initWheel(wheel);
    return;
  }

  wrap.classList.add("immo-wheel-wrap--menu");
  wheel.dataset.menu = "1";
  wheel.classList.add("immo-wheel--menu");
  wheel.setAttribute("hidden", "");

  let trigger = wrap.querySelector(".immo-wheel-trigger");
  if (!trigger) {
    trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "immo-wheel-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    const labelEl = wrap.querySelector(".immo-label");
    if (labelEl?.nextSibling) wrap.insertBefore(trigger, labelEl.nextSibling);
    else wrap.insertBefore(trigger, wheel);
  }
  trigger.dataset.emptyLabel = emptyLabel;

  function close() {
    wrap.classList.remove("is-open");
    wheel.setAttribute("hidden", "");
    trigger.setAttribute("aria-expanded", "false");
  }

  function open() {
    document.querySelectorAll(".immo-wheel-wrap--menu.is-open").forEach((other) => {
      if (other === wrap) return;
      other.classList.remove("is-open");
      const w = other.querySelector(".immo-wheel");
      const t = other.querySelector(".immo-wheel-trigger");
      w?.setAttribute("hidden", "");
      t?.setAttribute("aria-expanded", "false");
    });
    wrap.classList.add("is-open");
    wheel.removeAttribute("hidden");
    trigger.setAttribute("aria-expanded", "true");
  }

  if (trigger.dataset.bound !== "1") {
    trigger.dataset.bound = "1";
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (wrap.classList.contains("is-open")) close();
      else open();
    });
  }

  if (wheel.dataset.bound !== "1") {
    wheel.dataset.bound = "1";
    wheel.addEventListener("click", (event) => {
      const btn = event.target.closest(".immo-wheel-opt");
      if (!btn || !wheel.contains(btn)) return;
      event.preventDefault();
      event.stopPropagation();
      setWheelValue(wheel, btn.dataset.value ?? "");
      wheel.dispatchEvent(new CustomEvent("immo-wheel-change", { bubbles: true, detail: { value: btn.dataset.value ?? "" } }));
      close();
    });
  }

  if (!document.documentElement.dataset.immoMenuOutside) {
    document.documentElement.dataset.immoMenuOutside = "1";
    document.addEventListener("click", (event) => {
      document.querySelectorAll(".immo-wheel-wrap--menu.is-open").forEach((openWrap) => {
        if (openWrap.contains(event.target)) return;
        openWrap.classList.remove("is-open");
        openWrap.querySelector(".immo-wheel")?.setAttribute("hidden", "");
        openWrap.querySelector(".immo-wheel-trigger")?.setAttribute("aria-expanded", "false");
      });
    });
  }

  if (!wheel.querySelector(".immo-wheel-opt.is-active")) {
    const first = wheel.querySelector(".immo-wheel-opt");
    if (first) setWheelValue(wheel, first.dataset.value ?? "");
    else setWheelValue(wheel, "");
  } else {
    setWheelValue(wheel, readWheel(wheel));
  }
  close();
}

export function wheelFieldHtml(name, label) {
  return `<div class="immo-wheel-wrap">
    <span class="immo-label">${escapeHtml(label)}</span>
    <div class="immo-wheel" data-wheel="${escapeAttr(name)}" role="listbox" aria-label="${escapeAttr(label)}"></div>
    <input type="hidden" id="${escapeAttr(name)}" name="${escapeAttr(name)}" value="" />
  </div>`;
}
