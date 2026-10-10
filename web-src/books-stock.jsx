/* ---- Books → Stock: items, on hand, value, reorder alerts, adjustments, history ---------------------------------- */
import React, { useState, useMemo } from "react";
import { Plus, AlertTriangle } from "lucide-react";
import * as B from "./books.js";
import * as O from "./books-ops.js";
import { L, useBooks, useTheme, Card, Stat, Section, Money, Badge, Empty, Field, Input, Select, Search_, Chips, Sheet, BTN, btnPrimary, today, fmtDate } from "./books-kit.jsx";

const plain = (m) => (m ? (m / 100).toFixed(2).replace(/\.00$/, "") : "");
function ItemForm({ item, onClose }) {
  const { run } = useBooks();
  const th = useTheme();
  const [it, setIt] = useState(item || { name: "", sku: "", unit: "pcs", vat: "S", track: true });
  const [price, setPrice] = useState(plain(it.price)); const [cost, setCost] = useState(plain(it.cost)); const [reorder, setReorder] = useState(it.reorder == null ? "" : String(it.reorder));
  const [opening, setOpening] = useState("");
  const set = (k) => (v) => setIt((x) => ({ ...x, [k]: v }));
  const save = async () => {
    const r = await run((st) => O.upsert(st, "items", { ...it, price: B.toMinor(price) || 0, cost: B.toMinor(cost) || 0, reorder: reorder === "" ? null : Number(reorder) }));
    if (!r) return;
    if (!it.id && Number(opening) > 0) await run((st) => O.adjustStock(st, { item: r.id, date: today(), qty: Number(opening), unitCost: B.toMinor(cost) || 0, reason: L("Opening stock", "رصيد أول المدة") }));
    onClose();
  };
  return (
    <Sheet title={L("Item", "صنف")} onClose={onClose} testid="item-form" footer={<button onClick={save} className={`${btnPrimary} w-full`} data-testid="item-save">{L("Save", "حفظ")}</button>}>
      <div className="space-y-2.5">
        <Field label={L("Name", "الاسم")}><Input value={it.name} onChange={set("name")} data-testid="item-name" /></Field>
        <div className="grid grid-cols-2 gap-2"><Field label={L("Code / SKU", "الكود")}><Input value={it.sku || ""} onChange={set("sku")} /></Field><Field label={L("Unit", "الوحدة")}><Input value={it.unit || ""} onChange={set("unit")} /></Field></div>
        <div className="grid grid-cols-2 gap-2"><Field label={L("E-invoice item code (EGS / GS1)", "كود الصنف للفاتورة الإلكترونية")}><Input value={it.etaCode || ""} onChange={set("etaCode")} data-testid="item-eta-code" dir="ltr" /></Field><Field label={L("E-invoice unit (e.g. EA)", "وحدة الفاتورة الإلكترونية")}><Input value={it.etaUnit || ""} onChange={set("etaUnit")} dir="ltr" /></Field></div>
        <div className="grid grid-cols-2 gap-2"><Field label={L("Selling price", "سعر البيع")}><Input value={price} onChange={setPrice} inputMode="decimal" data-testid="item-price" /></Field><Field label={L("Cost", "التكلفة")}><Input value={cost} onChange={setCost} inputMode="decimal" data-testid="item-cost" /></Field></div>
        <div className="grid grid-cols-2 gap-2"><Field label={L("VAT", "الضريبة")}><Select value={it.vat || "S"} onChange={set("vat")}><option value="S">{L("14% standard", "عادية ١٤٪")}</option><option value="Z">{L("0% zero-rated", "صفرية ٠٪")}</option><option value="E">{L("Exempt", "معفاة")}</option></Select></Field><Field label={L("Reorder when at or below", "نبّهني لما يوصل")}><Input value={reorder} onChange={setReorder} inputMode="decimal" /></Field></div>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={it.track !== false} onChange={(e) => set("track")(e.target.checked)} />{L("Track stock for this item (turn off for services)", "متابعة مخزون هذا الصنف (أوقفها للخدمات)")}</label>
        {!it.id ? <Field label={L("Opening stock (how many you have now)", "رصيد أول المدة (الكمية المتوفرة الآن)")} hint={L("Valued at the cost above.", "تُحتسب بالتكلفة أعلاه.")}><Input value={opening} onChange={setOpening} inputMode="decimal" data-testid="item-opening" /></Field> : null}
      </div>
    </Sheet>
  );
}
function AdjustForm({ item, onClose }) {
  const { run, today: td } = useBooks();
  const [qty, setQty] = useState(""); const [reason, setReason] = useState(L("Stock count", "جرد"));
  const [cost, setCost] = useState(plain(item.cost));
  const save = async () => { const r = await run((st) => O.adjustStock(st, { item: item.id, date: td, qty: Number(qty), unitCost: B.toMinor(cost) || 0, reason }), L("Stock adjusted", "تم تعديل المخزون")); if (r) onClose(); };
  return (
    <Sheet title={`${L("Adjust", "تسوية")} · ${item.name}`} onClose={onClose} footer={<button onClick={save} className={`${btnPrimary} w-full`} disabled={!Number(qty)}>{L("Save", "حفظ")}</button>}>
      <div className="space-y-2.5"><Field label={L("Quantity (+ found / − lost)", "الكمية (+ زيادة / − نقص)")}><Input value={qty} onChange={setQty} inputMode="decimal" data-testid="adjust-qty" /></Field>
        <Field label={L("Cost per unit (for additions)", "تكلفة الوحدة (للزيادة)")}><Input value={cost} onChange={setCost} inputMode="decimal" /></Field><Field label={L("Reason", "السبب")}><Input value={reason} onChange={setReason} /></Field></div>
    </Sheet>
  );
}
export function StockModule() {
  const { s } = useBooks();
  const th = useTheme();
  const [q, setQ] = useState(""); const [form, setForm] = useState(null); const [adj, setAdj] = useState(null); const [view, setView] = useState("items");
  const lv = useMemo(() => O.levels(s), [s]);
  const total = Object.values(lv).reduce((a, x) => a + x.value, 0);
  const low = B.lowStock(s.items.filter((i) => i.track !== false), lv);
  const items = s.items.filter((i) => !q || (i.name + " " + (i.sku || "")).toLowerCase().includes(q.toLowerCase()));
  const name = (id) => (s.items.find((x) => x.id === id) || {}).name || id;
  const moves = [...s.stock].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 80);
  return (
    <div data-testid="books-stock">
      <div className="grid grid-cols-2 gap-2 mb-3"><Stat label={L("Stock value", "قيمة المخزون")} value={<Money v={total} />} /><Stat label={L("Low stock", "مخزون ناقص")} value={low.length} tone={low.length ? "warn" : undefined} /></div>
      <div className="flex gap-2 mb-2"><div className="flex-1"><Search_ value={q} onChange={setQ} placeholder={L("Search items", "دوّر في الأصناف")} /></div><button onClick={() => setForm({})} className={`${btnPrimary} flex items-center gap-1`} data-testid="item-add"><Plus size={15} />{L("Item", "صنف")}</button></div>
      <div className="mb-2"><Chips value={view} onChange={setView} options={[["items", L("Items", "الأصناف")], ["moves", L("Movements", "الحركة")]]} /></div>
      {view === "items" ? (!items.length ? <Empty title={L("No items yet", "لا توجد أصناف بعد")} hint={L("Add what you sell. Stock updates by itself from your invoices and purchases.", "أضف ما تبيعه. يتحدّث المخزون تلقائيًا من فواتيرك ومشترياتك.")} />
        : <Card className="divide-y" testid="item-list">{items.map((i) => { const l = lv[i.id] || { qty: 0, value: 0, avgCost: 0 }; const isLow = i.track !== false && i.reorder != null && l.qty <= i.reorder; return (
          <div key={i.id} className="flex items-center gap-2 px-3 py-2.5" data-testid="item-row"><button onClick={() => setForm(i)} className="min-w-0 flex-1 text-start"><p className="text-[13.5px] font-medium truncate">{i.name}</p><p className={`text-[11.5px] ${th.sub}`}>{L("price", "سعر")} {B.fmt(i.price || 0)} · {L("cost", "تكلفة")} {B.fmt(l.avgCost || i.cost || 0)}</p></button>
            <div className="text-end">{i.track === false ? <Badge>{L("service", "خدمة")}</Badge> : <><p className={`text-[13.5px] font-semibold ${isLow ? "text-amber-600" : ""}`}>{isLow ? <AlertTriangle size={12} className="inline me-1" /> : null}{l.qty} <span className={`text-[10px] ${th.sub}`}>{i.unit || ""}</span></p><p className={`text-[11px] ${th.sub}`}><Money v={l.value} /></p></>}</div>
            {i.track !== false ? <button onClick={() => setAdj(i)} className={`${BTN} border ${th.line} !px-2 !py-1.5 text-[11px]`} data-testid="item-adjust">±</button> : null}</div>); })}</Card>)
        : <Card className="divide-y" testid="move-list">{moves.map((m) => <div key={m.id} className="flex justify-between px-3 py-2 text-[13px]"><div className="min-w-0"><p className="truncate">{name(m.item)}</p><p className={`text-[11px] ${th.sub}`}>{fmtDate(m.date)} · {m.ref || m.kind}</p></div><span className={m.qty > 0 ? "text-emerald-600 font-semibold" : "font-semibold"} dir="ltr">{m.qty > 0 ? "+" : ""}{m.qty}</span></div>)}{!moves.length ? <Empty title={L("No movements yet", "لا توجد حركة بعد")} /> : null}</Card>}
      {form ? <ItemForm item={form.id ? form : undefined} onClose={() => setForm(null)} /> : null}
      {adj ? <AdjustForm item={adj} onClose={() => setAdj(null)} /> : null}
    </div>
  );
}
