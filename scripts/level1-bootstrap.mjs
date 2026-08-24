/**
 * Admin jelszó + email beállítása Supabase-ben (Vercel env nélkül is).
 * Használat: node scripts/level1-bootstrap.mjs FELHASZNALONEV EMAIL JELSZO
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { forceBootstrapAdmin } from "../lib/level1.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal() {
  const path = join(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 1) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();
process.env.DB_BACKEND = process.env.DB_BACKEND || "supabase";

const [argUser, argEmail, argPass] = process.argv.slice(2);
const username = argUser || process.env.LEVEL1_BOOTSTRAP_USERNAME || "bocsatechadmin";
const email = argEmail || process.env.LEVEL1_BOOTSTRAP_EMAIL || "";
const password = argPass || process.env.LEVEL1_BOOTSTRAP_PASSWORD || "";

if (!email || !password) {
  console.error("Használat: node scripts/level1-bootstrap.mjs FELHASZNALONEV EMAIL JELSZO");
  console.error("Vagy .env.local: LEVEL1_BOOTSTRAP_USERNAME, LEVEL1_BOOTSTRAP_EMAIL, LEVEL1_BOOTSTRAP_PASSWORD");
  process.exit(1);
}

const admin = await forceBootstrapAdmin(username, email, password);
console.log(`OK: ${admin.username} → ${email}`);
console.log("Belépés: https://bymy.vercel.app/Bocsatech.html");
console.log("Ezután futtasd: mac/vercel-level1-env.command (Vercel env + redeploy)");
