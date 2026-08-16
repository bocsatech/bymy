import { saveListingToDb, getStoredListingId } from "./db-client.js";
import { createAdForm } from "./form-core.js";
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
  tireSizes = initTireSizes(adForm);
  phoneLanguages = initPhoneLanguages(adForm);
  formApi = createAdForm({
    mode: "wizard",
    onWizardComplete: async (formData) => {
      try {
        const listingId = getStoredListingId();
        const saved = await saveListingToDb(formData, listingId, { status: "feladott" });
        const summary = document.getElementById("summary-text");
        if (summary && saved?.id) {
          const homeLink = document.createElement("a");
          homeLink.className = "listings-inline-link";
          homeLink.href = "/";
          homeLink.textContent = ` Megtekintés a főoldalon (#${saved.id})`;
          summary.appendChild(document.createElement("br"));
          summary.appendChild(homeLink);

          const listLink = document.createElement("a");
          listLink.className = "listings-inline-link";
          listLink.href = `/listings.html?id=${saved.id}`;
          listLink.textContent = ` Hirdetések admin (#${saved.id})`;
          summary.appendChild(document.createElement("br"));
          summary.appendChild(listLink);
        }
      } catch (error) {
        console.warn("Hirdetés mentése:", error);
        const summary = document.getElementById("summary-text");
        if (summary) {
          summary.appendChild(document.createElement("br"));
          summary.appendChild(
            document.createTextNode(` Mentés hiba: ${error.message ?? error}`)
          );
        }
      }
    },
    onNewAd: () => {
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
      ensureFormReady();
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
    ensureFormReady();
  } catch (error) {
    console.error("Űrlap indítás hiba:", error);
  }
}

import("./site-side-content.js")
  .then((mod) => mod.initSiteSideContent())
  .catch((error) => console.error("Oldalsáv betöltés:", error));
