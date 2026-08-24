import { resolveVerticalFromFields } from "./listing-vertical.mjs";
import { displayImageUrl } from "./listing-image.mjs";
import { sanitizeListingPlainText } from "./listing-preview.mjs";

export const ADMIN_LISTING_CELL_KEYS = [
  "owner_user_id",
  "hirdetes_vertical",
  "hirdetes_alkategoria",
  "gyartmany",
  "tipus",
];

export function mapListingRowForAdmin(row, cells = []) {
  const form = {};
  for (const cell of cells) {
    if (cell?.field_key) form[cell.field_key] = cell.value;
  }
  const vertical = resolveVerticalFromFields(form.hirdetes_vertical, form.hirdetes_alkategoria);
  let imageUrl = "";
  const foKep = String(row.fo_kep ?? "").trim();
  if (foKep) {
    try {
      imageUrl = displayImageUrl(foKep);
    } catch {
      imageUrl = foKep;
    }
  }
  const ownerRaw = Number(form.owner_user_id);
  return {
    id: row.id,
    title: sanitizeListingPlainText(row.hirdetes_cime) || `Hirdetés #${row.id}`,
    status: row.status,
    gyartmany: String(form.gyartmany ?? ""),
    tipus: String(form.tipus ?? ""),
    vertical,
    subtype: String(form.hirdetes_alkategoria ?? ""),
    ownerUserId: Number.isFinite(ownerRaw) && ownerRaw > 0 ? ownerRaw : null,
    updatedAt: row.updated_at,
    imageUrl,
  };
}

export function filterAdminListings(items, { vertical = null, excludeVertical = null, limit = 150 } = {}) {
  let out = items;
  const want = String(vertical ?? "")
    .trim()
    .toLowerCase();
  const exclude = String(excludeVertical ?? "")
    .trim()
    .toLowerCase();
  if (want === "auto" || want === "teher" || want === "ingatlan") {
    out = out.filter((item) => item.vertical === want);
  } else if (exclude) {
    out = out.filter((item) => item.vertical !== exclude);
  }
  return out.slice(0, limit);
}
