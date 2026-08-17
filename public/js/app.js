import { saveListingToDb, setStoredListingId } from "./db-client.js";
import { createAdForm } from "./form-core.js?v=adsPhoto1";
import { compressListingPhotos } from "./listing-photo-compress.js?v=adsPhoto1";
import { initTireSizes } from "./tire-sizes-ui.js";
import { initPhoneLanguages } from "./phone-lang-ui.js";
import { initCategoryPicker } from "./category-picker.js";
import {
  refreshAuthSession,
  getAuthUser,
  loginUrl,
  initSiteAuth,
} from "./site-auth.js";

await refreshAuthSession();
initSiteAuth();

const adForm = document.getElementById("ad-form");
let tireSizes = null;
let phoneLanguages = null;
let formApi = null;

function ensureFormReady() {
  if (formApi || !adForm) return formApi;
  setStoredListingId(null);
  tireSizes = initTireSizes(adForm);
  phoneLanguages = initPhoneLanguages(adForm);
  formApi = createAdForm({
    mode: "wizard",
    onWizardComplete: async (formData) => {
      const files = formApi?.getPhotoFiles?.() ?? [];
      if (!files.length) {
        throw new Error("Legalább egy fénykép kell a hirdetéshez.");
      }
      const photos = await compressListingPhotos(files);
      if (!photos.length) {
        throw new Error("A képek feltöltése sikertelen. JPG vagy PNG kell.");
      }
      const saved = await saveListingToDb(formData, null, { status: "feladott", photos });
      if (!saved?.id) {
        throw new Error("A szerver nem mentette a hirdetést.");
      }
      if (!saved.fo_kep && !saved.preview?.imageUrl) {
        throw new Error("A hirdetés mentődött, de a kép nem. Próbáld kisebb JPG-gel.");
      }
      window.location.assign("/auto.html");
      return saved;
    },
    onNewAd: () => {
      setStoredListingId(null);
      categoryPicker?.reset();
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
    window.location.href = loginUrl("/hirdetesfeladas.html?continue=1");
    return false;
  },
  onVehicleSelected: () => {
    try {
      const api = ensureFormReady();
      api?.resetForm?.({ fresh: true });
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

// Ha URL continue=1 és már van session, az űrlapot is készítsük elő
if (new URLSearchParams(window.location.search).get("continue") === "1" && getAuthUser()?.email) {
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
