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
const M = await import("../../web-src/morning.js");
t("the morning card says what is due, safe to spend, yesterday's food and an agent's find", () => {
  const day = Date.parse("2026-10-16T07:00:00");
  const fit = { days: { "2026-10-15": { meals: { lunch: [{ name: "Koshari", kcal: 700, p: 20, c: 120, f: 10 }] } } }, goal: 2000 };
  const c = M.morningCard({ ledger, life: { items: [] }, fit, agents: { agents: [{ on: true, title: "AirPods", found: { at: day - 3600e3, price: 8700 } }] } }, day, "en");
  assert.ok(c.lines.some((l) => /^Safe to spend today/.test(l)), c.lines.join("|"));
  assert.ok(c.lines.includes("Yesterday: 700 of 2,000 kcal")); assert.ok(c.lines.includes("Agent found AirPods: 8,700"));
  const r = M.morningReminder({ ledger, fit }, Date.parse("2026-10-15T21:00:00"), "en");
  assert.equal(new Date(r.at).getDate(), 16); assert.equal(new Date(r.at).getHours(), 8); assert.equal(r.id, "daily-morning");
  assert.equal(M.morningReminder({}, Date.parse("2026-10-15T21:00:00")), null);
});
console.log(`v870plan (+ morning): ${n} checks passed`);
{ // v8.7 (Ali: "I write I want to save 4000 for travelling, so at the end of the year I save 48000")
  const P = await import("../../web-src/planner.js"), now = new Date(2026, 0, 10).getTime();
  const pi = P.potIntent("save 4000 a month for travel", now); assert.equal(pi.per, 4000); assert.equal(P.potIntent("حوّش 4000 كل شهر للسفر", now).per, 4000);
  const d = P.addPot({ pots: [] }, pi, now), pl = P.planMonth({ ledger: { txns: [{ type: "income", date: "2026-01-02", amount: 20000 }] }, pots: d, now });
  assert.equal(pl.pots[0].monthly, 4000); assert.equal(pl.pots[0].yearly, 48000); assert.equal(pl.year.byYearEnd, 48000); assert.equal(pl.year.savedPerYear, 48000);
  const late = P.planMonth({ ledger: { txns: [] }, pots: d, now: new Date(2026, 9, 10).getTime() });   // from October: 3 months left
  assert.equal(late.pots[0].byYearEnd, 12000);
  console.log("v870plan (+ year): monthly 4000 → 48,000 a year");
}
{ // a goal with a total counts in the year only up to what is left
  const P = await import("../../web-src/planner.js"), now = new Date(2026, 9, 10).getTime();
  const d = { pots: [{ id: "e", name: "Emergency", kind: "other", target: 11040, saved: 11000, log: [] }, { id: "t", name: "Travel", kind: "travel", target: 20000, by: "2027-06", saved: 2000, log: [] }] };
  const pl = P.planMonth({ ledger: { txns: [] }, pots: d, now }), e = pl.pots.find((x) => x.id === "e"), t = pl.pots.find((x) => x.id === "t");
  assert.equal(e.yearMonths, 10); assert.equal(e.yearly, 40); assert.equal(t.yearMonths, 9); assert.equal(t.yearly, 18000);
  console.log("v870plan (+ year caps): Emergency 40, Travel 18,000");
}
