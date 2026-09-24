import { getAuthUser, getProfile, loadProfileFromServer } from "./site-auth.js";
import { inferMegyeFromCity } from "./county-infer.js";
import { wirePostalCityAutofill } from "./postal-city-autofill.js?v=postalFill1";

function isBusinessProfile(profile) {
  const type = String(profile?.accountType || "").trim();
  return type === "business" || type === "dealer";
}

export function getListingAddressFromProfile(profile = null) {
  const p = profile ?? getProfile();
  if (isBusinessProfile(p)) {
    return {
      street: String(p.companyStreet || p.companyAddress || p.street || "").trim(),
      postalCode: String(p.companyPostalCode || p.postalCode || "")
        .replace(/\D/g, "")
        .slice(0, 4),
      city: String(p.companyCity || p.city || "").trim(),
      country: String(p.companyCountry || p.country || "Magyarország").trim() || "Magyarország",
    };
  }
  return {
    street: String(p.street || "").trim(),
    postalCode: String(p.postalCode || "")
      .replace(/\D/g, "")
      .slice(0, 4),
    city: String(p.city || "").trim(),
    country: String(p.country || "Magyarország").trim() || "Magyarország",
  };
}

export function listingAddressComplete(address) {
  return Boolean(
    address?.street && address?.postalCode?.length === 4 && address?.city
  );
}

