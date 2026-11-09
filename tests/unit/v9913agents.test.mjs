// v9.9.13 Ali picked AG1 + AG2 + AC2 + AC3 + AH1 ("OK1") and "who pays it" for subscriptions ("OK2"): the logic behind them.
import * as A from "../../web-src/agents.js";
import * as AP from "../../web-src/autopilot.js";
import { subPay } from "../../web-src/subpay.js";
import { setPayer, payerUnknown, nextReminder } from "../../web-src/life.js";
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const H = 3600e3, now = Date.parse("2026-11-10T10:30:00");
// Ali's hotel agent: Masjid al-Haram, 4 nights, 5★, under 45,000, Booking.com, Dec 10 – Jan 24
const a = { id: "h1", kind: "watch", site: "Booking.com", url: "https://www.booking.com/searchresults.html?ss=Mecca", below: 45000, currency: "EGP",
  fields: { nights: 4, stars: [5], near: true, window: { from: "2026-12-10", to: "2027-01-24" } }, rules: {},
  checks: [{ at: now - 30 * H, price: 42124 }, { at: now - 20 * H, blocked: true }, { at: now - 1 * H, price: 41495, how: "browser" }],
  best3: [{ name: "Swissôtel Makkah", price: 41495, checkin: "2027-01-08", checkout: "2027-01-12", href: "https://www.booking.com/hotel/sa/swiss.html" },
    { name: "Swissôtel Makkah", price: 41495, checkin: "2027-01-08", checkout: "2027-01-12", href: "https://www.booking.com/hotel/sa/swiss.html" },
    { name: "Hilton Suites", price: 42124, checkin: "2027-01-04", checkout: "2027-01-08" }],
  byDay: [{ date: "2026-12-18", checkout: "2026-12-22", offers: [{ name: "Pullman Zamzam", price: 43090 }] },
    { date: "2027-01-20", checkout: "2027-01-24", offers: [{ name: "A", price: 45092 }, { name: "B", price: 45711 }, { name: "C", price: 46306 }] }] };
const b = A.bestSoFar(a);
ok(b && b.price === 41495 && b.name === "Swissôtel Makkah", "AG1: the best so far on top — 41,495 Swissôtel (Jan 8 → 12)");
const ch = A.bestChange(a);
ok(ch && ch.by === 629 && ch.was === 42124, "AG1: “↓ 629” — better than the best before the newest check (42,124)");
ok(A.bestChange({ ...a, checks: [{ at: now, price: 41495 }] }) === null, "…nothing to compare after one check: no arrow");
const c = A.chartPoints(a);
ok(c.days.join() === "2026-12-18,2027-01-04,2027-01-08,2027-01-20", "AG2: every start date on the chart: " + c.days.join(", "));
ok(c.points.length === 6 && c.points.filter((p) => p.best).length === 1 && c.best.price === 41495, "AG2: every hotel once (the Swissôtel twice → once); one best dot");
ok(c.points.some((p) => p.name === "Pullman Zamzam" && p.date === "2026-12-18"), "AG2: another date with another hotel (Pullman, Dec 18) is on it");
ok(c.below === 45000, "AG2: the limit line");
const withRule = A.chartPoints({ ...a, rules: { below: 44000 } });
ok(!withRule.points.some((p) => p.price > 44000), "the chart follows the agent's rules (under 44,000)");
const pl = A.planLines(a);
ok(pl.length === 4, "AH1: the plan is 4 lines");
ok(/Booking/.test(pl[0][1].site) && pl[0][1].n === 4 && pl[0][1].a === "2026-12-10", "AH1 1: Booking.com, 4 nights between Dec 10 and Jan 24");
ok(pl[1][1].list.some(([en, v]) => en === "only {s}★" && v.s === "5") && pl[1][1].list.some(([en]) => en === "within 1 km"), "AH1 2: only 5★, within 1 km");
ok(/every night while the phone charges/i.test(pl[2][0]), "AH1 3 / AC2: Booking needs a browser → checked every night while charging on Wi-Fi");
ok(/under \{p\} or better than your best/.test(pl[3][0]) && pl[3][1].p === 45000, "AH1 4: tells you under 45,000 or better than your best");
ok(/Check every \{h\} hours/.test(A.planLines({ kind: "watch", site: "Amazon", url: "https://www.amazon.eg/s?k=x", what: "AirPods" })[2][0]), "a store that shows prices without a browser: every N hours");
const wp = A.watchPlan({ agents: [{ ...a, on: true }] });
ok(wp.length && wp.every((x) => x.best === 41495), "AC2: the phone is told the best so far (41,495) — it notifies only a price that beats it");
ok(wp.every((x) => x.lastBrowser === now - 1 * H), "AC3: …and when a browser last read it (it asks with one tap after 30 hours without one)");
// subscriptions: who pays it
const g = { id: "g", app: "Gmail", pkg: "com.google.android.gm", title: "Google Play", ts: Date.parse("2026-11-07T15:33:00"),
  text: "Your Google Play Order Receipt from 7 Nov 2026\nYour subscription from Google Commerce Limited on Google Play continues and you've been charged.\nOrder date: 7 Nov 2026 15:33:27 EET\nGoogle AI Pro (5 TB) (Google One) (by Google LLC)\nج.م.‏ ٩٣٩٫٩٩/month\nAuto-renewing subscription" };
