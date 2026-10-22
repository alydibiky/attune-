/* ---- v6.44 Fleet & rentals — screens for fleet-trade.js inside Fleet's own tabs: Jobs → Quotes; Store → Purchase orders ·
   Suppliers. Forms open in Fleet's sheet. Tests: tests/e2e_v744fleettrade.py.                                            */
import React, { useState } from "react";
import { Plus, Printer, Trash2, Check, Truck, Package, Wallet, Pencil } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as F from "./fleet.js";
import * as Q from "./fleet-trade.js";
import { askConfirm } from "./confirm.jsx";
import { card, btnP, btnS, muted, num, nameOf, Txt, Sel, DateF, Seg, Tag, Row, Empty, Kpi, SaveBtn, printHTML, opts } from "./fleet-ui.jsx";

const isAr = () => getLang() === "ar";
const QS = { draft: ["Draft", "gray"], sent: ["Sent", "blue"], accepted: ["Accepted", "green"], won: ["Won — job order", "green"], rejected: ["Rejected", "red"], expired: ["Expired", "amber"] };
const PS = { open: ["Open", "blue"], partial: ["Partly received", "amber"], received: ["Received", "green"], cancelled: ["Cancelled", "gray"] };
const MODE_L = { hourly: "Hourly", daily: "Daily", period: "Period" };

