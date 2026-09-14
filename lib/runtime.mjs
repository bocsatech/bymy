
export function isServerlessRuntime() {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.FUNCTION_NAME
  );
}

export function supabaseMissingOnServerlessError() {
  return new Error(
    "Supabase env hiányzik. Állítsd be: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (ugyanaz, mint bymy.hu / S1), majd redeploy."
  );
}
