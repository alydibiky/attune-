// Persona 9 (a heavy user, one year of daily use through Home, 28 Oct 2026): what broke over time, now fixed.
import assert from "node:assert/strict";
const LS = {}; globalThis.localStorage = { getItem: (k) => LS[k] ?? null, setItem: (k, v) => { LS[k] = String(v); }, removeItem: (k) => delete LS[k] };
LS["attune:country"] = "eg";
const D = await import("../../web-src/doit.js"), L = await import("../../web-src/life.js"), A = await import("../../web-src/lifeask.js"), M = await import("../../web-src/myledger.js"), R = await import("../../web-src/fitread.js");
let n = 0; const t = (name, fn) => { fn(); n++; };
const empty = () => ({ ledger: null, life: { items: [] }, fit: { days: {} }, radar: { items: [] }, care: { members: [], meds: [], labs: [], taken: {} }, reminders: [], memory: [] });
const now = Date.parse("2026-10-28T12:00:00");
const kinds = (q, s = empty()) => D.understand(q, { now, stores: s }).actions.map((a) => a.kind + (a.items ? ":" + a.items.map((i) => i.amount || i.name).join("+") : "")).join(" ");

t("a shopping word + a price is money, not a food with the number thrown away", () => {
  assert.equal(kinds("vegetables 460"), "money:460");
  assert.equal(kinds("خضار 415"), "money:415");
  assert.equal(kinds("koshari 85"), "money:85");
  assert.match(kinds("rice 200"), /^food/);          // 200 g taken by the food reader
  assert.match(kinds("2 eggs"), /^food/);
});
t("«طعمية» is not water, a water bill is not a drink", () => {
  assert.equal(kinds("صرفت ٥٧ على فول وطعمية"), "money:57");
  assert.equal(kinds("دفعت فاتورة المية 200"), "money:200");
  assert.equal(kinds("water bill 300"), "money:300");
  assert.equal(kinds("شربت ٣ كوبايات مية"), "water");
});
t("English with an Arabic-script name is a debt", () => {
  assert.equal(kinds("I lent محمد 1603"), "life");
  assert.equal(kinds("محمد owes me 1730"), "life");
});
t("the meal word is not part of the food's name", () => {
  const it = R.readMealText("طبق فول وعيش بلدي على الفطار").items;
  assert.ok(!it.some((x) => /الفطار/.test(x.name)), it.map((x) => x.name).join());
});
t("a subscription typed again is this month's payment, not a second subscription", () => {
  const s = empty(); let u = D.understand("netflix 250", { now, stores: s });
  for (const a of u.actions) { const r = D.apply(a, s, { now }); if (r.stores["attune:life:v1"]) s.life = r.stores["attune:life:v1"]; }
  assert.equal(s.life.items.length, 1);
  u = D.understand("netflix 250", { now: now + 30 * 864e5, stores: s });
  assert.deepEqual(u.actions.map((a) => a.kind), ["repay", "money"]);
  const r = D.apply(u.actions[0], s, { now: now + 30 * 864e5 }); s.life = r.stores["attune:life:v1"];
  assert.equal(s.life.items.length, 1); assert.match(r.done.en, /this month's 250 paid/);
  const sch = L.scheduleOf(s.life.items[0], now + 30 * 864e5);
  assert.equal(sch.filter((x) => x.paid).length, 1); assert.ok(sch.some((x) => !x.paid), "the plan goes on");
});
t("an open-ended plan keeps a year ahead of today", () => {
  const c = { kind: "subscription", every: "month", amount: 250, count: 0, total: 0, created: Date.parse("2025-01-10T12:00:00"), paid: [] };
  const s = L.scheduleOf(c, Date.parse("2026-10-28T12:00:00"));
  assert.ok(s[s.length - 1].date >= "2027-09-01", s[s.length - 1].date);
});
t("who owes me: one row per person", () => {
  const items = [["Sara", 1000], ["Sara", 500], ["Ahmed", 300]].map(([p, a], i) => ({ id: "x" + i, person: p, dir: "in", kind: "debt", amount: a, total: a, count: 1, currency: "EGP", created: now - 864e5, paid: [] }));
  const r = A.askLife("who owes me money?", { ...empty(), life: { items } }, { now });
  assert.match(r.en, /^2 people owe you 1,800/); assert.equal(r.rows.length, 2); assert.match(r.rows[0][0], /Sara \(2 loans\)/);
});
t("'when did I last pay …' is not a this-month money sum", () => {
  assert.equal(M.myMoneyIntent("when did I last pay netflix?"), "");
  assert.equal(M.myMoneyIntent("امتى آخر مرة دفعت كهربا؟"), "");
  assert.equal(M.myMoneyIntent("how much did I spend this month?"), "expense");
});
console.log(`v860p9: ${n} checks passed`);
