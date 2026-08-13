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
  const reg = registerUser(email, "jelszo1", "jelszo1");
  const { user } = activateUserByToken(reg.activationToken);
  return user;
}

test("messaging: beszélgetés + üzenet + push outbox", () => {
  initMessagingSchema();
  const buyer = makeUser("vevo@teszt.hu");
  const seller = makeUser("elado@teszt.hu");

  const conv = startConversation(buyer.id, {
    listing_id: "car-1",
    listing_title: "BMW 320d",
    listing_price_label: "8,9 M Ft",
    listing_code: "AEA-1",
    seller_id: seller.id,
  });
  assert.ok(conv.id);
  assert.equal(conv.listing.title, "BMW 320d");

  const msg = sendMessage(buyer.id, conv.id, { body: "Szia, megvan még?" });
  assert.equal(msg.body, "Szia, megvan még?");

  const thread = listMessages(seller.id, conv.id);
  assert.equal(thread.messages.length, 1);
  assert.ok(thread.conversation.unread >= 1);

  markRead(seller.id, conv.id);
  const after = listConversations(seller.id);
  assert.equal(after[0].unread, 0);

  const pushes = pendingPushForUser(seller.id);
  assert.ok(pushes.length >= 1);
  assert.match(pushes[0].title, /üzenet/i);

  registerDeviceToken(buyer.id, { token: "device-token-demo", platform: "ios" });
  blockUser(buyer.id, seller.id);
  assert.throws(() => sendMessage(buyer.id, conv.id, { body: "tiltva" }));
});

test.after(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});
