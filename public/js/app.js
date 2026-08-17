import { saveListingToDb, setStoredListingId, fetchListing, saveListingPhotosOrder } from "./db-client.js?v=myAds2";
import { createAdForm } from "./form-core.js?v=cardTipus2";
import { initTireSizes } from "./tire-sizes-ui.js";
import { initPhoneLanguages } from "./phone-lang-ui.js";
import { initCategoryPicker } from "./category-picker.js?v=catPick20260817a";
import {
  requireAuthForPage,
  getAuthUser,
  loginUrl,
  initSiteAuth,
} from "./site-auth.js";

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

function showWizardShell() {
  document.getElementById("category-picker-shell")?.setAttribute("hidden", "");
  document.getElementById("ad-wizard-shell")?.removeAttribute("hidden");
  document.getElementById("wizard-steps-bar")?.removeAttribute("hidden");
}

function ensureFormReady() {
  if (formApi || !adForm) return formApi;
  if (!editing) setStoredListingId(null);
  tireSizes = initTireSizes(adForm);
  phoneLanguages = initPhoneLanguages(adForm);
  formApi = createAdForm({
    mode: "wizard",
    editing,
    onWizardComplete: async (formData) => {
      const items = formApi?.getPreparedPhotoItems?.() ?? [];
      if (!editing && !items.length) {
        throw new Error("Legalább egy fénykép kell a hirdetéshez.");
      }
      const allData = items.length > 0 && items.every((item) => item.data);
      const photos = allData ? items.map((item) => item.data) : [];
      const saved = await saveListingToDb(formData, editing ? editId : null, {
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
      window.location.assign("/beallitasok.html?szekcio=hirdetes");
      return saved;
    },
    onNewAd: () => {
      setStoredListingId(null);
      categoryPicker?.reset();
    },
    onCatalogReady: () => {
      if (pendingEditForm) {
        formApi?.applyFormData?.(pendingEditForm, { fromImport: true });
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
    phoneLanguages?.syncLanguages?.();
    tireSizes?.syncRearTires?.();
    setStoredListingId(editId);
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
