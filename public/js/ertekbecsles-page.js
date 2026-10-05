import { createAdForm } from "./form-core.js?v=f5c3cfcf0f";
import { mountAdFormBmPickers } from "./ad-form-bm-pickers.js?v=d33b953bad";
import { initErtekbecsloPanel } from "./ertekbecslo-app.js?v=b586a4fc80";

const CATEGORY = {
  hirdetes_vertical: "auto",
  hirdetes_alkategoria: "szemelyauto",
  jarmu_kategoria: "szemelyauto",
};

function setCategory(form) {
  for (const [id, value] of Object.entries(CATEGORY)) {
    let el = form.querySelector(`#${id}`) || form.elements.namedItem(id);
    if (!el) {
      el = document.createElement("input");
      el.type = "hidden";
      el.id = id;
      el.name = id;
      form.prepend(el);
    }
    el.value = value;
  }
}

function hidePublishChrome(form) {
  form.querySelectorAll('.step-panel[data-step="4"], .step-panel[data-step="5"]').forEach((el) => {
    el.hidden = true;
    el.setAttribute("hidden", "");
  });
  form.querySelectorAll('[data-desk-acc="kepek"], [data-desk-acc="hirdetes"]').forEach((el) => {
    el.hidden = true;
    el.setAttribute("hidden", "");
  });
  form.querySelector("#footer-actions")?.setAttribute("hidden", "");
  form.querySelector("#success-panel")?.setAttribute("hidden", "");
  form.querySelectorAll(".ad-desk-guide-frame, #ad-desk-guide-frame").forEach((el) => el.remove());
}

function showValuationSteps(form) {
  form.querySelectorAll(".step-panel").forEach((panel) => {
    const step = Number(panel.dataset.step);
    if (step >= 1 && step <= 3) {
      panel.hidden = false;
      panel.removeAttribute("hidden");
      panel.classList.remove("hidden");
    }
  });
}

function placeResult(form) {
  const out = document.querySelector("[data-ertek-out]");
  const center = form.querySelector("#ad-desk-center-col") || document.getElementById("ad-desk-center-col");
  if (out && center && out.parentElement !== center) {
    center.prepend(out);
  }
}

async function loadPostingForm() {
  const dest = document.getElementById("ad-form");
  if (!dest) throw new Error("Értékbecslés űrlap hiányzik.");
  const res = await fetch("/hirdetesfeladas.html", { credentials: "same-origin", cache: "no-store" });
  if (!res.ok) throw new Error("A hirdetésfeladás űrlap nem tölthető.");
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const src = doc.querySelector("#ad-form");
  if (!src) throw new Error("A hirdetésfeladás űrlap üres.");
  src.querySelectorAll("script").forEach((el) => el.remove());
  src.setAttribute("data-ertek-form", "");
  src.classList.add("ertek-form");
  src.setAttribute("onsubmit", "return false");
  dest.replaceWith(src);
  const form = document.getElementById("ad-form");
  setCategory(form);
  return form;
}

const status = document.querySelector("[data-ertek-status]");

try {
  document.body.classList.add("ad-form-desk-active");
  const form = await loadPostingForm();
  createAdForm({
    mode: "wizard",
    storageKey: "ertekbecsles-draft",
    editing: true,
  });
  await import("./form-layout-apply.js?v=2acac89ddf");
  try {
    await mountAdFormBmPickers(form);
  } catch (pickerErr) {
    /* Egy választó hibája ne vigye el az egész értékbecslő űrlapot. */
    console.warn("Értékbecslés: választók mountolása", pickerErr);
  }
  window.dispatchEvent(new Event("ad-form-layout-refresh"));
  showValuationSteps(form);
  hidePublishChrome(form);
  placeResult(form);
  window.addEventListener("ad-form-ready", () => {
    showValuationSteps(form);
    hidePublishChrome(form);
    placeResult(form);
  });
  window.addEventListener("ad-form-layout-refresh", () => {
    hidePublishChrome(form);
    placeResult(form);
  });
  await initErtekbecsloPanel(document);
} catch (err) {
  if (status) {
    status.hidden = false;
    status.textContent = err?.message || "Menü nem elérhető.";
  }
}
