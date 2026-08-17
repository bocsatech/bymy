import { saveListingToDb, setStoredListingId } from "./db-client.js";
import { createAdForm } from "./form-core.js?v=adsList1";
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error ?? new Error("Kép olvasása sikertelen."));
    reader.readAsDataURL(file);
  });
}

async function readPhotoDataUrls(input, max = 12) {
  const files = [...(input?.files ?? [])].slice(0, max);
  const photos = [];
  for (const file of files) {
    if (!file || !String(file.type || "").startsWith("image/")) continue;
    const dataUrl = await readFileAsDataUrl(file);
    if (typeof dataUrl === "string") photos.push(dataUrl);
  }
  return photos;
}

function ensureFormReady() {
  if (formApi || !adForm) return formApi;
  setStoredListingId(null);
  tireSizes = initTireSizes(adForm);
  phoneLanguages = initPhoneLanguages(adForm);
  formApi = createAdForm({
    mode: "wizard",
    onWizardComplete: async (formData) => {
      const photos = await readPhotoDataUrls(document.getElementById("photo-input"));
      const saved = await saveListingToDb(formData, null, { status: "feladott", photos });
      if (!saved?.id) {
        throw new Error("A szerver nem mentette a hirdetést.");
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
