const GUIDE_SLOT_BY_STEP = {
  1: "alap",
  2: "muszaki",
  3: "extrak",
  4: "kepek",
  5: "hirdetes",
};

const SLOT_LABELS = {
  alap: "Alap adatok",
  muszaki: "Műszaki adatok",
  extrak: "Extrák",
  hirdetes: "Hirdetés",
  kepek: "Képek",
};

let guideData = { slots: {} };
let activeSlot = "alap";
let loadPromise = null;
let bound = false;
let photoSectionActive = false;

function activeGuideSlot(form) {
  if (photoSectionActive) return "kepek";
  const step = Number(document.querySelector("[data-step-indicator].active")?.dataset.stepIndicator) || 1;
  if (step === 4) return "kepek";
  const open = form?.querySelector("[data-desk-acc].is-open");
  if (open) {
    const id = open.getAttribute("data-desk-acc");
    if (id && SLOT_LABELS[id]) return id;
  }
  return GUIDE_SLOT_BY_STEP[step] || "alap";
}

export function showDeskGuideSlot(slotId, { photoFocus = false } = {}) {
  if (photoFocus) photoSectionActive = slotId === "kepek";
  else if (slotId !== "kepek") photoSectionActive = false;
  paintGuideFrame(slotId);
}

function paintGuideFrame(slotId) {
  const frame = document.getElementById("ad-desk-guide-frame");
  if (!frame) return;
  activeSlot = slotId;
  const slot = guideData.slots?.[slotId] || {};
  const url = String(slot.url || "").trim();
  const alt = String(slot.alt || SLOT_LABELS[slotId] || "Útmutató").trim();
  const img = frame.querySelector("[data-desk-guide-img]");
  const empty = frame.querySelector("[data-desk-guide-empty]");
  const label = frame.querySelector("[data-desk-guide-label]");
  frame.dataset.deskGuideSlot = slotId;
  if (label) label.textContent = SLOT_LABELS[slotId] || slotId;
  if (url && img) {
    const onReady = () => {
      if (frame.dataset.deskGuideSlot !== slotId) return;
      frame.classList.add("has-image");
    };
    img.onload = onReady;
    img.onerror = () => {
      if (frame.dataset.deskGuideSlot !== slotId) return;
      frame.classList.remove("has-image");
    };
    img.src = url;
    img.alt = alt;
    img.hidden = false;
    empty?.setAttribute("hidden", "");
    if (img.complete && img.naturalWidth > 0) onReady();
  } else {
    if (img) {
      img.onload = null;
      img.onerror = null;
    }
    if (img) {
      img.removeAttribute("src");
      img.alt = "";
      img.hidden = true;
    }
    empty?.removeAttribute("hidden");
    frame.classList.remove("has-image");
  }
}

export function refreshAdFormDeskGuide(form = document.getElementById("ad-form")) {
  if (!document.body.classList.contains("ad-form-desk-active")) return;
  paintGuideFrame(activeGuideSlot(form));
}

async function loadGuideData() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const res = await fetch("/api/ad-form-desk-guide", { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.error) throw new Error(String(data.error));
    guideData = data;
    return data;
  })().catch(() => {
    guideData = { slots: {} };
    return guideData;
  }).finally(() => {
    loadPromise = null;
  });
  return loadPromise;
}

export async function initAdFormDeskGuide() {
  const form = document.getElementById("ad-form");
  if (!form || !document.getElementById("ad-desk-guide-frame")) return;

  await loadGuideData();
  refreshAdFormDeskGuide(form);

  if (bound) return;
  bound = true;

  form.addEventListener("click", (event) => {
    if (!document.body.classList.contains("ad-form-desk-active")) return;
    if (event.target.closest("#ad-photo-desk-stage, #photo-grid, #upload-zone, .card--photos")) {
      showDeskGuideSlot("kepek", { photoFocus: true });
      return;
    }
    const toggle = event.target.closest("[data-desk-acc-toggle]");
    if (!toggle) return;
    photoSectionActive = false;
    window.setTimeout(() => refreshAdFormDeskGuide(form), 0);
  });

  form.addEventListener(
    "focusin",
    (event) => {
      if (!document.body.classList.contains("ad-form-desk-active")) return;
      if (!event.target.closest("#ad-photo-desk-stage, #photo-grid, #upload-zone, .card--photos")) return;
      showDeskGuideSlot("kepek", { photoFocus: true });
    },
    true
  );

  window.addEventListener("ad-form-step", (event) => {
    const step = Number(event.detail?.step);
    photoSectionActive = step === 4;
    window.setTimeout(() => refreshAdFormDeskGuide(document.getElementById("ad-form")), 0);
  });

  window.addEventListener("ad-form-layout-refresh", () => {
    window.setTimeout(() => refreshAdFormDeskGuide(document.getElementById("ad-form")), 160);
  });
}
