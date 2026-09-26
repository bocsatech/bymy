import {
  allowedVerticalsFromProfile,
  companyActivitiesLabels,
  normalizeCompanyActivities,
} from "./company-activities.mjs";
import { resolveVerticalFromFields, resolveListingVertical } from "./listing-vertical.mjs";
import { adminFlagsFromProfile, maxListingsForVertical } from "./user-admin-flags.mjs";

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

function countByVertical(listings = []) {
  const counts = { auto: 0, teher: 0, ingatlan: 0 };
  for (const item of listings) {
    const v = resolveListingVertical(item);
    if (v === "auto" || v === "teher" || v === "ingatlan") counts[v] += 1;
  }
  return counts;
}

/**
 * Kereskedői vertical: először cég tevékenység, utána legacy (első meglévő hirdetés).
 * @returns {{ ok: true } | { ok: false, status: number, error: string, code: string }}
 */
export function assertBusinessVerticalAllowed(user, vertical, existingListings = []) {
  const profile = user?.profile ?? {};
  const allowed = allowedVerticalsFromProfile(profile);

  if (allowed.length > 0) {
    if (!allowed.includes(vertical)) {
      const labels = companyActivitiesLabels(normalizeCompanyActivities(profile.companyActivities));
      return {
        ok: false,
        status: 403,
        code: "VERTICAL_NOT_ALLOWED",
        error: `A cég tevékenysége szerint csak ide adhatsz fel: ${labels.join(", ")}.`,
      };
    }
    return { ok: true };
  }

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
  return { ok: true };
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
  const flags = adminFlagsFromProfile(user?.profile ?? {});
  const override = maxListingsForVertical(flags, vertical);
  const byVertical = countByVertical(existingListings);
  const usedInVertical = byVertical[vertical] || 0;

  if (override != null) {
    if (business) {
      const vertCheck = assertBusinessVerticalAllowed(user, vertical, existingListings);
      if (!vertCheck.ok) return vertCheck;
    }
    if (usedInVertical >= override) {
      const label = VERTICAL_LABEL[vertical] || vertical;
      return {
        ok: false,
        status: 403,
        code: "LISTING_LIMIT",
        error: `Ebben a kategóriában (${label}) maximum ${override} hirdetés adható fel.`,
      };
    }
    return { ok: true, vertical, limit: override, used: usedInVertical, business };
  }

  if (business) {
    const vertCheck = assertBusinessVerticalAllowed(user, vertical, existingListings);
    if (!vertCheck.ok) return vertCheck;

    const multiActivity = allowedVerticalsFromProfile(user?.profile ?? {}).length > 1;
    if (used >= BUSINESS_LISTING_LIMIT) {
      return {
        ok: false,
        status: 403,
        code: "LISTING_LIMIT",
        error: multiActivity
          ? `Kereskedői / céges fiókkal maximum ${BUSINESS_LISTING_LIMIT} hirdetés adható fel.`
          : `Kereskedői / céges fiókkal maximum ${BUSINESS_LISTING_LIMIT} hirdetés adható fel (egy kategóriában).`,
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
  const flags = adminFlagsFromProfile(user?.profile ?? {});
  const byVertical = countByVertical(existingListings);
  const hasOverride = ["auto", "teher", "ingatlan"].some((k) => flags.maxListings?.[k] != null);
  if (hasOverride) {
    let remaining = 0;
    for (const key of ["auto", "teher", "ingatlan"]) {
      const o = flags.maxListings?.[key];
      if (o != null) remaining += Math.max(0, o - (byVertical[key] || 0));
    }
    return remaining;
  }
  const limit = isBusinessAccount(user) ? BUSINESS_LISTING_LIMIT : PRIVATE_LISTING_LIMIT;
  return Math.max(0, limit - used);
}
