import {
  saveListingToDb,
  setStoredListingId,
  fetchListing,
  saveListingPhotosOrder,
  getStoredListingId,
} from "./db-client.js?v=wizardSave1";
import { createAdForm } from "./form-core.js?v=teherPost1";
import { initTireSizes } from "./tire-sizes-ui.js";
import { initPhoneLanguages } from "./phone-lang-ui.js";
import { initCategoryPicker } from "./category-picker.js?v=teherPost1";
import {
  requireAuthForPage,
  getAuthUser,
  loginUrl,
  initSiteAuth,
} from "./site-auth.js";
import {
  applyListingAddressFromProfile,
  applyListingAddressFromProfileSync,
  initAdLocationProfile,
  listingAddressComplete,
  getListingAddressFromProfile,
} from "./ad-location-profile.js?v=locProf1";

if (!(await requireAuthForPage())) {
  throw new Error("Belépés szükséges");
}
initSiteAuth();

const adForm = document.getElementById("ad-form");
const editId = Number(new URLSearchParams(window.location.search).get("id"));
const editing = Number.isFinite(editId) && editId > 0;

let tireSizes = null;
let phoneLanguages = null;
let pendingEditForm = null;
let formApi = null;
let wizardSubmitted = false;
let abandonCleanupBound = false;

function categorySelectionFromForm(formData) {
  const vertical = String(formData?.hirdetes_vertical ?? "").trim().toLowerCase();
  const subtype = String(formData?.hirdetes_alkategoria ?? formData?.jarmu_kategoria ?? "")
    .trim()
    .toLowerCase();
  if (vertical === "teher" && subtype === "kisteher") {
    return { vertical: "teher", subtype: "kisteher", label: "Kisteher 3,5 t-ig" };
  }
  if (vertical === "teher" && subtype === "teherauto") {
    return { vertical: "teher", subtype: "teherauto", label: "Teherautó 3,5 t-tól" };
  }
  if (vertical === "auto" && subtype === "szemelyauto") {
    return { vertical: "auto", subtype: "szemelyauto", label: "Személyautó" };
  }
  return null;
}

function resolveListingId() {
  if (editing) return editId;
  return getStoredListingId();
}

function syncPhotoUrlsFromListing(listing) {
  const urls = listing?.preview?.imageUrls?.length
    ? listing.preview.imageUrls
    : listing?.fo_kep
      ? [listing.fo_kep]
      : [];
  if (!urls.length || !formApi?.applyPhotoUrls) return;
  formApi.applyPhotoUrls(urls);
}

async function persistWizardStep(formData, { fromStep } = {}) {
  if (fromStep >= 5) {
    applyListingAddressFromProfileSync(adForm);
    await applyListingAddressFromProfile(adForm);
  }

  const listingId = resolveListingId();
  const items = formApi?.getPreparedPhotoItems?.() ?? [];
  const readyItems = items.filter((item) => item.data || item.url);
  const photos = readyItems.filter((item) => item.data).map((item) => item.data);

  const saved = await saveListingToDb(formData, listingId, {
    status: "mentett",
    photos: fromStep >= 4 ? photos : [],
  });

  if (!saved?.id) {
    throw new Error("A piszkozat mentése sikertelen.");
  }

  setStoredListingId(saved.id);

  if (fromStep >= 4 && readyItems.length) {
    const withUrls = readyItems.every((item) => item.url || item.data);
    if (!withUrls || readyItems.some((item) => item.url)) {
      const updated = await saveListingPhotosOrder(saved.id, readyItems);
      syncPhotoUrlsFromListing(updated);
      return updated ?? saved;
    }
  }

  syncPhotoUrlsFromListing(saved);
  return saved;
}

