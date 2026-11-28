// v10.9.10 (Ali, 28 Nov 2026 screenshots): Money Guardian listed adverts as monthly subscriptions ("Egp Off", "Last Chance", "Your
// Dessert", "Talabat Deals", "First Order", "Don T", "Order Your", "Meta For", "Alex Forte", "Enzu", "Support"…) and said "Charged twice
// at Anthropic" for his two Claude accounts. Plus: the 10,000 HARD composed people of tests/subs/gen.mjs, a 2,500 sample kept at 99 %+.
import * as O from "../../web-src/overpay.js";
import * as G from "../../web-src/guardian.js";
import { gen, run } from "../subs/gen.mjs";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const now = Date.parse("2026-11-28T10:00:00"), D = 864e5;
// the adverts as such notifications are written
const ads = [
  ["Enzu", "EGP 800 off your first order 🎉 Order now"], ["Talabat", "Talabat Deals — 199 EGP off this weekend!"], ["Your Dessert", "Your dessert is waiting 🍰 295 EGP off — order your favourites"],
  ["Last Chance", "Last chance! 3,899 EGP off a yearly plan"], ["Don't miss", "Don't miss out: 100 EGP off your next order"], ["Meta", "Meta for business: EGP 101 credit offer"],
  ["Alex Forte", "Alex Forte — $115 off this month only, limited time"], ["Supplexon", "Supplexon: save up to 199.6 EGP — use code SUPP20"], ["طلبات", "خصم 100 جنيه على أول طلب — اطلب دلوقتي"],
  ["Support", "Support our partners: 5,144.78 EGP off orders over 10,000 — shop now"], ["First Order", "First order? EGP 100 off with code NEW100"],
];
const notes = ads.map(([t, x], i) => ({ id: "ad" + i, app: "Gmail", title: t, text: x, ts: now - (i + 1) * D }));
let R = O.overpayCheck({ ledger: { currency: "EGP", accounts: [{ id: "a", currency: "EGP" }], txns: [] }, notes, now, home: "EGP" });
ok(R.subs.length === 0, "Ali's adverts are not subscriptions: " + JSON.stringify(R.subs.map((s) => s.name)));
ok(R.perks.length === 0, "…nor unused perks: " + JSON.stringify(R.perks.map((s) => s.name)));
for (const [t, x] of ads) ok(O.isPromo(t + " — " + x), "an advert: " + x.slice(0, 40));
ok(!O.isPromo("Your receipt from Anthropic — You paid $20.00. Invite a friend and get 20% off"), "a receipt with an advert line is still a receipt");
// a real subscription next to them is still found
R = O.overpayCheck({ ledger: { currency: "EGP", accounts: [{ id: "a", currency: "EGP" }], txns: [] }, notes: [...notes, { id: "nf", app: "Gmail", title: "Netflix", text: "Your payment of EGP 240 was received. Thanks!", ts: now - 3 * D }], now, home: "EGP" });
ok(R.subs.length === 1 && R.subs[0].name === "Netflix", "a real Netflix receipt among them is found: " + JSON.stringify(R.subs.map((s) => s.name)));
// two Claude accounts: two receipts the same day to two addresses → two subscriptions, never "charged twice"
const two = [{ id: "c1", app: "Gmail", title: "Your receipt from Anthropic", text: "Claude Pro — you paid $20.00", ts: now - 15 * D, acct: "ali.work@gmail.com" },
  { id: "c2", app: "Gmail", title: "Your receipt from Anthropic", text: "Claude Pro — you paid $20.00", ts: now - 15 * D + 60000, acct: "ali.home@gmail.com" }];
R = O.overpayCheck({ ledger: { currency: "EGP", accounts: [{ id: "a", currency: "EGP" }], txns: [] }, notes: two, now, home: "EGP" });
ok(R.subs.length === 2 && R.subs.every((s) => /^Claude \(/.test(s.name)), "two Claude accounts = two subscriptions, each with its address: " + JSON.stringify(R.subs.map((s) => s.name)));
const tx = (id, ts, ev) => ({ id, type: "expense", amount: 22.8, account: "a", date: new Date(ts).toISOString().slice(0, 10), note: "ANTHROPIC · CIB", created: ts, source: "notification", ...(ev ? { evidence: ev } : {}) });
const t0 = Date.parse("2026-11-13T09:00:00");
let F = G.findings({ ledger: { currency: "EGP", accounts: [{ id: "a", currency: "EGP" }], txns: [tx("x", t0, { text: "x", app: "Gmail", acct: "ali.work@gmail.com" }), tx("y", t0 + 60000, { text: "y", app: "Gmail", acct: "ali.home@gmail.com" })] }, life: null, now }).filter((f) => f.kind === "double");
ok(F.length === 0, "two accounts named → no double charge at all");
F = G.findings({ ledger: { currency: "EGP", accounts: [{ id: "a", currency: "EGP" }], txns: [tx("x", t0), tx("y", t0 + 60000)] }, life: null, now }).filter((f) => f.kind === "double");
ok(F.length === 1 && F[0].sure === false, "the bank's two SMS for Anthropic (no account named) → it ASKS, never \"Charged twice\"");
F = G.findings({ ledger: { currency: "EGP", accounts: [{ id: "a", currency: "EGP" }], txns: [{ ...tx("x", t0), note: "CARREFOUR · CIB", amount: 450 }, { ...tx("y", t0 + 60000), note: "CARREFOUR · CIB", amount: 450 }] }, life: null, now }).filter((f) => f.kind === "double");
ok(F.length === 1 && F[0].sure === true, "a real double charge at a shop is still caught");
// Arabic-Indic digits and invisible marks in a receipt
const ev = O.readSource({ id: "w", kind: "notification", title: "إيصال اشتراك WATCH IT", text: "شكراً لاشتراكك تم خصم ‎٧٥  جنيه", at: now }, { now });
ok(ev.some((e) => e.type === "charge" && e.amount === 75 && e.service === "Watch It"), "«تم خصم ‎٧٥  جنيه» is read: " + JSON.stringify(ev.map((e) => [e.type, e.amount])));
// the 10,000 generator: a 2,500 sample
const cs = gen(5, 2500); let good = 0; for (const c of cs) if (run(c).ok) good++;
ok(good / cs.length >= 0.99, `2,500 HARD composed people: ${(good / cs.length * 100).toFixed(2)} %`);
console.log(fail ? fail + " FAILED" : "ALL PASSED"); process.exit(fail ? 1 : 0);
