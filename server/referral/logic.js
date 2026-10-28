/* ---- v8.7 (Ali: "for every friend you send a link to who subscribes, you get a month free — maximum 3"; "can't it be linked to a
   Google account") — the referral rules, pure, so they are tested on their own (tests/unit/v870referral.test.mjs).
   The idea and the flow follow Google's own Play Billing server sample (github.com/android/play-billing-samples, Apache-2.0:
   Firebase functions + Play's real-time purchase notifications); written here from scratch.
     hello      the app says who it is (a Google account, checked by Google) → its invite code; a NEW account that came
                through a friend's link is tied to that friend, once
     purchase   Play says "a subscription was bought" → whose account (Play keeps our hashed account id with the purchase) →
                if they came through a friend and that friend has fewer than 3 → +30 days for the friend:
                  the friend pays by Play → Play moves their renewal 30 days later (subscriptions.defer — the friend is never charged)
                  else → 30 "days waiting" that the friend's app turns into Pro days (redeem)
   store: { get(col, id) → doc|null, set(col, id, doc) } (Firestore in index.js, a Map in the test). play: { expiry(productId,
   token) → ms, defer(productId, token, fromMs, toMs) }.                                                                   */
"use strict";
const MAX_FRIENDS = 3, DAYS = 30, DAY = 864e5;
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeCode(rand = Math.random) { let s = ""; for (let i = 0; i < 8; i++) s += ALPHA[Math.floor(rand() * ALPHA.length)]; return s; }

/** The app opens the invite card (or buys): who it is, the link it came from (once), its own Play subscription (for the gift). */
async function hello(store, { uid, acct, ref = "", purchaseToken = "", productId = "", now = Date.now(), rand = Math.random }) {
  if (!uid || !acct) throw new Error("not signed in");
  let u = await store.get("users", uid), isNew = false;
  if (!u) {
    let code = makeCode(rand);
    for (let i = 0; i < 5 && (await store.get("codes", code)); i++) code = makeCode(rand);
    u = { uid, acct, code, friends: [], days: 0, created: now, referredBy: "" };
    await store.set("codes", code, { uid });
    await store.set("accounts", acct, { uid });
    isNew = true;
  }
  // a friend's link counts only for an account that is new here, and never your own code
  const r = String(ref || "").toUpperCase().replace(/^PRO-/, "");
  if (isNew && r && r !== u.code) { const c = await store.get("codes", r); if (c && c.uid !== uid) u.referredBy = c.uid; }
  if (purchaseToken) { u.purchaseToken = purchaseToken; u.productId = productId || u.productId || ""; }
  u.seen = now;
  await store.set("users", uid, u);
  return { code: u.code, friends: u.friends.length, max: MAX_FRIENDS, days: u.days || 0, referred: !!u.referredBy, acct: u.acct };
}

/** Play: a subscription was bought (notificationType 4). acct = the purchase's obfuscated account id. → what happened. */
async function purchase(store, play, { acct, now = Date.now() }) {
  const a = acct && (await store.get("accounts", acct));
  if (!a) return { done: "unknown account" };
  const buyer = await store.get("users", a.uid);
  if (!buyer || !buyer.referredBy) return { done: "not referred" };
  if (buyer.rewarded) return { done: "already rewarded" };
  const giver = await store.get("users", buyer.referredBy);
  if (!giver) return { done: "no giver" };
  if ((giver.friends || []).includes(buyer.uid)) return { done: "already counted" };
  if ((giver.friends || []).length >= MAX_FRIENDS) { buyer.rewarded = now; await store.set("users", buyer.uid, buyer); return { done: "giver has 3 already" }; }
  let how = "days";
  if (giver.purchaseToken && giver.productId && play) {
    try {
      const exp = await play.expiry(giver.productId, giver.purchaseToken);
      if (exp > now) { await play.defer(giver.productId, giver.purchaseToken, exp, exp + DAYS * DAY); how = "deferred"; }
    } catch (e) { how = "days"; }   // Play said no (cancelled, paused…): the days wait in the app instead
  }
  giver.friends = [...(giver.friends || []), buyer.uid];
  if (how === "days") giver.days = (giver.days || 0) + DAYS;
  buyer.rewarded = now;
  await store.set("users", giver.uid, giver);
  await store.set("users", buyer.uid, buyer);
  return { done: how, giver: giver.uid, friends: giver.friends.length };
}

/** The giver's app turns the waiting days into Pro days (when the giver has no Play subscription to move). */
async function redeem(store, uid) {
  const u = await store.get("users", uid); if (!u) return { days: 0 };
  const d = u.days || 0; if (!d) return { days: 0 };
  u.days = 0; u.redeemed = [...(u.redeemed || []), { d, at: Date.now() }]; await store.set("users", uid, u);
  return { days: d };
}

module.exports = { hello, purchase, redeem, makeCode, MAX_FRIENDS, DAYS };
