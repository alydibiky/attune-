/* ---- v9.9.18 M3 Split with anyone (Ali picked A — a group with settle-up). A trip, a flat, the family: who paid what, each expense
   shared equally or by shares, and the FEWEST payments that settle everyone — exact to the smallest coin of the group's currency
   (the remainder of an uneven split goes to the first people, so every expense is shared to the coin and every balance sums to 0).
   Pure; tests: tests/groups (10,000 groups, 2–12 people, 30 currencies) + tests/unit/v9918b3.test.mjs.                           */
import { toUnits, fromUnits } from "./moneyunits.js";
/** group: { currency, members: [id], expenses: [{ paidBy, amount, shares?: { id: weight } }] } → { id: units } (+ = is owed) */
export function balancesU(g) {
  const cur = g.currency, bal = Object.fromEntries((g.members || []).map((m) => [m, 0]));
  for (const e of g.expenses || []) {
    const u = toUnits(e.amount, cur); if (!(u > 0) || !(e.paidBy in bal)) continue;
    const who = e.shares ? Object.entries(e.shares).filter(([m, w]) => m in bal && w > 0) : (g.members || []).map((m) => [m, 1]);
    const W = who.reduce((a, [, w]) => a + w, 0); if (!W) continue;
    let given = 0; const part = who.map(([m, w]) => { const p = Math.floor((u * w) / W); given += p; return [m, p]; });
    for (let k = 0; given < u; k = (k + 1) % part.length) { part[k][1]++; given++; }   // the coins left over: one each, in order
    bal[e.paidBy] += u; for (const [m, p] of part) bal[m] -= p;
  }
  return bal;
}
export const balances = (g) => Object.fromEntries(Object.entries(balancesU(g)).map(([m, u]) => [m, fromUnits(u, g.currency)]));
/** The fewest payments: biggest debtor pays the biggest creditor, again and again. → [{ from, to, amount }] */
export function settle(g) {
  const b = balancesU(g), cred = [], debt = [];
  for (const [m, u] of Object.entries(b)) if (u > 0) cred.push([m, u]); else if (u < 0) debt.push([m, -u]);
  const out = [];
  while (cred.length && debt.length) {
    cred.sort((a, b) => b[1] - a[1]); debt.sort((a, b) => b[1] - a[1]);
    const c = cred[0], d = debt[0], x = Math.min(c[1], d[1]);
    out.push({ from: d[0], to: c[0], amount: fromUnits(x, g.currency) });
    c[1] -= x; d[1] -= x; if (!c[1]) cred.shift(); if (!d[1]) debt.shift();
  }
  return out;
}
