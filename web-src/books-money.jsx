/* ---- Books → Money: receipts, supplier payments, expenses, who owes what (ageing), statements ------------------ */
import React, { useState, useMemo, useRef, useEffect } from "react";
import { Plus, Camera, Share2 } from "lucide-react";
import * as B from "./books.js";
import * as O from "./books-ops.js";
import { L, isAr, useBooks, useTheme, Card, Stat, Section, Money, Badge, Empty, Field, Input, Select, Chips, Sheet, BTN, btnPrimary, today, fmtDate } from "./books-kit.jsx";
import { shareStatement, reminderText } from "./books-docs.jsx";

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
    const r = await run((st) => O.receive(st, { customer, date, method, amount: cash, allocations: plan.rows }), L("Receipt recorded", "تم تسجيل التحصيل"));
    if (r) onClose();
  };
  return (
    <Sheet title={L("Money received", "تحصيل من عميل")} onClose={onClose} testid="receipt-form" footer={<button onClick={save} className={`${btnPrimary} w-full`} disabled={!customer || !(cash > 0)} data-testid="receipt-save">{L("Save receipt", "حفظ التحصيل")}</button>}>
      <div className="space-y-3">
        <Field label={L("Customer", "العميل")}><Select value={customer} onChange={setCustomer} data-testid="receipt-customer"><option value="">{L("— choose —", "— اختار —")}</option>{s.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={L("Amount received", "المبلغ المحصّل")}><Input value={amount} onChange={setAmount} inputMode="decimal" data-testid="receipt-amount" /></Field>
          <Field label={L("Date", "التاريخ")}><Input type="date" value={date} onChange={setDate} /></Field>
        </div>
        <Field label={L("How was it paid", "طريقة الدفع")}><Select value={method} onChange={setMethod}>{methodOpts()}</Select></Field>
        {customer ? (open.length ? (
          <Section title={L("Settles these invoices (oldest first)", "تُسدِّد هذه الفواتير (الأقدم أولًا)")}>
            <Card className="divide-y" testid="receipt-plan">{open.map((o) => { const row = plan.rows.find((r) => r.doc === o.number); return (
              <div key={o.number} className="px-3 py-2 text-[13px]">
                <div className="flex justify-between"><span>{o.number}</span><span className={th.sub}>{L("open", "متبقي")} <Money v={o.open} /></span></div>
                <div className="flex items-center gap-2 mt-1"><span className={`text-[11px] ${th.sub} flex-1`}>{row ? <>{L("pays", "يسدّد")} <Money v={row.amount} />{row.wht ? <> + {L("withheld", "منبع")} <Money v={row.wht} /></> : null}</> : L("not covered", "غير مغطّاة")}</span>
                  <input value={wht[o.number] || ""} onChange={(e) => setWht({ ...wht, [o.number]: e.target.value })} placeholder={L("withheld by customer", "المخصوم من المنبع")} inputMode="decimal" className={`w-36 rounded border px-2 py-1 text-[12px] ${th.input}`} /></div>
              </div>); })}</Card>
            {plan.onAccount > 0 ? <p className={`text-[12px] mt-1.5 ${th.sub}`}>{L("Left on account (customer deposit):", "المتبقي كدفعة مقدمة:")} <Money v={plan.onAccount} bold /></p> : null}
          </Section>) : <p className={`text-[12px] ${th.sub}`}>{L("This customer has no open invoices — the money will be kept on account.", "ليس لهذا العميل فواتير مفتوحة — سيُسجَّل المبلغ كدفعة مقدمة.")}</p>) : null}
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
  const save = async () => { const r = await run((st) => O.paySupplier(st, { supplier, date, method, amount: B.toMinor(amount) || 0 }), L("Payment recorded", "تم تسجيل الدفع")); if (r) onClose(); };
  return (
    <Sheet title={L("Pay a supplier", "سداد لمورد")} onClose={onClose} testid="supplier-pay-form" footer={<button onClick={save} className={`${btnPrimary} w-full`} disabled={!supplier || !B.toMinor(amount)} data-testid="supplier-pay-save">{L("Save payment", "حفظ السداد")}</button>}>
      <div className="space-y-3">
        <Field label={L("Supplier", "المورد")}><Select value={supplier} onChange={setSupplier}><option value="">{L("— choose —", "— اختار —")}</option>{s.suppliers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-2"><Field label={L("Amount paid", "المبلغ المدفوع")}><Input value={amount} onChange={setAmount} inputMode="decimal" data-testid="supplier-pay-amount" /></Field><Field label={L("Date", "التاريخ")}><Input type="date" value={date} onChange={setDate} /></Field></div>
        <Field label={L("How was it paid", "طريقة الدفع")}><Select value={method} onChange={setMethod}>{methodOpts()}</Select></Field>
        {supplier ? <Card className="divide-y">{open.length ? open.map((o) => <div key={o.number} className="flex justify-between px-3 py-2 text-[13px]"><span>{o.number} · {fmtDate(o.due)}</span><Money v={o.open} /></div>) : <p className="p-3 text-[12px]">{L("Nothing owed to this supplier.", "لا توجد مستحقات لهذا المورد.")}</p>}</Card> : null}
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
  const save = async () => { const r = await run((st) => O.addExpense(st, { date, category: cat, amount: B.toMinor(amount) || 0, method, memo, photo }), L("Expense recorded", "تم تسجيل المصروف")); if (r) onClose(); };
  return (
    <Sheet title={L("New expense", "مصروف جديد")} onClose={onClose} testid="expense-form" footer={<button onClick={save} className={`${btnPrimary} w-full`} disabled={!B.toMinor(amount)} data-testid="expense-save">{L("Save expense", "حفظ المصروف")}</button>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2"><Field label={L("Amount", "المبلغ")}><Input value={amount} onChange={setAmount} inputMode="decimal" data-testid="expense-amount" /></Field><Field label={L("Date", "التاريخ")}><Input type="date" value={date} onChange={setDate} /></Field></div>
        <Field label={L("Category", "النوع")}><Select value={cat} onChange={setCat}>{CATS.map(([en, ar]) => <option key={en} value={en}>{L(en, ar)}</option>)}</Select></Field>
        <Field label={L("Paid from", "دُفع من")}><Select value={method} onChange={setMethod}>{methodOpts()}</Select></Field>
        <Field label={L("Note", "ملاحظة")}><Input value={memo} onChange={setMemo} /></Field>
        <div className="flex items-center gap-3">{photo ? <img src={photo} alt="" className="h-16 rounded border" /> : null}<button onClick={() => fileRef.current && fileRef.current.click()} className={`${BTN} border ${th.line} flex items-center gap-1.5`}><Camera size={14} />{photo ? L("Change photo", "غيّر الصورة") : L("Photo of the receipt", "صورة الإيصال")}</button><input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files && e.target.files[0])} /></div>
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
    if (share) share(text); else { try { navigator.clipboard.writeText(text); flash(L("Reminder copied", "نُسخ التذكير")); } catch (e) {} }
  };
  const rows = Object.entries(age.byCustomer).map(([id, z]) => ({ id, name: (s.customers.find((c) => c.id === id) || {}).name || id, z, tot: B.AGE_BUCKETS.reduce((a, k) => a + z[k], 0) })).sort((a, b) => b.tot - a.tot);
  return (
    <div data-testid="ageing">
      <Card className="p-3 mb-3"><div className="grid grid-cols-5 gap-1 text-center">{B.AGE_BUCKETS.map((k) => <div key={k}><p className={`text-[10px] ${th.sub}`}>{L(...AGE_LABELS[k])}</p><p className={`text-[12px] font-semibold ${k !== "notDue" && age.total[k] ? "text-red-600" : ""}`} dir="ltr">{B.fmt(age.total[k])}</p></div>)}</div>
        <div className={`flex justify-between border-t mt-2 pt-2 text-[13px] ${th.line}`}><span>{L("Total owed to you", "إجمالي المستحق لك")}</span><Money v={age.grand} bold /></div></Card>
      {!rows.length ? <Empty title={L("Nobody owes you anything", "لا توجد مستحقات لك على أحد")} /> : <Card className="divide-y">{rows.map((r) => (
        <div key={r.id} className="relative"><button onClick={() => setStmt(r.id)} className="w-full px-3 py-2.5 text-start" data-testid="ageing-row"><div className="flex justify-between text-[13.5px] font-medium"><span>{r.name}</span><Money v={r.tot} bold /></div>
          <div className={`flex gap-3 text-[11px] mt-0.5 ${th.sub}`}>{B.AGE_BUCKETS.filter((k) => r.z[k]).map((k) => <span key={k} className={k !== "notDue" ? "text-red-600" : ""}>{L(...AGE_LABELS[k])}: {B.fmt(r.z[k])}</span>)}</div></button>
          {B.AGE_BUCKETS.slice(1).some((k) => r.z[k]) ? <button onClick={() => remind(r.id, B.AGE_BUCKETS.slice(1).reduce((a, k) => a + r.z[k], 0))} className="absolute bottom-2 end-3 text-[11px] px-2 py-1 rounded-md bg-emerald-600 text-white" data-testid="remind">{L("Remind", "ذكّره")}</button> : null}</div>))}</Card>}
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
      <Card className="divide-y text-[13px]">
        <div className="flex justify-between px-3 py-2"><span className={th.sub}>{L("Opening balance", "رصيد أول المدة")}</span><Money v={st.opening} /></div>
        {st.lines.map((l, i) => <div key={i} className="px-3 py-2"><div className="flex justify-between"><span>{l.ref} <span className={`text-[11px] ${th.sub}`}>{fmtDate(l.date)}</span></span><span className="flex gap-3"><Money v={l.debit ? l.debit : -l.credit} /><span className={th.sub}><Money v={l.balance} /></span></span></div></div>)}
        <div className="flex justify-between px-3 py-2 font-bold"><span>{L("Closing balance", "الرصيد الختامي")}</span><Money v={st.closing} /></div>
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
      <div className="grid grid-cols-3 gap-2 mb-3"><Stat label={L("Cash", "خزنة")} value={<Money v={cash.cash} />} /><Stat label={L("Bank", "بنك")} value={<Money v={cash.bank} />} /><Stat label={L("Total", "الإجمالي")} value={<Money v={cash.total} />} /></div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <button onClick={() => setForm("receipt")} className={btnPrimary} data-testid="money-new-receipt">{L("+ Receipt", "+ تحصيل")}</button>
        <button onClick={() => setForm("pay")} className={btnPrimary} data-testid="money-new-pay">{L("+ Pay supplier", "+ سداد مورد")}</button>
        <button onClick={() => setForm("expense")} className={btnPrimary} data-testid="money-new-expense">{L("+ Expense", "+ مصروف")}</button>
      </div>
      <div className="mb-2"><Chips value={view} onChange={setView} options={[["in", L("Received", "تحصيلات")], ["out", L("Paid to suppliers", "سداد موردين")], ["exp", L("Expenses", "مصروفات")], ["age", L("Who owes you", "المديونيات")]]} /></div>
      {view === "age" ? <AgeingView /> : !items.length ? <Empty title={L("Nothing here yet", "لا يوجد شيء بعد")} /> : (
        <Card className="divide-y" testid="money-list">{items.map((x) => <div key={x.k} className="flex items-center gap-3 px-3 py-2.5"><div className="min-w-0 flex-1"><p className="text-[13.5px] font-medium truncate">{x.who}</p><p className={`text-[11.5px] ${th.sub}`}>{x.ref} · {fmtDate(x.date)}</p></div>{x.photo ? <img src={x.photo} alt="" className="h-9 w-9 rounded object-cover border" /> : null}<span className={x.sign > 0 ? "text-emerald-600 font-semibold" : "font-semibold"}><Money v={x.sign > 0 ? x.amt : -x.amt} /></span></div>)}</Card>)}
      {form === "receipt" ? <ReceiptForm onClose={() => setForm(null)} /> : form === "pay" ? <SupplierPayForm onClose={() => setForm(null)} /> : form === "expense" ? <ExpenseForm onClose={() => setForm(null)} /> : null}
    </div>
  );
}
