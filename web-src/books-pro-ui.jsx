/* ---- v6.44 Books in depth — the screens for books-pro.js, inside Books' own tabs (no new layout):
   Reports → Balance sheet · Cash flow · Month by month · Budget vs actual; Money → Fixed assets · Payroll · Recurring ·
   Bank reconciliation · Instalments. Bilingual inline (L(en, ar)) like the rest of Books. Tests: tests/e2e_v744bookspro.py. */
import React, { useMemo, useState } from "react";
import { Plus, Upload, Check } from "lucide-react";
import * as B from "./books.js";
import * as O from "./books-ops.js";
import * as P from "./books-pro.js";
import { L, isAr, useBooks, useTheme, Card, Stat, Section, Money, Badge, Empty, Field, Input, Select, Chips, Sheet, BTN, btnPrimary, fmtDate } from "./books-kit.jsx";

const MONTHS = [["Jan", "يناير"], ["Feb", "فبراير"], ["Mar", "مارس"], ["Apr", "أبريل"], ["May", "مايو"], ["Jun", "يونيو"], ["Jul", "يوليو"], ["Aug", "أغسطس"], ["Sep", "سبتمبر"], ["Oct", "أكتوبر"], ["Nov", "نوفمبر"], ["Dec", "ديسمبر"]];
const mName = (ym) => L(...MONTHS[+ym.slice(5, 7) - 1]);
const aName = (r) => (isAr() ? r.ar : r.en);
const Row = ({ label, v, bold, tone }) => <div className={`flex justify-between px-3 py-2 text-[13.5px] ${bold ? "font-semibold" : ""} ${tone || ""}`}><span>{label}</span><Money v={v} /></div>;
const YearPick = ({ y, setY }) => <div className="flex items-center gap-2 mb-2"><button className={`${BTN} border`} onClick={() => setY(y - 1)} aria-label={L("Previous year", "السنة اللي فاتت")}>‹</button><b className="tabular-nums" dir="ltr">{y}</b><button className={`${BTN} border`} onClick={() => setY(y + 1)} aria-label={L("Next year", "السنة الجاية")}>›</button></div>;

