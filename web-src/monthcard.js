/* v10.9.8 (Ali's OK-W2, the new-user walk-through: after "All right ✓" Home showed nothing of the month just organised) — "This month"
   for Home, by code: what was spent this month per currency (never added across currencies), the 3 biggest categories in the main
   currency, and what came BACK (refunds saved as income "NOON ↩", Ali's W6). Pure; tests: tests/unit/v1098walk.test.mjs. */
import { homeCurrency } from "./locale.js";

const iso = (t) => { const x = new Date(t); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
export const CAT_LABEL = { food: "Food", groceries: "Groceries", transport: "Transport", bills: "Bills", rent: "Rent", shopping: "Shopping", health: "Health",
  fun: "Fun", coffee: "Coffee/Tea", gifts: "Gifts", subscriptions: "Subscriptions", salary: "Salary", other: "Other" };
export const isRefund = (t) => !!t && t.type === "income" && /↩\s*$/.test(String(t.note || ""));

/** → null when nothing was spent this month; else { cur, spent: [[cur, amount]…] (main currency first), top: [[cat, amount]…] (≤ 3,
    main currency), back: amount refunded this month (main currency), n: entries } */
export function monthSummary(L, now = Date.now()) {
  if (!L || !Array.isArray(L.txns)) return null;
  const cur = homeCurrency(L), accounts = L.accounts || [];
  const curOf = (id) => { const a = accounts.find((x) => x.id === id); return (a && a.currency) || cur; };
  const d = new Date(now), from = iso(new Date(d.getFullYear(), d.getMonth(), 1, 12)), to = iso(now);
  const inMonth = L.txns.filter((t) => t && t.date >= from && t.date <= to && (accounts.find((a) => a.id === t.account) || {}).unit !== "g");
  const out = inMonth.filter((t) => t.type === "expense");
  if (!out.length) return null;
  const per = {}, cats = {};
  for (const t of out) { const c = curOf(t.account), a = Number(t.amount) || 0; per[c] = (per[c] || 0) + a; if (c === cur) cats[t.cat || "other"] = (cats[t.cat || "other"] || 0) + a; }
  const r2 = (v) => Math.round(v * 100) / 100;
  const spent = Object.entries(per).map(([c, a]) => [c, r2(a)]).sort((a, b) => (a[0] === cur ? -1 : b[0] === cur ? 1 : b[1] - a[1]));
  const top = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, a]) => [c, r2(a)]);
  const back = r2(inMonth.filter((t) => isRefund(t) && curOf(t.account) === cur).reduce((a, t) => a + (Number(t.amount) || 0), 0));
  return { cur, spent, top, back, n: out.length };
}
