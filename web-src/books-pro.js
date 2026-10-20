/* ---- v6.44 Books in depth (Ali: "every business system on the app to have depth") -------------------------------------
   What a company's accounting system has beyond invoices, bills, stock and the ledger — same contract as books-ops.js:
   pure (state in → new state out), money in integer piastres, every posting a balanced journal entry, every change in
   the audit chain. Tests: tests/unit/v744bookspro.test.mjs.
   1. Balance sheet (الميزانية العمومية) as of a date — assets = liabilities + equity (this year's profit included).
   2. Cash flow (التدفقات النقدية) for a period: cash + bank in and out by where it came from / went to.
   3. Profit & loss month by month for a year, and budgets vs actual (الموازنة التقديرية).
   4. Fixed assets (الأصول الثابتة): bought → straight-line depreciation each month, posted once; book value.
   5. Payroll (المرتبات): employees, social insurance (employee / employer shares the owner confirms), payroll tax the owner
      types (the law's brackets change — no guessed tax), one run per month → payslips + the entry.
   6. Recurring invoices (فواتير متكررة): a template every week / month / year → drafts on their dates (or posted).
   7. Bank reconciliation (تسوية البنك): the bank's statement (CSV) matched to the books' bank movements by amount and date.
   8. Instalments (التقسيط): an invoice split into a down payment + N monthly parts; what is paid / late from its receipts. */
import * as B from "./books.js";
import * as O from "./books-ops.js";

const clone = (x) => JSON.parse(JSON.stringify(x));
const fail = (m) => { throw new O.BooksError(m); };
const year = (iso) => Number(String(iso).slice(0, 4));
const ensure = (s) => { for (const k of ["assets", "depRuns", "employees", "payslips", "recurring", "budgets", "instalments", "recon"]) if (!Array.isArray(s[k])) s[k] = []; return s; };
const ymOf = (iso) => String(iso).slice(0, 7);
const lastDay = (ym) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).toISOString().slice(0, 10);
const addMonths = (iso, n) => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7) - 1 + n, d = +iso.slice(8, 10); const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); return new Date(Date.UTC(y, m, Math.min(d, last))).toISOString().slice(0, 10); };
export { addMonths };
const acct = (id) => B.ACCOUNTS.find((a) => a.id === id) || { id, en: id, ar: id, type: "other" };
const net = (b, id) => ((b[id] || {}).debit || 0) - ((b[id] || {}).credit || 0);
const cashAcc = (m) => (m === "bank" ? "1100" : "1000");

// ---- 1. balance sheet -----------------------------------------------------------------------------------------------
/** As of a date: { assets: [{account, name, amount}], liabilities, equity, totals, balanced }. Equity includes the
    profit not yet closed (income − expenses up to the date). */
export function balanceSheet(journal, asOf) {
  const b = B.balances(journal.filter((e) => !asOf || e.date <= asOf));
  const rows = (type, sign) => B.ACCOUNTS.filter((a) => a.type === type).map((a) => ({ account: a.id, en: a.en, ar: a.ar, amount: sign * net(b, a.id) })).filter((r) => r.amount);
  const assets = rows("asset", 1), liabilities = rows("liability", -1), equity = rows("equity", -1);
  const profit = B.ACCOUNTS.filter((a) => a.type === "income").reduce((n, a) => n - net(b, a.id), 0) - B.ACCOUNTS.filter((a) => a.type === "expense").reduce((n, a) => n + net(b, a.id), 0);
  if (profit) equity.push({ account: "profit", en: "Profit not yet closed", ar: "أرباح الفترة", amount: profit });
  const sum = (r) => r.reduce((n, x) => n + x.amount, 0);
  const totals = { assets: sum(assets), liabilities: sum(liabilities), equity: sum(equity) };
  return { asOf, assets, liabilities, equity, totals, balanced: totals.assets === totals.liabilities + totals.equity };
}

