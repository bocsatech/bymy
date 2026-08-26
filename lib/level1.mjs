/**
 * Bocsatech admin — külön adatbázis (helyben: ~/.autosweb/level1.db,
 * production: Supabase level1_* táblák, nem a web_users).
 */
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "crypto";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";
import { createRequire } from "module";
import { isSupabaseBackend, getSupabase } from "./supabase/client.mjs";
import { isServerlessRuntime, supabaseMissingOnServerlessError } from "./runtime.mjs";
import { normalizeFormLayout } from "./form-layout-model.mjs";
import {
  defaultIngatlanWheelSchema,
  normalizeIngatlanWheelSchema,
  INGATLAN_WHEEL_SCHEMA_KEY,
  ingatlanWheelSchemaKvKey,
  normalizeIngatlanWheelVariant,
} from "./ingatlan-wheel-schema.mjs";
import { parseCookies } from "./web-users.mjs";
import {
  layoutKvKey,
  listLayoutCategories,
  normalizeLayoutCategory,
  isSearchLayoutCategory,
  searchPostingBaseCategory,
} from "./ad-form-layout-categories.mjs";
import { defaultSearchFormLayout } from "./search-form-layout.mjs";
import {
  SEARCH_CYLINDER_KV_KEY,
  DEFAULT_SEARCH_CYLINDER_ITEMS,
  SEARCH_CYLINDER_IMAGE_PRESETS,
  normalizeSearchCylinderMenu,
  publicSearchCylinderItems,
} from "./search-cylinder-menu.mjs";

const require = createRequire(import.meta.url);
export const LEVEL1_COOKIE = "bymy_level1";
export const LEVEL1_MAX_FAILED = 3;
export const LEVEL1_OTP_MINUTES = 10;
/** IDEIGLENES localhost admin — 2FA nélkül. Éles előtt töröld. */
export const LOCAL_DEV_ADMIN_USER = "localadmin";
export const LOCAL_DEV_ADMIN_PASS = "localadmin";
const SESSION_HOURS = 12;
const LEGACY_LAYOUT_KEY = "ad_form_layout";

let sqliteDb = null;

function DatabaseSyncClass() {
  return require("node:sqlite").DatabaseSync;
}

