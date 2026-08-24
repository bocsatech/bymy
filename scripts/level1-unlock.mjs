/**
 * Level1 admin zárolás feloldása (Supabase vagy helyi SQLite).
 * Használat: node scripts/level1-unlock.mjs [felhasználónév]
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { unlockLevel1Admin, level1UnlockSql } from "../lib/level1.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

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

const username = process.argv[2] || "bocsatechadmin";
await unlockLevel1Admin(username);
console.log(`Feloldva: ${username}`);
console.log(level1UnlockSql(username));
