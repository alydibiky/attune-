/* ---- v6.27 Shop in your pocket — the screens (inside the Business app: Hub → "Shop in your pocket") ---------------------------------
   Setup from one sentence (confirm the tax rate, set prices, check example recipes) → Sell (the counter: tap or scan items, cash /
   card / wallet / on credit, change) · Stock (on hand, receive, re-order message) · Customers (who owes what) · Staff (clock in /
   out) · Day close (by payment method, cash expected vs counted). Every sale is a real Books invoice + receipt (shop.js).
   Tests: tests/e2e_v727shop.py.                                                                                                  */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Plus, Minus, Barcode, Search, Check, Trash2, Share2, Package, Users, Clock, BarChart3, ShoppingCart, AlertTriangle } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as S from "./shop.js";
import * as Ops from "./books-ops.js";
import * as B from "./books.js";
import { loadBooks, saveBooks } from "./books-store.js";
import { homeCurrency } from "./locale.js";
import { regionOf } from "./locale.js";

const card = "rounded-2xl bg-[#FFFFFF] border border-[#DCE3EC] shadow-[0_1px_3px_rgba(15,23,42,.06)]";
const btnP = "h-12 px-5 rounded-2xl text-[#FFFFFF] font-bold text-[15px] disabled:opacity-40 flex items-center justify-center gap-2";
const btnS = "h-10 px-3 rounded-xl border border-[#DCE3EC] bg-[#FFFFFF] text-[13.5px] font-semibold flex items-center justify-center gap-1.5";
const input = "w-full h-11 rounded-xl border border-[#DCE3EC] bg-[#FFFFFF] px-3 text-[15px]";
const today = () => new Date().toISOString().slice(0, 10);
const money = (m, cur) => B.fmt(m, { cur });
const toM = (v) => B.toMinor(v);
const country = () => { try { return regionOf((navigator.languages && navigator.languages[0]) || navigator.language || ""); } catch (e) { return ""; } };

