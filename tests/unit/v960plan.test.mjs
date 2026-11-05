// v9.6 (Ali, 5 Nov): savings goals that fill themselves at the end of each month, from the net of income − expenses
import assert from "node:assert/strict";
const P = await import("../../web-src/planner.js");
const tx = (m, inc, out) => [{ type: "income", amount: inc, date: m + "-01", cat: "salary" }, { type: "expense", amount: out, date: m + "-10", cat: "groceries" }];
let data = { v: 1, pots: [] };
data = P.addPot(data, { name: "House", target: 120000, by: "2027-12", saved: 22000 }, Date.parse("2026-11-01"));
data = P.addPot(data, { name: "Eid", target: 15000, by: "2027-03", saved: 4000 }, Date.parse("2026-11-02"));
// first open in November: starts here, nothing settled backwards
let r = P.settleMonths(data, { txns: tx("2026-10", 40000, 10000) }, Date.parse("2026-11-05T10:00:00"));
assert.equal(r.data.since, "2026-11"); assert.equal(r.done.length, 0);
data = r.data;
// end of November, net 13,240 ≥ what the goals need → exactly the agreed amounts go in
const novNeedHouse = Math.ceil(98000 / 14), novNeedEid = Math.ceil(11000 / 5);
assert.equal(P.needIn(data.pots[0], "2026-11"), novNeedHouse); assert.equal(P.needIn(data.pots[1], "2026-11"), novNeedEid);
r = P.settleMonths(data, { txns: tx("2026-11", 40000, 26760) }, Date.parse("2026-12-02T10:00:00"));
assert.equal(r.done.length, 1); assert.equal(r.done[0].net, 13240); assert.equal(r.done[0].put, novNeedHouse + novNeedEid); assert.equal(r.done[0].short, 0);
assert.equal(r.data.pots[0].saved, 22000 + novNeedHouse); assert.equal(r.data.pots[1].saved, 4000 + novNeedEid);
data = r.data;
// December is a short month (net 3,000 < needed) → only 3,000 goes in, shared by need; January's need goes UP (spread)
const decNeeds = [P.needIn(data.pots[0], "2026-12"), P.needIn(data.pots[1], "2026-12")];
r = P.settleMonths(data, { txns: tx("2026-12", 30000, 27000) }, Date.parse("2027-01-03T10:00:00"));
assert.equal(r.done[0].put, 3000); assert.ok(r.done[0].short > 0);
assert.equal(r.data.pots[0].saved + r.data.pots[1].saved, data.pots[0].saved + data.pots[1].saved + 3000, "exactly the net went in");
assert.ok(P.needIn(r.data.pots[1], "2027-01") > decNeeds[1], "the shortfall is spread over the months left");
// a loss → nothing goes in; settled once only
const r2 = P.settleMonths(r.data, { txns: [] }, Date.parse("2027-01-20T10:00:00"));
assert.equal(r2.done.length, 0, "a month is never settled twice");
// undo takes it back out
const u = P.undoSettle(r.data, "2026-12");
assert.equal(u.pots[0].saved + u.pots[1].saved, data.pots[0].saved + data.pots[1].saved); assert.ok(u.settled["2026-12"].undone);
// a month with nothing recorded is not counted as a loss
const r3 = P.settleMonths({ ...data, settled: {} , since: "2026-12" }, { txns: [] }, Date.parse("2027-01-03T10:00:00"));
assert.ok(r3.done[0].nodata); assert.equal(r3.done[0].put, 0);
// P5 slider: a total-by-a-date goal moved to 10,000 a month → its date moves, a monthly goal its amount
const s = P.setMonthly(data, data.pots[0].id, 10000, Date.parse("2026-12-02T10:00:00"));
assert.equal(s.pots[0].by, "2027-09");
// P4 calendar + P6 table
const cal = P.monthCalendar({ ledger: { txns: tx("2026-11", 40000, 26760) }, life: null, month: "2026-11", now: Date.parse("2026-11-05") });
assert.equal(cal.days.length, 30); assert.equal(cal.days[0].in, 40000); assert.equal(cal.days[9].out, 26760);
const plan = P.planMonth({ ledger: { txns: [...tx("2026-08", 40000, 8000), ...tx("2026-09", 40000, 8000), ...tx("2026-10", 40000, 8000), ...tx("2026-11", 40000, 5000)] }, life: null, pots: data, now: Date.parse("2026-11-20T10:00:00") });
const rows = P.planVsActual(plan, { txns: tx("2026-11", 40000, 5000) });
const g = rows.find((x) => x.cat === "groceries"); assert.equal(g.actual, 5000); assert.equal(g.left, g.plan - 5000);
console.log("ALL PASSED v960plan (22 checks)");
