/**
 * Web userek + session — Supabase Postgres.
 */
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { getSupabase, isSupabaseBackend, supabaseBackendLabel } from "./client.mjs";
import { deleteProfileFromFile, readProfilesStore } from "../web-user-profiles.mjs";

const SESSION_DAYS = 30;

function sb() {
  return getSupabase();
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(String(expectedHash ?? ""), "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function tokenHash(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

function normalizeAccountType(value) {
  return value === "business" ? "business" : "private";
}

function resolveAccountType(profile, existing = {}) {
  if (normalizeAccountType(existing.accountType) === "business") return "business";
  if (normalizeAccountType(profile?.accountType) === "business") return "business";
  return "private";
}

function initialProfileJson(accountType) {
  return JSON.stringify({ accountType: normalizeAccountType(accountType) });
}

function emptyProfile() {
  return {
    salutation: "",
    firstName: "",
    lastName: "",
    street: "",
    postalCode: "",
    city: "",
    country: "Magyarország",
    phone: "",
    company: "",
    companyTaxId: "",
    companyStreet: "",
    companyPostalCode: "",
    companyCity: "",
    companyCountry: "Magyarország",
    companyAddress: "",
    companyPhone: "",
    companyPhone2: "",
    companyEmail: "",
    companyEmail2: "",
    salespersonName: "",
    salespersonName2: "",
    accountType: "private",
  };
}

function profileFromRow(row) {
  if (!row) return emptyProfile();
  let parsed = {};
  try {
    parsed = row.profile_json ? JSON.parse(row.profile_json) : {};
  } catch {
    parsed = {};
  }
  const merged = { ...emptyProfile(), ...parsed };
  if (parsed.avatarDataUrl != null) merged.avatarDataUrl = parsed.avatarDataUrl;
  if (parsed.pageLayout != null) merged.pageLayout = parsed.pageLayout;
  return merged;
}

function publicUser(row) {
  if (!row) return null;
  const email = String(row.email ?? "");
  const displayName =
    String(row.display_name ?? "").trim() ||
    email.split("@")[0] ||
    "Felhasználó";
  return {
    id: row.id,
    email,
    displayName,
    emailVerified: row.email_verified === true || Number(row.email_verified) === 1,
    profile: profileFromRow(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function purgeExpiredSessions() {
  await sb().from("web_sessions").delete().lt("expires_at", new Date().toISOString());
}

async function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const { error } = await sb().from("web_sessions").insert({
    token_hash: tokenHash(token),
    user_id: userId,
    expires_at: expires.toISOString(),
  });
  if (error) throw error;
  return { token, expires };
}

function hasPasswordHash(row) {
  return Boolean(String(row?.password_salt ?? "").trim() && String(row?.password_hash ?? "").trim());
}

const ACTIVATION_HOURS = 24;

function makeActivationToken() {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + ACTIVATION_HOURS * 60 * 60 * 1000);
  return { token, expiresAt: expires.toISOString(), expires };
}

export async function createUserSession(userId) {
  return createSession(userId);
}

async function linkIdentity(userId, { provider, subject, email = "", profile = {} }) {
  const { data: existing } = await sb()
    .from("web_user_identities")
    .select("id, user_id")
    .eq("provider", provider)
    .eq("provider_subject", subject)
    .maybeSingle();
  if (existing) {
    if (Number(existing.user_id) !== Number(userId)) {
      throw new Error("Ez a social fiók már másik felhasználóhoz van kötve.");
    }
    await sb()
      .from("web_user_identities")
      .update({
        email: email || null,
        raw_profile_json: JSON.stringify(profile ?? {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return existing.id;
  }
  const { data, error } = await sb()
    .from("web_user_identities")
    .insert({
      user_id: userId,
      provider,
      provider_subject: subject,
      email: email || null,
      raw_profile_json: JSON.stringify(profile ?? {}),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function findOrCreateOAuthUser(identity) {
  const provider = String(identity?.provider ?? "").trim().toLowerCase();
  const subject = String(identity?.subject ?? "").trim();
  if (!provider || !subject) throw new Error("Hiányzó OAuth azonosító.");

  const { data: identityRow } = await sb()
    .from("web_user_identities")
    .select("user_id")
    .eq("provider", provider)
    .eq("provider_subject", subject)
    .maybeSingle();

  if (identityRow?.user_id) {
    const user = await getUserById(identityRow.user_id);
    await linkIdentity(user.id, {
      provider,
      subject,
      email: identity.email || user.email,
      profile: identity.profile ?? {},
    });
    if (!user.emailVerified && identity.emailVerified !== false) {
      await sb()
        .from("web_users")
        .update({ email_verified: true, updated_at: new Date().toISOString() })
        .eq("id", user.id);
    }
    const session = await createSession(user.id);
    return { user: await getUserById(user.id), session, created: false };
  }

  let email = normalizeEmail(identity.email);
  if (!email) email = `${provider}.${subject.replace(/[^\w.-]+/g, "").slice(0, 48)}@oauth.local`;

  const { data: userRow } = await sb().from("web_users").select("*").eq("email", email).maybeSingle();
  let created = false;
  let userId;

  if (!userRow) {
    const displayName = String(identity.name ?? "").trim().slice(0, 40) || null;
    const { data: inserted, error } = await sb()
      .from("web_users")
      .insert({
        email,
        password_salt: "",
        password_hash: "",
        display_name: displayName,
        profile_json: initialProfileJson(identity.accountType),
        email_verified: true,
      })
      .select("*")
      .single();
    if (error) throw error;
    userId = inserted.id;
    created = true;
  } else {
    userId = userRow.id;
    if (!userRow.email_verified) {
      await sb()
        .from("web_users")
        .update({
          email_verified: true,
          activation_token_hash: null,
          activation_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    }
  }

  await linkIdentity(userId, { provider, subject, email, profile: identity.profile ?? {} });

  if (identity.name) {
    const { data: current } = await sb().from("web_users").select("display_name").eq("id", userId).single();
    if (!current?.display_name) {
      const name = String(identity.name).trim().slice(0, 40);
      if (name) {
        await sb().from("web_users").update({ display_name: name, updated_at: new Date().toISOString() }).eq("id", userId);
      }
    }
  }

  const session = await createSession(userId);
  return { user: await getUserById(userId), session, created };
}

export async function listUserIdentities(userId) {
  const { data, error } = await sb()
    .from("web_user_identities")
    .select("provider, provider_subject, email, created_at")
    .eq("user_id", userId)
    .order("provider");
  if (error) throw error;
  return data ?? [];
}

export async function destroySession(token) {
  if (!token) return;
  await sb().from("web_sessions").delete().eq("token_hash", tokenHash(token));
}

export async function getUserBySessionToken(token) {
  if (!token) return null;
  await purgeExpiredSessions();
  const { data, error } = await sb()
    .from("web_sessions")
    .select("user_id")
    .eq("token_hash", tokenHash(token))
    .gte("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  if (!data?.user_id) return null;
  return getUserById(data.user_id);
}

export async function registerUser(email, password, passwordConfirm, accountType) {
  const normalized = normalizeEmail(email);
  const pass = String(password ?? "").trim();
  const confirm = String(passwordConfirm ?? "").trim();
  if (!normalized || !pass) throw new Error("Email és jelszó kötelező.");
  if (!normalized.includes("@")) throw new Error("Érvénytelen email cím.");
  if (pass.length < 4) throw new Error("A jelszó legalább 4 karakter legyen.");
  if (pass !== confirm) throw new Error("A két jelszó nem egyezik.");

  const { data: existing } = await sb().from("web_users").select("id, email_verified").eq("email", normalized).maybeSingle();
  if (existing?.email_verified) throw new Error("Ez az email már regisztrálva van.");

  const { salt, hash } = hashPassword(pass);
  const { token, expiresAt } = makeActivationToken();
  const profileJson = initialProfileJson(accountType);

  let userId;
  if (existing) {
    await sb()
      .from("web_users")
      .update({
        password_salt: salt,
        password_hash: hash,
        email_verified: false,
        activation_token_hash: tokenHash(token),
        activation_expires_at: expiresAt,
        profile_json: profileJson,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    userId = existing.id;
  } else {
    const { data: inserted, error } = await sb()
      .from("web_users")
      .insert({
        email: normalized,
        password_salt: salt,
        password_hash: hash,
        profile_json: profileJson,
        email_verified: false,
        activation_token_hash: tokenHash(token),
        activation_expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (error) throw error;
    userId = inserted.id;
  }

  return { userId, email: normalized, activationToken: token, needsActivation: true };
}

export async function activateUserByToken(rawToken) {
  const token = String(rawToken ?? "").trim();
  if (!token || token.length < 16) throw new Error("Érvénytelen aktiváló link.");
  const { data: row, error } = await sb()
    .from("web_users")
    .select("*")
    .eq("activation_token_hash", tokenHash(token))
    .gte("activation_expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("Az aktiváló link lejárt vagy érvénytelen.");

  await sb()
    .from("web_users")
    .update({
      email_verified: true,
      activation_token_hash: null,
      activation_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  const session = await createSession(row.id);
  return { user: await getUserById(row.id), session };
}

export async function createActivationForEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("Email kötelező.");
  const { data: row } = await sb().from("web_users").select("*").eq("email", normalized).maybeSingle();
  if (!row) throw new Error("Nincs ilyen fiók.");
  if (row.email_verified) throw new Error("Ez a fiók már aktiválva van — lépj be.");
  const { token, expiresAt } = makeActivationToken();
  await sb()
    .from("web_users")
    .update({
      activation_token_hash: tokenHash(token),
      activation_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  return { email: normalized, activationToken: token };
}

export async function loginUser(email, password, { skipActivationCheck = false } = {}) {
  const normalized = normalizeEmail(email);
  const pass = String(password ?? "").trim();
  if (!normalized || !pass) throw new Error("Email és jelszó kötelező.");

  const { data: row, error } = await sb().from("web_users").select("*").eq("email", normalized).maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("Hibás email vagy jelszó.");
  if (!hasPasswordHash(row)) {
    throw new Error("Ez a fiók Google / Apple / Facebook belépéssel készült — használd a social gombot.");
  }
  if (!verifyPassword(pass, row.password_salt, row.password_hash)) {
    throw new Error("Hibás email vagy jelszó.");
  }
  if (!row.email_verified) {
    if (skipActivationCheck) {
      await sb()
        .from("web_users")
        .update({
          email_verified: true,
          activation_token_hash: null,
          activation_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      row.email_verified = true;
    } else {
      const err = new Error("Előbb aktiváld az emailed — nézd meg a postaládád (és a spam mappát).");
      err.code = "EMAIL_NOT_VERIFIED";
      throw err;
    }
  }

  const session = await createSession(row.id);
  return { user: publicUser(row), session };
}

export async function changeUserPassword(userId, currentPassword, newPassword, newPasswordConfirm) {
  const current = String(currentPassword ?? "").trim();
  const next = String(newPassword ?? "").trim();
  const confirm = String(newPasswordConfirm ?? "").trim();
  if (!next) throw new Error("Az új jelszó kötelező.");
  if (next !== confirm) throw new Error("A két új jelszó nem egyezik.");
  if (next.length < 4) throw new Error("Az új jelszó legalább 4 karakter legyen.");

  const { data: row } = await sb().from("web_users").select("*").eq("id", userId).maybeSingle();
  if (!row) throw new Error("Nem vagy bejelentkezve.");
  if (hasPasswordHash(row)) {
    if (!current) throw new Error("A jelenlegi és az új jelszó kötelező.");
    if (!verifyPassword(current, row.password_salt, row.password_hash)) {
      throw new Error("A jelenlegi jelszó hibás.");
    }
  }

  const { salt, hash } = hashPassword(next);
  await sb()
    .from("web_users")
    .update({ password_salt: salt, password_hash: hash, updated_at: new Date().toISOString() })
    .eq("id", userId);
}

export async function setUserDisplayName(userId, name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) throw new Error("A megjelenített név kötelező.");
  if (trimmed.length > 40) throw new Error("A név maximum 40 karakter lehet.");
  await sb().from("web_users").update({ display_name: trimmed, updated_at: new Date().toISOString() }).eq("id", userId);
  return trimmed;
}

export async function mergeUserProfileJson(userId, patch = {}) {
  const { data: row } = await sb().from("web_users").select("profile_json").eq("id", userId).maybeSingle();
  if (!row) throw new Error("Nincs ilyen felhasználó.");
  let parsed = {};
  try {
    parsed = row.profile_json ? JSON.parse(row.profile_json) : {};
  } catch {
    parsed = {};
  }
  const next = { ...parsed, ...patch };
  const { error } = await sb()
    .from("web_users")
    .update({ profile_json: JSON.stringify(next), updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
  return getUserById(userId);
}

export async function getUserDetailsForAdmin(userId) {
  const { data: row, error } = await sb().from("web_users").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("Nincs ilyen felhasználó.");
  const parseJsonSafe = (value) => {
    if (!value) return {};
    if (typeof value === "object") return value;
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  };

  let profileJson = parseJsonSafe(row.profile_json);
  if (Object.keys(profileJson).length === 0 || !String(profileJson.accountType ?? "").trim()) {
    try {
      const { data: identities, error: identitiesError } = await sb()
        .from("web_user_identities")
        .select("raw_profile_json")
        .eq("user_id", userId)
        .limit(1);
      if (identitiesError) throw identitiesError;
      const best = (identities ?? [])[0];
      if (best?.raw_profile_json) {
        const identityProfile = parseJsonSafe(best.raw_profile_json);
        profileJson = { ...identityProfile, ...profileJson };
        if (!profileJson.accountType && identityProfile.accountType) {
          profileJson.accountType = identityProfile.accountType;
        }
      }
    } catch {
      // Régi/eltérő séma esetén ne blokkolja az admin mentést.
    }
  }
  if (!String(profileJson.accountType ?? "").trim()) {
    profileJson.accountType = "private";
  }
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    emailVerified: row.email_verified === true || Number(row.email_verified) === 1,
    profileJson,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateWebUserForAdmin(userId, patch = {}) {
  const baseUpdate = {};
  if (patch.email !== undefined) baseUpdate.email = String(patch.email ?? "").trim().toLowerCase();
  if (patch.displayName !== undefined) baseUpdate.display_name = String(patch.displayName ?? "").trim();
  if (patch.emailVerified !== undefined) baseUpdate.email_verified = patch.emailVerified ? 1 : 0;

  if (patch.profileJson === undefined) {
    if (Object.keys(baseUpdate).length === 0) return getUserDetailsForAdmin(userId);
    baseUpdate.updated_at = new Date().toISOString();
    const { error } = await sb().from("web_users").update(baseUpdate).eq("id", userId);
    if (error) throw error;
    return getUserDetailsForAdmin(userId);
  }

  let profileJson = patch.profileJson;
  if (typeof profileJson === "string") {
    try {
      profileJson = JSON.parse(profileJson);
    } catch {
      profileJson = { _parseError: true, raw: profileJson };
    }
  }

  const profileJsonText = JSON.stringify(profileJson ?? {});
  const update = { ...baseUpdate, updated_at: new Date().toISOString(), profile_json: profileJsonText };
  const { error } = await sb().from("web_users").update(update).eq("id", userId);
  if (error) {
    const msg = String(error?.message || error);
    if (msg.includes("profile_json") && msg.includes("web_users") && msg.includes("schema cache")) {
      const { error: baseOnlyError } = await sb()
        .from("web_users")
        .update({ ...baseUpdate, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (baseOnlyError) throw baseOnlyError;
      const { data: identityRows, error: identityGetError } = await sb()
        .from("web_user_identities")
        .select("id")
        .eq("user_id", userId)
        .order("id", { ascending: true })
        .limit(1);
      if (identityGetError) throw identityGetError;
      const identityId = identityRows?.[0]?.id;
      if (identityId) {
        const { error: identityUpdateError } = await sb()
          .from("web_user_identities")
          .update({ raw_profile_json: profileJsonText, updated_at: new Date().toISOString() })
          .eq("id", identityId);
        if (identityUpdateError) throw identityUpdateError;
      } else {
        const { data: userRow, error: userRowError } = await sb()
          .from("web_users")
          .select("email")
          .eq("id", userId)
          .maybeSingle();
        if (userRowError) throw userRowError;
        const { error: identityInsertError } = await sb().from("web_user_identities").insert({
          user_id: userId,
          provider: "local",
          provider_subject: `local-${userId}`,
          email: userRow?.email ?? null,
          raw_profile_json: profileJsonText,
        });
        if (identityInsertError) throw identityInsertError;
      }
    } else {
      throw error;
    }
  }
  return getUserDetailsForAdmin(userId);
}

function strProfileField(profile, existing, key) {
  const src = profile[key] != null ? profile[key] : existing[key];
  return String(src ?? "").trim();
}

function companyFieldsFrom(profile, existing = {}) {
  const street = strProfileField(profile, existing, "companyStreet");
  const postalCode = strProfileField(profile, existing, "companyPostalCode").replace(/\D/g, "").slice(0, 4);
  const city = strProfileField(profile, existing, "companyCity");
  const country = String(profile.companyCountry ?? existing.companyCountry ?? "Magyarország").trim() || "Magyarország";
  const legacyAddress = strProfileField(profile, existing, "companyAddress");
  const addressParts = [];
  const loc = [postalCode, city].filter(Boolean).join(" ");
  if (loc) addressParts.push(loc);
  if (street) addressParts.push(street);
  if (country && country !== "Magyarország") addressParts.push(country);
  const companyAddress = addressParts.join(", ") || legacyAddress;
  return {
    company: strProfileField(profile, existing, "company"),
    companyTaxId: strProfileField(profile, existing, "companyTaxId"),
    companyStreet: street || (!postalCode && !city ? legacyAddress : street),
    companyPostalCode: postalCode,
    companyCity: city,
    companyCountry: country,
    companyAddress,
    companyPhone: strProfileField(profile, existing, "companyPhone"),
    companyPhone2: strProfileField(profile, existing, "companyPhone2"),
    companyEmail: strProfileField(profile, existing, "companyEmail"),
    companyEmail2: strProfileField(profile, existing, "companyEmail2"),
    salespersonName: strProfileField(profile, existing, "salespersonName"),
    salespersonName2: strProfileField(profile, existing, "salespersonName2"),
  };
}

export async function saveUserProfile(userId, profile) {
  const { data: row, error: rowError } = await sb().from("web_users").select("*").eq("id", userId).maybeSingle();
  if (rowError) throw rowError;
  if (!row?.email) throw new Error("A profil mentése sikertelen (nincs ilyen felhasználó).");

  let existing = profileFromRow(row);
  if (!row.profile_json) {
    try {
      const { data: identities } = await sb()
        .from("web_user_identities")
        .select("raw_profile_json")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1);
      const raw = identities?.[0]?.raw_profile_json;
      if (raw) {
        const identityProfile = typeof raw === "string" ? JSON.parse(raw) : raw;
        existing = { ...existing, ...(identityProfile || {}) };
      }
    } catch {
      /* fallback marad az existing */
    }
  }

  const accountType = resolveAccountType(profile, existing);
  const next = {
    salutation: strProfileField(profile, existing, "salutation"),
    firstName: strProfileField(profile, existing, "firstName"),
    lastName: strProfileField(profile, existing, "lastName"),
    street: strProfileField(profile, existing, "street"),
    postalCode: strProfileField(profile, existing, "postalCode"),
    city: strProfileField(profile, existing, "city"),
    country: String(profile.country ?? existing.country ?? "Magyarország").trim() || "Magyarország",
    phone: strProfileField(profile, existing, "phone"),
    ...companyFieldsFrom(profile, existing),
    accountType,
  };
  if (existing.avatarDataUrl) next.avatarDataUrl = existing.avatarDataUrl;
  if (existing.pageLayout) next.pageLayout = existing.pageLayout;
  if (accountType !== "business" && (!next.firstName || !next.lastName)) {
    throw new Error("A keresztnév és a vezetéknév kötelező.");
  }

  const displayName =
    [next.firstName, next.lastName].filter(Boolean).join(" ") ||
    String(next.company || existing.company || "").trim() ||
    String(row.display_name ?? "").trim();

  const profileJsonText = JSON.stringify(next);
  const { error } = await sb()
    .from("web_users")
    .update({
      profile_json: profileJsonText,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) {
    const msg = String(error?.message || error);
    if (msg.includes("profile_json") && msg.includes("web_users") && msg.includes("schema cache")) {
      const { error: baseOnlyError } = await sb()
        .from("web_users")
        .update({
          display_name: displayName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (baseOnlyError) throw baseOnlyError;

      const { data: identityRows, error: identityGetError } = await sb()
        .from("web_user_identities")
        .select("id")
        .eq("user_id", userId)
        .order("id", { ascending: true })
        .limit(1);
      if (identityGetError) throw identityGetError;

      const identityId = identityRows?.[0]?.id;
      if (identityId) {
        const { error: identityUpdateError } = await sb()
          .from("web_user_identities")
          .update({ raw_profile_json: profileJsonText, updated_at: new Date().toISOString() })
          .eq("id", identityId);
        if (identityUpdateError) throw identityUpdateError;
      } else {
        const { error: identityInsertError } = await sb().from("web_user_identities").insert({
          user_id: userId,
          provider: "local",
          provider_subject: `local-${userId}`,
          email: row.email,
          raw_profile_json: profileJsonText,
        });
        if (identityInsertError) throw identityInsertError;
      }
    } else {
      throw error;
    }
  }
  return next;
}

export async function deleteUserAccount(userId) {
  await sb().from("web_sessions").delete().eq("user_id", userId);
  await sb().from("web_users").delete().eq("id", userId);
}

export async function getUserById(userId) {
  const { data: row, error } = await sb().from("web_users").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  const user = publicUser(row);

  // Ha a web_users.profile_json nincs a sémában (vagy üres), a profil tartalom a
  // web_user_identities.raw_profile_json mezőben lehet (admin/identity fallback).
  try {
    const rawProfile = row?.profile_json;
    const looksEmpty = rawProfile === undefined || rawProfile === null || rawProfile === "" || rawProfile === "{}";
    if (looksEmpty && row?.id) {
      const { data: identities, error: identitiesError } = await sb()
        .from("web_user_identities")
        .select("raw_profile_json")
        .eq("user_id", row.id)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (!identitiesError) {
        const best = (identities ?? [])[0];
        const raw = best?.raw_profile_json;
        if (raw) {
          let identityProfile = {};
          try {
            identityProfile = typeof raw === "string" ? JSON.parse(raw) : raw;
          } catch {
            identityProfile = {};
          }
          user.profile = { ...(user.profile ?? emptyProfile()), ...(identityProfile ?? {}) };
          if (identityProfile?.accountType) user.profile.accountType = normalizeAccountType(identityProfile.accountType);
          if (identityProfile?.avatarDataUrl != null) user.profile.avatarDataUrl = identityProfile.avatarDataUrl;
          if (identityProfile?.pageLayout != null) user.profile.pageLayout = identityProfile.pageLayout;
        }
      }
    }
  } catch {
    // Ne akadályozza a bejelentkezést / profil megjelenítést különböző séma-verziók esetén.
  }

  return user;
}

export async function countWebUsers() {
  const { count, error } = await sb().from("web_users").select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function listWebUsersForAdmin() {
  const { data, error } = await sb()
    .from("web_users")
    .select("id, email, display_name, email_verified, created_at, updated_at")
    .order("id");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    emailVerified: row.email_verified === true || Number(row.email_verified) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function inspectWebUsersDb() {
  const { data: users, error } = await sb()
    .from("web_users")
    .select("id, email, display_name, profile_json, created_at, updated_at")
    .order("id");
  if (error) throw error;
  const mapped = (users ?? []).map((row) => {
    let profile = {};
    try {
      profile = row.profile_json ? JSON.parse(row.profile_json) : {};
    } catch {
      profile = { _parseError: true, raw: row.profile_json };
    }
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      sqliteProfile: profile,
      fileProfile: null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
  const { count: sessionCount } = await sb()
    .from("web_sessions")
    .select("*", { count: "exact", head: true })
    .gte("expires_at", new Date().toISOString());
  return {
    dbPath: `supabase://${supabaseBackendLabel()}`,
    profilesPath: "(supabase — csak profile_json)",
    userCount: mapped.length,
    sessionCount: sessionCount ?? 0,
    users: mapped,
    profilesFile: readProfilesStore(),
  };
}

export function initWebUsersSchema() {
  /* Postgres séma migration-ből jön */
}
