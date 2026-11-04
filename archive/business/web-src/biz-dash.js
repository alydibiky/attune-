// v7.5: Business in two levels (Gemini's Area 4 mock-up) — the numbers for the Business hub, the Books Report overview and the Shop
// Report, all by code from the books (posted documents only) and the shop's own store (shifts, closes). Pure: no React, no storage.
import * as B from "./books.js";
import * as O from "./books-ops.js";

const DAY = (d) => d.toISOString().slice(0, 10);
const inv = (books, from, to) => books.docs.filter((d) => d.type === "invoice" && d.status === "posted" && d.date >= from && d.date <= to);
const sum = (books, docs) => docs.reduce((a, d) => a + B.docTotals(d, books.tax).total, 0);
/** % change, whole number; null when there is nothing to compare with. */
export const pctChange = (now, before) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);
const monthEnd = (iso) => DAY(new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7), 0)));
const monthBack = (iso, n) => DAY(new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1 - n, 1)));
const nameOf = (list, id) => (list.find((x) => x.id === id) || {}).name || id;

/** How each day's sales were paid: cash / card / wallet / bank from the receipts against that day's invoices; the rest is on credit. */
export function paidBy(books, docs) {
  const by = { cash: 0, card: 0, wallet: 0, bank: 0, credit: 0 };
  const nums = new Set(docs.map((d) => d.number));
  let paid = 0;
  for (const p of books.payments) for (const a of p.allocations || []) if (nums.has(a.doc)) { by[p.method] = (by[p.method] || 0) + a.amount; paid += a.amount; }
  by.credit = Math.max(0, sum(books, docs) - paid);
  return by;
}

/** The Business hub's numbers for today: counter sales (vs the same day last week), who owes you, what needs attention. */
export function hubToday(books, today) {
  if (!books) return null;
  const docs = inv(books, today, today), wk = O.addDays(today, -7);
  const sales = sum(books, docs), before = sum(books, inv(books, wk, wk));
  const d = O.dashboard(books, today);
  const customers = Object.values(d.ageing.byCustomer).filter((z) => B.AGE_BUCKETS.some((k) => z[k] > 0)).length;
  const by = paidBy(books, docs);
  return { sales, count: docs.length, change: pctChange(sales, before), by,
    receivable: d.receivable, overdue: d.overdue, overdueCount: d.overdueCount, customers,
    low: d.low, vat: d.vat.payable, has: books.docs.some((x) => x.status === "posted") };
}

/** The Books Report overview: this month (vs the same days of last month), six months of sales vs purchases with the profit line,
 *  receivables ageing in three buckets (not due · 1–30 days late · 31+ days late), the top customers and items, stock value and VAT. Amounts in minor units. */
