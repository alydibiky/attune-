/* ---- v6.37 (Ali picked "do them all", upgrade M1): "Safe to spend today" — ONE number on Money: what you can spend today and
   still pay everything that is due before your next income. Pure code (no model), from the Money ledger ("ledger.v3": accounts,
   txns, recurring, debts), People & plans (life.js: the maid every Saturday, installments, rent) and the Radar (a trial or a
   renewal that will charge). Only the ledger's main currency is counted (amounts are never added across currencies).
   Tests: tests/unit/v740safespend.test.mjs.                                                                                    */
import { homeCurrency } from "./locale.js";
import { scheduleOf } from "./life.js";

const DAY = 86400000;
const iso = (t) => { const x = new Date(t); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const at12 = (s) => Date.parse(s + "T12:00:00");
const addDays = (s, n) => iso(at12(s) + n * DAY);

/** The dates a recurring Money entry falls on from `from` to `to` (both YYYY-MM-DD, inclusive). Same rules as Money's own
    poster: daily (optionally only between two days of the month), weekly, monthly (same day; the 31st → the month's last day),
    yearly. */
export function occurrences(r, from, to) {
  if (!r || !r.nextDate || r.active === false) return [];
  const out = [], start = new Date(r.nextDate + "T12:00:00"), day0 = start.getDate();
  const inRange = (d) => !(r.freq === "daily" && r.fromDay && r.toDay) || (r.fromDay <= r.toDay ? d >= r.fromDay && d <= r.toDay : d >= r.fromDay || d <= r.toDay);
  for (let i = 0, guard = 0; guard < 1000; i++, guard++) {
    let d;
    if (r.freq === "daily") d = new Date(start.getTime() + i * DAY);
    else if (r.freq === "weekly") d = new Date(start.getTime() + 7 * i * DAY);
    else if (r.freq === "yearly") d = new Date(start.getFullYear() + i, start.getMonth(), Math.min(day0, new Date(start.getFullYear() + i, start.getMonth() + 1, 0).getDate()), 12);
    else { const y = start.getFullYear(), m = start.getMonth() + i; d = new Date(y, m, Math.min(day0, new Date(y, m + 1, 0).getDate()), 12); }
    const s = iso(d);
    if (s > to) break;
    if (s >= from && inRange(d.getDate())) out.push(s);
  }
  return out;
}

/**
 * → { cur, balance, today, perDay, spentToday, until, days, due: [{ what, date, amount, from }], dueTotal, short, income }
 *   today   = what is safe to spend today (perDay − what you already spent today; never below 0)
 *   perDay  = (money you have − everything due until `until`) ÷ the days until then
 *   until   = the day before your next income (a recurring income in Money), else the month's last day
 *   short   = how much is missing when the bills are more than the money (0 when fine)
 * opts.cushion = an amount to keep untouched (savings you don't want to count).
 */
export function safeToSpend({ ledger: L, life = null, radar = null, now = Date.now(), cushion = 0 } = {}) {
  const cur = homeCurrency(L), today = iso(now);
  const accounts = (L && L.accounts) || [], txns = (L && L.txns) || [];
  const curOf = (id) => { const a = accounts.find((x) => x.id === id); return (a && a.currency) || cur; };
  const mine = (c) => !c || c === cur;
  // the money you have now, in the main currency
  let balance = 0;
  for (const a of accounts) if (mine(a.currency || cur)) balance += Number(a.start) || 0;
  for (const t of txns) {
    const amt = Number(t.amount) || 0, c = curOf(t.account);
    if (t.type === "income" && mine(c)) balance += amt;
    else if (t.type === "expense" && mine(c)) balance -= amt;
    else if (t.type === "transfer" && (t.toAccount || t.to)) { if (mine(c)) balance -= amt; if (mine(curOf(t.toAccount || t.to))) balance += Number(t.toAmount) || amt; }
  }
  const spentToday = txns.filter((t) => t.type === "expense" && t.date === today && mine(curOf(t.account))).reduce((a, t) => a + (Number(t.amount) || 0), 0);
  // until when: the next income that repeats (salary), else the end of this month
  const rec = ((L && L.recurring) || []).filter((r) => r.active !== false && mine(curOf(r.account)));
  const nextIncome = rec.filter((r) => r.type === "income").flatMap((r) => occurrences(r, addDays(today, 1), addDays(today, 62)).slice(0, 1).map((d) => ({ d, amount: Number(r.amount) || 0, what: r.note || r.cat || "Income" })))
    .sort((a, b) => a.d.localeCompare(b.d))[0] || null;
  const n = new Date(now), monthEnd = iso(new Date(n.getFullYear(), n.getMonth() + 1, 0, 12));
  const until = nextIncome ? addDays(nextIncome.d, -1) : monthEnd;
  const days = Math.max(1, Math.round((at12(until) - at12(today)) / DAY) + 1);
  // everything due from today to `until`
  const due = [];
  for (const r of rec) if (r.type !== "income") for (const d of occurrences(r, today, until)) due.push({ what: (r.note || r.cat || "Bill").replace(" ↻", ""), date: d, amount: Number(r.amount) || 0, from: "money" });
  for (const c of (life && life.items) || []) {
    if (c.dir !== "out" || !mine(c.currency) || c.done) continue;
    // a regular (the maid every Saturday) is listed only up to its next day — ask for its days up to `until`
    for (const s of scheduleOf(c, c.kind === "regular" ? at12(until) : now)) if (!s.paid && s.date >= today && s.date <= until) due.push({ what: [c.person, c.title || c.kind].filter(Boolean).join(" · "), date: s.date, amount: Number(s.amount) || 0, from: "plans" });
  }
  for (const x of (radar && radar.items) || []) {
    if (x.status !== "active" || !(Number(x.amount) > 0) || !mine(x.currency) || !(x.kind === "trial" || x.kind === "renewal")) continue;
    if (x.date >= today && x.date <= until) due.push({ what: x.title || x.kind, date: x.date, amount: Number(x.amount), from: "dates" });
  }
  const left = (d) => (Number(d.amount) || 0) - ((d.payments || []).reduce((a, p) => a + (Number(p.amount) || 0), 0));
  for (const d of (L && L.debts) || []) {
    if (d.settled || d.type === "owed_to_me" || !d.dueDate || left(d) <= 0.004) continue;
    if (d.dueDate <= until) due.push({ what: d.person || "Debt", date: d.dueDate < today ? today : d.dueDate, amount: left(d), from: "debts" });
  }
  due.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
  const dueTotal = due.reduce((a, x) => a + x.amount, 0);
  // today's spending is already out of the balance; put it back to share the whole period fairly
  const pool = balance + spentToday - dueTotal - (Number(cushion) || 0);
  const perDay = pool > 0 ? pool / days : 0;
  const r2 = (v) => Math.round(v * 100) / 100;
  return { cur, balance: r2(balance), perDay: Math.floor(perDay), today: Math.max(0, Math.floor(perDay - spentToday)), spentToday: r2(spentToday),
    until, days, due, dueTotal: r2(dueTotal), short: pool < 0 ? r2(-pool) : 0, income: nextIncome };
}