// ---- 2. cash flow ------------------------------------------------------------------------------------------------------
export const FLOW_KINDS = ["customers", "suppliers", "expenses", "payroll", "taxes", "assets", "owner", "other"];
const kindOf = (id) => (id === "1200" || id === "2300" || id === "4000" ? "customers" : id === "2000" || id === "1300" ? "suppliers" : id === "2400" || id === "2410" || id === "6200" || id === "6300" ? "payroll"
  : id === "2100" || id === "2200" || id === "2420" || id === "1400" || id === "1500" ? "taxes" : id === "1600" ? "assets" : id === "3000" ? "owner" : /^6/.test(id) ? "expenses" : "other");
/** Cash + bank for a period: opening, in and out by kind (the biggest other line of each entry), closing. Moves between
    the cash box and the bank are not counted (money stays in the company). */
export function cashFlow(journal, from, to) {
  const flows = Object.fromEntries(FLOW_KINDS.map((k) => [k, { in: 0, out: 0 }]));
  let opening = 0;
  for (const e of journal) {
    const c = e.lines.filter((l) => l.account === "1000" || l.account === "1100").reduce((n, l) => n + l.debit - l.credit, 0);
    if (from && e.date < from) { opening += c; continue; }
    if (to && e.date > to) continue;
    if (!c) continue;
    const other = e.lines.filter((l) => l.account !== "1000" && l.account !== "1100").sort((a, b) => b.debit + b.credit - (a.debit + a.credit))[0];
    const k = other ? kindOf(other.account) : "other";
    if (c > 0) flows[k].in += c; else flows[k].out += -c;
  }
  const inT = FLOW_KINDS.reduce((n, k) => n + flows[k].in, 0), outT = FLOW_KINDS.reduce((n, k) => n + flows[k].out, 0);
  return { from, to, opening, flows, in: inT, out: outT, net: inT - outT, closing: opening + inT - outT };
}

// ---- 3. months and budgets ----------------------------------------------------------------------------------------------
/** Profit & loss for each month of a year: [{ ym, revenue, cogs, expenses, netProfit }] ×12 and the year's total. */
export function monthlyPL(journal, y) {
  const months = Array.from({ length: 12 }, (_, i) => { const ym = `${y}-${String(i + 1).padStart(2, "0")}`; const r = B.profitAndLoss(journal, ym + "-01", lastDay(ym)); return { ym, revenue: r.revenue, cogs: r.cogs, expenses: r.expenses, netProfit: r.netProfit }; });
  const total = months.reduce((t, m) => ({ revenue: t.revenue + m.revenue, cogs: t.cogs + m.cogs, expenses: t.expenses + m.expenses, netProfit: t.netProfit + m.netProfit }), { revenue: 0, cogs: 0, expenses: 0, netProfit: 0 });
  return { year: y, months, total };
}
/** A budget for one account and year: 12 monthly amounts (piastres). Replaces the old one. */
export function setBudget(state, { year: y, account, months }, { user, at } = {}) {
  const s = ensure(clone(state));
  if (!B.ACCOUNTS.find((a) => a.id === account && (a.type === "income" || a.type === "expense"))) fail("Choose an income or expense account");
  const ms = (months || []).map((v) => Math.round(Number(v) || 0)); if (ms.length !== 12 || ms.some((v) => v < 0)) fail("A budget needs 12 monthly amounts");
  s.budgets = s.budgets.filter((x) => !(x.year === y && x.account === account)).concat([{ year: y, account, months: ms }]);
  O.log(s, user, "budget", account, String(y), at);
  return s;
}
/** Each budgeted account for a year, month by month: budget, actual, variance (+ = better than planned). */
export function budgetVsActual(s, y) {
  ensure(s);
  return s.budgets.filter((x) => x.year === y).map((bd) => {
    const a = acct(bd.account), income = a.type === "income";
    const months = bd.months.map((budget, i) => {
      const ym = `${y}-${String(i + 1).padStart(2, "0")}`, b = B.balances(s.journal.filter((e) => e.date >= ym + "-01" && e.date <= lastDay(ym)));
      const actual = income ? -net(b, bd.account) : net(b, bd.account);
      return { ym, budget, actual, variance: income ? actual - budget : budget - actual };
    });
    const t = months.reduce((x, m) => ({ budget: x.budget + m.budget, actual: x.actual + m.actual, variance: x.variance + m.variance }), { budget: 0, actual: 0, variance: 0 });
    return { account: bd.account, en: a.en, ar: a.ar, income, months, ...t };
  });
}

