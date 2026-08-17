export const PROTECTED_CELL_KEYS = ["fotok", "owner_user_id", "views_web", "views_app"];

export function listingStatsFromForm(form = {}, row = {}) {
  const web = Math.max(0, Number(row.views_web ?? form.views_web) || 0);
  const app = Math.max(0, Number(row.views_app ?? form.views_app) || 0);
  const owner = Number(row.user_id ?? form.owner_user_id);
  return {
    user_id: Number.isFinite(owner) && owner > 0 ? owner : null,
    views_web: web,
    views_app: app,
    views: { web, app, total: web + app },
  };
}

export function mergeProtectedCells(newCells, existingCells) {
  const incoming = new Map((newCells ?? []).map((cell) => [cell.field_key, cell]));
  const existing = new Map((existingCells ?? []).map((cell) => [cell.field_key, cell]));
  const next = (Array.isArray(newCells) ? newCells : []).filter(
    (cell) => !PROTECTED_CELL_KEYS.includes(cell.field_key)
  );
  const have = new Set(next.map((cell) => cell.field_key));

  for (const key of PROTECTED_CELL_KEYS) {
    const fromNew = incoming.get(key);
    const fromOld = existing.get(key);
    let chosen = fromOld || fromNew;
    if (key === "fotok") {
      const newVal = String(fromNew?.value ?? "").trim();
      chosen = newVal ? fromNew : fromOld || fromNew;
    }
    if (chosen && !have.has(key)) {
      next.push(chosen);
      have.add(key);
    }
  }
  return next;
}

export function ownerCell(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    field_key: "owner_user_id",
    label: "Tulajdonos",
    value: String(id),
    step: 9,
  };
}

export function canManageListing(listing, user) {
  if (!user?.id) return false;
  const owner = Number(listing?.user_id ?? listing?.form?.owner_user_id);
  if (!Number.isFinite(owner) || owner <= 0) return false;
  return owner === Number(user.id);
}
