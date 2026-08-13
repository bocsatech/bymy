import { createClient } from "@supabase/supabase-js";
import ws from "ws";

let client = null;

/** Production (Vercel + env) → Supabase; lokálisan alapból SQLite. */
export function isSupabaseBackend() {
  if (process.env.DB_BACKEND === "sqlite") return false;
  if (process.env.DB_BACKEND === "supabase") return true;
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabase() {
  if (!isSupabaseBackend()) {
    throw new Error("Supabase nincs konfigurálva (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).");
  }
  if (!client) {
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: ws },
    });
  }
  return client;
}

export function supabaseBackendLabel() {
  if (!isSupabaseBackend()) return null;
  try {
    return new URL(process.env.SUPABASE_URL).hostname;
  } catch {
    return "supabase";
  }
}
