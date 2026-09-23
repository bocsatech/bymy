import {
  saveListingToDb,
  setStoredListingId,
  fetchListing,
  saveListingPhotosOrder,
  getStoredListingId,
} from "./db-client.js?v=wizardSave1";
import { createAdForm } from "./form-core.js?v=photoKeep1";
import { applyImportedVehicleToSelects } from "./vehicle-catalog-client.js?v=importVehicle1";
import { initTireSizes } from "./tire-sizes-ui.js";
import { initPhoneLanguages } from "./phone-lang-ui.js";
import { initCategoryPicker } from "./category-picker.js?v=pickerBoot4";
import { applyAdFormDesk, clearAdFormEditBoot, isDeskVehicleSubtype } from "./ad-form-desk.js?v=immoTipusPick1";
import {
  requireAuthForPage,
  getAuthUser,
  getProfile,
  loginUrl,
  initSiteAuth,
  loadProfileFromServer,
} from "./site-auth.js?v=pickerBoot2";
import {
  applyListingAddressFromProfile,
  applyListingAddressFromProfileSync,
  initAdLocationProfile,
  getListingAddressFromProfile,
} from "./ad-location-profile.js?v=locProf7";
import { initImproveDescription } from "./improve-description.js?v=descAi2";

initSiteAuth();
/** Ne blokkolja a kategóriaválasztót — sessionStorage alapján azonnal kattintható; háttérben /api/auth/me. */
const authPromise = requireAuthForPage();

