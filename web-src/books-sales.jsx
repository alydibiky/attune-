/* ---- Books → Sales: quotes, invoices, credit notes, customers ------------------------------------------ */
import React, { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, FileText, Share2, Copy, AlertTriangle } from "lucide-react";
import * as B from "./books.js";
import * as O from "./books-ops.js";
import { L, isAr, useBooks, useTheme, Card, Section, Money, Badge, Empty, Field, Input, Select, Search_, Chips, Sheet, BTN, btnPrimary, today, fmtDate, docLabel, STATUS } from "./books-kit.jsx";
import { ReceiptForm } from "./books-money.jsx";
import { shareDocument, shareDocumentWord } from "./books-docs.jsx";
import * as M from "./books-more.js";
import * as O2 from "./books-ops2.js";
import { EtaButton, DeliveryButton, DocCurrency, FxNote, actorCan } from "./books-extras.jsx";

const num = (v) => { const n = Number(String(v).replace(/,/g, "")); return isFinite(n) ? n : 0; };
const plainMoney = (m) => (m ? (m / 100).toFixed(2).replace(/\.00$/, "") : "");

/** One line of a document: item or free text, quantity, price, discount, VAT, withholding. Remounts when the item changes. */
function LineRow({ line, items, bill, onChange, onRemove, restock, autoPrice }) {
  const th = useTheme();
  const [qty, setQty] = useState(String(line.qty ?? 1));
  const [price, setPrice] = useState(plainMoney(line.price));
  const [disc, setDisc] = useState(line.discBp ? String(line.discBp / 100) : "");
  const f = B.lineFigures(line);
  const patch = (p) => onChange({ ...line, ...p });
  const pickItem = (id) => {
    const it = items.find((x) => x.id === id);
    if (!it) return patch({ item: "" });
    const p = bill ? (it.cost || 0) : autoPrice ? autoPrice(id, line.qty ?? 1) : (it.price || 0);
    setPrice(plainMoney(p));
    patch({ item: id, desc: it.name, price: p, vat: it.vat || "S", _auto: !bill });
  };
  return (
    <div className={`rounded-lg border p-2.5 space-y-2 ${th.line}`} data-testid="doc-line">
      <div className="flex gap-2">
        <div className="flex-1 min-w-0"><Select value={line.item || ""} onChange={pickItem} data-testid="line-item"><option value="">{L("— free text —", "— نص حر —")}</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select></div>
        <button onClick={onRemove} className="p-2 rounded-lg text-red-600" aria-label={L("Remove line", "شيل السطر")}><Trash2 size={16} /></button>
      </div>
      <Input value={line.desc || ""} onChange={(v) => patch({ desc: v })} placeholder={L("Description", "الوصف")} data-testid="line-desc" />
      <div className="grid grid-cols-3 gap-2">
        <Field label={L("Qty", "الكمية")}><Input value={qty} onChange={(v) => { setQty(v); if (line._auto && line.item && autoPrice) { const p = autoPrice(line.item, num(v)); setPrice(plainMoney(p)); patch({ qty: num(v), price: p }); } else patch({ qty: num(v) }); }} inputMode="decimal" data-testid="line-qty" /></Field>
        <Field label={bill ? L("Cost", "التكلفة") : L("Price", "السعر")}><Input value={price} onChange={(v) => { setPrice(v); patch({ price: B.toMinor(v) ?? 0, _auto: false }); }} inputMode="decimal" data-testid="line-price" /></Field>
        <Field label={L("Disc. %", "خصم %")}><Input value={disc} onChange={(v) => { setDisc(v); patch({ discBp: Math.round(num(v) * 100) }); }} inputMode="decimal" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label={L("VAT", "الضريبة")}><Select value={line.vat || "S"} onChange={(v) => patch({ vat: v })}><option value="S">{L("14% standard", "عادية ١٤٪")}</option><option value="Z">{L("0% zero-rated", "صفرية ٠٪")}</option><option value="E">{L("Exempt", "معفاة")}</option></Select></Field>
        {!bill ? <Field label={L("Withholding", "خصم من المنبع")}><Select value={typeof line.wht === "string" ? line.wht : "none"} onChange={(v) => patch({ wht: v })}>
          <option value="none">{L("None", "لا يوجد")}</option><option value="supplies">{L("Supplies 1%", "توريدات ١٪")}</option><option value="services">{L("Services 3%", "خدمات ٣٪")}</option><option value="professional">{L("Professional 5%", "مهنية ٥٪")}</option></Select></Field> : <div />}
      </div>
      <div className={`flex justify-between text-[12px] ${th.sub}`}><span>{f.vat ? `${L("VAT", "ضريبة")} ${B.fmt(f.vat)}` : ""}</span><span className="font-semibold"><Money v={f.total} /></span></div>
    </div>
  );
}
export function LinesEditor({ lines, setLines, items, bill, autoPrice }) {
  const th = useTheme();
  return (
    <div className="space-y-2">
      {lines.map((l, i) => <LineRow key={(l._k || i) + ":" + (l.item || "")} line={l} items={items} bill={bill} autoPrice={autoPrice}
        onChange={(nl) => setLines(lines.map((x, j) => (j === i ? nl : x)))} onRemove={() => setLines(lines.filter((_, j) => j !== i))} />)}
      <button onClick={() => setLines([...lines, { _k: "n" + Date.now() + lines.length, qty: 1, price: 0, vat: "S" }])} className={`${BTN} border ${th.line} w-full flex items-center justify-center gap-1.5`} data-testid="add-line"><Plus size={14} />{L("Add a line", "ضيف سطر")}</button>
    </div>
  );
}
export function Totals({ doc }) {
  const { s } = useBooks();
  const th = useTheme();
  const t = B.docTotals(doc, s.tax);
  const row = (en, ar, v, strong) => v || strong ? <div className={`flex justify-between ${strong ? "font-bold text-[15px] border-t pt-1.5 mt-1 " + th.line : ""}`}><span>{L(en, ar)}</span><Money v={v} /></div> : null;
  return (
    <Card className="p-3 text-[13px] space-y-1" testid="doc-totals">
      {row("Subtotal", "الإجمالي قبل الخصم", t.gross)}
      {row("Discount", "الخصم", -t.discount)}
      {row("Table tax", "ضريبة الجدول", t.tableTax)}
      {row("VAT", "ضريبة القيمة المضافة", t.vat)}
      {row("Total", "الإجمالي", t.total, true)}
      {t.wht ? row("Withheld by customer", "خصم من المنبع", -t.wht) : null}
      {t.wht ? <div className="flex justify-between font-semibold"><span>{L("Cash to receive", "المطلوب تحصيله")}</span><Money v={t.cashDue} /></div> : null}
    </Card>
  );
}

