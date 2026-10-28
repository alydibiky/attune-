// v8.7 (Ali: a month free for every friend who subscribes through your link, max 3 — linked to a Google account)
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const L = createRequire(import.meta.url)("../../server/referral/logic.js");
let n = 0; const t = async (name, f) => { await f(); n++; };
const mem = () => { const m = new Map(); return { get: async (c, id) => m.get(c + "/" + id) || null, set: async (c, id, d) => { m.set(c + "/" + id, JSON.parse(JSON.stringify(d))); } }; };
let seed = 1; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const now = Date.UTC(2026, 9, 28), DAY = 864e5;

await t("a new account that came through a friend's link is tied to the friend — once, never to itself", async () => {
  const s = mem();
  const ali = await L.hello(s, { uid: "ali", acct: "A", now, rand });
  assert.match(ali.code, /^[A-Z2-9]{8}$/); assert.equal(ali.friends, 0); assert.equal(ali.max, 3);
  const mona = await L.hello(s, { uid: "mona", acct: "M", ref: ali.code, now, rand }); assert.equal(mona.referred, true);
  const again = await L.hello(s, { uid: "ali", acct: "A", ref: mona.code, now, rand }); assert.equal(again.referred, false, "an old account can't be re-linked");
  const self = await L.hello(s, { uid: "omar", acct: "O", ref: "PRO-" + (await L.hello(mem(), { uid: "x", acct: "x", rand })).code, now, rand }); assert.equal(self.referred, false, "an unknown code links nothing");
});
await t("the friend subscribes → the giver's Play renewal moves 30 days (never charged), counted once", async () => {
  const s = mem(), calls = [];
  const play = { expiry: async () => now + 10 * DAY, defer: async (p, tok, a, b) => calls.push([p, tok, b - a]) };
  const ali = await L.hello(s, { uid: "ali", acct: "A", purchaseToken: "tokA", productId: "pro_monthly", now, rand });
  await L.hello(s, { uid: "mona", acct: "M", ref: ali.code, now, rand });
  const r = await L.purchase(s, play, { acct: "M", now }); assert.equal(r.done, "deferred"); assert.deepEqual(calls, [["pro_monthly", "tokA", 30 * DAY]]);
  assert.equal((await L.purchase(s, play, { acct: "M", now })).done, "already rewarded");
  assert.equal((await L.hello(s, { uid: "ali", acct: "A", now, rand })).friends, 1);
});
await t("no Play subscription to move → 30 days wait in the app; redeem gives them once", async () => {
  const s = mem(), ali = await L.hello(s, { uid: "ali", acct: "A", now, rand });
  await L.hello(s, { uid: "mona", acct: "M", ref: ali.code, now, rand });
  assert.equal((await L.purchase(s, null, { acct: "M", now })).done, "days");
  assert.equal((await L.hello(s, { uid: "ali", acct: "A", now, rand })).days, 30);
  assert.deepEqual(await L.redeem(s, "ali"), { days: 30 }); assert.deepEqual(await L.redeem(s, "ali"), { days: 0 });
});
await t("a maximum of 3 friends", async () => {
  const s = mem(), ali = await L.hello(s, { uid: "ali", acct: "A", now, rand });
  for (const f of ["f1", "f2", "f3", "f4"]) { await L.hello(s, { uid: f, acct: f.toUpperCase(), ref: ali.code, now, rand }); await L.purchase(s, null, { acct: f.toUpperCase(), now }); }
  const a = await L.hello(s, { uid: "ali", acct: "A", now, rand }); assert.equal(a.friends, 3); assert.equal(a.days, 90);
  assert.equal((await L.purchase(s, null, { acct: "nobody", now })).done, "unknown account");
});
console.log(`v870referral: ${n} checks passed`);
// the app side (web-src/referral.js): sign in → the server → the card; waiting days → Pro days here
{
  const R = await import("../../web-src/referral.js");
  const ls = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; })();
  assert.equal(R.inviteReady({ googleAccount() {} }, ""), false, "off until Ali sets the server address");
  assert.equal(R.inviteReady({ googleAccount() {} }, "https://x"), true);
  const sent = [];
  const post = async (url, o) => { sent.push(JSON.parse(o.body)); const b = JSON.parse(o.body); return { ok: true, json: async () => (b.op === "redeem" ? { days: 30 } : { code: "ABCD2345", friends: 1, max: 3, days: 30, acct: "h" }) }; };
  const call = async () => ({ token: "g-token" });
  const inv = await R.inviteHello(call, { ref: "WXYZ2345", server: "https://x", post, store: ls });
  assert.equal(inv.code, "ABCD2345"); assert.deepEqual(sent[0], { op: "hello", token: "g-token", ref: "WXYZ2345", purchaseToken: "", productId: "" });
  const now = Date.now(); assert.equal(await R.inviteRedeem(call, { server: "https://x", post, store: ls }), 30);
  assert.ok(R.bonusUntil(ls) > now + 29 * 864e5, "30 Pro days added"); assert.equal(R.loadInvite(ls).days, 0);
  R.addBonus(30, ls); assert.ok(R.bonusUntil(ls) > now + 59 * 864e5, "a second friend's month stacks");
  console.log("v870referral (+ app side): sign-in, server, Pro days");
}
