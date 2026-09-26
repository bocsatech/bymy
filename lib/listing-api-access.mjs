import { canManageListing } from "./listing-meta.mjs";
import { listHaImageUrl } from "./listing-image.mjs";

/** Mezők, amik csak tulajdonos / admin / reveal-contact után mennek ki. */
const CONTACT_FORM_KEYS = new Set([
  "telefon",
  "email",
  "email_megjelenik",
  "megtekintesi_cim",
  "iranyitoszam",
]);

export function canViewListingPrivate(user, listing, { isAdmin = false } = {}) {
  if (isAdmin) return true;
  if (!user || !listing) return false;
  return canManageListing(listing, user);
}

function publicAddressLines(addressLines = []) {
  const lines = Array.isArray(addressLines) ? addressLines.map((line) => String(line ?? "").trim()).filter(Boolean) : [];
  if (lines.length <= 1) return lines;
  return lines.slice(1);
}

function listImage(url) {
  const raw = String(url ?? "").trim();
  if (!raw) return "";
  return listHaImageUrl(raw) || raw;
}

export function sanitizeListingListItem(item) {
  if (!item || typeof item !== "object") return item;
  const next = { ...item };
  delete next.user_id;
  delete next.userId;
  delete next.cells;
  if (next.fo_kep) next.fo_kep = listImage(next.fo_kep);
  // Feed: elég a preview + vékony form (felszereltség / leírás a részletes keresőhöz).
  if (next.preview && typeof next.preview === "object") {
    const preview = { ...next.preview };
    if (Array.isArray(preview.imageUrls) && preview.imageUrls.length > 0) {
      preview.imageUrls = preview.imageUrls
        .slice(0, 3)
        .map((url) => listImage(url))
        .filter(Boolean);
    }
    if (preview.imageUrl) preview.imageUrl = listImage(preview.imageUrl);
    else if (preview.imageUrls?.[0]) preview.imageUrl = preview.imageUrls[0];
    if (typeof preview.leiras === "string" && preview.leiras.length > 180) {
      preview.leiras = `${preview.leiras.slice(0, 180)}…`;
    }
    next.preview = preview;
  }
  if (next.form && typeof next.form === "object") {
    const felszereltseg = Array.isArray(next.form.felszereltseg)
      ? next.form.felszereltseg.slice(0, 24)
      : [];
    const leirasRaw = String(next.form.leiras ?? "");
    next.form = {
      felszereltseg,
      leiras: leirasRaw.length > 220 ? `${leirasRaw.slice(0, 220)}…` : leirasRaw,
      gyartmany: next.form.gyartmany ?? "",
      modell: next.form.modell ?? "",
      tipus: next.form.tipus ?? "",
      uzemanyag: next.form.uzemanyag ?? "",
      sebessegvalto: next.form.sebessegvalto ?? "",
      teljesitmeny_le: next.form.teljesitmeny_le ?? "",
      hirdetes_vertical: next.form.hirdetes_vertical ?? "",
      hirdetes_alkategoria: next.form.hirdetes_alkategoria ?? "",
      telepules: next.form.telepules ?? "",
      vetelar: next.form.vetelar ?? "",
      km: next.form.km ?? "",
      villamtoltes: next.form.villamtoltes ?? "",
      zold_rendszam: next.form.zold_rendszam ?? "",
      promo_kiemelt: next.form.promo_kiemelt ?? "",
      promo_top_ajanlat: next.form.promo_top_ajanlat ?? "",
      owner_user_id: next.form.owner_user_id ?? "",
    };
  }
  return next;
}

/** Listacsemepe: csak kártyához + kliensszűrőhöz kellő mezők (nincs leírás / felszereltség). */
export function sanitizeListingTileItem(item) {
  const base = sanitizeListingListItem(item);
  if (!base || typeof base !== "object") return base;
  const preview = base.preview && typeof base.preview === "object" ? { ...base.preview } : {};
  delete preview.leiras;
  if (Array.isArray(preview.imageUrls)) {
    preview.imageUrls = preview.imageUrls.slice(0, 3);
    preview.photoCount = preview.imageUrls.length;
  }
  const formIn = base.form && typeof base.form === "object" ? base.form : {};
  return {
    id: base.id,
    status: base.status,
    updated_at: base.updated_at,
    created_at: base.created_at,
    fo_kep: base.fo_kep || "",
    hirdetes_cime: base.hirdetes_cime,
    vertical: base.vertical || formIn.hirdetes_vertical || "",
    preview,
    form: {
      gyartmany: formIn.gyartmany ?? "",
      modell: formIn.modell ?? "",
      tipus: formIn.tipus ?? "",
      uzemanyag: formIn.uzemanyag ?? "",
      sebessegvalto: formIn.sebessegvalto ?? "",
      teljesitmeny_le: formIn.teljesitmeny_le ?? "",
      hirdetes_vertical: formIn.hirdetes_vertical ?? "",
      hirdetes_alkategoria: formIn.hirdetes_alkategoria ?? "",
      telepules: formIn.telepules ?? "",
      vetelar: formIn.vetelar ?? "",
      km: formIn.km ?? "",
      promo_kiemelt: formIn.promo_kiemelt ?? "",
      promo_top_ajanlat: formIn.promo_top_ajanlat ?? "",
      owner_user_id: formIn.owner_user_id ?? "",
    },
  };
}

export function sanitizeListingList(items, { tile = false } = {}) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => (tile ? sanitizeListingTileItem(item) : sanitizeListingListItem(item)));
}

export function sanitizeListingForPublic(listing) {
  if (!listing || typeof listing !== "object") return listing;
  const next = { ...listing };
  delete next.cells;
  delete next.form;
  delete next.user_id;

  if (next.detail && typeof next.detail === "object") {
    const detail = { ...next.detail };
    const hadPhone = Boolean(String(detail.phone ?? "").trim() || String(detail.phoneMasked ?? "").trim());
    delete detail.phone;
    delete detail.userId;
    detail.hasPhone = hadPhone;
    detail.addressLines = publicAddressLines(detail.addressLines);
    if (!detail.addressLines.length) {
      detail.mapQuery = "";
    }
    next.detail = detail;
  }

  return next;
}

export function applyListingAccessPolicy(listing, { user = null, isAdmin = false } = {}) {
  if (!listing) return listing;
  if (canViewListingPrivate(user, listing, { isAdmin })) return listing;
  return sanitizeListingForPublic(listing);
}

export function stripContactFieldsFromForm(form) {
  if (!form || typeof form !== "object") return {};
  const next = { ...form };
  for (const key of CONTACT_FORM_KEYS) {
    delete next[key];
  }
  return next;
}

export const PUBLIC_PARTNER_PROFILE_FIELDS = [
  "slug",
  "display_name",
  "description",
  "website",
  "email",
  "phone",
  "logo_url",
  "cover_url",
  "contact_person",
  "service_areas",
  "commission",
  "is_verified",
  "is_public",
];

export function sanitizePublicPartnerProfile(profile) {
  if (!profile || typeof profile !== "object") return profile;
  const next = {};
  for (const key of PUBLIC_PARTNER_PROFILE_FIELDS) {
    if (profile[key] !== undefined) next[key] = profile[key];
  }
  return next;
}