// ---- the document editor (invoice / quote / credit note) ----------------------------------------------------
export function DocEditor({ type, doc, onClose, onSaved }) {
  const { s, run, today: td } = useBooks();
  const th = useTheme();
  const [d, setD] = useState(() => (doc ? M.fxView(doc) : null) || { type, date: td, customer: "", lines: [{ _k: "n0", qty: 1, price: 0, vat: "S" }], notes: "" });
  // the price for an item: the customer's price list on the document date (converted when the document is in a foreign currency)
  const autoPrice = (item, qty) => { const p = O2.priceOf(s, { customer: d.customer, item, qty, date: d.date }).price; return d.fx && d.fx.rate ? B.roundHalfAway((p * M.RATE_SCALE) / d.fx.rate) : p; };
  const [newCust, setNewCust] = useState(false);
  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v }));
  const save = async (andPost) => {
    if (d.fx && !d.fx.rate) return run(() => { throw new O.BooksError(L("Enter the exchange rate", "اكتب سعر الصرف")); });
    const clean = { ...d, lines: d.lines.map(({ _k, _auto, fxPrice, ...l }) => l) };
    const r1 = await run((st) => O.saveDraft(st, d.fx ? M.toBaseDoc(clean, d.fx.currency, d.fx.rate) : M.toBaseDoc(clean)));
    if (!r1) return;
    if (!andPost) { onSaved && onSaved(r1.id); return onClose(); }
    const r2 = await run((st) => O.post(st, r1.id), null);
    if (r2) { onSaved && onSaved(r1.id, r2.number); onClose(); }
  };
  return (
    <Sheet title={`${doc && doc.number ? doc.number : docLabel(type)}`} onClose={onClose} testid="doc-editor"
      footer={<div className="flex gap-2"><button onClick={() => save(false)} className={`${BTN} border ${th.line} flex-1`} data-testid="doc-save">{L("Save draft", "حفظ مسودة")}</button>
        <button onClick={() => save(true)} className={`${btnPrimary} flex-1`} data-testid="doc-post">{type === "quote" ? L("Issue", "إصدار") : L("Post", "ترحيل")}</button></div>}>
      <div className="space-y-3">
        <Field label={L("Customer", "العميل")}>
          <div className="flex gap-2"><div className="flex-1 min-w-0"><Select value={d.customer} onChange={set("customer")} data-testid="doc-customer"><option value="">{L("— choose —", "— اختار —")}</option>{s.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
            <button onClick={() => setNewCust(true)} className={`${BTN} border ${th.line}`} data-testid="new-customer"><Plus size={14} /></button></div>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={L("Date", "التاريخ")}><Input type="date" value={d.date} onChange={set("date")} data-testid="doc-date" /></Field>
          {type === "invoice" ? <Field label={L("Due date", "تاريخ الاستحقاق")} hint={L("Empty = the customer's credit days", "فاضي = أيام السداد المتفق عليها")}><Input type="date" value={d.due || ""} onChange={set("due")} /></Field> : <div />}
        </div>
        {type !== "credit" ? <DocCurrency d={d} setD={setD} /> : null}
        <Section title={L("Lines", "البنود")}><LinesEditor lines={d.lines} setLines={(l) => set("lines")(l)} items={s.items} autoPrice={autoPrice} /></Section>
        <Totals doc={d} />
        {d.fx && d.fx.rate ? <p className="text-[12px] text-end" dir="ltr" data-testid="fx-note">{d.fx.currency} × {M.rateText(d.fx.rate)} = {B.fmt(B.docTotals(M.toBaseDoc({ ...d, lines: d.lines.map(({ fxPrice, ...l }) => l) }, d.fx.currency, d.fx.rate), s.tax).total)} EGP</p> : null}
        <Field label={L("Notes (printed on the document)", "ملاحظات (بتتطبع على المستند)")}><Input value={d.notes || ""} onChange={set("notes")} /></Field>
        {type === "invoice" ? <p className={`text-[11px] ${th.sub}`}>{L("Posting gives the invoice its number and locks it. A mistake after that is fixed with a credit note.", "الترحيل بيدي الفاتورة رقمها وبيقفلها. أي غلط بعد كده بيتصلّح بإشعار دائن.")}</p> : null}
      </div>
      {newCust ? <PartyForm kind="customers" onClose={() => setNewCust(false)} onSaved={(id) => { set("customer")(id); setNewCust(false); }} /> : null}
    </Sheet>
  );
}

