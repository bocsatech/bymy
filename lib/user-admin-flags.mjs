/** Admin által állítható felhasználói jogosultságok (profile_json.adminFlags). */

export const ADMIN_FLAG_VERTICALS = ["auto", "teher", "ingatlan"];

const VERTICAL_ALIASES = {
  auto: "auto",
  teher: "teher",
  teherauto: "teher",
  ingatlan: "ingatlan",
};

export function normalizeAdminFlagVertical(value) {
  const key = String(value ?? "")
    .trim()
    .toLowerCase();
  return VERTICAL_ALIASES[key] || "";
}

function parseMaxInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/\D/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(Math.floor(n), 9999);
}

/**
 * @returns {{
 *   listingBoost: boolean,
 *   maxListings: { auto: number|null, teher: number|null, ingatlan: number|null },
 *   canPromoKiemelt: boolean,
 *   canPromoTop: boolean,
 *   canPhotoSablon: boolean,
 * }}
 */
export function normalizeAdminFlags(raw) {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? raw
      : raw?.adminFlags && typeof raw.adminFlags === "object"
        ? raw.adminFlags
        : {};
  const maxRaw = src.maxListings && typeof src.maxListings === "object" ? src.maxListings : {};
  return {
    listingBoost: src.listingBoost === true,
    maxListings: {
      auto: parseMaxInt(maxRaw.auto ?? maxRaw.autó),
      teher: parseMaxInt(maxRaw.teher ?? maxRaw.teherauto),
      ingatlan: parseMaxInt(maxRaw.ingatlan),
    },
    // Alapból be — admin kapcsolhatja ki az ingyenes időszak után.
    canPromoKiemelt: src.canPromoKiemelt !== false,
    canPromoTop: src.canPromoTop !== false,
    canPhotoSablon: src.canPhotoSablon !== false,
  };
}

export function adminFlagsFromProfile(profile) {
  return normalizeAdminFlags(profile?.adminFlags ?? profile);
}

export function mergeAdminFlagsPatch(existingProfile = {}, patch = {}) {
  const current = adminFlagsFromProfile(existingProfile);
  const next = {
    ...current,
    maxListings: { ...current.maxListings },
  };
  if (patch.listingBoost !== undefined) next.listingBoost = patch.listingBoost === true;
  if (patch.canPromoKiemelt !== undefined) next.canPromoKiemelt = patch.canPromoKiemelt === true;
  if (patch.canPromoTop !== undefined) next.canPromoTop = patch.canPromoTop === true;
  if (patch.canPhotoSablon !== undefined) next.canPhotoSablon = patch.canPhotoSablon === true;
  if (patch.maxListings && typeof patch.maxListings === "object") {
    for (const key of ADMIN_FLAG_VERTICALS) {
      if (patch.maxListings[key] !== undefined) {
        next.maxListings[key] = parseMaxInt(patch.maxListings[key]);
      }
    }
    if (patch.maxListings.teherauto !== undefined) {
      next.maxListings.teher = parseMaxInt(patch.maxListings.teherauto);
    }
  }
  return next;
}

export function maxListingsForVertical(flags, vertical) {
  const v = normalizeAdminFlagVertical(vertical);
  if (!v) return null;
  const n = flags?.maxListings?.[v];
  return Number.isFinite(n) && n >= 0 ? n : null;
}
