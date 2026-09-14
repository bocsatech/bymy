import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** .env.local létezése mellett ezek a .env-ből nem írják felül a helyi dev beállítást. */
const LOCAL_OVERRIDES_ENV = new Set(["PORT", "NODE_ENV", "PUBLIC_BASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);

function parseEnvFile(filePath) {
  const out = new Map();
  if (!existsSync(filePath)) return out;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (!key) continue;
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    out.set(key, value);
  }
  return out;
}

export function loadEnvFiles(cwd = process.cwd()) {
  const hasLocal = existsSync(join(cwd, ".env.local"));
  const merged = new Map();

  for (const [key, value] of parseEnvFile(join(cwd, ".env"))) {
    if (hasLocal && LOCAL_OVERRIDES_ENV.has(key)) continue;
    merged.set(key, value);
  }

  for (const [key, value] of parseEnvFile(join(cwd, ".env.local"))) {
    merged.set(key, value);
  }

  for (const [key, value] of merged) {
    process.env[key] = value;
  }

  if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    if (!process.env.PORT) process.env.PORT = "3456";
    if (hasLocal && !merged.has("NODE_ENV")) process.env.NODE_ENV = "development";
  }

  return process.env;
}