function Setup({ onDone, flash }) {
  const [text, setText] = useState("");
  const [su, setSu] = useState(null);
  const [ok, setOk] = useState(false);
  const read = () => setSu(S.setupFromSentence(text, { country: country(), currency: homeCurrency() }));
  if (!su) return (
    <div className="space-y-3" data-testid="shop-setup">
      <p className="text-[22px] font-extrabold leading-tight">{tr("Your shop on this phone")}</p>
      <p className="text-[14px] text-[#5B6B80]">{tr("Say what your shop is — the counter, stock, customers, staff and the end-of-day close are set up for it. Works without internet.")}</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} dir="auto" className="w-full rounded-xl border border-[#DCE3EC] bg-[#FFFFFF] p-3 text-[15px]" placeholder={tr("e.g. A bakery called Nour — we sell bread, cakes and coffee, 3 staff")} data-testid="shop-sentence" />
      <button className={btnP + " w-full"} style={{ background: "var(--biz)" }} disabled={!text.trim()} onClick={read} data-testid="shop-read">{tr("Set it up")}</button>
    </div>);
  const setItem = (i, k, v) => setSu((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) }));
  return (
    <div className="space-y-3" data-testid="shop-confirm">
      <label className="block"><span className="text-[12px] text-[#5B6B80]">{tr("Shop name")}</span><input value={su.name} onChange={(e) => setSu({ ...su, name: e.target.value })} className={input} dir="auto" data-testid="shop-name" /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="text-[12px] text-[#5B6B80]">{tr("Currency")}</span><input value={su.currency} onChange={(e) => setSu({ ...su, currency: e.target.value.toUpperCase().slice(0, 3) })} className={input} /></label>
        <label className="block"><span className="text-[12px] text-[#5B6B80]">{tr("Tax / VAT %")}</span><input value={su.taxPct ?? ""} inputMode="decimal" onChange={(e) => { setOk(false); setSu({ ...su, taxPct: e.target.value === "" ? null : +e.target.value.replace(",", ".") }); }} className={input} data-testid="shop-tax" /></label>
      </div>
      <label className="flex items-start gap-2 text-[13.5px]"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-1" data-testid="shop-tax-ok" />
        <span>{su.taxPct != null ? tr("{p}% is the tax rate my shop charges (the usual rate here — check it)", { p: su.taxPct }) : tr("I have entered my shop's tax rate (0 if none)")}</span></label>
      <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" checked={su.taxInclusive} onChange={(e) => setSu({ ...su, taxInclusive: e.target.checked })} />{tr("My shelf prices already include the tax")}</label>
      <p className="text-[15px] font-bold pt-1">{tr("Items and prices")}</p>
      <p className="text-[12.5px] text-[#5B6B80] -mt-2">{tr("Set the prices you charge. Items without a price stay, but can't be sold until you set one.")}</p>
      <div className="space-y-1.5">{su.items.map((it, i) => (
        <div key={i} className="flex items-center gap-2"><input value={it.name} onChange={(e) => setItem(i, "name", e.target.value)} placeholder={tr("Item name")} className={input} style={{ flex: "1 1 0", minWidth: 0, width: "auto" }} dir="auto" data-testid="shop-item-name" />
          <input value={it.priceText ?? ""} onChange={(e) => setItem(i, "priceText", e.target.value)} placeholder={tr("Price")} inputMode="decimal" className={input} style={{ width: 96, flex: "0 0 96px" }} data-testid="shop-price" />
          <button className="w-9 h-9 grid place-items-center text-[#94A3B8]" aria-label={tr("Remove")} onClick={() => setSu((x) => ({ ...x, items: x.items.filter((_, j) => j !== i) }))}><Trash2 size={15} /></button></div>))}
        <button className={btnS} onClick={() => setSu((x) => ({ ...x, items: [...x.items, { name: "", unit: "pcs", track: true, price: 0 }] }))}><Plus size={15} />{tr("Add an item")}</button>
      </div>
      <button className={btnP + " w-full"} style={{ background: "var(--biz)" }} disabled={!ok || su.taxPct == null || !su.name.trim()} data-testid="shop-create"
        onClick={() => onDone({ ...su, items: su.items.filter((x) => x.name.trim()).map((x) => ({ ...x, price: toM(x.priceText || 0) || 0 })) })}>{tr("Open my shop")}</button>
      {!ok ? <p className="text-[12px] text-[#B45309] flex gap-1.5"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{tr("Confirm the tax rate first — every receipt depends on it.")}</p> : null}
    </div>);
}