// ---- Jobs → Quotes ----------------------------------------------------------------------------------------------------------
export function QuotesPane({ s, money, setSheet }) {
  const t = F.isoDay(), list = F.live(s.quotes || []).slice().reverse(), st = Q.quoteStats(s, t.slice(0, 4), t);
  return <div className="space-y-2.5" data-testid="fleet-quotes">
    <div className="grid grid-cols-3 gap-2"><Kpi label={tr("Open quotes")} value={money(st.openValue)} /><Kpi label={tr("Won this year")} value={money(st.wonValue)} /><Kpi label={tr("Win rate")} value={st.rate == null ? "—" : st.rate + "%"} /></div>
    <button className={btnP + " h-10 w-full"} style={{ background: "var(--c-acc)" }} onClick={() => setSheet({ kind: "quote" })} data-testid="fleet-new-quote"><Plus size={16} />{tr("New quotation")}</button>
    {list.length ? list.map((q) => { const k = Q.quoteState(q, t), [l, tone] = QS[k];
      return <Row key={q.id} onClick={() => setSheet({ kind: "quoteView", id: q.id })} testid="fleet-quote">
        <span className="flex-1 min-w-0"><span className="flex items-center gap-2"><b className="text-[14.5px]" dir="ltr">{q.no}</b><Tag tone={tone}>{tr(l)}</Tag><Tag tone="blue">{tr(MODE_L[q.mode])}</Tag></span>
          <span className={"block text-[12.5px] truncate mt-0.5 " + muted} dir="auto">{nameOf(s.clients, q.client)} · {q.crane ? nameOf(s.cranes, q.crane) : q.tons ? q.tons + " t" : ""} · {tr("valid until")} {F.showDate(q.validUntil)}</span></span>
        <span className="text-[13.5px] font-bold tabular-nums" dir="ltr">{money(q.total)}</span></Row>; })
      : <Empty>{tr("No quotations yet. Price a job for a client, send it, and turn it into the job order when they say yes.")}</Empty>}
  </div>;
}
export function QuoteForm({ s, run, sheet, close, money, setSheet }) {
  const q0 = sheet.id ? F.byId(s.quotes, sheet.id) : null;
  const [x, setX] = useState(q0 ? { ...q0, rate: String(q0.rate), qty: String(q0.qty), mobilisation: q0.mobilisation ? String(q0.mobilisation) : "", tons: q0.tons ? String(q0.tons) : "" } : { client: "", crane: "", tons: "", site: "", mode: "daily", rate: "", qty: "", mobilisation: "", date: F.isoDay(), validUntil: "", start: "", vatPct: String(s.settings.vat ?? 14), notes: "" });
  const set = (k) => (v) => setX({ ...x, [k]: v });
  const free = Q.freeCranes(s, +x.tons || 0);
  const pickCrane = (id) => { const c = F.byId(s.cranes, id); setX({ ...x, crane: id, rate: x.rate || (c ? String(x.mode === "hourly" ? c.hourly : c.daily) : "") }); };
  const t = Q.quoteTotals({ rate: +x.rate || 0, qty: +x.qty || 0, mobilisation: +x.mobilisation || 0 }, +x.vatPct || 0);
  const save = () => { const r = run((st) => Q.saveQuote(st, { ...x, crane: x.crane || null, site: x.site || null }), (r) => tr("Quotation {no} saved", { no: r.quote.no })); if (r && r.quote) setSheet({ kind: "quoteView", id: r.quote.id }); };
  return <div className="space-y-3" data-testid="fleet-quote-form">
    <Sel label={tr("Client")} value={x.client} onChange={set("client")} options={opts(s.clients)} empty={tr("Choose…")} testid="fleet-f-qclient" />
    <div className="grid grid-cols-2 gap-2"><Txt label={tr("Tons needed")} value={x.tons} onChange={set("tons")} mode="decimal" testid="fleet-f-qtons" /><Sel label={tr("Crane (free now)")} value={x.crane || ""} onChange={pickCrane} options={free.map((c) => ({ v: c.id, l: c.name + (c.tons ? ` (${c.tons} t)` : "") }))} empty={tr("— decide later —")} testid="fleet-f-qcrane" /></div>
    <Sel label={tr("Site")} value={x.site || ""} onChange={set("site")} options={opts(s.sites)} empty={tr("— none yet —")} />
    <div className="grid grid-cols-3 gap-2"><Sel label={tr("Priced")} value={x.mode} onChange={set("mode")} options={["hourly", "daily", "period"].map((m) => ({ v: m, l: tr(MODE_L[m]) }))} /><Txt label={tr("Rate")} value={x.rate} onChange={set("rate")} mode="decimal" testid="fleet-f-qrate" /><Txt label={x.mode === "hourly" ? tr("Hours") : x.mode === "daily" ? tr("Days") : tr("Periods")} value={x.qty} onChange={set("qty")} mode="decimal" testid="fleet-f-qqty" /></div>
    <div className="grid grid-cols-2 gap-2"><Txt label={tr("Mobilisation (transport + rigging)")} value={x.mobilisation} onChange={set("mobilisation")} mode="decimal" /><Txt label={tr("VAT %")} value={x.vatPct} onChange={set("vatPct")} mode="decimal" /></div>
    <div className="grid grid-cols-2 gap-2"><DateF label={tr("Valid until (empty = 14 days)")} value={x.validUntil} onChange={set("validUntil")} /><DateF label={tr("Expected start")} value={x.start} onChange={set("start")} /></div>
    <Txt label={tr("Notes (conditions, what the client provides)")} value={x.notes} onChange={set("notes")} />
    <div className={card + " p-3 text-[13px] space-y-0.5"} data-testid="fleet-quote-total"><p className="flex justify-between"><span>{tr("Subtotal")}</span><span className="tabular-nums" dir="ltr">{money(t.sub)}</span></p>{t.vat ? <p className="flex justify-between"><span>{tr("VAT")}</span><span className="tabular-nums" dir="ltr">{money(t.vat)}</span></p> : null}<p className="flex justify-between font-extrabold text-[15px]"><span>{tr("Total")}</span><span className="tabular-nums" dir="ltr">{money(t.total)}</span></p></div>
    <SaveBtn onClick={save} disabled={!x.client || !(+x.rate > 0) || !(+x.qty > 0)} />
  </div>;
}
export function QuoteView({ s, run, sheet, close, money, saveFile, setSheet }) {
  const q = F.byId(s.quotes || [], sheet.id); if (!q || q.del) return <Empty>{tr("This quotation was deleted.")}</Empty>;
  const k = Q.quoteState(q), [l, tone] = QS[k];
  const [crane, setCrane] = useState(q.crane || ""), [site, setSite] = useState(q.site || ""), [start, setStart] = useState(q.start || F.isoDay());
  const toJob = () => { const r = run((st) => Q.quoteToJob(st, q.id, { crane, site, start }), (r) => tr("Job order {no} made from the quotation", { no: r.job.no })); if (r && r.job) close(); };
  const free = Q.freeCranes(s, q.tons || 0);
  return <div className="space-y-3" data-testid="fleet-quote-view">
    <div className={card + " p-4 space-y-1"}><div className="flex items-center gap-2"><p className="text-[20px] font-extrabold" dir="ltr">{q.no}</p><Tag tone={tone}>{tr(l)}</Tag></div>
      <p className="text-[14px]" dir="auto">{nameOf(s.clients, q.client)}{q.site ? " · " + nameOf(s.sites, q.site) : ""}</p>
      <p className={"text-[12.5px] " + muted} dir="auto">{tr(MODE_L[q.mode])} · {num(q.qty)} × <span dir="ltr">{money(q.rate)}</span>{q.mobilisation ? " + " + tr("mobilisation") + " " + money(q.mobilisation) : ""} · {tr("valid until")} {F.showDate(q.validUntil)}</p>
      <p className="text-[22px] font-extrabold tabular-nums pt-1" dir="ltr">{money(q.total)}</p>{q.job ? <p className="text-[13px] text-[var(--c-pos)] font-semibold">{tr("Job order")} {(F.byId(s.jobs, q.job) || {}).no}</p> : null}</div>
    <div className="flex flex-wrap gap-2">
      <button className={btnP + " h-10"} style={{ background: "var(--c-acc)" }} onClick={() => printHTML(Q.quoteHTML(s, q.id, { rtl: isAr() }), saveFile, q.no + ".html")} data-testid="fleet-quote-print"><Printer size={15} />{tr("Print / PDF")}</button>
      {!q.job && q.status === "draft" ? <button className={btnS} onClick={() => run((x) => Q.setQuoteStatus(x, q.id, "sent"), tr("Marked as sent"))} data-testid="fleet-quote-sent">{tr("Mark as sent")}</button> : null}
      {!q.job && q.status !== "rejected" ? <button className={btnS} onClick={() => run((x) => Q.setQuoteStatus(x, q.id, "rejected"), tr("Marked as rejected"))}>{tr("Rejected")}</button> : null}
      {!q.job && q.status === "draft" ? <button className={btnS} onClick={() => setSheet({ kind: "quote", id: q.id })}><Pencil size={14} />{tr("Edit")}</button> : null}
      {!q.job ? <button className={btnS + " text-[var(--c-neg)]"} onClick={async () => { if (await askConfirm("Move this quotation to the Recycle Bin?", { yes: "Delete" })) { if (run((x) => F.remove(x, "quotes", q.id))) close(); } }}><Trash2 size={15} />{tr("Delete")}</button> : null}
    </div>
    {!q.job && q.status !== "rejected" ? <div className={card + " p-3.5 space-y-2.5"} data-testid="fleet-quote-tojob"><p className="font-bold text-[14.5px] flex items-center gap-1.5"><Truck size={16} />{tr("The client said yes — make the job order")}</p>
      <div className="grid grid-cols-2 gap-2"><Sel label={tr("Crane")} value={crane} onChange={setCrane} options={(q.crane && !free.some((c) => c.id === q.crane) ? [F.byId(s.cranes, q.crane)] : []).concat(free).filter(Boolean).map((c) => ({ v: c.id, l: c.name }))} empty={tr("Choose…")} testid="fleet-f-jcrane" />
        <Sel label={tr("Site")} value={site} onChange={setSite} options={opts(s.sites)} empty={tr("Choose…")} testid="fleet-f-jsite" /></div>
      <DateF label={tr("Start")} value={start} onChange={setStart} />
      <SaveBtn onClick={toJob} disabled={!crane || !site} testid="fleet-quote-job">{tr("Make the job order")}</SaveBtn></div> : null}
  </div>;
}