// ---- a customer / supplier (also used from purchases) ---------------------------------------------------------
export function PartyForm({ kind, party, onClose, onSaved }) {
  const { run } = useBooks();
  const [p, setP] = useState(party || { name: "", phone: "", address: "", taxId: "", creditLimit: 0 });
  const [limit, setLimit] = useState(plainMoney(p.creditLimit));
  const set = (k) => (v) => setP((x) => ({ ...x, [k]: v }));
  const save = async () => { const r = await run((st) => O.upsert(st, kind, { ...p, creditLimit: B.toMinor(limit) || 0 })); if (r) { onSaved && onSaved(r.id); onClose(); } };
  return (
    <Sheet title={kind === "customers" ? L("Customer", "عميل") : L("Supplier", "مورد")} onClose={onClose} testid="party-form" footer={<button onClick={save} className={`${btnPrimary} w-full`} data-testid="party-save">{L("Save", "حفظ")}</button>}>
      <div className="space-y-2.5">
        <Field label={L("Name", "الاسم")}><Input value={p.name} onChange={set("name")} data-testid="party-name" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={L("Phone", "التليفون")}><Input value={p.phone || ""} onChange={set("phone")} inputMode="tel" /></Field>
          <Field label={L("Tax number", "الرقم الضريبي")}><Input value={p.taxId || ""} onChange={set("taxId")} inputMode="numeric" /></Field>
        </div>
        <Field label={L("Address", "العنوان")}><Input value={p.address || ""} onChange={set("address")} /></Field>
        {kind === "customers" ? <Field label={L("Price group (e.g. wholesale)", "مجموعة الأسعار (مثلاً جملة)")}><Input value={p.group || ""} onChange={set("group")} data-testid="party-group" /></Field> : null}
        {kind === "customers" ? <Field label={L("Credit limit (0 = none)", "حد الائتمان (٠ = بدون)")}><Input value={limit} onChange={setLimit} inputMode="decimal" /></Field> : null}
        {kind === "customers" ? <details className="text-[12.5px]" data-testid="party-eta"><summary className="cursor-pointer py-1 opacity-80">{L("For e-invoices (ETA)", "للفاتورة الإلكترونية")}</summary><div className="space-y-2 pt-2">
          <Field label={L("Customer type", "نوع العميل")}><select value={(p.eta && p.eta.type) || ""} onChange={(e) => setP((x) => ({ ...x, eta: { ...(x.eta || {}), type: e.target.value } }))} className="w-full border rounded-lg px-2 py-2 bg-transparent"><option value="">{L("Automatic (company if it has a tax number)", "تلقائي (شركة لو ليها رقم ضريبي)")}</option><option value="B">{L("Company", "شركة")}</option><option value="P">{L("Person", "فرد")}</option><option value="F">{L("Foreign", "أجنبي")}</option></select></Field>
          {[["governate", "Governorate", "المحافظة"], ["regionCity", "City / area", "المدينة / المنطقة"], ["street", "Street", "الشارع"], ["buildingNumber", "Building no.", "رقم المبنى"]].map(([k, en, ar]) => <Field key={k} label={L(en, ar)}><Input value={((p.eta || {}).address || {})[k] || ""} onChange={(v) => setP((x) => ({ ...x, eta: { ...(x.eta || {}), address: { ...((x.eta || {}).address || {}), [k]: v } } }))} /></Field>)}
          <Field label={L("National ID (a person, invoices of 50,000 EGP or more)", "الرقم القومي (للأفراد، للفواتير من 50,000 جنيه فأكثر)")}><Input value={(p.eta || {}).nationalId || ""} onChange={(v) => setP((x) => ({ ...x, eta: { ...(x.eta || {}), nationalId: v } }))} inputMode="numeric" /></Field>
        </div></details> : null}
      </div>
    </Sheet>
  );
}

