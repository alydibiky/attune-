/* ---- v6.10: the finance core of the Business systems ("books") ---------------------------------
   Everything a company's numbers depend on lives here as PURE code (no model, no screen, no storage):
   money in integer piastres, Egyptian tax maths (VAT, table tax, withholding), documents with line items,
   gapless numbering, payments with allocations, ageing, statements, stock with moving-average cost, and a
   balanced double-entry ledger with P&L / trial balance. The phone's AI never computes any of this.
   Tests: tests/unit/v611books.test.mjs (golden figures).

   Money: ALL amounts are integers in piastres (1 EGP = 100). Never floats.
   Rounding: half away from zero, once per line, then totals are sums of rounded lines.
   Quantities: thousandths (qty 2.5 → 2500) so 3 decimals are exact.
   Percentages: basis points in the settings (14% = 1400), so 0.5% and 14% are exact.            */

// ---- money -----------------------------------------------------------------------------------
/** "1,234.56" / 1234.56 / "١٢٣٤٫٥٦" → 123456 piastres. Anything unreadable → null. */
export function toMinor(v) {
  if (typeof v === "number") return isFinite(v) ? roundHalfAway(v * 100) : null;
  let s = String(v ?? "").trim();
  if (!s) return null;
  s = s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/٫/g, ".").replace(/٬|,|\s/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const neg = s.startsWith("-"); if (neg) s = s.slice(1);
  const [i, f = ""] = s.split(".");
  let minor = Number(i) * 100 + Number((f + "00").slice(0, 2));
  if (Number(f.charAt(2) || 0) >= 5) minor += 1;        // half away from zero on the third decimal
  return neg ? -minor : minor;
}
export const fromMinor = (m) => (m || 0) / 100;
/** 123456 → "1,234.56". */
export function fmt(m, { cur = "", plain = false } = {}) {
  const n = Math.abs(m || 0), neg = (m || 0) < 0;
  const whole = Math.floor(n / 100), frac = String(n % 100).padStart(2, "0");
  const t = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + frac;
  return (neg ? "-" : "") + t + (cur && !plain ? " " + cur : "");
}
/** Round half away from zero (the rule used for every line). */
export function roundHalfAway(x) { return x < 0 ? -Math.round(-x) : Math.round(x); }
const pctOf = (amountMinor, bp) => roundHalfAway((amountMinor * bp) / 10000);

// ---- tax settings (editable, dated: rates change) --------------------------------------------
export const DEFAULT_TAX = {
  asOf: "2026-10-02",
  vatCodes: { S: { label: "Standard 14% · عادية ١٤٪", bp: 1400 }, Z: { label: "Zero-rated 0% · صفرية", bp: 0 }, E: { label: "Exempt · معفاة", bp: 0, exempt: true } },
  // customer-side deduction at source ("خصم من المنبع"): kept as a list the owner can edit; NOT legal advice
  whtCodes: { none: { label: "None", bp: 0 }, supplies: { label: "Supplies 1% · توريدات ١٪", bp: 100 }, services: { label: "Services 3% · خدمات ٣٪", bp: 300 }, professional: { label: "Professional 5% · مهنية ٥٪", bp: 500 } },
};

