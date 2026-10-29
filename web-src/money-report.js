/* ---- v7.2 Money in two levels (Gemini's mock-up "Area 1: Money", Ali sent it 24 Oct 2026): the calm view that opens first and
   its Money Report. Every number here is computed by code from the ledger Money (Yusr) keeps in localStorage "ledger.v3" —
   the same data, never a guess. Pure (no DOM); the screens are money-calm-ui.jsx; tests: tests/unit/v750moneyreport.test.mjs.
   Rules kept from money-calm.js: amounts in different currencies are never added together (the report is in the ledger's main
   currency; other currencies are listed apart), and gold / silver / livestock accounts are not money (grams and head, not EGP).
   Zakāt is NOT computed here: the Report shows only what Yusr's own zakāt engine sent (its snapshot), as Yusr calculated it.  */
import { homeCurrency } from "./locale.js";

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");
export const isoDay = (t) => { const x = new Date(t); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const notMoney = (a) => !!(a && ["gold", "silver", "camels", "cattle", "sheep"].includes(a.kind));

/** Yusr's own accountBalance (index.new.html), for one account: start ± every entry that touches it. */
export function accountBalance(L, id) {
  const a = ((L && L.accounts) || []).find((x) => x.id === id);
  if (!a) return 0;
  let b = Number(a.start) || 0;
  for (const x of (L && L.txns) || []) {
    const amt = Number(x.amount) || 0;
    if (x.type === "transfer") { if (x.account === id) b -= amt; if ((x.toAccount || x.to) === id) b += Number(x.toAmount) || amt; }
    else if (x.type === "debt") { if (x.account === id) b += (x.flow === "borrow" || x.flow === "collect") ? amt : -amt; }
    else if (x.type === "zakat") { if (x.account === id) b -= amt; }
    else if (x.account === id) b += x.type === "income" ? amt : x.type === "expense" ? -amt : 0;
  }
  return r2(b);
}

/** The money accounts with their balances: [{ id, name, emoji, currency, balance }] (gold, silver and livestock left out). */
export function accountsOf(L) {
  const cur = homeCurrency(L);
  return ((L && L.accounts) || []).filter((a) => !notMoney(a))
    .map((a) => ({ id: a.id, name: a.name || a.id, emoji: a.emoji || "", currency: a.currency || cur, balance: accountBalance(L, a.id) }));
}

/** Yusr's categories (BASE_CATS) with their English and Arabic names; a custom category keeps its own name. */
export const CAT_NAMES = { food: ["Food", "طعام"], groceries: ["Groceries", "بقالة"], transport: ["Transport", "مواصلات"], bills: ["Bills", "فواتير"],
  rent: ["Rent", "إيجار"], shopping: ["Shopping", "تسوق"], health: ["Health", "صحة"], fun: ["Fun", "ترفيه"], coffee: ["Coffee/Tea", "قهوة/شاي"],
  gifts: ["Gifts", "هدايا"], salary: ["Salary", "راتب"], other: ["Other", "أخرى"] };
export const CAT_EMOJI = { food: "🍲", groceries: "🛒", transport: "🚗", bills: "⚡", rent: "🏠", shopping: "🛍️", health: "💊", fun: "🎬", coffee: "🍵",
  gifts: "🎁", salary: "💼", other: "✦" };
export function catName(L, id, ar = false) {
  const c = ((L && L.customCats) || []).find((x) => x.id === id);
  if (c) return (ar ? c.ar : c.en) || c.name || c.en || id;
  const n = CAT_NAMES[id];
  return n ? n[ar ? 1 : 0] : (id ? id[0].toUpperCase() + id.slice(1) : ar ? "أخرى" : "Other");
}

/** Everything the calm view and the Report show, at `now`, for one account (`account` = its id) or all money accounts.
 *  → { cur, others, accounts, balance, month: { in, out, net, count, rate, from, to, daysLeft, cats, sources, pace }, weeks, months,
 *      recent, rows, due, dueTotal } */
export function moneyReport(L, { now = Date.now(), account = null, ar = false } = {}) {
  const cur = homeCurrency(L);
  const accounts = accountsOf(L);
  const byId = Object.fromEntries(accounts.map((a) => [a.id, a]));
  const acc = account && byId[account] ? byId[account] : null;
  const curOf = (id) => (byId[id] ? byId[id].currency : null);
  // the entries that count: income / expense in a money account of the main currency (or of the chosen account)
  const inScope = (t) => (t.type === "income" || t.type === "expense") && byId[t.account] && (acc ? t.account === acc.id : curOf(t.account) === cur);
  const txns = ((L && L.txns) || []).filter(inScope);
  const sum = (list, type) => r2(list.filter((t) => t.type === type).reduce((a, t) => a + (Number(t.amount) || 0), 0));
  const d = new Date(now), y = d.getFullYear(), m = d.getMonth(), today = isoDay(now);
  const monthFrom = isoDay(new Date(y, m, 1)), monthEnd = isoDay(new Date(y, m + 1, 0));
  const inMonth = txns.filter((t) => t.date >= monthFrom && t.date <= today);
  const mIn = sum(inMonth, "income"), mOut = sum(inMonth, "expense");
  // where the money went this month: by category, biggest first; past the 4th they are one "other" slice
  // (v8.7, Ali: "I want earned to have a pie chart to see where it's earned from"): the same for the money that came IN —
  // grouped by where it came from (the note: the payer / the job), else by category
  const slices = (type, total, keyOf) => {
    const by = {};
    for (const t of inMonth) if (t.type === type) { const [id, name] = keyOf(t); const x = by[id] || (by[id] = { id, name, amount: 0 }); x.amount = r2(x.amount + (Number(t.amount) || 0)); }
    let list = Object.values(by).sort((a, b) => b.amount - a.amount);
    if (list.length > 4) list = [...list.slice(0, 3), { id: "_rest", name: ar ? "أخرى" : "Other", amount: r2(list.slice(3).reduce((a, c) => a + c.amount, 0)) }];
    // percentages that add up to 100 (largest remainder), so the donut and the legend agree
    if (!(total > 0)) return list.map((c) => ({ ...c, pct: 0 }));
    const raw = list.map((c) => (c.amount / total) * 100), floor = raw.map(Math.floor);
    let left = 100 - floor.reduce((a, b) => a + b, 0);
    const order = raw.map((v, k) => [v - Math.floor(v), k]).sort((a, b) => b[0] - a[0]);
    for (const [, k] of order) { if (left <= 0) break; floor[k]++; left--; }
    return list.map((c, k) => ({ ...c, pct: floor[k] }));
  };
  const cats = slices("expense", mOut, (t) => [t.cat || "other", catName(L, t.cat || "other", ar)]);
  const srcName = (t) => { const n = String(t.note || "").replace(/\s+/g, " ").trim().slice(0, 28); return n ? [("n:" + n.toLowerCase()), n.charAt(0).toUpperCase() + n.slice(1)] : [t.cat || "other", catName(L, t.cat || "other", ar)]; };
  const sources = slices("income", mIn, srcName);
  // pace: spent so far this month against the same days of last month
  const dom = d.getDate(), lastFrom = isoDay(new Date(y, m - 1, 1)), lastTo = isoDay(new Date(y, m - 1, Math.min(dom, new Date(y, m, 0).getDate())));
  const lastSoFar = sum(txns.filter((t) => t.date >= lastFrom && t.date <= lastTo), "expense");
  const pace = lastSoFar > 0 ? Math.round(((mOut - lastSoFar) / lastSoFar) * 100) : null;
  // the last 4 weeks (7 days each, this week last) and the weekly target from the monthly budget
  const t0 = new Date(y, m, dom).getTime(), weeks = [];
  for (let w = 3; w >= 0; w--) {
    const from = isoDay(t0 - (w * 7 + 6) * DAY), to = isoDay(t0 - w * 7 * DAY);
    weeks.push({ from, to, out: sum(txns.filter((t) => t.date >= from && t.date <= to), "expense") });
  }
  const budget = Number(L && L.budgets && L.budgets.overall) || 0;
  // the last 6 months, oldest first: money in, money out, what was left
  const months = [];
  for (let k = 5; k >= 0; k--) {
    const a = new Date(y, m - k, 1), from = isoDay(a), to = isoDay(new Date(y, m - k + 1, 0));
    const l = txns.filter((t) => t.date >= from && t.date <= to), i = sum(l, "income"), o = sum(l, "expense");
    months.push({ key: from.slice(0, 7), in: i, out: o, net: r2(i - o) });
  }
  const sorted = [...txns].sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.ts || 0) - (a.ts || 0));
  const row = (t) => ({ id: t.id, date: t.date, type: t.type, amount: r2(t.amount), cat: t.cat || "other", catName: catName(L, t.cat || "other", ar),
    note: t.note || "", account: (byId[t.account] || {}).name || "", currency: curOf(t.account) || cur, emoji: CAT_EMOJI[t.cat] || "✦" });
  // bills (repeating expenses) due in the next 7 days, or late
  const in7 = isoDay(t0 + 7 * DAY);
  const due = ((L && L.recurring) || []).filter((r) => r.active !== false && r.type !== "income" && r.nextDate && r.nextDate <= in7 && (!acc || r.account === acc.id))
    .map((r) => ({ note: r.note || catName(L, r.cat, ar) || "Bill", amount: r2(r.amount), date: r.nextDate, late: r.nextDate < today, currency: curOf(r.account) || cur }))
    .sort((a, b) => a.date.localeCompare(b.date));
  // balances: all money accounts of the main currency added up; other currencies apart
  const balance = acc ? acc.balance : r2(accounts.filter((a) => a.currency === cur).reduce((s, a) => s + a.balance, 0));
  const oth = {};
  if (!acc) for (const a of accounts) if (a.currency !== cur) oth[a.currency] = r2((oth[a.currency] || 0) + a.balance);
  return {
    cur: acc ? acc.currency : cur, account: acc ? acc.id : null, accounts, balance,
    others: Object.entries(oth).map(([currency, v]) => ({ currency, balance: v })),
    month: { in: mIn, out: mOut, net: r2(mIn - mOut), count: inMonth.length, rate: mIn > 0 ? Math.round(((mIn - mOut) / mIn) * 1000) / 10 : null,
      from: monthFrom, to: monthEnd, daysLeft: Math.max(0, Math.round((new Date(monthEnd + "T12:00:00") - new Date(today + "T12:00:00")) / DAY)), cats, sources, pace },
    weeks, budget, weekTarget: budget ? Math.round(budget / 4.3) : 0, months,
    recent: sorted.slice(0, 3).map(row), rows: sorted.filter((t) => t.date >= monthFrom && t.date <= today).map(row),
    due, dueTotal: r2(due.filter((x) => x.currency === (acc ? acc.currency : cur)).reduce((a, x) => a + x.amount, 0)),
  };
}

