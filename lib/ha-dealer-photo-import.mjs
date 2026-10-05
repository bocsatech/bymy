import { extractListingIdFromUrl, publicListingUrlFromId } from "./links.mjs";
import {
  deleteListing,
  findOwnerListingByHaId,
  getListing,
  listMyListings,
  saveListing,
  updateListingFoKep,
} from "./db-store.mjs";
import { buildFormFromPage, MAX_IMPORT_BATCH, pageFromPublicUrl } from "./ha-import-save.mjs";
import { applyImporterProfileToListingForm } from "./listing-address-from-profile.mjs";
import { getUserById } from "./web-users-store.mjs";
import { upgradeHaImageUrl, isHaThumbImageUrl } from "./listing-image.mjs";
import { normalizeImportedLeiras } from "./ha-description-parse.mjs";
import { enrichPageFromGyorsnezetHtml } from "./ha-gyorsnezet-enrich.mjs";
import { normalizeGyartmanyForCatalog, parseVehicleTitleFields } from "./ha-title-parse.mjs";
import { applyFieldMap } from "./field-key-map.mjs";
import { pickValue } from "./parse-listing.mjs";
import { normalizeKivitel } from "./kivitel-options.mjs";

function listingHaId(row) {
  return clean(row?.form?.hasznaltauto_hirdetes_id || row?.hasznaltauto_hirdetes_id || "").replace(/\D/g, "");
}

/** Üres / szemét import csonkok — sikeres mentés után. */
async function deleteOwnerImportStubs(uid) {
  const mine = await listMyListings({ userId: uid, limit: 500 });
  for (const row of Array.isArray(mine) ? mine : []) {
    const id = Number(row?.id);
    if (!(id > 0)) continue;
    const haId = listingHaId(row);
    const form = row?.form && typeof row.form === "object" ? row.form : {};
    const title = clean(form.hirdetes_cime || row?.hirdetes_cime || "");
    const foKep = clean(form.fo_kep || row?.fo_kep || "");
    const vetelar = clean(form.vetelar || "");
    const km = clean(form.km || "");
    const badImage = /nincs(?:kis)?fo|nincs.?k[eé]p|static\/images\/nincs|placeholder/i.test(foKep);
    const stubTitle =
      /importált autó|^hirdetés\s*#/i.test(title) ||
      (!title && !foKep);
    const emptyData = !vetelar && !km && (!foKep || badImage);
    // Régi: nincs HA id + „importált”
    if (haId.length < 5 && /importált autó/i.test(title)) {
      try {
        await deleteListing(id);
      } catch {
        /* következő */
      }
      continue;
    }
    // Szemét: stub cím + nincs kép/ár (pl. Hirdetés #271), vagy csak nincs-kép placeholder
    if (stubTitle && emptyData) {
      try {
        await deleteListing(id);
      } catch {
        /* következő */
      }
    }
  }
}

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function recoverHaIdFromPage(page = {}) {
  const candidates = [
    page.listingId,
    page.hasznaltauto_hirdetes_id,
    page.url,
    page.clickUrl,
    page.adminUrl,
    page.publicUrl,
    page.forras_url,
    page.visibleImage,
    page.imageUrl,
    page.fo_kep,
    page.visibleTitle,
    page.title,
    page.bodyText,
  ];
  if (/^\d{5,12}$/.test(String(page.id || "").trim())) candidates.push(page.id);
  for (const raw of candidates) {
    const id = extractListingIdFromUrl(raw);
    if (id) return id;
  }
  return "";
}

