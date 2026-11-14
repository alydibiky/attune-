// v9.9.18 M3 — 10,000 groups (2–12 people, equal and weighted shares, odd amounts, 27 currencies with 0, 2 and 3 decimals): every
// expense is shared to the smallest coin, balances sum to exactly 0, and paying the settle-up list leaves everyone at 0 with at most
// (people who owe or are owed) − 1 payments.
import fs from "fs"; import { balancesU, settle } from "../../web-src/groups.js"; import { toUnits } from "../../web-src/moneyunits.js"; import { rng, CURS } from "../b3common.mjs";
const N = +(process.argv[2] || 10000), rnd = rng(20261118), pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
let ok = 0; const bad = {};
for (let i = 0; i < N; i++) {
  const cur = pick(CURS), n = int(2, 12), members = Array.from({ length: n }, (_, k) => "m" + k), expenses = [];
  for (let e = 0, E = int(1, 15); e < E; e++) { const amt = Math.round(rnd() * pick([50, 500, 5000, 100000]) * 1000) / 1000;
    const sh = rnd() < 0.4 ? Object.fromEntries(members.filter(() => rnd() < 0.7).map((m) => [m, int(1, 4)])) : undefined; expenses.push({ paidBy: pick(members), amount: amt, ...(sh && Object.keys(sh).length ? { shares: sh } : {}) }); }
  const g = { currency: cur, members, expenses }, b = balancesU(g);
  let err = "";
  if (Object.values(b).reduce((a, x) => a + x, 0) !== 0) err = "balances don't sum to 0";
  if (!err) { const pay = settle(g), after = { ...b }; for (const p of pay) { after[p.from] += toUnits(p.amount, cur); after[p.to] -= toUnits(p.amount, cur); if (p.amount <= 0) err = "a zero / negative payment"; }
    if (!err && Object.values(after).some((x) => x !== 0)) err = "someone is not settled after paying";
    const involved = Object.values(b).filter((x) => x !== 0).length; if (!err && involved && pay.length > involved - 1) err = "too many payments"; }
  if (!err) { const paidTotal = expenses.reduce((a, e) => a + toUnits(e.amount, cur), 0), owed = Object.values(b).filter((x) => x > 0).reduce((a, x) => a + x, 0); if (owed > paidTotal) err = "more owed than was paid"; }
  if (err) bad[err] = (bad[err] || 0) + 1; else ok++;
}
const s = `# Groups run — ${N} groups, ${ok} right (${(100 * ok / N).toFixed(2)}%)\n` + Object.entries(bad).map(([k, v]) => `\n- ✗ ${k} × ${v}`).join("") + "\n";
if (N === 10000) fs.writeFileSync(new URL(process.env.SEED_SHIFT ? "../onemillion/B-groups-s" + process.env.SEED_SHIFT + ".md" : "./report.md", import.meta.url), s); console.log(s);
