import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const dir = mkdtempSync(join(tmpdir(), "autosweb-msg-"));
process.env.AUTOSWEB_DB_PATH = join(dir, "test.db");

const { registerUser, activateUserByToken } = await import("./web-users.mjs");
const {
  initMessagingSchema,
  startConversation,
  listConversations,
  sendMessage,
  listMessages,
  markRead,
  blockUser,
  registerDeviceToken,
  pendingPushForUser,
} = await import("./messaging.mjs");

function makeUser(email) {
  const reg = registerUser(email, "jelszo1jelszo", "jelszo1jelszo");
  const { user } = activateUserByToken(reg.activationToken);
  return user;
}

test("messaging: beszélgetés + üzenet + push outbox", async () => {
  initMessagingSchema();
  const buyer = makeUser("vevo@teszt.hu");
  const seller = makeUser("elado@teszt.hu");

  const empty = await startConversation(buyer.id, {
    listing_id: "car-1",
    listing_title: "BMW 320d",
    seller_id: seller.id,
  });
  assert.equal(empty, null);

  const conv = await startConversation(buyer.id, {
    listing_id: "car-1",
    listing_title: "BMW 320d",
    listing_price_label: "8,9 M Ft",
    listing_code: "AEA-1",
    seller_id: seller.id,
    initial_body: "Szia, megvan még?",
  });
  assert.ok(conv.id);
  assert.equal(conv.listing.title, "BMW 320d");

  const thread = await listMessages(seller.id, conv.id);
  assert.equal(thread.messages.length, 1);
  assert.equal(thread.messages[0].body, "Szia, megvan még?");
  assert.ok(thread.conversation.unread >= 1);

  await markRead(seller.id, conv.id);
  const after = await listConversations(seller.id);
  assert.equal(after[0].unread, 0);

  const pushes = await pendingPushForUser(seller.id);
  assert.ok(pushes.length >= 1);
  assert.match(pushes[0].title, /üzenet/i);

  await registerDeviceToken(buyer.id, { token: "device-token-demo", platform: "ios" });
  await blockUser(buyer.id, seller.id);
  await assert.rejects(() => sendMessage(buyer.id, conv.id, { body: "tiltva" }));
});

test.after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});
