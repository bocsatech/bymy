import { canManageListing } from "./listing-meta.mjs";

/** Mezők, amik csak tulajdonos / admin / reveal-contact után mennek ki. */
const CONTACT_FORM_KEYS = new Set([
  "telefon",
  "email",
  "email_megjelenik",
  "megtekintesi_cim",
  "iranyitoszam",
]);

export function canViewListingPrivate(user, listing, { isAdmin = false } = {}) {
  if (isAdmin) return true;
  if (!user || !listing) return false;
  return canManageListing(listing, user);
}

function publicAddressLines(addressLines = []) {
  const lines = Array.isArray(addressLines) ? addressLines.map((line) => String(line ?? "").trim()).filter(Boolean) : [];
  if (lines.length <= 1) return lines;
  return lines.slice(1);
}

export function sanitizeListingListItem(item) {
  if (!item || typeof item !== "object") return item;
  const next = { ...item };
  delete next.user_id;
  delete next.userId;
  return next;
}

export function sanitizeListingList(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => sanitizeListingListItem(item));
}

export function sanitizeListingForPublic(listing) {
  if (!listing || typeof listing !== "object") return listing;
  const next = { ...listing };
  delete next.cells;
  delete next.form;
  delete next.user_id;

  if (next.detail && typeof next.detail === "object") {
    const detail = { ...next.detail };
    const hadPhone = Boolean(String(detail.phone ?? "").trim() || String(detail.phoneMasked ?? "").trim());
    delete detail.phone;
    delete detail.userId;
    detail.hasPhone = hadPhone;
    detail.addressLines = publicAddressLines(detail.addressLines);
    if (!detail.addressLines.length) {
      detail.mapQuery = "";
    }
    next.detail = detail;
  }

  return next;
}

export function applyListingAccessPolicy(listing, { user = null, isAdmin = false } = {}) {
  if (!listing) return listing;
  if (canViewListingPrivate(user, listing, { isAdmin })) return listing;
  return sanitizeListingForPublic(listing);
}

export function stripContactFieldsFromForm(form) {
  if (!form || typeof form !== "object") return {};
  const next = { ...form };
  for (const key of CONTACT_FORM_KEYS) {
    delete next[key];
  }
  return next;
}

export const PUBLIC_PARTNER_PROFILE_FIELDS = [
  "slug",
  "display_name",
  "description",
  "website",
  "phone",
  "logo_url",
  "cover_url",
  "contact_person",
  "service_areas",
  "commission",
  "is_verified",
  "is_public",
];

export function sanitizePublicPartnerProfile(profile) {
  if (!profile || typeof profile !== "object") return profile;
  const next = {};
  for (const key of PUBLIC_PARTNER_PROFILE_FIELDS) {
    if (profile[key] !== undefined) next[key] = profile[key];
  }
  return next;
}
