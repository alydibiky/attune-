// Ali's picks from persona 9 (28 Oct): H-A … H-E.
import assert from "node:assert/strict";
const LS = {}; globalThis.localStorage = { getItem: (k) => LS[k] ?? null, setItem: (k, v) => { LS[k] = String(v); }, removeItem: (k) => delete LS[k] };
LS["attune:country"] = "eg";
const S = await import("../../web-src/safespend.js"), L = await import("../../web-src/life.js"), D = await import("../../web-src/doit.js"), M = await import("../../web-src/monthreview.js"), T = await import("../../web-src/timeline.js");
let n = 0; const t = (name, fn) => { fn(); n++; };
const now = Date.parse("2026-10-20T10:00:00");
const led = (txns) => ({ currency: "EGP", accounts: [{ id: "c", name: "Cash", currency: "EGP", start: 150000 }], txns, recurring: [], debts: [] });
t("H-A: savings are not spending money", () => {
  const s = S.safeToSpend({ ledger: led([{ type: "income", amount: 30000, date: "2026-10-01", account: "c" }, { type: "expense", amount: 10000, date: "2026-10-10", account: "c" }]), now });
  assert.equal(s.basis, "month"); assert.equal(s.perDay, Math.floor(20000 / 12));
  assert.equal(S.safeToSpend({ ledger: led([]), now }).basis, "balance");   // no income this month: as before
});
t("H-B: a loan with no date is open, never late", () => {
  const c = L.chatLifeIntent("Sara owes me 2000", { now: now - 200 * 864e5 }); const life = L.addCommitment({ v: 1, items: [] }, c, now - 200 * 864e5);
  assert.ok(L.isOpenLoan(life.items[0])); assert.equal(L.dueSoon(life, now).length, 0);
  assert.equal(T.timeline({ life, now, days: 30 }).filter((x) => x.late).length, 0);
});
t("H-D: a new subscription offers 'Paid today'", () => {
  const st = { ledger: null, life: { items: [] }, fit: { days: {} }, radar: { items: [] }, care: { members: [], meds: [], labs: [], taken: {} }, reminders: [], memory: [] };
  const a = D.understand("netflix 250", { now, stores: st }).actions[0]; const r = D.apply(a, st, { now });
  assert.equal(r.followUp.actions[0].items[0].amount, 250);
});
t("H-E: last month in one look", () => {
  const r = M.monthReview({ ledger: led([{ type: "income", amount: 30000, date: "2026-09-01", account: "c", cat: "salary" }, { type: "expense", amount: 6000, date: "2026-09-05", account: "c", cat: "food" }, { type: "expense", amount: 9000, date: "2026-09-08", account: "c", cat: "rent" }]) }, Date.parse("2026-10-01T09:00"));
  assert.equal(r.spent, 15000); assert.equal(r.keptPct, 50); assert.equal(r.top.cat, "rent");
  assert.match(M.reviewLines(r, "en", "EGP")[0], /^September: spent 15,000 EGP · earned 30,000 · 50% kept/);
});
console.log(`v870p9: ${n} checks passed`);
const GU = await import("../../web-src/guardian.js");
t("Attune Saves: agent price drops and the month's saved line", () => {
  let g = { saved: [], dismissed: [] };
  g = GU.agentSaved(g, { id: "a1", title: "AirPods", checks: [{ at: 1, price: 9400 }, { at: 2, price: 8700 }] }, 8700, Date.parse("2026-09-10"));
  g = { ...g, saved: [...g.saved, { id: "late:x", kind: "late", amount: 500, at: Date.parse("2026-09-20"), what: "Collected" }] };
  const s = GU.savedIn(g, "2026-09"); assert.equal(s.total, 1200);
  const r = M.monthReview({ ledger: led([{ type: "expense", amount: 100, date: "2026-09-05", account: "c", cat: "food" }]), guardian: g }, Date.parse("2026-10-01T09:00"));
  assert.ok(M.reviewLines(r, "en", "EGP").some((l) => l === "Attune saved you 1,200 — a better price found, a debt collected"));
});
console.log(`v870p9 (+ saves): ${n} checks passed`);
const LA = await import("../../web-src/lifeask.js");
t("ask anything over your life: a month by name, a word not a category, the biggest, a person", () => {
  const nowA = Date.parse("2026-10-28T10:00:00");
  const L2 = led([{ type: "expense", amount: 100, date: "2026-09-03", account: "c", cat: "transport", note: "uber" }, { type: "expense", amount: 50, date: "2026-09-04", account: "c", cat: "transport", note: "metro" },
    { type: "expense", amount: 70, date: "2026-10-03", account: "c", cat: "transport", note: "uber" }, { type: "expense", amount: 900, date: "2026-10-05", account: "c", cat: "rent", note: "rent" }]);
  assert.match(LA.askLife("how much did I spend on uber in September?", { ledger: L2, life: { items: [] } }, { now: nowA }).en, /^You spent 100 EGP on “uber” in September — 1 payment/);
  assert.match(LA.askLife("what did I spend most on this year?", { ledger: L2, life: { items: [] } }, { now: nowA }).en, /^Most went on rent this year: 900/);
  const life = L.addCommitment({ v: 1, items: [] }, L.chatLifeIntent("Sara owes me 2000", { now: nowA }), nowA);
  assert.match(LA.askLife("how much did I spend on Sara this year?", { ledger: L2, life }, { now: nowA }).en, /^You lent Sara 2,000 EGP this year \(1 time\)/);
});
console.log(`v870p9 (+ ask): ${n} checks passed`);