export function booksOverview(books, today) {
  const from = O.monthStart(today), day = +today.slice(8, 10);
  const lmFrom = monthBack(today, 1), lmEnd = monthEnd(lmFrom);
  const lmTo = DAY(new Date(Math.min(Date.parse(lmEnd), Date.parse(O.addDays(lmFrom, day - 1)))));
  const pl = B.profitAndLoss(books.journal, from, today), plPrev = B.profitAndLoss(books.journal, lmFrom, lmTo);
  const bills = books.bills.filter((b) => b.status === "posted");
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const f = monthBack(today, i), t = i === 0 ? today : monthEnd(f);
    const p = B.profitAndLoss(books.journal, f, t);
    const purchases = bills.filter((b) => b.date >= f && b.date <= t).reduce((a, b) => a + B.docTotals(b, books.tax).net, 0);
    months.push({ month: f.slice(0, 7), sales: p.revenue, purchases, profit: p.netProfit, current: i === 0 });
  }
  const open = O.openInvoices(books, today), age = B.ageing(open, today);
  // three boxes by how late: not due yet · 1–30 days late · more than 30 days late (so what is overdue is never hidden in "0–30")
  const buckets = [["notDue", ["notDue"]], ["late1_30", ["d1_30"]], ["late31", ["d31_60", "d61_90", "d90plus"]]].map(([id, keys]) => {
    const per = Object.entries(age.byCustomer).map(([c, z]) => ({ customer: nameOf(books.customers, c), amount: keys.reduce((a, k) => a + z[k], 0) })).filter((x) => x.amount > 0).sort((a, b) => b.amount - a.amount);
    return { id, amount: keys.reduce((a, k) => a + age.total[k], 0), top: per[0] ? per[0].customer : "", customers: per.length };
  });
  const posted = books.docs.filter((d) => d.status === "posted" && (d.type === "invoice" || d.type === "credit"));
  const topCustomers = B.salesBy(posted, "customer", from, today, books.tax).slice(0, 3).map((x) => ({ name: nameOf(books.customers, x.name), net: x.net }));
  const topItems = B.salesBy(posted, "item", from, today, books.tax).slice(0, 3).map((x) => ({ name: nameOf(books.items, x.name), net: x.net }));
  const lv = O.levels(books);
  const tracked = books.items.filter((i) => i.track !== false);
  const vat = B.vatReturn(posted, bills, from, today, books.tax);
  return {
    month: { ...pl, margin: pl.revenue > 0 ? Math.round((1000 * pl.netProfit) / pl.revenue) / 10 : null, salesChange: pctChange(pl.revenue, plPrev.revenue) },
    months, sixProfit: months.reduce((a, m) => a + m.profit, 0),
    ageing: { total: age.grand, overdue: age.overdue, overdueCount: open.filter((o) => o.open > 0 && B.bucketOf(o.due, today) !== "notDue").length, buckets },
    topCustomers, topItems,
    stock: { value: Object.values(lv).reduce((a, x) => a + x.value, 0), items: tracked.filter((i) => (lv[i.id] || { qty: 0 }).qty > 0).length, low: B.lowStock(tracked, lv).length },
    vat,
  };
}

/** Rows for the Books Report's CSV (amounts in major units, 2 decimals). */
export function overviewCsv(o, L = (en) => en) {
  const m = (v) => (v / 100).toFixed(2);
  return [[L("Section"), L("Name"), L("Amount")],
    [L("This month"), L("Net sales"), m(o.month.revenue)], [L("This month"), L("Cost of goods sold"), m(o.month.cogs)], [L("This month"), L("Expenses"), m(o.month.expenses)], [L("This month"), L("Net profit"), m(o.month.netProfit)],
    ...o.months.map((x) => [x.month, L("Sales / purchases / profit"), `${m(x.sales)} / ${m(x.purchases)} / ${m(x.profit)}`]),
    ...o.ageing.buckets.map((b) => [L("Ageing"), b.id, m(b.amount)]),
    ...o.topCustomers.map((x) => [L("Top customers"), x.name, m(x.net)]), ...o.topItems.map((x) => [L("Top items"), x.name, m(x.net)]),
    [L("Stock"), L("Stock value"), m(o.stock.value)], [L("VAT"), L("VAT to pay"), m(o.vat.payable)]];
}

