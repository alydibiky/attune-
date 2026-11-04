// v6.37 M2: installments vs cash in today's money (present value at the bank's certificate rate).
import { realCost } from "../../web-src/deal.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
// 0% installments: 12 × 10,000 vs 120,000 cash, money in a 20% certificate → the plan is cheaper in real money
const a = realCost({ cash: 120000, monthly: 10000, months: 12, rate: 0.2 });
ok(a.cheaper === "plan" && a.pv < 120000 && a.pv > 105000, "0% installments beat cash when the bank pays 20% (" + a.pv + ")");
// installments with a big markup: 12 × 12,500 = 150,000 vs 120,000 → cash wins even after discounting
const b = realCost({ cash: 120000, monthly: 12500, months: 12, rate: 0.2 });
ok(b.cheaper === "cash" && b.diff > 10000, "a 25% markup is worse than cash (" + b.pv + ", by " + b.diff + ")");
// at 0% bank rate, present value = what you pay in total
ok(realCost({ cash: 100000, down: 20000, monthly: 10000, months: 8, rate: 0 }).cheaper === "same", "no bank interest → same when the totals match");
ok(realCost({ cash: 100000, down: 20000, fees: 1000, monthly: 10000, months: 8, rate: 0 }).cheaper === "cash", "fees tip it to cash");
ok(realCost({ cash: 0, monthly: 100, months: 3 }) === null && realCost({ cash: 100, monthly: 0, months: 3 }) === null, "missing numbers → nothing guessed");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
