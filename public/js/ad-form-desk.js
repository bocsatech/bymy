import { initAdFormDeskGuide, refreshAdFormDeskGuide, showDeskGuideSlot } from "./ad-form-desk-guide.js?v=adDeskGuide4";

const DESK_MQ = "(min-width: 901px)";

const ACCORDIONS = [
  { id: "alap", step: 1, label: "Alap adatok" },
  { id: "muszaki", step: 2, label: "Műszaki adatok" },
  { id: "extrak", step: 3, label: "Extrák" },
  { id: "kepek", step: 4, label: "Képek", shell: false },
  { id: "hirdetes", step: 5, label: "Hirdetés" },
];

const PHOTO_STEP = 4;

const DESK_VEHICLE_SUBTYPES = new Set([
  "szemelyauto",
  "leasing",
  "berauto",
  "lakokocsi",
  "kisteher",
  "teherauto",
]);

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

function isDeskVehicleSubtype(subtype) {
  return DESK_VEHICLE_SUBTYPES.has(
    String(subtype ?? "")
      .trim()
      .toLowerCase()
  );
}

function isDeskVehicleAdForm(form) {
  return isDeskVehicleSubtype(currentSubtype(form));
}

function isAdFormDesk(form) {
  return isDeskVehicleAdForm(form);
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
  for (const { id } of shellAccordions()) {
    const acc = form.querySelector(`[data-desk-acc="${id}"]`);
    const sum = acc?.querySelector("[data-desk-acc-sum]");
    const body = acc?.querySelector(".auto-desk-acc__body");
    if (!sum || !body) continue;
    const n = countFilled(body);
    sum.textContent = n > 0 ? `${n} kitöltve` : "";
  }
  updateSubAccordionSums(form);
}

function updateSubAccordionSums(form) {
  form.querySelectorAll("[data-desk-sub-acc]").forEach((acc) => {
    const sum = acc.querySelector("[data-desk-sub-acc-sum]");
    const body = acc.querySelector(".auto-desk-acc__body");
    if (!sum || !body) return;
    const n = countFilled(body);
    sum.textContent = n > 0 ? `${n} kitöltve` : "";
  });
}

function createSubAccordion(id, label, contentEl) {
  const acc = document.createElement("div");
  acc.className = "auto-desk-acc auto-desk-acc--sub";
  acc.dataset.deskSubAcc = id;
  const n = countFilled(contentEl);
  acc.innerHTML = `
    <button type="button" class="auto-desk-acc__head" data-desk-sub-acc-toggle aria-expanded="false">
      <span>${label}</span>
      <span class="auto-desk-acc__sum" data-desk-sub-acc-sum>${n > 0 ? `${n} kitöltve` : ""}</span>
      <span class="auto-desk-acc__chev" aria-hidden="true">▼</span>
    </button>
    <div class="auto-desk-acc__body"></div>
  `;
  acc.querySelector(".auto-desk-acc__body").appendChild(contentEl);
  return acc;
}

function toggleSubAccordion(acc, open) {
  if (!acc) return;
  const on = open ?? !acc.classList.contains("is-open");
  acc.classList.toggle("is-open", on);
  const btn = acc.querySelector("[data-desk-sub-acc-toggle]");
  if (btn) btn.setAttribute("aria-expanded", on ? "true" : "false");
}

