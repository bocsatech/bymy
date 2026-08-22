/**
 * Oldallátogatók nyomkövetése (admin: jelenleg / nap / hét / hónap + eszközlista).
 * SQLite: autosweb.db · Supabase: site_visitor_sessions + site_page_hits
 */

import { randomBytes, createHash } from "crypto";
import { getDb } from "./db.mjs";
import { isSupabaseBackend, getSupabase } from "./supabase/client.mjs";

const ONLINE_MS = 5 * 60 * 1000;
const VISITOR_COOKIE = "bymy_vid";

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function sqlDayStart(daysAgo = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function parseUserAgent(uaRaw) {
  const ua = String(uaRaw || "");
  const lower = ua.toLowerCase();

  let deviceType = "asztali";
  if (/ipad|tablet|kindle|playbook|silk|(android(?!.*mobile))/i.test(ua)) deviceType = "tablet";
  else if (/mobi|iphone|ipod|android.*mobile|windows phone|opera mini/i.test(ua)) deviceType = "telefon";

  let os = "Ismeretlen";
  if (/windows nt/i.test(ua)) os = "Windows";
  else if (/android/i.test(ua)) {
    const m = ua.match(/Android\s+([\d.]+)/i);
    os = m ? `Android ${m[1]}` : "Android";
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    const m = ua.match(/OS\s+([\d_]+)/i);
    os = m ? `iOS ${m[1].replace(/_/g, ".")}` : "iOS";
  } else if (/mac os x/i.test(ua)) {
    const m = ua.match(/Mac OS X\s+([\d_]+)/i);
    os = m ? `macOS ${m[1].replace(/_/g, ".")}` : "macOS";
  } else if (/linux/i.test(ua)) os = "Linux";
  else if (/cros/i.test(ua)) os = "Chrome OS";

  let browser = "Ismeretlen";
  if (/edg\//i.test(ua)) {
    const m = ua.match(/Edg\/([\d.]+)/i);
    browser = m ? `Edge ${m[1]}` : "Edge";
  } else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) {
    const m = ua.match(/Chrome\/([\d.]+)/i);
    browser = m ? `Chrome ${m[1]}` : "Chrome";
  } else if (/firefox\//i.test(ua)) {
    const m = ua.match(/Firefox\/([\d.]+)/i);
    browser = m ? `Firefox ${m[1]}` : "Firefox";
  } else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) {
    const m = ua.match(/Version\/([\d.]+)/i);
    browser = m ? `Safari ${m[1]}` : "Safari";
  } else if (/opera|opr\//i.test(ua)) browser = "Opera";

  let deviceName = "";
  const iphone = ua.match(/iPhone/i);
  const ipad = ua.match(/iPad/i);
  const androidModel = ua.match(/;\s*([^;)]+)\s+Build\//i);
  if (iphone) deviceName = "iPhone";
  else if (ipad) deviceName = "iPad";
  else if (androidModel) deviceName = String(androidModel[1]).trim().slice(0, 64);
  else if (deviceType === "asztali") deviceName = os;
  else deviceName = deviceType === "telefon" ? "Mobil" : "Tablet";

  const deviceLabel = `${deviceName} · ${browser} · ${os}`;

  return { deviceType, deviceName, deviceLabel, browser, os, userAgent: ua.slice(0, 512) };
}

export function parseClientHints(body = {}, req = {}) {
  const ua = String(body.userAgent || req.headers?.["user-agent"] || "");
  const parsed = parseUserAgent(ua);
  const screenW = Number(body.screenWidth) || 0;
  const screenH = Number(body.screenHeight) || 0;
  const screen = screenW && screenH ? `${screenW}×${screenH}` : String(body.screen || "").slice(0, 32);
  return {
    ...parsed,
    language: String(body.language || req.headers?.["accept-language"] || "")
      .split(",")[0]
      .trim()
      .slice(0, 32),
    screen,
    path: String(body.path || "/").slice(0, 500),
    referrer: String(body.referrer || "").slice(0, 500),
    timezone: String(body.timezone || "").slice(0, 64),
  };
}

function newVisitorId() {
  return randomBytes(16).toString("hex");
}

export function getVisitorIdFromRequest(req) {
  const cookie = String(req.headers?.cookie || "");
  const m = cookie.match(/(?:^|;\s*)bymy_vid=([a-f0-9]{32})/i);
  if (m) return m[1];
  const hdr = String(req.headers?.["x-bymy-vid"] || "").trim();
  if (/^[a-f0-9]{32}$/i.test(hdr)) return hdr;
  return "";
}

export function visitorCookieHeader(visitorId, maxAgeSec = 365 * 24 * 3600) {
  const secure = process.env.VERCEL || process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${VISITOR_COOKIE}=${visitorId}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
}

