/** Tartós profil JSON — $HOME/.autosweb/profiles.json (túléli app-mappa frissítést). */

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

function profilesFilePath() {
  if (process.env.AUTOSWEB_PROFILES_PATH) return process.env.AUTOSWEB_PROFILES_PATH;
  return join(homedir(), ".autosweb", "profiles.json");
}

function emptyStore() {
  return { version: 1, profiles: {} };
}

/** Induláskor: mappa + üres profiles.json, hogy a cat ne adjon „No such file”-t. */
export function ensureProfilesStore() {
  const path = profilesFilePath();
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(path)) {
    writeProfilesStore(emptyStore());
  }
  try {
    writeFileSync(
      join(dir, "SERVER_INFO.txt"),
      [
        `profiles=${path}`,
        `updated=${new Date().toISOString()}`,
        `pid=${process.pid}`,
      ].join("\n") + "\n",
      "utf8"
    );
  } catch {
    /* ignore */
  }
  return path;
}

export function readProfilesStore() {
  const path = profilesFilePath();
  if (!existsSync(path)) return emptyStore();
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object") return emptyStore();
    if (!parsed.profiles || typeof parsed.profiles !== "object") {
      return { version: 1, profiles: parsed };
    }
    return parsed;
  } catch {
    return emptyStore();
  }
}

function writeProfilesStore(store) {
  const path = profilesFilePath();
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  renameSync(tmp, path);
  return path;
}

export function getProfilesFilePath() {
  return profilesFilePath();
}

export function loadProfileFromFile(email) {
  const key = String(email ?? "")
    .trim()
    .toLowerCase();
  if (!key) return null;
  const store = readProfilesStore();
  const profile = store.profiles[key];
  return profile && typeof profile === "object" ? profile : null;
}

export function saveProfileToFile(email, profile) {
  const key = String(email ?? "")
    .trim()
    .toLowerCase();
  if (!key) throw new Error("Email hiányzik a profil mentéshez.");
  const store = readProfilesStore();
  store.profiles[key] = {
    ...profile,
    savedAt: new Date().toISOString(),
  };
  const path = writeProfilesStore(store);
  const verify = loadProfileFromFile(key);
  if (!verify?.firstName) {
    throw new Error("A profil fájlba írás sikertelen.");
  }
  return { path, profile: verify };
}

export function deleteProfileFromFile(email) {
  const key = String(email ?? "")
    .trim()
    .toLowerCase();
  if (!key) return;
  const store = readProfilesStore();
  if (!(key in store.profiles)) return;
  delete store.profiles[key];
  writeProfilesStore(store);
}
