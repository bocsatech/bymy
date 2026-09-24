
import { randomBytes, createHash } from "crypto";
import { getDb } from "./db.mjs";
import { isSupabaseBackend, getSupabase } from "./supabase/client.mjs";
import { getSessionTokenFromRequest, getUserBySessionToken } from "./web-users.mjs";
import { isIpBlocked } from "./site-ip-blocks.mjs";

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
  const vw = Number(body.viewportWidth) || 0;
  const vh = Number(body.viewportHeight) || 0;
  const viewport = vw && vh ? `${vw}×${vh}` : "";
  const mem = Number(body.deviceMemory);
  const cores = Number(body.hardwareConcurrency);
  return {
    ...parsed,
    language: String(body.language || req.headers?.["accept-language"] || "")
      .split(",")[0]
      .trim()
      .slice(0, 32),
    screen,
    viewport,
    pixelRatio: Number(body.pixelRatio) || null,
    platform: String(body.platform || "").slice(0, 64),
    connectionType: String(body.connection || body.connectionType || "").slice(0, 32),
    pageTitle: String(body.pageTitle || "").slice(0, 256),
    hardwareConcurrency: Number.isFinite(cores) && cores > 0 ? cores : null,
    deviceMemory: Number.isFinite(mem) && mem > 0 ? mem : null,
    cookieEnabled: body.cookieEnabled === false ? 0 : body.cookieEnabled === true ? 1 : null,
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

function migrateSqliteColumns(db) {
  const extra = {
    site_visitor_sessions: [
      ["user_id", "INTEGER"],
      ["last_path", "TEXT"],
      ["viewport", "TEXT"],
      ["pixel_ratio", "REAL"],
      ["platform", "TEXT"],
      ["connection_type", "TEXT"],
      ["hardware_concurrency", "INTEGER"],
      ["device_memory", "REAL"],
    ],
    site_page_hits: [
      ["user_id", "INTEGER"],
      ["page_title", "TEXT"],
      ["viewport", "TEXT"],
      ["pixel_ratio", "REAL"],
      ["platform", "TEXT"],
      ["connection_type", "TEXT"],
      ["hardware_concurrency", "INTEGER"],
      ["device_memory", "REAL"],
      ["cookie_enabled", "INTEGER"],
      ["kind", "TEXT DEFAULT 'page'"],
    ],
  };
  for (const [table, cols] of Object.entries(extra)) {
    const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((r) => r.name));
    for (const [name, ddl] of cols) {
      if (!existing.has(name)) {
        try {
          db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
        } catch {
        }
      }
    }
  }
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
  migrateSqliteColumns(db);
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
        user_id = COALESCE(?, user_id), last_path = ?, viewport = ?, pixel_ratio = ?,
        platform = ?, connection_type = ?, hardware_concurrency = ?, device_memory = ?,
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
      payload.userId,
      payload.path,
      payload.viewport,
      payload.pixelRatio,
      payload.platform,
      payload.connectionType,
      payload.hardwareConcurrency,
      payload.deviceMemory,
      ts,
      payload.visitorId
    );
  } else {
    db.prepare(
      `INSERT INTO site_visitor_sessions (
        id, ip, user_agent, device_type, device_name, device_label,
        browser, os, language, screen, timezone, user_id, last_path, viewport,
        pixel_ratio, platform, connection_type, hardware_concurrency, device_memory,
        hit_count, first_seen_at, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
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
      payload.userId,
      payload.path,
      payload.viewport,
      payload.pixelRatio,
      payload.platform,
      payload.connectionType,
      payload.hardwareConcurrency,
      payload.deviceMemory,
      ts,
      ts
    );
  }

  if (payload.kind !== "heartbeat") {
    db.prepare(
      `INSERT INTO site_page_hits (
        visitor_id, path, referrer, ip, user_agent, device_type, device_name, device_label,
        browser, os, language, screen, timezone, user_id, page_title, viewport, pixel_ratio,
        platform, connection_type, hardware_concurrency, device_memory, cookie_enabled, kind, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      payload.userId,
      payload.pageTitle,
      payload.viewport,
      payload.pixelRatio,
      payload.platform,
      payload.connectionType,
      payload.hardwareConcurrency,
      payload.deviceMemory,
      payload.cookieEnabled,
      payload.kind || "page",
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
    const patch = {
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
      last_path: payload.path,
      viewport: payload.viewport,
      pixel_ratio: payload.pixelRatio,
      platform: payload.platform,
      connection_type: payload.connectionType,
      hardware_concurrency: payload.hardwareConcurrency,
      device_memory: payload.deviceMemory,
      hit_count: Number(existing.hit_count || 0) + 1,
      last_seen_at: ts,
    };
    if (payload.userId) patch.user_id = payload.userId;
    const { error } = await sb.from("site_visitor_sessions").update(patch).eq("id", payload.visitorId);
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
      user_id: payload.userId,
      last_path: payload.path,
      viewport: payload.viewport,
      pixel_ratio: payload.pixelRatio,
      platform: payload.platform,
      connection_type: payload.connectionType,
      hardware_concurrency: payload.hardwareConcurrency,
      device_memory: payload.deviceMemory,
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
      user_id: payload.userId,
      page_title: payload.pageTitle,
      viewport: payload.viewport,
      pixel_ratio: payload.pixelRatio,
      platform: payload.platform,
      connection_type: payload.connectionType,
      hardware_concurrency: payload.hardwareConcurrency,
      device_memory: payload.deviceMemory,
      cookie_enabled: payload.cookieEnabled === 1,
      kind: payload.kind || "page",
      created_at: ts,
    });
    if (hitErr) throw hitErr;
  }
}

