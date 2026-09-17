import { lookupPostalCodeFromSeed, normalizePostalCode } from "./postal-codes.mjs";
import { sellerProfilePhone } from "./listing-detail-seller.mjs";

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
    street: "",
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

function parsePhoneParts(phone) {
  if (!phone) return null;
  const compact = String(phone).replace(/[^\d+]/g, "");
  const match = compact.match(/^(\+36|06)(\d{1,2})(\d{6,8})$/);
  if (!match) return null;
  const orszag = match[1].startsWith("06") ? "+36" : match[1];
  const szam = match[3].replace(/(\d{3})(\d+)/, "$1 $2");
  return { orszag, korzet: match[2], szam };
}

/** Import: magán felhasználónál is utca a profilból (megjelenítéshez). */
export function getImporterListingAddressFromProfile(profile) {
  const p = profile || {};
  if (isBusinessProfile(p)) return getListingAddressFromProfile(p);
  return {
    street: String(p.street || "").trim(),
    postalCode: String(p.postalCode || "")
      .replace(/\D/g, "")
      .slice(0, 4),
    city: String(p.city || "").trim(),
    country: String(p.country || "Magyarország").trim() || "Magyarország",
  };
}

/** HA import: eladói cím és telefon mindig az importáló profiljából. */
export function applyImporterProfileToListingForm(form, profile) {
  if (!form || !profile) return form;

  const addr = getImporterListingAddressFromProfile(profile);
  if (addr.street) form.megtekintesi_cim = addr.street;
  if (addr.postalCode) form.iranyitoszam = addr.postalCode;
  if (addr.city) form.telepules = addr.city;

  const postal = normalizePostalCode(addr.postalCode || form.iranyitoszam);
  const hit = postal ? lookupPostalCodeFromSeed(postal) : null;
  if (hit?.megye) form.megye = hit.megye;

  const phone = sellerProfilePhone(profile);
  if (phone) {
    const parts = parsePhoneParts(phone);
    if (parts) {
      form.telefon1_orszag = parts.orszag;
      form.telefon1_korzet = parts.korzet;
      form.telefon1_szam = parts.szam;
    } else {
      form.telefon1_orszag = "+36";
      form.telefon1_korzet = "";
      form.telefon1_szam = phone;
    }
  }

  return form;
}

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
