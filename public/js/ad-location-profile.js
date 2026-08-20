import { getAuthUser, getProfile, loadProfileFromServer } from "./site-auth.js";
import { inferMegyeFromCity } from "./county-infer.js";

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
    /* ignore */
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

/** Címmezők mindig szerkeszthetők (profilból előtöltve). */
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

/** E-mail a cég / fiók profilból (ha a mező üres vagy még nem szerkesztett). */
export function applyContactFromProfile(form, profile = null) {
  if (!form) return;
  const p = profile ?? getProfile();
  const emailField = form.elements.namedItem("email");
  if (!emailField || emailField instanceof RadioNodeList) return;
  if (emailField.dataset.userEdited === "1" && String(emailField.value || "").trim()) return;
  const fromCompany = isBusinessProfile(p)
    ? String(p.companyEmail || p.companyEmail2 || "").trim()
    : "";
  const fromUser = String(getAuthUser()?.email || p.email || "").trim();
  const next = fromCompany || fromUser;
  if (next) emailField.value = next;
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

/** Szinkron kitöltés — validáció és mentés előtt. */
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

export function initAdLocationProfile(form) {
  if (!form || form.dataset.adLocationBound === "1") return;
  form.dataset.adLocationBound = "1";

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