export async function recordPageVisit(req, body = {}) {
  const { clientIp } = await import("./rate-limit.mjs");
  const ip = clientIp(req);
  if (await isIpBlocked(ip)) {
    return { visitorId: "", setCookie: false, blocked: true };
  }

  const hints = parseClientHints(body, req);
  let visitorId = String(body.visitorId || getVisitorIdFromRequest(req) || "").trim();
  let setCookie = false;
  if (!/^[a-f0-9]{32}$/i.test(visitorId)) {
    visitorId = newVisitorId();
    setCookie = true;
  }
  let userId = null;
  try {
    const user = await getUserBySessionToken(getSessionTokenFromRequest(req));
    if (user?.id) userId = user.id;
  } catch {
  }
  const payload = {
    visitorId,
    ip,
    kind: String(body.kind || "page"),
    userId,
    ...hints,
  };

  if (isSupabaseBackend()) {
    try {
      await recordVisitSupabase(payload);
    } catch (err) {
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

function mapDeviceRow(row, extras = {}) {
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
    viewport: row.viewport || "",
    pixelRatio: row.pixel_ratio ?? null,
    platform: row.platform || "",
    connectionType: row.connection_type || "",
    hardwareConcurrency: row.hardware_concurrency ?? null,
    deviceMemory: row.device_memory ?? null,
    userId: row.user_id ?? null,
    lastPath: row.last_path || "",
    hitCount: Number(row.hit_count ?? 0),
    firstSeenAt: row.first_seen_at || "",
    lastSeenAt: row.last_seen_at || "",
    ...extras,
  };
}

function mapHitRow(row) {
  return {
    id: row.id,
    path: row.path || "",
    pageTitle: row.page_title || "",
    referrer: row.referrer || "",
    viewport: row.viewport || "",
    pixelRatio: row.pixel_ratio ?? null,
    platform: row.platform || "",
    connectionType: row.connection_type || "",
    hardwareConcurrency: row.hardware_concurrency ?? null,
    deviceMemory: row.device_memory ?? null,
    cookieEnabled: row.cookie_enabled ?? null,
    kind: row.kind || "page",
    userId: row.user_id ?? null,
    createdAt: row.created_at || "",
  };
}

export async function getVisitorPageHits(visitorId, { limit = 200, from = null, to = null } = {}) {
  const id = String(visitorId || "").trim();
  if (!/^[a-f0-9]{32}$/i.test(id)) return [];

  if (isSupabaseBackend()) {
    try {
      const sb = getSupabase();
      let q = sb
        .from("site_page_hits")
        .select("*")
        .eq("visitor_id", id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (from) q = q.gte("created_at", toIsoTs(from) || from);
      if (to) q = q.lt("created_at", toIsoTs(to) || to);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(mapHitRow);
    } catch (err) {
      if (isMissingVisitorTableError(err.message)) return [];
      throw err;
    }
  }

  const db = getDb();
  ensureSqliteSchema(db);
  const fromSql = from ? toSqlTs(from) : null;
  const toSql = to ? toSqlTs(to) : null;
  if (fromSql && toSql) {
    return db
      .prepare(
        `SELECT * FROM site_page_hits WHERE visitor_id = ? AND created_at >= ? AND created_at < ? ORDER BY created_at DESC LIMIT ?`
      )
      .all(id, fromSql, toSql, limit)
      .map(mapHitRow);
  }
  if (fromSql) {
    return db
      .prepare(`SELECT * FROM site_page_hits WHERE visitor_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT ?`)
      .all(id, fromSql, limit)
      .map(mapHitRow);
  }
  return db
    .prepare(`SELECT * FROM site_page_hits WHERE visitor_id = ? ORDER BY created_at DESC LIMIT ?`)
    .all(id, limit)
    .map(mapHitRow);
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

function toSqlTs(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function toIsoTs(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

function startOfLocalDay(base = new Date()) {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeekMonday(base = new Date()) {
  const d = startOfLocalDay(base);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

function startOfMonth(base = new Date()) {
  const d = startOfLocalDay(base);
  d.setDate(1);
  return d;
}

/** @returns {{ key: string, from: Date|null, to: Date|null, label: string }} */
export function resolveVisitorTimeRange(rangeRaw, fromRaw = "", toRaw = "") {
  const key = String(rangeRaw || "all").trim().toLowerCase();
  const now = new Date();

  if (key === "online" || key === "jelenleg") {
    return { key: "online", from: new Date(now.getTime() - ONLINE_MS), to: null, label: "Jelenleg" };
  }
  if (key === "today" || key === "ma") {
    const from = startOfLocalDay(now);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return { key: "today", from, to, label: "Ma" };
  }
  if (key === "yesterday" || key === "tegnap") {
    const to = startOfLocalDay(now);
    const from = new Date(to);
    from.setDate(from.getDate() - 1);
    return { key: "yesterday", from, to, label: "Tegnap" };
  }
  if (key === "week" || key === "heten") {
    const from = startOfWeekMonday(now);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);
    return { key: "week", from, to, label: "Héten" };
  }
  if (key === "lastweek" || key === "elozoheten" || key === "előzőhéten") {
    const thisMon = startOfWeekMonday(now);
    const from = new Date(thisMon);
    from.setDate(from.getDate() - 7);
    return { key: "lastweek", from, to: thisMon, label: "Előző héten" };
  }
  if (key === "month" || key === "honap" || key === "ebbenahonapban") {
    const from = startOfMonth(now);
    const to = new Date(from);
    to.setMonth(to.getMonth() + 1);
    return { key: "month", from, to, label: "Ebben a hónapban" };
  }
  if (key === "custom" || key === "intervallum") {
    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw) : null;
    const fromOk = from && Number.isFinite(from.getTime()) ? from : null;
    let toOk = to && Number.isFinite(to.getTime()) ? to : null;
    if (toOk && String(toRaw).length <= 10) {
      // date-only end → inclusive whole day
      toOk = new Date(toOk);
      toOk.setHours(23, 59, 59, 999);
      toOk = new Date(toOk.getTime() + 1);
    }
    return {
      key: "custom",
      from: fromOk,
      to: toOk,
      label: "Időintervallum",
    };
  }
  return { key: "all", from: null, to: null, label: "Összes" };
}

async function periodHitCountsSqlite(from, to) {
  const db = getDb();
  ensureSqliteSchema(db);
  const fromSql = toSqlTs(from);
  const toSql = to ? toSqlTs(to) : null;
  if (!fromSql) return new Map();
  const rows = toSql
    ? db
        .prepare(
          `SELECT visitor_id AS id, COUNT(*) AS n FROM site_page_hits
           WHERE created_at >= ? AND created_at < ? GROUP BY visitor_id`
        )
        .all(fromSql, toSql)
    : db
        .prepare(
          `SELECT visitor_id AS id, COUNT(*) AS n FROM site_page_hits
           WHERE created_at >= ? GROUP BY visitor_id`
        )
        .all(fromSql);
  return new Map(rows.map((r) => [String(r.id), Number(r.n) || 0]));
}

async function periodHitCountsSupabase(from, to) {
  const sb = getSupabase();
  const fromIso = toIsoTs(from);
  const toIso = to ? toIsoTs(to) : null;
  if (!fromIso) return new Map();
  let q = sb.from("site_page_hits").select("visitor_id").gte("created_at", fromIso).limit(8000);
  if (toIso) q = q.lt("created_at", toIso);
  const { data, error } = await q;
  if (error) throw error;
  const map = new Map();
  for (const row of data || []) {
    const id = String(row.visitor_id || "");
    if (!id) continue;
    map.set(id, (map.get(id) || 0) + 1);
  }
  return map;
}

async function countHitsBetweenSqlite(from, to) {
  const db = getDb();
  ensureSqliteSchema(db);
  const fromSql = toSqlTs(from);
  const toSql = to ? toSqlTs(to) : null;
  if (!fromSql) return { hits: 0, unique: 0 };
  if (toSql) {
    const hits = Number(
      db.prepare(`SELECT COUNT(*) AS n FROM site_page_hits WHERE created_at >= ? AND created_at < ?`).get(fromSql, toSql)?.n ?? 0
    );
    const unique = Number(
      db
        .prepare(`SELECT COUNT(DISTINCT visitor_id) AS n FROM site_page_hits WHERE created_at >= ? AND created_at < ?`)
        .get(fromSql, toSql)?.n ?? 0
    );
    return { hits, unique };
  }
  return countHitsSinceSqlite(fromSql);
}

async function countHitsBetweenSupabase(from, to) {
  const sb = getSupabase();
  const fromIso = toIsoTs(from);
  const toIso = to ? toIsoTs(to) : null;
  if (!fromIso) return { hits: 0, unique: 0 };
  let hq = sb.from("site_page_hits").select("*", { count: "exact", head: true }).gte("created_at", fromIso);
  if (toIso) hq = hq.lt("created_at", toIso);
  const { count: hits, error } = await hq;
  if (error) throw error;
  let uq = sb.from("site_page_hits").select("visitor_id").gte("created_at", fromIso).limit(8000);
  if (toIso) uq = uq.lt("created_at", toIso);
  const { data, error: uErr } = await uq;
  if (uErr) throw uErr;
  const unique = new Set((data || []).map((r) => r.visitor_id).filter(Boolean)).size;
  return { hits: hits ?? 0, unique };
}

export async function getVisitorHitsByIp(ipRaw, { from = null, to = null, limit = 400 } = {}) {
  const ip = String(ipRaw || "").trim();
  if (!ip || ip.length > 128) return [];

  if (isSupabaseBackend()) {
    try {
      const sb = getSupabase();
      const { data: sessions } = await sb.from("site_visitor_sessions").select("id").eq("ip", ip).limit(100);
      const ids = (sessions || []).map((s) => s.id).filter(Boolean);

      const fetchHits = async (builder) => {
        let q = builder.order("created_at", { ascending: false }).limit(limit);
        if (from) q = q.gte("created_at", toIsoTs(from));
        if (to) q = q.lt("created_at", toIsoTs(to));
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
      };

      const byIp = await fetchHits(sb.from("site_page_hits").select("*").eq("ip", ip));
      let byIds = [];
      if (ids.length) {
        byIds = await fetchHits(sb.from("site_page_hits").select("*").in("visitor_id", ids));
      }
      const seen = new Set();
      const merged = [];
      for (const row of [...byIp, ...byIds]) {
        const key = row.id != null ? `id:${row.id}` : `${row.visitor_id}|${row.created_at}|${row.path}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(row);
      }
      merged.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
      return merged.slice(0, limit).map(mapHitRow);
    } catch (err) {
      if (isMissingVisitorTableError(err.message)) return [];
      throw err;
    }
  }

  const db = getDb();
  ensureSqliteSchema(db);
  const ids = db.prepare(`SELECT id FROM site_visitor_sessions WHERE ip = ? LIMIT 100`).all(ip).map((r) => r.id);
  const fromSql = from ? toSqlTs(from) : null;
  const toSql = to ? toSqlTs(to) : null;
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(",");
    const params = [ip, ...ids];
    let sql = `SELECT * FROM site_page_hits WHERE (ip = ? OR visitor_id IN (${placeholders}))`;
    if (fromSql) {
      sql += ` AND created_at >= ?`;
      params.push(fromSql);
    }
    if (toSql) {
      sql += ` AND created_at < ?`;
      params.push(toSql);
    }
    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);
    return db.prepare(sql).all(...params).map(mapHitRow);
  }
  let sql = `SELECT * FROM site_page_hits WHERE ip = ?`;
  const params = [ip];
  if (fromSql) {
    sql += ` AND created_at >= ?`;
    params.push(fromSql);
  }
  if (toSql) {
    sql += ` AND created_at < ?`;
    params.push(toSql);
  }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);
  return db.prepare(sql).all(...params).map(mapHitRow);
}

export async function getVisitorAdminStats(opts = {}) {
  const range = resolveVisitorTimeRange(opts.range, opts.from, opts.to);
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

      let period = { hits: 0, unique: 0 };
      let periodCounts = new Map();
      let devices = [];

      if (range.key === "online") {
        const { data, error } = await sb
          .from("site_visitor_sessions")
          .select("*")
          .gte("last_seen_at", onlineIso)
          .order("last_seen_at", { ascending: false })
          .limit(300);
        if (error) throw error;
        devices = (data || []).map((row) => mapDeviceRow(row, { periodHitCount: Number(row.hit_count) || 0 }));
        period = { hits: devices.reduce((s, d) => s + (d.periodHitCount || 0), 0), unique: devices.length };
      } else if (range.key === "all") {
        const { data, error } = await sb
          .from("site_visitor_sessions")
          .select("*")
          .order("last_seen_at", { ascending: false })
          .limit(400);
        if (error) throw error;
        devices = (data || []).map((row) => mapDeviceRow(row, { periodHitCount: Number(row.hit_count) || 0 }));
        period = daily;
      } else {
        periodCounts = await periodHitCountsSupabase(range.from, range.to);
        period = await countHitsBetweenSupabase(range.from, range.to);
        const ids = [...periodCounts.keys()].slice(0, 400);
        if (ids.length) {
          const { data, error } = await sb.from("site_visitor_sessions").select("*").in("id", ids);
          if (error) throw error;
          devices = (data || [])
            .map((row) => mapDeviceRow(row, { periodHitCount: periodCounts.get(String(row.id)) || 0 }))
            .sort((a, b) => String(b.lastSeenAt).localeCompare(String(a.lastSeenAt)));
        }
      }

      return {
        online: online ?? 0,
        daily,
        weekly,
        monthly,
        period,
        range: {
          key: range.key,
          label: range.label,
          from: range.from ? range.from.toISOString() : null,
          to: range.to ? range.to.toISOString() : null,
        },
        devices,
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
        period: { hits: 0, unique: 0 },
        range: { key: range.key, label: range.label, from: null, to: null },
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
  const daily = countHitsSinceSqlite(day);
  const weekly = countHitsSinceSqlite(week);
  const monthly = countHitsSinceSqlite(month);

  let period = { hits: 0, unique: 0 };
  let devices = [];

  if (range.key === "online") {
    devices = db
      .prepare(`SELECT * FROM site_visitor_sessions WHERE last_seen_at >= ? ORDER BY last_seen_at DESC LIMIT 300`)
      .all(onlineCutoff)
      .map((row) => mapDeviceRow(row, { periodHitCount: Number(row.hit_count) || 0 }));
    period = { hits: devices.reduce((s, d) => s + (d.periodHitCount || 0), 0), unique: devices.length };
  } else if (range.key === "all") {
    devices = db
      .prepare(`SELECT * FROM site_visitor_sessions ORDER BY last_seen_at DESC LIMIT 400`)
      .all()
      .map((row) => mapDeviceRow(row, { periodHitCount: Number(row.hit_count) || 0 }));
    period = daily;
  } else {
    const periodCounts = await periodHitCountsSqlite(range.from, range.to);
    period = await countHitsBetweenSqlite(range.from, range.to);
    const ids = [...periodCounts.keys()].slice(0, 400);
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      const rows = db
        .prepare(`SELECT * FROM site_visitor_sessions WHERE id IN (${placeholders}) ORDER BY last_seen_at DESC`)
        .all(...ids);
      devices = rows.map((row) => mapDeviceRow(row, { periodHitCount: periodCounts.get(String(row.id)) || 0 }));
    }
  }

  return {
    online,
    daily,
    weekly,
    monthly,
    period,
    range: {
      key: range.key,
      label: range.label,
      from: range.from ? range.from.toISOString() : null,
      to: range.to ? range.to.toISOString() : null,
    },
    devices,
    onlineWindowMinutes: 5,
  };
}

export { parseUserAgent, VISITOR_COOKIE, ONLINE_MS };

export function hashIp(ip) {
  return createHash("sha256").update(String(ip || "")).digest("hex").slice(0, 16);
}