function ensureSqliteSchema(db = getDb()) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_visitor_sessions (
      id TEXT PRIMARY KEY,
      ip TEXT,
      user_agent TEXT,
      device_type TEXT,
      device_name TEXT,
      device_label TEXT,
      browser TEXT,
      os TEXT,
      language TEXT,
      screen TEXT,
      timezone TEXT,
      hit_count INTEGER NOT NULL DEFAULT 0,
      first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS site_page_hits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT NOT NULL,
      path TEXT,
      referrer TEXT,
      ip TEXT,
      user_agent TEXT,
      device_type TEXT,
      device_name TEXT,
      device_label TEXT,
      browser TEXT,
      os TEXT,
      language TEXT,
      screen TEXT,
      timezone TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_site_visitors_last ON site_visitor_sessions(last_seen_at DESC);
    CREATE INDEX IF NOT EXISTS idx_site_hits_created ON site_page_hits(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_site_hits_visitor ON site_page_hits(visitor_id);
  `);
}

async function recordVisitSqlite(payload) {
  const db = getDb();
  ensureSqliteSchema(db);
  const ts = nowSql();
  const existing = db.prepare(`SELECT id, hit_count FROM site_visitor_sessions WHERE id = ?`).get(payload.visitorId);
  if (existing) {
    db.prepare(
      `UPDATE site_visitor_sessions SET
        ip = ?, user_agent = ?, device_type = ?, device_name = ?, device_label = ?,
        browser = ?, os = ?, language = ?, screen = ?, timezone = ?,
        hit_count = hit_count + 1, last_seen_at = ?
       WHERE id = ?`
    ).run(
      payload.ip,
      payload.userAgent,
      payload.deviceType,
      payload.deviceName,
      payload.deviceLabel,
      payload.browser,
      payload.os,
      payload.language,
      payload.screen,
      payload.timezone,
      ts,
      payload.visitorId
    );
  } else {
    db.prepare(
      `INSERT INTO site_visitor_sessions (
        id, ip, user_agent, device_type, device_name, device_label,
        browser, os, language, screen, timezone, hit_count, first_seen_at, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).run(
      payload.visitorId,
      payload.ip,
      payload.userAgent,
      payload.deviceType,
      payload.deviceName,
      payload.deviceLabel,
      payload.browser,
      payload.os,
      payload.language,
      payload.screen,
      payload.timezone,
      ts,
      ts
    );
  }

  if (payload.kind !== "heartbeat") {
    db.prepare(
      `INSERT INTO site_page_hits (
        visitor_id, path, referrer, ip, user_agent, device_type, device_name, device_label,
        browser, os, language, screen, timezone, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      payload.visitorId,
      payload.path,
      payload.referrer,
      payload.ip,
      payload.userAgent,
      payload.deviceType,
      payload.deviceName,
      payload.deviceLabel,
      payload.browser,
      payload.os,
      payload.language,
      payload.screen,
      payload.timezone,
      ts
    );
  }
}

async function recordVisitSupabase(payload) {
  const sb = getSupabase();
  const ts = new Date().toISOString();
  const { data: existing } = await sb
    .from("site_visitor_sessions")
    .select("id, hit_count")
    .eq("id", payload.visitorId)
    .maybeSingle();

  if (existing) {
    const { error } = await sb
      .from("site_visitor_sessions")
      .update({
        ip: payload.ip,
        user_agent: payload.userAgent,
        device_type: payload.deviceType,
        device_name: payload.deviceName,
        device_label: payload.deviceLabel,
        browser: payload.browser,
        os: payload.os,
        language: payload.language,
        screen: payload.screen,
        timezone: payload.timezone,
        hit_count: Number(existing.hit_count || 0) + 1,
        last_seen_at: ts,
      })
      .eq("id", payload.visitorId);
    if (error) throw error;
  } else {
    const { error } = await sb.from("site_visitor_sessions").insert({
      id: payload.visitorId,
      ip: payload.ip,
      user_agent: payload.userAgent,
      device_type: payload.deviceType,
      device_name: payload.deviceName,
      device_label: payload.deviceLabel,
      browser: payload.browser,
      os: payload.os,
      language: payload.language,
      screen: payload.screen,
      timezone: payload.timezone,
      hit_count: 1,
      first_seen_at: ts,
      last_seen_at: ts,
    });
    if (error) throw error;
  }

  if (payload.kind !== "heartbeat") {
    const { error: hitErr } = await sb.from("site_page_hits").insert({
      visitor_id: payload.visitorId,
      path: payload.path,
      referrer: payload.referrer,
      ip: payload.ip,
      user_agent: payload.userAgent,
      device_type: payload.deviceType,
      device_name: payload.deviceName,
      device_label: payload.deviceLabel,
      browser: payload.browser,
      os: payload.os,
      language: payload.language,
      screen: payload.screen,
      timezone: payload.timezone,
      created_at: ts,
    });
    if (hitErr) throw hitErr;
  }
}

/**
 * @returns {{ visitorId: string, setCookie: boolean }}
 */
export async function recordPageVisit(req, body = {}) {
  const hints = parseClientHints(body, req);
  let visitorId = String(body.visitorId || getVisitorIdFromRequest(req) || "").trim();
  let setCookie = false;
  if (!/^[a-f0-9]{32}$/i.test(visitorId)) {
    visitorId = newVisitorId();
    setCookie = true;
  }

  const { clientIp } = await import("./rate-limit.mjs");
  const payload = {
    visitorId,
    ip: clientIp(req),
    kind: String(body.kind || "page"),
    ...hints,
  };

  if (isSupabaseBackend()) {
    try {
      await recordVisitSupabase(payload);
    } catch (err) {
      // Tábla hiányzik / hiba — ne törje el a oldalt
      console.warn("[site-visitors] supabase:", err.message ?? err);
    }
  } else {
    await recordVisitSqlite(payload);
  }

  return { visitorId, setCookie };
}

function countHitsSinceSqlite(sinceSql) {
  const db = getDb();
  ensureSqliteSchema(db);
  const hits = Number(
    db.prepare(`SELECT COUNT(*) AS n FROM site_page_hits WHERE created_at >= ?`).get(sinceSql)?.n ?? 0
  );
  const unique = Number(
    db
      .prepare(`SELECT COUNT(DISTINCT visitor_id) AS n FROM site_page_hits WHERE created_at >= ?`)
      .get(sinceSql)?.n ?? 0
  );
  return { hits, unique };
}

async function countHitsSinceSupabase(sinceIso) {
  const sb = getSupabase();
  const { count: hits, error } = await sb
    .from("site_page_hits")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sinceIso);
  if (error) throw error;
  const { data, error: uErr } = await sb
    .from("site_page_hits")
    .select("visitor_id")
    .gte("created_at", sinceIso);
  if (uErr) throw uErr;
  const unique = new Set((data || []).map((r) => r.visitor_id)).size;
  return { hits: hits ?? 0, unique };
}

function mapDeviceRow(row) {
  return {
    id: row.id,
    ip: row.ip || "",
    deviceName: row.device_name || "",
    deviceType: row.device_type || "",
    deviceLabel: row.device_label || "",
    browser: row.browser || "",
    os: row.os || "",
    userAgent: row.user_agent || "",
    language: row.language || "",
    screen: row.screen || "",
    timezone: row.timezone || "",
    hitCount: Number(row.hit_count ?? 0),
    firstSeenAt: row.first_seen_at || "",
    lastSeenAt: row.last_seen_at || "",
  };
}

function isMissingVisitorTableError(msg) {
  const s = String(msg || "").toLowerCase();
  return (
    s.includes("site_page_hits") ||
    s.includes("site_visitor_sessions") ||
    s.includes("schema cache") ||
    s.includes("does not exist") ||
    s.includes("could not find the table")
  );
}

export async function getVisitorAdminStats() {
  const onlineCutoff = new Date(Date.now() - ONLINE_MS).toISOString().slice(0, 19).replace("T", " ");
  const day = sqlDayStart(0);
  const week = sqlDayStart(6);
  const month = sqlDayStart(29);

  if (isSupabaseBackend()) {
    try {
      const sb = getSupabase();
      const onlineIso = new Date(Date.now() - ONLINE_MS).toISOString();
      const { count: online } = await sb
        .from("site_visitor_sessions")
        .select("*", { count: "exact", head: true })
        .gte("last_seen_at", onlineIso);
      const daily = await countHitsSinceSupabase(new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
      const weekly = await countHitsSinceSupabase(new Date(Date.now() - 7 * 864e5).toISOString());
      const monthly = await countHitsSinceSupabase(new Date(Date.now() - 30 * 864e5).toISOString());
      const { data: devices, error } = await sb
        .from("site_visitor_sessions")
        .select("*")
        .order("last_seen_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return {
        online: online ?? 0,
        daily,
        weekly,
        monthly,
        devices: (devices || []).map(mapDeviceRow),
        onlineWindowMinutes: 5,
      };
    } catch (err) {
      const msg = String(err.message || err);
      const missing = isMissingVisitorTableError(msg);
      return {
        online: 0,
        daily: { hits: 0, unique: 0 },
        weekly: { hits: 0, unique: 0 },
        monthly: { hits: 0, unique: 0 },
        devices: [],
        onlineWindowMinutes: 5,
        warning: missing
          ? "A látogató táblák még nem elérhetők. Futtasd újra a 007 migrációt a Supabase SQL Editorban (a fájl végén van egy NOTIFY sor is), várj 1 percet, majd frissíts."
          : msg,
        schemaMissing: missing,
      };
    }
  }

  const db = getDb();
  ensureSqliteSchema(db);
  const online = Number(
    db.prepare(`SELECT COUNT(*) AS n FROM site_visitor_sessions WHERE last_seen_at >= ?`).get(onlineCutoff)?.n ?? 0
  );
  return {
    online,
    daily: countHitsSinceSqlite(day),
    weekly: countHitsSinceSqlite(week),
    monthly: countHitsSinceSqlite(month),
    devices: db
      .prepare(`SELECT * FROM site_visitor_sessions ORDER BY last_seen_at DESC LIMIT 200`)
      .all()
      .map(mapDeviceRow),
    onlineWindowMinutes: 5,
  };
}

/** Teszt / UA parse export */
export { parseUserAgent, VISITOR_COOKIE, ONLINE_MS };

/** Hash helper ha kell anonimizálni később */
export function hashIp(ip) {
  return createHash("sha256").update(String(ip || "")).digest("hex").slice(0, 16);
}