function mountExtrakSubAccordions(form) {
  if (!form || !isAdFormDesk(form)) return;

  const equipmentRoot = form.querySelector("#equipment-sections");
  if (equipmentRoot) {
    [...equipmentRoot.querySelectorAll(".equipment-block")].forEach((block, index) => {
      const label = block.querySelector("h3")?.textContent?.trim() || `Felszereltség ${index + 1}`;
      const grid = block.querySelector(".equipment-grid");
      if (!grid) return;
      const id = block.dataset.equipmentKey || `eq-${index}`;
      block.replaceWith(createSubAccordion(id, label, grid));
    });
  }

  const egyebCard = form.querySelector("#egyeb-info-sections")?.closest(".card");
  const egyebGrid = form.querySelector("#egyeb-info-sections");
  if (egyebCard && egyebGrid && !egyebCard.hidden && !egyebCard.querySelector("[data-desk-sub-acc]")) {
    const label = egyebCard.querySelector(".card-head")?.textContent?.trim() || "Egyéb információk";
    const acc = createSubAccordion("egyeb-info", label, egyebGrid);
    egyebCard.classList.add("card--desk-sub-acc");
    const cardBody = egyebCard.querySelector(".card-body");
    if (cardBody) {
      cardBody.innerHTML = "";
      cardBody.appendChild(acc);
    } else {
      egyebCard.innerHTML = "";
      egyebCard.appendChild(acc);
    }
    const head = egyebCard.querySelector(".card-head");
    if (head) head.remove();
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
  if (on) document.getElementById("wizard-steps-bar")?.setAttribute("hidden", "");
}

function ensureGuideFrame(col) {
  if (!col) return null;
  let guide = col.querySelector("#ad-desk-guide-frame");
  if (guide) return guide;

  guide = document.createElement("div");
  guide.id = "ad-desk-guide-frame";
  guide.className = "ad-desk-guide-frame";
  guide.innerHTML = `
    <div class="ad-desk-guide-frame__inner">
      <img class="ad-desk-guide-frame__img" data-desk-guide-img alt="" hidden decoding="async" />
      <div class="ad-desk-guide-frame__empty" data-desk-guide-empty>
        <span class="ad-desk-guide-frame__label" data-desk-guide-label>Alap adatok</span>
      </div>
    </div>
  `;
  const stage = col.querySelector("#ad-photo-desk-stage");
  col.insertBefore(guide, stage || col.firstChild);
  return guide;
}

function migrateLegacyDeskColumns(form) {
  const legacyCenter = form.querySelector("#ad-desk-center-col");
  const legacyStack = document.querySelector(".site-center--automax > #ad-desk-right-stack");

  // Régi középsó oszlop: csak bővítjük (útmutató keret), SOHA nem töröljük — benne lehet a képmező.
  if (legacyCenter) {
    ensureGuideFrame(legacyCenter);
    const panel = legacyCenter.querySelector(".automax-panel");
    if (panel) {
      const tipsCol = ensureTipsColumn(form);
      if (tipsCol && panel.parentElement !== tipsCol) tipsCol.appendChild(panel);
    }
  }

  if (legacyStack) {
    const panel = legacyStack.querySelector(".automax-panel");
    if (panel) {
      const tipsCol = ensureTipsColumn(form);
      if (tipsCol && panel.parentElement !== tipsCol) tipsCol.appendChild(panel);
    }
    legacyStack.remove();
  }
}

function removeLegacyKepekAccordion(form) {
  const kepekAcc = form.querySelector('#ad-form-desk-shell [data-desk-acc="kepek"]');
  if (!kepekAcc) return;
  const panel = kepekAcc.querySelector(`.step-panel[data-step="${PHOTO_STEP}"]`);
  if (panel) {
    const footer = form.querySelector("#footer-actions");
    form.insertBefore(panel, footer || null);
  }
  kepekAcc.remove();
}

function ensureTipsColumn(form) {
  let col = form.querySelector("#ad-desk-tips-col");
  if (col) return col;

  const panel = document.querySelector(".site-center--automax .automax-panel");
  if (!panel) return null;

  col = document.createElement("div");
  col.id = "ad-desk-tips-col";
  col.className = "ad-desk-tips-col";
  const footer = form.querySelector("#footer-actions");
  form.insertBefore(col, footer);
  col.appendChild(panel);
  return col;
}

function ensureCenterColumn(form) {
  let col = form.querySelector("#ad-desk-center-col");
  if (!col) {
    col = document.createElement("div");
    col.id = "ad-desk-center-col";
    col.className = "ad-desk-center-col";
    const footer = form.querySelector("#footer-actions");
    const tipsCol = form.querySelector("#ad-desk-tips-col");
    form.insertBefore(col, tipsCol || footer);
  }
  ensureGuideFrame(col);
  return col;
}

function syncPhotoGridInPanel(form) {
  const cardBody = form.querySelector(`.step-panel[data-step="${PHOTO_STEP}"] .card--photos .card-body`);
  const grid = form.querySelector("#photo-grid");
  const bar = form.querySelector("#photo-upload-bar");
  if (!cardBody || !grid || !bar) return;
  if (grid.parentElement !== cardBody) cardBody.appendChild(grid);
  if (bar.nextElementSibling !== grid) bar.insertAdjacentElement("afterend", grid);
  const legacyPreview = form.querySelector("#ad-desk-photo-preview");
  if (legacyPreview) legacyPreview.remove();
}

function ensurePhotoStage(form) {
  let stage = form.querySelector("#ad-photo-desk-stage");
  if (!stage) {
    stage = document.createElement("div");
    stage.id = "ad-photo-desk-stage";
    stage.className = "ad-photo-desk-stage";
  }
  const col = ensureCenterColumn(form);
  if (stage.parentElement !== col) col.appendChild(stage);
  syncPhotoGridInPanel(form);
  return stage;
}

function teardownDeskColumns(form) {
  const center = document.querySelector(".site-center--automax");
  const tipsCol = form?.querySelector("#ad-desk-tips-col");
  const panel = tipsCol?.querySelector(".automax-panel");
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

  form?.querySelector("#ad-desk-center-col")?.remove();
  tipsCol?.remove();
  form?.querySelector("#ad-photo-desk-stage")?.remove();
  form?.classList.remove("ad-form-desk-layout");
}

function syncLeirasInPhotoPanel(form) {
  const panel = form.querySelector(`.step-panel[data-step="${PHOTO_STEP}"]`);
  const leirasCard = form.querySelector(".card--leiras");
  const leirasWrap = form.querySelector(".field-stack--leiras");
  if (!panel || !leirasCard || !leirasWrap) return;
  if (leirasCard.parentElement !== panel) panel.appendChild(leirasCard);
  leirasCard.hidden = false;
  leirasCard.classList.remove("ad-immo-orphan", "ad-layout-hidden");
  leirasCard.style.removeProperty("display");
  leirasWrap.hidden = false;
  leirasWrap.classList.remove("ad-layout-hidden", "ad-immo-orphan", "ad-layout-item");
  leirasWrap.style.removeProperty("display");
}

function syncPhotoStage(form) {
  const panel = form.querySelector(`.step-panel[data-step="${PHOTO_STEP}"]`);
  if (!panel || !isAdFormDesk(form)) return;

  ensureTipsColumn(form);
  const stage = ensurePhotoStage(form);
  if (stage && panel.parentElement !== stage) stage.appendChild(panel);
  syncPhotoGridInPanel(form);
  syncLeirasInPhotoPanel(form);
  window.dispatchEvent(new Event("ad-form-photo-stage-sync"));
}

function clearAdFormEditBoot() {
  document.documentElement.classList.remove("ad-form-edit-boot");
  document.getElementById("ad-form-edit-boot-inline")?.remove();
}

function applyAdFormDesk({ openStep = null } = {}) {
  const form = document.getElementById("ad-form");
  if (!form || form.closest("#ad-wizard-shell")?.hidden) {
    setDeskActive(false);
    if (form) teardownDeskColumns(form);
    return;
  }

  const desk = isAdFormDesk(form);
  const shell = form.querySelector("#ad-form-desk-shell");
  setDeskActive(desk);

  if (!desk) {
    teardownDeskColumns(form);
    if (shell) {
      shell.hidden = true;
      const footer = form.querySelector("#footer-actions");
      for (const { step } of ACCORDIONS) {
        const panel = form.querySelector(`.step-panel[data-step="${step}"]`);
        if (!panel || !shell.contains(panel)) continue;
        form.insertBefore(panel, footer || shell);
      }
    }
    clearAdFormEditBoot();
    return;
  }

  bindDeskEvents();
  form.classList.add("ad-form-desk-layout");
  removeLegacyKepekAccordion(form);
  ensureTipsColumn(form);
  ensureCenterColumn(form);
  migrateLegacyDeskColumns(form);
  mountDeskPanels(form);
  restackCanvasItems(form);
  if (shell) shell.hidden = false;

  const preserved =
    form.querySelector("[data-desk-acc]:not(.auto-desk-acc--sub).is-open")?.getAttribute("data-desk-acc") || "";
  const accId = openStep != null ? accordionForStep(openStep) : preserved;
  openAccordion(form, accId || "");
  mountExtrakSubAccordions(form);
  syncPhotoStage(form);
  updateAccordionSums(form);
  refreshAdFormDeskGuide(form);
  initAdFormDeskGuide();
  clearAdFormEditBoot();
}

function bindDeskEvents() {
  const form = document.getElementById("ad-form");
  if (!form || form.dataset.adFormDeskBound === "1") return;
  form.dataset.adFormDeskBound = "1";

  form.addEventListener("click", (event) => {
    const subToggle = event.target.closest("[data-desk-sub-acc-toggle]");
    if (subToggle && document.body.classList.contains("ad-form-desk-active")) {
      event.preventDefault();
      event.stopPropagation();
      const subAcc = subToggle.closest("[data-desk-sub-acc]");
      toggleSubAccordion(subAcc);
      updateSubAccordionSums(form);
      return;
    }

    const toggle = event.target.closest("[data-desk-acc-toggle]");
    if (!toggle || !document.body.classList.contains("ad-form-desk-active")) return;
    event.preventDefault();
    const acc = toggle.closest("[data-desk-acc]");
    const id = acc?.getAttribute("data-desk-acc");
    if (!id) return;
    const open = acc.classList.contains("is-open");
    openAccordion(form, open ? "" : id);
    if (open) {
      refreshAdFormDeskGuide(form);
      return;
    }
    showDeskGuideSlot(id, { photoFocus: false });
    requestAnimationFrame(() => {
      acc.scrollIntoView({ block: "start", behavior: "smooth" });
    });
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
    if (event.detail?.openDeskAccordion === false) return;
    const accId = accordionForStep(step);
    if (accId) openAccordion(form, accId);
    syncPhotoStage(form);
    updateAccordionSums(form);
    refreshAdFormDeskGuide(form);
    if (step === PHOTO_STEP) {
      showDeskGuideSlot("kepek", { photoFocus: true });
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
  window.setTimeout(() => {
    const form = document.getElementById("ad-form");
    if (form && isAdFormDesk(form)) syncLeirasInPhotoPanel(form);
  }, 200);
});
window.addEventListener("ad-form-ready", () => applyAdFormDesk());
window.addEventListener("ad-form-equipment-rendered", () => {
  const form = document.getElementById("ad-form");
  if (form && isAdFormDesk(form)) {
    mountExtrakSubAccordions(form);
    updateSubAccordionSums(form);
  }
});

export {
  applyAdFormDesk,
  clearAdFormEditBoot,
  isAdFormDesk,
  isDeskVehicleAdForm,
  isDeskVehicleSubtype,
  isSzemelyautoAdForm,
};