function Sell({ books, setBooks, shop, scanBarcode, share, flash }) {
  const [cart, setCart] = useState([]);
  const [q, setQ] = useState("");
  const [method, setMethod] = useState("cash");
  const [given, setGiven] = useState("");
  const [cust, setCust] = useState("");
  const [done, setDone] = useState(null);
  const fileRef = useRef(null);
  const cur = books.currency;
  const items = books.items.filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()) || (i.sku || "") === q || (i.barcode || "") === q);
  const add = (it) => { if (!(it.price > 0)) { flash(tr("Set a price for {n} first (Stock)", { n: it.name })); return; } setDone(null); setCart((c) => { const i = c.findIndex((x) => x.item === it.id); return i >= 0 ? c.map((x, k) => (k === i ? { ...x, qty: x.qty + 1 } : x)) : [...c, { item: it.id, qty: 1 }]; }); };
  const lines = useMemo(() => (cart.length ? S.cartLines(books, cart, { taxInclusive: shop.taxInclusive !== false }) : { total: 0 }), [cart, books]);
  const givenM = given ? toM(given) : null;
  const scan = async (file) => {
    if (!file || !scanBarcode) return;
    const url = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(file); });
    let codes = []; try { codes = await scanBarcode(String(url).split(",")[1]); } catch (e) {}
    const code = codes[0] && (codes[0].value || codes[0].raw || codes[0]);
    const it = code && books.items.find((i) => i.barcode === String(code) || i.sku === String(code));
    if (it) add(it); else flash(code ? tr("No item with barcode {c} — add it in Stock", { c: code }) : tr("No barcode found in the photo"));
  };
  const complete = () => {
    try {
      const r = S.sell(books, cart, { method, given: method === "cash" ? givenM : null, customer: method === "credit" ? cust : undefined, taxInclusive: shop.taxInclusive !== false, recipes: shop.recipes, today: today() });
      setBooks(r.state); setDone({ ...r, lines: cart.map((c) => ({ ...c, name: books.items.find((i) => i.id === c.item).name })) }); setCart([]); setGiven("");
      r.warnings.forEach((w) => flash(w));
    } catch (e) { flash(String(e.message || e)); }
  };
  return (
    <div className="space-y-3" data-testid="shop-sell">
      {done ? (
        <div className={card + " p-4 space-y-1"} data-testid="shop-receipt">
          <p className="font-bold flex items-center gap-2 text-[#15803D]"><Check size={18} />{tr("Sold — {n}", { n: done.number })}</p>
          {done.lines.map((l, i) => <p key={i} className="text-[13.5px] m-0">{l.qty} × {l.name}</p>)}
          <p className="text-[18px] font-extrabold m-0" data-testid="shop-receipt-total">{money(done.total, cur)}</p>
          {done.change > 0 ? <p className="text-[15px] font-bold m-0" data-testid="shop-change">{tr("Change: {a}", { a: money(done.change, cur) })}</p> : null}
          {share ? <button className={btnS + " mt-2"} onClick={() => share(`${books.company.name}\n${done.number}\n${done.lines.map((l) => `${l.qty} × ${l.name}`).join("\n")}\n${tr("Total")}: ${money(done.total, cur)}`)}><Share2 size={14} />{tr("Send the receipt")}</button> : null}
        </div>) : null}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 h-11 rounded-xl border border-[#DCE3EC] bg-[#FFFFFF] px-3"><Search size={15} className="text-[#94A3B8]" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Find an item")} className="flex-1 outline-none bg-transparent" data-testid="shop-search" /></div>
        {scanBarcode ? <button className={btnS + " h-11"} onClick={() => fileRef.current && fileRef.current.click()} aria-label={tr("Scan a barcode")} data-testid="shop-scan"><Barcode size={17} /></button> : null}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { scan(e.target.files && e.target.files[0]); e.target.value = ""; }} />
      </div>
      <div className="grid grid-cols-3 gap-2">{items.slice(0, 30).map((it) => (
        <button key={it.id} onClick={() => add(it)} className={card + " p-2.5 text-start min-h-[64px]"} data-testid="shop-item" style={it.price > 0 ? {} : { opacity: 0.55 }}>
          <span className="block text-[13px] font-semibold leading-tight" dir="auto">{it.name}</span>
          <span className="block text-[12px] text-[#5B6B80] mt-1">{it.price > 0 ? money(it.price) : tr("no price")}</span></button>))}</div>
      {cart.length ? (
        <div className={card + " p-3 space-y-2"} data-testid="shop-cart">
          {cart.map((c, i) => { const it = books.items.find((x) => x.id === c.item); return (
            <div key={c.item} className="flex items-center gap-2"><span className="flex-1 text-[14px]" dir="auto">{it.name}</span>
              <button className="w-8 h-8 rounded-lg border border-[#DCE3EC] grid place-items-center" onClick={() => setCart((x) => x.map((y, k) => (k === i ? { ...y, qty: y.qty - 1 } : y)).filter((y) => y.qty > 0))} aria-label="−"><Minus size={14} /></button>
              <span className="w-6 text-center font-bold">{c.qty}</span>
              <button className="w-8 h-8 rounded-lg border border-[#DCE3EC] grid place-items-center" onClick={() => add(it)} aria-label="+"><Plus size={14} /></button>
              <span className="w-20 text-end text-[13.5px]">{money(it.price * c.qty)}</span></div>); })}
          <p className="text-[20px] font-extrabold text-end m-0" data-testid="shop-total">{money(lines.total, cur)}</p>
          <div className="grid grid-cols-4 gap-1.5">{[["cash", "Cash"], ["card", "Card"], ["wallet", "Wallet"], ["credit", "On credit"]].map(([m, l]) => (
            <button key={m} onClick={() => setMethod(m)} className={"h-10 rounded-xl text-[13px] font-semibold border " + (method === m ? "text-[#FFFFFF]" : "bg-[#FFFFFF] border-[#DCE3EC]")} style={method === m ? { background: "var(--biz)", borderColor: "var(--biz)" } : {}} data-testid={"shop-pay-" + m}>{tr(l)}</button>))}</div>
          {method === "cash" ? <div className="flex items-center gap-2"><input value={given} onChange={(e) => setGiven(e.target.value)} placeholder={tr("Cash given (optional)")} inputMode="decimal" className={input} data-testid="shop-given" />
            {givenM != null && givenM >= lines.total ? <span className="font-bold whitespace-nowrap" data-testid="shop-change-preview">{tr("Change: {a}", { a: money(givenM - lines.total) })}</span> : null}</div> : null}
          {method === "credit" ? <select value={cust} onChange={(e) => setCust(e.target.value)} className={input} data-testid="shop-customer"><option value="">{tr("Which customer?")}</option>{books.customers.filter((c) => !c.walkIn).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : null}
          <button className={btnP + " w-full"} style={{ background: "var(--biz)" }} onClick={complete} disabled={method === "credit" && !cust} data-testid="shop-complete">{tr("Complete the sale")}</button>
        </div>) : null}
    </div>);
}