function registerAbandonPhotoCleanup() {
  if (abandonCleanupBound || editing) return;
  abandonCleanupBound = true;
  window.addEventListener("pagehide", () => {
    if (wizardSubmitted) return;
    const id = getStoredListingId();
    if (!id) return;
    const token = (() => {
      try {
        return localStorage.getItem("bymy-auth-token") || "";
      } catch {
        return "";
      }
    })();
    fetch(`/api/listings/${id}/photos`, {
      method: "DELETE",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => {});
  });
}

function showWizardShell() {
  document.getElementById("category-picker-shell")?.setAttribute("hidden", "");
  document.getElementById("ad-wizard-shell")?.removeAttribute("hidden");
  document.getElementById("wizard-steps-bar")?.removeAttribute("hidden");
}

function ensureFormReady() {
  if (formApi || !adForm) return formApi;
  if (!editing) setStoredListingId(null);
  initAdLocationProfile(adForm);
  registerAbandonPhotoCleanup();
  tireSizes = initTireSizes(adForm);
  phoneLanguages = initPhoneLanguages(adForm);
  formApi = createAdForm({
    mode: "wizard",
    editing,
    onStepPersist: persistWizardStep,
    onWizardComplete: async (formData) => {
      applyListingAddressFromProfileSync(adForm);
      const loc = await applyListingAddressFromProfile(adForm);
      if (!loc.ok || !listingAddressComplete(getListingAddressFromProfile())) {
        throw new Error(
          "Add meg a címed a Beállításokban (Személyes adatok vagy Cégadatok), majd próbáld újra."
        );
      }
      const items = formApi?.getPreparedPhotoItems?.() ?? [];
      if (!editing && !items.length) {
        throw new Error("Legalább egy fénykép kell a hirdetéshez.");
      }
      const allData = items.length > 0 && items.every((item) => item.data || item.url);
      const photos = items.filter((item) => item.data).map((item) => item.data);
      const saved = await saveListingToDb(formData, resolveListingId(), {
        status: "feladott",
        photos,
      });
      if (!saved?.id) {
        throw new Error("A szerver nem mentette a hirdetést.");
      }
      if (!allData && items.length) {
        await saveListingPhotosOrder(saved.id, items);
      }
      if (!editing && !saved.fo_kep && !saved.preview?.imageUrl && !items.length) {
        throw new Error("A hirdetés mentődött, de a kép nem. Próbáld kisebb JPG-gel.");
      }
      wizardSubmitted = true;
      setStoredListingId(saved.id);
      window.location.assign("/beallitasok.html?szekcio=hirdetes");
      return saved;
    },
    onNewAd: () => {
      wizardSubmitted = false;
      setStoredListingId(null);
      categoryPicker?.reset();
    },
    onCatalogReady: () => {
      if (pendingEditForm) {
        formApi?.applyFormData?.(pendingEditForm, { fromImport: true });
        applyListingAddressFromProfileSync(adForm);
        applyListingAddressFromProfile(adForm).catch(() => {});
        phoneLanguages?.syncLanguages?.();
        tireSizes?.syncRearTires?.();
      }
    },
  });
  tireSizes?.syncRearTires?.();
  phoneLanguages?.syncLanguages?.();
  return formApi;
}

const categoryPicker = initCategoryPicker({
  requireLogin: async () => {
    const user = getAuthUser();
    if (user?.email) return true;
    window.location.href = loginUrl(
      editing ? `/hirdetesfeladas.html?id=${editId}` : "/hirdetesfeladas.html?continue=1"
    );
    return false;
  },
  onVehicleSelected: () => {
    try {
      const api = ensureFormReady();
      if (!editing) api?.resetForm?.({ fresh: true });
      const sel = categoryPicker?.getSelection?.();
      if (sel) categoryPicker?.syncWizardContext?.(sel);
      phoneLanguages?.syncLanguages?.();
      tireSizes?.syncRearTires?.();
    } catch (error) {
      console.error("Űrlap indítás hiba:", error);
    }
  },
  onReset: () => {
    // picker visible again
  },
});

if (editing) {
  try {
    const listing = await fetchListing(editId);
    if (!listing?.form) {
      throw new Error("A hirdetés nem tölthető be.");
    }
    const api = ensureFormReady();
    showWizardShell();
    pendingEditForm = listing.form;
    api?.applyFormData?.(listing.form, { fromImport: true });
    applyListingAddressFromProfileSync(adForm);
    await applyListingAddressFromProfile(adForm);
    phoneLanguages?.syncLanguages?.();
    tireSizes?.syncRearTires?.();
    setStoredListingId(editId);
    syncPhotoUrlsFromListing(listing);
    const catSel = categorySelectionFromForm(listing.form);
    if (catSel) categoryPicker?.syncWizardContext?.(catSel);
  } catch (error) {
    alert(error.message ?? "A hirdetés betöltése sikertelen.");
    window.location.assign("/beallitasok.html?szekcio=hirdetes");
  }
} else if (new URLSearchParams(window.location.search).get("continue") === "1" && getAuthUser()?.email) {
  try {
    const api = ensureFormReady();
    api?.resetForm?.({ fresh: true });
  } catch (error) {
    console.error("Űrlap indítás hiba:", error);
  }
}

import("./site-side-content.js")
  .then((mod) => mod.initSiteSideContent())
  .catch((error) => console.error("Oldalsáv betöltés:", error));