/** The Shop Report: today (vs the same day last week), the last 7 days, how it was paid, best sellers, staff and the day closes. */
export function shopReport(books, shop, today, now = Date.now()) {
  const docs = inv(books, today, today), wk = O.addDays(today, -7);
  const sales = sum(books, docs);
  const week = [];
  for (let i = 6; i >= 0; i--) { const d = O.addDays(today, -i), x = inv(books, d, d); week.push({ date: d, total: sum(books, x), count: x.length, today: i === 0 }); }
  const prevWeek = sum(books, inv(books, O.addDays(today, -13), O.addDays(today, -7)));
  const weekTotal = week.reduce((a, x) => a + x.total, 0), weekCount = week.reduce((a, x) => a + x.count, 0);
  const peak = week.reduce((p, x) => (x.total > (p ? p.total : 0) ? x : p), null);
  const by = paidBy(books, docs);
  const methods = ["cash", "wallet", "card", "bank", "credit"].map((k) => ({ id: k, amount: by[k] || 0, pct: sales > 0 ? Math.round((100 * (by[k] || 0)) / sales) : 0 })).filter((x) => x.amount > 0);
  const best = {};
  for (const d of docs) for (const l of d.lines || []) {
    const k = l.item || l.desc; const f = B.lineFigures(l, books.tax);
    best[k] = best[k] || { name: l.item ? nameOf(books.items, l.item) : l.desc, qty: 0, total: 0 };
    best[k].qty += Number(l.qty) || 0; best[k].total += f.net + f.vat;
  }
  const hours = {}, onShift = {};
  for (const x of (shop && shop.shifts) || []) {
    if (DAY(new Date(x.in)) !== today) continue;
    hours[x.who] = (hours[x.who] || 0) + ((x.out || now) - x.in) / 3600000;
    if (!x.out) onShift[x.who] = true;
  }
  const byCashier = {};
  for (const d of docs) { const k = d.cashier || ""; byCashier[k] = byCashier[k] || { count: 0, total: 0 }; byCashier[k].count++; byCashier[k].total += B.docTotals(d, books.tax).total; }
  const names = [...new Set([...((shop && shop.staff) || []).map((s) => s.name || s), ...Object.keys(hours), ...Object.keys(byCashier).filter(Boolean)])];
  const staff = names.map((n) => ({ name: n, hours: Math.round((hours[n] || 0) * 10) / 10, on: !!onShift[n], count: (byCashier[n] || {}).count || 0, total: (byCashier[n] || {}).total || 0 }))
    .filter((s) => s.hours || s.count || s.on).sort((a, b) => b.total - a.total || b.hours - a.hours);
  const cashExp = books.expenses.filter((e) => e.date === today && e.method === "cash").reduce((a, e) => a + e.amount, 0);
  const float = (shop && shop.float) || 0;
  return {
    today: { sales, count: docs.length, avg: docs.length ? Math.round(sales / docs.length) : 0, change: pctChange(sales, sum(books, inv(books, wk, wk))) },
    week, weekTotal, weekCount, weekChange: pctChange(weekTotal, prevWeek), peak: peak && peak.total > 0 ? peak : null,
    methods, by, best: Object.values(best).sort((a, b) => b.total - a.total).slice(0, 5),
    staff, staffHours: Math.round(staff.reduce((a, s) => a + s.hours, 0) * 10) / 10,
    drawer: { float, cash: by.cash, expenses: cashExp, expected: float + by.cash - cashExp },
    closes: (((shop && shop.closes) || []).slice(-5).reverse()).map((c) => ({ day: c.day, count: c.count, sales: c.sales, difference: c.difference })),
  };
}

/** A donut as SVG arc paths: [{ id, d }] for parts that add up to 100%. cx = cy = r + w. */
export function donut(parts, r = 34, w = 10) {
  const tot = parts.reduce((a, p) => a + p.amount, 0);
  if (!(tot > 0)) return [];
  const c = r + w / 2; let a0 = -Math.PI / 2;
  return parts.map((p) => {
    const frac = p.amount / tot, a1 = a0 + frac * 2 * Math.PI;
    const big = frac > 0.5 ? 1 : 0, P = (a) => [c + r * Math.cos(a), c + r * Math.sin(a)].map((v) => Math.round(v * 100) / 100);
    const [x0, y0] = P(a0), [x1, y1] = frac >= 0.9999 ? P(a0 + 2 * Math.PI - 0.0001) : P(a1);
    const out = { id: p.id, d: `M${x0} ${y0}A${r} ${r} 0 ${big} 1 ${x1} ${y1}` };
    a0 = a1; return out;
  });
}