function Stock({ books, setBooks, shop, share, flash }) {
  const lv = Ops.levels(books);
  const [edit, setEdit] = useState(null);   // { id, price, reorder, barcode, receive, cost }
  const msg = S.reorderMessage(books, { shop: books.company.name, lang: getLang() });
  const save = () => {
    try {
      const it = books.items.find((x) => x.id === edit.id);
      let s = Ops.upsert(books, "items", { ...it, price: toM(edit.price || 0) || 0, reorder: edit.reorder === "" ? null : +edit.reorder, barcode: String(edit.barcode || "").trim() }).state;
      if (+edit.receive > 0) s = Ops.adjustStock(s, { item: it.id, date: today(), qty: +edit.receive, unitCost: toM(edit.cost || 0) || 0, reason: "received" });
      setBooks(s); setEdit(null); flash(tr("Saved"));
    } catch (e) { flash(String(e.message || e)); }
  };
  return (
    <div className="space-y-2" data-testid="shop-stock">
      {msg ? <div className={card + " p-3"} data-testid="shop-low"><p className="font-bold text-[#B45309] m-0">{tr("Running low")}</p><pre className="text-[12.5px] whitespace-pre-wrap m-0 mt-1" dir="auto">{msg}</pre>
        {share ? <button className={btnS + " mt-2"} onClick={() => share(msg)} data-testid="shop-reorder"><Share2 size={14} />{tr("Send to the supplier")}</button> : null}</div> : null}
      {books.items.map((it) => (
        <div key={it.id} className={card + " p-3"} data-testid="shop-stock-item">
          <button className="w-full flex items-center gap-2 text-start" onClick={() => setEdit(edit && edit.id === it.id ? null : { id: it.id, price: it.price ? B.fromMinor(it.price) : "", reorder: it.reorder ?? "", barcode: it.barcode || "", receive: "", cost: "" })}>
            <span className="flex-1 font-semibold" dir="auto">{it.name}</span>
            <span className="text-[13px] text-[#5B6B80]">{it.track !== false ? tr("{n} on hand", { n: Math.round(((lv[it.id] || { qty: 0 }).qty) * 1000) / 1000 }) : tr("made to order")}</span>
            <span className="w-20 text-end text-[13.5px] font-bold">{it.price > 0 ? money(it.price) : "—"}</span></button>
          {edit && edit.id === it.id ? (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <label><span className="text-[11px] text-[#5B6B80]">{tr("Price")}</span><input value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} inputMode="decimal" className={input} data-testid="shop-edit-price" /></label>
              <label><span className="text-[11px] text-[#5B6B80]">{tr("Warn when stock is at")}</span><input value={edit.reorder} onChange={(e) => setEdit({ ...edit, reorder: e.target.value })} inputMode="numeric" className={input} /></label>
              {it.track !== false ? <><label><span className="text-[11px] text-[#5B6B80]">{tr("Received now (qty)")}</span><input value={edit.receive} onChange={(e) => setEdit({ ...edit, receive: e.target.value })} inputMode="decimal" className={input} data-testid="shop-receive" /></label>
                <label><span className="text-[11px] text-[#5B6B80]">{tr("Cost each")}</span><input value={edit.cost} onChange={(e) => setEdit({ ...edit, cost: e.target.value })} inputMode="decimal" className={input} /></label></> : null}
              <label className="col-span-2"><span className="text-[11px] text-[#5B6B80]">{tr("Barcode")}</span><input value={edit.barcode} onChange={(e) => setEdit({ ...edit, barcode: e.target.value })} className={input} /></label>
              <button className={btnP + " col-span-2"} style={{ background: "var(--biz)" }} onClick={save} data-testid="shop-edit-save">{tr("Save")}</button>
            </div>) : null}
        </div>))}
    </div>);
}

