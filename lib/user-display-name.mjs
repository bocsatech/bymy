/** Megjelenítendő név: céges fióknál a cégnév, ne az e-mail local-part. */

function isCompanyAccount(profile) {
  const type = String(profile?.accountType || "").toLowerCase();
  return type === "business" || type === "dealer";
}

/**
 * @param {{ displayName?: string, email?: string, profile?: object } | null | undefined} user
 * @returns {string}
 */
export function resolveUserDisplayName(user) {
  if (!user) return "";
  const profile = user.profile || {};
  if (isCompanyAccount(profile)) {
    const company = String(profile.company || "").trim();
    if (company) return company;
    const listing = String(profile.companyListingName || "").trim();
    if (listing) return listing;
  }
  const named = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  if (named) return named;
  const company = String(profile.company || "").trim();
  if (company) return company;
  const stored = String(user.displayName || "").trim();
  if (stored) return stored;
  const email = String(user.email || "").trim();
  if (!email) return "";
  const local = email.split("@")[0] || email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/** Mentéskor: display_name oszlop értéke. */
export function resolveStoredDisplayName(profile, fallbackDisplayName = "") {
  const next = profile || {};
  if (isCompanyAccount(next)) {
    const company = String(next.company || "").trim();
    if (company) return company;
    const listing = String(next.companyListingName || "").trim();
    if (listing) return listing;
  }
  return (
    [next.firstName, next.lastName].filter(Boolean).join(" ").trim() ||
    String(next.company || "").trim() ||
    String(fallbackDisplayName || "").trim()
  );
}
