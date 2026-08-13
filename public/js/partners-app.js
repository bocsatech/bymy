import {
  deletePartner,
  fetchPartnerRecommendations,
  loadSavedPostalCode,
} from "./partners-client.js";
import { PARTNER_CATEGORIES } from "./partner-categories-data.js";

const statsEl = document.getElementById("partners-stats");
const listEl = document.getElementById("partners-list");
const form = document.getElementById("partner-form");
const formTitle = document.getElementById("partner-form-title");
const resetBtn = document.getElementById("partner-form-reset");
const importArea = document.getElementById("partner-import-json");
const importBtn = document.getElementById("partner-import-btn");
const importStatus = document.getElementById("partner-import-status");
const previewInput = document.getElementById("partner-preview-postal");
const previewBtn = document.getElementById("partner-preview-btn");
const previewOut = document.getElementById("partner-preview-out");

let partners = [];
let editingId = null;

async function parseJson(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "API hiba");
  return data;
}

async function loadPartners() {
  const response = await fetch("/api/partners");
  const data = await parseJson(response);
  partners = data.partners ?? [];
  renderList();
  renderStats();
}

async function renderStats() {
  const response = await fetch("/api/partners/stats");
  const stats = await parseJson(response);
  if (statsEl) {
    statsEl.textContent = `${stats.total} partner · ${stats.activePaid} fizetős aktív · ${stats.postalCodes} irányítószám`;
  }
}

function renderList() {
  if (!listEl) return;
  listEl.innerHTML = "";
  if (!partners.length) {
    listEl.innerHTML = `<p class="partners-empty">Még nincs partner. Add hozzá az űrlapon vagy importálj JSON-t.</p>`;
    return;
  }

  for (const partner of partners) {
    const row = document.createElement("article");
    row.className = "partners-row";
    const services = (partner.services ?? [])
      .map((id) => PARTNER_CATEGORIES.find((c) => c.id === id)?.label ?? id)
      .join(", ");
    row.innerHTML = `
      <div class="partners-row-main">
        <h3 class="partners-row-name">${partner.name}</h3>
        <p class="partners-row-meta">${partner.address} · ${partner.postal_code} · ${partner.phone}</p>
        <p class="partners-row-services">${services || "—"}</p>
        <p class="partners-row-flags">
          ${partner.is_paid ? "Fizetős" : "Nem fizetős"} · ${partner.is_active ? "Aktív" : "Inaktív"}
          ${partner.google_rating != null ? ` · ★ ${partner.google_rating}` : ""}
        </p>
      </div>
      <div class="partners-row-actions">
        <button type="button" class="site-header-btn site-header-btn--ghost" data-edit="${partner.id}">Szerkesztés</button>
        <button type="button" class="site-header-btn site-header-btn--ghost partners-delete" data-delete="${partner.id}">Törlés</button>
      </div>
    `;
    listEl.append(row);
  }

  listEl.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => startEdit(Number(btn.dataset.edit)));
  });
  listEl.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => removePartner(Number(btn.dataset.delete)));
  });
}

function readServicesFromForm() {
  return [...form.querySelectorAll('input[name="services"]:checked')].map((el) => el.value);
}

function fillForm(partner) {
  form.name.value = partner?.name ?? "";
  form.address.value = partner?.address ?? "";
  form.postal_code.value = partner?.postal_code ?? "";
  form.phone.value = partner?.phone ?? "";
  form.opening_hours.value = partner?.opening_hours ?? "";
  form.google_place_id.value = partner?.google_place_id ?? "";
  form.google_rating.value = partner?.google_rating ?? "";
  form.google_review_count.value = partner?.google_review_count ?? "";
  form.is_active.checked = partner?.is_active !== false;
  form.is_paid.checked = Boolean(partner?.is_paid);
  form.paid_until.value = partner?.paid_until ?? "";
  form.querySelectorAll('input[name="services"]').forEach((input) => {
    input.checked = (partner?.services ?? []).includes(input.value);
  });
}

function startEdit(id) {
  const partner = partners.find((p) => p.id === id);
  if (!partner) return;
  editingId = id;
  formTitle.textContent = `Partner szerkesztése (#${id})`;
  fillForm(partner);
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm() {
  editingId = null;
  formTitle.textContent = "Új partner";
  fillForm(null);
}

async function removePartner(id) {
  if (!confirm("Biztosan törlöd a partnert?")) return;
  await deletePartner(id);
  if (editingId === id) resetForm();
  await loadPartners();
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    id: editingId,
    name: form.name.value.trim(),
    address: form.address.value.trim(),
    postal_code: form.postal_code.value.trim(),
    phone: form.phone.value.trim(),
    opening_hours: form.opening_hours.value.trim(),
    google_place_id: form.google_place_id.value.trim(),
    google_rating: form.google_rating.value,
    google_review_count: form.google_review_count.value,
    is_active: form.is_active.checked,
    is_paid: form.is_paid.checked,
    paid_until: form.paid_until.value.trim() || null,
    services: readServicesFromForm(),
  };

  const response = await fetch("/api/partners", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  try {
    await parseJson(response);
    resetForm();
    await loadPartners();
  } catch (error) {
    alert(error.message);
  }
});

resetBtn?.addEventListener("click", resetForm);

importBtn?.addEventListener("click", async () => {
  importStatus.hidden = false;
  try {
    const rows = JSON.parse(importArea.value || "[]");
    const response = await fetch("/api/partners/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partners: rows }),
    });
    const data = await parseJson(response);
    const ok = data.results.filter((r) => r.ok).length;
    const fail = data.results.length - ok;
    importStatus.textContent = `Import kész: ${ok} siker, ${fail} hiba.`;
    await loadPartners();
  } catch (error) {
    importStatus.textContent = error.message ?? "Import hiba.";
  }
});

previewBtn?.addEventListener("click", async () => {
  const postal = previewInput.value.replace(/\D/g, "").slice(0, 4);
  previewInput.value = postal;
  previewOut.textContent = "Betöltés…";
  try {
    const data = await fetchPartnerRecommendations(postal);
    previewOut.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    previewOut.textContent = error.message;
  }
});

resetForm();
loadPartners();

if (previewInput && loadSavedPostalCode()) {
  previewInput.value = loadSavedPostalCode();
}
