#!/bin/zsh
# bymy.hu (S1) .env → helyi .env.local Supabase kulcsok (forrás: éles).
# SSH: bymy-app alias (~/.ssh/config), app: /var/www/bymy/.env
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

S1_SSH="${S1_SSH:-bymy-app}"
S1_ENV="${S1_ENV:-/var/www/bymy/.env}"
LOCAL="$ROOT/.env.local"
TMP="$(mktemp)"

echo "→ Letöltés: ${S1_SSH}:${S1_ENV}"
scp "${S1_SSH}:${S1_ENV}" "$TMP"

node <<'NODE' "$TMP" "$LOCAL"
import { readFileSync, writeFileSync, existsSync } from "fs";

const [remotePath, localPath] = process.argv.slice(2);
const remote = readFileSync(remotePath, "utf8");
const keys = new Set([
  "DB_BACKEND",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PUBLIC_URL",
  "PUBLIC_BASE_URL",
]);

const pulled = new Map();
for (const line of remote.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const i = trimmed.indexOf("=");
  if (i < 1) continue;
  const key = trimmed.slice(0, i).trim();
  if (!keys.has(key)) continue;
  pulled.set(key, trimmed.slice(i + 1).trim());
}

if (!pulled.has("SUPABASE_URL") || !pulled.has("SUPABASE_SERVICE_ROLE_KEY")) {
  console.error("Az S1 .env-ben hiányzik SUPABASE_URL vagy SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const host = String(pulled.get("SUPABASE_URL")).replace(/^https?:\/\//, "").split("/")[0];
console.log(`S1 Supabase: ${host}`);

const lines = existsSync(localPath) ? readFileSync(localPath, "utf8").split(/\r?\n/) : [];
const out = [];
const seen = new Set();

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    out.push(line);
    continue;
  }
  const i = trimmed.indexOf("=");
  if (i < 1) {
    out.push(line);
    continue;
  }
  const key = trimmed.slice(0, i).trim();
  if (pulled.has(key)) {
    out.push(`${key}=${pulled.get(key)}`);
    seen.add(key);
  } else {
    out.push(line);
  }
}

for (const [key, val] of pulled) {
  if (!seen.has(key)) out.push(`${key}=${val}`);
}

if (!out.some((l) => l.startsWith("S1_SSH="))) out.push("S1_SSH=bymy-app");
if (!out.some((l) => l.startsWith("S1_APP_DIR="))) out.push("S1_APP_DIR=/var/www/bymy");
if (!out.some((l) => l.startsWith("S1_ENV="))) out.push("S1_ENV=/var/www/bymy/.env");

// Mac / Vercel: belső IP (168.*:8000) nem elérhető — nyilvános proxy
const publicUrl = pulled.get("SUPABASE_PUBLIC_URL")?.replace(/\/$/, "") || "https://bymy.hu";
for (let i = 0; i < out.length; i++) {
  if (out[i].startsWith("SUPABASE_URL=")) out[i] = `SUPABASE_URL=${publicUrl}`;
}
if (!seen.has("SUPABASE_PUBLIC_URL")) out.push(`SUPABASE_PUBLIC_URL=${publicUrl}`);

writeFileSync(localPath, `${out.filter((l, i, a) => !(i === a.length - 1 && l === "")).join("\n")}\n`, "utf8");
console.log(`Frissítve: ${localPath}`);
console.log(`Helyi/Vercel SUPABASE_URL → ${publicUrl} (S1 belső: ${host})`);
NODE

rm -f "$TMP"
echo ""
echo "Ellenőrzés: node scripts/check-supabase-parity.mjs"
echo "Vercel: mac/vercel-supabase-env.command"
if [[ -t 0 ]]; then read -r "?Enter…"; fi