// ---- Reports ----------------------------------------------------------------------------------------------------------
export const PRO_REPORTS = () => [["bs", L("Balance sheet", "الميزانية")], ["cf", L("Cash flow", "التدفقات النقدية")], ["months", L("Month by month", "شهر بشهر")], ["budget", L("Budget vs actual", "الموازنة والفعلي")]];
export function ProReport({ rep, from, to }) {
  const { s, run, today: td } = useBooks();
  const th = useTheme();
  const [y, setY] = useState(+td.slice(0, 4));
  if (rep === "bs") {
    const bs = P.balanceSheet(s.journal, to || td);
    const part = (title, rows, total) => <Section title={title}><Card className="divide-y">{rows.length ? rows.map((r) => <Row key={r.account} label={aName(r)} v={r.amount} />) : <p className={`px-3 py-2 text-[12.5px] ${th.sub}`}>—</p>}<Row label={L("Total", "الإجمالي")} v={total} bold /></Card></Section>;
    return <div data-testid="books-bs">
      <p className={`text-[11.5px] mb-2 ${th.sub}`}>{L("As of", "في")} {fmtDate(bs.asOf)}</p>
      {part(L("Assets — what the company has", "الأصول — اللي الشركة تملكه"), bs.assets, bs.totals.assets)}
      {part(L("Liabilities — what it owes", "الخصوم — اللي عليها"), bs.liabilities, bs.totals.liabilities)}
      {part(L("Equity — what is the owner's", "حقوق الملكية — نصيب المالك"), bs.equity, bs.totals.equity)}
      <p className={`text-[12px] ${bs.balanced ? "text-emerald-600" : "text-red-600"}`}>{bs.balanced ? L("Assets = liabilities + equity — the books balance.", "الأصول = الخصوم + حقوق الملكية — الدفاتر متوازنة.") : L("The balance sheet does not balance — check the journal.", "الميزانية مش متوازنة — راجع القيود.")}</p>
    </div>;
  }
  if (rep === "cf") {
    const cf = P.cashFlow(s.journal, from, to || td);
    const K = { customers: ["Customers", "العملاء"], suppliers: ["Suppliers", "الموردين"], expenses: ["Expenses", "المصروفات"], payroll: ["Payroll", "المرتبات"], taxes: ["Taxes", "الضرايب"], assets: ["Fixed assets", "الأصول الثابتة"], owner: ["Owner", "المالك"], other: ["Other", "أخرى"] };
    return <div data-testid="books-cf"><Card className="divide-y">
      <Row label={L("Cash + bank at the start", "الخزنة + البنك في الأول")} v={cf.opening} bold />
      {P.FLOW_KINDS.filter((k) => cf.flows[k].in || cf.flows[k].out).map((k) => <div key={k} className="flex justify-between px-3 py-2 text-[13.5px]"><span>{L(...K[k])}</span><span className="flex gap-3">{cf.flows[k].in ? <span className="text-emerald-700">+<Money v={cf.flows[k].in} /></span> : null}{cf.flows[k].out ? <span className="text-red-600">−<Money v={cf.flows[k].out} /></span> : null}</span></div>)}
      <Row label={L("Net change", "صافي التغيير")} v={cf.net} bold />
      <Row label={L("Cash + bank at the end", "الخزنة + البنك في الآخر")} v={cf.closing} bold tone="bg-teal-50 text-teal-900" /></Card>
      <p className={`text-[11.5px] mt-2 ${th.sub}`}>{L("Moving money between the cash box and the bank is not counted — it stays in the company.", "تحويل الفلوس بين الخزنة والبنك مش بيتحسب — هي جوه الشركة.")}</p></div>;
  }
  if (rep === "months") {
    const m = P.monthlyPL(s.journal, y);
    return <div data-testid="books-months"><YearPick y={y} setY={setY} />
      <Card className="overflow-x-auto"><table className="w-full text-[12.5px]"><thead><tr className={th.sub}><th className="px-2 py-2 text-start">{L("Month", "الشهر")}</th><th className="px-2 py-2 text-end">{L("Revenue", "الإيراد")}</th><th className="px-2 py-2 text-end">{L("Cost", "التكلفة")}</th><th className="px-2 py-2 text-end">{L("Expenses", "المصروفات")}</th><th className="px-2 py-2 text-end">{L("Net profit", "صافي الربح")}</th></tr></thead>
        <tbody>{m.months.map((x) => <tr key={x.ym} className="border-t"><td className="px-2 py-1.5">{mName(x.ym)}</td>{["revenue", "cogs", "expenses", "netProfit"].map((k) => <td key={k} className="px-2 py-1.5 text-end"><Money v={x[k]} /></td>)}</tr>)}
          <tr className="border-t-2 font-bold"><td className="px-2 py-1.5">{L("Year", "السنة")}</td>{["revenue", "cogs", "expenses", "netProfit"].map((k) => <td key={k} className="px-2 py-1.5 text-end"><Money v={m.total[k]} /></td>)}</tr></tbody></table></Card></div>;
  }
  // budget vs actual + set a budget
  return <BudgetView y={y} setY={setY} />;
}
function BudgetView({ y, setY }) {
  const { s, run } = useBooks();
  const th = useTheme();
  const [edit, setEdit] = useState(null);
  const rows = P.budgetVsActual(s, y);
  const accts = B.ACCOUNTS.filter((a) => a.type === "income" || (a.type === "expense" && a.id !== "5000"));
  return <div data-testid="books-budget"><YearPick y={y} setY={setY} />
    {rows.length ? rows.map((r) => <Card key={r.account} className="p-3 mb-2"><div className="flex items-center gap-2 mb-1"><b className="flex-1 text-[14px]">{aName(r)}</b><button className={`${BTN} border`} onClick={() => setEdit({ account: r.account, months: s.budgets.find((b) => b.year === y && b.account === r.account).months.map((v) => String(v / 100)) })}>{L("Edit", "تعديل")}</button></div>
      <div className="flex justify-between text-[13px]"><span className={th.sub}>{L("Budget", "المتوقع")} <Money v={r.budget} /></span><span className={th.sub}>{L("Actual", "الفعلي")} <Money v={r.actual} /></span><b className={r.variance >= 0 ? "text-emerald-700" : "text-red-600"}>{r.variance >= 0 ? L("better by", "أحسن بـ") : L("worse by", "أسوأ بـ")} <Money v={Math.abs(r.variance)} /></b></div>
      <div className="flex gap-0.5 mt-2 h-10 items-end" aria-hidden="true">{r.months.map((x) => { const top = Math.max(1, ...r.months.map((z) => Math.max(z.budget, z.actual))); return <div key={x.ym} className="flex-1 flex items-end gap-px"><span className="flex-1 bg-slate-300" style={{ height: (x.budget / top) * 40 }} /><span className={`flex-1 ${x.variance >= 0 ? "bg-emerald-500" : "bg-red-500"}`} style={{ height: (x.actual / top) * 40 }} /></div>; })}</div></Card>)
      : <Empty title={L("No budget for this year yet", "مفيش موازنة للسنة دي لسه")} hint={L("Set what you expect each month — sales, salaries, expenses — and see where you are ahead or behind.", "حط اللي متوقعه كل شهر — مبيعات، مرتبات، مصروفات — وشوف إنت قدام ولا ورا.")} />}
    <button className={`${btnPrimary} w-full mt-1`} onClick={() => setEdit({ account: accts[0].id, months: Array(12).fill("") })} data-testid="budget-new">{L("+ Budget for an account", "+ موازنة لحساب")}</button>
    {edit ? <Sheet title={L("Budget", "الموازنة")} onClose={() => setEdit(null)} testid="budget-form" footer={<button className={`${btnPrimary} w-full`} data-testid="budget-save" onClick={async () => { const r = await run((st) => P.setBudget(st, { year: y, account: edit.account, months: edit.months.map((v) => B.toMinor(v || 0) || 0) }), L("Budget saved", "الموازنة اتحفظت")); if (r) setEdit(null); }}>{L("Save", "حفظ")}</button>}>
      <Field label={L("Account", "الحساب")}><Select value={edit.account} onChange={(v) => setEdit({ ...edit, account: v })}>{accts.map((a) => <option key={a.id} value={a.id}>{a.id} {aName(a)}</option>)}</Select></Field>
      <div className="grid grid-cols-3 gap-2 mt-3">{edit.months.map((v, i) => <Field key={i} label={L(...MONTHS[i])}><Input value={v} inputMode="decimal" onChange={(x) => setEdit({ ...edit, months: edit.months.map((z, j) => (j === i ? x : z)) })} data-testid={"budget-m" + i} /></Field>)}</div>
      <button className={`${BTN} border mt-2`} onClick={() => setEdit({ ...edit, months: Array(12).fill(edit.months[0]) })}>{L("Same every month", "نفس الرقم كل شهر")}</button>
    </Sheet> : null}
  </div>;
}

