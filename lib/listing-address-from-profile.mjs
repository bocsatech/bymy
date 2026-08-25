/**
 * Hirdetés cím — Beállítások (profil) alapján, ha az import / űrlap üresen hagyta.
 */
import { lookupPostalCodeFromSeed, normalizePostalCode } from "./postal-codes.mjs";

function isBusinessProfile(profile) {
  const type = String(profile?.accountType || "").trim();
  return type === "business" || type === "dealer";
}

export function getListingAddressFromProfile(profile) {
  const p = profile || {};
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

function blank(value) {
  return !String(value ?? "").trim();
}

/**
 * Ha nincs megtekintési cím (utca), a profil teljes címét másoljuk a hirdetésre.
 * Részleges HA település ne keveredjen a profil utcával.
 */
export function fillEmptyListingAddressFromProfile(form, profile) {
  if (!form || !profile) return form;
  if (!blank(form.megtekintesi_cim)) return form;

  const addr = getListingAddressFromProfile(profile);
  if (!addr.street && !addr.city && !addr.postalCode) return form;

  if (addr.street) form.megtekintesi_cim = addr.street;
  if (addr.postalCode) form.iranyitoszam = addr.postalCode;
  if (addr.city) form.telepules = addr.city;

  if (blank(form.megye)) {
    const postal = normalizePostalCode(addr.postalCode || form.iranyitoszam);
    const hit = postal ? lookupPostalCodeFromSeed(postal) : null;
    if (hit?.megye) form.megye = hit.megye;
  }

  return form;
}
