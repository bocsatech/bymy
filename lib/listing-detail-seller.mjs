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

function collapseSpaces(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normAddrKey(value) {
  return collapseSpaces(value).toLowerCase();
}

/** Utca mezőbe gyakran irsz+település kerül — ne jelenjen meg kétszer. */
function isPostalCityOnlyStreet(street, postal, city) {
  const st = normAddrKey(street);
  if (!st) return true;
  const pc = normAddrKey(postal);
  const cy = normAddrKey(city);
  if (pc && cy && (st === `${pc} ${cy}` || st === `${pc}${cy}`)) return true;
  if (cy && (st === cy || st === `${pc} ${cy}`.trim())) return true;
  if (pc && st === pc) return true;
  return false;
}

export function companyContactAddressLines(profile = {}) {
  const addr = getListingAddressFromProfile(profile);
  const postal = collapseSpaces(addr.postalCode);
  const city = collapseSpaces(addr.city);
  let street = collapseSpaces(addr.street);

  const postalNorm = normalizePostalCode(postal);
  const hit = postalNorm ? lookupPostalCodeFromSeed(postalNorm) : null;
  let megye = hit?.megye ? collapseSpaces(hit.megye) : "";
  if (megye && city && normAddrKey(megye) === normAddrKey(city)) megye = "";

  if (isPostalCityOnlyStreet(street, postal, city)) street = "";

  const locationParts = [postal, city].filter(Boolean);
  if (megye) locationParts.push(megye);
  const locationLine = locationParts.join(" ");
  const lines = [];

  if (street) lines.push(street);

  if (locationLine) {
    const locKey = normAddrKey(locationLine);
    const streetKey = normAddrKey(street);
    const dup =
      streetKey &&
      (locKey === streetKey ||
        locKey.startsWith(`${streetKey} `) ||
        streetKey.startsWith(`${postal} ${city}`.trim().toLowerCase()));
    if (!dup) lines.push(locationLine);
  }

  const country = collapseSpaces(addr.country);
  if (country && country !== "Magyarország" && !lines.length) lines.push(country);

  return lines;
}

function companyContactMapQuery(profile = {}) {
  const lines = companyContactAddressLines(profile);
  if (lines.length) return lines.join(", ");
  const addr = getListingAddressFromProfile(profile);
  const postal = normalizePostalCode(addr.postalCode);
  const hit = postal ? lookupPostalCodeFromSeed(postal) : null;
  const megye = hit?.megye ? String(hit.megye).trim() : "";
  return [addr.street, addr.postalCode, addr.city, megye, addr.country || "Magyarország"]
    .map((v) => collapseSpaces(v))
    .filter(Boolean)
    .join(", ");
}

/** Céges/dealer fiók: megjelenítés mindig a profil Cégadatokból (nem a hirdetés teszt mezőiből). */
export function mergeSellerCompanyContact(detail, profile) {
  if (!detail || !isCompanyAccount(profile)) {
    return mergeSellerProfilePhone(detail, profile);
  }
  let next = { ...detail, sellerIsCompany: true };
  const company = String(profile.company || "").trim();
  if (company) next.sellerName = company;

  next.addressLines = companyContactAddressLines(profile);
  next.mapQuery = next.addressLines.length ? companyContactMapQuery(profile) : "";

  const phone = sellerProfilePhone(profile);
  if (phone) {
    next.phone = phone;
    next.phoneMasked = maskPhone(phone);
  } else {
    next = mergeSellerProfilePhone(next, profile);
  }
  return next;
}

function profilePhotoUrl(profile = {}) {
  return String(profile.companyLogoDataUrl || profile.avatarDataUrl || "").trim();
}

/** Nyilvános kereskedő-kártya a „Több ettől a hirdetőtől” oldalhoz. */
export function buildSellerInventoryContact(user) {
  if (!user) return null;
  const profile = user.profile || {};
  const photo = profilePhotoUrl(profile);
  const company = isCompanyAccount(profile);
  const sellerName = profileDisplayName(user) || "Hirdető";

  const staff = [];
  const sp1 = String(profile.salespersonName || "").trim();
  const sp2 = String(profile.salespersonName2 || "").trim();
  if (sp1) staff.push({ name: sp1, photoUrl: photo });
  if (sp2) staff.push({ name: sp2, photoUrl: photo });
  if (!staff.length) {
    const personal = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
    const fallback = company
      ? sellerName
      : personal || String(user.displayName || "").trim() || sellerName;
    if (fallback) staff.push({ name: fallback, photoUrl: photo });
  }

  const phones = [];
  if (company) {
    const p1 = String(profile.companyPhone || profile.phone || "").trim();
    const p2 = String(profile.companyPhone2 || "").trim();
    if (p1) phones.push(p1);
    if (p2 && p2 !== p1) phones.push(p2);
  } else {
    const p = String(profile.phone || "").trim();
    if (p) phones.push(p);
  }

  const addressLines = company
    ? companyContactAddressLines(profile)
    : companyContactAddressLines({
        ...profile,
        companyStreet: profile.street || profile.companyStreet,
        companyPostalCode: profile.postalCode || profile.companyPostalCode,
        companyCity: profile.city || profile.companyCity,
        companyCountry: profile.country || profile.companyCountry || "Magyarország",
      });
  const mapQuery = addressLines.length
    ? addressLines.join(", ")
    : companyContactMapQuery(company ? profile : {
        ...profile,
        companyStreet: profile.street || profile.companyStreet,
        companyPostalCode: profile.postalCode || profile.companyPostalCode,
        companyCity: profile.city || profile.companyCity,
        companyCountry: profile.country || profile.companyCountry || "Magyarország",
      });

  return {
    sellerName,
    sellerIsCompany: company,
    sellerAvatarUrl: photo,
    staff,
    phones,
    phonesMasked: phones.map((p) => maskPhone(p)).filter(Boolean),
    hasPhone: phones.length > 0,
    addressLines,
    mapQuery,
  };
}

/** Nyilvános válasz: teljes telefonszám nélkül; nagy data: képeket méretkorláttal engedjük. */
export function publicSellerInventoryContact(contact) {
  if (!contact) return null;
  const { phones, ...rest } = contact;
  const avatar = publicImageUrl(rest.sellerAvatarUrl);
  const staff = Array.isArray(rest.staff)
    ? rest.staff.map((person) => ({
        name: String(person?.name || "").trim(),
        photoUrl: publicImageUrl(person?.photoUrl),
      })).filter((person) => person.name)
    : [];
  return {
    ...rest,
    sellerAvatarUrl: avatar,
    staff,
  };
}

/** Max ~180 KB base64 — profil/logo a seller-contact válaszban. */
const PUBLIC_DATA_IMAGE_MAX = 250_000;

function publicImageUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^data:image\//i.test(raw) && raw.length <= PUBLIC_DATA_IMAGE_MAX) return raw;
  return "";
}

export async function getSellerInventoryContactForUserId(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const user = await getUserById(id);
  if (!user) return null;
  return buildSellerInventoryContact(user);
}

export async function attachSellerProfile(detail, userId) {
  const id = Number(userId);
  if (!detail || !Number.isFinite(id) || id <= 0) return detail;
  try {
    const user = await getUserById(id);
    if (!user) return detail;
    const profile = user.profile || {};
    const avatar = profilePhotoUrl(profile);
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