// ---- Money: the new views ---------------------------------------------------------------------------------------------
export const PRO_MONEY = () => [["assets", L("Fixed assets", "الأصول الثابتة")], ["payroll", L("Payroll", "المرتبات")], ["recurring", L("Recurring", "فواتير متكررة")], ["bank", L("Bank reconciliation", "تسوية البنك")], ["instal", L("Instalments", "التقسيط")]];
export function ProMoney({ view }) {
  return view === "assets" ? <AssetsView /> : view === "payroll" ? <PayrollView /> : view === "recurring" ? <RecurringView /> : view === "bank" ? <BankView /> : <InstalView />;
}
function AssetsView() {
  const { s, run, today: td } = useBooks();
  const th = useTheme();
  const [f, setF] = useState(null);
  const list = s.assets || [], ym = td.slice(0, 7);
  const tot = list.reduce((t, a) => { const b = P.bookValue(a, ym); return { cost: t.cost + b.cost, dep: t.dep + b.depreciated, value: t.value + b.value }; }, { cost: 0, dep: 0, value: 0 });
  const pending = list.some((a) => { const done = new Set((s.depRuns || []).filter((r) => r.asset === a.id).map((r) => r.ym)); for (let i = 0; i < a.life; i++) { const m = P.addMonths(a.date.slice(0, 8) + "01", i + 1).slice(0, 7); if (m > ym) break; if (!done.has(m)) return true; } return false; });
  return <div data-testid="books-assets">
    <div className="grid grid-cols-3 gap-2 mb-3"><Stat label={L("Cost", "التكلفة")} value={<Money v={tot.cost} />} /><Stat label={L("Depreciated", "الإهلاك")} value={<Money v={tot.dep} />} /><Stat label={L("Book value", "القيمة الدفترية")} value={<Money v={tot.value} />} /></div>
    <div className="grid grid-cols-2 gap-2 mb-3"><button className={btnPrimary} onClick={() => setF({ name: "", date: td, cost: "", life: "60", salvage: "", paidBy: "bank" })} data-testid="asset-new">{L("+ Asset", "+ أصل")}</button>
      <button className={`${BTN} border`} disabled={!pending} onClick={() => run((st) => P.runDepreciation(st, ym), L("Depreciation posted up to this month", "الإهلاك اترحّل لحد الشهر ده"))} data-testid="asset-dep">{L("Post depreciation", "رحّل الإهلاك")}</button></div>
    {list.length ? <Card className="divide-y">{list.map((a) => { const b = P.bookValue(a, ym); return <div key={a.id} className="px-3 py-2.5"><div className="flex justify-between text-[13.5px]"><b>{a.name}</b><Money v={b.value} bold /></div>
      <p className={`text-[11.5px] ${th.sub}`}>{a.number} · {fmtDate(a.date)} · {L("cost", "التكلفة")} <Money v={a.cost} /> · {a.life} {L("months", "شهر")} · {L("a month", "في الشهر")} <Money v={P.depFor(a, 0)} /></p></div>; })}</Card>
      : <Empty title={L("No fixed assets yet", "مفيش أصول ثابتة لسه")} hint={L("Cars, machines, furniture, computers: their cost is spread over their useful life (depreciation).", "عربيات، مكن، عفش، كمبيوترات: تكلفتها بتتوزع على عمرها (الإهلاك).")} />}
    {f ? <Sheet title={L("New fixed asset", "أصل ثابت جديد")} onClose={() => setF(null)} testid="asset-form" footer={<button className={`${btnPrimary} w-full`} data-testid="asset-save" onClick={async () => { const r = await run((st) => P.addAsset(st, { name: f.name, date: f.date, cost: B.toMinor(f.cost), life: parseInt(f.life), salvage: B.toMinor(f.salvage || 0) || 0, paidBy: f.paidBy }), L("Asset saved", "الأصل اتسجل")); if (r) setF(null); }}>{L("Save", "حفظ")}</button>}>
      <div className="space-y-3"><Field label={L("What is it", "إيه هو")}><Input value={f.name} onChange={(v) => setF({ ...f, name: v })} data-testid="asset-name" /></Field>
        <div className="grid grid-cols-2 gap-2"><Field label={L("Bought on", "اتشرى يوم")}><Input type="date" value={f.date} onChange={(v) => setF({ ...f, date: v })} /></Field><Field label={L("Cost", "التكلفة")}><Input value={f.cost} inputMode="decimal" onChange={(v) => setF({ ...f, cost: v })} data-testid="asset-cost" /></Field></div>
        <div className="grid grid-cols-2 gap-2"><Field label={L("Useful life (months)", "العمر الإنتاجي (شهور)")}><Input value={f.life} inputMode="numeric" onChange={(v) => setF({ ...f, life: v })} data-testid="asset-life" /></Field><Field label={L("Worth at the end (salvage)", "قيمته في الآخر (الخردة)")}><Input value={f.salvage} inputMode="decimal" onChange={(v) => setF({ ...f, salvage: v })} /></Field></div>
        <Field label={L("Paid by", "اتدفع")}><Select value={f.paidBy} onChange={(v) => setF({ ...f, paidBy: v })}><option value="bank">{L("Bank", "بنك")}</option><option value="cash">{L("Cash", "نقدي")}</option><option value="payable">{L("Owed to the supplier", "على الحساب للمورد")}</option></Select></Field></div>
    </Sheet> : null}
  </div>;
}
function PayrollView() {
  const { s, run, today: td } = useBooks();
  const th = useTheme();
  const [f, setF] = useState(null), [ym, setYm] = useState(td.slice(0, 7)), [method, setMethod] = useState("bank"), [ded, setDed] = useState({});
  const emps = (s.employees || []).filter((e) => e.active), done = (s.payslips || []).filter((p) => p.ym === ym);
  const slips = done.length ? done : emps.map((e) => P.payslipFor(e, { deductions: B.toMinor(ded[e.id] || 0) || 0 }));
  const T = slips.reduce((t, p) => ({ gross: t.gross + p.gross, net: t.net + p.net, si: t.si + p.siEmp + p.siEr, tax: t.tax + p.tax }), { gross: 0, net: 0, si: 0, tax: 0 });
  return <div data-testid="books-payroll">
    <div className="flex gap-2 mb-2 items-end"><Field label={L("Month", "الشهر")}><Input type="month" value={ym} onChange={setYm} /></Field><button className={btnPrimary} onClick={() => setF({ name: "", gross: "", insurable: "", tax: "", employeeBp: "11", employerBp: "18.75" })} data-testid="emp-new">{L("+ Employee", "+ موظف")}</button></div>
    {emps.length ? <>
      <Card className="overflow-x-auto mb-2"><table className="w-full text-[12.5px]"><thead><tr className={th.sub}><th className="px-2 py-2 text-start">{L("Name", "الاسم")}</th><th className="px-2 py-2 text-end">{L("Gross", "الإجمالي")}</th><th className="px-2 py-2 text-end">{L("Insurance", "تأمينات")}</th><th className="px-2 py-2 text-end">{L("Tax", "ضريبة")}</th><th className="px-2 py-2 text-end">{L("Deductions", "خصومات")}</th><th className="px-2 py-2 text-end">{L("Net", "الصافي")}</th></tr></thead>
        <tbody>{slips.map((p) => <tr key={p.employee} className="border-t" data-testid="payslip"><td className="px-2 py-1.5">{p.name}</td><td className="px-2 py-1.5 text-end"><Money v={p.gross} /></td><td className="px-2 py-1.5 text-end"><Money v={p.siEmp} /></td><td className="px-2 py-1.5 text-end"><Money v={p.tax} /></td>
          <td className="px-2 py-1 text-end">{done.length ? <Money v={p.deductions} /> : <input value={ded[p.employee] || ""} onChange={(e) => setDed({ ...ded, [p.employee]: e.target.value })} inputMode="decimal" className="w-20 rounded border px-1.5 py-1 text-end" placeholder="0" data-testid="payslip-ded" />}</td>
          <td className="px-2 py-1.5 text-end font-semibold"><Money v={p.net} /></td></tr>)}
          <tr className="border-t-2 font-bold"><td className="px-2 py-1.5">{L("Total", "الإجمالي")}</td><td className="px-2 py-1.5 text-end"><Money v={T.gross} /></td><td className="px-2 py-1.5 text-end"><Money v={T.si} /></td><td className="px-2 py-1.5 text-end"><Money v={T.tax} /></td><td /><td className="px-2 py-1.5 text-end" data-testid="payroll-net"><Money v={T.net} /></td></tr></tbody></table></Card>
      {done.length ? <p className="text-[12.5px] text-emerald-700 flex items-center gap-1"><Check size={14} />{L("This month's payroll is done", "مرتبات الشهر ده اتعملت")} · {done[0].ref}</p>
        : <div className="flex gap-2"><Select value={method} onChange={setMethod}><option value="bank">{L("Pay from the bank", "ادفع من البنك")}</option><option value="cash">{L("Pay in cash", "ادفع كاش")}</option><option value="payable">{L("Owe it for now", "خليها مستحقة")}</option></Select>
          <button className={btnPrimary} data-testid="payroll-run" onClick={() => run((st) => P.runPayroll(st, { ym, method, deductions: Object.fromEntries(Object.entries(ded).map(([k, v]) => [k, B.toMinor(v || 0) || 0])) }), L("Payroll posted", "المرتبات اترحّلت"))}>{L("Run the payroll", "اعمل المرتبات")}</button></div>}
      <p className={`text-[11px] mt-2 ${th.sub}`}>{L("Insurance: employee 11 % and employer 18.75 % of the insurable wage by default — confirm the rates and limits in force. Payroll tax is what you type per employee.", "التأمينات: الموظف 11٪ وصاحب العمل 18.75٪ من الأجر التأميني افتراضيًا — اتأكد من النسب والحدود السارية. ضريبة كسب العمل هي اللي بتكتبها لكل موظف.")}</p>
    </> : <Empty title={L("No employees yet", "مفيش موظفين لسه")} hint={L("Add each one with the monthly gross; the payroll works out insurance and the net and posts one entry.", "ضيف كل واحد بإجمالي مرتبه؛ المرتبات بتحسب التأمينات والصافي وبترحّل قيد واحد.")} />}
    {f ? <Sheet title={L("Employee", "موظف")} onClose={() => setF(null)} testid="emp-form" footer={<button className={`${btnPrimary} w-full`} data-testid="emp-save" onClick={async () => { const bp = (v) => Math.round(parseFloat(v || 0) * 100); const r = await run((st) => P.saveEmployee(st, { name: f.name, gross: B.toMinor(f.gross), insurable: f.insurable ? B.toMinor(f.insurable) : undefined, tax: B.toMinor(f.tax || 0) || 0, employeeBp: bp(f.employeeBp), employerBp: bp(f.employerBp) }), L("Saved", "اتحفظ")); if (r) setF(null); }}>{L("Save", "حفظ")}</button>}>
      <div className="space-y-3"><Field label={L("Name", "الاسم")}><Input value={f.name} onChange={(v) => setF({ ...f, name: v })} data-testid="emp-name" /></Field>
        <div className="grid grid-cols-2 gap-2"><Field label={L("Monthly gross", "إجمالي المرتب")}><Input value={f.gross} inputMode="decimal" onChange={(v) => setF({ ...f, gross: v })} data-testid="emp-gross" /></Field><Field label={L("Insurable wage (empty = gross)", "الأجر التأميني (فاضي = الإجمالي)")}><Input value={f.insurable} inputMode="decimal" onChange={(v) => setF({ ...f, insurable: v })} /></Field></div>
        <div className="grid grid-cols-3 gap-2"><Field label={L("Employee %", "الموظف %")}><Input value={f.employeeBp} inputMode="decimal" onChange={(v) => setF({ ...f, employeeBp: v })} /></Field><Field label={L("Employer %", "صاحب العمل %")}><Input value={f.employerBp} inputMode="decimal" onChange={(v) => setF({ ...f, employerBp: v })} /></Field><Field label={L("Tax a month", "الضريبة شهريًا")}><Input value={f.tax} inputMode="decimal" onChange={(v) => setF({ ...f, tax: v })} /></Field></div></div>
    </Sheet> : null}
  </div>;
}
function RecurringView() {
  const { s, run, today: td } = useBooks();
  const th = useTheme();
  const [f, setF] = useState(null);
  const list = s.recurring || [], due = list.filter((r) => r.active && r.next <= td && (!r.until || r.next <= r.until)).length;
  const cname = (id) => (s.customers.find((c) => c.id === id) || {}).name || "—";
  const total = (r) => B.docTotals({ lines: r.lines }, s.tax).total;
  return <div data-testid="books-recurring">
    <div className="grid grid-cols-2 gap-2 mb-3"><button className={btnPrimary} onClick={() => setF({ customer: "", item: "", qty: "1", price: "", every: "month", next: td, post: false })} data-testid="rec-new">{L("+ Recurring invoice", "+ فاتورة متكررة")}</button>
      <button className={`${BTN} border`} disabled={!due} onClick={() => run((st) => P.runRecurring(st, td), L("Invoices made", "الفواتير اتعملت"))} data-testid="rec-run">{L("Make the due ones", "اعمل المستحقة")}{due ? ` (${due})` : ""}</button></div>
    {list.length ? <Card className="divide-y">{list.map((r) => <div key={r.id} className="px-3 py-2.5 flex items-center gap-2"><div className="flex-1 min-w-0"><p className="text-[13.5px] font-medium truncate">{cname(r.customer)}</p><p className={`text-[11.5px] ${th.sub}`}>{L({ week: "Every week", month: "Every month", year: "Every year" }[r.every], { week: "كل أسبوع", month: "كل شهر", year: "كل سنة" }[r.every])} · {L("next", "الجاية")} {fmtDate(r.next)} · {r.made} {L("made", "اتعملت")}{r.post ? " · " + L("posted at once", "بتترحّل على طول") : ""}</p></div><Money v={total(r)} bold /></div>)}</Card>
      : <Empty title={L("No recurring invoices", "مفيش فواتير متكررة")} hint={L("Rent, maintenance contracts, subscriptions: made by themselves on their dates.", "إيجار، عقود صيانة، اشتراكات: بتتعمل لوحدها في مواعيدها.")} />}
    {f ? <Sheet title={L("Recurring invoice", "فاتورة متكررة")} onClose={() => setF(null)} testid="rec-form" footer={<button className={`${btnPrimary} w-full`} data-testid="rec-save" disabled={!f.customer || !(B.toMinor(f.price) > 0)} onClick={async () => { const it = s.items.find((x) => x.id === f.item); const r = await run((st) => P.saveRecurring(st, { customer: f.customer, every: f.every, next: f.next, post: f.post, lines: [{ item: it ? it.id : "", desc: it ? it.name : f.desc || L("Service", "خدمة"), qty: Number(f.qty) || 1, price: B.toMinor(f.price), vat: "S" }] }), L("Saved", "اتحفظ")); if (r) setF(null); }}>{L("Save", "حفظ")}</button>}>
      <div className="space-y-3"><Field label={L("Customer", "العميل")}><Select value={f.customer} onChange={(v) => setF({ ...f, customer: v })} data-testid="rec-customer"><option value="">{L("— choose —", "— اختار —")}</option>{s.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label={L("Item or service", "صنف أو خدمة")}><Select value={f.item} onChange={(v) => { const it = s.items.find((x) => x.id === v); setF({ ...f, item: v, price: it && it.price ? String(it.price / 100) : f.price }); }}><option value="">{L("— a service (type below) —", "— خدمة (اكتبها تحت) —")}</option>{s.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select></Field>
        {!f.item ? <Field label={L("Description", "الوصف")}><Input value={f.desc} onChange={(v) => setF({ ...f, desc: v })} /></Field> : null}
        <div className="grid grid-cols-2 gap-2"><Field label={L("Qty", "الكمية")}><Input value={f.qty} inputMode="decimal" onChange={(v) => setF({ ...f, qty: v })} /></Field><Field label={L("Price (before VAT)", "السعر (قبل الضريبة)")}><Input value={f.price} inputMode="decimal" onChange={(v) => setF({ ...f, price: v })} data-testid="rec-price" /></Field></div>
        <div className="grid grid-cols-2 gap-2"><Field label={L("How often", "كل قد إيه")}><Select value={f.every} onChange={(v) => setF({ ...f, every: v })}><option value="week">{L("Every week", "كل أسبوع")}</option><option value="month">{L("Every month", "كل شهر")}</option><option value="year">{L("Every year", "كل سنة")}</option></Select></Field><Field label={L("First date", "أول تاريخ")}><Input type="date" value={f.next} onChange={(v) => setF({ ...f, next: v })} /></Field></div>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={f.post} onChange={(e) => setF({ ...f, post: e.target.checked })} />{L("Post them at once (else they wait as drafts)", "رحّلها على طول (وإلا تستنى مسودات)")}</label></div>
    </Sheet> : null}
  </div>;
}
function BankView() {
  const { s, today: td } = useBooks();
  const th = useTheme();
  const [lines, setLines] = useState(null);
  const res = useMemo(() => (lines ? P.reconcile(s.journal, lines) : null), [lines, s]);
  const pick = (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; const r = new FileReader(); r.onload = () => setLines(P.parseStatement(String(r.result || ""))); r.readAsText(f); };
  return <div data-testid="books-bank">
    <p className={`text-[12.5px] mb-2 ${th.sub}`}>{L("Download your bank statement as CSV (date, description, amount) and open it here: each line is matched to your books by amount and date.", "نزّل كشف حساب البنك CSV (تاريخ، بيان، مبلغ) وافتحه هنا: كل سطر بيتطابق مع دفاترك بالمبلغ والتاريخ.")}</p>
    <label className={`${btnPrimary} flex items-center justify-center gap-1.5 cursor-pointer mb-3`} data-testid="bank-pick"><Upload size={15} />{L("Open the bank statement (CSV)", "افتح كشف البنك (CSV)")}<input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={pick} data-testid="bank-file" /></label>
    {res ? <>
      <div className="grid grid-cols-3 gap-2 mb-3"><Stat label={L("Matched", "متطابق")} value={res.matched.length} tone="good" /><Stat label={L("Only at the bank", "في البنك بس")} value={res.bankOnly.length} tone={res.bankOnly.length ? "warn" : null} /><Stat label={L("Only in the books", "في الدفاتر بس")} value={res.booksOnly.length} tone={res.booksOnly.length ? "warn" : null} /></div>
      {res.bankOnly.length ? <Section title={L("At the bank, not in your books — record them (charges, interest, transfers)", "في البنك ومش في دفاترك — سجّلها (مصاريف بنكية، فوايد، تحويلات)")}><Card className="divide-y" testid="bank-only">{res.bankOnly.map((l) => <div key={l.i} className="flex justify-between px-3 py-2 text-[13px]"><span>{fmtDate(l.date)} · {l.desc}</span><Money v={l.amount} /></div>)}</Card></Section> : null}
      {res.booksOnly.length ? <Section title={L("In your books, not at the bank yet — cheques not cleared, or a mistake", "في دفاترك ومش في البنك لسه — شيكات ماتصرفتش، أو غلطة")}><Card className="divide-y">{res.booksOnly.map((m) => <div key={m.k} className="flex justify-between px-3 py-2 text-[13px]"><span>{fmtDate(m.date)} · {m.ref}</span><Money v={m.amount} /></div>)}</Card></Section> : null}
      <p className={`text-[12.5px] ${res.difference ? "text-amber-700" : "text-emerald-700"}`} data-testid="bank-diff">{res.difference ? L("Difference between the statement and the books:", "الفرق بين الكشف والدفاتر:") : L("The statement and the books agree.", "الكشف والدفاتر متطابقين.")} {res.difference ? <Money v={res.difference} bold /> : null}</p>
    </> : null}
  </div>;
}
function InstalView() {
  const { s, run, today: td } = useBooks();
  const th = useTheme();
  const [f, setF] = useState(null);
  const plans = P.instalmentStatus(s, td);
  const open = O.openInvoices(s, td).filter((o) => o.open > 0 && !(s.instalments || []).some((p) => p.invoice === o.number));
  const cname = (id) => (s.customers.find((c) => c.id === id) || {}).name || "—";
  const ST = { paid: ["Paid", "اتدفع", "green"], late: ["Late", "متأخر", "red"], today: ["Today", "النهارده", "amber"], coming: ["Coming", "جاي", "gray"] };
  return <div data-testid="books-instal">
    <button className={`${btnPrimary} w-full mb-3`} disabled={!open.length} onClick={() => setF({ invoice: open[0].number, down: "", count: "6", first: P.addMonths(td, 1) })} data-testid="instal-new">{L("+ Instalment plan for an invoice", "+ تقسيط فاتورة")}</button>
    {plans.length ? plans.map((p) => <Card key={p.id} className="p-3 mb-2" testid="instal-plan"><div className="flex items-center gap-2"><b className="flex-1 text-[14px]">{p.invoice} · {cname(p.customer)}</b>{p.late ? <Badge tone="red">{L(`${p.late} late`, `${p.late} متأخر`)}</Badge> : null}<Money v={p.left} bold /></div>
      <div className="mt-1.5 divide-y">{p.parts.map((x, i) => <div key={i} className="flex items-center gap-2 py-1 text-[12.5px]"><span className="w-24">{fmtDate(x.due)}</span><Badge tone={ST[x.state][2]}>{L(ST[x.state][0], ST[x.state][1])}</Badge><span className="flex-1" /><Money v={x.amount} />{x.paid && x.left ? <span className={th.sub}>({L("left", "باقي")} <Money v={x.left} />)</span> : null}</div>)}</div></Card>)
      : <Empty title={L("No instalment plans", "مفيش خطط تقسيط")} hint={L("Split a big invoice into a down payment and monthly parts; Attune shows what is late from the receipts.", "قسّم فاتورة كبيرة لمقدّم وأقساط شهرية؛ Attune بيوريك المتأخر من التحصيلات.")} />}
    {f ? <Sheet title={L("Instalment plan", "خطة تقسيط")} onClose={() => setF(null)} testid="instal-form" footer={<button className={`${btnPrimary} w-full`} data-testid="instal-save" onClick={async () => { const r = await run((st) => P.planInstalments(st, { invoice: f.invoice, down: B.toMinor(f.down || 0) || 0, count: parseInt(f.count), first: f.first }), L("Plan saved", "خطة التقسيط اتحفظت")); if (r) setF(null); }}>{L("Save", "حفظ")}</button>}>
      <div className="space-y-3"><Field label={L("Invoice", "الفاتورة")}><Select value={f.invoice} onChange={(v) => setF({ ...f, invoice: v })}>{open.map((o) => <option key={o.number} value={o.number}>{o.number} · {cname(o.customer)} · {B.fmt(o.open)}</option>)}</Select></Field>
        <div className="grid grid-cols-3 gap-2"><Field label={L("Down payment", "المقدّم")}><Input value={f.down} inputMode="decimal" onChange={(v) => setF({ ...f, down: v })} /></Field><Field label={L("Instalments", "عدد الأقساط")}><Input value={f.count} inputMode="numeric" onChange={(v) => setF({ ...f, count: v })} data-testid="instal-count" /></Field><Field label={L("First on", "أول قسط")}><Input type="date" value={f.first} onChange={(v) => setF({ ...f, first: v })} /></Field></div></div>
    </Sheet> : null}
  </div>;
}