function buildPhotoOnlyIdentity(page = {}) {
  const url = clean(page.url || page.clickUrl || page.adminUrl || page.publicUrl || page.forras_url);
  const haId = recoverHaIdFromPage(page);
  const forras = haId ? publicListingUrlFromId(haId) : url;
  const fallbackTitle = haId ? `Eladó importált autó (${haId})` : "Eladó importált autó";
  const titleLine = clean(page.visibleTitle || page.title || "");
  const parsed = titleLine ? parseVehicleTitleFields(titleLine) : { gyartmany: "", modell: "", tipus: "" };
  const gyartmany = normalizeGyartmanyForCatalog(clean(page.gyartmany || page.brand || parsed.gyartmany));
  const modell = clean(page.modell || page.model || parsed.modell);
  const tipus = clean(page.tipus || parsed.tipus);
  const hirdetes_cime = titleLine ? `Eladó ${titleLine}` : fallbackTitle;
  const leiras = normalizeImportedLeiras(page.visibleDescription || page.description || page.leiras || "");
  const priceDigits = String(page.price || page.ar || page.vetelar || "").replace(/\D/g, "");
  const kmDigits = String(page.km || "").replace(/\D/g, "");
  const form = {
    hirdetes_vertical: "auto",
    hirdetes_alkategoria: "szemelyauto",
    jarmu_kategoria: "szemelyauto",
    hasznaltauto_hirdetes_id: haId,
    forras_url: forras || url,
    hirdetes_cime,
    gyartmany,
    modell,
    tipus,
  };
  if (priceDigits) form.vetelar = priceDigits;
  if (kmDigits) form.km = kmDigits;
  const yearDigits = String(page.year || page.evjarat || "").replace(/\D/g, "").slice(0, 4);
  if (yearDigits.length === 4) form.gyartasi_ev = yearDigits;
  const fuel = clean(page.fuel || page.uzemanyag || "");
  if (fuel) form.uzemanyag = fuel;
  const gear = clean(page.gear || page.sebessegvalto || "");
  if (gear) form.sebessegvalto = gear;
  if (leiras) form.leiras = leiras;
  if (Array.isArray(page.felszereltseg) && page.felszereltseg.length) {
    form.felszereltseg = page.felszereltseg.slice(0, 300);
  }
  return form;
}

function mergeDealerPhotoForms(base = {}, full = {}) {
  const merged = { ...full };
  for (const key of [
    "gyartmany",
    "modell",
    "tipus",
    "hasznaltauto_hirdetes_id",
    "forras_url",
    "hirdetes_vertical",
    "hirdetes_alkategoria",
    "jarmu_kategoria",
    "fo_kep",
  ]) {
    if (base[key]) merged[key] = base[key];
  }
  if (base.hirdetes_cime && !/importált autó/i.test(String(base.hirdetes_cime))) {
    merged.hirdetes_cime = base.hirdetes_cime;
  }
  if (base.vetelar && !merged.vetelar) merged.vetelar = base.vetelar;
  if (base.km && !merged.km) merged.km = base.km;
  if (base.gyartasi_ev && !merged.gyartasi_ev) merged.gyartasi_ev = base.gyartasi_ev;
  if (base.uzemanyag && !merged.uzemanyag) merged.uzemanyag = base.uzemanyag;
  if (base.sebessegvalto && !merged.sebessegvalto) merged.sebessegvalto = base.sebessegvalto;
  const baseEquip = Array.isArray(base.felszereltseg) ? base.felszereltseg : [];
  const fullEquip = Array.isArray(merged.felszereltseg) ? merged.felszereltseg : [];
  if (baseEquip.length || fullEquip.length) {
    merged.felszereltseg = [...new Set([...fullEquip, ...baseEquip])].slice(0, 300);
  }
  const baseLeiras = normalizeImportedLeiras(base.leiras || "");
  const fullLeiras = normalizeImportedLeiras(full.leiras || "");
  if (baseLeiras && (!fullLeiras || baseLeiras.length >= fullLeiras.length)) merged.leiras = baseLeiras;
  return merged;
}

function patchDealerFormFromMap(form, map = {}) {
  if (!map || typeof map !== "object" || !Object.keys(map).length) return form;
  const next = { ...form };
  applyFieldMap(next, map, {});
  if (!next.allapot) {
    const raw = pickValue(map, ["állapot", "allapot"]);
    if (raw) next.allapot = raw;
  }
  if (!next.kivitel) {
    const raw = pickValue(map, ["kivitel", "kategória", "kategoria", "szerkezeti változat", "szerkezeti valtozat"]);
    if (raw) next.kivitel = normalizeKivitel(raw);
  }
  if (!next.okmany_jelleg) {
    const raw = pickValue(map, ["okmányok jellege", "okmanyok jellege"]);
    if (raw) next.okmany_jelleg = raw;
  }
  return next;
}