// ---- a document line and a document -----------------------------------------------------------
/** line: { desc, qty, price (minor), discBp?, vat?: "S"|"Z"|"E", tableBp?, wht?: "none"|key|number(bp) } → every figure in piastres. */
export function lineFigures(line, tax = DEFAULT_TAX) {
  const qtyM = Math.round(Number(line.qty ?? 1) * 1000);
  const price = Number(line.price || 0);
  const gross = roundHalfAway((qtyM * price) / 1000);
  const discount = pctOf(gross, Number(line.discBp || 0));
  const net = gross - discount;
  const tableTax = pctOf(net, Number(line.tableBp || 0));                 // table tax is charged BEFORE VAT, on the net
  const code = (tax.vatCodes || {})[line.vat || "S"] || { bp: 1400 };
  const vatBase = code.exempt ? 0 : net + tableTax;
  const vat = code.exempt ? 0 : pctOf(vatBase, code.bp);
  const whtBp = typeof line.wht === "number" ? line.wht : ((tax.whtCodes || {})[line.wht || "none"] || { bp: 0 }).bp;
  const wht = pctOf(net, whtBp);                                          // withheld by the customer on the net (not on VAT)
  return { gross, discount, net, tableTax, vatBase, vat, total: net + tableTax + vat, wht, vatBp: code.exempt ? 0 : code.bp };
}
/** doc: { lines: [...] } → totals, with VAT grouped by rate (what a VAT return needs). Credit notes carry negative qty. */
export function docTotals(doc, tax = DEFAULT_TAX) {
  const t = { gross: 0, discount: 0, net: 0, tableTax: 0, vat: 0, total: 0, wht: 0, cashDue: 0, byVat: {} };
  for (const l of doc.lines || []) {
    const f = lineFigures(l, tax);
    t.gross += f.gross; t.discount += f.discount; t.net += f.net; t.tableTax += f.tableTax; t.vat += f.vat; t.total += f.total; t.wht += f.wht;
    const k = String(f.vatBp);
    (t.byVat[k] = t.byVat[k] || { base: 0, vat: 0 }); t.byVat[k].base += f.vatBase; t.byVat[k].vat += f.vat;
  }
  t.cashDue = t.total - t.wht;        // what the customer actually pays; the withheld part is a tax credit for us
  return t;
}

// ---- numbering: gapless per series per year, assigned at POSTING -------------------------------
export const SERIES = { quote: "QUO", order: "SO", invoice: "INV", credit: "CN", purchase: "PO", bill: "BILL", payment: "RCT", supplierPayment: "PAY", delivery: "DN" };
export const pad = (n, w = 5) => String(n).padStart(w, "0");
/** The next number for a series in a year, from the documents already POSTED (drafts have no number). */
export function nextNumber(series, year, docs = []) {
  let max = 0;
  for (const d of docs) {
    const m = /^([A-Z]+)-(\d{4})-(\d+)$/.exec(d.number || "");
    if (m && m[1] === series && Number(m[2]) === Number(year)) max = Math.max(max, Number(m[3]));
  }
  return `${series}-${year}-${pad(max + 1)}`;
}