// ---- Store → Purchase orders ------------------------------------------------------------------------------------------------------
export function OrdersPane({ s, money, setSheet }) {
  const t = F.isoDay(), list = F.live(s.pos || []).map((p) => Q.poStatus(p, t)).reverse();
  return <div className="space-y-2.5" data-testid="fleet-pos">
    <button className={btnP + " h-10 w-full"} style={{ background: "var(--c-acc)" }} onClick={() => setSheet({ kind: "po" })} data-testid="fleet-new-po"><Plus size={16} />{tr("New purchase order")}</button>
    {list.length ? list.map((p) => { const [l, tone] = PS[p.status];
      return <Row key={p.id} onClick={() => setSheet({ kind: "poView", id: p.id })} testid="fleet-po">
        <span className="flex-1 min-w-0"><span className="flex items-center gap-2"><b className="text-[14.5px]" dir="ltr">{p.no}</b><Tag tone={tone}>{tr(l)}</Tag>{p.late ? <span className="text-[12px] text-[var(--c-neg)] font-semibold">{tr("{d} days late", { d: p.late })}</span> : null}</span>
          <span className={"block text-[12.5px] truncate mt-0.5 " + muted} dir="auto">{p.vendor} · {F.showDate(p.date)}{p.expected ? " → " + F.showDate(p.expected) : ""}</span></span>
        <span className="text-[13.5px] font-bold tabular-nums" dir="ltr">{money(p.total)}</span></Row>; })
      : <Empty>{tr("No purchase orders. Order parts from a supplier; receive them when they come and they go straight into the store.")}</Empty>}
  </div>;
}
export function POForm({ s, run, close, setSheet }) {
  const vend = Q.vendorList(s);
  const [x, setX] = useState({ vendor: "", date: F.isoDay(), expected: "", notes: "", lines: [{ item: "", qty: "", price: "" }] });
  const set = (k) => (v) => setX({ ...x, [k]: v });
  const setLine = (i, k, v) => setX({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) });
  const total = x.lines.reduce((n, l) => n + (+l.qty || 0) * (+l.price || 0), 0);
  const save = () => { const r = run((st) => Q.savePO(st, x), (r) => tr("Purchase order {no} saved", { no: r.po.no })); if (r && r.po) setSheet({ kind: "poView", id: r.po.id }); };
  return <div className="space-y-3" data-testid="fleet-po-form">
    <Txt label={tr("Supplier")} value={x.vendor} onChange={set("vendor")} testid="fleet-f-povendor" placeholder={vend[0] ? vend[0].name : ""} />
    {vend.length ? <div className="flex flex-wrap gap-1.5 -mt-1">{vend.slice(0, 6).map((v) => <button key={v.name} type="button" className="text-[12px] px-2 py-1 rounded-full border border-[var(--c-ln)]" onClick={() => set("vendor")(v.name)} dir="auto">{v.name}</button>)}</div> : null}
    <div className="grid grid-cols-2 gap-2"><DateF label={tr("Date")} value={x.date} onChange={set("date")} /><DateF label={tr("Expected")} value={x.expected} onChange={set("expected")} testid="fleet-f-poexp" /></div>
    {x.lines.map((l, i) => <div key={i} className="flex gap-2 items-end">
      <div className="flex-1 min-w-0"><Txt label={i ? "" : tr("Item")} value={l.item} onChange={(v) => setLine(i, "item", v)} testid="fleet-f-poitem" /></div>
      <div className="w-20 shrink-0"><Txt label={i ? "" : tr("Qty")} value={l.qty} onChange={(v) => setLine(i, "qty", v)} mode="decimal" testid="fleet-f-poqty" /></div>
      <div className="w-24 shrink-0"><Txt label={i ? "" : tr("Unit price")} value={l.price} onChange={(v) => setLine(i, "price", v)} mode="decimal" testid="fleet-f-poprice" /></div></div>)}
    <datalist id="fleet-po-items">{(s.store.items || []).map((it) => <option key={it.id} value={it.name} />)}</datalist>
    <button className={btnS} onClick={() => setX({ ...x, lines: [...x.lines, { item: "", qty: "", price: "" }] })}><Plus size={15} />{tr("Another item")}</button>
    <p className="text-[14px] font-bold text-end tabular-nums" dir="ltr">{num(total)}</p>
    <SaveBtn onClick={save} disabled={!x.vendor.trim() || !x.lines.some((l) => l.item.trim() && +l.qty > 0)} />
  </div>;
}
export function POView({ s, run, sheet, close, money, saveFile }) {
  const p0 = F.byId(s.pos || [], sheet.id); if (!p0 || p0.del) return <Empty>{tr("This purchase order was deleted.")}</Empty>;
  const p = Q.poStatus(p0), [l, tone] = PS[p.status];
  const [who, setWho] = useState((s.store.purchasers || [])[0] || ""), [date, setDate] = useState(F.isoDay()), [got, setGot] = useState({});
  const receive = () => { const lines = p.lines.map((x) => ({ item: x.item, qty: got[x.item] === undefined ? x.left : +got[x.item] || 0 })); const r = run((st) => Q.receivePO(st, p.id, { date, purchaser: who, lines }), (r) => tr("Received into the store — code {c}", { c: r.doc })); if (r) setGot({}); };
  return <div className="space-y-3" data-testid="fleet-po-view">
    <div className={card + " p-4 space-y-1"}><div className="flex items-center gap-2"><p className="text-[20px] font-extrabold" dir="ltr">{p.no}</p><Tag tone={tone}>{tr(l)}</Tag></div>
      <p className="text-[14px]" dir="auto">{p.vendor}</p><p className={"text-[12.5px] " + muted}>{F.showDate(p.date)}{p.expected ? " → " + F.showDate(p.expected) : ""}{p.late ? " · " + tr("{d} days late", { d: p.late }) : ""}</p>
      {p.lines.map((x) => <div key={x.item} className="flex items-center gap-2 text-[13px] py-0.5" data-testid="fleet-po-line"><span className="flex-1 min-w-0" dir="auto">{x.item}</span><span className={muted + " tabular-nums"} dir="ltr">{num(x.received)} / {num(x.qty)}</span><span className="tabular-nums w-24 text-end" dir="ltr">{num(x.qty * x.price)}</span></div>)}
      <p className="text-[18px] font-extrabold tabular-nums text-end" dir="ltr">{money(p.total)}</p>
      {(p.receipts || []).length ? <p className={"text-[12px] " + muted}>{tr("Received")}: {p.receipts.map((r) => F.showDate(r.date) + " (" + r.doc + ")").join(" · ")}</p> : null}</div>
    <div className="flex flex-wrap gap-2">
      <button className={btnP + " h-10"} style={{ background: "var(--c-acc)" }} onClick={() => printHTML(Q.poHTML(s, p.id, { rtl: isAr() }), saveFile, p.no + ".html")} data-testid="fleet-po-print"><Printer size={15} />{tr("Print / PDF")}</button>
      {p.status === "open" ? <button className={btnS + " text-[var(--c-neg)]"} onClick={async () => { if (await askConfirm("Cancel this purchase order?", { yes: "Cancel the order" })) run((x) => Q.cancelPO(x, p.id), tr("Cancelled")); }}>{tr("Cancel the order")}</button> : null}</div>
    {p.status === "open" || p.status === "partial" ? <div className={card + " p-3.5 space-y-2.5"} data-testid="fleet-po-receive"><p className="font-bold text-[14.5px] flex items-center gap-1.5"><Package size={16} />{tr("Goods came — receive them")}</p>
      {p.lines.filter((x) => x.left > 0).map((x) => <div key={x.item} className="flex items-center gap-2"><span className="flex-1 text-[13.5px]" dir="auto">{x.item}</span><input value={got[x.item] ?? String(x.left)} onChange={(e) => setGot({ ...got, [x.item]: e.target.value })} inputMode="decimal" className="w-24 min-h-[44px] h-11 rounded-[14px] bg-[var(--c-bg)] border border-[var(--c-ln)] px-2.5 text-end font-semibold tabular-nums focus:outline-none focus:border-[var(--c-acc)]" dir="ltr" data-testid="fleet-po-got" /></div>)}
      <div className="grid grid-cols-2 gap-2"><Txt label={tr("Received by")} value={who} onChange={setWho} testid="fleet-f-porecv" /><DateF label={tr("Date")} value={date} onChange={setDate} /></div>
      <SaveBtn onClick={receive} disabled={!who.trim()} testid="fleet-po-receive-save">{tr("Receive into the store")}</SaveBtn></div> : null}
  </div>;
}

