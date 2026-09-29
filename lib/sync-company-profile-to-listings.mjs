/**
 * Céges profil → meglévő (futó) hirdetések cellái.
 * Partneri / admin mentés után hívandó.
 */
import { listListingsByOwner, patchListingFormFields } from "./db-store.mjs";
import {
  applyImporterProfileToListingForm,
  getListingAddressFromProfile,
} from "./listing-address-from-profile.mjs";

function isCompanyAccount(profile) {
  const type = String(profile?.accountType || "").toLowerCase();
  return type === "business" || type === "dealer";
}

function parsePhoneParts(phone) {
  if (!phone) return null;
  let compact = String(phone).replace(/[^\d+]/g, "");
  if (/^\+?06\d/.test(compact)) {
    compact = `+36${compact.replace(/^\+?06/, "")}`;
  }
  const known = ["+36", "+43", "+49", "+421", "+40", "+381", "+385", "+386", "+420", "+48", "+39"];
  for (const code of known) {
    if (!compact.startsWith(code)) continue;
    const rest = compact.slice(code.length);
    if (rest.length < 6) continue;
    let korzetLen = 2;
    if (code === "+36" && rest.startsWith("1") && rest.length >= 7) korzetLen = 1;
    else if (rest.length >= 10) korzetLen = 3;
    const korzet = rest.slice(0, Math.min(korzetLen, Math.max(1, rest.length - 5)));
    const szam = rest.slice(korzet.length);
    if (!korzet || !szam) continue;
    return { orszag: code, korzet, szam };
  }
  const match = compact.match(/^(\+\d{1,3})(\d{1,3})(\d{5,10})$/);
  if (!match) return null;
  return { orszag: match[1], korzet: match[2], szam: match[3] };
}

function applyPhoneSlot(fields, prefix, phone) {
  const raw = String(phone || "").trim();
  if (!raw) {
    fields[`${prefix}_orszag`] = "";
    fields[`${prefix}_korzet`] = "";
    fields[`${prefix}_szam`] = "";
    return;
  }
  const parts = parsePhoneParts(raw);
  if (parts) {
    fields[`${prefix}_orszag`] = parts.orszag;
    fields[`${prefix}_korzet`] = parts.korzet;
    fields[`${prefix}_szam`] = parts.szam;
  } else {
    fields[`${prefix}_orszag`] = "+36";
    fields[`${prefix}_korzet`] = "";
    fields[`${prefix}_szam`] = raw;
  }
}

/** Profil → listing_cells patch (felülírás céges fióknál). */
export function companyContactFieldsForListingForm(profile) {
  if (!isCompanyAccount(profile)) return null;
  const form = {};
  applyImporterProfileToListingForm(form, profile);

  const listingName =
    String(profile.companyListingName || "").trim() || String(profile.company || "").trim();
  if (listingName) {
    form.company = listingName;
    form.cegnev = listingName;
    form.hirdeto_nev = listingName;
  }

  const addr = getListingAddressFromProfile(profile);
  if (addr.street) form.megtekintesi_cim = addr.street;
  if (addr.postalCode) form.iranyitoszam = addr.postalCode;
  if (addr.city) form.telepules = addr.city;

  applyPhoneSlot(form, "telefon1", profile.companyPhone || profile.phone);
  applyPhoneSlot(form, "telefon2", profile.companyPhone2);
  applyPhoneSlot(form, "telefon3", profile.companyPhone3);

  const email = String(profile.companyEmail || "").trim();
  if (email) form.email = email;

  const sp1 = String(profile.salespersonName || "").trim();
  const sp2 = String(profile.salespersonName2 || "").trim();
  if (sp1) form.ertekesito_neve = sp1;
  if (sp2) form.ertekesito_neve_2 = sp2;

  return form;
}

/**
 * Összes tulajdonosi hirdetés celláinak frissítése a cég profilból.
 * Nem dob hibát a hívóra — részleges kudarcot logol.
 */
export async function syncCompanyContactToOwnerListings(userId, profile) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return { ok: false, updated: 0, reason: "bad-user" };
  if (!isCompanyAccount(profile)) return { ok: true, updated: 0, reason: "not-company" };

  const fields = companyContactFieldsForListingForm(profile);
  if (!fields || !Object.keys(fields).length) {
    return { ok: true, updated: 0, reason: "empty-fields" };
  }

  let listings = [];
  try {
    listings = await listListingsByOwner({ userId: uid, limit: 500, status: null });
  } catch (error) {
    console.warn("Cégadatok→hirdetések lista:", error?.message || error);
    return { ok: false, updated: 0, reason: "list-failed" };
  }

  const ids = (listings || [])
    .map((row) => Number(row?.id))
    .filter((id) => Number.isFinite(id) && id > 0);

  const errors = [];
  let updated = 0;
  const concurrency = 6;
  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map((id) => patchListingFormFields(id, fields))
    );
    results.forEach((result, idx) => {
      const id = batch[idx];
      if (result.status === "fulfilled") {
        updated += 1;
        return;
      }
      const message = String(result.reason?.message || result.reason || "hiba");
      errors.push({ id, message });
      console.warn(`Cégadatok→hirdetés #${id}:`, message);
    });
  }

  return { ok: errors.length === 0, updated, total: ids.length, errors };
}
