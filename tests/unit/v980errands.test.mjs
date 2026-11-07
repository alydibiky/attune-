// v9.8 N3 Errands (Ali: "do N3 … without any mistakes"): added once in your words; warned ahead with the papers; the page's answer is
// read; nothing silent, nothing paid by itself
import assert from "node:assert/strict";
const E = await import("../../web-src/errands.js");
const now = Date.parse("2026-11-07T10:00:00");
const iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const a = E.parseErrand("my car licence expires 3 Feb 2027, plate أ ب ج ١٢٣٤", now);
ok(a.kind === "carLicence" && a.date === "2027-02-03" && a.ref === "أ ب ج 1234", "car licence + date + Arabic plate: " + JSON.stringify(a));
const b = E.parseErrand("رخصة القيادة بتخلص ٢٠ نوفمبر ٢٠٢٦", now); ok(b.kind === "driving" && b.date === "2026-11-20", "Arabic date: " + JSON.stringify(b));
const c = E.parseErrand("check traffic fines for plate ABC 1234 every month", now); ok(c.kind === "fines" && c.every === 1 && c.ref === "ABC 1234", "fines monthly");
const d = E.parseErrand("crane LTM 1100 inspection every 6 months, last on 20 June 2026", now); ok(d.kind === "inspection" && d.every === 6 && d.label === "LTM 1100" && d.date === "2026-06-20", "crane inspection every 6 months: " + JSON.stringify(d));
const m = E.parseErrand("electricity meter 01234567", now); ok(m.kind === "bill" && m.ref === "01234567" && m.every === 1, "electricity meter");
ok(E.parseErrand("buy bread", now) === null, "not an errand");
ok(E.dateIn("3/2/2027") === new Date(2027, 1, 3, 12).getTime(), "3/2/2027 is 3 February (day first, Egypt)");
// what is due
const L = [E.makeErrand(a, 1), E.makeErrand(b, 2), E.makeErrand({ kind: "passport", date: "2028-05-01" }, 3), E.makeErrand(d, 4)];
const due = E.dueList(L, now);
ok(due.length === 1 && due[0].e.kind === "driving" && due[0].days === 13, "the driving licence (13 days) is due; the car licence (88 days) and passport (2028) are not yet: " + due.map((x) => x.e.kind + ":" + x.days));
{ const di = E.dueList(L, Date.parse("2026-12-01T10:00:00")).find((x) => x.e.kind === "inspection"); ok(di && iso(di.date) === "2026-12-20" && di.days === 19, "the crane inspection (every 6 months from 20 June) shows 3 weeks before 20 Dec: " + (di && iso(di.date) + " " + di.days)); }
ok(E.dueList(L, Date.parse("2027-01-10T10:00:00")).some((x) => x.e.kind === "carLicence" && x.why === "expires"), "30 days before: the car licence shows, with its papers");
ok(E.KINDS.carLicence.papers.ar.includes("مخالصة المخالفات"), "the papers for a car licence in Egypt");
// the page's answer
ok(E.readPortal("إجمالي المخالفات: 450 جنيه — عدد 2 مخالفة").amount === 450 && E.readPortal("إجمالي المخالفات: 450 جنيه — عدد 2 مخالفة").count === 2, "a fines page: 450, 2 fines");
ok(E.readPortal("لا توجد مخالفات مسجلة").none, "no fines");
ok(E.readPortal("Welcome, please log in") === null, "a login page says nothing — nothing is invented");
let f = E.afterCheck(E.makeErrand(c, 5), E.readPortal("Total amount due EGP 650"), now);
ok(E.dueList([f], now)[0].why === "due" && E.dueList([f], now)[0].amount === 650, "a fine found → due, 650, until you mark it paid");
f = E.markDone(f, { now }); ok(!E.dueList([f], now).length, "paid → gone (next month's look comes by itself)");
ok(E.dueList([E.afterCheck(E.makeErrand(c, 6), { amount: 0, none: true }, now)], now + 20 * 864e5).length === 0 && E.dueList([E.afterCheck(E.makeErrand(c, 6), { amount: 0, none: true }, now)], now + 29 * 864e5).length === 1, "monthly: the next look is a month after the last");
console.log(`ALL PASSED v980errands (${n} checks)`);