// ---- the chart of accounts and the journal ---------------------------------------------------
export const ACCOUNTS = [
  { id: "1000", en: "Cash", ar: "الخزنة", type: "asset" }, { id: "1100", en: "Bank", ar: "البنك", type: "asset" },
  { id: "1200", en: "Accounts receivable", ar: "العملاء (مدينون)", type: "asset" }, { id: "1300", en: "Inventory", ar: "المخزون", type: "asset" },
  { id: "1400", en: "Withholding tax receivable", ar: "ضريبة خصم من المنبع (لنا)", type: "asset" }, { id: "1500", en: "VAT on purchases (input)", ar: "ضريبة القيمة المضافة — مشتريات", type: "asset" },
  { id: "2000", en: "Accounts payable", ar: "الموردون (دائنون)", type: "liability" }, { id: "2100", en: "VAT on sales (output)", ar: "ضريبة القيمة المضافة — مبيعات", type: "liability" },
  { id: "2200", en: "Table tax payable", ar: "ضريبة الجدول", type: "liability" }, { id: "2300", en: "Customer deposits", ar: "دفعات مقدمة من العملاء", type: "liability" },
  { id: "3000", en: "Owner's equity", ar: "حقوق الملكية", type: "equity" },
  { id: "4000", en: "Sales", ar: "المبيعات", type: "income" }, { id: "4100", en: "Sales returns", ar: "مردودات المبيعات", type: "income" },
  { id: "4200", en: "Exchange gain / loss", ar: "فروق تغيير العملة", type: "income" },
  { id: "5000", en: "Cost of goods sold", ar: "تكلفة البضاعة المباعة", type: "expense" }, { id: "6000", en: "Expenses", ar: "المصروفات", type: "expense" },
];
const acct = (id) => ACCOUNTS.find((a) => a.id === id);
/** A journal entry is valid only when debits equal credits. */
export function entry(date, ref, lines, memo = "") {
  const ls = lines.filter((l) => (l.debit || 0) || (l.credit || 0)).map((l) => ({ account: l.account, debit: l.debit || 0, credit: l.credit || 0 }));
  const d = ls.reduce((s, l) => s + l.debit, 0), c = ls.reduce((s, l) => s + l.credit, 0);
  if (d !== c) throw new Error(`Unbalanced entry ${ref}: debits ${d} ≠ credits ${c}`);
  return { date, ref, memo, lines: ls };
}
/** What posting a sales invoice / credit note writes (a credit note has negative figures, so the same lines reverse). */
export function salesEntry(doc, tax = DEFAULT_TAX, cogs = 0) {
  const t = docTotals(doc, tax);
  const sign = doc.type === "credit" ? -1 : 1;
  const T = { net: Math.abs(t.net), tableTax: Math.abs(t.tableTax), vat: Math.abs(t.vat), total: Math.abs(t.total) };
  const dr = sign > 0 ? "debit" : "credit", cr = sign > 0 ? "credit" : "debit";
  const lines = [
    { account: "1200", [dr]: T.total },
    { account: sign > 0 ? "4000" : "4100", [cr]: T.net },
    { account: "2200", [cr]: T.tableTax },
    { account: "2100", [cr]: T.vat },
  ];
  if (cogs) { lines.push({ account: "5000", [dr]: Math.abs(cogs) }); lines.push({ account: "1300", [cr]: Math.abs(cogs) }); }
  return entry(doc.date, doc.number, lines, doc.type === "credit" ? "Credit note" : "Sales invoice");
}
/** Money received from a customer: cash/bank up, receivable down, and the withheld part becomes a tax credit. */
export function receiptEntry(p) {
  const cashAcc = p.method === "bank" ? "1100" : "1000";
  const wht = (p.allocations || []).reduce((s, a) => s + (a.wht || 0), 0);
  const applied = (p.allocations || []).reduce((s, a) => s + a.amount + (a.wht || 0), 0);
  const onAccount = p.amount - (applied - wht);      // money not allocated to an invoice stays as a customer deposit
  return entry(p.date, p.number, [
    { account: cashAcc, debit: p.amount }, { account: "1400", debit: wht },
    { account: "1200", credit: applied }, { account: "2300", credit: onAccount > 0 ? onAccount : 0 },
  ], "Customer receipt");
}
/** A supplier bill: stock or expense up, input VAT, payable. */
export function billEntry(doc, tax = DEFAULT_TAX, { toStock = true } = {}) {
  const t = docTotals(doc, tax);
  return entry(doc.date, doc.number, [
    { account: toStock ? "1300" : "6000", debit: t.net + t.tableTax }, { account: "1500", debit: t.vat }, { account: "2000", credit: t.total },
  ], "Supplier bill");
}
export function supplierPaymentEntry(p) {
  return entry(p.date, p.number, [{ account: "2000", debit: p.amount }, { account: p.method === "bank" ? "1100" : "1000", credit: p.amount }], "Supplier payment");
}
export function expenseEntry(e) {
  return entry(e.date, e.number || "EXP", [{ account: "6000", debit: e.amount }, { account: e.method === "bank" ? "1100" : "1000", credit: e.amount }], e.memo || "Expense");
}

export function balances(journal) {
  const b = {};
  for (const e of journal) for (const l of e.lines) { const a = (b[l.account] = b[l.account] || { debit: 0, credit: 0 }); a.debit += l.debit; a.credit += l.credit; }
  return b;
}
export function trialBalance(journal) {
  const b = balances(journal);
  const rows = Object.keys(b).sort().map((id) => ({ account: id, name: (acct(id) || {}).en || id, debit: b[id].debit, credit: b[id].credit }));
  const debit = rows.reduce((s, r) => s + r.debit, 0), credit = rows.reduce((s, r) => s + r.credit, 0);
  return { rows, debit, credit, balanced: debit === credit };
}
/** Profit and loss for a date range (inclusive, ISO dates). */
export function profitAndLoss(journal, from, to) {
  const b = balances(journal.filter((e) => (!from || e.date >= from) && (!to || e.date <= to)));
  const side = (id, a, c) => ((b[id] || {})[a] || 0) - ((b[id] || {})[c] || 0);
  const sales = side("4000", "credit", "debit"), salesReturns = side("4100", "debit", "credit");
  const cogs = side("5000", "debit", "credit"), expenses = side("6000", "debit", "credit");
  const fxGain = side("4200", "credit", "debit");          // realised exchange gain (+) or loss (−) on foreign-currency receipts
  const revenue = sales - salesReturns, grossProfit = revenue - cogs;
  return { sales, salesReturns, revenue, cogs, grossProfit, expenses, fxGain, netProfit: grossProfit - expenses + fxGain };
}
export function cashPosition(journal, asOf) {
  const b = balances(journal.filter((e) => !asOf || e.date <= asOf));
  const net = (id) => ((b[id] || {}).debit || 0) - ((b[id] || {}).credit || 0);
  return { cash: net("1000"), bank: net("1100"), total: net("1000") + net("1100") };
}

