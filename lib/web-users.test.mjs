import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import test from "node:test";
import assert from "node:assert/strict";

const dir = mkdtempSync(join(tmpdir(), "autosweb-users-"));
process.env.AUTOSWEB_DB_PATH = join(dir, "test.db");
process.env.AUTOSWEB_PROFILES_PATH = join(dir, "profiles.json");

const {
  registerUser,
  loginUser,
  activateUserByToken,
  getUserBySessionToken,
  changeUserPassword,
  saveUserProfile,
  deleteUserAccount,
  destroySession,
} = await import(`./web-users.mjs?t=${Date.now()}`);

test("register után login tiltva, aktiválás után OK", () => {
  const reg = registerUser("teszt@local.dev", "titok1", "titok1");
  assert.equal(reg.email, "teszt@local.dev");
  assert.equal(reg.needsActivation, true);
  assert.ok(reg.activationToken);

  assert.throws(() => loginUser("teszt@local.dev", "titok1"), /aktiváld/i);

  const { user, session } = activateUserByToken(reg.activationToken);
  assert.equal(user.email, "teszt@local.dev");
  assert.equal(user.emailVerified, true);
  assert.ok(session.token);

  const fromSession = getUserBySessionToken(session.token);
  assert.equal(fromSession.email, "teszt@local.dev");

  const login = loginUser("teszt@local.dev", "titok1");
  assert.equal(login.user.email, "teszt@local.dev");
});

test("rossz jelszó elutasítva", () => {
  const reg = registerUser("masik@local.dev", "jojelszo", "jojelszo");
  activateUserByToken(reg.activationToken);
  assert.throws(() => loginUser("masik@local.dev", "rossz"), /Hibás/);
});

test("profil és jelszóváltás", () => {
  const reg = registerUser("profil@local.dev", "abc123", "abc123");
  const { user, session } = activateUserByToken(reg.activationToken);
  const profile = saveUserProfile(user.id, {
    firstName: "Anna",
    lastName: "Teszt",
    postalCode: "1111",
    city: "Budapest",
    accountType: "private",
  });
  assert.equal(profile.firstName, "Anna");
  changeUserPassword(user.id, "abc123", "ujjelszo", "ujjelszo");
  assert.throws(() => loginUser("profil@local.dev", "abc123"), /Hibás/);
  const again = loginUser("profil@local.dev", "ujjelszo");
  assert.equal(again.user.profile.firstName, "Anna");
  destroySession(session.token);
  assert.equal(getUserBySessionToken(session.token), null);
});

test("fiók törlés", () => {
  const reg = registerUser("torol@local.dev", "abc123", "abc123");
  const { user } = activateUserByToken(reg.activationToken);
  deleteUserAccount(user.id);
  assert.throws(() => loginUser("torol@local.dev", "abc123"), /Hibás/);
});

test.after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});
