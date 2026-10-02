/* ---- Books → Purchases: supplier bills, what you owe, suppliers ------------------------------------------------ */
import React, { useState, useMemo, useEffect } from "react";
import { Plus } from "lucide-react";
import * as B from "./books.js";
import * as O from "./books-ops.js";
import { L, useBooks, useTheme, Card, Section, Money, Badge, Empty, Field, Input, Select, Search_, Chips, Sheet, BTN, btnPrimary, fmtDate, STATUS } from "./books-kit.jsx";
import { LinesEditor, Totals, PartyForm } from "./books-sales.jsx";
import { SupplierPayForm } from "./books-money.jsx";

function BillEditor({ bill, onClose, onSaved }) {
  const { s, run, today: td } = useBooks();
  const th = useTheme();
  const [d, setD] = useState(() => bill || { type: "bill", date: td, supplier: "", ref: "", lines: [{ _k: "n0", qty: 1, price: 0, vat: "S" }] });
  const [newSup, setNewSup] = useState(false);
  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v }));
  const save = async (andPost) => {
    const r1 = await run((st) => O.saveDraft(st, { ...d, lines: d.lines.map(({ _k, ...l }) => l) }));
    if (!r1) return;
    if (!andPost) { onSaved && onSaved(r1.id); return onClose(); }
    const r2 = await run((st) => O.postBill(st, r1.id), L("Bill posted — stock updated", "اتسجّلت فاتورة المورد — المخزون اتحدّث"));
    if (r2) { onSaved && onSaved(r1.id); onClose(); }
  };
  return (
    <Sheet title={bill && bill.number ? bill.number : L("Supplier bill", "فاتورة مورد")} onClose={onClose} testid="bill-editor"
      footer={<div className="flex gap-2"><button onClick={() => save(false)} className={`${BTN} border ${th.line} flex-1`} data-testid="bill-save">{L("Save draft", "حفظ مسودة")}</button><button onClick={() => save(true)} className={`${btnPrimary} flex-1`} data-testid="bill-post">{L("Post", "ترحيل")}</button></div>}>
      <div className="space-y-3">
        <Field label={L("Supplier", "المورد")}><div className="flex gap-2"><div className="flex-1 min-w-0"><Select value={d.supplier} onChange={set("supplier")} data-testid="bill-supplier"><option value="">{L("— choose —", "— اختار —")}</option>{s.suppliers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
          <button onClick={() => setNewSup(true)} className={`${BTN} border ${th.line}`} data-testid="new-supplier"><Plus size={14} /></button></div></Field>
        <div className="grid grid-cols-2 gap-2"><Field label={L("Bill date", "تاريخ الفاتورة")}><Input type="date" value={d.date} onChange={set("date")} /></Field><Field label={L("Supplier's invoice no.", "رقم فاتورة المورد")}><Input value={d.ref || ""} onChange={set("ref")} /></Field></div>
        <Section title={L("What you bought", "اللي اشتريته")}><LinesEditor lines={d.lines} setLines={set("lines")} items={s.items} bill /></Section>
        <Totals doc={d} />
        <p className={`text-[11px] ${th.sub}`}>{L("Items that track stock are added to your stock at this cost when you post.", "الأصناف اللي ليها مخزون بتتضاف للمخزون بالتكلفة دي عند الترحيل.")}</p>
      </div>
      {newSup ? <PartyForm kind="suppliers" onClose={() => setNewSup(false)} onSaved={(id) => { set("supplier")(id); setNewSup(false); }} /> : null}
    </Sheet>
  );
}
function BillView({ id, onClose }) {
  const { s, run } = useBooks();
  const th = useTheme();
  const b = s.bills.find((x) => x.id === id);
  const [edit, setEdit] = useState(false); const [pay, setPay] = useState(false);
  if (!b) return null;
  const sup = s.suppliers.find((c) => c.id === b.supplier);
  const open = b.status === "posted" ? O.billsOpen(s).find((o) => o.number === b.number) : null;
  const del = async () => { if (!window.confirm(L("Delete this draft?", "تمسح المسودة دي؟"))) return; const r = await run((st) => O.deleteDraft(st, b.id)); if (r) onClose(); };
  return (
    <Sheet title={b.number || L("Supplier bill", "فاتورة مورد")} onClose={onClose} testid="bill-view"
      footer={<div className="flex gap-2">{b.status === "draft" ? <><button onClick={() => setEdit(true)} className={`${btnPrimary} flex-1`}>{L("Edit & post", "تعديل وترحيل")}</button><button onClick={del} className={`${BTN} border ${th.line} text-red-600`}>{L("Delete", "حذف")}</button></> : null}{open && open.open > 0 ? <button onClick={() => setPay(true)} className={`${btnPrimary} flex-1`} data-testid="bill-pay">{L("Pay", "سداد")}</button> : null}</div>}>
      <div className="space-y-3">
        <div className="flex items-center gap-2"><Badge tone={STATUS[b.status][2]}>{L(STATUS[b.status][0], STATUS[b.status][1])}</Badge><span className={`text-[12px] ${th.sub}`}>{fmtDate(b.date)}{b.due ? ` · ${L("due", "استحقاق")} ${fmtDate(b.due)}` : ""}</span></div>
        <Card className="p-3"><p className="text-[14px] font-semibold">{sup ? sup.name : "—"}</p>{b.ref ? <p className={`text-[12px] ${th.sub}`}>{L("Their invoice", "فاتورتهم")} {b.ref}</p> : null}</Card>
        <Card className="divide-y">{b.lines.map((l, i) => <div key={i} className="px-3 py-2 text-[13px] flex justify-between"><span>{l.desc || (s.items.find((x) => x.id === l.item) || {}).name || "—"} <span className={th.sub}>× {l.qty}</span></span><Money v={B.lineFigures(l, s.tax).total} bold /></div>)}</Card>
        <Totals doc={b} />
        {open ? <Card className="p-3 text-[13px]"><div className="flex justify-between"><span>{L("Paid", "المدفوع")}</span><Money v={open.paid} /></div><div className="flex justify-between font-bold"><span>{L("Still owed", "المتبقي")}</span><Money v={open.open} /></div></Card> : null}
      </div>
      {edit ? <BillEditor bill={{ ...b, lines: b.lines.map((l, i) => ({ ...l, _k: "k" + i })) }} onClose={() => { setEdit(false); onClose(); }} /> : null}
      {pay ? <SupplierPayForm supplier={b.supplier} onClose={() => setPay(false)} /> : null}
    </Sheet>
  );
}
export function PurchasesModule() {
  const { s } = useBooks();
  const th = useTheme();
  const [view, setView] = useState("bills");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(false); const [openId, setOpenId] = useState(null); const [party, setParty] = useState(null);
  useEffect(() => { try { if (sessionStorage.getItem("books:new") === "bill") { setEdit(true); sessionStorage.removeItem("books:new"); } } catch (e) {} }, []);
  const name = (id) => (s.suppliers.find((c) => c.id === id) || {}).name || "—";
  const open = O.billsOpen(s), owed = open.reduce((a, b) => a + Math.max(0, b.open), 0);
  const bills = useMemo(() => s.bills.filter((b) => !q || (b.number + " " + name(b.supplier) + " " + (b.ref || "")).toLowerCase().includes(q.toLowerCase())).sort((a, b) => (a.date < b.date ? 1 : -1)), [s.bills, q]);
  return (
    <div data-testid="books-purchases">
      <div className="flex gap-2 mb-3"><button onClick={() => setView("bills")} className={`${BTN} flex-1 ${view === "bills" ? "bg-teal-700 text-white" : "border " + th.line}`}>{L("Bills", "الفواتير")}</button><button onClick={() => setView("suppliers")} className={`${BTN} flex-1 ${view === "suppliers" ? "bg-teal-700 text-white" : "border " + th.line}`} data-testid="purchases-suppliers-tab">{L("Suppliers", "الموردين")}</button></div>
      {view === "bills" ? (<>
        <Card className="p-3 mb-3 flex justify-between items-center"><span className="text-[13px]">{L("You owe suppliers", "عليك للموردين")}</span><Money v={owed} bold className="text-[17px]" /></Card>
        <div className="flex gap-2 mb-2"><div className="flex-1"><Search_ value={q} onChange={setQ} placeholder={L("Search bills", "دوّر في الفواتير")} /></div><button onClick={() => setEdit(true)} className={`${btnPrimary} flex items-center gap-1`} data-testid="purchases-new"><Plus size={15} />{L("New", "جديد")}</button></div>
        {!bills.length ? <Empty title={L("No supplier bills yet", "مفيش فواتير موردين لسه")} hint={L("Record what you buy so stock and what you owe stay right.", "سجّل اللي بتشتريه عشان المخزون والمديونية يفضلوا مظبوطين.")} />
          : <Card className="divide-y" testid="bill-list">{bills.map((b) => { const t = B.docTotals(b, s.tax); const o = open.find((x) => x.number === b.number); return (
            <button key={b.id} onClick={() => setOpenId(b.id)} className="w-full flex items-center gap-3 px-3 py-2.5 text-start" data-testid="bill-row"><div className="min-w-0 flex-1"><p className="text-[13.5px] font-medium truncate">{name(b.supplier)}</p><p className={`text-[11.5px] ${th.sub}`}>{b.number || L("Draft", "مسودة")} · {fmtDate(b.date)}</p></div><div className="text-end"><Money v={t.total} bold /><div>{o && o.open <= 0 ? <Badge tone="green">{L("Paid", "مدفوعة")}</Badge> : <Badge tone={STATUS[b.status][2]}>{L(STATUS[b.status][0], STATUS[b.status][1])}</Badge>}</div></div></button>); })}</Card>}
      </>) : (<>
        <button onClick={() => setParty({})} className={`${btnPrimary} w-full mb-3 flex items-center justify-center gap-1.5`} data-testid="supplier-add"><Plus size={15} />{L("Add a supplier", "ضيف مورد")}</button>
        {!s.suppliers.length ? <Empty title={L("No suppliers yet", "مفيش موردين لسه")} /> : <Card className="divide-y">{s.suppliers.map((c) => { const o = open.filter((x) => x.supplier === c.id).reduce((a, x) => a + Math.max(0, x.open), 0); return <button key={c.id} onClick={() => setParty(c)} className="w-full flex items-center justify-between px-3 py-2.5 text-start"><div><p className="text-[13.5px] font-medium">{c.name}</p><p className={`text-[11.5px] ${th.sub}`}>{c.phone || ""}</p></div>{o ? <div className="text-end"><p className={`text-[10px] ${th.sub}`}>{L("you owe", "عليك")}</p><Money v={o} bold /></div> : null}</button>; })}</Card>}
      </>)}
      {edit ? <BillEditor onClose={() => setEdit(false)} onSaved={(id) => setOpenId(id)} /> : null}
      {openId ? <BillView id={openId} onClose={() => setOpenId(null)} /> : null}
      {party ? <PartyForm kind="suppliers" party={party.id ? party : undefined} onClose={() => setParty(null)} /> : null}
    </div>
  );
}
