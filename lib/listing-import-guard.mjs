import { canManageListing } from "./listing-meta.mjs";

/**
 * Meglévő HA-duplikátum frissítése: csak tulajdonos (vagy még nincs owner → első import).
 */
export function assertCanImportExistingListing(existing, user) {
  if (!existing?.id) return { ok: true };
  const owner = Number(existing?.user_id ?? existing?.form?.owner_user_id);
  if (!Number.isFinite(owner) || owner <= 0) return { ok: true };
  if (canManageListing(existing, user)) return { ok: true };
  return {
    ok: false,
    message: "Ez a hasznaltauto.hu hirdetés már más Bymy fiókhoz tartozik — frissítés kihagyva.",
  };
}
