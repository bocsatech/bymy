#!/usr/bin/env node
/**
 * Vercel admin OTP: SMTP relay az éles bymy.hu-n (Gmail SMTP ott megbízható).
 * 1. Generál/tárol titkot: ~/.autosweb/mail-relay-secret.txt
 * 2. Vercel Production env: BYMY_MAIL_RELAY_URL + BYMY_MAIL_RELAY_SECRET
 * 3. Ugyanaz a BYMY_MAIL_RELAY_SECRET kell az S1 pm2 környezetben is.
 *
 * Futtatás: node scripts/sync-vercel-mail-relay.mjs
 * Opcionális: BYMY_MAIL_RELAY_URL=https://bymy.hu/api/internal/mail-relay
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const secretPath = join(homedir(), ".autosweb", "mail-relay-secret.txt");
const relayUrl = String(process.env.BYMY_MAIL_RELAY_URL ?? "https://bymy.hu/api/internal/mail-relay").trim();

function run(cmd, input = null) {
  execSync(cmd, {
    cwd: ROOT,
    stdio: input == null ? "inherit" : ["pipe", "inherit", "inherit"],
    input: input == null ? undefined : input,
  });
}

function loadOrCreateSecret() {
  const fromEnv = String(process.env.BYMY_MAIL_RELAY_SECRET ?? "").trim();
  if (fromEnv) return fromEnv;
  if (existsSync(secretPath)) return readFileSync(secretPath, "utf8").trim();
  const secret = randomBytes(32).toString("hex");
  mkdirSync(join(homedir(), ".autosweb"), { recursive: true });
  writeFileSync(secretPath, `${secret}\n`, "utf8");
  console.log(`Új relay titok: ${secretPath}`);
  return secret;
}

function vercelEnvSet(key, value) {
  run(`npx --yes vercel env rm ${key} production --yes`, null);
  run(`npx --yes vercel env add ${key} production`, value);
}

const secret = loadOrCreateSecret();
console.log("→ Vercel link (ha kell)…");
run("npx --yes vercel link --yes --project bymy");

console.log("→ Relay env (Production)…");
vercelEnvSet("BYMY_MAIL_RELAY_URL", relayUrl);
vercelEnvSet("BYMY_MAIL_RELAY_SECRET", secret);

console.log("");
console.log("Vercel env kész. Következő lépések:");
console.log(`  1. S1: BYMY_MAIL_RELAY_SECRET=${secret} (pm2 / .env) + server.mjs deploy`);
console.log("  2. npx vercel --prod --yes");
console.log(`  3. Teszt: https://bymy.vercel.app/Bocsatech.html`);
console.log(`     (health: mail.mode=relay a Vercelen, smtp+relay az S1-en)`);