function formLooksThin(form = {}) {
  const km = clean(form.km).replace(/\D/g, "");
  const leiras = clean(form.leiras);
  const eq = Array.isArray(form.felszereltseg) ? form.felszereltseg.length : 0;
  const okmany = clean(form.okmany_jelleg);
  const henger = clean(form.hengerurtartalom).replace(/\D/g, "");
  return !km || leiras.length < 20 || eq < 5 || !okmany || !henger;
}

function formRichnessScore(form = {}) {
  const km = clean(form.km).replace(/\D/g, "");
  const eq = Array.isArray(form.felszereltseg) ? form.felszereltseg.length : 0;
  const leiras = clean(form.leiras).length;
  let score = 0;
  if (km) score += 40;
  if (eq >= 5) score += Math.min(40, eq);
  if (leiras >= 20) score += 15;
  if (clean(form.hengerurtartalom).replace(/\D/g, "")) score += 10;
  if (clean(form.okmany_jelleg)) score += 8;
  if (clean(form.nyari_gumi_szelesseg)) score += 5;
  if (clean(form.teljesitmeny_kw) || clean(form.teljesitmeny_le)) score += 5;
  if (clean(form.fo_kep) || clean(form.vetelar)) score += 3;
  return score;
}

/** Vékony újraimport ne törölje a már teljes hirdetést (replaceImport EAV wipe). */
function mergeIncomingWithExisting(incoming = {}, existing = {}) {
  const next = { ...incoming };
  const prev = existing && typeof existing === "object" ? existing : {};
  if (!Object.keys(prev).length) return next;

  const incomingThin = formLooksThin(next);
  const existingRich = !formLooksThin(prev) || formRichnessScore(prev) > formRichnessScore(next) + 20;

  if (incomingThin && existingRich) {
    const kept = { ...prev };
    for (const key of ["fo_kep", "vetelar", "hirdetes_cime", "forras_url", "hasznaltauto_hirdetes_id"]) {
      if (clean(next[key])) kept[key] = next[key];
    }
    // cím/ár frissülhet, de km/felszereltség/leírás marad a gazdagból
    return kept;
  }

  // Gazdag incoming: hiányzó mezőket töltsük a meglévőből (telefon, cím, stb.)
  for (const [key, value] of Object.entries(prev)) {
    if (next[key] == null || next[key] === "") next[key] = value;
  }
  const prevEq = Array.isArray(prev.felszereltseg) ? prev.felszereltseg : [];
  const nextEq = Array.isArray(next.felszereltseg) ? next.felszereltseg : [];
  if (prevEq.length || nextEq.length) {
    next.felszereltseg = [...new Set([...nextEq, ...prevEq])].slice(0, 300);
  }
  const prevLeiras = normalizeImportedLeiras(prev.leiras || "");
  const nextLeiras = normalizeImportedLeiras(next.leiras || "");
  if (prevLeiras && prevLeiras.length > nextLeiras.length) next.leiras = prevLeiras;
  return next;
}

function buildPhotoOnlyForm(page = {}) {
  const base = buildPhotoOnlyIdentity(page);
  const html = String(page.html || page.gyorsnezetHtml || "");
  const clientMap = page.map && typeof page.map === "object" ? page.map : {};

  if (html.length <= 400) {
    if (!Object.keys(clientMap).length && !(Array.isArray(page.felszereltseg) && page.felszereltseg.length)) {
      return base;
    }
    const fromMap = buildFormFromPage({
      ...page,
      html: "",
      map: clientMap,
      visibleTitle: page.visibleTitle || page.title || base.hirdetes_cime,
      brand: base.gyartmany,
      model: base.modell,
      km: page.km || "",
      felszereltseg: Array.isArray(page.felszereltseg) ? page.felszereltseg : [],
    });
    return mergeDealerPhotoForms(base, patchDealerFormFromMap(fromMap, clientMap));
  }

  const enriched = enrichPageFromGyorsnezetHtml(page, html);
  const mergedMap = enriched.map && typeof enriched.map === "object" ? enriched.map : clientMap;
  const full = buildFormFromPage({
    ...enriched,
    visibleTitle: enriched.visibleTitle || page.visibleTitle || page.title || base.hirdetes_cime,
    brand: base.gyartmany,
    model: base.modell,
    felszereltseg: [
      ...new Set([
        ...(Array.isArray(page.felszereltseg) ? page.felszereltseg : []),
        ...(Array.isArray(enriched.felszereltseg) ? enriched.felszereltseg : []),
      ]),
    ].slice(0, 300),
  });
  return mergeDealerPhotoForms(base, patchDealerFormFromMap(full, mergedMap));
}

