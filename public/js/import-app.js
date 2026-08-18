import { loadAdFormPartial } from "./load-ad-form.js";
import { createAdForm } from "./form-core.js?v=visLayout6";
import { initImportPanel, getImportResults, setImportResults } from "./import.js";
import { enrichFormFromImportItem } from "./import-enrich.js";
import {
  saveListingToDb,
  saveListingsBatchToDb,
  setStoredListingId,
  getStoredListingId,
  fetchListing,
  fetchDbStats,
  deleteAllListingsFromDb,
} from "./db-client.js";

const EMBEDDED_VERSION = document.querySelector('meta[name="bymy-version"]')?.content ?? "";
const SERVER_RESTART_MSG =
  "Régi Bymy szerver fut — állítsd le (Ctrl+C), majd indítsd újra: ~/Desktop/Bymy-indito.command (vagy bymy/mac/frissites.command után újraindítás).";

const formSection = document.getElementById("import-form-section");
const formTitle = document.getElementById("import-form-title");
const formError = document.getElementById("import-form-error");
const topAlert = document.getElementById("import-top-alert");
const saveBtn = document.getElementById("import-save-btn");
const clearAllBtn = document.getElementById("import-clear-all-btn");
const saveStatus = document.getElementById("import-save-status");
const dbBadge = document.getElementById("import-db-badge");

let currentListingId = null;
let adForm = null;
let serverReady = false;

