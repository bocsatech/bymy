/** Autosweb web userek — helyi SQLite (localhost), nem Supabase. */

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { getDb, getDbPath } from "./db.mjs";
import {
  deleteProfileFromFile,
  loadProfileFromFile,
  saveProfileToFile,
  getProfilesFilePath,
  readProfilesStore,
  ensureProfilesStore,
} from "./web-user-profiles.mjs";

const SESSION_DAYS = 30;
const SESSION_COOKIE = "autosweb_session";

export { SESSION_COOKIE, getProfilesFilePath, ensureProfilesStore };

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
  const fromFile = loadProfileFromFile(row.email);
  // Fájl az elsődleges (túléli DB útvonal-váltást); SQLite a másodlagos.
  const merged = { ...emptyProfile(), ...parsed, ...(fromFile || {}) };
  delete merged.savedAt;
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
    emailVerified: Number(row.email_verified ?? 1) === 1,
    profile: profileFromRow(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function ensureColumn(db, table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

export function initWebUsersSchema(db = getDb()) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS web_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      profile_json TEXT NOT NULL DEFAULT '{}',
      email_verified INTEGER NOT NULL DEFAULT 1,
      activation_token_hash TEXT,
      activation_expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS web_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES web_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS web_user_identities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      provider_subject TEXT NOT NULL,
      email TEXT,
      raw_profile_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (provider, provider_subject),
      FOREIGN KEY (user_id) REFERENCES web_users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_web_sessions_user ON web_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_web_sessions_expires ON web_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_web_user_identities_user ON web_user_identities(user_id);
  `);

  // Régi DB-k: meglévő userek aktívak maradnak (DEFAULT 1).
  ensureColumn(db, "web_users", "email_verified", "email_verified INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "web_users", "activation_token_hash", "activation_token_hash TEXT");
  ensureColumn(db, "web_users", "activation_expires_at", "activation_expires_at TEXT");
  ensureColumn(db, "web_users", "last_login_at", "last_login_at TEXT");
  ensureColumn(db, "web_users", "password_reset_token_hash", "password_reset_token_hash TEXT");
  ensureColumn(db, "web_users", "password_reset_expires_at", "password_reset_expires_at TEXT");
}

function tokenHash(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

function createSession(userId) {
  const db = getDb();
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const expiresAt = expires.toISOString().slice(0, 19).replace("T", " ");
  db.prepare(
    `INSERT INTO web_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)`
  ).run(tokenHash(token), userId, expiresAt);
  try {
    db.prepare(`UPDATE web_users SET last_login_at = datetime('now') WHERE id = ?`).run(userId);
  } catch {
    /* column may missing on very old DB before init */
  }
  return { token, expires };
}

/** OAuth / külső belépés utáni session. */
export function createUserSession(userId) {
  return createSession(userId);
}

function hasPasswordHash(row) {
  return Boolean(String(row?.password_salt ?? "").trim() && String(row?.password_hash ?? "").trim());
}

function findUserForLogin(identifier) {
  const raw = String(identifier ?? "").trim();
  if (!raw) return null;

  const normalized = normalizeEmail(raw);
  const db = getDb();
  if (normalized.includes("@")) {
    return db.prepare(`SELECT * FROM web_users WHERE email = ?`).get(normalized) || null;
  }

  const key = raw.toLowerCase();
  const byName = db.prepare(`SELECT * FROM web_users WHERE lower(display_name) = ?`).get(key);
  if (byName) return byName;

  const byPrefix = db.prepare(`SELECT * FROM web_users WHERE lower(email) LIKE ? || '@%'`).all(key);
  if (byPrefix.length === 1) return byPrefix[0];
  return null;
}

function linkIdentity(userId, { provider, subject, email = "", profile = {} }) {
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT id, user_id FROM web_user_identities WHERE provider = ? AND provider_subject = ?`
    )
    .get(provider, subject);
  if (existing) {
    if (Number(existing.user_id) !== Number(userId)) {
      throw new Error("Ez a social fiók már másik Autosweb felhasználóhoz van kötve.");
    }
    db.prepare(
      `UPDATE web_user_identities
       SET email = ?, raw_profile_json = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(email || null, JSON.stringify(profile ?? {}), existing.id);
    return existing.id;
  }
  const info = db
    .prepare(
      `INSERT INTO web_user_identities (user_id, provider, provider_subject, email, raw_profile_json)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(userId, provider, subject, email || null, JSON.stringify(profile ?? {}));
  return Number(info.lastInsertRowid);
}

/**
 * Google / Apple / Facebook belépés → helyi user + identity.
 * @param {{ provider: string, subject: string, email?: string, name?: string, emailVerified?: boolean, profile?: object }} identity
 */
export function findOrCreateOAuthUser(identity) {
  const provider = String(identity?.provider ?? "").trim().toLowerCase();
  const subject = String(identity?.subject ?? "").trim();
  if (!provider || !subject) {
    throw new Error("Hiányzó OAuth azonosító.");
  }

  const db = getDb();
  const byIdentity = db
    .prepare(
      `SELECT u.*
       FROM web_user_identities i
       JOIN web_users u ON u.id = i.user_id
       WHERE i.provider = ? AND i.provider_subject = ?`
    )
    .get(provider, subject);

  if (byIdentity) {
    linkIdentity(byIdentity.id, {
      provider,
      subject,
      email: identity.email || byIdentity.email,
      profile: identity.profile ?? {},
    });
    if (Number(byIdentity.email_verified) !== 1 && identity.emailVerified !== false) {
      db.prepare(
        `UPDATE web_users SET email_verified = 1, updated_at = datetime('now') WHERE id = ?`
      ).run(byIdentity.id);
    }
    const session = createSession(byIdentity.id);
    return { user: getUserById(byIdentity.id), session, created: false };
  }

  let email = normalizeEmail(identity.email);
  if (!email) {
    email = `${provider}.${subject.replace(/[^\w.-]+/g, "").slice(0, 48)}@oauth.local`;
  }

  let userRow = db.prepare(`SELECT * FROM web_users WHERE email = ?`).get(email);
  let created = false;

  if (!userRow) {
    const displayName = String(identity.name ?? "").trim().slice(0, 40) || null;
    const profileJson = initialProfileJson(identity.accountType);
    const info = db
      .prepare(
        `INSERT INTO web_users (
           email, password_salt, password_hash, display_name, profile_json, email_verified
         ) VALUES (?, '', '', ?, ?, 1)`
      )
      .run(email, displayName, profileJson);
    userRow = db.prepare(`SELECT * FROM web_users WHERE id = ?`).get(Number(info.lastInsertRowid));
    created = true;
  } else if (Number(userRow.email_verified) !== 1) {
    db.prepare(
      `UPDATE web_users
       SET email_verified = 1, activation_token_hash = NULL, activation_expires_at = NULL,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(userRow.id);
  }

  linkIdentity(userRow.id, {
    provider,
    subject,
    email,
    profile: identity.profile ?? {},
  });

  if (identity.name && !userRow.display_name) {
    const name = String(identity.name).trim().slice(0, 40);
    if (name) {
      db.prepare(
        `UPDATE web_users SET display_name = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(name, userRow.id);
    }
  }

  const session = createSession(userRow.id);
  return { user: getUserById(userRow.id), session, created };
}

export function listUserIdentities(userId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT provider, provider_subject, email, created_at
       FROM web_user_identities WHERE user_id = ? ORDER BY provider`
    )
    .all(userId);
}

export function destroySession(token) {
  if (!token) return;
  const db = getDb();
  db.prepare(`DELETE FROM web_sessions WHERE token_hash = ?`).run(tokenHash(token));
}

export function getUserBySessionToken(token, opts = {}) {
  if (!token) return null;
  try {
    const db = getDb();
    if (!opts.skipPurge && Math.random() < 0.02) {
      try {
        db.prepare(`DELETE FROM web_sessions WHERE expires_at < datetime('now')`).run();
      } catch {
        /* readonly DB */
      }
    }
    if (opts.light) {
      const row = db
        .prepare(
          `SELECT u.id, u.email, u.display_name, u.email_verified, u.created_at, u.updated_at
           FROM web_sessions s
           JOIN web_users u ON u.id = s.user_id
           WHERE s.token_hash = ? AND s.expires_at >= datetime('now')`
        )
        .get(tokenHash(token));
      if (!row) return null;
      const email = String(row.email ?? "");
      return {
        id: row.id,
        email,
        displayName:
          String(row.display_name ?? "").trim() || email.split("@")[0] || "Felhasználó",
        emailVerified: row.email_verified === true || Number(row.email_verified) === 1,
        profile: emptyProfile(),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }
    const row = db
      .prepare(
        `SELECT u.*
         FROM web_sessions s
         JOIN web_users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at >= datetime('now')`
      )
      .get(tokenHash(token));
    return publicUser(row);
  } catch {
    return null;
  }
}

const ACTIVATION_HOURS = 24;
const PASSWORD_RESET_HOURS = 1;

function makeActivationToken() {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + ACTIVATION_HOURS * 60 * 60 * 1000);
  const expiresAt = expires.toISOString().slice(0, 19).replace("T", " ");
  return { token, expiresAt, expires };
}

function storeActivationToken(userId, token, expiresAt) {
  const db = getDb();
  db.prepare(
    `UPDATE web_users
     SET activation_token_hash = ?, activation_expires_at = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(tokenHash(token), expiresAt, userId);
}

export function registerUser(email, password, passwordConfirm, accountType) {
  const normalized = normalizeEmail(email);
  const pass = String(password ?? "").trim();
  const confirm = String(passwordConfirm ?? "").trim();
  if (!normalized || !pass) {
    throw new Error("Email és jelszó kötelező.");
  }
  if (!normalized.includes("@")) {
    throw new Error("Érvénytelen email cím.");
  }
  if (pass.length < 12) {
    throw new Error("A jelszó legalább 12 karakter legyen.");
  }
  if (pass !== confirm) {
    throw new Error("A két jelszó nem egyezik.");
  }

  const db = getDb();
  const existing = db.prepare(`SELECT id, email_verified FROM web_users WHERE email = ?`).get(normalized);
  if (existing && Number(existing.email_verified) === 1) {
    throw new Error("Ez az email már regisztrálva van.");
  }

  const { salt, hash } = hashPassword(pass);
  const { token, expiresAt } = makeActivationToken();
  const profileJson = initialProfileJson(accountType);

  let userId;
  if (existing) {
    // Újra-regisztráció: még nem aktivált fiók — jelszó + új token.
    db.prepare(
      `UPDATE web_users
       SET password_salt = ?, password_hash = ?, email_verified = 0,
           activation_token_hash = ?, activation_expires_at = ?,
           profile_json = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(salt, hash, tokenHash(token), expiresAt, profileJson, existing.id);
    userId = existing.id;
  } else {
    const info = db
      .prepare(
        `INSERT INTO web_users (
           email, password_salt, password_hash, profile_json,
           email_verified, activation_token_hash, activation_expires_at
         ) VALUES (?, ?, ?, ?, 0, ?, ?)`
      )
      .run(normalized, salt, hash, profileJson, tokenHash(token), expiresAt);
    userId = Number(info.lastInsertRowid);
  }

  return {
    userId,
    email: normalized,
    activationToken: token,
    needsActivation: true,
  };
}

export function activateUserByToken(rawToken) {
  const token = String(rawToken ?? "").trim();
  if (!token || token.length < 16) {
    throw new Error("Érvénytelen aktiváló link.");
  }
  const db = getDb();
  const row = db
    .prepare(
      `SELECT * FROM web_users
       WHERE activation_token_hash = ?
         AND activation_expires_at IS NOT NULL
         AND activation_expires_at >= datetime('now')`
    )
    .get(tokenHash(token));
  if (!row) {
    throw new Error("Az aktiváló link lejárt vagy érvénytelen.");
  }

  db.prepare(
    `UPDATE web_users
     SET email_verified = 1,
         activation_token_hash = NULL,
         activation_expires_at = NULL,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(row.id);

  const session = createSession(row.id);
  const user = getUserById(row.id);
  return { user, session };
}

export function createActivationForEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("Email kötelező.");
  const db = getDb();
  const row = db.prepare(`SELECT * FROM web_users WHERE email = ?`).get(normalized);
  if (!row) throw new Error("Nincs ilyen fiók.");
  if (Number(row.email_verified) === 1) {
    throw new Error("Ez a fiók már aktiválva van — lépj be.");
  }
  const { token, expiresAt } = makeActivationToken();
  storeActivationToken(row.id, token, expiresAt);
  return { email: normalized, activationToken: token };
}

function makePasswordResetToken() {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + PASSWORD_RESET_HOURS * 60 * 60 * 1000);
  const expiresAt = expires.toISOString().slice(0, 19).replace("T", " ");
  return { token, expiresAt, expires };
}

function storePasswordResetToken(userId, token, expiresAt) {
  const db = getDb();
  db.prepare(
    `UPDATE web_users
     SET password_reset_token_hash = ?, password_reset_expires_at = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(tokenHash(token), expiresAt, userId);
}

/** Email alapú jelszó-visszaállítás kérése — nem árulja el, hogy van-e fiók. */
export function requestPasswordReset(email) {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes("@")) {
    throw new Error("Érvényes email cím szükséges.");
  }
  const db = getDb();
  const row = db.prepare(`SELECT * FROM web_users WHERE email = ?`).get(normalized);
  if (!row || !hasPasswordHash(row) || Number(row.email_verified ?? 1) !== 1) {
    return { ok: true, email: normalized, resetToken: null };
  }
  const { token, expiresAt } = makePasswordResetToken();
  storePasswordResetToken(row.id, token, expiresAt);
  return { ok: true, email: normalized, resetToken: token };
}

export function resetPasswordByToken(rawToken, password, passwordConfirm) {
  const token = String(rawToken ?? "").trim();
  const next = String(password ?? "").trim();
  const confirm = String(passwordConfirm ?? "").trim();
  if (!token || token.length < 16) throw new Error("Érvénytelen visszaállító link.");
  if (!next) throw new Error("Az új jelszó kötelező.");
  if (next.length < 12) throw new Error("Az új jelszó legalább 12 karakter legyen.");
  if (next !== confirm) throw new Error("A két jelszó nem egyezik.");

  const db = getDb();
  const row = db
    .prepare(
      `SELECT * FROM web_users
       WHERE password_reset_token_hash = ?
         AND password_reset_expires_at IS NOT NULL
         AND password_reset_expires_at >= datetime('now')`
    )
    .get(tokenHash(token));
  if (!row) throw new Error("A visszaállító link lejárt vagy érvénytelen.");

  const { salt, hash } = hashPassword(next);
  db.prepare(
    `UPDATE web_users
     SET password_salt = ?, password_hash = ?,
         password_reset_token_hash = NULL, password_reset_expires_at = NULL,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(salt, hash, row.id);
  db.prepare(`DELETE FROM web_sessions WHERE user_id = ?`).run(row.id);
  return { ok: true };
}

export function loginUser(email, password) {
  const pass = String(password ?? "").trim();
  if (!String(email ?? "").trim() || !pass) {
    throw new Error("Email/felhasználónév és jelszó kötelező.");
  }

  const row = findUserForLogin(email);
  if (!row) {
    throw new Error("Hibás email, felhasználónév vagy jelszó.");
  }
  if (!hasPasswordHash(row)) {
    throw new Error(
      "Ez a fiók Google / Apple / Facebook belépéssel készült — használd a social gombot."
    );
  }
  if (!verifyPassword(pass, row.password_salt, row.password_hash)) {
    throw new Error("Hibás email, felhasználónév vagy jelszó.");
  }
  if (Number(row.email_verified ?? 1) !== 1) {
    const err = new Error("Előbb aktiváld az emailed — nézd meg a postaládád (és a spam mappát).");
    err.code = "EMAIL_NOT_VERIFIED";
    throw err;
  }

  const session = createSession(row.id);
  return { user: publicUser(row), session };
}

export function changeUserPassword(userId, currentPassword, newPassword, newPasswordConfirm) {
  const current = String(currentPassword ?? "").trim();
  const next = String(newPassword ?? "").trim();
  const confirm = String(newPasswordConfirm ?? "").trim();
  if (!next) throw new Error("Az új jelszó kötelező.");
  if (next !== confirm) throw new Error("A két új jelszó nem egyezik.");
  if (next.length < 12) throw new Error("Az új jelszó legalább 12 karakter legyen.");

  const db = getDb();
  const row = db.prepare(`SELECT * FROM web_users WHERE id = ?`).get(userId);
  if (!row) throw new Error("Nem vagy bejelentkezve.");
  if (hasPasswordHash(row)) {
    if (!current) throw new Error("A jelenlegi és az új jelszó kötelező.");
    if (!verifyPassword(current, row.password_salt, row.password_hash)) {
      throw new Error("A jelenlegi jelszó hibás.");
    }
  }

  const { salt, hash } = hashPassword(next);
  db.prepare(
    `UPDATE web_users
     SET password_salt = ?, password_hash = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(salt, hash, userId);
}

export function setUserDisplayName(userId, name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) throw new Error("A megjelenített név kötelező.");
  if (trimmed.length > 40) throw new Error("A név maximum 40 karakter lehet.");
  const db = getDb();
  db.prepare(
    `UPDATE web_users SET display_name = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(trimmed, userId);
  return trimmed;
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

export function saveUserProfile(userId, profile) {
  const db = getDb();
  const row = db.prepare(`SELECT email, profile_json FROM web_users WHERE id = ?`).get(userId);
  if (!row?.email) {
    throw new Error("A profil mentése sikertelen (nincs ilyen felhasználó).");
  }
  const existing = profileFromRow(row);
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

  const fileResult = saveProfileToFile(row.email, next);

  const info = db
    .prepare(
      `UPDATE web_users
       SET profile_json = ?, display_name = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(JSON.stringify(next), displayName, userId);
  if (!info.changes) {
    throw new Error("A profil mentése sikertelen (nincs ilyen felhasználó).");
  }
  const verify = profileFromRow(db.prepare(`SELECT email, profile_json FROM web_users WHERE id = ?`).get(userId));
  if (verify.firstName !== next.firstName) {
    throw new Error("A profil mentése nem íródott a helyi adatbázisba.");
  }
  return { ...next, _savedTo: fileResult.path };
}

export function mergeUserProfileJson(userId, patch = {}) {
  const db = getDb();
  const row = db.prepare(`SELECT profile_json FROM web_users WHERE id = ?`).get(userId);
  if (!row) throw new Error("Nincs ilyen felhasználó.");
  let parsed = {};
  try {
    parsed = row.profile_json ? JSON.parse(row.profile_json) : {};
  } catch {
    parsed = {};
  }
  const next = { ...parsed, ...patch };
  db.prepare(
    `UPDATE web_users SET profile_json = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(JSON.stringify(next), userId);
  return getUserById(userId);
}

export function getUserDetailsForAdmin(userId) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, email, display_name, email_verified, profile_json, created_at, updated_at, last_login_at
       FROM web_users
       WHERE id = ?`
    )
    .get(userId);
  if (!row) throw new Error("Nincs ilyen felhasználó.");
  let profileJson = {};
  try {
    profileJson = row.profile_json ? JSON.parse(row.profile_json) : {};
  } catch {
    profileJson = { _parseError: true, raw: row.profile_json };
  }
  const listings = listListingsForOwner(userId);
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    emailVerified: Number(row.email_verified ?? 1) === 1,
    profileJson,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at || null,
    listingCount: listings.length,
    listings,
  };
}

export function updateWebUserForAdmin(userId, patch = {}) {
  const db = getDb();
  const sets = [];
  const params = [];

  if (patch.email !== undefined) {
    sets.push("email = ?");
    params.push(String(patch.email ?? "").trim().toLowerCase());
  }
  if (patch.displayName !== undefined) {
    sets.push("display_name = ?");
    params.push(String(patch.displayName ?? "").trim());
  }
  if (patch.emailVerified !== undefined) {
    sets.push("email_verified = ?");
    params.push(patch.emailVerified ? 1 : 0);
  }
  if (patch.profileJson !== undefined) {
    let profileJson = patch.profileJson;
    if (typeof profileJson === "string") {
      try {
        profileJson = JSON.parse(profileJson);
      } catch {
        profileJson = { _parseError: true, raw: profileJson };
      }
    }
    sets.push("profile_json = ?");
    params.push(JSON.stringify(profileJson ?? {}));
  }

  if (sets.length === 0) return getUserDetailsForAdmin(userId);

  sets.push("updated_at = datetime('now')");
  const sql = `UPDATE web_users SET ${sets.join(", ")} WHERE id = ?`;
  params.push(userId);
  db.prepare(sql).run(...params);
  return getUserDetailsForAdmin(userId);
}

export function deleteUserAccount(userId) {
  const db = getDb();
  const row = db.prepare(`SELECT email FROM web_users WHERE id = ?`).get(userId);
  db.prepare(`DELETE FROM web_sessions WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM web_users WHERE id = ?`).run(userId);
  if (row?.email) deleteProfileFromFile(row.email);
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? "").split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function getUserById(userId) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM web_users WHERE id = ?`).get(userId);
  return publicUser(row);
}

export function countWebUsers() {
  const db = getDb();
  const row = db.prepare(`SELECT COUNT(*) AS n FROM web_users`).get();
  return Number(row?.n ?? 0);
}

export function listWebUsersForAdmin() {
  const db = getDb();
  const users = db
    .prepare(
      `SELECT id, email, display_name, email_verified, profile_json, created_at, updated_at, last_login_at
       FROM web_users
       ORDER BY id`
    )
    .all();
  const counts = listingCountsByOwner();
  return users.map((row) => {
    let accountType = "private";
    try {
      const profile = row.profile_json ? JSON.parse(row.profile_json) : {};
      accountType = String(profile.accountType || "private").toLowerCase() === "business" ? "business" : "private";
    } catch {
      /* ignore */
    }
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      emailVerified: Number(row.email_verified ?? 1) === 1,
      accountType,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at || null,
      listingCount: counts.get(Number(row.id)) || 0,
    };
  });
}

function listingCountsByOwner() {
  const db = getDb();
  const map = new Map();
  try {
    const rows = db
      .prepare(
        `SELECT value AS owner_id, COUNT(DISTINCT listing_id) AS n
         FROM listing_cells
         WHERE field_key = 'owner_user_id' AND value IS NOT NULL AND TRIM(value) != ''
         GROUP BY value`
      )
      .all();
    for (const row of rows) {
      const id = Number(row.owner_id);
      if (Number.isFinite(id) && id > 0) map.set(id, Number(row.n) || 0);
    }
  } catch {
    /* listings schema missing */
  }
  return map;
}

function listListingsForOwner(userId) {
  const db = getDb();
  const id = String(userId);
  try {
    return db
      .prepare(
        `SELECT l.id, l.hirdetes_cime AS title, l.status, l.created_at AS createdAt, l.updated_at AS updatedAt
         FROM listings l
         INNER JOIN listing_cells c ON c.listing_id = l.id AND c.field_key = 'owner_user_id'
         WHERE c.value = ?
         ORDER BY l.updated_at DESC
         LIMIT 100`
      )
      .all(id)
      .map((row) => ({
        id: row.id,
        title: row.title || `Hirdetés #${row.id}`,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
  } catch {
    return [];
  }
}

/** Nyers DB + profiles.json tartalom — hibakereséshez. */
export function inspectWebUsersDb() {
  const db = getDb();
  const users = db
    .prepare(
      `SELECT id, email, display_name, profile_json, created_at, updated_at FROM web_users ORDER BY id`
    )
    .all()
    .map((row) => {
      let profile = {};
      try {
        profile = row.profile_json ? JSON.parse(row.profile_json) : {};
      } catch {
        profile = { _parseError: true, raw: row.profile_json };
      }
      const fromFile = loadProfileFromFile(row.email);
      return {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        sqliteProfile: profile,
        fileProfile: fromFile,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  const sessionCount = Number(
    db.prepare(`SELECT COUNT(*) AS n FROM web_sessions WHERE expires_at >= datetime('now')`).get()?.n ?? 0
  );
  return {
    dbPath: getDbPath(),
    profilesPath: getProfilesFilePath(),
    userCount: users.length,
    sessionCount,
    users,
    profilesFile: readProfilesStore(),
  };
}

export function getSessionTokenFromRequest(req) {
  const cookies = parseCookies(req.headers?.cookie);
  if (cookies[SESSION_COOKIE]) return cookies[SESSION_COOKIE];
  const auth = String(req.headers?.authorization ?? "");
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return "";
}

export function sessionCookieHeader(token, expires) {
  const maxAge = Math.max(0, Math.floor((expires.getTime() - Date.now()) / 1000));
  const secure = process.env.VERCEL || process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookieHeader() {
  const secure = process.env.VERCEL || process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