/** Ha a bookmarklet/listás oldal vékony, próbáljuk a nyilvános HA adatlapot (Cloudflare esetén marad a vékony). */
function publicHaEnrichUrlCandidates(page = {}, haId = "") {
  const urls = [];
  const push = (raw) => {
    const u = clean(raw);
    if (!u || !/^https?:\/\/(?:www\.)?hasznaltauto\.hu\//i.test(u)) return;
    if (!urls.includes(u)) urls.push(u);
  };
  push(page.forras_url);
  push(page.publicUrl);
  push(page.url);
  if (haId.length >= 5) push(publicListingUrlFromId(haId));
  return urls;
}

async function enrichThinFormFromPublicHa(form = {}, page = {}) {
  if (!formLooksThin(form)) return form;
  const haId = clean(form.hasznaltauto_hirdetes_id || page.listingId || "").replace(/\D/g, "");
  if (haId.length < 5) return form;
  const clientMap = page.map && typeof page.map === "object" ? page.map : {};
  for (const target of publicHaEnrichUrlCandidates(page, haId)) {
    try {
      const publicPage = await pageFromPublicUrl(target);
      if (!publicPage?.html || String(publicPage.html).length < 800) continue;
      const fromPublic = buildPhotoOnlyForm({
        ...page,
        ...publicPage,
        listingId: haId,
        hasznaltauto_hirdetes_id: haId,
        map: {
          ...(publicPage.map && typeof publicPage.map === "object" ? publicPage.map : {}),
          ...clientMap,
        },
        felszereltseg: [
          ...new Set([
            ...(Array.isArray(page.felszereltseg) ? page.felszereltseg : []),
            ...(Array.isArray(publicPage.felszereltseg) ? publicPage.felszereltseg : []),
          ]),
        ],
      });
      return mergeDealerPhotoForms(form, fromPublic);
    } catch (error) {
      console.warn(`[import] public HA enrich failed url=${target} ha=${haId}: ${error?.message || error}`);
    }
  }
  return form;
}

function resolveRemoteHqImage(page = {}) {
  const raw = clean(page.visibleImage || page.imageUrl || page.fo_kep || "");
  if (/nincs(?:kis)?fo|nincs.?k[eé]p|static\/images\/nincs|placeholder|1x1|blank\./i.test(raw)) {
    return "";
  }
  const hq = upgradeHaImageUrl(raw) || raw;
  if (!/^https?:\/\//i.test(hq)) return "";
  if (isHaThumbImageUrl(hq)) return "";
  if (!/hasznaltautocdn\.com\/\d{2,4}x\d{2,4}\/\d{5,12}\/\d{5,12}\./i.test(hq)) return "";
  return hq;
}

/**
 * Kereskedői import: listáról autó → csak első kép HQ CDN URL a fo_kep-be.
 * Nincs base64 /uploads (Vercelen eltűnik → törött kép).
 */
export async function saveDealerPhotoImportPages({ pages = [], userId = null, limit = MAX_IMPORT_BATCH } = {}) {
  const cap = Math.min(Math.max(Number(limit) || MAX_IMPORT_BATCH, 1), MAX_IMPORT_BATCH);
  const list = (Array.isArray(pages) ? pages : []).slice(0, cap);
  const items = [];
  const errors = [];
  let savedCount = 0;
  let skippedCount = 0;

  const uid = Number(userId);
  if (!(Number.isFinite(uid) && uid > 0)) {
    const err = new Error("Csak regisztrált felhasználók importálhatnak.");
    err.code = "AUTH_REQUIRED";
    throw err;
  }

  let ownerProfile = null;
  try {
    const owner = await getUserById(uid);
    ownerProfile = owner?.profile || null;
  } catch {
    ownerProfile = null;
  }

  const usable = list.filter((page) => Boolean(recoverHaIdFromPage(page || {})));
  skippedCount += list.length - usable.length;
  if (!usable.length) {
    return {
      savedCount: 0,
      skippedCount,
      errorCount: list.length,
      count: 0,
      items: [],
      errors: [{ url: "", message: "Nincs másolható autó a listán (hirdetésazonosító kell)" }],
      photoOnly: true,
    };
  }

  for (const page of usable) {
    const url = clean(page?.url || page?.clickUrl || page?.adminUrl || page?.publicUrl);
    try {
      let form = buildPhotoOnlyForm(page || {});
      form = await enrichThinFormFromPublicHa(form, page || {});
      const remoteImage = resolveRemoteHqImage({ ...page, fo_kep: form.fo_kep || page?.fo_kep });
      if (remoteImage) form.fo_kep = remoteImage;
      const mapKeys =
        page?.map && typeof page.map === "object" ? Object.keys(page.map).length : 0;
      const htmlLen = String(page?.html || page?.gyorsnezetHtml || "").length;
      if (mapKeys < 3 && htmlLen < 400 && !clean(form.km || "") && !clean(form.gyartasi_ev || "")) {
        console.warn(
          `[import] dealer thin page ha=${form.hasznaltauto_hirdetes_id || "?"} map=${mapKeys} html=${htmlLen} price=${form.vetelar || ""}`
        );
      }
      const title = clean(form.hirdetes_cime || page?.visibleTitle || "");
      const isStubTitle = !title || /importált autó|^hirdetés\s*#/i.test(title);
      if (isStubTitle && !remoteImage && !clean(form.vetelar || page?.price || "")) {
        skippedCount += 1;
        errors.push({ url, message: "Üres sor (nincs cím, kép, ár) — kihagyva" });
        continue;
      }
      if (!form.hirdetes_cime) form.hirdetes_cime = "Eladó importált autó";
      if (ownerProfile) applyImporterProfileToListingForm(form, ownerProfile);

      const mine = await findOwnerListingByHaId(uid, form.hasznaltauto_hirdetes_id);
      if (mine?.id) {
        try {
          const existing = await getListing(mine.id);
          form = mergeIncomingWithExisting(form, existing?.form || {});
        } catch {
          /* meglévő nélkül is mentünk */
        }
      }
      // Még mindig vékony + nincs kép: ne írjuk felül üres EAV-val
      if (formLooksThin(form) && !remoteImage && !clean(form.vetelar || "")) {
        skippedCount += 1;
        errors.push({ url, message: "Túl kevés adat a teljes importhoz — kihagyva (ne törölje a meglévőt)" });
        continue;
      }
      let saved = await saveListing(form, mine?.id ?? null, {
        status: "feladott",
        userId: uid,
        replaceImport: true,
      });

      if (remoteImage) {
        try {
          const updated = await updateListingFoKep(saved.id, remoteImage);
          if (updated) saved = updated;
        } catch {
          /* fo_kep a saveListing-ben is mehetett */
        }
      }

      savedCount += 1;
      items.push({
        url,
        cim: saved?.form?.hirdetes_cime || saved?.hirdetes_cime || form.hirdetes_cime,
        savedId: saved?.id ?? null,
        updated: false,
        photoOnly: true,
      });
    } catch (error) {
      errors.push({ url, message: error.message ?? String(error) });
    }
  }

  if (savedCount > 0) {
    try {
      await deleteOwnerImportStubs(uid);
    } catch {
      /* csonk törlés nem állítja a mentést */
    }
  }

  return {
    savedCount,
    skippedCount,
    errorCount: errors.length,
    count: items.length,
    items,
    errors,
    photoOnly: true,
  };
}