export function level1SqlitePath() {
  if (process.env.LEVEL1_DB_PATH) return process.env.LEVEL1_DB_PATH;
  return join(homedir(), ".autosweb", "level1.db");
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

function tokenHash(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

function normalizeUsername(value) {
  return String(value ?? "").trim().toLowerCase();
}

/** Csak localhost (nem Vercel) — ideiglenes 2FA nélküli admin. */
export function isLocalDevAdmin(username) {
  return !process.env.VERCEL && normalizeUsername(username) === LOCAL_DEV_ADMIN_USER;
}

/** IDEIGLENES: localadmin fiók SQLite-ba. Éles előtt töröld. */
async function ensureLocalDevAdmin() {
  if (process.env.VERCEL) return;
  if (isSupabaseBackend()) return;
  const db = getSqlite();
  const user = LOCAL_DEV_ADMIN_USER;
  const existing = db.prepare(`SELECT id FROM admins WHERE username = ?`).get(user);
  const { salt, hash } = hashPassword(LOCAL_DEV_ADMIN_PASS);
  if (existing) {
    db.prepare(
      `UPDATE admins SET password_salt = ?, password_hash = ?, failed_attempts = 0, locked = 0, email = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(salt, hash, "localadmin@localhost", existing.id);
    return;
  }
  db.prepare(
    `INSERT INTO admins (username, email, password_salt, password_hash) VALUES (?, ?, ?, ?)`
  ).run(user, "localadmin@localhost", salt, hash);
}

export function nextLockState(failedAttempts) {
  const next = Number(failedAttempts ?? 0) + 1;
  return { failedAttempts: next, locked: next >= LEVEL1_MAX_FAILED };
}

function publicAdmin(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
  };
}

export function maskEmail(email) {
  const raw = String(email ?? "").trim().toLowerCase();
  const at = raw.indexOf("@");
  if (at < 1) return "";
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  const keep = local.slice(0, Math.min(2, local.length));
  return `${keep}***@${domain}`;
}

function getSqlite() {
  if (isServerlessRuntime()) throw supabaseMissingOnServerlessError();
  if (sqliteDb) return sqliteDb;
  const DatabaseSync = DatabaseSyncClass();
  const path = level1SqlitePath();
  mkdirSync(dirname(path), { recursive: true });
  sqliteDb = new DatabaseSync(path);
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS otps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return sqliteDb;
}

function sb() {
  return getSupabase();
}

async function resetAllAdminLocks() {
  if (!isSupabaseBackend()) return;
  const { error } = await sb()
    .from("level1_admins")
    .update({ failed_attempts: 0, locked: false, updated_at: new Date().toISOString() })
    .gte("id", 0);
  if (error) console.warn("level1 reset locks:", error.message);
}

/** Vercel env jelszó → DB hash szinkron (bocsatechadmin + bootstrap user). */
async function syncBootstrapPasswordFromEnv() {
  const env = bootstrapEnv();
  if (!env.password) return;
  const targets = new Set([env.username, "bocsatechadmin", "bocsatech"].filter(Boolean));
  for (const name of targets) {
    const admin = await getAdminByUsername(name);
    if (!admin) continue;
    const hashOk = verifyPassword(env.password, admin.password_salt, admin.password_hash);
    if (!hashOk) {
      await updateAdminPassword(admin.id, env.password);
    } else {
      await clearAdminFailures(admin.id);
    }
    if (env.email && env.username && normalizeUsername(admin.username) === env.username) {
      await maybeSyncBootstrapEmail(admin);
    }
    if (env.email) {
      await updateAdminEmail(admin.id, env.email);
    }
  }
}

async function ensureBootstrap() {
  let username = normalizeUsername(process.env.LEVEL1_BOOTSTRAP_USERNAME);
  let password = String(process.env.LEVEL1_BOOTSTRAP_PASSWORD ?? "").trim();
  let email = String(process.env.LEVEL1_BOOTSTRAP_EMAIL ?? "").trim().toLowerCase();
  // Localhost: ha nincs env, legyen mindig van admin (Bocsatech belépés).
  if ((!username || !password || !email) && !process.env.VERCEL) {
    username = username || "bocsatechadmin";
    password = password || "bymyadmin";
    email = email || "admin@localhost.local";
  }
  if (!username || !password || !email) return;

  if (isSupabaseBackend()) {
    const { count, error } = await sb()
      .from("level1_admins")
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    if ((count ?? 0) > 0) {
      if (username) {
        const { data: existing } = await sb()
          .from("level1_admins")
          .select("id, email")
          .eq("username", username)
          .maybeSingle();
        if (!existing && !process.env.VERCEL) {
          const { salt, hash } = hashPassword(password);
          await sb().from("level1_admins").insert({
            username,
            email,
            password_salt: salt,
            password_hash: hash,
            failed_attempts: 0,
            locked: false,
          });
        } else if (existing) {
          // Bootstrap user: cold start / deploy után feloldjuk (mint SQLite localhost).
          await sb()
            .from("level1_admins")
            .update({
              failed_attempts: 0,
              locked: false,
              ...(email ? { email } : {}),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        }
      }
      return;
    }
    const { salt, hash } = hashPassword(password);
    const { error: insErr } = await sb().from("level1_admins").insert({
      username,
      email,
      password_salt: salt,
      password_hash: hash,
      failed_attempts: 0,
      locked: false,
    });
    if (insErr) throw insErr;
    return;
  }

  const db = getSqlite();
  const n = Number(db.prepare(`SELECT COUNT(*) AS n FROM admins`).get()?.n ?? 0);
  const existingUser = db.prepare(`SELECT id FROM admins WHERE username = ?`).get(username);
  if (existingUser) {
    db.prepare(
      `UPDATE admins SET failed_attempts = 0, locked = 0, email = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(email, existingUser.id);
    return;
  }
  if (n > 0 && process.env.VERCEL) return;
  const { salt, hash } = hashPassword(password);
  db.prepare(
    `INSERT INTO admins (username, email, password_salt, password_hash) VALUES (?, ?, ?, ?)`
  ).run(username, email, salt, hash);
}

export async function initLevel1() {
  if (!isSupabaseBackend()) getSqlite();
  await ensureBootstrap();
  if (isSupabaseBackend()) {
    await resetAllAdminLocks();
    await syncBootstrapPasswordFromEnv();
  }
  await ensureLocalDevAdmin();
}

async function getAdminByUsername(username) {
  const key = normalizeUsername(username);
  if (!key) return null;
  if (isSupabaseBackend()) {
    const { data, error } = await sb().from("level1_admins").select("*").eq("username", key).maybeSingle();
    if (error) throw error;
    return data || null;
  }
  return getSqlite().prepare(`SELECT * FROM admins WHERE username = ?`).get(key) || null;
}

async function saveAdminLock(id, failedAttempts, locked) {
  if (isSupabaseBackend()) {
    const { error } = await sb()
      .from("level1_admins")
      .update({
        failed_attempts: failedAttempts,
        locked,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    return;
  }
  getSqlite()
    .prepare(
      `UPDATE admins SET failed_attempts = ?, locked = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .run(failedAttempts, locked ? 1 : 0, id);
}

async function clearAdminFailures(id) {
  await saveAdminLock(id, 0, false);
}

function isLocked(row) {
  return Boolean(row?.locked) && row.locked !== 0 && row.locked !== "0" && row.locked !== false;
}

async function recordFailure(row) {
  if (!row) return { locked: false, failedAttempts: 0 };
  const next = nextLockState(row.failed_attempts);
  await saveAdminLock(row.id, next.failedAttempts, next.locked);
  return next;
}

async function insertOtp(username, codeHash, expiresAt) {
  const user = normalizeUsername(username);
  if (isSupabaseBackend()) {
    await sb().from("level1_otps").delete().eq("username", user);
    const { error } = await sb().from("level1_otps").insert({
      username: user,
      code_hash: codeHash,
      expires_at: expiresAt,
    });
    if (error) throw error;
    return;
  }
  const db = getSqlite();
  db.prepare(`DELETE FROM otps WHERE username = ?`).run(user);
  db.prepare(`INSERT INTO otps (username, code_hash, expires_at) VALUES (?, ?, ?)`).run(
    user,
    codeHash,
    expiresAt
  );
}

async function takeOtp(username) {
  const user = normalizeUsername(username);
  if (isSupabaseBackend()) {
    const { data, error } = await sb()
      .from("level1_otps")
      .select("*")
      .eq("username", user)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }
  return (
    getSqlite()
      .prepare(`SELECT * FROM otps WHERE username = ? ORDER BY id DESC LIMIT 1`)
      .get(user) || null
  );
}

async function deleteOtps(username) {
  const user = normalizeUsername(username);
  if (isSupabaseBackend()) {
    await sb().from("level1_otps").delete().eq("username", user);
    return;
  }
  getSqlite().prepare(`DELETE FROM otps WHERE username = ?`).run(user);
}

function otpExpired(expiresAt) {
  const t = new Date(String(expiresAt ?? "").replace(" ", "T")).getTime();
  return !Number.isFinite(t) || t <= Date.now();
}

async function createAdminSession(adminId) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  if (isSupabaseBackend()) {
    const { error } = await sb().from("level1_sessions").insert({
      token_hash: tokenHash(token),
      admin_id: adminId,
      expires_at: expires.toISOString(),
    });
    if (error) throw error;
    return { token, expires };
  }
  const expiresAt = expires.toISOString().slice(0, 19).replace("T", " ");
  getSqlite()
    .prepare(`INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)`)
    .run(tokenHash(token), adminId, expiresAt);
  return { token, expires };
}

export function level1CookieHeader(token, expires) {
  const maxAge = Math.max(0, Math.floor((expires.getTime() - Date.now()) / 1000));
  const secure = process.env.VERCEL ? "; Secure" : "";
  return `${LEVEL1_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export function clearLevel1CookieHeader() {
  const secure = process.env.VERCEL ? "; Secure" : "";
  return `${LEVEL1_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function getLevel1TokenFromRequest(req) {
  const cookies = parseCookies(req.headers?.cookie);
  return cookies[LEVEL1_COOKIE] || "";
}

export async function getLevel1AdminBySession(token) {
  const raw = String(token ?? "").trim();
  if (!raw) return null;
  const hash = tokenHash(raw);
  await initLevel1();
  if (isSupabaseBackend()) {
    const { data: session, error } = await sb()
      .from("level1_sessions")
      .select("admin_id, expires_at")
      .eq("token_hash", hash)
      .maybeSingle();
    if (error) throw error;
    if (!session || new Date(session.expires_at).getTime() <= Date.now()) return null;
    const { data: admin } = await sb().from("level1_admins").select("*").eq("id", session.admin_id).maybeSingle();
    if (!admin || isLocked(admin)) return null;
    return publicAdmin(admin);
  }
  const db = getSqlite();
  const session = db
    .prepare(`SELECT admin_id, expires_at FROM sessions WHERE token_hash = ?`)
    .get(hash);
  if (!session) return null;
  if (new Date(String(session.expires_at).replace(" ", "T")).getTime() <= Date.now()) return null;
  const admin = db.prepare(`SELECT * FROM admins WHERE id = ?`).get(session.admin_id);
  if (!admin || isLocked(admin)) return null;
  return publicAdmin(admin);
}

export async function destroyLevel1Session(token) {
  const raw = String(token ?? "").trim();
  if (!raw) return;
  const hash = tokenHash(raw);
  if (isSupabaseBackend()) {
    await sb().from("level1_sessions").delete().eq("token_hash", hash);
    return;
  }
  getSqlite().prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(hash);
}

function genericLoginError() {
  const err = new Error("Hibás belépési adatok.");
  err.code = "INVALID";
  return err;
}

function lockedError() {
  const err = new Error("Ez a felhasználónév zárolva van. Feloldás SQL-lel.");
  err.code = "LOCKED";
  return err;
}

async function adminCount() {
  if (isSupabaseBackend()) {
    const { count, error } = await sb().from("level1_admins").select("*", { count: "exact", head: true });
    if (error) throw error;
    return count ?? 0;
  }
  return Number(getSqlite().prepare(`SELECT COUNT(*) AS n FROM admins`).get()?.n ?? 0);
}

async function getAdminByEmail(email) {
  const key = String(email ?? "").trim().toLowerCase();
  if (!key || !key.includes("@")) return null;
  if (isSupabaseBackend()) {
    const { data, error } = await sb().from("level1_admins").select("*").eq("email", key).maybeSingle();
    if (error) throw error;
    return data || null;
  }
  return getSqlite().prepare(`SELECT * FROM admins WHERE email = ?`).get(key) || null;
}

function bootstrapEnv() {
  return {
    username: normalizeUsername(process.env.LEVEL1_BOOTSTRAP_USERNAME),
    password: String(process.env.LEVEL1_BOOTSTRAP_PASSWORD ?? "").trim(),
    email: String(process.env.LEVEL1_BOOTSTRAP_EMAIL ?? "").trim().toLowerCase(),
  };
}

async function updateAdminPassword(id, password) {
  const { salt, hash } = hashPassword(password);
  if (isSupabaseBackend()) {
    const { error } = await sb()
      .from("level1_admins")
      .update({
        password_salt: salt,
        password_hash: hash,
        failed_attempts: 0,
        locked: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    return;
  }
  getSqlite()
    .prepare(
      `UPDATE admins SET password_salt = ?, password_hash = ?, failed_attempts = 0, locked = 0, updated_at = datetime('now') WHERE id = ?`
    )
    .run(salt, hash, id);
}

async function updateAdminEmail(id, email) {
  const next = String(email ?? "").trim().toLowerCase();
  if (!next) return;
  if (isSupabaseBackend()) {
    const { error } = await sb()
      .from("level1_admins")
      .update({ email: next, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return;
  }
  getSqlite()
    .prepare(`UPDATE admins SET email = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(next, id);
}

/** Bootstrap email frissítése, ha a Vercel env változott, de a DB még a régit tárolja. */
async function maybeSyncBootstrapEmail(admin) {
  if (!admin) return admin;
  const env = bootstrapEnv();
  if (!env.username || !env.email) return admin;
  if (normalizeUsername(admin.username) !== env.username) return admin;
  if (String(admin.email || "").trim().toLowerCase() === env.email) return admin;
  await updateAdminEmail(admin.id, env.email);
  return { ...admin, email: env.email };
}

function issueOtpPayload(admin) {
  const code = String(randomInt(100000, 1000000));
  const expires = new Date(Date.now() + LEVEL1_OTP_MINUTES * 60 * 1000);
  const expiresAt = isSupabaseBackend()
    ? expires.toISOString()
    : expires.toISOString().slice(0, 19).replace("T", " ");
  return { code, expires, expiresAt };
}

export async function forceBootstrapAdmin(username, email, password) {
  const user = normalizeUsername(username);
  const mail = String(email ?? "").trim().toLowerCase();
  const pass = String(password ?? "").trim();
  if (!user || !mail || !pass) {
    throw new Error("Felhasználónév, email és jelszó kötelező.");
  }
  if (pass.length < 12) {
    throw new Error("A jelszó legalább 12 karakter legyen.");
  }

  await initLevel1();
  let admin = await getAdminByUsername(user);
  if (!admin) {
    const { salt, hash } = hashPassword(pass);
    if (isSupabaseBackend()) {
      const { data, error } = await sb()
        .from("level1_admins")
        .insert({
          username: user,
          email: mail,
          password_salt: salt,
          password_hash: hash,
          failed_attempts: 0,
          locked: false,
        })
        .select("*")
        .single();
      if (error) throw error;
      admin = data;
    } else {
      const db = getSqlite();
      const info = db
        .prepare(
          `INSERT INTO admins (username, email, password_salt, password_hash) VALUES (?, ?, ?, ?)`
        )
        .run(user, mail, salt, hash);
      admin = db.prepare(`SELECT * FROM admins WHERE id = ?`).get(info.lastInsertRowid);
    }
  } else {
    await updateAdminPassword(admin.id, pass);
    await updateAdminEmail(admin.id, mail);
    await clearAdminFailures(admin.id);
    admin = { ...admin, email: mail, locked: false, failed_attempts: 0 };
  }
  return publicAdmin(admin);
}

export async function unlockLevel1Admin(username) {
  await initLevel1();
  const user = normalizeUsername(username);
  const admin = await getAdminByUsername(user);
  if (!admin) {
    const err = new Error("Nincs ilyen admin felhasználó.");
    err.code = "INVALID";
    throw err;
  }
  await clearAdminFailures(admin.id);
  return publicAdmin(admin);
}

export async function startLevel1Login(username, password) {
  await initLevel1();
  if ((await adminCount()) === 0) {
    const err = new Error(
      "Nincs admin fiók. Állítsd be a LEVEL1_BOOTSTRAP_USERNAME / PASSWORD / EMAIL env változókat, vagy futtasd: node scripts/level1-bootstrap.mjs FELHASZNALONEV EMAIL JELSZO"
    );
    err.code = "NO_ADMIN";
    throw err;
  }
  const user = normalizeUsername(username);
  const pass = String(password ?? "").trim();
  const env = bootstrapEnv();
  let admin = await getAdminByUsername(user);
  if (!admin) admin = await getAdminByEmail(user);

  if (!admin) {
    verifyPassword(pass || "x", "00".repeat(16), "00".repeat(64));
    const err = new Error(
      "Nincs ilyen felhasználónév. A Vercel LEVEL1_BOOTSTRAP_USERNAME (pl. bocsatech) vagy az oda beírt emailt használd."
    );
    err.code = "INVALID";
    throw err;
  }

  const envPasswordOk = Boolean(env.password) && pass === env.password;
  const hashOk = verifyPassword(pass, admin.password_salt, admin.password_hash);
  const passwordOk = hashOk || envPasswordOk;

  if (!passwordOk) {
    const next = await recordFailure(admin);
    if (next.locked) throw lockedError();
    const err = new Error(
      "Hibás jelszó. A Vercel LEVEL1_BOOTSTRAP_PASSWORD értékét írd be, extra szóköz nélkül."
    );
    err.code = "INVALID";
    throw err;
  }

  if (isLocked(admin)) {
    await clearAdminFailures(admin.id);
    admin = { ...admin, locked: false, failed_attempts: 0 };
  }
  if (!hashOk && envPasswordOk) {
    await updateAdminPassword(admin.id, pass);
    admin = { ...admin, locked: false, failed_attempts: 0 };
  } else {
    await clearAdminFailures(admin.id);
  }

  admin = await maybeSyncBootstrapEmail(admin);

  // IDEIGLENES: localadmin localhoston azonnal belép (nincs OTP / SMTP).
  if (isLocalDevAdmin(admin.username)) {
    await clearAdminFailures(admin.id);
    const session = await createAdminSession(admin.id);
    return {
      skipOtp: true,
      username: admin.username,
      admin: publicAdmin(admin),
      session,
    };
  }

  const { code, expires, expiresAt } = issueOtpPayload(admin);
  await insertOtp(admin.username, tokenHash(code), expiresAt);

  return {
    username: admin.username,
    email: admin.email,
    emailMasked: maskEmail(admin.email),
    code,
    expires,
  };
}

/**
 * Új kód, ha van még érvényes / nemrég indított OTP (jelszó nélkül).
 * Rate limit: 45 mp.
 */
export async function resendLevel1Otp(username) {
  await initLevel1();
  const user = normalizeUsername(username);
  let admin = await getAdminByUsername(user);
  if (!admin) {
    const err = new Error("Nincs folyamatban lévő belépés. Előbb kérj kódot a jelszóval.");
    err.code = "NO_PENDING";
    throw err;
  }
  const existing = await takeOtp(user);
  if (!existing) {
    const err = new Error("Nincs folyamatban lévő belépés. Előbb kérj kódot a jelszóval.");
    err.code = "NO_PENDING";
    throw err;
  }
  if (otpExpired(existing.expires_at)) {
    const err = new Error("A kód lejárt. Kérj újat a jelszavas belépéssel.");
    err.code = "EXPIRED";
    throw err;
  }
  const createdMs = Date.parse(String(existing.created_at || "").replace(" ", "T") + (String(existing.created_at || "").includes("T") ? "" : "Z"));
  if (Number.isFinite(createdMs) && Date.now() - createdMs < 45_000) {
    const err = new Error("Várj kb. 1 percet az újraküldés előtt.");
    err.code = "RATE";
    throw err;
  }

  admin = await maybeSyncBootstrapEmail(admin);
  const { code, expires, expiresAt } = issueOtpPayload(admin);
  await insertOtp(admin.username, tokenHash(code), expiresAt);

  return {
    username: admin.username,
    email: admin.email,
    emailMasked: maskEmail(admin.email),
    code,
    expires,
  };
}

export async function verifyLevel1Otp(username, code) {
  await initLevel1();
  const user = normalizeUsername(username);
  const rawCode = String(code ?? "").replace(/\s+/g, "");
  const admin = await getAdminByUsername(user);
  if (!admin) throw genericLoginError();
  if (isLocked(admin)) throw lockedError();

  const otp = await takeOtp(user);
  const expected = Buffer.from(String(otp?.code_hash ?? ""), "hex");
  const given = Buffer.from(tokenHash(rawCode), "hex");
  const ok =
    Boolean(otp) &&
    !otpExpired(otp.expires_at) &&
    rawCode.length === 6 &&
    expected.length === given.length &&
    timingSafeEqual(given, expected);

  if (!ok) {
    const next = await recordFailure(admin);
    if (next.locked) throw lockedError();
    throw genericLoginError();
  }

  await deleteOtps(user);
  await clearAdminFailures(admin.id);
  const session = await createAdminSession(admin.id);
  return { admin: publicAdmin(admin), session };
}

export function defaultFormLayout(category = "szemelyauto") {
  return normalizeFormLayout({ cells: [] }, { category });
}

function parseStoredLayout(value, category) {
  let raw = {};
  if (!value) raw = {};
  else if (typeof value === "object") raw = value;
  else {
    try {
      raw = JSON.parse(value);
    } catch {
      raw = {};
    }
  }
  const layout = normalizeFormLayout(raw, { category });
  const cat = normalizeLayoutCategory(category);
  layout.category = cat;
  layout.live = value != null && value !== "";
  return layout;
}

async function readKv(key) {
  if (isSupabaseBackend()) {
    const { data, error } = await sb().from("level1_kv").select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    return data?.value ?? null;
  }
  const row = getSqlite().prepare(`SELECT value FROM kv WHERE key = ?`).get(key);
  return row?.value ?? null;
}

async function writeKv(key, json) {
  if (isSupabaseBackend()) {
    const { error } = await sb().from("level1_kv").upsert({ key, value: json }, { onConflict: "key" });
    if (error) throw error;
    return;
  }
  getSqlite()
    .prepare(`INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .run(key, json);
}

export async function getFormLayout(categoryInput = "szemelyauto") {
  await initLevel1();
  const category = normalizeLayoutCategory(categoryInput);
  const key = layoutKvKey(category);
  let value = await readKv(key);
  if (value == null && category === "szemelyauto") {
    value = await readKv(LEGACY_LAYOUT_KEY);
  }
  if (value != null && value !== "") {
    return parseStoredLayout(value, category);
  }
  if (isSearchLayoutCategory(category)) {
    const posting = await getFormLayout(searchPostingBaseCategory(category));
    const layout = defaultSearchFormLayout(posting, category);
    layout.category = category;
    layout.live = false;
    return layout;
  }
  return parseStoredLayout(null, category);
}

export async function saveFormLayout(layout, categoryInput = "szemelyauto") {
  await initLevel1();
  const category = normalizeLayoutCategory(categoryInput || layout?.category);
  const stored = normalizeFormLayout(layout && typeof layout === "object" ? layout : {}, { category });
  stored.category = category;
  stored.live = true;
  const json = JSON.stringify(stored);
  await writeKv(layoutKvKey(category), json);
  return stored;
}

export async function getIngatlanWheelSchema(variant = "ingatlan") {
  await initLevel1();
  const v = normalizeIngatlanWheelVariant(variant);
  const key = ingatlanWheelSchemaKvKey(v);

  async function readNormalized(kvKey) {
    const value = await readKv(kvKey);
    if (value == null || value === "") return null;
    try {
      return normalizeIngatlanWheelSchema(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (v === "ingatlan") {
    return (await readNormalized(key)) || defaultIngatlanWheelSchema();
  }

  const own = await readNormalized(key);
  if (own) return own;

  const master = await readNormalized(INGATLAN_WHEEL_SCHEMA_KEY);
  const base = master || defaultIngatlanWheelSchema();
  return normalizeIngatlanWheelSchema(JSON.parse(JSON.stringify(base)));
}

export async function saveIngatlanWheelSchema(schema, variant = "ingatlan") {
  await initLevel1();
  const key = ingatlanWheelSchemaKvKey(variant);
  const stored = normalizeIngatlanWheelSchema(schema && typeof schema === "object" ? schema : {});
  await writeKv(key, JSON.stringify(stored));
  return stored;
}

export async function getSearchCylinderMenu() {
  await initLevel1();
  const value = await readKv(SEARCH_CYLINDER_KV_KEY);
  if (value == null || value === "") {
    return normalizeSearchCylinderMenu({ items: DEFAULT_SEARCH_CYLINDER_ITEMS });
  }
  try {
    return normalizeSearchCylinderMenu(JSON.parse(value));
  } catch {
    return normalizeSearchCylinderMenu({ items: DEFAULT_SEARCH_CYLINDER_ITEMS });
  }
}

export async function saveSearchCylinderMenu(menu) {
  await initLevel1();
  const stored = normalizeSearchCylinderMenu(menu && typeof menu === "object" ? menu : {});
  await writeKv(SEARCH_CYLINDER_KV_KEY, JSON.stringify(stored));
  return stored;
}

export async function getSearchCylinderPublic() {
  const menu = await getSearchCylinderMenu();
  return {
    items: publicSearchCylinderItems(menu),
    imagePresets: SEARCH_CYLINDER_IMAGE_PRESETS,
  };
}

export { listLayoutCategories, normalizeLayoutCategory };

export function level1UnlockSql(username) {
  const user = normalizeUsername(username) || "FELHASZNALONEV";
  return {
    sqlite: `UPDATE admins SET locked = 0, failed_attempts = 0, updated_at = datetime('now') WHERE username = '${user}';`,
    supabase: `UPDATE level1_admins SET locked = false, failed_attempts = 0, updated_at = now() WHERE username = '${user}';`,
  };
}
