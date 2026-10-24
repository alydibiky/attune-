/* ---- v7.6 Money's bottom bar (Ali, 24 Oct 2026: "the new Money home, with the old ledger's Zakāt, Bills and more pages in the same
   design, and a + to add an expense like the old ledger"; he picked layout A: Home · Accounts · + · Bills · Zakāt, the rest under More).
   The numbers for the Accounts, Bills and Zakāt pages, by code from the ledger Money (Yusr) keeps ("ledger.v3"). Pure (no DOM).
   Rules kept: currencies are never added together; gold / silver / livestock are not money (grams and head) — listed apart; Zakāt is
   NEVER computed here — the page shows Yusr's own snapshot and Yusr's own record of what was paid. Tests: tests/unit/v790moneypages.test.mjs */
import { homeCurrency } from "./locale.js";
import { accountBalance, catName, CAT_EMOJI, isoDay, zakatFromSnapshot } from "./money-report.js";

const DAY = 86400000;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const METAL = ["gold", "silver"], HERD = ["camels", "cattle", "sheep"];
const kindOf = (a) => (METAL.includes(a.kind) ? "metal" : HERD.includes(a.kind) ? "herd" : "money");
const dayDiff = (from, to) => Math.round((new Date(to + "T12:00:00") - new Date(from + "T12:00:00")) / DAY);

/** Accounts: every account with its balance and this month's in / out; totals per currency; the main currency's balance at the
 *  end of each of the last 6 months (the trend). → { cur, money, other, totals, trend, monthIn, monthOut } */
export function accountsPage(L, { now = Date.now(), ar = false } = {}) {
  const cur = homeCurrency(L);
  const txns = (L && L.txns) || [];
  const d = new Date(now), today = isoDay(now), from = isoDay(new Date(d.getFullYear(), d.getMonth(), 1));
  const all = ((L && L.accounts) || []).map((a) => {
    const k = kindOf(a), mine = txns.filter((t) => t.account === a.id || (t.toAccount || t.to) === a.id);
    const month = mine.filter((t) => t.date >= from && t.date <= today);
    const sum = (type) => r2(month.filter((t) => t.type === type && t.account === a.id).reduce((s, t) => s + (Number(t.amount) || 0), 0));
    const last = mine.map((t) => t.date).filter(Boolean).sort().pop() || null;
    return { id: a.id, name: a.name || a.id, emoji: a.emoji || (k === "metal" ? "🪙" : k === "herd" ? "🐑" : "💵"), kind: k, sub: a.kind || "",
      currency: k === "money" ? a.currency || cur : "", unit: k === "metal" ? (ar ? "جم" : "g") + (a.kind === "gold" ? " · " + (a.karat || 24) + (ar ? " قيراط" : "k") : "") : k === "herd" ? (ar ? "رأس" : "head") : "",
      balance: accountBalance(L, a.id), in: sum("income"), out: sum("expense"), count: mine.length, last };
  });
  const money = all.filter((a) => a.kind === "money"), other = all.filter((a) => a.kind !== "money");
  const totals = {};
  for (const a of money) totals[a.currency] = r2((totals[a.currency] || 0) + a.balance);
  // the main currency's balance at the end of each month: start + everything dated on or before that day
  const mainIds = new Set(money.filter((a) => a.currency === cur).map((a) => a.id));
  const startSum = ((L && L.accounts) || []).filter((a) => mainIds.has(a.id)).reduce((s, a) => s + (Number(a.start) || 0), 0);
  const effect = (t) => {
    const amt = Number(t.amount) || 0, to = t.toAccount || t.to;
    if (t.type === "transfer") return (mainIds.has(to) ? Number(t.toAmount) || amt : 0) - (mainIds.has(t.account) ? amt : 0);
    if (!mainIds.has(t.account)) return 0;
    if (t.type === "income") return amt;
    if (t.type === "expense" || t.type === "zakat") return -amt;
    if (t.type === "debt") return t.flow === "borrow" || t.flow === "collect" ? amt : -amt;
    return 0;
  };
  const trend = [];
  for (let k = 5; k >= 0; k--) {
    const end = k === 0 ? today : isoDay(new Date(d.getFullYear(), d.getMonth() - k + 1, 0));
    trend.push({ key: end.slice(0, 7), balance: r2(startSum + txns.filter((t) => t.date && t.date <= end).reduce((s, t) => s + effect(t), 0)) });
  }
  const main = money.filter((a) => a.currency === cur);
  return { cur, money, other, totals: Object.entries(totals).map(([currency, balance]) => ({ currency, balance })), trend,
    balance: totals[cur] || 0, monthIn: r2(main.reduce((s, a) => s + a.in, 0)), monthOut: r2(main.reduce((s, a) => s + a.out, 0)) };
}

/** How much a repeating entry costs in one month (daily ×30.4, weekly ×4.35, yearly ÷12; a daily bill on some days of the month
 *  counts only those days). */
export function perMonth(r) {
  const a = Number(r.amount) || 0;
  if (r.freq === "daily") return r2(a * (r.fromDay && r.toDay ? (((r.toDay - r.fromDay + 31) % 31) + 1) : 30.4));
  if (r.freq === "weekly") return r2(a * 4.35);
  if (r.freq === "yearly") return r2(a / 12);
  return r2(a);
}

/** Bills: the repeating payments (Yusr's "recurring", income left out) with when each is next due; what they cost a month;
 *  the ones due in 7 days or late; what bills cost in each of the last 6 months (entries in the Bills category or posted by a
 *  repeating bill). → { cur, list, monthly, due7, dueTotal, late, paidThisMonth, months } */
