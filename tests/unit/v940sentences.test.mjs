// v9.4 (Ali, 5 Nov 2026: "19,500 became 20,000 … I told you the chat is too stupid … fix it for good for everything in the chat"):
// real sentences, English and Egyptian Arabic, through every reader the chat uses — each with what it must build. A mistake found on
// the phone gets its sentence here, so it can't come back. And the number guard (numguard.js): every amount said is kept, or the
// chat says so before anything is saved.
import { parseLife, scheduleOf } from "../../web-src/life.js";
import { understand, doSure } from "../../web-src/doit.js";
import { quickAction } from "../../web-src/actions.js";
import { parseAgent } from "../../web-src/agents.js";
import { parseSplit } from "../../web-src/split.js";
import { parseFlight } from "../../web-src/flights.js";
import { missingAmounts, saidAmounts } from "../../web-src/numguard.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const now = Date.parse("2026-11-05T12:00:00");
const plan = (s) => { const c = parseLife(s, { now }); return c ? { ...c, sched: scheduleOf(c, now).map((x) => x.amount) } : null; };
const sum = (a) => Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;

// ---- people & plans: [sentence, kind, dir, each, count, total]
const LIFE = [
  ["Sheikh pays me 19500 in installments of 2500 on first day of each month", "installment", "in", 2500, 8, 19500],
  ["الشيخ هيدفعلي 19500 على أقساط 2500 أول كل شهر", "installment", "in", 2500, 8, 19500],
  ["Ahmed owes me 10,000 and will pay 3,000 a month", "installment", "in", 3000, 4, 10000],
  ["I owe my brother 7500, paying 1000 a month", "installment", "out", 1000, 8, 7500],
  ["اخويا عليه 15 الف هيدفعهم على 6 شهور", "installment", "in", 2500, 6, 15000],
  ["محمد هيدفعلي 2500 كل شهر لحد ما يخلص 12500", "installment", "in", 2500, 5, 12500],
  ["I lent Karim 3k, he pays 500 a month", "installment", "in", 500, 6, 3000],
  ["Ali owes me 1,250.50", "debt", "in", 1250.5, 1, 1250.5],
  ["car installment 4500 a month for 36 months", "installment", "out", 4500, 36, 162000],
  ["قسط العربية 3200 في الشهر لمدة 48 شهر", "installment", "out", 3200, 48, 153600],
  ["Hassan owes me 9,999, 1,000 a month", "installment", "in", 1000, 10, 9999],
  ["Omar pays me 5000 a month for 4 months", "installment", "in", 5000, 4, 20000],
  ["Sara owes me 2.5k, 1k a month", "installment", "in", 1000, 3, 2500],
  ["I bought a phone 30,000 in 12 installments", "installment", "out", 2500, 12, 30000],
  ["عليا لأحمد 8500 هدفعله 2000 كل شهر", "installment", "out", 2000, 5, 8500],
  ["Youssef will pay me back 6000 in 2 payments", "installment", "in", 3000, 2, 6000],
  ["Mona borrowed 4500 from me", "debt", "in", 4500, 1, 4500],
  ["احمد استلف مني 3000", "debt", "in", 3000, 1, 3000],
  ["I borrowed 2000 from Karim", "debt", "out", 2000, 1, 2000],
  ["Karim took 1500 from me and pays 500 a month", "installment", "in", 500, 3, 1500],
];
for (const [s, kind, dir, each, n, total] of LIFE) {
  const c = plan(s) || {};
  ok(c.kind === kind && c.dir === dir && c.amount === each && c.count === n && c.total === total && (n < 2 || sum(c.sched) === total),
    "«" + s + "» → " + kind + " " + dir + " " + each + " × " + n + " = " + total + ": " + JSON.stringify({ k: c.kind, d: c.dir, a: c.amount, n: c.count, t: c.total, sum: c.sched && sum(c.sched) }));
}
ok(plan("Hassan owes me 9,999, 1,000 a month").sched[9] === 999, "…the last payment takes the rest (999), never rounded up");
ok(plan("the maid comes every Saturday 600").kind === "regular" && plan("rent 12000 a month starting 1 December").start === "2026-12-01", "the maid every Saturday; rent from 1 December");
ok(parseLife("karim took the bus", { now }) == null, "“Karim took the bus” is not a debt");