const empty = { v: 1, items: [] };
const s1 = AP.suggestions([g], { now: Date.parse("2026-11-10T10:00:00"), life: empty });
ok(s1.length === 1 && s1[0].kind === "subscription" && s1[0].amount === 939.99, "the 7 Nov receipt is still seen on 10 Nov (it counted only 3 days before)");
ok(s1[0].noMoney && s1[0].askPayer, "a NEW subscription: the plan is added, nothing leaves Money before “Who pays it?”");
ok(!AP.actionsFor(s1[0]).some((x) => x.kind === "money"), "…its actions add only the plan");
let life = subPay(empty, { name: "Google Gemini", amount: 939.99, date: "2026-11-07", cur: "EGP", key: "k" }).data;
ok(payerUnknown(life).length === 1, "the card asks once: who pays Google Gemini?");
const dad = setPayer(life, life.items[0].id, "My father");
ok(!payerUnknown(dad).length && dad.items[0].payer === "My father", "“Someone else pays — My father” is saved");
const s2 = AP.suggestions([{ ...g, ts: Date.parse("2026-12-07T15:00:00"), text: g.text.replace(/7 Nov/g, "7 Dec") }], { now: Date.parse("2026-12-07T16:00:00"), life: dad });
ok(s2[0] && s2[0].noMoney && !s2[0].askPayer, "next month (father pays): the plan is ticked, nothing leaves your balance");
const me = setPayer(life, life.items[0].id, "me");
const s3 = AP.suggestions([{ ...g, ts: Date.parse("2026-12-07T15:00:00"), text: g.text.replace(/7 Nov/g, "7 Dec") }], { now: Date.parse("2026-12-07T16:00:00"), life: me });
ok(s3[0] && !s3[0].noMoney && AP.actionsFor(s3[0]).some((x) => x.kind === "money"), "you pay it: next month's payment comes out of Money");
const r = nextReminder(dad.items[0], Date.parse("2026-12-01T10:00:00"));
ok(r && /Renews today/.test(r.title) && /My father pays it; your balance stays the same/.test(r.body) && new Date(r.at).getDate() === 7, "the reminder on the 7th: “Renews today … My father pays it; your balance stays the same”: " + (r && r.body));
// regular.js: a tick on a plan someone else pays never writes Money
const store = { d: { "ledger.v3": JSON.stringify({ txns: [], accounts: [{ id: "a", currency: "EGP" }] }), "attune:life:v1": JSON.stringify(dad) }, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = String(v); } };
const { tickRegular } = await import("../../web-src/regular.js");
const LIFE_KEY = Object.keys(store.d).find((k) => k.includes("life"));
const t = tickRegular(dad.items[0].id, 1, true, { store });
ok(t.recorded === 0 && JSON.parse(store.d["ledger.v3"]).txns.length === 0, "ticking month 2 of the father's subscription takes nothing from Money");
store.d["attune:life:v1"] = JSON.stringify(me);
ok(tickRegular(me.items[0].id, 1, true, { store }).recorded === 939.99 && JSON.parse(store.d["ledger.v3"]).txns.length === 1, "…while the same tick when YOU pay it takes 939.99 out (the control)");
if (fails) { console.log(fails + " failed"); process.exit(1); }
