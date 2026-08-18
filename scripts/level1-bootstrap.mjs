/**
 * Első level1 admin fiók a helyi ~/.autosweb/level1.db-be.
 * Használat: node scripts/level1-bootstrap.mjs FELHASZNALONEV EMAIL JELSZO
 */
import { initLevel1 } from "../lib/level1.mjs";

const [username, email, password] = process.argv.slice(2);
if (!username || !email || !password) {
  console.error("Használat: node scripts/level1-bootstrap.mjs FELHASZNALONEV EMAIL JELSZO");
  process.exit(1);
}

process.env.LEVEL1_BOOTSTRAP_USERNAME = username;
process.env.LEVEL1_BOOTSTRAP_EMAIL = email;
process.env.LEVEL1_BOOTSTRAP_PASSWORD = password;

await initLevel1();
const user = String(username).trim().toLowerCase();
console.log(`level1 admin kész: ${user} (${email})`);
console.log(
  `Feloldás SQLite: UPDATE admins SET locked = 0, failed_attempts = 0 WHERE username = '${user}';`
);
console.log(
  `Feloldás Supabase: UPDATE level1_admins SET locked = false, failed_attempts = 0, updated_at = now() WHERE username = '${user}';`
);