async function lookupMegye(postalCode, city) {
  const postal = String(postalCode ?? "")
    .replace(/\D/g, "")
    .slice(0, 4);
  if (postal.length !== 4) return inferMegyeFromCity(city, postal);
  try {
    const params = new URLSearchParams({ postal_code: postal });
    const res = await fetch(`/api/postal-codes/lookup?${params}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.megye) return data.megye;
    if (res.ok && data.city) return inferMegyeFromCity(data.city, postal);
  } catch {
  }
  return inferMegyeFromCity(city, postal);
}

function setField(form, name, value) {
  const field = form.elements.namedItem(name);
  if (!field || field instanceof RadioNodeList) return;
  field.value = value ?? "";
}

function setHint(form, message, { isError = false } = {}) {
  const hint = form.querySelector("[data-ad-location-hint]");
  if (!hint) return;
  hint.textContent = message || "";
  hint.hidden = !message;
  hint.classList.toggle("ad-location-hint--error", isError);
}

function unlockLocationFields(form) {
  form.querySelectorAll(".ad-location-fields input").forEach((el) => {
    if (el.type === "hidden") return;
    el.removeAttribute("readonly");
    el.removeAttribute("tabindex");
  });
}

function ensureLocationVisible(form) {
  const stack = form.querySelector(".field-stack--location");
  if (!stack) return;
  stack.classList.remove("ad-layout-hidden");
  stack.hidden = false;
  stack.removeAttribute("hidden");
  stack.style.removeProperty("display");
  stack.querySelectorAll(".ad-layout-hidden").forEach((el) => {
    el.classList.remove("ad-layout-hidden");
    el.hidden = false;
    el.removeAttribute("hidden");
  });
  const card = stack.closest(".card");
  if (card && card.style.display === "none" && !stack.closest(".ad-layout-canvas")) {
    card.style.removeProperty("display");
  }
}

function parsePhoneParts(phone) {
  if (!phone) return null;
  const compact = String(phone).replace(/[^\d+]/g, "");
  const match = compact.match(/^(\+36|06)(\d{1,2})(\d{6,8})$/);
  if (!match) return null;
  const orszag = match[1].startsWith("06") ? "+36" : match[1];
  const szam = match[3].replace(/(\d{3})(\d+)/, "$1 $2");
  return { orszag, korzet: match[2], szam };
}

function listingPhoneFilled(form) {
  const korzet = form.elements.namedItem("telefon1_korzet");
  const szam = form.elements.namedItem("telefon1_szam");
  if (!korzet || !szam || korzet instanceof RadioNodeList || szam instanceof RadioNodeList) {
    return false;
  }
  return Boolean(String(korzet.value || "").trim() || String(szam.value || "").trim());
}

function applyPhoneFromProfile(form, profile) {
  if (!form || listingPhoneFilled(form)) return;
  const raw = isBusinessProfile(profile)
    ? String(profile.companyPhone || profile.phone || "").trim()
    : String(profile.phone || "").trim();
  if (!raw) return;
  const parts = parsePhoneParts(raw);
  if (parts) {
    setField(form, "telefon1_orszag", parts.orszag);
    setField(form, "telefon1_korzet", parts.korzet);
    setField(form, "telefon1_szam", parts.szam);
    return;
  }
  setField(form, "telefon1_orszag", "+36");
  setField(form, "telefon1_szam", raw);
}

export function applyContactFromProfile(form, profile = null) {
  if (!form) return;
  const p = profile ?? getProfile();
  const emailField = form.elements.namedItem("email");
  if (emailField && !(emailField instanceof RadioNodeList)) {
    if (!(emailField.dataset.userEdited === "1" && String(emailField.value || "").trim())) {
      const fromCompany = isBusinessProfile(p)
        ? String(p.companyEmail || p.companyEmail2 || "").trim()
        : "";
      const fromUser = String(getAuthUser()?.email || p.email || "").trim();
      const next = fromCompany || fromUser;
      if (next) emailField.value = next;
    }
  }
  applyPhoneFromProfile(form, p);
}

export async function applyListingAddressFromProfile(form, profile = null) {
  if (!form) return { ok: false, reason: "missing-form" };

  let resolved = profile;
  if (!resolved) {
    try {
      resolved = (await loadProfileFromServer()) || getProfile();
    } catch {
      resolved = getProfile();
    }
  }

  const result = applyListingAddressFromProfileSync(form, resolved);
  const address = result.address || getListingAddressFromProfile(resolved);
  const megye = await lookupMegye(address.postalCode, address.city);
  if (megye) setField(form, "megye", megye);

  updateLocationHint(form, { ...result, address });
  return { ...result, address, megye: megye || inferMegyeFromCity(address.city, address.postalCode) };
}

function updateLocationHint(form, result) {
  const hideStreet = form.querySelector(".field-stack--location")?.dataset.adHideStreetOnly === "1";
  if (hideStreet) {
    const postal = String(form.elements.namedItem("iranyitoszam")?.value ?? "").replace(/\D/g, "");
    const city = String(form.elements.namedItem("telepules")?.value ?? "").trim();
    if (postal.length === 4 && city) {
      setHint(form, "", { isError: false });
      return;
    }
    setHint(form, "Add meg az irányítószámot és a települést.", { isError: false });
    return;
  }
  if (!listingAddressComplete(result.address)) {
    setHint(
      form,
      "A cím nincs kitöltve a Beállításokban — ide is beírhatod, vagy töltsd ki a Cégadatok / Személyes adatoknál.",
      { isError: true }
    );
    return;
  }
  const megye = String(form.elements.namedItem("megye")?.value ?? "").trim();
  if (!megye) {
    setHint(
      form,
      "A vármegye automatikusan kitöltődik, ha az irányítószám és település helyes.",
      { isError: false }
    );
    return;
  }
  setHint(
    form,
    "A Beállításokból áthozott cím — ide is átírhatod, vagy módosítsd a Cégadatok / Személyes adatoknál.",
    { isError: false }
  );
}

export function applyListingAddressFromProfileSync(form, profile = null) {
  if (!form) return { ok: false, reason: "missing-form", address: null };

  const address = getListingAddressFromProfile(profile);
  if (address.street) setField(form, "megtekintesi_cim", address.street);
  if (address.postalCode) setField(form, "iranyitoszam", address.postalCode);
  if (address.city) setField(form, "telepules", address.city);

  const countryField = form.querySelector("#megtalalhato_orszag");
  if (countryField && address.country) countryField.value = address.country;

  const megye = inferMegyeFromCity(address.city, address.postalCode);
  if (megye) setField(form, "megye", megye);

  applyContactFromProfile(form, profile);
  ensureLocationVisible(form);
  unlockLocationFields(form);

  const ok = listingAddressComplete(address);
  updateLocationHint(form, { address });
  return { ok, address };
}

function initAdPostalLookup(form) {
  wirePostalCityAutofill(form);
}

export function initAdLocationProfile(form) {
  if (!form || form.dataset.adLocationBound === "1") return;
  form.dataset.adLocationBound = "1";
  initAdPostalLookup(form);

  const sync = () => {
    applyListingAddressFromProfileSync(form);
    applyListingAddressFromProfile(form).catch(() => {});
  };

  window.addEventListener("ad-form-ready", sync);
  window.addEventListener("ad-form-sync-location", sync);
  window.addEventListener("ad-form-layout-refresh", () => {
    window.setTimeout(sync, 0);
    window.setTimeout(sync, 200);
  });
  window.addEventListener("site-auth-ready", sync);
  window.addEventListener("bymy-auth-changed", sync);

  form.querySelector("#email")?.addEventListener("input", (event) => {
    event.currentTarget.dataset.userEdited = "1";
  });

  sync();
}