function Customers({ books, setBooks, share, flash }) {
  const open = Ops.openInvoices(books, today()).filter((o) => o.open > 0);
  const owed = {}; for (const o of open) owed[o.customer] = (owed[o.customer] || 0) + o.open;
  const [name, setName] = useState("");
  return (
    <div className="space-y-2" data-testid="shop-customers">
      {books.customers.filter((c) => !c.walkIn).map((c) => (
        <div key={c.id} className={card + " p-3 flex items-center gap-2"} data-testid="shop-customer-row"><span className="flex-1 font-semibold" dir="auto">{c.name}</span>
          {owed[c.id] ? <><span className="text-[13.5px] font-bold text-[#B45309]">{tr("owes {a}", { a: money(owed[c.id], books.currency) })}</span>
            <button className={btnS} onClick={() => { try { setBooks(Ops.receive(books, { customer: c.id, date: today(), method: "cash", amount: owed[c.id] }).state); flash(tr("Paid in full")); } catch (e) { flash(String(e.message || e)); } }} data-testid="shop-paid">{tr("Paid")}</button>
            {share ? <button className={btnS} onClick={() => share(tr("Hello {n}, a friendly reminder: {a} is due at {s}. Thank you!", { n: c.name, a: money(owed[c.id], books.currency), s: books.company.name }))}><Share2 size={14} /></button> : null}</> : <span className="text-[12px] text-[#5B6B80]">{tr("nothing owed")}</span>}
        </div>))}
      <div className="flex gap-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("New customer's name")} className={input} dir="auto" data-testid="shop-new-customer" />
        <button className={btnS + " h-11"} disabled={!name.trim()} onClick={() => { setBooks(Ops.upsert(books, "customers", { name: name.trim() }).state); setName(""); }} data-testid="shop-add-customer"><Plus size={15} /></button></div>
    </div>);
}

