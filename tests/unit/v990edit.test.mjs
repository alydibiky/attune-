// v9.9 edit by talking (Ali, 8 Nov 2026: "telling it the maid is now taking 700 and it gets done") — lifeedit.js + life.js changes
import assert from "node:assert/strict";
import { editIntent, applyEdit, editDone, amountAt } from "../../web-src/lifeedit.js";
import { scheduleOf, tickEntry } from "../../web-src/life.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS " + m); };
const NOW = Date.parse("2026-11-08T10:00:00");   // a Sunday
const maid = { id: "md", kind: "regular", title: "Maid", dir: "out", amount: 600, every: "week", start: "2026-10-03", currency: "EGP", paid: [0, 1, 2, 3, 4], created: 1 };
const wash = { id: "cw", kind: "regular", title: "Car wash", dir: "out", amount: 700, every: "month", start: "2026-09-01", currency: "EGP", paid: [0, 1], created: 2 };
const sheikh = { id: "sh", kind: "installment", person: "Sheikh", dir: "in", amount: 2500, total: 19500, count: 8, every: "month", start: "2026-10-05", currency: "EGP", paid: [0], created: 3 };
const voda = { id: "vf", kind: "bill", title: "Vodafone bill", dir: "out", amount: 450, every: "month", start: "2026-11-15", currency: "EGP", paid: [], created: 4 };
const arMaid = { ...maid, id: "am", title: "الخدامة" };
const items = [maid, wash, sheikh, voda];

// --- what is understood
let e = editIntent("the maid is now taking 700", items, NOW);
ok(e && e.id === "md" && e.change.amount === 700 && e.was === 600, "“the maid is now taking 700” → Maid, 700 from today (was 600)");
ok(editIntent("maid now 700", items, NOW).change.amount === 700, "“maid now 700”");
ok(editIntent("الخدامة بقت بـ٧٠٠", items, NOW).id === "md", "«الخدامة بقت بـ٧٠٠» finds Maid (saved in English)");
ok(editIntent("the maid takes 700 now", [arMaid], NOW).id === "am", "“the maid takes 700 now” finds «الخدامة» (saved in Arabic)");
ok(editIntent("الشغالة بتاخد ٧٠٠ دلوقتي", items, NOW).change.amount === 700, "«الشغالة بتاخد ٧٠٠ دلوقتي» — the same person, another word");
ok(editIntent("car wash is 800 now", items, NOW).change.amount === 800, "“car wash is 800 now”");
ok(editIntent("vodafone bill is 500 now", items, NOW).id === "vf", "“vodafone bill is 500 now”");
ok(editIntent("I paid the maid 700", items, NOW) === null, "“I paid the maid 700” is a payment, not a change");
ok(editIntent("how much is the maid now?", items, NOW) === null, "a question is not a change");
ok(editIntent("maid 700", items, NOW) === null, "“maid 700” alone (no change word) stays an expense");
e = editIntent("the maid comes on Friday now", items, NOW);
ok(e && e.change.weekday === 5, "“the maid comes on Friday now” → Fridays");
ok(editIntent("الخدامة بقت تيجي يوم الجمعة", items, NOW).change.weekday === 5, "«الخدامة بقت تيجي يوم الجمعة» → Fridays");
e = editIntent("move the car wash to the 5th", items, NOW);
ok(e && e.change.day === 5, "“move the car wash to the 5th” → the 5th of each month");
ok(editIntent("stop the car wash", items, NOW).change.stop === true, "“stop the car wash” → stopped");
ok(editIntent("الخدامة مش هتيجي تاني", items, NOW).change.stop === true, "«الخدامة مش هتيجي تاني» → stopped");
e = editIntent("Sheikh will pay 3000 a month now", items, NOW);
ok(e && e.blocked === "plan" && e.total === 19500, "Sheikh's plan (19,500 in 8) is not changed by a sentence — People & plans");
ok(editIntent("the maid is 600 now", items, NOW).same === true, "the same amount → nothing changes");

// --- what is saved: from today on, the past stays
let data = applyEdit({ v: 1, items }, editIntent("the maid is now taking 700", items, NOW), NOW);
let m = data.items.find((x) => x.id === "md"), s = scheduleOf(m, NOW);
ok(m.amount === 700 && s.filter((x) => x.date < "2026-11-08").every((x) => x.amount === 600), "the Saturdays before today stay 600");
ok(s.filter((x) => x.date >= "2026-11-08").every((x) => x.amount === 700) && s.some((x) => x.date >= "2026-11-08"), "from today on: 700");
ok(tickEntry(m, 1, NOW).amount === 600 && amountAt(m, "2026-11-14") === 700, "a past day's Money entry stays 600, next Saturday is 700");
ok(editDone(editIntent("the maid is now taking 700", items, NOW), { now: NOW }) === "Done — Maid is now 700 a week from today (was 600).", "the answer: Done — Maid is now 700 a week from today (was 600).");
ok(/الخدامة|Maid/.test(editDone(editIntent("الخدامة بقت بـ٧٠٠", items, NOW), { ar: true, now: NOW })) && /٧٠٠|700/.test(editDone(editIntent("الخدامة بقت بـ٧٠٠", items, NOW), { ar: true, now: NOW })), "the Arabic answer says the name and 700");

data = applyEdit({ v: 1, items }, editIntent("the maid comes on Friday now", items, NOW), NOW);
s = scheduleOf(data.items.find((x) => x.id === "md"), NOW);
ok(s.filter((x) => x.date < "2026-11-08").every((x) => new Date(x.date + "T12:00").getDay() === 6), "Saturdays before today stay Saturdays");
ok(s.filter((x) => x.date >= "2026-11-08").length >= 1 && s.filter((x) => x.date >= "2026-11-08").every((x) => new Date(x.date + "T12:00").getDay() === 5), "from today: Fridays (first 13 Nov)");
ok(s.find((x) => x.date >= "2026-11-08").date === "2026-11-13" && s.filter((x) => x.paid).length === 5, "the 5 paid Saturdays keep their ticks");

data = applyEdit({ v: 1, items }, editIntent("stop the car wash", items, NOW), NOW);
s = scheduleOf(data.items.find((x) => x.id === "cw"), NOW);
ok(s.every((x) => x.date < "2026-11-08") && s.filter((x) => x.paid).length === 2, "stopped: no car wash from today, the 2 paid stay");

data = applyEdit({ v: 1, items }, editIntent("move the car wash to the 5th", items, NOW), NOW);
s = scheduleOf(data.items.find((x) => x.id === "cw"), NOW);
ok(s.some((x) => x.date === "2026-12-05") && !s.some((x) => x.date === "2026-12-01"), "car wash: 5 Dec, not 1 Dec");

// twice on the same day: the second amount replaces the first, "was" stays the old one
let d2 = applyEdit({ v: 1, items }, editIntent("maid now 700", items, NOW), NOW);
d2 = applyEdit(d2, editIntent("maid now 750", d2.items, NOW), NOW);
m = d2.items.find((x) => x.id === "md");
ok(m.amount === 750 && m.changes.length === 1 && m.changes[0].was === 600, "said again the same day: 750, one change, was 600");
console.log("ALL PASSED v990edit (" + n + " checks)");