export function billsPage(L, { now = Date.now(), ar = false } = {}) {
  const cur = homeCurrency(L), today = isoDay(now), in7 = isoDay(now + 7 * DAY);
  const accs = (L && L.accounts) || [];
  const curOf = (id) => ((accs.find((a) => a.id === id) || {}).currency || cur);
  const list = ((L && L.recurring) || []).filter((r) => r.active !== false && r.type !== "income").map((r) => ({
    id: r.id, name: (r.note || "").replace(/\s*↻$/, "") || catName(L, r.cat, ar), cat: r.cat || "bills", emoji: CAT_EMOJI[r.cat] || "↻",
    amount: r2(r.amount), freq: r.freq || "monthly", next: r.nextDate || null, daysTo: r.nextDate ? dayDiff(today, r.nextDate) : null,
    late: !!(r.nextDate && r.nextDate < today), account: (accs.find((a) => a.id === r.account) || {}).name || "", currency: curOf(r.account), monthly: perMonth(r),
  })).sort((a, b) => String(a.next || "9").localeCompare(String(b.next || "9")));
  const mine = list.filter((b) => b.currency === cur);
  const due7 = list.filter((b) => b.next && b.next <= in7);
  const isBill = (t) => t.type === "expense" && (t.cat === "bills" || t.recurring === true) && curOf(t.account) === cur;
  const txns = ((L && L.txns) || []).filter(isBill);
  const d = new Date(now), months = [];
  for (let k = 5; k >= 0; k--) {
    const from = isoDay(new Date(d.getFullYear(), d.getMonth() - k, 1)), to = k === 0 ? today : isoDay(new Date(d.getFullYear(), d.getMonth() - k + 1, 0));
    months.push({ key: from.slice(0, 7), out: r2(txns.filter((t) => t.date >= from && t.date <= to).reduce((s, t) => s + (Number(t.amount) || 0), 0)) });
  }
  const monthFrom = isoDay(new Date(d.getFullYear(), d.getMonth(), 1));
  const paid = txns.filter((t) => t.date >= monthFrom && t.date <= today).sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((t) => ({ id: t.id, date: t.date, amount: r2(t.amount), name: (t.note || "").replace(/\s*↻$/, "") || catName(L, t.cat, ar) }));
  return { cur, list, monthly: r2(mine.reduce((s, b) => s + b.monthly, 0)), due7, late: list.filter((b) => b.late).length,
    dueTotal: r2(due7.filter((b) => b.currency === cur).reduce((s, b) => s + b.amount, 0)),
    paid, paidThisMonth: r2(paid.reduce((s, t) => s + t.amount, 0)), months };
}

/** Zakāt: what Yusr's engine sent (never recomputed), the days until the ḥawl ends, and what Yusr recorded as paid — per year.
 *  → { status, basis, sources, madhhab, hawlDays, payments, paidYear, years } */
export function zakatPage(L, snap, { now = Date.now() } = {}) {
  const status = zakatFromSnapshot(snap), z = (snap && snap.zakat) || {};
  const today = isoDay(now);
  const pays = ((L && L.zakatPayments) || []).filter((p) => p && Number(p.amount) > 0 && p.date)
    .map((p) => ({ id: p.id, date: p.date, amount: r2(p.amount), to: p.to || "", cat: p.cat || "" })).sort((a, b) => b.date.localeCompare(a.date));
  const yearAgo = isoDay(now - 365 * DAY), years = {};
  for (const p of pays) years[p.date.slice(0, 4)] = r2((years[p.date.slice(0, 4)] || 0) + p.amount);
  return { status, basis: z.basis || "", sources: z.sources || [], madhhab: z.madhhab || "",
    hawlDays: status && status.hawlEnds ? dayDiff(today, String(status.hawlEnds).slice(0, 10)) : null,
    payments: pays.slice(0, 20), paidYear: r2(pays.filter((p) => p.date > yearAgo).reduce((s, p) => s + p.amount, 0)),
    years: Object.entries(years).sort((a, b) => a[0].localeCompare(b[0])).slice(-5).map(([year, amount]) => ({ year, amount })) };
}

/** The + sheet's categories: Yusr's own (and the person's custom ones) for an expense or an income. */
export function sheetCats(L, type, ar = false) {
  const base = type === "income" ? ["salary", "gifts", "other"] : ["food", "groceries", "transport", "bills", "rent", "shopping", "health", "fun", "coffee", "gifts", "other"];
  const custom = ((L && L.customCats) || []).filter((c) => !c.type || c.type === type).map((c) => c.id);
  return [...base, ...custom.filter((c) => !base.includes(c))].map((id) => ({ id, name: catName(L, id, ar), emoji: CAT_EMOJI[id] || ((L.customCats || []).find((c) => c.id === id) || {}).emoji || "✦" }));
}

/** What the + sheet sends to the ledger (bridge add-txns), checked here first. → { ok, txn } | { ok: false, why } */
export function sheetTxn({ type, amount, cat, account, toAccount, date, note }) {
  const a = Number(String(amount || "").replace(/,/g, ""));
  if (!(a > 0 && a < 1e9)) return { ok: false, why: "Write the amount" };
  if (!["expense", "income", "transfer"].includes(type)) return { ok: false, why: "Pick expense, income or transfer" };
  if (!account) return { ok: false, why: "Pick the account" };
  if (type === "transfer" && (!toAccount || toAccount === account)) return { ok: false, why: "Pick the account it goes to" };
  const txn = { type, amount: r2(a), account, byUser: true, date: /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? date : isoDay(Date.now()), note: String(note || "").slice(0, 80) };
  if (type === "transfer") txn.toAccount = toAccount; else txn.cat = cat || "other";
  return { ok: true, txn };
}