// ---- money said in a few words: [sentence, [[amount, category, income?]…]]
const MONEY = [
  ["spent 250 on lunch", [[250, "food"]]], ["غدا 150", [[150, "food"]]], ["paid 1,200 for electricity", [[1200, "bills"]]],
  ["taxi 85 and coffee 45", [[85, "transport"], [45, "coffee"]]], ["صرفت 300 بنزين و 50 ركنة", [[300, "transport"], [50, "transport"]]],
  ["got my salary 25,000", [[25000, "salary", true]]], ["spent 3 thousand on clothes", [[3000, "shopping"]]], ["paid 12.75 for parking", [[12.75, "transport"]]],
  ["uber 120, lunch 200, coffee 60", [[120, "transport"], [200, "food"], [60, "coffee"]]], ["koshary for lunch 80 pounds", [[80, "food"]]],
];
for (const [s, want] of MONEY) {
  const u = understand(s, { now, stores: {} }), m = (u.actions || []).find((a) => a.kind === "money"), got = m ? m.items.map((x) => [x.amount, x.cat, x.type === "income"]) : [];
  ok(got.length === want.length && want.every((w, i) => got[i][0] === w[0] && got[i][1] === w[1] && got[i][2] === !!w[2]), "«" + s + "» → " + JSON.stringify(want) + ": " + JSON.stringify(got));
}

// ---- reminders: [sentence, day, hh:mm, title]
const pad = (n) => String(n).padStart(2, "0"), when = (ms) => { const d = new Date(ms); return d.getDate() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); };
const REM = [
  ["remind me tomorrow at 9 to call the bank", "6 09:00", "call the bank"], ["فكرني بكرة الساعة 5 العصر اكلم ماما", "6 17:00", "اكلم ماما"],
  ["remind me on 1 December to pay rent", "1 09:00", "pay rent"], ["فكرني كمان ساعتين اشرب ميه", "5 14:00", "اشرب ميه"],
  ["remind me at 7:45 am tomorrow about the meeting", "6 07:45", "the meeting"], ["remind me in 20 minutes to take the pizza out", "5 12:20", "take the pizza out"],
  ["remind me every Sunday at 8 pm to put the bins out", "8 20:00", "put the bins out"],
];
for (const [s, at, title] of REM) { const a = quickAction(s, now) || {}; ok(when(a.at) === at && a.title === title, "«" + s + "» → " + at + " “" + title + "”: " + when(a.at) + " “" + a.title + "”"); }

// ---- splitting a bill: [sentence, people, each]
for (const [s, n, each] of [["dinner 1200 split between 4", 4, 300], ["العشا 1500 علينا 5", 5, 300], ["lunch 900 split 3 ways", 3, 300]]) {
  const sp = parseSplit(s, { currency: "EGP" }) || {}; ok(sp.count === n && sp.each === each, "«" + s + "» → " + n + " people, " + each + " each: " + JSON.stringify({ n: sp.count, e: sp.each }));
}

// ---- flights: [sentence, depart, return]
for (const [s, go, back] of [["cheapest flight from Cairo to Jeddah on 8 January back after 5 nights", "2027-01-08", "2027-01-13"],
  ["طيارة من القاهرة لدبي يوم 20 ديسمبر راجع 27", "2026-12-20", "2026-12-27"], ["flight from Cairo to Paris on 28 December back on the 3rd", "2026-12-28", "2027-01-03"]]) {
  const f = (parseFlight(s, { now, country: "EG" }) || {}).f || {}; ok(f.depart === go && f.ret === back, "«" + s + "» → " + go + " → " + back + ": " + f.depart + " → " + f.ret);
}

// ---- agents: the price limit and the thing
for (const [s, below, what] of [["tell me when AirPods Pro 2 on Amazon go under 9000", 9000, "AirPods Pro 2"], ["نبهني لما الايفون 16 يبقى أقل من 45 الف", 45000, "iPhone 16"], ["buy me a PS5 under 25,000", 25000, "PS5"]]) {
  const a = parseAgent(s, { now, country: "EG" }) || {}; ok(a.below === below && a.what === what, "«" + s + "» → under " + below + " · " + what + ": " + a.below + " · " + a.what);
}

// ---- the number guard
ok(JSON.stringify(saidAmounts("Sheikh pays me 19500 in installments of 2500 on the 1st of each month")) === "[19500,2500]", "amounts said: 19,500 and 2,500 (the 1st is a day, not money)");
ok(saidAmounts("remind me at 6:30 tomorrow, 3 friends, 4 nights, 12 months, 2027, iPhone 16").length === 0, "times, counts, years and models are not amounts");
ok(JSON.stringify(missingAmounts("Sheikh pays me 19500 in installments of 2500", { kind: "installment", amount: 2500, count: 8, total: 20000, sched: Array(8).fill(2500) })) === "[19500]",
  "the old mistake (8 × 2,500 = 20,000) is caught: 19,500 is missing");
let alarms = [];
for (const [s] of LIFE) { const m = missingAmounts(s, plan(s)); if (m.length) alarms.push(s + " " + m); }
for (const [s] of MONEY) { const m = missingAmounts(s, understand(s, { now, stores: {} }).actions); if (m.length) alarms.push(s + " " + m); }
for (const [s] of REM) { const m = missingAmounts(s, quickAction(s, now)); if (m.length) alarms.push(s + " " + m); }
ok(!alarms.length, "no false alarm on any right answer above: " + alarms.join(" | "));
ok(doSure("uber 120, lunch 200, coffee 60", { now }) === true, "a sentence read right is recorded at once (no needless question)");
