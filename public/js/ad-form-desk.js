const DESK_MQ = "(min-width: 901px)";

const ACCORDIONS = [
  { id: "alap", step: 1, label: "Alap adatok" },
  { id: "muszaki", step: 2, label: "Műszaki adatok" },
  { id: "extrak", step: 3, label: "Extrák" },
  { id: "kepek", step: 4, label: "Képek", shell: false },
  { id: "hirdetes", step: 5, label: "Hirdetés" },
];

const PHOTO_STEP = 4;

function shellAccordions() {
  return ACCORDIONS.filter((item) => item.shell !== false);
}

function currentSubtype(form) {
  return String(
    form?.elements.namedItem("hirdetes_alkategoria")?.value ??
      form?.elements.namedItem("jarmu_kategoria")?.value ??
      ""
  )
    .trim()
    .toLowerCase();
}

function isSzemelyautoAdForm(form) {
  return currentSubtype(form) === "szemelyauto";
}

function isAdFormDesk(form) {
  return isSzemelyautoAdForm(form) && window.matchMedia(DESK_MQ).matches;
}

function filledControl(el) {
  if (!el) return false;
  if (el.type === "checkbox" || el.type === "radio") return el.checked;
  return String(el.value ?? "").trim() !== "";
}

function countFilled(root) {
  if (!root) return 0;
  const seen = new Set();
  let n = 0;
  root.querySelectorAll("select, input, textarea").forEach((el) => {
    if (el.closest("[hidden]")) return;
    if (el.type === "hidden") return;
    const key = el.id || el.name || "";
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    if (filledControl(el)) n += 1;
  });
  return n;
}

function updateAccordionSums(form) {
  for (const { id, step } of shellAccordions()) {
    const acc = form.querySelector(`[data-desk-acc="${id}"]`);
    const sum = acc?.querySelector("[data-desk-acc-sum]");
    const body = acc?.querySelector(".auto-desk-acc__body");
    if (!sum || !body) continue;
    const n = countFilled(body);
    sum.textContent = n > 0 ? `${n} kitöltve` : "";
  }
}

function openAccordion(form, id) {
  form.querySelectorAll("[data-desk-acc]").forEach((el) => {
    const on = Boolean(id) && el.getAttribute("data-desk-acc") === id;
    el.classList.toggle("is-open", on);
    const btn = el.querySelector("[data-desk-acc-toggle]");
    if (btn) btn.setAttribute("aria-expanded", on ? "true" : "false");
  });
}

function accordionForStep(step) {
  if (step === PHOTO_STEP) return "";
  return ACCORDIONS.find((item) => item.step === step && item.shell !== false)?.id ?? "alap";
}

function restackCanvasItems(form) {
  form.querySelectorAll(".ad-layout-canvas").forEach((canvas) => {
    const items = [...canvas.querySelectorAll(".ad-layout-item:not(.ad-layout-hidden)")];
    items.sort((a, b) => {
      const ra = Number(a.dataset.layoutRow) || 0;
      const rb = Number(b.dataset.layoutRow) || 0;
      if (ra !== rb) return ra - rb;
      const ca = Number(a.style.getPropertyValue("grid-column")?.match(/^(\d+)/)?.[1]) || 0;
      const cb = Number(b.style.getPropertyValue("grid-column")?.match(/^(\d+)/)?.[1]) || 0;
      return ca - cb;
    });
    for (const item of items) {
      canvas.appendChild(item);
      item.style.removeProperty("grid-column");
      item.style.removeProperty("grid-row");
    }
  });
}

function ensureDeskShell(form) {
  let shell = form.querySelector("#ad-form-desk-shell");
  if (shell) return shell;

  shell = document.createElement("div");
  shell.id = "ad-form-desk-shell";
  shell.className = "ad-form-desk-shell";
  shell.hidden = true;

  for (const { id, label } of shellAccordions()) {
    const acc = document.createElement("div");
    acc.className = "auto-desk-acc";
    acc.dataset.deskAcc = id;
    acc.innerHTML = `
      <button type="button" class="auto-desk-acc__head" data-desk-acc-toggle aria-expanded="false">
        <span>${label}</span>
        <span class="auto-desk-acc__sum" data-desk-acc-sum></span>
        <span class="auto-desk-acc__chev" aria-hidden="true">▼</span>
      </button>
      <div class="auto-desk-acc__body"></div>
    `;
    shell.appendChild(acc);
  }

  const footer = form.querySelector("#footer-actions");
  if (footer) form.insertBefore(shell, footer);
  else form.prepend(shell);
  return shell;
}

function mountDeskPanels(form) {
  const shell = ensureDeskShell(form);
  for (const { id, step } of shellAccordions()) {
    const body = shell.querySelector(`[data-desk-acc="${id}"] .auto-desk-acc__body`);
    const panel = form.querySelector(`.step-panel[data-step="${step}"]`);
    if (!body || !panel) continue;
    if (panel.parentElement !== body) body.appendChild(panel);
  }
}

function setDeskActive(on) {
  document.body.classList.toggle("ad-form-desk-active", on);
  document.body.classList.toggle("auto-desk-reszletes", on);
  document.getElementById("wizard-steps-bar")?.toggleAttribute("hidden", on);
}

function ensureDeskCenter(form) {
  let col = form.querySelector("#ad-desk-center-col");
  if (col) return col;
  col = document.createElement("div");
  col.id = "ad-desk-center-col";
  col.className = "ad-desk-center-col";
  const footer = form.querySelector("#footer-actions");
  form.insertBefore(col, footer);
  return col;
}

