// v9.9 (Ali, 9 Nov: "a Google one told me the payment of Gemini and it wasn't recorded in subscriptions automatically — fix this")
import assert from "node:assert/strict";
import * as AP from "../../web-src/autopilot.js";
import { subPay, undoSubPay, findSub } from "../../web-src/subpay.js";
import { apply } from "../../web-src/doit.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS " + m); };
const NOW = Date.parse("2026-11-09T10:00:00"), ts = Date.parse("2026-11-08T21:14:00");
const note = (app, title, text, id = Math.random()) => ({ id: String(id), app, pkg: "x", title, text, ts });
const s0 = AP.emptyState();

let x = AP.suggestFrom(note("Google Play Store", "Payment successful", "You paid EGP 975.00 for Google One (Google AI Pro)"), { now: NOW, s: s0 });
ok(x && x.kind === "subscription" && x.title === "Google Gemini" && x.amount === 975 && x.cur === "EGP", "Google Play “You paid EGP 975.00 for Google One (Google AI Pro)” → a Google Gemini subscription, 975 EGP");
x = AP.suggestFrom(note("Google", "Your Gemini subscription was renewed", "Google AI Pro · EGP 975.00 charged to Visa ••42"), { now: NOW, s: s0 });
ok(x && x.kind === "subscription" && x.title === "Google Gemini", "“Your Gemini subscription was renewed … EGP 975.00 charged” → subscription");
x = AP.suggestFrom(note("CIB", "Card purchase", "Your card ending 4242 was charged EGP 250.00 at NETFLIX.COM on 08/11"), { now: NOW, s: s0 });
ok(x && x.kind === "subscription" && x.title === "Netflix" && x.amount === 250, "a bank SMS “charged EGP 250.00 at NETFLIX.COM” → Netflix subscription");
ok(AP.suggestFrom(note("Google", "Try Google AI Pro", "Get Gemini Advanced free for 1 month, then EGP 975/month"), { now: NOW, s: s0 }) === null || AP.suggestFrom(note("Google", "Try Google AI Pro", "Get Gemini Advanced free for 1 month, then EGP 975/month"), { now: NOW, s: s0 }).kind !== "subscription", "an offer (“free for 1 month, then EGP 975”) is not a payment");
x = AP.suggestFrom(note("YouTube", "Limited time", "Get 3 months of YouTube Premium for EGP 5"), { now: NOW, s: s0 });
ok(!x || x.kind !== "subscription", "“Get 3 months of YouTube Premium for EGP 5” is an offer");
x = AP.suggestFrom(note("Google Play Store", "Payment successful", "You paid EGP 975.00 for Google One (Google AI Pro)"), { now: NOW, s: s0 });
ok(AP.isAuto(s0, x), "a subscription payment is added BY ITSELF (no tap) …");
ok(!AP.isAuto(AP.refuse(s0, x, { app: true }), x), "… unless the person said “not these” for that app");

// the money book: the bank SMS first, then Google → only the plan
const led = { txns: [{ type: "expense", amount: 975, date: "2026-11-08" }] };
const list = AP.suggestions([note("Google Play Store", "Payment successful", "You paid EGP 975.00 for Google One (Google AI Pro)", "g1")], { now: NOW, s: s0, ledger: led });
ok(list.length === 1 && list[0].noMoney === true && AP.actionsFor(list[0]).length === 1, "already in Money (the bank SMS) → only the subscription, not the 975 twice");
const fresh = AP.suggestions([note("Google Play Store", "Payment successful", "You paid EGP 975.00 for Google One (Google AI Pro)", "g1")], { now: NOW, s: s0, ledger: { txns: [] } });
const acts = AP.actionsFor(fresh[0]);
ok(acts.map((a) => a.kind).join() === "subPay,money" && acts[1].items[0].cat === "bills", "new → the subscription + a 975 expense (bills)");

// People & plans
let d = subPay({ v: 1, items: [] }, acts[0], NOW);
let c = d.data.items[0];
ok(d.isNew && c.kind === "subscription" && c.every === "month" && c.start === "2026-11-08" && c.paid.includes(0) && c.amount === 975, "new: a monthly Google Gemini subscription from 8 Nov, this month ticked");
const r = apply(acts[0], { life: { v: 1, items: [] } }, { now: NOW });
ok(/Added to Subscriptions: Google Gemini · 975 a month/.test(r.done.en) && r.stores["attune:life:v1"].items.length === 1, "doit apply says: Added to Subscriptions: Google Gemini · 975 a month");
// next month, the same: ticked, not a second plan
const dec = { ...acts[0], date: "2026-12-08", key: "sb:Google Gemini:2026-12" };
const d2 = subPay(d.data, dec, NOW + 30 * 864e5);
ok(!d2.isNew && d2.data.items.length === 1 && d2.data.items[0].paid.includes(1), "next month's payment ticks December — still one plan");
ok(undoSubPay(d2.data, dec.key).items[0].paid.includes(1) === false && undoSubPay(d.data, acts[0].key).items.length === 0, "Undo takes back exactly what that notification did");
// typed before ("netflix 250 every month") → found and ticked
const typed = { v: 1, items: [{ id: "n1", kind: "subscription", dir: "out", title: "netflix", amount: 250, every: "month", start: "2026-10-08", count: 0, total: 0, paid: [0], created: 1 }] };
ok(findSub(typed, "Netflix") && subPay(typed, { name: "Netflix", amount: 250, date: "2026-11-08", key: "k" }, NOW).data.items[0].paid.includes(1), "a subscription typed before (“netflix”) is found and November ticked");
console.log("ALL PASSED v990subs (" + n + " checks)");