// ---- 4. fixed assets ------------------------------------------------------------------------------------------------------
/** Buy an asset: cost (piastres), life in months, salvage value; paid by cash / bank or owed to a supplier (payable). */
export function addAsset(state, { name, date, cost, life, salvage = 0, paidBy = "cash" }, { user, at } = {}) {
  const s = ensure(clone(state));
  if (!String(name || "").trim()) fail("Name the asset");
  if (!date) fail("Choose a date");
  if (!(cost > 0) || !Number.isInteger(cost)) fail("Enter the cost");
  if (!(life >= 1) || !Number.isInteger(+life)) fail("Enter its useful life in months");
  if (salvage < 0 || salvage >= cost) fail("The salvage value must be less than the cost");
  const a = { id: O.nid(s, "fa"), number: "FA-" + year(date) + "-" + String(s.assets.length + 1).padStart(4, "0"), name: String(name).trim(), date, cost, life: +life, salvage: Math.round(salvage), paidBy };
  s.assets.push(a);
  s.journal.push(B.entry(date, a.number, [{ account: "1600", debit: cost }, { account: paidBy === "payable" ? "2000" : cashAcc(paidBy), credit: cost }], "Fixed asset — " + a.name));
  O.log(s, user, "asset", a.number, B.fmt(cost), at);
  return { state: s, number: a.number };
}
/** The straight-line depreciation of one month: (cost − salvage) / life, the last month takes the rounding rest. */
export function depFor(a, monthIndex) {
  if (monthIndex < 0 || monthIndex >= a.life) return 0;
  const base = a.cost - a.salvage, per = Math.floor(base / a.life);
  return monthIndex === a.life - 1 ? base - per * (a.life - 1) : per;
}
/** Months from the asset's first full month (the month after it was bought) to ym: index of ym, or −1 before it. */
const monthIndex = (a, ym) => { const s = ymOf(addMonths(a.date.slice(0, 8) + "01", 1)); return (+ym.slice(0, 4) - +s.slice(0, 4)) * 12 + (+ym.slice(5, 7) - +s.slice(5, 7)); };
/** Book value of an asset at the end of a month (or today). */
export function bookValue(a, ym) {
  let dep = 0; for (let i = 0; i <= Math.min(a.life - 1, monthIndex(a, ym)); i++) dep += depFor(a, i);
  return { cost: a.cost, depreciated: dep, value: a.cost - dep };
}
/** Post depreciation for every asset for every month up to `ym` not posted yet (each month once, dated its last day). */
export function runDepreciation(state, ym, { user, at } = {}) {
  const s = ensure(clone(state));
  let posted = 0, total = 0;
  for (const a of s.assets) {
    if (a.disposed) continue;
    const done = new Set(s.depRuns.filter((r) => r.asset === a.id).map((r) => r.ym));
    for (let i = 0; i < a.life; i++) {
      const m = ymOf(addMonths(a.date.slice(0, 8) + "01", i + 1)); if (m > ym) break;
      if (done.has(m)) continue;
      const amt = depFor(a, i); if (!amt) continue;
      s.journal.push(B.entry(lastDay(m), "DEP-" + a.number + "-" + m, [{ account: "6100", debit: amt }, { account: "1650", credit: amt }], "Depreciation — " + a.name));
      s.depRuns.push({ asset: a.id, ym: m, amount: amt }); posted++; total += amt;
    }
  }
  if (posted) O.log(s, user, "depreciation", ym, `${posted} · ${B.fmt(total)}`, at);
  return { state: s, posted, total };
}

