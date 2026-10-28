/* ---- Books → Money: receipts, supplier payments, expenses, who owes what (ageing), statements ------------------ */
import React, { useState, useMemo, useRef, useEffect } from "react";
import { Plus, Camera, Share2 } from "lucide-react";
import * as B from "./books.js";
import * as O from "./books-ops.js";
import { L, isAr, useBooks, useTheme, Card, Stat, Section, Money, Badge, Empty, Field, Input, Select, Chips, Sheet, BTN, btnPrimary, POS, NEG, today, fmtDate } from "./books-kit.jsx";
import { shareStatement, reminderText } from "./books-docs.jsx";
import { ProMoney, PRO_MONEY } from "./books-pro-ui.jsx";   // v6.44: fixed assets, payroll, recurring, bank reconciliation, instalments

const METHODS = [["cash", "Cash", "نقدي"], ["bank", "Bank / transfer", "بنك / تحويل"]];
const methodOpts = () => METHODS.map(([k, en, ar]) => <option key={k} value={k}>{L(en, ar)}</option>);

// ---- money received from a customer ------------------------------------------------------------------------------
export function ReceiptForm({ customer: c0, onClose }) {
  const { s, run, today: td } = useBooks();
  const th = useTheme();
  const [customer, setCustomer] = useState(c0 || "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(td);
  const [wht, setWht] = useState({});                      // withheld per invoice number (typed in EGP)
  const open = useMemo(() => O.openInvoices(s, td).filter((o) => o.customer === customer && o.open > 0), [s, customer, td]);
  const cash = B.toMinor(amount) || 0;
  const withheld = (n) => B.toMinor(wht[n]) || 0;
  // spread the cash AND the withheld part over the oldest invoices first: each invoice takes cash + withholding up to what is open
  const plan = useMemo(() => {
    let left = cash; const rows = [];
    for (const o of [...open].sort((a, b) => (a.due < b.due ? -1 : 1))) {
      const w = Math.min(withheld(o.number), o.open);
      const take = Math.min(left, o.open - w);
      if (take <= 0 && w <= 0) continue;
      rows.push({ doc: o.number, amount: Math.max(0, take), wht: w }); left -= Math.max(0, take);
    }
    return { rows, onAccount: left };
  }, [open, cash, wht]);
  const save = async () => {
    const r = await run((st) => O.receive(st, { customer, date, method, amount: cash, allocations: plan.rows }), L("Receipt recorded", "التحصيل اتسجل"));
    if (r) onClose();
  };
  return (
    <Sheet title={L("Money received", "تحصيل من عميل")} onClose={onClose} testid="receipt-form" footer={<button onClick={save} className={`${btnPrimary} w-full`} disabled={!customer || !(cash > 0)} data-testid="receipt-save">{L("Save receipt", "احفظ التحصيل")}</button>}>
      <div className="space-y-3">
        <Field label={L("Customer", "العميل")}><Select value={customer} onChange={setCustomer} data-testid="receipt-customer"><option value="">{L("— choose —", "— اختار —")}</option>{s.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={L("Amount received", "المبلغ المحصّل")}><Input value={amount} onChange={setAmount} inputMode="decimal" data-testid="receipt-amount" /></Field>
          <Field label={L("Date", "التاريخ")}><Input type="date" value={date} onChange={setDate} /></Field>
        </div>
        <Field label={L("How was it paid", "طريقة الدفع")}><Select value={method} onChange={setMethod}>{methodOpts()}</Select></Field>
        {customer ? (open.length ? (
          <Section title={L("Settles these invoices (oldest first)", "بيسدّد الفواتير دي (الأقدم الأول)")}>
            <Card className="divide-y" testid="receipt-plan">{open.map((o) => { const row = plan.rows.find((r) => r.doc === o.number); return (
              <div key={o.number} className="px-3.5 py-3 text-[13.5px]">
                <div className="flex justify-between gap-3"><span className="font-extrabold">{o.number}</span><span className={th.sub}>{L("open", "متبقي")} <Money v={o.open} /></span></div>
                <div className="flex items-center gap-2 mt-1.5"><span className={`text-[12px] ${th.sub} flex-1 min-w-0`}>{row ? <>{L("pays", "يسدّد")} <Money v={row.amount} />{row.wht ? <> + {L("withheld", "منبع")} <Money v={row.wht} /></> : null}</> : L("not covered", "مش متغطية")}</span>
                  <input value={wht[o.number] || ""} onChange={(e) => setWht({ ...wht, [o.number]: e.target.value })} placeholder={L("withheld by customer", "المخصوم من المنبع")} inputMode="decimal" className={`w-36 shrink-0 min-h-[44px] rounded-[12px] border px-2.5 py-1.5 text-[13px] font-semibold focus:outline-none ${th.input}`} /></div>
              </div>); })}</Card>
            {plan.onAccount > 0 ? <p className={`text-[12.5px] mt-2 ${th.sub}`}>{L("Left on account (customer deposit):", "المتبقي كدفعة مقدمة:")} <Money v={plan.onAccount} bold /></p> : null}
          </Section>) : <p className={`text-[12.5px] leading-relaxed ${th.sub}`}>{L("This customer has no open invoices — the money will be kept on account.", "العميل ده مالوش فواتير مفتوحة — المبلغ هيتسجل كدفعة مقدمة.")}</p>) : null}
      </div>
    </Sheet>
  );
}

// ---- money paid to a supplier -------------------------------------------------------------------------------------------
export function SupplierPayForm({ supplier: s0, onClose }) {
  const { s, run, today: td } = useBooks();
  const [supplier, setSupplier] = useState(s0 || "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(td);
  const open = O.billsOpen(s).filter((b) => b.supplier === supplier && b.open > 0);
  const save = async () => { const r = await run((st) => O.paySupplier(st, { supplier, date, method, amount: B.toMinor(amount) || 0 }), L("Payment recorded", "الدفع اتسجل")); if (r) onClose(); };
  return (
    <Sheet title={L("Pay a supplier", "سداد لمورد")} onClose={onClose} testid="supplier-pay-form" footer={<button onClick={save} className={`${btnPrimary} w-full`} disabled={!supplier || !B.toMinor(amount)} data-testid="supplier-pay-save">{L("Save payment", "احفظ السداد")}</button>}>
      <div className="space-y-3">
        <Field label={L("Supplier", "المورد")}><Select value={supplier} onChange={setSupplier}><option value="">{L("— choose —", "— اختار —")}</option>{s.suppliers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-2"><Field label={L("Amount paid", "المبلغ المدفوع")}><Input value={amount} onChange={setAmount} inputMode="decimal" data-testid="supplier-pay-amount" /></Field><Field label={L("Date", "التاريخ")}><Input type="date" value={date} onChange={setDate} /></Field></div>
        <Field label={L("How was it paid", "طريقة الدفع")}><Select value={method} onChange={setMethod}>{methodOpts()}</Select></Field>
        {supplier ? <Card className="divide-y">{open.length ? open.map((o) => <div key={o.number} className="flex justify-between gap-3 px-3.5 py-3 text-[13.5px]"><span className="font-semibold">{o.number} · {fmtDate(o.due)}</span><Money v={o.open} bold /></div>) : <p className="p-4 m-0 text-[13px] text-[var(--c-mut)]">{L("Nothing owed to this supplier.", "مفيش مستحقات للمورد ده.")}</p>}</Card> : null}
      </div>
    </Sheet>
  );
}

// ---- an expense, with the receipt photo --------------------------------------------------------------------------------------
const CATS = [["Rent", "إيجار"], ["Salaries", "مرتبات"], ["Transport", "مواصلات"], ["Electricity & water", "كهرباء ومياه"], ["Phone & internet", "تليفون وإنترنت"], ["Maintenance", "صيانة"], ["Marketing", "تسويق"], ["Fees & taxes", "رسوم وضرائب"], ["General", "عام"]];
export function ExpenseForm({ onClose }) {
  const { s, run, today: td } = useBooks();
  const th = useTheme();
  const [amount, setAmount] = useState(""); const [cat, setCat] = useState("General"); const [method, setMethod] = useState("cash"); const [date, setDate] = useState(td); const [memo, setMemo] = useState(""); const [photo, setPhoto] = useState("");
  const fileRef = useRef(null);
  const pick = (file) => {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, 1200 / Math.max(img.width, img.height)); const cv = document.createElement("canvas"); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); setPhoto(cv.toDataURL("image/jpeg", 0.7)); }; img.src = String(fr.result); };
    fr.readAsDataURL(file);
  };
  const save = async () => { const r = await run((st) => O.addExpense(st, { date, category: cat, amount: B.toMinor(amount) || 0, method, memo, photo }), L("Expense recorded", "المصروف اتسجل")); if (r) onClose(); };
  return (
    <Sheet title={L("New expense", "مصروف جديد")} onClose={onClose} testid="expense-form" footer={<button onClick={save} className={`${btnPrimary} w-full`} disabled={!B.toMinor(amount)} data-testid="expense-save">{L("Save expense", "احفظ المصروف")}</button>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2"><Field label={L("Amount", "المبلغ")}><Input value={amount} onChange={setAmount} inputMode="decimal" data-testid="expense-amount" /></Field><Field label={L("Date", "التاريخ")}><Input type="date" value={date} onChange={setDate} /></Field></div>
        <Field label={L("Category", "النوع")}><Select value={cat} onChange={setCat}>{CATS.map(([en, ar]) => <option key={en} value={en}>{L(en, ar)}</option>)}</Select></Field>
        <Field label={L("Paid from", "دُفع من")}><Select value={method} onChange={setMethod}>{methodOpts()}</Select></Field>
        <Field label={L("Note", "ملاحظة")}><Input value={memo} onChange={setMemo} /></Field>
        <div className="flex items-center gap-3">{photo ? <img src={photo} alt="" className="h-16 rounded-[12px] border border-[var(--c-ln)]" /> : null}<button onClick={() => fileRef.current && fileRef.current.click()} className={`${BTN} border border-dashed ${th.line} flex items-center gap-1.5 hover:border-[var(--c-acc)]`}><Camera size={16} className="text-[var(--c-acc)]" />{photo ? L("Change photo", "غيّر الصورة") : L("Photo of the receipt", "صورة الإيصال")}</button><input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files && e.target.files[0])} /></div>
      </div>
    </Sheet>
  );
}

