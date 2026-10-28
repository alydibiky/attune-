// Ali's picks from persona 3 (28 Oct): the business decisions that are code.
import assert from "node:assert/strict";
const LS = {}; globalThis.localStorage = { getItem: (k) => LS[k] ?? null, setItem: (k, v) => { LS[k] = String(v); }, removeItem: (k) => delete LS[k] };
const B = await import("../../web-src/billing.js"), U = await import("../../web-src/trialuse.js");
let n = 0; const t = (name, fn) => { fn(); n++; };
t("Free answers are unlimited; one free agent; outcomes first", () => {
  assert.equal(B.FREE_LIMITS.answersPerDay, Infinity); assert.equal(B.FREE_LIMITS.agents, 1);
  assert.equal(B.COMPARE_ROWS[0][1], "Unlimited"); assert.match(B.PRO_BENEFITS[0], /^Agents that find/);
});
t("Lifetime is a launch offer", () => {
  assert.equal(B.lifetimeOffer(Date.parse("2026-11-01")), true); assert.equal(B.lifetimeOffer(Date.parse("2027-03-01")), false);
});
t("a referral link carries this phone's code; the friend gets a month", () => {
  const link = B.referralLink("PRO-ABCD1234"); assert.match(link, /referrer=attune_ref%3DPRO-ABCD1234$/);
  assert.equal(B.referralFrom("utm_source=google-play&attune_ref=PRO-ABCD1234"), "PRO-ABCD1234"); assert.equal(B.referralFrom("utm_source=google-play"), "");
  assert.equal(B.trialDaysLeft(Date.now() - 10 * 864e5, Date.now(), B.REFERRAL_DAYS), 20);
});
t("what Pro was used for, and when Home says so", () => {
  U.noteProUse("photo"); U.noteProUse("photo"); U.noteProUse("agent"); U.noteProUse("deal");
  assert.equal(U.usedLine("en"), "2 meals by photo, 1 agent and 1 deal check");
  assert.equal(U.trialNote({ left: 2, started: true, pro: false }).kind, "ending");
  assert.equal(U.trialNote({ left: 5, started: true, pro: false }), null);
  assert.equal(U.trialNote({ left: 0, started: true, pro: false, seenEnd: false }).kind, "ended");
  assert.equal(U.trialNote({ left: 0, started: true, pro: false, seenEnd: true }), null);
});
console.log(`v870p3: ${n} checks passed`);