// ---- 5. payroll -------------------------------------------------------------------------------------------------------------
/** The usual social insurance shares in Egypt (employee 11 %, employer 18.75 % of the insurable wage) — DEFAULTS the owner
    confirms; rates and the insurable wage limits change by law. */
export const SI_DEFAULT = { employeeBp: 1100, employerBp: 1875 };
export function saveEmployee(state, e, { user, at } = {}) {
  const s = ensure(clone(state));
  if (!String(e.name || "").trim()) fail("A name is needed");
  if (!(e.gross > 0) || !Number.isInteger(e.gross)) fail("Enter the monthly gross salary");
  const rec = { id: e.id || O.nid(s, "em"), name: String(e.name).trim(), role: e.role || "", gross: e.gross, insurable: Number.isInteger(e.insurable) && e.insurable >= 0 ? e.insurable : e.gross,
    employeeBp: Number.isInteger(e.employeeBp) ? e.employeeBp : SI_DEFAULT.employeeBp, employerBp: Number.isInteger(e.employerBp) ? e.employerBp : SI_DEFAULT.employerBp, tax: Number.isInteger(e.tax) && e.tax >= 0 ? e.tax : 0, active: e.active !== false };
  const i = s.employees.findIndex((x) => x.id === rec.id);
  if (i >= 0) s.employees[i] = rec; else s.employees.push(rec);
  O.log(s, user, "employee", rec.id, rec.name, at);
  return { state: s, id: rec.id };
}
/** One employee's pay for a month: gross, insurance (employee / employer), tax, deductions (advances, absence), net. */
export function payslipFor(e, { deductions = 0 } = {}) {
  const siEmp = B.roundHalfAway((e.insurable * e.employeeBp) / 10000), siEr = B.roundHalfAway((e.insurable * e.employerBp) / 10000);
  return { employee: e.id, name: e.name, gross: e.gross, siEmp, siEr, tax: e.tax, deductions, net: e.gross - siEmp - e.tax - deductions };
}
/** Run the payroll of a month once: a payslip per active employee and ONE balanced entry. Paid from cash / bank, or left
    owed (method "payable" → Salaries payable). deductions = { employeeId: piastres } (advances, absence). */
export function runPayroll(state, { ym, date, method = "bank", deductions = {} }, { user, at } = {}) {
  O.need("post");
  const s = ensure(clone(state));
  if (!/^\d{4}-\d{2}$/.test(ym || "")) fail("Choose the month");
  if (s.payslips.some((p) => p.ym === ym)) fail("The payroll of " + ym + " is already done");
  const emps = s.employees.filter((e) => e.active); if (!emps.length) fail("Add the employees first");
  const slips = emps.map((e) => ({ ym, ...payslipFor(e, { deductions: Math.max(0, Math.round(deductions[e.id] || 0)) }) }));
  if (slips.some((p) => p.net < 0)) fail("A payslip would be negative — check the deductions");
  const T = slips.reduce((t, p) => ({ gross: t.gross + p.gross, siEmp: t.siEmp + p.siEmp, siEr: t.siEr + p.siEr, tax: t.tax + p.tax, ded: t.ded + p.deductions, net: t.net + p.net }), { gross: 0, siEmp: 0, siEr: 0, tax: 0, ded: 0, net: 0 });
  const d = date || lastDay(ym), ref = "PAY-" + ym;
  // deductions (advances paid earlier, absence) reduce what is paid; they come back to the cash they were paid from
  s.journal.push(B.entry(d, ref, [
    { account: "6200", debit: T.gross }, { account: "6300", debit: T.siEr },
    { account: "2410", credit: T.siEmp + T.siEr }, { account: "2420", credit: T.tax },
    { account: method === "payable" ? "2400" : cashAcc(method), credit: T.net }, { account: "6000", credit: T.ded },
  ], "Payroll " + ym));
  s.payslips.push(...slips.map((p) => ({ ...p, ref })));
  O.log(s, user, "payroll", ref, B.fmt(T.net), at);
  return { state: s, ref, totals: T, slips };
}

