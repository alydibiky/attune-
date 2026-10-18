// v6.38 (M3) — one timeline for all follow-ups. node tests/unit/v740timeline.test.mjs
import assert from "node:assert/strict";
import { timeline, byDay, totals, nextRing, daysFrom } from "../../web-src/timeline.js";
const now = new Date(2026, 9, 18, 10).getTime(), D = 86400000;
const iso = (n) => { const x = new Date(now + n * D); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
// reminders: a one-off ahead, one passed, a daily one that started last week, a done one
const reminders = [{ id: "a", at: now + 3600000, title: "Call the bank" }, { id: "b", at: now - 3600000, title: "passed" },
  { id: "c", at: now - 7 * D + 7200000, title: "Pills", repeat: "daily" }, { id: "d", at: now + D, title: "done", done: true }];
assert.equal(nextRing(reminders[2], now), now + 7200000);
assert.equal(nextRing(reminders[1], now), null);
const radar = { items: [{ id: "n", kind: "renewal", title: "Netflix", date: iso(2), amount: 240, currency: "EGP", status: "active" },
  { id: "w", kind: "warranty", title: "Fridge", date: iso(10), status: "active" }, { id: "g", kind: "trial", title: "Gone", date: iso(1), status: "cancelled" }]};
const life = { items: [{ id: "i", kind: "installment", dir: "out", person: "Samsung", amount: 1500, currency: "EGP", count: 12, every: "month", start: iso(-10), paid: [] },
  { id: "m", kind: "regular", dir: "out", title: "Maid", amount: 600, currency: "EGP", every: "week", start: iso(-7), paid: [] }]};
const ledger = { currency: "EGP", recurring: [{ id: "e", type: "expense", note: "Electricity ↻", amount: 900, freq: "monthly", nextDate: iso(5) }],
  debts: [{ id: "k", type: "owed_to_me", person: "Karim", amount: 2000, payments: [{ amount: 500 }], dueDate: iso(3) }] };
const xray = [{ id: "x", me: "Ali", items: [{ type: "promise", from: "Ahmed", t: now - 5 * D, amount: 3000, due: iso(-1), what: "هحوّل بكرة" }] }];
const L = timeline({ reminders, radar, life, ledger, xray, now });
const kinds = L.map((x) => x.kind);
assert.ok(!L.some((x) => x.what === "passed" || x.what === "done" || x.what === "Gone"), "passed / done / cancelled are left out");
assert.equal(L[0].kind, "pay"); assert.ok(L[0].late, "the installment from 10 days ago is late, first");   // iso(-10)
assert.ok(L.find((x) => x.kind === "promise").late, "Ahmed's promise from yesterday is late");
assert.equal(L.filter((x) => x.what === "Samsung · installment").length, 2, "the late installment + the next one only");
assert.ok(kinds.includes("reminder") && kinds.includes("renewal") && kinds.includes("warranty") && kinds.includes("bill") && kinds.includes("owed"));
assert.equal(L.find((x) => x.kind === "owed").amount, 1500);
assert.equal(L.find((x) => x.kind === "bill").what, "Electricity");
assert.match(L.find((x) => x.kind === "renewal").slip[0], /charges \{amount\}/);
const maid = L.filter((x) => x.what === "Maid");
assert.ok(maid.length >= 4 && maid.every((x) => !x.late), "the maid: every week ahead, the past days are not 'late'");
const t = totals(L);
assert.equal(t.in.EGP, 1500);
assert.ok(t.out.EGP >= 240 + 1500 + 900);
const days = byDay(L);
assert.ok(days.every((d, i) => i === 0 || d.date > days[i - 1].date));
assert.equal(daysFrom(iso(2), now), 2);
console.log("v740timeline: all passed");
