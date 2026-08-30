import test from "node:test";
import assert from "node:assert/strict";
import {
  buildListingFacts,
  buildImproveDescriptionMessages,
  sanitizeFormForImprove,
  improveListingDescription,
} from "./improve-listing-description.mjs";

test("buildListingFacts: fontos mezők, személyes adat nélkül", () => {
  const facts = buildListingFacts({
    gyartmany: "RENAULT",
    modell: "TALISMAN",
    km: "76300",
    telefon: "06301234567",
    megtekintesi_cim: "Titkos utca 1",
  });
  const joined = facts.join("\n");
  assert.match(joined, /RENAULT/);
  assert.match(joined, /76300/);
  assert.doesNotMatch(joined, /Titkos|0630|telefon/i);
});

test("sanitizeFormForImprove: blokkolja a kontakt mezőket", () => {
  const clean = sanitizeFormForImprove({
    gyartmany: "BMW",
    telefon: "06",
    email: "a@b.hu",
    leiras: "titok",
  });
  assert.equal(clean.gyartmany, "BMW");
  assert.equal(clean.telefon, undefined);
  assert.equal(clean.email, undefined);
  assert.equal(clean.leiras, undefined);
});

test("buildImproveDescriptionMessages: emberszerű utasítás", () => {
  const messages = buildImproveDescriptionMessages({
    draft: "garázsban tartott, keveset ment",
    facts: ["Gyártmány: RENAULT", "Km. óra állás: 76300"],
    title: "RENAULT TALISMAN",
  });
  assert.equal(messages[0].role, "system");
  assert.match(messages[0].content, /emberszerű|természetes/i);
  assert.match(messages[0].content, /Ne találj ki/i);
  assert.match(messages[1].content, /garázsban tartott/);
});

test("improveListingDescription: nincs API kulcs", async () => {
  const prev = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const result = await improveListingDescription({
      draft: "szép autó",
      form: { gyartmany: "BMW", modell: "320", km: "100000" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "NOT_CONFIGURED");
  } finally {
    if (prev != null) process.env.OPENAI_API_KEY = prev;
  }
});
