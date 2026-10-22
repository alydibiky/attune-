/* ---- v6.44 Shop in depth — the screens for shop-pro.js inside the Shop's own tabs: a Return button on the counter,
   Offers & loyalty at the bottom of Stock, the day's reports (by hour, by cashier, returns) on Close. Tests: e2e_v744shoppro. */
import React, { useState } from "react";
import { Undo2, Plus, Trash2, Check, X, Gift } from "lucide-react";
import { tr } from "./i18n.js";
import * as B from "./books.js";
import * as SP from "./shop-pro.js";

const card = "rounded-2xl bg-[var(--c-surf)] border border-[var(--c-ln)] shadow-[0_1px_3px_rgba(15,23,42,.06)]";
const btnP = "h-12 px-5 rounded-2xl text-[var(--c-on-acc)] font-bold text-[15px] disabled:opacity-40 flex items-center justify-center gap-2";
const btnS = "h-10 px-3 rounded-xl border border-[var(--c-ln)] bg-[var(--c-surf)] text-[13.5px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40";
const input = "w-full h-11 rounded-xl border border-[var(--c-ln)] bg-[var(--c-surf)] px-3 text-[15px]";
const money = (m, cur) => B.fmt(m, { cur });
const today = () => new Date().toISOString().slice(0, 10);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Overlay({ title, onClose, children, testid }) {
  return <div className="fixed inset-0 z-[70] bg-black/60 flex items-end" onClick={onClose}>
    <div className="bg-[var(--c-bg)] w-full max-h-[92vh] overflow-y-auto rounded-t-3xl p-4 pb-8 space-y-3" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" data-testid={testid}>
      <div className="flex items-center gap-2"><p className="flex-1 text-[18px] font-extrabold" dir="auto">{title}</p><button onClick={onClose} aria-label={tr("Close")} className="w-10 h-10 rounded-full bg-[var(--c-surf)] border border-[var(--c-ln)] grid place-items-center"><X size={18} /></button></div>
      {children}</div></div>;
}

// ---- a return at the counter -----------------------------------------------------------------------------------------------
export function ReturnSheet({ books, setBooks, onClose, flash }) {
  const recent = books.docs.filter((d) => d.type === "invoice" && d.status === "posted").slice(-30).reverse();
  const [no, setNo] = useState(recent[0] ? recent[0].number : "");
  const [qty, setQty] = useState({}), [restock, setRestock] = useState(true), [refund, setRefund] = useState("cash"), [reason, setReason] = useState("");
  const can = no ? SP.returnable(books, no) || [] : [];
  const save = () => {
    try {
      const r = SP.returnSale(books, { number: no, items: Object.entries(qty).map(([item, q]) => ({ item, qty: Number(q) || 0 })), restock, refund, reason, today: today() });
      setBooks(r.state); flash(r.refund ? tr("Returned — give back {a}", { a: money(r.refund, books.currency) }) : tr("Returned — kept on the customer's account")); onClose();
    } catch (e) { flash(String(e.message || e)); }
  };
  return <Overlay title={tr("Return / refund")} onClose={onClose} testid="shop-return">
    <label className="block"><span className="text-[12px] text-[var(--c-mut)]">{tr("Receipt")}</span>
      <select value={no} onChange={(e) => { setNo(e.target.value); setQty({}); }} className={input} data-testid="shop-return-receipt">{recent.map((d) => <option key={d.number} value={d.number}>{d.number} · {d.date} · {money(B.docTotals(d, books.tax).total)}</option>)}</select></label>
    {can.length ? <div className={card + " p-3 space-y-2"}>{can.map((x) => <div key={x.item} className="flex items-center gap-2"><span className="flex-1 text-[14px]" dir="auto">{x.name}<span className="block text-[12px] text-[var(--c-mut)]">{tr("{n} can come back", { n: x.left })}</span></span>
      <input value={qty[x.item] || ""} onChange={(e) => setQty({ ...qty, [x.item]: e.target.value })} inputMode="numeric" placeholder="0" className={input + " w-20 text-center"} disabled={!x.left} data-testid="shop-return-qty" /></div>)}</div>
      : <p className="text-[13px] text-[var(--c-mut)]">{tr("Nothing on this receipt can come back.")}</p>}
    <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />{tr("Back on the shelf (it can be sold again)")}</label>
    <div className="grid grid-cols-4 gap-1.5">{[["cash", "Cash"], ["card", "Card"], ["wallet", "Wallet"], ["credit", "On account"]].map(([m, l]) => <button key={m} onClick={() => setRefund(m)} className={"h-10 rounded-xl text-[13px] font-semibold border " + (refund === m ? "text-[var(--c-on-acc)]" : "bg-[var(--c-surf)] border-[var(--c-ln)]")} style={refund === m ? { background: "var(--c-acc-2)", borderColor: "var(--c-acc-2)" } : {}}>{tr(l)}</button>)}</div>
    <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tr("Why (optional)")} className={input} dir="auto" />
    <button className={btnP + " w-full"} style={{ background: "var(--c-acc)" }} disabled={!Object.values(qty).some((v) => Number(v) > 0)} onClick={save} data-testid="shop-return-save"><Undo2 size={17} />{tr("Return the items")}</button>
  </Overlay>;
}