// ---- Store → Suppliers -----------------------------------------------------------------------------------------------------------
export function VendorsPane({ s, money, setSheet }) {
  const list = Q.vendorBalances(s), owed = list.reduce((n, b) => n + Math.max(0, b.balance), 0);
  return <div className="space-y-2.5" data-testid="fleet-vendors">
    <div className="grid grid-cols-2 gap-2"><Kpi label={tr("You owe suppliers")} value={money(owed)} tone={owed > 0 ? "red" : null} /><button className={btnP + " h-full"} style={{ background: "var(--c-acc)" }} onClick={() => setSheet({ kind: "vendor", rec: {} })} data-testid="fleet-new-vendor"><Plus size={16} />{tr("Supplier")}</button></div>
    {list.length ? list.map((b) => <Row key={b.vendor.name} onClick={() => setSheet({ kind: "vendor", rec: b.vendor })} testid="fleet-vendor">
      <span className="flex-1 min-w-0"><span className="block font-bold text-[14.5px] truncate" dir="auto">{b.vendor.name}</span><span className={"block text-[12px] " + muted}>{tr("bought")} <span dir="ltr">{money(b.bought)}</span> · {tr("paid")} <span dir="ltr">{money(b.paid)}</span></span></span>
      <span className={"text-[13.5px] font-bold tabular-nums " + (b.balance > 0 ? "text-[var(--c-warn)]" : "text-[var(--c-pos)]")} dir="ltr">{money(b.balance)}</span></Row>)
      : <Empty>{tr("No suppliers yet — they come from purchase orders and incoming invoices, or add one.")}</Empty>}
  </div>;
}
export function VendorForm({ s, run, sheet, close, money, setSheet }) {
  const [v, setV] = useState({ ...sheet.rec, opening: sheet.rec.opening ? String(sheet.rec.opening) : "" });
  const set = (k) => (x) => setV({ ...v, [k]: x });
  const st = v.name ? Q.vendorStatement(s, v.name) : null;
  return <div className="space-y-3" data-testid="fleet-vendor-form">
    <Txt label={tr("Name")} value={v.name} onChange={set("name")} testid="fleet-f-vname" />
    <div className="grid grid-cols-2 gap-2"><Txt label={tr("Phone")} value={v.phone} onChange={set("phone")} mode="tel" dir="ltr" /><Txt label={tr("Opening balance (what you owed before)")} value={v.opening} onChange={set("opening")} mode="decimal" testid="fleet-f-vopen" /></div>
    <SaveBtn onClick={() => { if (run((x) => Q.saveVendor(x, v), tr("Saved"))) close(); }} disabled={!String(v.name || "").trim()} />
    {st && st.rows.length ? <div className={card + " p-3"} data-testid="fleet-vendor-statement"><p className="font-bold text-[14px] mb-1">{tr("Statement")}</p>
      {st.rows.map((r, i) => <p key={i} className="flex gap-2 text-[12.5px] py-0.5"><span className="w-20" dir="ltr">{F.showDate(r.date)}</span><span className="flex-1 min-w-0 truncate" dir="auto">{r.what}</span><span className="w-20 text-end tabular-nums" dir="ltr">{r.owed ? num(r.owed) : r.paid ? "−" + num(r.paid) : ""}</span><span className="w-20 text-end tabular-nums font-semibold" dir="ltr">{num(r.balance)}</span></p>)}
      <p className="flex justify-between font-bold text-[14px] pt-1 border-t border-[var(--c-ln)] mt-1"><span>{tr("Owed")}</span><span className="tabular-nums" dir="ltr">{money(st.balance)}</span></p></div> : null}
    {v.name ? <button className={btnS + " w-full"} onClick={() => setSheet({ kind: "cheque", dir: "out", payee: v.name })} data-testid="fleet-vendor-pay"><Wallet size={15} />{tr("Pay this supplier")}</button> : null}
  </div>;
}
