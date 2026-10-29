// v8.7 (Ali: "a year plan with months, like in Excel"): the year as a sheet
import assert from "node:assert/strict";
import { yearGrid, yearRows, setCell, goalsOfYear } from "../../web-src/yearplan.js";
let n = 0; const t = (name, f) => { f(); n++; };
const now = new Date(2026, 9, 15, 12).getTime();   // 15 Oct 2026
const tx = (date, type, amount, cat, note = "") => ({ id: date + note + amount, type, date, amount, cat, note, account: "a" });
const ledger = { currency: "EGP", accounts: [{ id: "a", name: "Bank", currency: "EGP" }], recurring: [{ id: "net", note: "Internet", amount: 500, nextDate: "2026-11-05", type: "expense" }],
  txns: [...["07", "08", "09"].flatMap((m) => [tx(`2026-${m}-01`, "income", 30000, "salary", "Salary"), tx(`2026-${m}-03`, "expense", 3000, "groceries"), tx(`2026-${m}-10`, "expense", 1200, "food")]),
    tx("2026-10-01", "income", 30000, "salary", "Salary"), tx("2026-10-02", "income", 5000, "other", "Flat rent"), tx("2026-10-03", "expense", 2500, "groceries")] };
const life = { items: [{ id: "maid", dir: "out", person: "Maid", kind: "regular", title: "Maid", amount: 600, every: "month", start: "2026-01-10" }] };
const pots = { pots: [{ id: "trip", name: "Travel", kind: "travel", target: 0, per: 4000, saved: 0, log: [] }] };

t("months as columns; past months are what happened, coming months the plan", () => {
  const g = yearGrid({ ledger, life, pots, plan: { cells: {} }, now });
  assert.equal(g.months.length, 12); assert.equal(g.months[0], "2026-01"); assert.equal(g.nowIdx, 9);
  const inc = g.groups.find((x) => x.id === "income"), sal = inc.rows.find((r) => r.label === "Salary");
  assert.equal(sal.cells[8], 30000); assert.equal(sal.actual[8], true, "September = actual");
  assert.equal(sal.cells[10], 30000, "November = the usual salary"); assert.equal(sal.actual[10], false);
  const groc = g.groups.find((x) => x.id === "everyday").rows.find((r) => /Groceries/.test(r.label));
  assert.equal(groc.cells[7], 3000); assert.ok(groc.cells[11] > 0, "December groceries planned from the average");
});
t("savings: 4,000 a month from this month on = 12,000 by the end of 2026", () => {
  const g = yearGrid({ ledger, life, pots, plan: { cells: {} }, now }), trip = g.groups.find((x) => x.id === "savings").rows[0];
  assert.deepEqual(trip.cells.slice(9), [4000, 4000, 4000]); assert.equal(trip.cells[3], 0); assert.equal(trip.total, 12000);
});
t("a bill on its months; Free = income − everything planned", () => {
  const g = yearGrid({ ledger, life, pots, plan: { cells: {} }, now }), net = g.groups.find((x) => x.id === "fixed").rows.find((r) => r.label === "Internet");
  assert.equal(net.cells[10], 500); assert.equal(net.cells[9], 0, "starts in November");
  assert.equal(g.free[10], g.income[10] - g.out[10]);
});
t("type over any cell, like Excel — the totals follow", () => {
  let plan = setCell({ cells: {} }, "src:salary", "2026-12", 45000);   // a bonus in December
  const g = yearGrid({ ledger, life, pots, plan, now }), sal = g.groups[0].rows.find((r) => r.id === "src:salary");
  assert.equal(sal.cells[11], 45000); assert.equal(sal.typed[11], true);
  assert.equal(setCell(plan, "src:salary", "2026-12", "").cells["src:salary|2026-12"], undefined, "empty = back to the plan");
  const rows = yearRows(g); assert.equal(rows[0].length, 14); assert.equal(rows[rows.length - 1][0], "Free");
});
t("1B goals first: each goal's months, and the months it runs short", () => {
  const pots2 = { pots: [...pots.pots, { id: "umrah", name: "Umrah", kind: "other", target: 90000, by: "2026-12", saved: 0, log: [] }] };
  const g = yearGrid({ ledger, life, pots: pots2, plan: { cells: {} }, now }), y = goalsOfYear(g, now);
  const u = y.goals.find((x) => x.id === "umrah"), tr = y.goals.find((x) => x.id === "trip");
  assert.equal(u.name, "Umrah"); assert.equal(u.monthly, 30000); assert.deepEqual(u.months, [9, 10, 11]);
  assert.equal(tr.monthly, 4000); assert.deepEqual(y.coming, [9, 10, 11]);
  assert.ok(u.tight.length > 0, "90k in 3 months is more than this salary leaves: the plan says which months run short");
  assert.equal(y.freeAvg, Math.round((g.free[9] + g.free[10] + g.free[11]) / 3));
});
console.log(`v870yearplan: ${n} checks passed`);