// ---- offers and loyalty (Stock tab) ---------------------------------------------------------------------------------------------
export function OffersPanel({ books, shop, setShop }) {
  const [f, setF] = useState(null);
  const offers = shop.offers || [], L = { ...SP.LOYALTY_DEFAULT, ...(shop.loyalty || {}) };
  const save = () => { const o = { id: f.id || "o" + Date.now().toString(36), name: f.name || (f.kind === "pct" ? `${f.pct}%` : `${f.buy}+${f.get}`), kind: f.kind, pct: +f.pct || 0, buy: +f.buy || 0, get: +f.get || 0, items: f.item ? [f.item] : [], from: f.from || "", to: f.to || "",
    days: f.days || [], hours: f.h1 !== "" && f.h2 !== "" && f.h1 != null && f.h2 != null ? [+f.h1, +f.h2] : [], on: true };
    setShop({ ...shop, offers: [...offers.filter((x) => x.id !== o.id), o] }); setF(null); };
  return <div className="space-y-2" data-testid="shop-offers">
    <p className="text-[15px] font-bold pt-2 flex items-center gap-1.5"><Gift size={16} />{tr("Offers")}</p>
    {offers.length ? offers.map((o) => <div key={o.id} className={card + " p-3 flex items-center gap-2"} data-testid="shop-offer"><span className="flex-1 min-w-0"><b className="block text-[14px] truncate" dir="auto">{o.name}</b>
      <span className="block text-[12px] text-[var(--c-mut)]">{o.kind === "pct" ? tr("{p}% off", { p: o.pct }) : tr("Buy {b} get {g} free", { b: o.buy, g: o.get })} · {o.items.length ? (books.items.find((i) => i.id === o.items[0]) || {}).name : tr("everything")}{o.hours.length ? ` · ${o.hours[0]}:00–${o.hours[1]}:00` : ""}{o.to ? " · " + tr("until {d}", { d: o.to }) : ""}{SP.offerActive(o) ? " · " + tr("on now") : ""}</span></span>
      <button className="w-9 h-9 grid place-items-center text-[var(--c-mut)]" aria-label={tr("Delete")} onClick={() => setShop({ ...shop, offers: offers.filter((x) => x.id !== o.id) })}><Trash2 size={15} /></button></div>)
      : <p className="text-[13px] text-[var(--c-mut)]">{tr("No offers. A discount, buy 2 get 1, a happy hour — the counter applies them by itself.")}</p>}
    <button className={btnS} onClick={() => setF({ kind: "pct", pct: "10", buy: "2", get: "1", item: "", name: "", from: "", to: "", h1: "", h2: "", days: [] })} data-testid="shop-offer-new"><Plus size={15} />{tr("New offer")}</button>
    <div className={card + " p-3 space-y-2"} data-testid="shop-loyalty">
      <label className="flex items-center gap-2 text-[14px] font-semibold"><input type="checkbox" checked={!!L.on} onChange={(e) => setShop({ ...shop, loyalty: { ...L, on: e.target.checked, since: L.since || today() } })} data-testid="shop-loyalty-on" />{tr("Loyalty points")}</label>
      {L.on ? <div className="grid grid-cols-2 gap-2 text-[13px]">
        <label className="block"><span className="text-[12px] text-[var(--c-mut)]">{tr("1 point for every")}</span><input value={B.fromMinor(L.every)} inputMode="decimal" onChange={(e) => setShop({ ...shop, loyalty: { ...L, every: Math.max(1, B.toMinor(e.target.value) || 1) } })} className={input} /></label>
        <label className="block"><span className="text-[12px] text-[var(--c-mut)]">{tr("A point is worth")}</span><input value={B.fromMinor(L.value)} inputMode="decimal" onChange={(e) => setShop({ ...shop, loyalty: { ...L, value: Math.max(1, B.toMinor(e.target.value) || 1) } })} className={input} /></label></div> : null}
    </div>
    {f ? <Overlay title={tr("New offer")} onClose={() => setF(null)} testid="shop-offer-form">
      <div className="grid grid-cols-2 gap-1.5">{[["pct", "% off"], ["bxgy", "Buy X get Y"]].map(([k, l]) => <button key={k} onClick={() => setF({ ...f, kind: k })} className={"h-10 rounded-xl text-[13px] font-semibold border " + (f.kind === k ? "text-[var(--c-on-acc)]" : "bg-[var(--c-surf)] border-[var(--c-ln)]")} style={f.kind === k ? { background: "var(--c-acc-2)", borderColor: "var(--c-acc-2)" } : {}}>{tr(l)}</button>)}</div>
      <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={tr("Name (shown on the receipt)")} className={input} dir="auto" data-testid="shop-offer-name" />
      {f.kind === "pct" ? <input value={f.pct} onChange={(e) => setF({ ...f, pct: e.target.value })} inputMode="decimal" placeholder="%" className={input} data-testid="shop-offer-pct" />
        : <div className="grid grid-cols-2 gap-2"><input value={f.buy} onChange={(e) => setF({ ...f, buy: e.target.value })} inputMode="numeric" placeholder={tr("Buy")} className={input} /><input value={f.get} onChange={(e) => setF({ ...f, get: e.target.value })} inputMode="numeric" placeholder={tr("Get free")} className={input} /></div>}
      <select value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} className={input} data-testid="shop-offer-item"><option value="">{tr("Every item")}</option>{books.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
      <div className="grid grid-cols-2 gap-2"><label className="block"><span className="text-[12px] text-[var(--c-mut)]">{tr("From")}</span><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={input} /></label><label className="block"><span className="text-[12px] text-[var(--c-mut)]">{tr("Until")}</span><input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={input} /></label></div>
      <div className="grid grid-cols-2 gap-2"><input value={f.h1} onChange={(e) => setF({ ...f, h1: e.target.value })} inputMode="numeric" placeholder={tr("From hour (e.g. 17)")} className={input} /><input value={f.h2} onChange={(e) => setF({ ...f, h2: e.target.value })} inputMode="numeric" placeholder={tr("To hour (e.g. 19)")} className={input} /></div>
      <div className="flex flex-wrap gap-1.5">{DAYS.map((d, i) => <button key={d} onClick={() => setF({ ...f, days: f.days.includes(i) ? f.days.filter((x) => x !== i) : [...f.days, i] })} className={"h-9 px-3 rounded-full text-[12.5px] border " + (f.days.includes(i) ? "text-[var(--c-on-acc)]" : "bg-[var(--c-surf)] border-[var(--c-ln)]")} style={f.days.includes(i) ? { background: "var(--c-acc-2)", borderColor: "var(--c-acc-2)" } : {}}>{tr(d)}</button>)}</div>
      <button className={btnP + " w-full"} style={{ background: "var(--c-acc)" }} onClick={save} data-testid="shop-offer-save"><Check size={17} />{tr("Save the offer")}</button>
    </Overlay> : null}
  </div>;
}

