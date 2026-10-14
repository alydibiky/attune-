/* ---- v6.27: Money on a computer, design A "Calm" — the numbers of the Overview, computed by code from the Money ledger
   (Yusr keeps it in localStorage "ledger.v3": accounts, txns, budgets, recurring bills, debts). Pure; the page is
   money-desk.jsx; tests: tests/unit/v727moneycalm.test.mjs. Amounts are never added across currencies: the overview is
   in the ledger's main currency, other currencies are listed apart.                                                   */
import { homeCurrency } from "./locale.js";


const day = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
const iso = (t) => { const x = new Date(t); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const DAY = 86400000;

/** The overview of a ledger at `now` → { cur, balance, others, monthIn, monthOut, budget, weeks, latest, due, owed, owe }. */
export function moneyOverview(L, now = Date.now()) {
  const cur = homeCurrency(L);
  const accounts = (L && L.accounts) || [], txns = (L && L.txns) || [];
  const curOf = (accId) => { const a = accounts.find((x) => x.id === accId); return (a && a.currency) || cur; };
  // balance per currency: each account's start + income − expense (a transfer moves money between two accounts)
  const bal = {};
  for (const a of accounts) bal[a.currency || cur] = (bal[a.currency || cur] || 0) + (Number(a.start) || 0);
  for (const t of txns) {
    const amt = Number(t.amount) || 0, c = curOf(t.account);
    if (t.type === "income") bal[c] = (bal[c] || 0) + amt;
    else if (t.type === "expense") bal[c] = (bal[c] || 0) - amt;
    else if (t.type === "transfer" && (t.toAccount || t.to)) { bal[c] = (bal[c] || 0) - amt; const c2 = curOf(t.toAccount || t.to); bal[c2] = (bal[c2] || 0) + (Number(t.toAmount) || amt); }
  }
  const monthStart = iso(new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1)), today = iso(now);
  const mine = txns.filter((t) => curOf(t.account) === cur);
  const inMonth = mine.filter((t) => t.date >= monthStart && t.date <= today);
  const sum = (l, type) => l.filter((t) => t.type === type).reduce((a, t) => a + (Number(t.amount) || 0), 0);
  // spending by week: the last 4 weeks, oldest first (this week last)
  const t0 = day(now), weeks = [];
  for (let w = 3; w >= 0; w--) {
    const from = iso(t0 - (w * 7 + 6) * DAY), to = iso(t0 - w * 7 * DAY);
    weeks.push({ from, to, out: sum(mine.filter((t) => t.date >= from && t.date <= to), "expense") });
  }
  const latest = [...txns].filter((t) => t.type === "income" || t.type === "expense").sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.ts || 0) - (a.ts || 0)).slice(0, 6)
    .map((t) => ({ ...t, currency: curOf(t.account) }));
  // bills (recurring expenses) due in the next 7 days, or already late
  const due = ((L && L.recurring) || []).filter((r) => r.active !== false && r.type !== "income" && r.nextDate && r.nextDate <= iso(t0 + 7 * DAY))
    .map((r) => ({ note: r.note || r.cat || "Bill", amount: Number(r.amount) || 0, date: r.nextDate, late: r.nextDate < today, currency: curOf(r.account) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  // people: who owes you / whom you owe — what is left after their payments
  const left = (d) => (Number(d.amount) || 0) - ((d.payments || []).reduce((a, p) => a + (Number(p.amount) || 0), 0));
  const people = ((L && L.debts) || []).filter((d) => !d.settled && left(d) > 0.004)
    .map((d) => ({ person: d.person || "?", left: left(d), amount: Number(d.amount) || 0, paid: (d.payments || []).length, note: d.note || "", toMe: d.type === "owed_to_me" }));
  const others = Object.entries(bal).filter(([c]) => c !== cur).map(([c, v]) => ({ currency: c, balance: v }));
  return { cur, balance: bal[cur] || 0, others, monthIn: sum(inMonth, "income"), monthOut: sum(inMonth, "expense"),
    budget: Number(L && L.budgets && L.budgets.overall) || 0, weeks, latest, due,
    owed: people.filter((p) => p.toMe).sort((a, b) => b.left - a.left), owe: people.filter((p) => !p.toMe).sort((a, b) => b.left - a.left) };
}

/** 48250 → "48,250"; -350.5 → "−350.5" (a real minus sign). */
export function fmt(n, { sign = false } = {}) {
  const v = Math.round((Number(n) || 0) * 100) / 100, s = Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return (v < 0 ? "−" : sign && v > 0 ? "+" : "") + s;
}
