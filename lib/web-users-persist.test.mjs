import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { spawnSync } from "child_process";

test("profil megmarad process újraindítás után (sqlite + profiles.json)", () => {
  const dir = mkdtempSync(join(tmpdir(), "aw-user-persist-"));
  const dbPath = join(dir, "users.db");
  const profilesPath = join(dir, "profiles.json");

  const write = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
      process.env.AUTOSWEB_DB_PATH = ${JSON.stringify(dbPath)};
      process.env.AUTOSWEB_PROFILES_PATH = ${JSON.stringify(profilesPath)};
      const { registerUser, activateUserByToken, saveUserProfile, getUserById } = await import("/workspace/autosweb/lib/web-users.mjs");
      const reg = registerUser("persist2@test.dev", "pass1pass1234", "pass1pass1234");
      const { user } = activateUserByToken(reg.activationToken);
      saveUserProfile(user.id, { firstName: "Gabor", lastName: "Toth", postalCode: "2000", city: "Szentendre" });
      const u = getUserById(user.id);
      if (u.profile.firstName !== "Gabor") process.exit(2);
      `,
    ],
    { encoding: "utf8" }
  );
  assert.equal(write.status, 0, write.stderr || write.stdout);
  assert.ok(existsSync(dbPath));
  assert.ok(existsSync(profilesPath));
  const file = JSON.parse(readFileSync(profilesPath, "utf8"));
  assert.equal(file.profiles["persist2@test.dev"].firstName, "Gabor");

  const read = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
      process.env.AUTOSWEB_DB_PATH = ${JSON.stringify(dbPath)};
      process.env.AUTOSWEB_PROFILES_PATH = ${JSON.stringify(profilesPath)};
      const { loginUser } = await import("/workspace/autosweb/lib/web-users.mjs?t=" + Date.now());
      const { user } = loginUser("persist2@test.dev", "pass1pass1234");
      if (user.profile.firstName !== "Gabor") {
        console.error(JSON.stringify(user.profile));
        process.exit(3);
      }
      console.log("OK", user.profile.firstName);
      `,
    ],
    { encoding: "utf8" }
  );
  assert.equal(read.status, 0, read.stderr || read.stdout);
  assert.match(read.stdout, /OK Gabor/);
  rmSync(dir, { recursive: true, force: true });
});

test("profil fájlból visszatöltődik üres sqlite profile_json mellett is", () => {
  const dir = mkdtempSync(join(tmpdir(), "aw-file-only-"));
  const dbPath = join(dir, "users.db");
  const profilesPath = join(dir, "profiles.json");

  const step1 = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
      process.env.AUTOSWEB_DB_PATH = ${JSON.stringify(dbPath)};
      process.env.AUTOSWEB_PROFILES_PATH = ${JSON.stringify(profilesPath)};
      const { getDb } = await import("/workspace/autosweb/lib/db.mjs");
      const { registerUser, activateUserByToken, saveUserProfile } = await import("/workspace/autosweb/lib/web-users.mjs");
      const reg = registerUser("fileonly@test.dev", "pass1pass1234", "pass1pass1234");
      const { user } = activateUserByToken(reg.activationToken);
      saveUserProfile(user.id, { firstName: "Kata", lastName: "Nagy" });
      getDb().prepare("UPDATE web_users SET profile_json = '{}' WHERE id = ?").run(user.id);
      `,
    ],
    { encoding: "utf8" }
  );
  assert.equal(step1.status, 0, step1.stderr || step1.stdout);

  const step2 = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
      process.env.AUTOSWEB_DB_PATH = ${JSON.stringify(dbPath)};
      process.env.AUTOSWEB_PROFILES_PATH = ${JSON.stringify(profilesPath)};
      const { loginUser } = await import("/workspace/autosweb/lib/web-users.mjs?t=" + Date.now());
      const { user } = loginUser("fileonly@test.dev", "pass1pass1234");
      console.log(user.profile.firstName);
      if (user.profile.firstName !== "Kata") process.exit(4);
      `,
    ],
    { encoding: "utf8" }
  );
  assert.equal(step2.status, 0, step2.stderr || step2.stdout);
  assert.match(step2.stdout, /Kata/);
  rmSync(dir, { recursive: true, force: true });
});