function Staff({ shop, setShop }) {
  const [name, setName] = useState("");
  const staff = shop.staff || [], d = today(), hours = S.hoursOn(shop, d);
  const onShift = (w) => (shop.shifts || []).some((x) => x.who === w && !x.out);
  return (
    <div className="space-y-2" data-testid="shop-staff">
      {staff.map((w) => (
        <div key={w} className={card + " p-3 flex items-center gap-2"}><span className="flex-1 font-semibold" dir="auto">{w}</span>
          <span className="text-[12.5px] text-[#5B6B80]">{hours[w] ? tr("{h} h today", { h: Math.round(hours[w] * 10) / 10 }) : ""}</span>
          <button className={btnS} onClick={() => setShop(onShift(w) ? S.clockOut(shop, w) : S.clockIn(shop, w))} data-testid="shop-clock">{onShift(w) ? tr("Clock out") : tr("Clock in")}</button></div>))}
      <div className="flex gap-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Staff member's name")} className={input} dir="auto" data-testid="shop-staff-name" />
        <button className={btnS + " h-11"} disabled={!name.trim()} onClick={() => { setShop({ ...shop, staff: [...staff, name.trim()] }); setName(""); }} data-testid="shop-staff-add"><Plus size={15} /></button></div>
    </div>);
}

