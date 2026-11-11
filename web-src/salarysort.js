/* ---- v9.9.18 M1 Salary sorter (Ali picked A — a checklist with amounts). When the salary arrives, one list of where it goes: each
   planned part (a fixed amount or a % of the salary), ticked as it is paid, and what is left to spend — exact to the smallest coin of
   the salary's currency, so the parts and "left" always add up to the salary. A salary that arrives in two parts within 3 days is one
   salary. A part that no longer fits (the plan is bigger than the salary) is flagged, never silently cut. Pure; tests: tests/salarysort
   (10,000 salaries, 30 currencies) + tests/unit/v9918b3.test.mjs.                                                                 */
import { toUnits, fromUnits } from "./moneyunits.js";
const DAY = 864e5;
/** incomes: [{ at, amount, currency, salary: true }] → the salary to sort: parts within 3 days of each other are joined. */
export function salaryOf(incomes = [], now = Date.now()) {
  const s = (incomes || []).filter((x) => x && x.salary && +x.amount > 0 && x.at <= now).sort((a, b) => b.at - a.at);
  if (!s.length) return null;
  const cur = s[0].currency, parts = [s[0]];
  for (const x of s.slice(1)) if (x.currency === cur && parts[parts.length - 1].at - x.at <= 3 * DAY) parts.push(x); else break;
  return { amount: fromUnits(parts.reduce((a, x) => a + toUnits(x.amount, cur), 0), cur), currency: cur, at: parts[parts.length - 1].at, parts: parts.length };
}
/** plan: [{ id, name, amount? , pct?, done? }] → { rows: [{ id, name, amount, done }], left, over: [ids that don't fit] } */
export function sortSalary(salary, plan = []) {
  if (!salary || !(salary.amount > 0)) return null;
  const cur = salary.currency, total = toUnits(salary.amount, cur);
  let used = 0; const rows = [], over = [];
  for (const p of plan || []) {
    const u = p.pct != null ? Math.round(total * (+p.pct) / 100) : toUnits(p.amount, cur);
    if (!(u > 0)) continue;
    if (used + u > total) { over.push(p.id); rows.push({ id: p.id, name: p.name, amount: fromUnits(u, cur), done: !!p.done, over: true }); continue; }
    used += u; rows.push({ id: p.id, name: p.name, amount: fromUnits(u, cur), done: !!p.done });
  }
  return { rows, left: fromUnits(total - used, cur), currency: cur, over };
}