function ensureRightStack(form) {
  const col = ensureDeskCenter(form);
  let stack = col.querySelector("#ad-desk-right-stack");
  if (stack) return stack;

  const panel = document.querySelector(".site-center--automax .automax-panel");
  if (!panel) return null;

  stack = document.createElement("div");
  stack.id = "ad-desk-right-stack";
  stack.className = "ad-desk-right-stack";
  col.appendChild(stack);
  stack.appendChild(panel);
  return stack;
}

function ensurePhotoStage(form) {
  const col = ensureDeskCenter(form);
  let stage = col.querySelector("#ad-photo-desk-stage");
  if (stage) return stage;
  stage = document.createElement("div");
  stage.id = "ad-photo-desk-stage";
  stage.className = "ad-photo-desk-stage";
  col.insertBefore(stage, col.firstChild);
  return stage;
}

function teardownRightStack(form) {
  const center = document.querySelector(".site-center--automax");
  const col = form?.querySelector("#ad-desk-center-col");
  const stack = col?.querySelector("#ad-desk-right-stack");
  const panel = stack?.querySelector(".automax-panel");
  const photoPanel = form?.querySelector(`.step-panel[data-step="${PHOTO_STEP}"]`);
  const footer = form?.querySelector("#footer-actions");
  const shell = form?.querySelector("#ad-form-desk-shell");

  if (photoPanel && form && photoPanel.parentElement !== form) {
    form.insertBefore(photoPanel, footer || shell?.nextSibling || null);
  }

  if (panel && center) {
    const main = center.querySelector(".automax-main");
    if (main) main.insertAdjacentElement("afterend", panel);
    else center.appendChild(panel);
  }

  col?.remove();
  form?.classList.remove("ad-form-desk-layout");
}

function syncPhotoStage(form) {
  const panel = form.querySelector(`.step-panel[data-step="${PHOTO_STEP}"]`);
  if (!panel || !isAdFormDesk(form)) return;

  ensureRightStack(form);
  const stage = ensurePhotoStage(form);
  if (stage && panel.parentElement !== stage) stage.appendChild(panel);
}

function applyAdFormDesk({ openStep = null } = {}) {
  const form = document.getElementById("ad-form");
  if (!form || form.closest("#ad-wizard-shell")?.hidden) {
    setDeskActive(false);
    if (form) teardownRightStack(form);
    return;
  }

  const desk = isAdFormDesk(form);
  const shell = form.querySelector("#ad-form-desk-shell");
  setDeskActive(desk);

  if (!desk) {
    teardownRightStack(form);
    if (shell) {
      shell.hidden = true;
      const footer = form.querySelector("#footer-actions");
      for (const { step } of ACCORDIONS) {
        const panel = form.querySelector(`.step-panel[data-step="${step}"]`);
        if (!panel || !shell.contains(panel)) continue;
        form.insertBefore(panel, footer || shell);
      }
    }
    return;
  }

  form.classList.add("ad-form-desk-layout");
  form.querySelector('#ad-form-desk-shell [data-desk-acc="kepek"]')?.remove();
  const legacyStack = document.querySelector(".site-center--automax > #ad-desk-right-stack");
  if (legacyStack) {
    const legacyPanel = legacyStack.querySelector(".automax-panel");
    const main = document.querySelector(".site-center--automax .automax-main");
    if (legacyPanel && main) main.insertAdjacentElement("afterend", legacyPanel);
    legacyStack.remove();
  }
  ensureRightStack(form);
  mountDeskPanels(form);
  restackCanvasItems(form);
  if (shell) shell.hidden = false;

  const activeIndicator = document.querySelector("[data-step-indicator].active");
  const step = openStep ?? Number(activeIndicator?.dataset.stepIndicator) ?? 1;
  const accId = accordionForStep(step);
  if (accId) openAccordion(form, accId);
  syncPhotoStage(form);
  updateAccordionSums(form);
}

function bindDeskEvents() {
  const form = document.getElementById("ad-form");
  if (!form || form.dataset.adFormDeskBound === "1") return;
  form.dataset.adFormDeskBound = "1";

  form.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-desk-acc-toggle]");
    if (!toggle || !document.body.classList.contains("ad-form-desk-active")) return;
    const acc = toggle.closest("[data-desk-acc]");
    const id = acc?.getAttribute("data-desk-acc");
    if (!id) return;
    const open = acc.classList.contains("is-open");
    openAccordion(form, open ? "" : id);
  });

  form.addEventListener("input", () => {
    if (document.body.classList.contains("ad-form-desk-active")) updateAccordionSums(form);
  });
  form.addEventListener("change", () => {
    if (document.body.classList.contains("ad-form-desk-active")) updateAccordionSums(form);
  });

  window.addEventListener("ad-form-step", (event) => {
    const step = Number(event.detail?.step);
    if (!document.body.classList.contains("ad-form-desk-active") || !step) return;
    const accId = accordionForStep(step);
    if (accId) openAccordion(form, accId);
    syncPhotoStage(form);
    updateAccordionSums(form);
    if (step === PHOTO_STEP) {
      document.getElementById("ad-photo-desk-stage")?.scrollIntoView?.({ block: "start", behavior: "smooth" });
      return;
    }
    const acc = accId ? form.querySelector(`[data-desk-acc="${accId}"]`) : null;
    acc?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  });

  window.matchMedia(DESK_MQ).addEventListener("change", () => applyAdFormDesk());
}

bindDeskEvents();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => applyAdFormDesk());
} else {
  applyAdFormDesk();
}

window.addEventListener("ad-form-layout-refresh", () => {
  window.setTimeout(() => applyAdFormDesk(), 0);
  window.setTimeout(() => applyAdFormDesk(), 150);
});
window.addEventListener("ad-form-ready", () => applyAdFormDesk());

export { applyAdFormDesk, isAdFormDesk };
