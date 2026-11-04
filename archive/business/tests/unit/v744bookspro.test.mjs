// v6.44 Books in depth: balance sheet, cash flow, monthly P&L + budgets, fixed assets + depreciation, payroll, recurring
// invoices, bank reconciliation, instalments — on the sample shop's real books.
import * as B from "../../web-src/books.js";
import * as O from "../../web-src/books-ops.js";
import * as P from "../../web-src/books-pro.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const T = "2026-10-20";
let s = O.sampleShop(O.EMPTY(), T);
// ---- 1. balance sheet
let bs = P.balanceSheet(s.journal, T);
ok(bs.balanced && bs.totals.assets > 0, "the sample shop's balance sheet balances: assets " + B.fmt(bs.totals.assets) + " = liabilities " + B.fmt(bs.totals.liabilities) + " + equity " + B.fmt(bs.totals.equity));
ok(bs.equity.some((r) => r.account === "profit"), "this period's profit is in equity until it is closed");
// ---- 2. cash flow
const cf = P.cashFlow(s.journal, "", T), cp = B.cashPosition(s.journal, T);
ok(cf.closing === cp.total && cf.flows.customers.in > 0, "cash flow: closing = cash + bank (" + B.fmt(cf.closing) + "); money in from customers " + B.fmt(cf.flows.customers.in));
// ---- 4. fixed assets
let r = P.addAsset(s, { name: "Delivery van", date: "2026-01-15", cost: B.toMinor(360000), life: 60, salvage: B.toMinor(60000), paidBy: "bank" }); s = r.state;
ok(r.number === "FA-2026-0001", "a van bought: FA-2026-0001");
r = P.runDepreciation(s, "2026-10"); s = r.state;
ok(r.posted === 9 && r.total === B.toMinor(45000), "9 months (Feb–Oct) × 5,000 = 45,000 depreciation posted");
ok(P.runDepreciation(s, "2026-10").posted === 0, "run again: nothing posted twice");
ok(P.bookValue(s.assets[0], "2026-10").value === B.toMinor(315000), "book value 315,000 at the end of October");
const a2 = { cost: 1000, salvage: 0, life: 3, date: "2026-01-01" }; ok(P.depFor(a2, 0) + P.depFor(a2, 1) + P.depFor(a2, 2) === 1000, "rounding: the last month takes the rest (333 + 333 + 334)");
ok(P.balanceSheet(s.journal, T).balanced, "still balanced after the asset and its depreciation");
// ---- 5. payroll
r = P.saveEmployee(s, { name: "Mona", gross: B.toMinor(10000), tax: B.toMinor(500) }); s = r.state; const mona = r.id;
r = P.saveEmployee(s, { name: "Karim", gross: B.toMinor(8000), insurable: B.toMinor(6000) }); s = r.state; const karim = r.id;
const slip = P.payslipFor(s.employees.find((e) => e.id === mona));
ok(slip.siEmp === B.toMinor(1100) && slip.siEr === B.toMinor(1875) && slip.net === B.toMinor(8400), "Mona: 10,000 − 11 % insurance 1,100 − tax 500 = 8,400 (employer pays 1,875 more)");
r = P.runPayroll(s, { ym: "2026-10", method: "bank", deductions: { [karim]: B.toMinor(1000) } }); s = r.state;
ok(r.totals.net === B.toMinor(8400) + B.toMinor(8000 - 660 - 1000) && s.payslips.length === 2, "October payroll: two payslips; Karim's insurance on 6,000 and a 1,000 advance off");
let dup = ""; try { P.runPayroll(s, { ym: "2026-10" }); } catch (e) { dup = e.message; }
ok(/already done/.test(dup), "a month's payroll runs once");
ok(P.balanceSheet(s.journal, T).balanced, "still balanced after the payroll");
ok(B.profitAndLoss(s.journal, "2026-10-01", "2026-10-31").expenses >= B.toMinor(18000 + 1875 + 1125 + 5000 - 1000), "P&L counts salaries, employer insurance and depreciation");
// ---- 3. months and budgets
const mp = P.monthlyPL(s.journal, 2026);
ok(mp.months.length === 12 && mp.total.netProfit === mp.months.reduce((n, m) => n + m.netProfit, 0), "12 months of P&L add up to the year");
s = P.setBudget(s, { year: 2026, account: "6200", months: Array(12).fill(B.toMinor(15000)) });
const bva = P.budgetVsActual(s, 2026)[0];
ok(bva.months[9].actual === B.toMinor(18000) && bva.months[9].variance === -B.toMinor(3000), "salaries budget 15,000 vs actual 18,000 in October → 3,000 over");
// ---- 6. recurring invoices
const cust = s.customers[0].id, item = s.items[0];
r = P.saveRecurring(s, { customer: cust, every: "month", next: "2026-08-01", lines: [{ item: item.id, desc: item.name, qty: 1, price: item.price || 10000, vat: "S" }], post: true }); s = r.state;
r = P.runRecurring(s, T); s = r.state;
ok(r.made.length === 3 && r.made.every((x) => x.number), "a monthly invoice from 1 Aug → Aug, Sep, Oct made and posted: " + r.made.map((x) => x.number).join(", "));
ok(P.runRecurring(s, T).made.length === 0 && s.recurring[0].next === "2026-11-01", "nothing twice; the next one is 1 November");
// ---- 7. bank reconciliation
const bankMoves = s.journal.filter((e) => e.lines.some((l) => l.account === "1100")).slice(-3);
const amtOf = (e) => e.lines.filter((l) => l.account === "1100").reduce((n, l) => n + l.debit - l.credit, 0);
const csv = "Date,Description,Amount\n" + bankMoves.map((e) => `${e.date.slice(8, 10)}/${e.date.slice(5, 7)}/${e.date.slice(0, 4)},${e.ref},${(amtOf(e) / 100).toFixed(2)}`).join("\n") + "\n20/10/2026,Bank charges,-35.00";
const lines = P.parseStatement(csv);
ok(lines.length === 4 && lines[3].amount === -3500, "the bank's CSV is read (DD/MM/YYYY, signed amounts): " + lines.length + " lines");
const rc = P.reconcile(s.journal, lines);
ok(rc.matched.length === 3 && rc.bankOnly.length === 1 && rc.bankOnly[0].desc === "Bank charges", "3 matched to the books; the bank charge is only on the statement (to record)");
// ---- 8. instalments
const sale = O.saveDraft(s, { type: "invoice", customer: cust, date: "2026-09-01", lines: [{ item: item.id, desc: item.name, qty: 1, price: B.toMinor(12000), vat: "E" }] }); s = sale.state;
const posted = O.post(s, sale.id); s = posted.state;
r = P.planInstalments(s, { invoice: posted.number, down: B.toMinor(3000), count: 3, first: "2026-10-01" }); s = r.state;
ok(r.schedule.length === 4 && r.schedule[1].amount === B.toMinor(3000), "12,000: 3,000 down + 3 × 3,000 from 1 October");
s = O.receive(s, { customer: cust, date: "2026-09-02", amount: B.toMinor(3000), allocations: [{ doc: posted.number, amount: B.toMinor(3000) }] }).state;
let st = P.instalmentStatus(s, T).find((p) => p.invoice === posted.number);
ok(st.parts[0].state === "paid" && st.parts[1].state === "late" && st.late === 1 && st.lateAmount === B.toMinor(3000) && st.next.due === "2026-10-01", "down payment paid; October's part is late (3,000)");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