// ---- one document: totals and what you can do with it --------------------------------------------------------------
function DocView({ id, onClose }) {
  const { s, run, flash, saveFile } = useBooks();
  const th = useTheme();
  const d = s.docs.find((x) => x.id === id);
  const [edit, setEdit] = useState(false);
  const [pay, setPay] = useState(false);
  if (!d) return null;
  const cust = s.customers.find((c) => c.id === d.customer);
  const t = B.docTotals(d, s.tax);
  const open = d.type === "invoice" && d.status === "posted" ? O.openInvoices(s, today()).find((o) => o.number === d.number) : null;
  const credit = async () => { const r = await run((st) => ({ state: st, draft: O.creditNoteFor(st, d.id, { restock: true, date: today(), reason: L("Credit note for ", "إشعار دائن عن ") + d.number }) })); if (r) { const rr = await run((st) => O.saveDraft(st, r.draft)); if (rr) flash(L("Credit note drafted — review and post it", "أُنشئت مسودة إشعار دائن — راجعها ثم رحّلها")); onClose(); } };
  const toInvoice = async () => { const r = await run((st) => ({ state: st, draft: O.invoiceFromQuote(st, d.id, today()) })); if (r) { const rr = await run((st) => O.saveDraft(st, r.draft)); if (rr) flash(L("Invoice drafted from the quote", "أُنشئت مسودة فاتورة من عرض السعر")); onClose(); } };
  const del = async () => { if (!window.confirm(L("Delete this draft?", "تمسح المسودة دي؟"))) return; const r = await run((st) => O.deleteDraft(st, d.id)); if (r) onClose(); };
  return (
    <Sheet title={d.number || docLabel(d.type)} onClose={onClose} testid="doc-view"
      footer={<div className="flex gap-2 flex-wrap">
        {d.status === "draft" ? <><button onClick={() => setEdit(true)} className={`${btnPrimary} flex-1`} data-testid="doc-edit">{L("Edit & post", "تعديل وترحيل")}</button><button onClick={del} className={`${BTN} border ${th.line} text-red-600`}>{L("Delete", "حذف")}</button></> : null}
        {d.status === "posted" ? <button onClick={() => shareDocument({ s, doc: d, kind: d.type, flash })} className={`${btnPrimary} flex-1 flex items-center justify-center gap-1.5`} data-testid="doc-share"><Share2 size={14} />{L("Share / PDF", "مشاركة / PDF")}</button> : null}
        {d.status === "posted" ? <button onClick={() => shareDocumentWord({ s, doc: d, kind: d.type, flash, saveFile })} className={`${BTN} border ${th.line}`} data-testid="doc-word">{L("Word", "وورد")}</button> : null}
        {open && open.open > 0 ? <button onClick={() => setPay(true)} className={`${BTN} border ${th.line} flex-1`} data-testid="doc-pay">{L("Record payment", "تسجيل دفعة")}</button> : null}
        {d.status === "posted" && d.type === "invoice" && actorCan("void") ? <button onClick={credit} className={`${BTN} border ${th.line}`} data-testid="doc-credit">{L("Credit note", "إشعار دائن")}</button> : null}
        {d.status === "posted" && (d.type === "invoice" || d.type === "credit") ? <EtaButton doc={d} /> : null}
        {d.status === "posted" && (d.type === "invoice" || d.type === "order") ? <DeliveryButton doc={d} /> : null}
        {d.status === "posted" && d.type === "order" ? <button onClick={async () => { const r = await run((st) => O.saveDraft(st, O2.invoiceFromOrder(st, d.id, today()))); if (r) { flash(L("Invoice drafted from what was delivered", "اتعملت مسودة فاتورة باللي اتسلّم")); onClose(); } }} className={`${BTN} border ${th.line}`} data-testid="doc-order-invoice">{L("Invoice delivered", "فوترة المسلّم")}</button> : null}
        {d.status === "posted" && d.type === "quote" ? <button onClick={toInvoice} className={`${BTN} border ${th.line} flex-1`} data-testid="doc-to-invoice">{L("Make an invoice", "حوّل لفاتورة")}</button> : null}
      </div>}>
      <div className="space-y-3">
        <div className="flex items-center gap-2"><Badge tone={STATUS[d.status][2]}>{L(STATUS[d.status][0], STATUS[d.status][1])}</Badge><span className={`text-[12px] ${th.sub}`}>{docLabel(d.type)} · {fmtDate(d.date)}{d.due ? ` · ${L("due", "استحقاق")} ${fmtDate(d.due)}` : ""}</span></div>
        <Card className="p-3"><p className="text-[14px] font-semibold">{cust ? cust.name : "—"}</p>{d.against ? <p className={`text-[12px] ${th.sub}`}>{L("Against", "بخصوص")} {d.against}</p> : null}</Card>
        <Card className="divide-y" testid="doc-lines">{d.lines.map((l, i) => { const f = B.lineFigures(l, s.tax); return (
          <div key={i} className="px-3 py-2 text-[13px] flex justify-between gap-2"><div className="min-w-0"><p className="truncate">{l.desc || (s.items.find((x) => x.id === l.item) || {}).name || "—"}</p><p className={`text-[11px] ${th.sub}`}>{l.qty} × {B.fmt(l.price)}{l.discBp ? ` − ${l.discBp / 100}%` : ""}</p></div><Money v={f.total} bold /></div>); })}</Card>
        <Totals doc={d} />
        <FxNote doc={d} />
        {open ? <Card className="p-3 text-[13px]"><div className="flex justify-between"><span>{L("Paid", "المدفوع")}</span><Money v={open.paid} /></div>{open.credited ? <div className="flex justify-between"><span>{L("Credited", "إشعارات دائنة")}</span><Money v={open.credited} /></div> : null}<div className="flex justify-between font-bold"><span>{L("Still owed", "المتبقي")}</span><Money v={open.open} /></div></Card> : null}
        {d.notes ? <p className={`text-[12px] ${th.sub}`}>{d.notes}</p> : null}
      </div>
      {edit ? <DocEditor type={d.type} doc={{ ...d, lines: d.lines.map((l, i) => ({ ...l, _k: "k" + i })) }} onClose={() => { setEdit(false); onClose(); }} /> : null}
      {pay ? <ReceiptForm customer={d.customer} onClose={() => setPay(false)} /> : null}
    </Sheet>
  );
}

