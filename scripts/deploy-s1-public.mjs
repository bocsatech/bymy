#!/usr/bin/env node
/**
 * S1 éles: public + lib sync (bymy.hu).
 * Használat: node scripts/deploy-s1-public.mjs
 * Env: BYMY_S1_HOST (default bymy-app), BYMY_S1_APP (default /var/www/bymy)
 *
 * lib/ mindig git HEAD-ből megy (ne félkész helyi fájlok törjék az éles Node-ot).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.BYMY_S1_HOST || "bymy-app";
const appDir = process.env.BYMY_S1_APP || "/var/www/bymy";

function run(cmd) {
  console.log("→", cmd);
  execSync(cmd, { stdio: "inherit" });
}

const libStaging = fs.mkdtempSync(path.join(os.tmpdir(), "bymy-lib-head-"));
try {
  run(`git -C "${root}" archive HEAD lib | tar -x -C "${libStaging}"`);
  const usersHead = path.join(libStaging, "lib/supabase/users.mjs");
  const usersTxt = fs.readFileSync(usersHead, "utf8");
  if (!usersTxt.includes("export function friendlyAuthErrorMessage")) {
    throw new Error(
      "git HEAD lib/supabase/users.mjs missing friendlyAuthErrorMessage — abort S1 deploy"
    );
  }

  run(`node "${root}/scripts/embed-ad-form.mjs"`);
  run(`node "${root}/scripts/asset-fingerprint.mjs"`);
  run(`rsync -az --delete "${root}/public/" ${host}:${appDir}/public/`);
  run(`rsync -az --delete "${libStaging}/lib/" ${host}:${appDir}/lib/`);
  run(`rsync -az "${root}/data/vehicle-catalog.json" ${host}:${appDir}/data/vehicle-catalog.json`);
  run(
    `rsync -az "${root}/data/vehicle-catalog-kisteher.json" ${host}:${appDir}/data/vehicle-catalog-kisteher.json`
  );
  run(`rsync -az "${root}/server.mjs" ${host}:${appDir}/server.mjs`);
  run(`rsync -az "${root}/ecosystem.config.cjs" ${host}:${appDir}/ecosystem.config.cjs`);
  run(
    `ssh ${host} "cd ${appDir} && (pm2 startOrReload ecosystem.config.cjs --update-env 2>/dev/null || pm2 restart bymy 2>/dev/null || true); pm2 scale bymy 4 >/dev/null 2>&1 || true; pm2 save >/dev/null 2>&1 || true"`
  );
  console.log("✓ S1 public+lib deploy kész (lib = git HEAD)");
} finally {
  fs.rmSync(libStaging, { recursive: true, force: true });
}
