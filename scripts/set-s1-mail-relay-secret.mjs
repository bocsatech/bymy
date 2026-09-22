#!/usr/bin/env node
/** S1 .env: BYMY_MAIL_RELAY_SECRET = ~/.autosweb/mail-relay-secret.txt */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const host = process.env.BYMY_S1_HOST || "bymy-app";
const appDir = process.env.BYMY_S1_APP || "/var/www/bymy";
const secretPath = join(homedir(), ".autosweb", "mail-relay-secret.txt");

if (!existsSync(secretPath)) {
  console.error("Hiányzik:", secretPath, "— futtasd: node scripts/sync-vercel-mail-relay.mjs");
  process.exit(1);
}

const secret = readFileSync(secretPath, "utf8").trim();
const b64 = Buffer.from(secret, "utf8").toString("base64");
const remote = `
set -euo pipefail
cd ${appDir}
SECRET=$(printf '%s' '${b64}' | base64 -d)
ENV_FILE=.env
touch "$ENV_FILE"
if grep -q '^BYMY_MAIL_RELAY_SECRET=' "$ENV_FILE" 2>/dev/null; then
  grep -v '^BYMY_MAIL_RELAY_SECRET=' "$ENV_FILE" > "$ENV_FILE.tmp"
  mv "$ENV_FILE.tmp" "$ENV_FILE"
fi
printf 'BYMY_MAIL_RELAY_SECRET=%s\\n' "$SECRET" >> "$ENV_FILE"
pm2 restart bymy --update-env 2>/dev/null || pm2 restart bymy-app --update-env 2>/dev/null || pm2 restart all --update-env || true
echo OK
`;

execSync(`ssh ${host} bash`, { input: remote, stdio: ["pipe", "inherit", "inherit"] });
