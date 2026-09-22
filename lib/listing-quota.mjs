import { resolveVerticalFromFields, resolveListingVertical } from "./listing-vertical.mjs";

export const PRIVATE_LISTING_LIMIT = 2;
export const BUSINESS_LISTING_LIMIT = 50;

const VERTICAL_LABEL = {
  auto: "autó",
  teher: "teherautó",
  ingatlan: "ingatlan",
};

export function normalizeAccountType(value) {
  const t = String(value ?? "")
    .trim()
    .toLowerCase();
  if (t === "business" || t === "dealer") return "business";
  return "private";
}

export function isBusinessAccount(user) {
  const raw = user?.profile?.accountType ?? user?.accountType ?? "";
  return normalizeAccountType(raw) === "business";
}

export function lockedVerticalFromListings(listings = []) {
  for (const item of listings) {
    const v = resolveListingVertical(item);
    if (v === "auto" || v === "teher" || v === "ingatlan") return v;
  }
  return "";
}

export function verticalFromForm(formData = {}) {
  return resolveVerticalFromFields(
    formData.hirdetes_vertical,
    formData.hirdetes_alkategoria || formData.jarmu_kategoria
  );
}

/**
 * Új hirdetés feladás előtt. Update (listingId) esetén ne hívd.
 * @returns {{ ok: true, vertical: string, limit: number, used: number } | { ok: false, status: number, error: string, code?: string }}
 */
export function assertCanCreateListing({ user, formData, existingListings = [] } = {}) {
  if (!user?.id) {
    return {
      ok: false,
      status: 401,
      code: "AUTH_REQUIRED",
      error: "Csak regisztrált felhasználók adhatnak fel hirdetést.",
    };
  }

  const used = Array.isArray(existingListings) ? existingListings.length : 0;
  const vertical = verticalFromForm(formData || {});
  const business = isBusinessAccount(user);

  if (business) {
    const locked = lockedVerticalFromListings(existingListings);
    if (locked && locked !== vertical) {
      const label = VERTICAL_LABEL[locked] || locked;
      return {
        ok: false,
        status: 403,
        code: "VERTICAL_LOCKED",
        error: `Kereskedői / céges fiókkal csak egy kategóriába adhatsz fel hirdetést. Nálad ez: ${label}.`,
      };
    }
    if (used >= BUSINESS_LISTING_LIMIT) {
      return {
        ok: false,
        status: 403,
        code: "LISTING_LIMIT",
        error: `Kereskedői / céges fiókkal maximum ${BUSINESS_LISTING_LIMIT} hirdetés adható fel (egy kategóriában).`,
      };
    }
    return { ok: true, vertical, limit: BUSINESS_LISTING_LIMIT, used, business: true };
  }

  if (used >= PRIVATE_LISTING_LIMIT) {
    return {
      ok: false,
      status: 403,
      code: "LISTING_LIMIT",
      error: `Magánfelhasználóként maximum ${PRIVATE_LISTING_LIMIT} hirdetés adható fel (összes kategória együtt).`,
    };
  }
  return { ok: true, vertical, limit: PRIVATE_LISTING_LIMIT, used, business: false };
}

export function remainingListingSlots({ user, existingListings = [] } = {}) {
  const used = Array.isArray(existingListings) ? existingListings.length : 0;
  const limit = isBusinessAccount(user) ? BUSINESS_LISTING_LIMIT : PRIVATE_LISTING_LIMIT;
  return Math.max(0, limit - used);
}
