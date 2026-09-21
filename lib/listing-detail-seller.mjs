import { getUserById } from "./web-users-store.mjs";
import { maskPhone } from "./listing-detail-view.mjs";
import { getListingAddressFromProfile } from "./listing-address-from-profile.mjs";
import { lookupPostalCodeFromSeed, normalizePostalCode } from "./postal-codes.mjs";

function isCompanyAccount(profile) {
  const type = String(profile?.accountType || "").toLowerCase();
  return type === "business" || type === "dealer";
}

function profileDisplayName(user) {
  const profile = user?.profile || {};
  if (isCompanyAccount(profile)) {
    const company = String(profile.company || "").trim();
    if (company) return company;
  }
  const named = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  if (named) return named;
  const company = String(profile.company || "").trim();
  if (company) return company;
  return String(user?.displayName || "").trim();
}

export function sellerProfilePhone(profile = {}) {
  if (isCompanyAccount(profile)) {
    return String(profile.companyPhone || profile.phone || "").trim();
  }
  return String(profile.phone || "").trim();
}

export function mergeSellerProfilePhone(detail, profile) {
  if (!detail || String(detail.phone ?? "").trim()) return detail;
  const phone = sellerProfilePhone(profile);
  if (!phone) return detail;
  return {
    ...detail,
    phone,
    phoneMasked: maskPhone(phone),
  };
}

export function companyContactAddressLines(profile = {}) {
  const addr = getListingAddressFromProfile(profile);
  const lines = [];
  if (addr.street) lines.push(addr.street);
  const cityLine = [addr.postalCode, addr.city].filter(Boolean).join(" ");
  if (cityLine) lines.push(cityLine);
  if (addr.country && addr.country !== "Magyarország") lines.push(addr.country);
  return lines;
}

function companyContactMapQuery(profile = {}) {
  const addr = getListingAddressFromProfile(profile);
  const postal = normalizePostalCode(addr.postalCode);
  const hit = postal ? lookupPostalCodeFromSeed(postal) : null;
  const megye = hit?.megye ? String(hit.megye).trim() : "";
  return [addr.city, megye, addr.country || "Magyarország"].filter(Boolean).join(", ");
}

/** Céges/dealer fiók: megjelenítés mindig a profil Cégadatokból (nem a hirdetés teszt mezőiből). */
export function mergeSellerCompanyContact(detail, profile) {
  if (!detail || !isCompanyAccount(profile)) {
    return mergeSellerProfilePhone(detail, profile);
  }
  let next = { ...detail, sellerIsCompany: true };
  const company = String(profile.company || "").trim();
  if (company) next.sellerName = company;

  const lines = companyContactAddressLines(profile);
  if (lines.length) {
    next.addressLines = lines;
    next.mapQuery = companyContactMapQuery(profile);
  }

  const phone = sellerProfilePhone(profile);
  if (phone) {
    next.phone = phone;
    next.phoneMasked = maskPhone(phone);
  } else {
    next = mergeSellerProfilePhone(next, profile);
  }
  return next;
}

export async function attachSellerProfile(detail, userId) {
  const id = Number(userId);
  if (!detail || !Number.isFinite(id) || id <= 0) return detail;
  try {
    const user = await getUserById(id);
    if (!user) return detail;
    const profile = user.profile || {};
    const avatar = String(
      profile.companyLogoDataUrl || profile.avatarDataUrl || ""
    ).trim();
    const name = profileDisplayName(user);
    const companyAccount = isCompanyAccount(profile);
    const withSeller = {
      ...detail,
      sellerAvatarUrl: avatar || detail.sellerAvatarUrl || "",
      sellerIsCompany: companyAccount,
      sellerName: companyAccount
        ? name || detail.sellerName
        : detail.sellerName && detail.sellerName !== "Eladó"
          ? detail.sellerName
          : name || detail.sellerName,
    };
    return mergeSellerCompanyContact(withSeller, profile);
  } catch {
    return detail;
  }
}