/** The donut's slices for an SVG circle of circumference C: [{ dash, offset }] in the order of `cats`. */
export function donutArcs(cats, C) {
  let at = 0;
  return cats.map((c) => { const dash = r2((c.pct / 100) * C); const s = { dash, offset: r2(-at) }; at += dash; return s; });
}

/** Zakāt status from Yusr's snapshot ONLY (its engine calculated these; nothing is recomputed): null when Yusr sent nothing. */
export function zakatFromSnapshot(snap) {
  const z = snap && snap.zakat;
  if (!z) return null;
  if (z.noPrice) return { noPrice: true };
  const base = Number(z.base), nisab = Number(z.nisab);
  return { due: !!z.due, amount: z.amount, base: isFinite(base) ? base : null, nisab: isFinite(nisab) && nisab > 0 ? nisab : null,
    pct: isFinite(base) && isFinite(nisab) && nisab > 0 ? Math.max(0, Math.min(999, Math.round((base / nisab) * 100))) : null, hawlEnds: z.hawlEndsISO || null };
}

/** The month's entries as a CSV Excel opens (with a BOM, so Arabic shows right). */
export function ledgerCsv(rep, { ar = false } = {}) {
  const head = ar ? ["التاريخ", "البيان", "الفئة", "الحساب", "النوع", "المبلغ", "العملة"] : ["Date", "Description", "Category", "Account", "Type", "Amount", "Currency"];
  const q = (s) => /[",\n]/.test(String(s)) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s);
  const lines = [head.join(",")].concat(rep.rows.map((t) => [t.date, t.note || t.catName, t.catName, t.account, t.type, (t.type === "expense" ? -t.amount : t.amount), t.currency].map(q).join(",")));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