// ---- the Sales tab -----------------------------------------------------------------------------------------------------
export function SalesModule() {
  const { s } = useBooks();
  const th = useTheme();
  const [view, setView] = useState("docs");            // docs | customers
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [newType, setNewType] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [party, setParty] = useState(null);
  const [picker, setPicker] = useState(false);
  useEffect(() => { try { const w = sessionStorage.getItem("books:new"); if (w === "invoice") { setNewType("invoice"); } if (w === "invoice") sessionStorage.removeItem("books:new"); } catch (e) {} }, []);
  const name = (id) => (s.customers.find((c) => c.id === id) || {}).name || "—";
  const docs = useMemo(() => s.docs.filter((d) => (filter === "all" || (filter === "draft" ? d.status === "draft" : d.type === filter))
    && (!q || (d.number + " " + name(d.customer)).toLowerCase().includes(q.toLowerCase()))).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.number || "").localeCompare(a.number || ""))), [s.docs, filter, q, s.customers]);
  return (
    <div data-testid="books-sales">
      <div className="flex gap-2 mb-3">
        <button onClick={() => setView("docs")} className={`${BTN} flex-1 ${view === "docs" ? "bg-teal-700 text-white" : "border " + th.line}`}>{L("Documents", "المستندات")}</button>
        <button onClick={() => setView("customers")} className={`${BTN} flex-1 ${view === "customers" ? "bg-teal-700 text-white" : "border " + th.line}`} data-testid="sales-customers-tab">{L("Customers", "العملاء")}</button>
      </div>
      {view === "docs" ? (
        <>
          <div className="flex gap-2 mb-2"><div className="flex-1"><Search_ value={q} onChange={setQ} placeholder={L("Search number or customer", "دوّر برقم أو عميل")} /></div>
            <button onClick={() => setPicker(true)} className={`${btnPrimary} flex items-center gap-1`} data-testid="sales-new"><Plus size={15} />{L("New", "جديد")}</button></div>
          <div className="mb-2"><Chips value={filter} onChange={setFilter} options={[["all", L("All", "الكل")], ["invoice", L("Invoices", "فواتير")], ["quote", L("Quotes", "عروض")], ["credit", L("Credit notes", "إشعارات")], ["order", L("Orders", "أوامر بيع")], ["draft", L("Drafts", "مسودات")]]} /></div>
          {!docs.length ? <Empty title={L("No documents yet", "مفيش مستندات لسه")} hint={L("Create your first invoice or quotation.", "اعمل أول فاتورة أو عرض سعر.")} action={<button onClick={() => setNewType("invoice")} className={btnPrimary}>{L("New invoice", "فاتورة جديدة")}</button>} />
            : <Card className="divide-y" testid="sales-list">{docs.map((d) => { const t = B.docTotals(d, s.tax); return (
              <button key={d.id} onClick={() => setOpenId(d.id)} className="w-full flex items-center gap-3 px-3 py-2.5 text-start" data-testid="sales-row">
                <div className="min-w-0 flex-1"><p className="text-[13.5px] font-medium truncate">{name(d.customer)}</p><p className={`text-[11.5px] ${th.sub}`}>{d.number || L("Draft", "مسودة")} · {docLabel(d.type)} · {fmtDate(d.date)}</p></div>
                <div className="text-end"><Money v={t.total} bold /><div><Badge tone={STATUS[d.status][2]}>{L(STATUS[d.status][0], STATUS[d.status][1])}</Badge></div></div></button>); })}</Card>}
        </>
      ) : (
        <>
          <button onClick={() => setParty({})} className={`${btnPrimary} w-full mb-3 flex items-center justify-center gap-1.5`} data-testid="customer-add"><Plus size={15} />{L("Add a customer", "ضيف عميل")}</button>
          {!s.customers.length ? <Empty title={L("No customers yet", "لا يوجد عملاء بعد")} /> : <Card className="divide-y" testid="customer-list">{s.customers.map((c) => <CustomerRow key={c.id} c={c} onEdit={() => setParty(c)} />)}</Card>}
        </>
      )}
      {picker ? <Sheet title={L("New document", "مستند جديد")} onClose={() => setPicker(false)}><div className="space-y-2">{[["invoice", "Tax invoice", "فاتورة ضريبية", "Bill a customer; goes into your books.", "بتحاسب العميل وبتدخل في دفاترك."], ["quote", "Quotation", "عرض سعر", "A price offer; no effect on your books until it becomes an invoice.", "عرض سعر؛ مالوش تأثير على الدفاتر لحد ما يبقى فاتورة."], ["order", "Sales order", "أمر بيع", "A confirmed order: deliver it in parts with delivery notes, then invoice.", "طلب مؤكد: سلّمه على دفعات بأذون تسليم، وبعدين فوتره."]].map(([k, en, ar, hen, har]) => (
        <Card key={k} onClick={() => { setPicker(false); setNewType(k); }} className="p-3" testid={"new-" + k}><p className="text-[14px] font-semibold">{L(en, ar)}</p><p className={`text-[12px] ${th.sub}`}>{L(hen, har)}</p></Card>))}</div></Sheet> : null}
      {newType ? <DocEditor type={newType} onClose={() => setNewType(null)} onSaved={(id) => setOpenId(id)} /> : null}
      {openId ? <DocView id={openId} onClose={() => setOpenId(null)} /> : null}
      {party ? <PartyForm kind="customers" party={party.id ? party : undefined} onClose={() => setParty(null)} /> : null}
    </div>
  );
}
function CustomerRow({ c, onEdit }) {
  const { s } = useBooks();
  const th = useTheme();
  const owed = useMemo(() => O.openInvoices(s, today()).filter((o) => o.customer === c.id).reduce((a, o) => a + Math.max(0, o.open), 0), [s, c.id]);
  return <button onClick={onEdit} className="w-full flex items-center justify-between px-3 py-2.5 text-start" data-testid="customer-row"><div><p className="text-[13.5px] font-medium">{c.name}</p><p className={`text-[11.5px] ${th.sub}`}>{c.phone || ""}</p></div>{owed ? <div className="text-end"><p className={`text-[10px] ${th.sub}`}>{L("owes", "عليه")}</p><Money v={owed} bold /></div> : null}</button>;
}
