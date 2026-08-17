import { fetchListings, fetchListing, deleteListingFromDb, deleteAllListingsFromDb, fetchDbStats, saveListingToDb, recordListingView } from "./db-client.js?v=myAds1";
import { renderListingCells } from "./cells-view.js";
import { createListingCard, formatListingDisplayTitle } from "./listing-card.js";

const listEl = document.getElementById("listings-list");
const detailEl = document.getElementById("listings-detail");
const detailTitle = document.getElementById("listings-detail-title");
const detailMeta = document.getElementById("listings-detail-meta");
const cellsEl = document.getElementById("listings-cells");
const emptyEl = document.getElementById("listings-empty");
const statsEl = document.getElementById("listings-stats");
const filterButtons = [...document.querySelectorAll("[data-listings-filter]")];
const editBtn = document.getElementById("listings-edit-btn");
const publishBtn = document.getElementById("listings-publish-btn");
const deleteBtn = document.getElementById("listings-delete-btn");
const clearAllBtn = document.getElementById("listings-clear-all-btn");

let currentFilter = "all";
let selectedId = null;
let currentListing = null;

const STATUS_LABELS = {
  mentett: "Mentett",
  feladott: "Feladott",
  inaktiv: "Inaktív",
};

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value.includes("T") ? value : `${value}Z`).toLocaleString("hu-HU");
  } catch {
    return value;
  }
}

function setActiveFilter(filter) {
  currentFilter = filter;
  filterButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.listingsFilter === filter);
  });
}

async function refreshStats() {
  try {
    const stats = await fetchDbStats();
    statsEl.hidden = false;
    statsEl.textContent = `${stats.listings} hirdetés · ${stats.mentett ?? 0} mentett · ${stats.feladott ?? 0} feladott · ${stats.cells} cella`;
  } catch {
    statsEl.hidden = true;
  }
}

function renderList(items) {
  listEl.innerHTML = "";
  emptyEl.hidden = items.length > 0;

  for (const item of items) {
    const card = createListingCard(item, {
      selected: item.id === selectedId,
      formatDate,
    });
    card.addEventListener("click", () => selectListing(item.id));
    listEl.appendChild(card);
  }
}

async function loadList() {
  const status = currentFilter === "all" ? null : currentFilter;
  const items = await fetchListings({ limit: 200, status });
  renderList(items);
  if (selectedId && !items.some((item) => item.id === selectedId)) {
    selectedId = null;
    detailEl.hidden = true;
  }
}

async function selectListing(id) {
  selectedId = id;
  detailEl.hidden = false;
  detailTitle.textContent = "Betöltés…";
  detailMeta.textContent = "";
  cellsEl.innerHTML = "";

  const listing = await fetchListing(id);
  if (!listing) {
    detailTitle.textContent = "Nem található";
    return;
  }

  const viewedKey = `bymy-viewed-${id}`;
  try {
    if (!sessionStorage.getItem(viewedKey)) {
      sessionStorage.setItem(viewedKey, "1");
      await recordListingView(id, "web");
    }
  } catch {
    /* ignore */
  }

  currentListing = listing;

  detailTitle.textContent =
    formatListingDisplayTitle(listing.hirdetes_cime) || `Hirdetés #${listing.id}`;
  const parts = [
    STATUS_LABELS[listing.status] || listing.status,
    `Frissítve: ${formatDate(listing.updated_at)}`,
    `${listing.cells?.length ?? 0} cella`,
  ];
  if (listing.forras_url) {
    parts.push(`Forrás: ${listing.forras_url}`);
  }
  detailMeta.textContent = parts.join(" · ");

  renderListingCells(cellsEl, listing.cells);
  editBtn.href = `/hirdetesfeladas.html?id=${listing.id}`;
  publishBtn.hidden = listing.status === "feladott";
  deleteBtn.dataset.id = String(listing.id);

  await loadList();
  detailEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handlePublish() {
  if (!currentListing?.form || !selectedId) return;
  publishBtn.disabled = true;
  try {
    await saveListingToDb(currentListing.form, selectedId, { status: "feladott" });
    await refreshStats();
    await selectListing(selectedId);
  } catch (error) {
    alert(error.message ?? "Közzététel sikertelen.");
  } finally {
    publishBtn.disabled = false;
  }
}

async function handleDelete() {
  if (!selectedId) return;
  const title = detailTitle.textContent || `#${selectedId}`;
  if (!confirm(`Törlöd ezt a hirdetést?\n\n${title}`)) return;

  await deleteListingFromDb(selectedId);
  selectedId = null;
  currentListing = null;
  detailEl.hidden = true;
  await refreshStats();
  await loadList();
}

async function handleClearAll() {
  if (
    !confirm(
      "Törlöd AZ ÖSSZES hirdetést az adatbázisból?\n\nEz a képeket is törli. Utána újra tudsz importálni."
    )
  ) {
    return;
  }
  if (!confirm("Biztosan? Ez nem visszavonható.")) return;

  clearAllBtn.disabled = true;
  try {
    const result = await deleteAllListingsFromDb();
    selectedId = null;
    currentListing = null;
    detailEl.hidden = true;
    await refreshStats();
    await loadList();
    alert(`Törölve: ${result.deleted ?? 0} hirdetés, ${result.imagesRemoved ?? 0} kép.`);
  } catch (error) {
    alert(error.message ?? "Törlés sikertelen.");
  } finally {
    clearAllBtn.disabled = false;
  }
}

filterButtons.forEach((btn) => {
  btn.addEventListener("click", async () => {
    setActiveFilter(btn.dataset.listingsFilter);
    await loadList();
  });
});

publishBtn?.addEventListener("click", handlePublish);
deleteBtn?.addEventListener("click", handleDelete);
clearAllBtn?.addEventListener("click", handleClearAll);

const params = new URLSearchParams(location.search);
const openId = Number(params.get("id"));
if (Number.isFinite(openId) && openId > 0) {
  selectListing(openId).catch(console.error);
}

setActiveFilter("all");
import("./site-side-content.js")
  .then((mod) => mod.initSiteSideContent())
  .catch((error) => console.error("Oldalsáv betöltés:", error));
refreshStats().catch(console.error);
loadList().catch((error) => {
  emptyEl.hidden = false;
  emptyEl.textContent = error.message ?? "Nem sikerült betölteni a hirdetéseket.";
});
