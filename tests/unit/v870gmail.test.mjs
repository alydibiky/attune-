// v8.7 (Ali: "reads Gmail by itself"): the read emails go to Overpaying, Money's review list (payments only) and Recall
import assert from "node:assert/strict";
import * as G from "../../web-src/gmail.js";
import { loadOverpay } from "../../web-src/overpay.js";
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const now = Date.parse("2026-10-29T10:00:00");
const E = [
  { id: "gm:1", kind: "email", from: "Netflix <info@netflix.com>", title: "Your Netflix price is changing", text: "From November your plan will be EGP 240 a month.", at: now - 2 * 864e5, link: "https://mail.google.com/mail/#all/a" },
  { id: "gm:2", kind: "email", from: "CIB <alerts@cib.com>", title: "Card transaction", text: "Your card ending 1234 was charged EGP 850.00 at NOON.", at: now - 864e5, link: "https://mail.google.com/mail/#all/b" },
  { id: "gm:3", kind: "email", from: "Shop <news@shop.com>", title: "Weekend offers", text: "Big sale this weekend, everything must go", at: now - 864e5 }];
let n = 0;
{ const s = mem();
  assert.equal(G.gmailDue(G.loadGmail(s), now), false, "not connected → no daily read");
  const calls = [];
  const call = async (m, a) => { calls.push([m, a]); return { emails: E }; };
  const r = await G.readGmail(call, { now, s });
  assert.deepEqual(calls[0], ["gmailRead", { days: 365, max: 100, silent: false }], "the first read: the last year");
  assert.deepEqual(r, { added: 3, payments: 1 });
  assert.equal(loadOverpay(s).emails.length, 3, "all of them reach the Overpaying check");
  const wait = JSON.parse(s.getItem(G.WAIT_KEY));
  assert.equal(wait.length, 1); assert.equal(wait[0].app, "Gmail"); assert.match(wait[0].text, /charged EGP 850/);
  assert.equal(G.gmailNotes(s)[0].app, "Gmail"); assert.match(G.gmailNotes(s).map((x) => x.title).join("|"), /CIB · Card transaction/);
  assert.equal(G.gmailDue(G.loadGmail(s), now + 3600e3), false); assert.equal(G.gmailDue(G.loadGmail(s), now + 21 * 3600e3), true, "the next day: due");
  const r2 = await G.readGmail(async (m, a) => { calls.push([m, a]); return { emails: E }; }, { silent: true, now: now + 864e5, s });
  assert.deepEqual(calls[1][1], { days: 2, max: 40, silent: true }, "the daily read: silent, only the last days");
  assert.equal(r2.added, 0, "an email is never taken twice"); n += 9; }
console.log(`v870gmail: ${n} checks passed`);
import { syncKeys } from "../../web-src/cloud.js";
{ // Google's free review depends on Gmail content never leaving the phone: Sync leaves it out
  const k = syncKeys({ "attune:gmail:v1": "{}", "attune:sms-old:v1": "[]", "ledger.v3": "{}",
    "attune:overpay:v1": JSON.stringify({ emails: [{ id: "gm:1", text: "x" }, { id: "pasted-1", text: "y" }] }) });
  assert.ok(!("attune:gmail:v1" in k) && !("attune:sms-old:v1" in k) && "ledger.v3" in k);
  assert.deepEqual(JSON.parse(k["attune:overpay:v1"]).emails.map((e) => e.id), ["pasted-1"]);
  const s = mem(); G.markReconnect(true, s); assert.equal(G.loadGmail(s).reconnect, true);
  console.log("v870gmail: Gmail data never syncs; a failed daily read asks to reconnect");
}
