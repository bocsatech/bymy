import { createClient } from "@supabase/supabase-js";
import ws from "ws";

let client = null;

function isPlaceholderSecret(value) {
  const v = String(value ?? "").trim();
  if (!v) return true;
  return /your_|changeme|placeholder|example|service_role_key/i.test(v);
}

/** Legacy JWT: csak service_role érvényes szerveren (anon / publishable nem). */
function isServiceRoleKey(key) {
  const v = String(key ?? "").trim();
  if (v.startsWith("sb_secret_")) return true;
  if (!v.startsWith("eyJ")) return !isPlaceholderSecret(v);
  try {
    const payload = JSON.parse(Buffer.from(v.split(".")[1], "base64url").toString("utf8"));
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

/** Egyetlen backend: Supabase (bymy.hu = Vercel = lokális fejlesztés). */
export function isSupabaseBackend() {
  if (process.env.DB_BACKEND === "sqlite") return false;
  const url = String(process.env.SUPABASE_URL ?? "").trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  return Boolean(url && key && !isPlaceholderSecret(key) && isServiceRoleKey(key));
}

export function assertSupabaseConfigured(context = "") {
  if (isSupabaseBackend()) return;
  const suffix = context ? ` (${context})` : "";
  throw new Error(
    `Supabase kötelező${suffix}. .env.local: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — ugyanaz, mint bymy.hu (S1).`
  );
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
