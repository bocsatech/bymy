function isServerlessRuntime() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTION_NAME);
}

export function isR2Configured() {
  const accountId = String(process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  const accessKey = String(process.env.R2_ACCESS_KEY_ID || "").trim();
  const secret = String(process.env.R2_SECRET_ACCESS_KEY || "").trim();
  const bucket = String(process.env.R2_BUCKET_NAME || process.env.BYMY_R2_BUCKET || "bymy-listings").trim();
  return Boolean(accountId && accessKey && secret && bucket);
}

/** @returns {'r2' | 'filesystem' | 'supabase'} */
export function getImageStorageBackend() {
  const mode = String(process.env.BYMY_IMAGE_STORAGE ?? "").trim().toLowerCase();
  if (mode === "supabase") return "supabase";
  if (mode === "filesystem") return "filesystem";
  if (mode === "r2") return "r2";
  if (isR2Configured()) return "r2";
  if (isServerlessRuntime()) return "supabase";
  return "filesystem";
}

export function isR2ImageStorage() {
  return getImageStorageBackend() === "r2";
}

export function isFilesystemImageStorage() {
  return getImageStorageBackend() === "filesystem";
}

export function isSupabaseImageStorage() {
  return getImageStorageBackend() === "supabase";
}
