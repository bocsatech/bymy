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
import { FORM_FIELD_CATALOG } from "./form-field-catalog.mjs";
import { parseCookies } from "./web-users.mjs";

const require = createRequire(import.meta.url);
export const LEVEL1_COOKIE = "bymy_level1";
export const LEVEL1_MAX_FAILED = 3;
export const LEVEL1_OTP_MINUTES = 10;
const SESSION_HOURS = 12;
const LAYOUT_KEY = "ad_form_layout";

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

function getSqlite() {
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

async function ensureBootstrap() {
  const username = normalizeUsername(process.env.LEVEL1_BOOTSTRAP_USERNAME);
  const password = String(process.env.LEVEL1_BOOTSTRAP_PASSWORD ?? "").trim();
  const email = String(process.env.LEVEL1_BOOTSTRAP_EMAIL ?? "").trim().toLowerCase();
  if (!username || !password || !email) return;

  if (isSupabaseBackend()) {
    const { count, error } = await sb()
      .from("level1_admins")
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    if ((count ?? 0) > 0) return;
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
  if (n > 0) return;
  const { salt, hash } = hashPassword(password);
  db.prepare(
    `INSERT INTO admins (username, email, password_salt, password_hash) VALUES (?, ?, ?, ?)`
  ).run(username, email, salt, hash);
}

export async function initLevel1() {
  if (!isSupabaseBackend()) getSqlite();
  await ensureBootstrap();
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
  if (!hashOk && envPasswordOk) {
    await updateAdminPassword(admin.id, pass);
    admin = { ...admin, locked: false, failed_attempts: 0 };
  } else if (!hashOk) {
    if (isLocked(admin)) throw lockedError();
    const next = await recordFailure(admin);
    if (next.locked) throw lockedError();
    const err = new Error(
      "Hibás jelszó. A Vercel LEVEL1_BOOTSTRAP_PASSWORD értékét írd be, extra szóköz nélkül."
    );
    err.code = "INVALID";
    throw err;
  }

  if (isLocked(admin) && !envPasswordOk) throw lockedError();
  if (isLocked(admin) && envPasswordOk) {
    await saveAdminLock(admin.id, 0, false);
  }

  const code = String(randomInt(100000, 1000000));
  const expires = new Date(Date.now() + LEVEL1_OTP_MINUTES * 60 * 1000);
  const expiresAt = isSupabaseBackend()
    ? expires.toISOString()
    : expires.toISOString().slice(0, 19).replace("T", " ");
  await insertOtp(admin.username, tokenHash(code), expiresAt);

  return {
    username: admin.username,
    email: admin.email,
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

export function defaultFormLayout() {
  return {
    version: 1,
    cells: FORM_FIELD_CATALOG.map((field, index) => ({
      field_key: field.field_key,
      label: field.label,
      step: field.step,
      order: (index + 1) * 10,
      colSpan: 1,
      maxWidthRem: null,
    })),
  };
}

function parseStoredLayout(value) {
  if (!value) return defaultFormLayout();
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return defaultFormLayout();
  }
}

export async function getFormLayout() {
  await initLevel1();
  if (isSupabaseBackend()) {
    const { data, error } = await sb().from("level1_kv").select("value").eq("key", LAYOUT_KEY).maybeSingle();
    if (error) throw error;
    return parseStoredLayout(data?.value);
  }
  const row = getSqlite().prepare(`SELECT value FROM kv WHERE key = ?`).get(LAYOUT_KEY);
  return parseStoredLayout(row?.value);
}

export async function saveFormLayout(layout) {
  await initLevel1();
  const incoming = layout && typeof layout === "object" ? layout : {};
  const byKey = new Map(
    (Array.isArray(incoming.cells) ? incoming.cells : []).map((cell) => [String(cell.field_key || ""), cell])
  );
  const cells = FORM_FIELD_CATALOG.map((field, index) => {
    const prev = byKey.get(field.field_key) || {};
    const maxRaw = prev.maxWidthRem;
    const maxWidthRem =
      maxRaw == null || maxRaw === "" ? null : Math.min(40, Math.max(8, Number(maxRaw)));
    return {
      field_key: field.field_key,
      label: field.label,
      step: field.step,
      order: Number.isFinite(Number(prev.order)) ? Number(prev.order) : (index + 1) * 10,
      colSpan: Number(prev.colSpan) === 2 ? 2 : 1,
      maxWidthRem: Number.isFinite(maxWidthRem) ? maxWidthRem : null,
    };
  });
  const stored = { version: 1, cells };
  const json = JSON.stringify(stored);
  if (isSupabaseBackend()) {
    const { error } = await sb().from("level1_kv").upsert({ key: LAYOUT_KEY, value: json }, { onConflict: "key" });
    if (error) throw error;
    return stored;
  }
  getSqlite().prepare(`INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(
    LAYOUT_KEY,
    json
  );
  return stored;
}

export function level1UnlockSql(username) {
  const user = normalizeUsername(username) || "FELHASZNALONEV";
  return {
    sqlite: `UPDATE admins SET locked = 0, failed_attempts = 0, updated_at = datetime('now') WHERE username = '${user}';`,
    supabase: `UPDATE level1_admins SET locked = false, failed_attempts = 0, updated_at = now() WHERE username = '${user}';`,
  };
}
