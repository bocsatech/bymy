/** Főmenü hirdetésszám — ugyanaz a bontás, mint az Autó / Teherautó oldal. */

export function listingNavKey(item) {
  const vertical = String(
    item?.preview?.filter?.hirdetes_vertical ?? item?.form?.hirdetes_vertical ?? ""
  )
    .trim()
    .toLowerCase();
  if (vertical === "teher") return "teher";
  if (vertical === "ingatlan") return "ingatlan";
  return "auto";
}

export function navCountsFromListings(listings) {
  const counts = { auto: 0, teher: 0, ingatlan: 0 };
  for (const item of listings ?? []) {
    counts[listingNavKey(item)] += 1;
  }
  return counts;
}
