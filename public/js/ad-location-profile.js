import { getProfile } from "./site-auth.js";
import { inferMegyeFromCity } from "./county-infer.js";

export function getListingAddressFromProfile(profile = null) {
  const p = profile ?? getProfile();
  const isBusiness = p.accountType === "business" || p.accountType === "dealer";
  if (isBusiness) {
    return {
      street: String(p.companyStreet || "").trim(),
      postalCode: String(p.companyPostalCode || "")
        .replace(/\D/g, "")
        .slice(0, 4),
      city: String(p.companyCity || "").trim(),
      country: String(p.companyCountry || "Magyarország").trim() || "Magyarország",
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

export async function applyListingAddressFromProfile(form, profile = null) {
  if (!form) return { ok: false, reason: "missing-form" };

  const result = applyListingAddressFromProfileSync(form, profile);
  const megye = await lookupMegye(result.address.postalCode, result.address.city);
  if (megye) setField(form, "megye", megye);

  updateLocationHint(form, result);
  return { ...result, megye: megye || inferMegyeFromCity(result.address.city, result.address.postalCode) };
}

function updateLocationHint(form, result) {
  if (!listingAddressComplete(result.address)) {
    setHint(
      form,
      "Add meg a címed a Beállításokban (Személyes adatok vagy Cégadatok), majd térj vissza ide.",
      { isError: true }
    );
    return;
  }
  const megye = String(form.elements.namedItem("megye")?.value ?? "").trim();
  if (!megye) {
    setHint(
      form,
      "A vármegye automatikusan kitöltődik, ha az irányítószám és település helyes a Beállításokban.",
      { isError: false }
    );
    return;
  }
  setHint(
    form,
    "A Beállításokban megadott cím — módosításhoz nyisd meg a Beállítások → Személyes adatok / Cégadatok részt.",
    { isError: false }
  );
}

/** Szinkron kitöltés — validáció és mentés előtt. */
export function applyListingAddressFromProfileSync(form, profile = null) {
  if (!form) return { ok: false, reason: "missing-form", address: null };

  const address = getListingAddressFromProfile(profile);
  setField(form, "megtekintesi_cim", address.street);
  setField(form, "iranyitoszam", address.postalCode);
  setField(form, "telepules", address.city);

  const countryField = form.querySelector("#megtalalhato_orszag");
  if (countryField) countryField.value = address.country;

  const megye = inferMegyeFromCity(address.city, address.postalCode);
  setField(form, "megye", megye);

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
  window.addEventListener("site-auth-ready", sync);
  sync();
}