const adForm = document.getElementById("ad-form");
initImproveDescription(adForm);
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
  const immoTipus = String(formData?.ingatlan_tipus ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (vertical === "ingatlan") {
    const id = immoTipus[0] || "";
    const labels = {
      elado: "Eladó Ingatlanok",
      kiado: "Kiadó Ingatlanok",
      airbnb: "Airbnb Ingatlanok",
    };
    return {
      vertical: "ingatlan",
      subtype: "ingatlan",
      label: labels[id] || "Ingatlan",
      immoTipus: id ? [id] : [],
      immoKategoria: [],
    };
  }
  if (vertical === "teher" && subtype === "kisteher") {
    return { vertical: "teher", subtype: "kisteher", label: "Kisteherautó" };
  }
  if (vertical === "teher" && subtype === "teherauto") {
    return { vertical: "teher", subtype: "teherauto", label: "Teherautó" };
  }
  if (vertical === "auto" && subtype === "leasing") {
    return { vertical: "auto", subtype: "leasing", label: "Leasingautó" };
  }
  if (vertical === "auto" && subtype === "berauto") {
    return { vertical: "auto", subtype: "berauto", label: "Bérautó" };
  }
  if (vertical === "auto" && subtype === "lakokocsi") {
    return { vertical: "auto", subtype: "lakokocsi", label: "Bérelhető Lakókocsi" };
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

function withPhotoOverlayMeta(formData) {
  const meta = formApi?.getPhotoOverlayMetaForSave?.();
  if (!meta) return formData;
  return { ...formData, ...meta };
}

function syncPhotoUrlsFromListing(listing) {
  const fromPreview = Array.isArray(listing?.preview?.imageUrls)
    ? listing.preview.imageUrls.map((url) => String(url ?? "").trim()).filter(Boolean)
    : [];
  const fo = String(listing?.fo_kep || listing?.form?.fo_kep || "").trim();
  const fromForm = [];
  if (fo) fromForm.push(fo);
  for (const line of String(listing?.form?.fotok ?? "").split(/\n+/)) {
    const url = line.trim();
    if (url && !fromForm.includes(url)) fromForm.push(url);
  }
  const urls = fromPreview.length >= fromForm.length ? fromPreview : fromForm;
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

  try {
    /* Ne photos[]-szel mentsünk: az csak az új base64 képeket vinné, a meglévő URL-eket törölné. */
    const saved = await saveListingToDb(withPhotoOverlayMeta(formData), listingId, {
      status: "mentett",
      photos: [],
    });

    if (!saved?.id) {
      throw new Error("A piszkozat mentése sikertelen.");
    }

    setStoredListingId(saved.id);

    if (fromStep >= 4 && readyItems.length) {
      const updated = await saveListingPhotosOrder(saved.id, readyItems);
      syncPhotoUrlsFromListing(updated);
      return updated ?? saved;
    }

    syncPhotoUrlsFromListing(saved);
    return saved;
  } catch (error) {
    console.warn("Piszkozat mentése sikertelen, de a lépkedés folytatódik:", error);
    return null;
  }
}

function registerAbandonPhotoCleanup() {
  if (abandonCleanupBound || editing) return;
  abandonCleanupBound = true;
  window.addEventListener("pagehide", () => {
    if (wizardSubmitted) return;
    const id = getStoredListingId();
    if (!id) return;
    fetch(`/api/listings/${id}/photos`, {
      method: "DELETE",
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => {});
  });
}

function showWizardShell() {
  document.getElementById("category-picker-shell")?.setAttribute("hidden", "");
  document.getElementById("ad-wizard-shell")?.removeAttribute("hidden");
  const subtype =
    adForm?.elements.namedItem("hirdetes_alkategoria")?.value ??
    adForm?.elements.namedItem("jarmu_kategoria")?.value ??
    categoryPicker?.getSelection?.()?.subtype ??
    "";
  const stepsBar = document.getElementById("wizard-steps-bar");
  if (isDeskVehicleSubtype(subtype)) stepsBar?.setAttribute("hidden", "");
  else stepsBar?.removeAttribute("hidden");
  applyAdFormDesk({ openStep: 1, scrollToAccordion: "alap" });
}

function ensureFormReady() {
  if (formApi || !adForm) return formApi;
  if (!editing) setStoredListingId(null);
  initAdLocationProfile(adForm);
  loadProfileFromServer()
    .then(() => {
      applyListingAddressFromProfileSync(adForm);
      applyListingAddressFromProfile(adForm).catch(() => {});
    })
    .catch(() => {});
  registerAbandonPhotoCleanup();
  tireSizes = initTireSizes(adForm);
  phoneLanguages = initPhoneLanguages(adForm);
  formApi = createAdForm({
    mode: "wizard",
    editing,
    onStepPersist: persistWizardStep,
    onWizardComplete: async (formData) => {
      applyListingAddressFromProfileSync(adForm);
      await applyListingAddressFromProfile(adForm);
      const profileAddr = getListingAddressFromProfile();
      const pick = (formKey, profileVal) =>
        String(formData[formKey] || adForm.elements.namedItem(formKey)?.value || profileVal || "").trim();
      formData.megtekintesi_cim = pick("megtekintesi_cim", profileAddr.street);
      formData.iranyitoszam = pick("iranyitoszam", profileAddr.postalCode).replace(/\D/g, "").slice(0, 4);
      formData.telepules = pick("telepules", profileAddr.city);
      formData.iranyitoszam = String(formData.iranyitoszam || "").replace(/\D/g, "").slice(0, 4);
      if (formData.iranyitoszam.length !== 4 || !formData.telepules) {
        throw new Error("Add meg az irányítószámot (4 számjegy) és a települést.");
      }
      if (!String(formData.email || "").trim()) {
        const p = getProfile();
        formData.email =
          String(getAuthUser()?.email || p?.companyEmail || p?.email || "").trim();
      }
      const items = formApi?.getPreparedPhotoItems?.() ?? [];
      if (!editing && !items.length) {
        throw new Error("Legalább egy fénykép kell a hirdetéshez.");
      }
      const saved = await saveListingToDb(withPhotoOverlayMeta(formData), resolveListingId(), {
        status: "feladott",
        photos: [],
      });
      if (!saved?.id) {
        throw new Error("A szerver nem mentette a hirdetést.");
      }
      if (items.length) {
        const updated = await saveListingPhotosOrder(saved.id, items);
        syncPhotoUrlsFromListing(updated ?? saved);
      }
      if (!editing && !items.length && !saved.fo_kep && !saved.preview?.imageUrl) {
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
    onCatalogReady: async (catalog) => {
      if (!pendingEditForm) return;
      const catSel = categorySelectionFromForm(pendingEditForm);
      if (catSel) categoryPicker?.syncWizardContext?.(catSel);
      formApi?.applyFormData?.(pendingEditForm, { fromImport: true });
      if (pendingEditForm.gyartmany) {
        await applyImportedVehicleToSelects({
          brandSelect: document.getElementById("gyartmany"),
          modelSelect: document.getElementById("modell"),
          tipusSelect: document.getElementById("tipus"),
          egyebTipusInput: document.getElementById("egyeb_tipus"),
          catalog,
          formData: pendingEditForm,
        });
      }
      formApi?.applyFormData?.(pendingEditForm, { fromImport: true });
      applyListingAddressFromProfileSync(adForm);
      applyListingAddressFromProfile(adForm).catch(() => {});
      phoneLanguages?.syncLanguages?.();
      tireSizes?.syncRearTires?.();
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
      const selVertical = categoryPicker?.getSelection?.()?.vertical;
      if (!editing && selVertical !== "ingatlan") api?.resetForm?.({ fresh: true });
      api?.markTouched?.();
      const sel = categoryPicker?.getSelection?.();
      if (sel) categoryPicker?.syncWizardContext?.(sel);
      api?.syncKisteherFields?.();
      phoneLanguages?.syncLanguages?.();
      tireSizes?.syncRearTires?.();
      applyListingAddressFromProfileSync(adForm);
      applyListingAddressFromProfile(adForm).catch(() => {});
      window.dispatchEvent(new Event("ad-form-sync-location"));
      window.dispatchEvent(new Event("ad-form-layout-refresh"));
      applyAdFormDesk({ openStep: 1, scrollToAccordion: "alap" });
    } catch (error) {
      console.error("Űrlap indítás hiba:", error);
    }
  },
  onReset: () => {
  },
});

if (editing) {
  if (!(await authPromise)) {
    throw new Error("Belépés szükséges");
  }
  try {
    const listing = await fetchListing(editId);
    if (!listing?.form) {
      throw new Error("A hirdetés nem tölthető be.");
    }
    const api = ensureFormReady();
    pendingEditForm = { ...listing.form };
    if (listing.fo_kep && !pendingEditForm.fo_kep) pendingEditForm.fo_kep = listing.fo_kep;
    if (!pendingEditForm.hirdetes_vertical) pendingEditForm.hirdetes_vertical = "auto";
    if (!pendingEditForm.hirdetes_alkategoria) pendingEditForm.hirdetes_alkategoria = "szemelyauto";
    if (!pendingEditForm.jarmu_kategoria) pendingEditForm.jarmu_kategoria = "szemelyauto";
    adForm._bymyLastFormData = pendingEditForm;
    for (const [key, value] of Object.entries(pendingEditForm)) {
      const el = adForm.elements.namedItem(key);
      if (!el || value == null || String(value).trim() === "") continue;
      if (el instanceof RadioNodeList) continue;
      if (el.type === "checkbox") continue;
      el.value = Array.isArray(value) ? JSON.stringify(value) : String(value);
    }
    const catSel = categorySelectionFromForm(pendingEditForm);
    if (catSel) categoryPicker?.syncWizardContext?.(catSel);
    showWizardShell();
    setStoredListingId(editId);
    api?.applyFormData?.(pendingEditForm, { fromImport: true });
    syncPhotoUrlsFromListing(listing);    window.dispatchEvent(new Event("ad-form-layout-refresh"));
    applyAdFormDesk({ openStep: 1, scrollToAccordion: "alap" });
    const published = String(listing.status || "") === "feladott";
    const isImmo = String(listing.form?.hirdetes_vertical || "").toLowerCase() === "ingatlan";
    if (published && isImmo) {
      categoryPicker?.lockCategoryChange?.(true);
      adForm?.setAttribute("data-ingatlan-type-locked", "1");
      window.dispatchEvent(new Event("ad-form-layout-refresh"));
      applyAdFormDesk();
    }
  } catch (error) {
    clearAdFormEditBoot();
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
