#!/usr/bin/env node
/**
 * S2 (bymy-data): Studio csak 127.0.0.1:54323 — SSH tunnellel nyitható GUI.
 *
 *   node scripts/s2-studio-localhost.mjs
 *   mac/bymy-data-studio.command
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.BYMY_S2_HOST || "bymy-data";
const remoteDir = process.env.BYMY_S2_SUPABASE_DIR || "/root/supabase-project";
const overrideName = "docker-compose.studio-localhost.yml";
const localOverride = path.join(root, "deploy", "s2", overrideName);

if (!existsSync(localOverride)) {
  console.error("Hiányzik:", localOverride);
  process.exit(1);
}

execSync(`scp "${localOverride}" ${host}:${remoteDir}/${overrideName}`, { stdio: "inherit" });

let composeLine = "";
try {
  composeLine = execSync(`ssh ${host} "grep '^COMPOSE_FILE=' ${remoteDir}/.env"`, { encoding: "utf8" }).trim();
} catch {
  composeLine = "";
}

const base = "docker-compose.yml";
let files = composeLine ? composeLine.split("=")[1]?.trim() || base : base;
if (!files.includes(overrideName)) {
  files = `${files}:${overrideName}`;
}

execSync(
  `ssh ${host} 'set -e
cd ${remoteDir}
if grep -q "^COMPOSE_FILE=" .env; then
  sed -i "s|^COMPOSE_FILE=.*|COMPOSE_FILE=${files}|" .env
else
  echo "COMPOSE_FILE=${files}" >> .env
fi
docker compose up -d studio
docker compose ps studio
'`,
  { stdio: "inherit" }
);

console.log("");
console.log("Studio (S2): ssh tunnel → http://127.0.0.1:54323");
console.log("  ssh -N -L 54323:127.0.0.1:54323", host);
console.log("  vagy: mac/bymy-data-studio.command");
