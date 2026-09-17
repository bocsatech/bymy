#!/usr/bin/env node
/**
 * S1 éles: public + lib sync (bymy.hu).
 * Használat: node scripts/deploy-s1-public.mjs
 * Env: BYMY_S1_HOST (default root@179.198.205.130), BYMY_S1_APP (default /root/bymy-app)
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.BYMY_S1_HOST || "bymy-app";
const appDir = process.env.BYMY_S1_APP || "/var/www/bymy";

const cmds = [
  `rsync -az --delete "${root}/public/" ${host}:${appDir}/public/`,
  `rsync -az --delete "${root}/lib/" ${host}:${appDir}/lib/`,
  `ssh ${host} "cd ${appDir} && (pm2 restart bymy-app 2>/dev/null || pm2 restart all 2>/dev/null || true)"`,
];

for (const cmd of cmds) {
  console.log("→", cmd);
  execSync(cmd, { stdio: "inherit" });
}
console.log("✓ S1 public+lib deploy kész");