// ---- the day's reports (Close tab) ---------------------------------------------------------------------------------------------
export function ShopReports({ books, day }) {
  const hrs = SP.salesByHour(books, day, day).filter((h) => h.count), top = Math.max(1, ...hrs.map((h) => h.total));
  const cash = SP.salesByCashier(books, day, day), rets = SP.returnsOf(books, day, day), cur = books.currency;
  return <div className="space-y-2" data-testid="shop-reports">
    {hrs.length ? <div className={card + " p-3"}><p className="font-bold text-[14px] mb-1.5">{tr("Sales by hour")}</p>
      {hrs.map((h) => <div key={h.hour} className="flex items-center gap-2 text-[12.5px] py-0.5"><span className="w-12 tabular-nums" dir="ltr">{String(h.hour).padStart(2, "0")}:00</span><span className="flex-1 h-2.5 rounded-full bg-[var(--c-surf-2)] overflow-hidden"><span className="block h-full" style={{ width: (h.total / top) * 100 + "%", background: "var(--biz)" }} /></span><span className="w-24 text-end tabular-nums">{money(h.total)}</span></div>)}</div> : null}
    {cash.length > 1 || (cash[0] && cash[0].cashier !== "—") ? <div className={card + " p-3"} data-testid="shop-by-cashier"><p className="font-bold text-[14px] mb-1.5">{tr("By cashier")}</p>
      {cash.map((c) => <p key={c.cashier} className="flex justify-between text-[13px] py-0.5"><span dir="auto">{c.cashier === "—" ? tr("Not named") : c.cashier} · {tr("{n} sales", { n: c.count })}</span><b className="tabular-nums">{money(c.total, cur)}</b></p>)}</div> : null}
    {rets.length ? <div className={card + " p-3"} data-testid="shop-returns"><p className="font-bold text-[14px] mb-1.5">{tr("Returns")}</p>
      {rets.map((r) => <p key={r.number} className="flex justify-between text-[13px] py-0.5"><span dir="auto">{r.against} · {r.reason || tr("no reason")}</span><span className="tabular-nums">{money(r.total)}{r.refunded ? " · " + tr("refunded {a}", { a: money(r.refunded) }) : ""}</span></p>)}</div> : null}
  </div>;
}
