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

export function setWheelValue(wheel, value) {
  if (!wheel) return;
  const want = value == null ? "" : String(value);
  wheel.querySelectorAll(".immo-wheel-opt").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.value === want);
  });
  const active = wheel.querySelector(".immo-wheel-opt.is-active");
  active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  const name = wheel.getAttribute("data-wheel");
  const host = wheel.closest(".immo-wheel-wrap") || wheel.parentElement;
  const hidden =
    host?.querySelector(`input[type="hidden"][name="${name}"]`) ||
    host?.querySelector('input[type="hidden"]') ||
    (name ? document.getElementById(name) : null);
  if (hidden && hidden.type === "hidden") hidden.value = want;
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

export function wheelFieldHtml(name, label) {
  return `<div class="immo-wheel-wrap">
    <span class="immo-label">${escapeHtml(label)}</span>
    <div class="immo-wheel" data-wheel="${escapeAttr(name)}" role="listbox" aria-label="${escapeAttr(label)}"></div>
    <input type="hidden" id="${escapeAttr(name)}" name="${escapeAttr(name)}" value="" />
  </div>`;
}
