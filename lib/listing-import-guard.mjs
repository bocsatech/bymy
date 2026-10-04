/**
 * Autóimport: nincs fiók- vagy HA-id zárolás.
 * Mindenki a saját hirdetései közé másol; más fiókja érintetlen.
 */
export function assertCanImportExistingListing(_existing, _user) {
  return { ok: true };
}
