// v8.7 the money planner (Ali, 28 Oct): plan the month and set money aside for travel, emergency…
import assert from "node:assert/strict";
const LS = {}; globalThis.localStorage = { getItem: (k) => LS[k] ?? null, setItem: (k, v) => { LS[k] = String(v); }, removeItem: (k) => delete LS[k] };
const P = await import("../../web-src/planner.js");
let n = 0; const t = (name, fn) => { fn(); n++; };
const now = Date.parse("2026-10-15T10:00:00");
const tx = []; for (const m of ["07", "08", "09"]) { tx.push({ type: "income", amount: 30000, date: `2026-${m}-01`, cat: "salary" }, { type: "expense", amount: 6000, date: `2026-${m}-05`, cat: "food" }, { type: "expense", amount: 3000, date: `2026-${m}-09`, cat: "transport" }); }
tx.push({ type: "income", amount: 30000, date: "2026-10-01", cat: "salary" });
const ledger = { txns: tx, recurring: [] };
t("reads savings goals in English and Egyptian", () => {
  assert.deepEqual(P.potIntent("save 20000 for travel by June", now), { name: "Travel", kind: "travel", target: 20000, by: "2027-06" });
  assert.deepEqual(P.potIntent("احوش ١٠ الاف للعيد في ٥ شهور", now), { name: "العيد", kind: "eid", target: 10000, by: "2027-02" });
  assert.equal(P.potIntent("emergency fund", now).target, 0);
  assert.equal(P.potIntent("how can I save money?", now), null);
});
t("the month's plan: income − fixed − goals − everyday = free", () => {
  let pots = P.addPot({ v: 1, pots: [] }, { name: "Travel", kind: "travel", target: 9000, by: "2027-06" }, now);
  pots = P.addPot(pots, { name: "Emergency", kind: "emergency", target: 0 }, now + 1);
  const pl = P.planMonth({ ledger, life: { items: [] }, pots, now });
  assert.equal(pl.income, 30000);
  assert.equal(pl.pots.find((p) => p.kind === "travel").monthly, 1000);        // 9,000 over 9 months
  assert.equal(pl.pots.find((p) => p.kind === "emergency").target, 27000);    // 3 months × 9,000
  assert.equal(pl.flexTotal, 9000); assert.equal(pl.free, 30000 - 1000 - 2250 - 9000);
});
t("when the money doesn't reach, everyday spending comes down and says so", () => {
  const pots = P.addPot({ v: 1, pots: [] }, { name: "Car", kind: "car", target: 100000, by: "2027-01" }, now);
  const pl = P.planMonth({ ledger, life: { items: [] }, pots, now });
  assert.ok(pl.flexTotal < 9000); assert.match(pl.tips[0][0], /less than usual/);
});
t("money put into a pot counts for this month", () => {
  let pots = P.addPot({ v: 1, pots: [] }, { name: "Travel", kind: "travel", target: 9000, by: "2027-06" }, now);
  pots = P.fundPot(pots, pots.pots[0].id, 1000, now);
  const p = P.planMonth({ ledger, life: { items: [] }, pots, now }).pots[0]; assert.equal(p.saved, 1000); assert.equal(p.onTrack, true);
});
console.log(`v870plan: ${n} checks passed`);
