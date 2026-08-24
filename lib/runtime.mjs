/** Futási környezet — Vercel / Lambda vs helyi Node. */

export function isServerlessRuntime() {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.FUNCTION_NAME
  );
}

export function supabaseMissingOnServerlessError() {
  return new Error(
    "Vercelen a SQLite / ~/.autosweb nem elérhető. Állítsd be a Vercel Environment Variables-ben: SUPABASE_URL és SUPABASE_SERVICE_ROLE_KEY (az új bymy projekt service_role / secret kulcsa), majd Redeploy."
  );
}
