export const LISTING_STATUSES = ["mentett", "feladott"];

export function normalizeListingStatus(status) {
  const value = String(status ?? "mentett").trim().toLowerCase();
  return LISTING_STATUSES.includes(value) ? value : "mentett";
}