// ---- 6. recurring invoices --------------------------------------------------------------------------------------------------
const nextDate = (iso, every) => (every === "week" ? O.addDays(iso, 7) : every === "year" ? addMonths(iso, 12) : addMonths(iso, 1));
export function saveRecurring(state, r, { user, at } = {}) {
  const s = ensure(clone(state));
  if (!s.customers.find((c) => c.id === r.customer)) fail("Choose a customer");
  if (!(r.lines || []).length) fail("Add at least one line");
  if (!r.next) fail("Choose the first date");
  if (!["week", "month", "year"].includes(r.every)) fail("Choose how often");
  const rec = { id: r.id || O.nid(s, "rc"), customer: r.customer, lines: r.lines, every: r.every, next: r.next, until: r.until || "", post: !!r.post, active: r.active !== false, made: r.made || 0, note: r.note || "" };
  const i = s.recurring.findIndex((x) => x.id === rec.id); if (i >= 0) s.recurring[i] = rec; else s.recurring.push(rec);
  O.log(s, user, "recurring", rec.id, rec.every, at);
  return { state: s, id: rec.id };
}
/** Every recurring invoice whose date has come (up to today): drafts made (and posted when the template says so). */
export function runRecurring(state, today, opts = {}) {
  let s = ensure(clone(state)); const made = [];
  for (const id of s.recurring.map((x) => x.id)) {
    // each step makes a new state, so the template is looked up again every time
    for (let r = s.recurring.find((x) => x.id === id); r.active && r.next <= today && (!r.until || r.next <= r.until); r = s.recurring.find((x) => x.id === id)) {
      const out = O.saveDraft(s, { type: "invoice", customer: r.customer, date: r.next, lines: clone(r.lines), memo: r.note, recurring: r.id }, opts);
      s = out.state; let number = "";
      if (r.post) { const p = O.post(s, out.id, opts); s = p.state; number = p.number; }
      const rr = s.recurring.find((x) => x.id === r.id); made.push({ recurring: r.id, date: rr.next, id: out.id, number });
      rr.next = nextDate(rr.next, rr.every); rr.made++;
      if (made.length > 500) break;
    }
  }
  return { state: s, made };
}

// ---- 7. bank reconciliation -----------------------------------------------------------------------------------------------
/** A bank statement exported as CSV (date, description, amount — or debit / credit columns) → lines in piastres. */
export function parseStatement(text) {
  const rows = String(text || "").split(/\r?\n/).map((l) => l.split(/[,;\t]/).map((c) => c.replace(/^"|"$/g, "").trim())).filter((r) => r.some(Boolean));
  if (!rows.length) return [];
  const head = rows[0].map((c) => c.toLowerCase());
  const has = head.some((c) => /date|تاريخ/.test(c));
  const col = (re) => head.findIndex((c) => re.test(c));
  const di = has ? col(/date|تاريخ/) : 0, desc = has ? col(/desc|details|narr|بيان|وصف/) : 1, amt = has ? col(/^amount|المبلغ|القيمة/) : 2;
  const deb = has ? col(/debit|withdraw|مدين|سحب/) : -1, cre = has ? col(/credit|deposit|دائن|إيداع|ايداع/) : -1;
  const day = (v) => { const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/) || String(v).match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/); if (!m) return ""; return m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; };
  const out = [];
  for (const r of rows.slice(has ? 1 : 0)) {
    const date = day(r[di]); if (!date) continue;
    let a = amt >= 0 && r[amt] ? B.toMinor(r[amt]) : null;
    if (a == null && (deb >= 0 || cre >= 0)) a = (B.toMinor(r[cre]) || 0) - (B.toMinor(r[deb]) || 0);
    if (a == null || !a) continue;
    out.push({ i: out.length, date, desc: desc >= 0 ? r[desc] || "" : "", amount: a });
  }
  return out;
}
/** Match the statement to the books' bank movements (account 1100): the same amount within `days` days, closest first.
    → { matched: [{ line, entry }], bankOnly (on the statement, not in the books), booksOnly, difference }. */