// ---- who owes what, by age; a customer's statement -----------------------------------------------------------------------------
const AGE_LABELS = { notDue: ["Not due", "لسه"], d1_30: ["1–30 days", "١–٣٠ يوم"], d31_60: ["31–60", "٣١–٦٠"], d61_90: ["61–90", "٦١–٩٠"], d90plus: ["90+", "+٩٠"] };
export function AgeingView() {
  const { s, today: td, share, flash } = useBooks();
  const th = useTheme();
  const [stmt, setStmt] = useState(null);
  const open = O.openInvoices(s, td), age = B.ageing(open, td);
  const remind = (id, owed) => {
    const oldest = open.filter((o) => o.customer === id && o.open > 0 && B.bucketOf(o.due, td) !== "notDue").map((o) => o.date).sort()[0];
    const text = reminderText({ s, customer: id, owed, oldest });
    if (share) share(text); else { try { navigator.clipboard.writeText(text); flash(L("Reminder copied", "التذكير اتنسخ")); } catch (e) {} }
  };
  const rows = Object.entries(age.byCustomer).map(([id, z]) => ({ id, name: (s.customers.find((c) => c.id === id) || {}).name || id, z, tot: B.AGE_BUCKETS.reduce((a, k) => a + z[k], 0) })).sort((a, b) => b.tot - a.tot);
  return (
    <div data-testid="ageing">
      <Card className="p-4 mb-3"><div className="grid grid-cols-5 gap-1.5 text-center">{B.AGE_BUCKETS.map((k) => <div key={k} className="rounded-[12px] bg-[var(--c-surf-2)] px-1 py-2 min-w-0"><p className={`text-[10.5px] font-bold truncate m-0 ${th.sub}`}>{L(...AGE_LABELS[k])}</p><p className={`text-[12px] font-extrabold tabular-nums truncate mt-0.5 mb-0 ${k !== "notDue" && age.total[k] ? NEG : ""}`} dir="ltr">{B.fmt(age.total[k])}</p></div>)}</div>
        <div className={`flex justify-between items-baseline gap-3 border-t mt-3 pt-3 text-[13.5px] font-extrabold ${th.line}`}><span>{L("Total owed to you", "إجمالي المستحق لك")}</span><Money v={age.grand} bold className="text-[19px] font-black tracking-tight" /></div></Card>
      {!rows.length ? <Empty title={L("Nobody owes you anything", "مفيش حد عليه فلوس ليك")} /> : <Card className="divide-y">{rows.map((r) => (
        <div key={r.id} className="relative"><button onClick={() => setStmt(r.id)} className={`w-full min-h-[56px] px-3.5 py-3 text-start hover:bg-[var(--c-surf-2)] first:rounded-t-[20px] last:rounded-b-[20px] ${B.AGE_BUCKETS.slice(1).some((k) => r.z[k]) ? "pb-14" : ""}`} data-testid="ageing-row"><div className="flex justify-between gap-3 text-[14px] font-extrabold"><span className="min-w-0 truncate">{r.name}</span><Money v={r.tot} bold /></div>
          <div className={`flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] tabular-nums mt-1 ${th.sub}`}>{B.AGE_BUCKETS.filter((k) => r.z[k]).map((k) => <span key={k} className={k !== "notDue" ? NEG + " font-bold" : ""}>{L(...AGE_LABELS[k])}: {B.fmt(r.z[k])}</span>)}</div></button>
          {B.AGE_BUCKETS.slice(1).some((k) => r.z[k]) ? <button onClick={() => remind(r.id, B.AGE_BUCKETS.slice(1).reduce((a, k) => a + r.z[k], 0))} className="absolute bottom-2 end-3 min-h-[44px] h-11 px-4 rounded-[12px] text-[13px] font-extrabold bg-[var(--c-acc)] text-[var(--c-on-acc)]" data-testid="remind">{L("Remind", "ذكّره")}</button> : null}</div>))}</Card>}
      {stmt ? <StatementView customer={stmt} onClose={() => setStmt(null)} /> : null}
    </div>
  );
}
export function StatementView({ customer, onClose }) {
  const { s, flash } = useBooks();
  const th = useTheme();
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const c = s.customers.find((x) => x.id === customer) || { name: "—" };
  const st = B.statement({ customer, invoices: s.docs.filter((d) => d.type === "invoice" && d.status === "posted"), credits: s.docs.filter((d) => d.type === "credit" && d.status === "posted"), payments: s.payments, from: from || undefined, to: to || undefined, tax: s.tax });
  return (
    <Sheet title={`${L("Statement", "كشف حساب")} · ${c.name}`} onClose={onClose} testid="statement" footer={<button onClick={() => shareStatement({ s, customer, statement: st, from, to, flash })} className={`${btnPrimary} w-full flex items-center justify-center gap-1.5`} data-testid="statement-share"><Share2 size={14} />{L("Share / PDF", "مشاركة / PDF")}</button>}>
      <div className="grid grid-cols-2 gap-2 mb-3"><Field label={L("From", "من")}><Input type="date" value={from} onChange={setFrom} /></Field><Field label={L("To", "إلى")}><Input type="date" value={to} onChange={setTo} /></Field></div>
      <Card className="divide-y text-[13.5px]">
        <div className="flex justify-between gap-3 px-3.5 py-3 bg-[var(--c-surf-2)] rounded-t-[20px]"><span className={th.sub}>{L("Opening balance", "رصيد أول المدة")}</span><Money v={st.opening} /></div>
        {st.lines.map((l, i) => <div key={i} className="px-3.5 py-2.5"><div className="flex justify-between gap-3"><span className="font-semibold">{l.ref} <span className={`text-[12px] font-normal ${th.sub}`}>{fmtDate(l.date)}</span></span><span className="flex gap-3 shrink-0"><Money v={l.debit ? l.debit : -l.credit} className="font-bold" /><span className={th.sub}><Money v={l.balance} /></span></span></div></div>)}
        <div className="flex justify-between gap-3 px-3.5 py-3 font-black text-[15px] bg-[var(--c-surf-2)] rounded-b-[20px]"><span>{L("Closing balance", "الرصيد الختامي")}</span><Money v={st.closing} /></div>
      </Card>
    </Sheet>
  );
}

