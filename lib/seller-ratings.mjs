import { getDb } from "./db.mjs";
import { getSupabase, isSupabaseBackend } from "./supabase/client.mjs";

function sb() {
  return getSupabase();
}

export function initSellerRatingsSchema(db) {
  if (isSupabaseBackend()) return;
  const database = db ?? getDb();
  database.exec(`
    CREATE TABLE IF NOT EXISTS seller_ratings (
      seller_user_id INTEGER NOT NULL,
      rater_user_id INTEGER NOT NULL,
      score INTEGER NOT NULL CHECK (score >= 1 AND score <= 10),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (seller_user_id, rater_user_id),
      FOREIGN KEY (seller_user_id) REFERENCES web_users(id) ON DELETE CASCADE,
      FOREIGN KEY (rater_user_id) REFERENCES web_users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_seller_ratings_seller
      ON seller_ratings (seller_user_id);
  `);
}

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const score = Math.round(n);
  if (score < 1 || score > 10) return null;
  return score;
}

function summarize(scores) {
  const list = (scores || []).map((s) => Number(s)).filter((n) => Number.isFinite(n) && n >= 1 && n <= 10);
  const count = list.length;
  if (!count) {
    return { average: null, count: 0 };
  }
  const sum = list.reduce((a, b) => a + b, 0);
  return {
    average: Math.round((sum / count) * 10) / 10,
    count,
  };
}

function emptySummary(viewerOk, sid, vid) {
  return {
    average: null,
    count: 0,
    myScore: null,
    canRate: viewerOk && vid !== sid,
    loggedIn: viewerOk,
  };
}

function isMissingTableError(err) {
  const msg = String(err?.message || err || "");
  const code = String(err?.code || "");
  return (
    code === "42P01" ||
    (/seller_ratings/i.test(msg) && /does not exist|schema cache|Could not find the table/i.test(msg))
  );
}

async function fetchScoresSupabase(sellerUserId) {
  const { data, error } = await sb()
    .from("seller_ratings")
    .select("score")
    .eq("seller_user_id", sellerUserId);
  if (error) throw error;
  return (data || []).map((row) => row.score);
}

async function fetchMyScoreSupabase(sellerUserId, raterUserId) {
  if (!raterUserId) return null;
  const { data, error } = await sb()
    .from("seller_ratings")
    .select("score")
    .eq("seller_user_id", sellerUserId)
    .eq("rater_user_id", raterUserId)
    .maybeSingle();
  if (error) throw error;
  return data?.score != null ? Number(data.score) : null;
}

async function fetchScoresSqlite(sellerUserId) {
  initSellerRatingsSchema();
  const rows = getDb()
    .prepare("SELECT score FROM seller_ratings WHERE seller_user_id = ?")
    .all(sellerUserId);
  return rows.map((row) => row.score);
}

async function fetchMyScoreSqlite(sellerUserId, raterUserId) {
  if (!raterUserId) return null;
  initSellerRatingsSchema();
  const row = getDb()
    .prepare(
      "SELECT score FROM seller_ratings WHERE seller_user_id = ? AND rater_user_id = ?"
    )
    .get(sellerUserId, raterUserId);
  return row?.score != null ? Number(row.score) : null;
}

/**
 * @param {{ sellerUserId: number, viewerUserId?: number|null }} opts
 */
export async function getSellerRatingSummary({ sellerUserId, viewerUserId = null } = {}) {
  const sid = Number(sellerUserId);
  if (!Number.isFinite(sid) || sid <= 0) {
    return emptySummary(false, 0, 0);
  }
  const vid = Number(viewerUserId);
  const viewerOk = Number.isFinite(vid) && vid > 0;

  try {
    const [scores, myScore] = await Promise.all([
      isSupabaseBackend() ? fetchScoresSupabase(sid) : fetchScoresSqlite(sid),
      isSupabaseBackend()
        ? fetchMyScoreSupabase(sid, viewerOk ? vid : null)
        : fetchMyScoreSqlite(sid, viewerOk ? vid : null),
    ]);

    const { average, count } = summarize(scores);
    const canRate = viewerOk && vid !== sid && myScore == null;
    return {
      average,
      count,
      myScore,
      canRate,
      loggedIn: viewerOk,
    };
  } catch (err) {
    if (isMissingTableError(err)) return emptySummary(viewerOk, sid, vid);
    throw err;
  }
}

/**
 * @param {{ sellerUserId: number, raterUserId: number, score: number }} opts
 */
export async function submitSellerRating({ sellerUserId, raterUserId, score } = {}) {
  const sid = Number(sellerUserId);
  const rid = Number(raterUserId);
  const sc = clampScore(score);
  if (!Number.isFinite(sid) || sid <= 0) {
    const err = new Error("Érvénytelen kereskedő.");
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(rid) || rid <= 0) {
    const err = new Error("Nem vagy bejelentkezve.");
    err.status = 401;
    throw err;
  }
  if (sid === rid) {
    const err = new Error("Saját magadat nem értékelheted.");
    err.status = 400;
    throw err;
  }
  if (sc == null) {
    const err = new Error("Az értékelés 1 és 10 között legyen.");
    err.status = 400;
    throw err;
  }

  try {
    if (isSupabaseBackend()) {
      const existing = await fetchMyScoreSupabase(sid, rid);
      if (existing != null) {
        const err = new Error("Már értékelted ezt a kereskedőt.");
        err.status = 409;
        throw err;
      }
      const { error } = await sb().from("seller_ratings").insert({
        seller_user_id: sid,
        rater_user_id: rid,
        score: sc,
      });
      if (error) {
        if (String(error.code) === "23505" || /duplicate|unique/i.test(String(error.message || ""))) {
          const err = new Error("Már értékelted ezt a kereskedőt.");
          err.status = 409;
          throw err;
        }
        throw error;
      }
    } else {
      initSellerRatingsSchema();
      const existing = await fetchMyScoreSqlite(sid, rid);
      if (existing != null) {
        const err = new Error("Már értékelted ezt a kereskedőt.");
        err.status = 409;
        throw err;
      }
      try {
        getDb()
          .prepare(
            "INSERT INTO seller_ratings (seller_user_id, rater_user_id, score) VALUES (?, ?, ?)"
          )
          .run(sid, rid, sc);
      } catch (e) {
        if (/UNIQUE|constraint/i.test(String(e?.message || ""))) {
          const err = new Error("Már értékelted ezt a kereskedőt.");
          err.status = 409;
          throw err;
        }
        throw e;
      }
    }
  } catch (err) {
    if (isMissingTableError(err)) {
      const e = new Error("Az értékelések még nincsenek beállítva. Próbáld később.");
      e.status = 503;
      throw e;
    }
    throw err;
  }

  return getSellerRatingSummary({ sellerUserId: sid, viewerUserId: rid });
}
