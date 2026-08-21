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
  const reg = registerUser("teszt@local.dev", "titok1titok12", "titok1titok12");
  assert.equal(reg.email, "teszt@local.dev");
  assert.equal(reg.needsActivation, true);
  assert.ok(reg.activationToken);

  assert.throws(() => loginUser("teszt@local.dev", "titok1titok12"), /aktiváld/i);

  const { user, session } = activateUserByToken(reg.activationToken);
  assert.equal(user.email, "teszt@local.dev");
  assert.equal(user.emailVerified, true);
  assert.ok(session.token);

  const fromSession = getUserBySessionToken(session.token);
  assert.equal(fromSession.email, "teszt@local.dev");

  const login = loginUser("teszt@local.dev", "titok1titok12");
  assert.equal(login.user.email, "teszt@local.dev");
});

test("regisztrációkor a fióktípus bekerül az adatbázisba", () => {
  const biz = registerUser("ceges@local.dev", "titok1titok12", "titok1titok12", "business");
  const { user } = activateUserByToken(biz.activationToken);
  assert.equal(user.profile.accountType, "business");
  const saved = saveUserProfile(user.id, {
    firstName: "Ceg",
    lastName: "Teszt",
    accountType: "private",
  });
  assert.equal(saved.accountType, "business");
});

test("rossz jelszó elutasítva", () => {
  const reg = registerUser("masik@local.dev", "jojelszo1234", "jojelszo1234");
  activateUserByToken(reg.activationToken);
  assert.throws(() => loginUser("masik@local.dev", "rossz"), /Hibás/);
});

test("profil és jelszóváltás", () => {
  const reg = registerUser("profil@local.dev", "abc123abc123", "abc123abc123");
  const { user, session } = activateUserByToken(reg.activationToken);
  const profile = saveUserProfile(user.id, {
    firstName: "Anna",
    lastName: "Teszt",
    postalCode: "1111",
    city: "Budapest",
    accountType: "private",
  });
  assert.equal(profile.firstName, "Anna");
  changeUserPassword(user.id, "abc123abc123", "ujjelszo12345", "ujjelszo12345");
  assert.throws(() => loginUser("profil@local.dev", "abc123abc123"), /Hibás/);
  const again = loginUser("profil@local.dev", "ujjelszo12345");
  assert.equal(again.user.profile.firstName, "Anna");
  const company = saveUserProfile(user.id, {
    ...again.user.profile,
    company: "Teszt Kft.",
    companyTaxId: "12345678-1-42",
    companyStreet: "Teszt utca 1.",
    companyPostalCode: "1111",
    companyCity: "Budapest",
    companyCountry: "Magyarország",
    companyPhone: "+361111",
    companyPhone2: "+362222",
    companyEmail: "ceg@local.dev",
    companyEmail2: "ceg2@local.dev",
    salespersonName: "Eladó Egy",
    salespersonName2: "Eladó Kettő",
  });
  assert.equal(company.companyTaxId, "12345678-1-42");
  assert.equal(company.companyPostalCode, "1111");
  assert.equal(company.companyCity, "Budapest");
  assert.equal(company.companyAddress, "1111 Budapest, Teszt utca 1.");
  assert.equal(company.salespersonName2, "Eladó Kettő");
  const kept = saveUserProfile(user.id, { firstName: "Anna", lastName: "Teszt" });
  assert.equal(kept.company, "Teszt Kft.");
  assert.equal(kept.companyEmail2, "ceg2@local.dev");
  destroySession(session.token);
  assert.equal(getUserBySessionToken(session.token), null);
});

test("fiók törlés", () => {
  const reg = registerUser("torol@local.dev", "abc123abc123", "abc123abc123");
  const { user } = activateUserByToken(reg.activationToken);
  deleteUserAccount(user.id);
  assert.throws(() => loginUser("torol@local.dev", "abc123abc123"), /Hibás/);
});

test.after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});