export function reconcile(journal, lines, { days = 4, from = "", to = "" } = {}) {
  const moves = journal.map((e, k) => ({ k, date: e.date, ref: e.ref, memo: e.memo, amount: e.lines.filter((l) => l.account === "1100").reduce((n, l) => n + l.debit - l.credit, 0) }))
    .filter((m) => m.amount && (!from || m.date >= from) && (!to || m.date <= to));
  const used = new Set(), matched = [], bankOnly = [];
  for (const l of [...lines].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const cands = moves.filter((m) => !used.has(m.k) && m.amount === l.amount && Math.abs(B.daysBetween(m.date, l.date)) <= days).sort((a, b) => Math.abs(B.daysBetween(a.date, l.date)) - Math.abs(B.daysBetween(b.date, l.date)));
    if (cands.length) { used.add(cands[0].k); matched.push({ line: l, entry: cands[0] }); } else bankOnly.push(l);
  }
  const booksOnly = moves.filter((m) => !used.has(m.k) && (!lines.length || (m.date >= lines.reduce((a, l) => (l.date < a ? l.date : a), "9999") && m.date <= lines.reduce((a, l) => (l.date > a ? l.date : a), ""))));
  const bankSum = lines.reduce((n, l) => n + l.amount, 0), booksSum = matched.reduce((n, m) => n + m.entry.amount, 0) + booksOnly.reduce((n, m) => n + m.amount, 0);
  return { matched, bankOnly, booksOnly, bankSum, booksSum, difference: bankSum - booksSum };
}

// ---- 8. instalments ------------------------------------------------------------------------------------------------------------
/** Split a posted invoice into a down payment (due on the invoice date) + `count` monthly parts from `first`. */
export function planInstalments(state, { invoice, down = 0, count, first }, { user, at } = {}) {
  const s = ensure(clone(state));
  const inv = s.docs.find((d) => d.type === "invoice" && d.status === "posted" && d.number === invoice); if (!inv) fail("Choose a posted invoice");
  if (s.instalments.some((p) => p.invoice === invoice)) fail("This invoice already has an instalment plan");
  const o = O.openInvoices(s).find((x) => x.number === invoice); const left = o ? o.open : 0;
  if (!(left > 0)) fail("This invoice is paid already");
  if (!(count >= 1 && count <= 120) || !Number.isInteger(+count)) fail("Choose 1–120 instalments");
  if (down < 0 || down >= left) fail("The down payment must be less than what is open");
  if (!first) fail("Choose the first instalment date");
  const rest = left - down, per = Math.floor(rest / count), sched = [];
  if (down) sched.push({ due: inv.date, amount: down, down: true });
  for (let i = 0; i < count; i++) sched.push({ due: addMonths(first, i), amount: i === count - 1 ? rest - per * (count - 1) : per });
  s.instalments.push({ id: O.nid(s, "ip"), invoice, customer: inv.customer, schedule: sched, paidBefore: o.total - o.open });
  O.log(s, user, "instalments", invoice, `${count} × ${B.fmt(per)}`, at);
  return { state: s, schedule: sched };
}
/** Each plan with what is paid / due / late: the invoice's receipts (and credit notes) fill the parts in order. */
export function instalmentStatus(s, today) {
  ensure(s);
  const open = O.openInvoices(s);
  return s.instalments.map((p) => {
    const o = open.find((x) => x.number === p.invoice) || { total: 0, paid: 0, credited: 0, open: 0 };
    let paid = o.total - o.open - (p.paidBefore || 0);   // what came in since the plan was made
    const parts = p.schedule.map((x) => { const got = Math.max(0, Math.min(x.amount, paid)); paid -= got; const left = x.amount - got;
      return { ...x, paid: got, left, state: left <= 0 ? "paid" : x.due < today ? "late" : x.due === today ? "today" : "coming" }; });
    const late = parts.filter((x) => x.state === "late"), next = parts.find((x) => x.left > 0);
    return { ...p, parts, late: late.length, lateAmount: late.reduce((n, x) => n + x.left, 0), next, left: parts.reduce((n, x) => n + x.left, 0) };
  });
}