function Close({ books, shop, setShop, share }) {
  const [counted, setCounted] = useState(""), [float, setFloat] = useState(shop.float != null ? String(B.fromMinor(shop.float)) : "");
  const z = S.dayClose(books, today(), counted === "" ? null : toM(counted), toM(float || 0) || 0);
  const cur = books.currency;
  const text = `${books.company.name} — ${z.day}\n${tr("Sales")}: ${z.count} · ${money(z.sales, cur)}\n${tr("Cash")}: ${money(z.byMethod.cash, cur)} · ${tr("Card")}: ${money(z.byMethod.card, cur)} · ${tr("Wallet")}: ${money(z.byMethod.wallet, cur)} · ${tr("On credit")}: ${money(z.byMethod.credit, cur)}\n${tr("Cash expected")}: ${money(z.expectedCash, cur)}${z.counted != null ? `\n${tr("Counted")}: ${money(z.counted, cur)} (${z.difference >= 0 ? "+" : ""}${money(z.difference, cur)})` : ""}`;
  return (
    <div className="space-y-2" data-testid="shop-close">
      <div className={card + " p-4 space-y-1"}>
        <p className="text-[13px] text-[#5B6B80] m-0">{tr("Today")} · {tr("{n} sales", { n: z.count })}</p>
        <p className="text-[24px] font-extrabold m-0" data-testid="shop-close-total">{money(z.sales, cur)}</p>
        {[["Cash", "cash"], ["Card", "card"], ["Wallet", "wallet"], ["On credit", "credit"]].map(([l, k]) => <p key={k} className="flex justify-between text-[14px] m-0"><span>{tr(l)}</span><b>{money(z.byMethod[k] || 0, cur)}</b></p>)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label><span className="text-[11px] text-[#5B6B80]">{tr("Cash in the drawer this morning")}</span><input value={float} onChange={(e) => setFloat(e.target.value)} inputMode="decimal" className={input} /></label>
        <label><span className="text-[11px] text-[#5B6B80]">{tr("Cash counted now")}</span><input value={counted} onChange={(e) => setCounted(e.target.value)} inputMode="decimal" className={input} data-testid="shop-counted" /></label>
      </div>
      <p className="text-[14px] m-0">{tr("Cash expected")}: <b>{money(z.expectedCash, cur)}</b></p>
      {z.difference != null ? <p className={"text-[15px] font-bold m-0 " + (z.difference === 0 ? "text-[#15803D]" : "text-[#B91C1C]")} data-testid="shop-diff">{z.difference === 0 ? tr("The drawer is right") : tr("Difference: {a}", { a: (z.difference > 0 ? "+" : "") + money(z.difference, cur) })}</p> : null}
      {z.top.length ? <div className={card + " p-3"}><p className="font-bold m-0 mb-1">{tr("Best sellers today")}</p>{z.top.map((t, i) => <p key={i} className="flex justify-between text-[13.5px] m-0"><span dir="auto">{t.name}</span><span>{money(t.net, cur)}</span></p>)}</div> : null}
      <div className="flex gap-2">
        <button className={btnP + " flex-1"} style={{ background: "var(--biz)" }} onClick={() => setShop({ ...shop, float: toM(float || 0) || 0, closes: [...(shop.closes || []), { ...z, at: Date.now() }].slice(-400) })} data-testid="shop-close-save">{tr("Close the day")}</button>
        {share ? <button className={btnS + " h-12"} onClick={() => share(text)}><Share2 size={15} /></button> : null}
      </div>
    </div>);
}

const TABS = [["sell", "Sell", ShoppingCart], ["stock", "Stock", Package], ["customers", "Customers", Users], ["staff", "Staff", Clock], ["close", "Day close", BarChart3]];
export function ShopApp({ onBack, flash, scanBarcode, share }) {
  const [books, setBooksRaw] = useState(null);
  const [shop, setShopRaw] = useState(() => S.loadShop());
  const [tab, setTab] = useState("sell");
  useEffect(() => { loadBooks().then((b) => setBooksRaw(b || Ops.EMPTY())).catch(() => setBooksRaw(Ops.EMPTY())); }, []);
  const setBooks = (b) => { setBooksRaw(b); saveBooks(b).catch(() => flash(tr("Couldn't save — the phone's storage may be full"))); };
  const setShop = (x) => setShopRaw(S.saveShop(x));
  if (!books) return <p className="p-4 text-[#5B6B80]">{tr("Loading…")}</p>;
  const head = (
    <div className="sticky top-0 z-30 bg-[#F4F6FAF2] backdrop-blur px-1 pt-2 pb-2 flex items-center gap-2">
      <button onClick={onBack} aria-label={tr("Back")} className="w-11 h-11 rounded-full bg-[#FFFFFF] border border-[#DCE3EC] flex items-center justify-center shrink-0" data-testid="shop-back"><ChevronLeft size={20} className="rtl:-scale-x-100" /></button>
      <p className="flex-1 text-[17px] font-extrabold truncate" dir="auto">{shop ? books.company.name || tr("Your shop") : tr("Shop in your pocket")}</p>
    </div>);
  if (!shop) return (<section className="px-3 pb-6 space-y-3">{head}<Setup flash={flash} onDone={(su) => {
    try {
      const b = S.applySetup(books, su, { at: new Date().toISOString() });
      setBooks(b);
      setShop({ v: 1, type: su.type, taxInclusive: su.taxInclusive, recipes: S.recipesFor(b, su), staff: [], shifts: [], closes: [] });
      flash(tr("Your shop is ready"));
    } catch (e) { flash(String(e.message || e)); }
  }} /></section>);
  return (
    <section className="px-3 pb-24 space-y-3" data-testid="shop-app">
      {head}
      {tab === "sell" ? <Sell books={books} setBooks={setBooks} shop={shop} scanBarcode={scanBarcode} share={share} flash={flash} /> : null}
      {tab === "stock" ? <Stock books={books} setBooks={setBooks} shop={shop} share={share} flash={flash} /> : null}
      {tab === "customers" ? <Customers books={books} setBooks={setBooks} share={share} flash={flash} /> : null}
      {tab === "staff" ? <Staff shop={shop} setShop={setShop} /> : null}
      {tab === "close" ? <Close books={books} shop={shop} setShop={setShop} share={share} /> : null}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#FFFFFF] border-t border-[#DCE3EC] grid grid-cols-5" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} data-testid="shop-nav">
        {TABS.map(([id, l, Ic]) => <button key={id} onClick={() => setTab(id)} className="h-14 flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold" style={{ color: tab === id ? "var(--biz)" : "#64748B" }} data-testid={"shop-tab-" + id}><Ic size={19} />{tr(l)}</button>)}
      </nav>
    </section>);
}
