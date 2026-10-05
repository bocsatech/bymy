#!/usr/bin/env node
/**
 * Level1 admin belépési kód email nélkül (tartalék, ha a levélküldés elhal).
 *
 * Használat:
 *   node scripts/level1-code.mjs [felhasználónév]
 *
 * Jelszó: LEVEL1_PASSWORD env → .env.local LEVEL1_BOOTSTRAP_PASSWORD → rejtett bekérés.
 * A kiírt kódot a /Bocsatech.html belépés második lépésébe kell beírni.
 *
 * Figyelem: 3 hibás jelszó zárolja a felhasználónevet (feloldás: scripts/level1-unlock.mjs).
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

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

/** Jelszó bekérés visszhang nélkül (TTY-n). */
function askHidden(question) {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    return Promise.reject(
      new Error("Nincs terminál a jelszóhoz — add meg: LEVEL1_PASSWORD=... node scripts/level1-code.mjs")
    );
  }
  process.stdout.write(question);
  return new Promise((resolve) => {
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const done = (result) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      process.stdout.write("\n");
      resolve(result);
    };
    const onData = (chunk) => {
      for (const ch of String(chunk)) {
        if (ch === "\r" || ch === "\n" || ch === "\u0004") {
          done(value);
          return;
        }
        if (ch === "\u0003") {
          done("");
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

loadEnvLocal();
process.env.DB_BACKEND = process.env.DB_BACKEND || "supabase";

const username =
  String(process.argv[2] || process.env.LEVEL1_BOOTSTRAP_USERNAME || "bocsatechadmin").trim();

let password = String(process.env.LEVEL1_PASSWORD || "").trim();
let passwordSource = "LEVEL1_PASSWORD";
if (!password) {
  password = String(process.env.LEVEL1_BOOTSTRAP_PASSWORD || "").trim();
  passwordSource = ".env.local LEVEL1_BOOTSTRAP_PASSWORD";
}
if (!password) {
  password = (await askHidden(`Jelszó (${username}): `)).trim();
  passwordSource = "bekérés";
}
if (!password) {
  console.error("Jelszó kötelező.");
  process.exit(1);
}

const { startLevel1Login } = await import("../lib/level1.mjs");

let pending;
try {
  pending = await startLevel1Login(username, password);
} catch (error) {
  console.error(`Nem sikerült: ${error?.message || error}`);
  if (error?.code === "LOCKED") {
    console.error(`Feloldás: node scripts/level1-unlock.mjs ${username}`);
  }
  process.exit(1);
}

console.log(`admin: ${username} (jelszó innen: ${passwordSource})`);
if (pending.skipOtp) {
  console.log("Ez a fiók kód nélkül belép (helyi dev admin) — nincs mit beírni.");
  process.exit(0);
}
console.log(`belépési kód: ${pending.code}`);
console.log(`érvényes: ${new Date(pending.expires).toLocaleString("hu-HU")}`);
console.log("Írd be a /Bocsatech.html második lépésébe (az emailre nem kell várni).");
