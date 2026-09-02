import { getSupabase } from "./supabase/client.mjs";
import { listListingsByOwner } from "./supabase/listings.mjs";
import { resolveListingVertical } from "./listing-vertical.mjs";

function sb() { return getSupabase(); }
function text(value, max = 2000) { return String(value ?? "").trim().slice(0, max); }
function publicUrl(value, max = 1200) {
  const raw = text(value, max);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function withReviewStatus(profile) {
  if (!profile) return profile;
  const application_status = profile.is_verified
    ? "approved"
    : profile.is_public === false
      ? "rejected"
      : "pending";
  return { ...profile, application_status };
}

export function slugify(value) {
  const slug = text(value, 100).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return slug || "partner";
}

function normalizeProfile(input = {}, user = {}) {
  const displayName = text(input.displayName || input.display_name || user.displayName, 100);
  if (!displayName) throw new Error("A partner neve kötelező.");
  return {
    slug: slugify(input.slug || displayName),
    display_name: displayName,
    description: text(input.description, 4000),
    website: publicUrl(input.website, 300),
    email: text(input.email || user.email, 320),
    logo_url: publicUrl(input.logoUrl || input.logo_url),
    cover_url: publicUrl(input.coverUrl || input.cover_url),
    contact_person: text(input.contactPerson || input.contact_person, 160),
    service_areas: text(input.serviceAreas || input.service_areas, 1000),
    is_public: input.isPublic !== false && input.is_public !== false,
  };
}

export async function getOwnPartnerProfile(user) {
  const { data, error } = await sb().from("partner_profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return withReviewStatus(data);
}

export async function saveOwnPartnerProfile(user, input) {
  const profile = normalizeProfile(input, user);
  const { data, error } = await sb().from("partner_profiles").upsert({ user_id: user.id, ...profile }, { onConflict: "user_id" }).select("*").single();
  if (error) throw error;
  return withReviewStatus(data);
}

export async function getPublicPartnerProfile(slug) {
  const { data, error } = await sb()
    .from("partner_profiles")
    .select("*")
    .eq("slug", slugify(slug))
    .eq("is_verified", true)
    .eq("is_public", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const listings = await listListingsByOwner({ userId: data.user_id, limit: 100, status: "feladott" });
  return { profile: data, listings: listings.filter((listing) => resolveListingVertical(listing) === "ingatlan").slice(0, 60) };
}

export async function getPublicPartnerProfileByUserId(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const { data, error } = await sb()
    .from("partner_profiles")
    .select("slug, display_name, logo_url, contact_person, service_areas, is_verified")
    .eq("user_id", id)
    .eq("is_verified", true)
    .eq("is_public", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listPublicPartnerProfiles({ limit = 60, query = "" } = {}) {
  const search = text(query, 100);
  let request = sb()
    .from("partner_profiles")
    .select("slug, display_name, logo_url, contact_person, service_areas, is_verified")
    .eq("is_verified", true)
    .eq("is_public", true);
  if (search) {
    const safe = search.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
    request = request.or(`display_name.ilike.%${safe}%,contact_person.ilike.%${safe}%,service_areas.ilike.%${safe}%`);
  }
  const { data, error } = await request
    .order("is_verified", { ascending: false })
    .order("display_name")
    .limit(Math.min(Math.max(Number(limit) || 60, 1), 100));
  if (error) throw error;
  return data ?? [];
}

export async function listPartnerProfilesForAdmin() {
  const { data, error } = await sb()
    .from("partner_profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map(withReviewStatus);
}

export async function reviewPartnerProfile(userId, { status } = {}) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Érvénytelen partnerazonosító.");
  const next = ["pending", "approved", "rejected"].includes(status) ? status : "";
  if (!next) throw new Error("Érvénytelen jóváhagyási állapot.");
  const approved = next === "approved";
  const { data, error } = await sb()
    .from("partner_profiles")
    .update({
      is_verified: approved,
      is_public: next !== "rejected",
    })
    .eq("user_id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Nincs ilyen partnerprofil.");
  return withReviewStatus(data);
}
