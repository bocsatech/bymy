/** Főmenü hirdetésszám — ugyanaz a bontás, mint az Autó / Teherautó oldal. */

import { resolveListingVertical } from "./listing-vertical.mjs";

export function listingNavKey(item) {
  return resolveListingVertical(item);
}

export function navCountsFromListings(listings) {
  const counts = { auto: 0, teher: 0, ingatlan: 0 };
  for (const item of listings ?? []) {
    const key = listingNavKey(item);
    if (key in counts) counts[key] += 1;
    else counts.auto += 1;
  }
  return counts;
}