// ---- the Money tab ----------------------------------------------------------------------------------------------------------------
export function MoneyModule() {
  const { s, today: td } = useBooks();
  const th = useTheme();
  const [view, setView] = useState("in");
  const [form, setForm] = useState(null);
  useEffect(() => { try { const w = sessionStorage.getItem("books:new"); if (w === "receipt" || w === "expense") { setForm(w); sessionStorage.removeItem("books:new"); } } catch (e) {} }, []);
  const cash = B.cashPosition(s.journal, td);
  const name = (list, id) => (s[list].find((x) => x.id === id) || {}).name || "—";
  const items = view === "in" ? s.payments.map((p) => ({ k: p.id, date: p.date, ref: p.number, who: name("customers", p.customer), amt: p.amount, sign: 1 }))
    : view === "out" ? s.supplierPayments.map((p) => ({ k: p.id, date: p.date, ref: p.number, who: name("suppliers", p.supplier), amt: p.amount, sign: -1 }))
    : s.expenses.map((e) => ({ k: e.id, date: e.date, ref: e.number, who: e.category + (e.memo ? " · " + e.memo : ""), amt: e.amount, sign: -1, photo: e.photo }));
  items.sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <div data-testid="books-money">
      <div className="grid grid-cols-3 gap-2.5 mb-3"><Stat label={L("Cash", "خزنة")} value={<Money v={cash.cash} />} /><Stat label={L("Bank", "بنك")} value={<Money v={cash.bank} />} /><Stat label={L("Total", "الإجمالي")} value={<Money v={cash.total} />} /></div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <button onClick={() => setForm("receipt")} className={btnPrimary} data-testid="money-new-receipt">{L("+ Receipt", "+ تحصيل")}</button>
        <button onClick={() => setForm("pay")} className={btnPrimary} data-testid="money-new-pay">{L("+ Pay supplier", "+ سداد مورد")}</button>
        <button onClick={() => setForm("expense")} className={btnPrimary} data-testid="money-new-expense">{L("+ Expense", "+ مصروف")}</button>
      </div>
      <div className="mb-3"><Chips value={view} onChange={setView} options={[["in", L("Received", "تحصيلات")], ["out", L("Paid to suppliers", "سداد موردين")], ["exp", L("Expenses", "مصروفات")], ["age", L("Who owes you", "المديونيات")], ...PRO_MONEY()]} /></div>
      {view === "age" ? <AgeingView /> : PRO_MONEY().some(([k]) => k === view) ? <ProMoney view={view} /> : !items.length ? <Empty title={L("Nothing here yet", "مفيش حاجة لسه")} /> : (
        <Card className="divide-y" testid="money-list">{items.map((x) => <div key={x.k} className="min-h-[56px] flex items-center gap-3 px-3.5 py-3"><div className="min-w-0 flex-1"><p className="text-[14px] font-extrabold truncate m-0">{x.who}</p><p className={`text-[12px] truncate m-0 ${th.sub}`}>{x.ref} · {fmtDate(x.date)}</p></div>{x.photo ? <img src={x.photo} alt="" className="h-10 w-10 rounded-[12px] object-cover border border-[var(--c-ln)] shrink-0" /> : null}<span className={`shrink-0 ${x.sign > 0 ? POS + " font-extrabold" : "font-extrabold"}`}><Money v={x.sign > 0 ? x.amt : -x.amt} /></span></div>)}</Card>)}
      {form === "receipt" ? <ReceiptForm onClose={() => setForm(null)} /> : form === "pay" ? <SupplierPayForm onClose={() => setForm(null)} /> : form === "expense" ? <ExpenseForm onClose={() => setForm(null)} /> : null}
    </div>
  );
}