// ---- receivables: what is still owed, ageing, statements ---------------------------------------
const dayNum = (iso) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);
export const daysBetween = (a, b) => dayNum(b) - dayNum(a);
/** Per invoice: total, paid (+ withheld), outstanding. invoices are POSTED docs; payments carry allocations. */
export function outstanding(invoices, payments, credits = [], tax = DEFAULT_TAX) {
  return invoices.map((inv) => {
    const total = docTotals(inv, tax).total;
    let paid = 0;
    for (const p of payments) for (const a of p.allocations || []) if (a.doc === inv.number) paid += a.amount + (a.wht || 0);
    let credited = 0;
    for (const c of credits) if (c.against === inv.number) credited += Math.abs(docTotals(c, tax).total);
    return { number: inv.number, customer: inv.customer, date: inv.date, due: inv.due || inv.date, total, paid, credited, open: total - paid - credited };
  });
}
export const AGE_BUCKETS = ["notDue", "d1_30", "d31_60", "d61_90", "d90plus"];
export function bucketOf(due, asOf) {
  const late = daysBetween(due, asOf);
  return late <= 0 ? "notDue" : late <= 30 ? "d1_30" : late <= 60 ? "d31_60" : late <= 90 ? "d61_90" : "d90plus";
}
/** Ageing of everything still owed, in total and per customer. */
export function ageing(open, asOf) {
  const zero = () => Object.fromEntries(AGE_BUCKETS.map((b) => [b, 0]));
  const total = zero(), byCustomer = {};
  for (const o of open) {
    if (o.open <= 0) continue;
    const b = bucketOf(o.due, asOf);
    total[b] += o.open;
    (byCustomer[o.customer] = byCustomer[o.customer] || zero())[b] += o.open;
  }
  const sum = (z) => AGE_BUCKETS.reduce((s, b) => s + z[b], 0);
  return { total, grand: sum(total), byCustomer, overdue: sum(total) - total.notDue };
}
/** A customer's statement: opening balance, every document and payment in date order with a running balance. */
export function statement({ customer, invoices, credits = [], payments, from, to, tax = DEFAULT_TAX }) {
  const ev = [];
  for (const d of invoices) if (d.customer === customer) ev.push({ date: d.date, ref: d.number, kind: "invoice", debit: docTotals(d, tax).total, credit: 0 });
  for (const d of credits) if (d.customer === customer) ev.push({ date: d.date, ref: d.number, kind: "credit", debit: 0, credit: Math.abs(docTotals(d, tax).total) });
  for (const p of payments) if (p.customer === customer) ev.push({ date: p.date, ref: p.number, kind: "payment", debit: 0, credit: p.amount - (p.fxGain || 0) + (p.allocations || []).reduce((s, a) => s + (a.wht || 0), 0) });
  ev.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.ref < b.ref ? -1 : 1));
  let bal = 0, opening = 0;
  const lines = [];
  for (const e of ev) {
    const prev = bal; bal += e.debit - e.credit;
    if (from && e.date < from) { opening = bal; continue; }
    if (to && e.date > to) continue;
    lines.push({ ...e, balance: bal, _prev: prev });
  }
  return { customer, opening, lines, closing: lines.length ? lines[lines.length - 1].balance : opening };
}