function showTopAlert(message, type = "err") {
  if (!topAlert) {
    showFormError(message);
    return;
  }
  topAlert.hidden = false;
  topAlert.textContent = message;
  topAlert.dataset.alertType = type;
  topAlert.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function hideTopAlert() {
  if (topAlert) topAlert.hidden = true;
}

function showFormError(message) {
  if (!formError) return;
  formError.hidden = false;
  formError.textContent = message;
  formError.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function setSaveStatus(message, type = "") {
  if (!saveStatus) return;
  saveStatus.textContent = message;
  saveStatus.className = type ? `import-save-status import-save-status--${type}` : "import-save-status";
}

function setSaveBlocked(message) {
  serverReady = false;
  if (saveBtn) saveBtn.disabled = true;
  showTopAlert(message, "err");
  setSaveStatus(message, "err");
}

function setSaveReady() {
  serverReady = true;
  if (saveBtn) saveBtn.disabled = false;
  if (saveStatus?.classList.contains("import-save-status--err")) {
    setSaveStatus("");
  }
  updateSaveButtonLabel();
}

function setVersionWarning(message) {
  showTopAlert(message, "warn");
  setSaveStatus(message, "err");
}

function updateSaveButtonLabel() {
  if (!saveBtn) return;
  const count = getImportResults().length;
  saveBtn.textContent =
    count > 1
      ? `Összes mentése az adatbázisba (${count})`
      : count === 1
        ? "Mentés az adatbázisba (1 hirdetés)"
        : "Mentés az adatbázisba";
}

function verifyFormLoaded() {
  const ok = Boolean(document.getElementById("gyartasi_ev") && document.getElementById("km"));
  if (!ok) {
    showFormError(
      "Az űrlap nem töltődött be. Futtasd: bymy/mac/frissites.command, indítsd újra a Bymy-et, majd Cmd+Shift+R."
    );
  } else if (formError) {
    formError.hidden = true;
  }
  return ok;
}

async function checkServerReady() {
  try {
    const healthRes = await fetch("/api/health");
    if (!healthRes.ok) throw new Error("health");
    const health = await healthRes.json();
    const statsRes = await fetch("/api/db/stats");
    if (!statsRes.ok) throw new Error("stats");
    const stats = await statsRes.json();
    if (typeof stats.listings !== "number") throw new Error("stats shape");

    dbBadge.hidden = false;
    dbBadge.textContent = `SQLite: ${stats.listings} hirdetés · ${stats.cells} cella · szerver ${health.version ?? "?"}`;

    if (EMBEDDED_VERSION && health.version && health.version !== EMBEDDED_VERSION) {
      setVersionWarning(
        `Verzió eltérés (${EMBEDDED_VERSION} ≠ ${health.version}) — frissites.command → újraindítás → Cmd+Shift+R.`
      );
    } else {
      hideTopAlert();
    }

    setSaveReady();
    return true;
  } catch {
    setSaveBlocked(SERVER_RESTART_MSG);
    return false;
  }
}

async function initPage() {
  const loaded = await loadAdFormPartial();
  if (!loaded) {
    showFormError(
      "Az űrlap fájl hiányzik. Frissíts (frissites.command), indítsd újra a Bymy-et. URL: https://bymy.vercel.app/import.html"
    );
    return;
  }

  adForm = createAdForm({
    mode: "import",
    onApplied: () => {
      formSection?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  });

  verifyFormLoaded();
  await checkServerReady();
  setInterval(checkServerReady, 15000);

  initImportPanel({
    alertOnApply: false,
    onResultsChange: () => updateSaveButtonLabel(),
    onApply: (formData, item) => {
      if (!verifyFormLoaded() || !adForm) return;
      const enriched = enrichFormFromImportItem(formData, item);
      currentListingId = item?.savedId ?? null;
      setStoredListingId(currentListingId);
      adForm.resetForm();
      formTitle.textContent = item?.cim || item?.url || "Importált hirdetés";
      adForm.applyFormData(enriched, { fromImport: true });
      if (saveStatus && !serverReady) {
        setSaveStatus(SERVER_RESTART_MSG, "err");
      } else if (saveStatus) {
        setSaveStatus("");
      }
      updateSaveButtonLabel();
    },
  });

  updateSaveButtonLabel();
  await loadListingFromUrl();
}

async function loadListingFromUrl() {
  const params = new URLSearchParams(location.search);
  const listingId = Number(params.get("listing"));
  if (!Number.isFinite(listingId) || listingId <= 0 || !adForm) return;

  try {
    const listing = await fetchListing(listingId);
    if (!listing?.form) return;
    currentListingId = listing.id;
    setStoredListingId(listing.id);
    formTitle.textContent = listing.hirdetes_cime || `Hirdetés #${listing.id}`;
    adForm.applyFormData(listing.form, { fromImport: true });
    formSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showFormError(error.message ?? "Hirdetés betöltése sikertelen.");
  }
}

async function handleSaveAllImportResults() {
  const items = getImportResults();
  if (!items.length) return null;

  const forms = items.map((item) => {
    const enriched = enrichFormFromImportItem(item.form ?? {}, item);
    if (item.imageUrl && !enriched.fo_kep) enriched.fo_kep = item.imageUrl;
    return enriched;
  });

  setSaveStatus(`Mentés: ${forms.length} hirdetés…`);
  const batch = await saveListingsBatchToDb(forms, { status: "feladott" });

  const updated = items.map((item, index) => {
    const entry = batch.results?.[index];
    if (!entry || entry.skipped) {
      return { ...item, saved: Boolean(item.saved || item.savedId), skippedDuplicate: Boolean(entry?.skipped) };
    }
    return {
      ...item,
      saved: true,
      savedId: entry.listing?.id ?? item.savedId,
      skippedDuplicate: false,
    };
  });
  setImportResults(updated);

  const firstSavedId = batch.results?.find((entry) => entry.listing?.id)?.listing?.id;
  if (firstSavedId) {
    currentListingId = firstSavedId;
    setStoredListingId(firstSavedId);
  }

  return batch;
}

async function handleSave() {
  if (!serverReady) {
    showTopAlert(SERVER_RESTART_MSG, "err");
    setSaveStatus(SERVER_RESTART_MSG, "err");
    return;
  }

  const importItems = getImportResults();
  saveBtn.disabled = true;

  try {
    if (importItems.length > 0) {
      const batch = await handleSaveAllImportResults();
      hideTopAlert();
      const saved = batch?.savedCount ?? 0;
      const skipped = batch?.skippedCount ?? 0;
      setSaveStatus(
        `Kész: ${saved} mentve, ${skipped} kihagyva (már bent volt) — főoldal: /`,
        saved > 0 || skipped > 0 ? "ok" : "err"
      );
      showTopAlert(
        saved > 0
          ? `${saved} hirdetés mentve az adatbázisba${skipped ? `, ${skipped} duplikátum kihagyva` : ""}.`
          : skipped
            ? `Minden hirdetés már az adatbázisban volt (${skipped}).`
            : "Nem sikerült menteni.",
        saved > 0 ? "ok" : skipped ? "warn" : "err"
      );
      await checkServerReady();
      updateSaveButtonLabel();
      return;
    }

    if (!adForm || !verifyFormLoaded()) return;

    setSaveStatus("Mentés…");
    const formData = adForm.collectFormData();
    const saved = await saveListingToDb(formData, currentListingId ?? getStoredListingId(), {
      status: "mentett",
    });
    currentListingId = saved?.id ?? currentListingId;
    hideTopAlert();
    setSaveStatus(
      `Mentve (#${saved?.id ?? "?"}, ${saved?.cells?.length ?? 0} cella) — megtekintés: /hirdetes.html?id=${saved?.id ?? ""}`,
      "ok"
    );
    await checkServerReady();
  } catch (error) {
    const message = error.message ?? "Mentés sikertelen";
    showTopAlert(message, "err");
    setSaveStatus(message, "err");
    await checkServerReady();
  } finally {
    if (serverReady) saveBtn.disabled = false;
  }
}

saveBtn?.addEventListener("click", handleSave);

clearAllBtn?.addEventListener("click", async () => {
  if (
    !confirm(
      "Törlöd a saját importált hirdetéseidet?\n\nMások hirdetései megmaradnak. Ez nem visszavonható."
    )
  ) {
    return;
  }
  if (!confirm("Biztosan? Ez nem visszavonható.")) return;
  clearAllBtn.disabled = true;
  setSaveStatus("Törlés…");
  try {
    const result = await deleteAllListingsFromDb();
    hideTopAlert();
    setSaveStatus(
      `Törölve: ${result.deleted ?? 0} hirdetés, ${result.imagesRemoved ?? 0} kép — készen áll az új importra.`,
      "ok"
    );
    showTopAlert("Minden hirdetés törölve. Most indíthatod az importot.", "ok");
    await checkServerReady();
  } catch (error) {
    const message = error.message ?? "Törlés sikertelen";
    showTopAlert(message, "err");
    setSaveStatus(message, "err");
  } finally {
    clearAllBtn.disabled = false;
  }
});

await initPage();
