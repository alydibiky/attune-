// v6.38 Missions phase 2 — the Life Simulator. node tests/unit/v740lifesim.test.mjs
import assert from "node:assert/strict";
import { monthlyBlocks, simulate, verdict, STRESS } from "../../web-src/lifesim.js";
// 120 days: salary 30,000 on day 1 of each 30, spending 600 a day → net +12,000 a month
const income = Array.from({ length: 120 }, (_, i) => (i % 30 === 0 ? 30000 : 0)), net = income.map((v) => v - 600);
const B = monthlyBlocks(net, income);
assert.equal(B.blocks.length, 91); assert.ok(B.blocks.every((x) => x === 12000));
assert.equal(B.income, 30000); assert.equal(B.spend, 18000);
assert.equal(monthlyBlocks(net.slice(0, 20)), null);
const opts = [{ name: "Cash", now: 900000, monthly: 0, months: 0, value: 900000 }, { name: "Installments", now: 200000, monthly: 15000, months: 60, value: 900000 }];
const a = simulate({ blocks: B, balance: 920000, options: opts, rates: { sims: 600 } });
const cash = a.results.find((x) => x.name === "Cash"), inst = a.results.find((x) => x.name === "Installments"), base = a.results[0];
assert.ok(base.base && base.ok === 1);
assert.ok(cash.ok === 1, "cash: 20,000 left + 12,000 a month never goes below zero");
assert.ok(inst.ok === 1 && inst.at[1].p50 > cash.at[1].p50, "installments keep more cash in year 1");
// fixed installments shrink with inflation: their real total is below the nominal 900,000
assert.ok(inst.worth5 > cash.worth5 - 200000, "installments are not 900k worse in real terms");
assert.equal(a.results[1].stress.length, STRESS.length);
const noInc = cash.stress.find((s) => s.id === "noincome");
assert.ok(noInc.ok < 1, "three months without income breaks the cash option (only 20,000 left)");
assert.ok(a.best, "a best option is named");
const v = verdict(a); assert.ok(v && /\{best\}/.test(v[0]));
// same data → same answer (seeded)
assert.deepEqual(simulate({ blocks: B, balance: 920000, options: opts, rates: { sims: 600 } }).results[1].at, a.results[1].at);
// too little money: the warning
const poor = simulate({ blocks: monthlyBlocks(income.map((v) => v - 990), income), balance: 0, options: [{ name: "Car", now: 0, monthly: 15000, months: 60 }], rates: { sims: 300 } });
assert.match(verdict(poor)[0], /^Careful/);
console.log("v740lifesim: all passed");