// ---- payments: allocate money to invoices ------------------------------------------------------
/** Spread an amount over the oldest open invoices first. Returns allocations and what is left on account. */
export function autoAllocate(amount, open) {
  let left = amount; const allocations = [];
  for (const o of [...open].filter((x) => x.open > 0).sort((a, b) => (a.due < b.due ? -1 : 1))) {
    if (left <= 0) break;
    const take = Math.min(left, o.open);
    allocations.push({ doc: o.number, amount: take, wht: 0 }); left -= take;
  }
  return { allocations, onAccount: left };
}
/** Warn (not block) when posting would push a customer past their credit limit. */
export function creditCheck({ limit, owed, newTotal }) {
  if (!limit) return { ok: true };
  const after = owed + newTotal;
  return after > limit ? { ok: false, over: after - limit, limit, after } : { ok: true };
}

// ---- stock: moves → on hand → moving-average cost ----------------------------------------------
/** moves: { date, item, qty (±, thousandths), cost? (total value in minor for an IN) } in date order.
    Valuation keeps total value and quantity, so averages never drift by rounding. */
export function stockLevels(moves) {
  const s = {};
  for (const m of [...moves].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) {
    const it = (s[m.item] = s[m.item] || { qty: 0, value: 0 });
    const q = Math.round(Number(m.qty) * 1000);
    if (q > 0) { it.qty += q; it.value += m.cost || 0; }
    else if (q < 0) {
      const out = -q;
      const costOut = it.qty > 0 ? roundHalfAway((it.value * Math.min(out, it.qty)) / it.qty) : 0;
      it.qty -= out; it.value -= costOut;
      m.costOut = costOut;
    }
  }
  const res = {};
  for (const k of Object.keys(s)) res[k] = { qty: s[k].qty / 1000, value: s[k].value, avgCost: s[k].qty > 0 ? roundHalfAway(s[k].value / (s[k].qty / 1000)) : 0 };
  return res;
}
/** The cost of goods for a sale of `qty` of an item, at the moving average right now. */
export function cogsFor(levels, item, qty) {
  const l = levels[item]; if (!l || l.qty <= 0) return 0;
  return roundHalfAway((l.value * Math.min(qty, l.qty)) / l.qty);
}
export function lowStock(items, levels) {
  return items.filter((i) => i.reorder != null && ((levels[i.id] || { qty: 0 }).qty <= i.reorder)).map((i) => ({ id: i.id, name: i.name, onHand: (levels[i.id] || { qty: 0 }).qty, reorder: i.reorder }));
}

// ---- reports -----------------------------------------------------------------------------------
/** Sales by customer or by item over a period, from posted invoices (credit notes reduce). */
export function salesBy(docs, key, from, to, tax = DEFAULT_TAX) {
  const out = {};
  for (const d of docs) {
    if ((from && d.date < from) || (to && d.date > to)) continue;
    const sign = d.type === "credit" ? -1 : 1;
    if (key === "customer") { const t = docTotals(d, tax); out[d.customer] = (out[d.customer] || 0) + sign * Math.abs(t.net); }
    else for (const l of d.lines || []) { const f = lineFigures(l, tax); out[l.item || l.desc] = (out[l.item || l.desc] || 0) + sign * Math.abs(f.net); }
  }
  return Object.entries(out).map(([name, net]) => ({ name, net })).sort((a, b) => b.net - a.net);
}
/** The VAT return figures for a period: output VAT on sales, input VAT on purchases, and the balance. */
export function vatReturn(sales, bills, from, to, tax = DEFAULT_TAX) {
  const inR = (d) => (!from || d.date >= from) && (!to || d.date <= to);
  let output = 0, input = 0, salesBase = 0, purchasesBase = 0;
  for (const d of sales) if (inR(d)) { const t = docTotals(d, tax), s = d.type === "credit" ? -1 : 1; output += s * Math.abs(t.vat); salesBase += s * Math.abs(t.net); }
  for (const d of bills) if (inR(d)) { const t = docTotals(d, tax); input += t.vat; purchasesBase += t.net; }
  return { salesBase, output, purchasesBase, input, payable: output - input };
}
