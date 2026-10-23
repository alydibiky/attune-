/* ---- v6.44 Fleet & rentals in depth — the screens for fleet-pro.js, inside Fleet's own tabs (no new layout):
   Money → Invoices · Aging · Reports (utilisation, revenue per month, fuel); Fleet → Team (people, payroll, advances);
   a crane's page → Papers · Breakdowns · Fuel. The forms open in Fleet's sheet. The small parts (cards, fields, the sheet)
   are Fleet's own (fleet-ui.jsx exports them). Tests: tests/e2e_v744fleetpro.py.                                       */
import React, { useState } from "react";
import { Plus, Printer, Trash2, Wallet, ChevronLeft, ChevronRight, Users, Wrench, Fuel, ShieldCheck, AlertTriangle, Check } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as F from "./fleet.js";
import * as P from "./fleet-pro.js";
import { askConfirm } from "./confirm.jsx";
import { card, btnP, btnS, inp, muted, num, nameOf, Txt, Sel, DateF, Seg, Tag, Row, Empty, Kpi, SaveBtn, Evidence, printHTML, opts } from "./fleet-ui.jsx";

const isAr = () => getLang() === "ar";
const ymOf = (iso) => iso.slice(0, 7);
const shiftYm = (ym, n) => { const d = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const showYm = (ym) => ym.slice(5) + "/" + ym.slice(0, 4);
const ST = { paid: ["Paid", "green"], partial: ["Partly paid", "amber"], unpaid: ["Unpaid", "gray"], overdue: ["Overdue", "red"] };
export const DOC_L = { licence: "Crane licence", insurance: "Insurance", loadtest: "Load test certificate", inspection: "Third-party inspection", other: "Other paper" };
export const ROLE_L = { operator: "Operator", driver: "Driver", rigger: "Rigger", mechanic: "Mechanic", other: "Other" };
function MonthPick({ ym, setYm, testid }) {
  return <div className="flex items-center gap-2" data-testid={testid}>
    <button className={btnS + " w-11 px-0"} aria-label={tr("Previous month")} onClick={() => setYm(shiftYm(ym, -1))}><ChevronLeft size={16} className="rtl:rotate-180" /></button>
    <span className="font-bold text-[14.5px] tabular-nums min-w-[76px] text-center" dir="ltr">{showYm(ym)}</span>
    <button className={btnS + " w-11 px-0"} aria-label={tr("Next month")} onClick={() => setYm(shiftYm(ym, 1))}><ChevronRight size={16} className="rtl:rotate-180" /></button></div>;
}

// ---- Money → Invoices ------------------------------------------------------------------------------------------------------
export function InvoicesPane({ s, money, setSheet }) {
  const [f, setF] = useState("open");
  const all = P.invoiceStatus(s);
  const list = all.filter((v) => f === "all" || (f === "open" ? v.status !== "paid" : v.status === f));
  const left = all.reduce((n, v) => n + v.left, 0), late = all.filter((v) => v.status === "overdue").reduce((n, v) => n + v.left, 0);
  const notInv = F.live(s.clients).reduce((n, c) => n + P.uninvoiced(s, c.id).reduce((m, l) => m + l.amount, 0), 0);
  return <div className="space-y-2.5" data-testid="fleet-invoices">
    <div className="grid grid-cols-3 gap-2"><Kpi label={tr("To collect")} value={money(left)} /><Kpi label={tr("Overdue")} value={money(late)} tone={late > 0 ? "red" : null} /><Kpi label={tr("Not invoiced yet")} value={money(notInv)} /></div>
    <button className={btnP + " h-10 w-full"} style={{ background: "var(--c-acc)" }} onClick={() => setSheet({ kind: "invoice" })} data-testid="fleet-new-invoice"><Plus size={16} />{tr("New invoice from the work")}</button>
    <Seg value={f} onChange={setF} items={[["open", "Open"], ["overdue", "Overdue"], ["paid", "Paid"], ["all", "All"]]} testid="fleet-invf" />
    {list.length ? list.map((v) => { const [l, tone] = ST[v.status];
      return <Row key={v.id} onClick={() => setSheet({ kind: "invoiceView", id: v.id })} testid="fleet-invoice">
        <span className="flex-1 min-w-0"><span className="flex items-center gap-2"><b className="text-[14.5px]" dir="ltr">{v.no}</b><Tag tone={tone}>{tr(l)}</Tag>{v.late ? <span className="text-[12px] text-[var(--c-neg)] font-semibold">{tr("{d} days late", { d: v.late })}</span> : null}</span>
          <span className={"block text-[12.5px] truncate mt-0.5 " + muted} dir="auto">{nameOf(s.clients, v.client)} · {F.showDate(v.date)} · {tr("due")} {F.showDate(v.due)}</span></span>
        <span className="text-end"><span className="block text-[14px] font-bold tabular-nums" dir="ltr">{money(v.left)}</span>{v.left !== v.net ? <span className={"block text-[11.5px] tabular-nums " + muted} dir="ltr">/ {num(v.net)}</span> : null}</span></Row>; })
      : <Empty>{f === "open" ? tr("No open invoices. Make one from the work above.") : tr("Nothing here.")}</Empty>}
  </div>;
}
export function InvoiceForm({ s, run, sheet, close, money, setSheet }) {
  const withWork = F.live(s.clients).filter((c) => P.uninvoiced(s, c.id).length);
  const [x, setX] = useState({ client: sheet.client || (withWork.length === 1 ? withWork[0].id : ""), date: F.isoDay(), to: "", vat: String(s.settings.vat ?? 14), wht: String(s.settings.wht ?? 0), notes: "" });
  const set = (k) => (v) => setX({ ...x, [k]: v });
  const lines = x.client ? P.uninvoiced(s, x.client, { to: x.to }) : [], t = P.invoiceTotals(lines, +x.vat || 0, +x.wht || 0);
  const save = () => { const r = run((st) => P.makeInvoice(st, { client: x.client, date: x.date, to: x.to, vat: +x.vat || 0, wht: +x.wht || 0, notes: x.notes }), (r) => tr("Invoice {no} made", { no: r.invoice.no })); if (r && r.invoice) setSheet({ kind: "invoiceView", id: r.invoice.id }); };
  return <div className="space-y-3" data-testid="fleet-invoice-form">
    <Sel label={tr("Client")} value={x.client} onChange={set("client")} options={F.live(s.clients).map((c) => ({ v: c.id, l: c.name + (P.uninvoiced(s, c.id).length ? "" : " — " + tr("nothing to invoice")) }))} empty={tr("Choose…")} testid="fleet-f-iclient" />
    <div className="grid grid-cols-2 gap-2"><DateF label={tr("Invoice date")} value={x.date} onChange={set("date")} /><DateF label={tr("Work up to (optional)")} value={x.to} onChange={set("to")} testid="fleet-f-ito" /></div>
    <div className="grid grid-cols-2 gap-2"><Txt label={tr("VAT %")} value={x.vat} onChange={set("vat")} mode="decimal" testid="fleet-f-vat" /><Txt label={tr("Withholding tax %")} value={x.wht} onChange={set("wht")} mode="decimal" testid="fleet-f-wht" /></div>
    {x.client ? (lines.length ? <div className={card + " p-3.5 space-y-1.5"} data-testid="fleet-invoice-preview">
      {lines.map((l) => <div key={l.job} className="flex gap-2 text-[13px]"><span className="flex-1 min-w-0" dir="auto">{l.desc}<span className={"block text-[12px] " + muted} dir="ltr">{num(l.qty)} {tr(l.unit === "h" ? "h" : l.unit === "day" ? "days" : "periods")} × {num(l.rate)}</span></span><span className="tabular-nums font-semibold" dir="ltr">{num(l.amount)}</span></div>)}
      <div className="border-t border-[var(--c-ln)] pt-1.5 text-[13px] space-y-0.5">
        <p className="flex justify-between"><span>{tr("Subtotal")}</span><span className="tabular-nums" dir="ltr">{money(t.sub)}</span></p>
        {t.vat ? <p className="flex justify-between"><span>{tr("VAT")} {x.vat}%</span><span className="tabular-nums" dir="ltr">{money(t.vat)}</span></p> : null}
        {t.wht ? <p className="flex justify-between"><span>{tr("Withholding tax")} {x.wht}%</span><span className="tabular-nums" dir="ltr">−{money(t.wht)}</span></p> : null}
        <p className="flex justify-between font-extrabold text-[15px]"><span>{tr("Net to pay")}</span><span className="tabular-nums" dir="ltr" data-testid="fleet-invoice-net">{money(t.net)}</span></p></div>
    </div> : <Empty>{tr("All this client's work is invoiced already.")}</Empty>) : null}
    <Txt label={tr("Notes")} value={x.notes} onChange={set("notes")} />
    <SaveBtn onClick={save} disabled={!lines.length}>{tr("Make the invoice")}</SaveBtn>
  </div>;
}
export function InvoiceView({ s, run, sheet, close, money, saveFile, setSheet }) {
  const v = P.invoiceStatus(s).find((x) => x.id === sheet.id);
  if (!v) return <Empty>{tr("This invoice was deleted.")}</Empty>;
  const [l, tone] = ST[v.status];
  const del = async () => { if (await askConfirm("Delete this invoice? Its work can be invoiced again; the number is not reused.", { yes: "Delete" })) { if (run((x) => F.remove(x, "invoices", v.id), tr("In the Recycle Bin for 7 days"))) close(); } };
  return <div className="space-y-3" data-testid="fleet-invoice-view">
    <div className={card + " p-4 space-y-1"}>
      <div className="flex items-center gap-2"><p className="text-[20px] font-extrabold" dir="ltr">{v.no}</p><Tag tone={tone}>{tr(l)}</Tag></div>
      <p className="text-[14px]" dir="auto">{nameOf(s.clients, v.client)}</p>
      <p className={"text-[12.5px] " + muted}>{F.showDate(v.date)} · {tr("due")} {F.showDate(v.due)}{v.late ? " · " + tr("{d} days late", { d: v.late }) : ""}</p>
      {v.lines.map((x) => <p key={x.job} className="text-[13px] flex gap-2"><span className="flex-1 min-w-0" dir="auto">{x.desc}</span><span className="tabular-nums" dir="ltr">{num(x.amount)}</span></p>)}
      <div className="border-t border-[var(--c-ln)] pt-1.5 mt-1 text-[13px] space-y-0.5">
        <p className="flex justify-between"><span>{tr("Subtotal")}</span><span className="tabular-nums" dir="ltr">{money(v.sub)}</span></p>
        {v.vat ? <p className="flex justify-between"><span>{tr("VAT")} {v.vatPct}%</span><span className="tabular-nums" dir="ltr">{money(v.vat)}</span></p> : null}
        {v.wht ? <p className="flex justify-between"><span>{tr("Withholding tax")} {v.whtPct}%</span><span className="tabular-nums" dir="ltr">−{money(v.wht)}</span></p> : null}
        <p className="flex justify-between font-bold"><span>{tr("Net to pay")}</span><span className="tabular-nums" dir="ltr">{money(v.net)}</span></p>
        <p className="flex justify-between"><span>{tr("Paid")}</span><span className="tabular-nums" dir="ltr">{money(v.paid)}</span></p>
        {v.onCheque ? <p className="flex justify-between"><span>{tr("On cheques not yet due")}</span><span className="tabular-nums" dir="ltr">{money(v.onCheque)}</span></p> : null}
        <p className="flex justify-between font-extrabold text-[15px]"><span>{tr("Left to pay")}</span><span className="tabular-nums" dir="ltr" data-testid="fleet-invoice-left">{money(v.left)}</span></p></div>
    </div>
    <div className="flex flex-wrap gap-2">
      <button className={btnP + " h-10"} style={{ background: "var(--c-acc)" }} onClick={() => printHTML(P.invoiceHTML(s, v.id, { rtl: isAr() }), saveFile, v.no + ".html")} data-testid="fleet-invoice-print"><Printer size={15} />{tr("Print / PDF")}</button>
      {v.left > 0 ? <button className={btnS} onClick={() => setSheet({ kind: "cheque", dir: "in", client: v.client })} data-testid="fleet-invoice-pay"><Wallet size={15} />{tr("Payment received")}</button> : null}
      <button className={btnS + " text-[var(--c-neg)]"} onClick={del} data-testid="fleet-invoice-del"><Trash2 size={15} />{tr("Delete")}</button></div>
  </div>;
}

// ---- Money → Aging --------------------------------------------------------------------------------------------------------
export function AgingPane({ s, money, setOpen }) {
  const a = P.aging(s);
  const H = [["current", "Not due"], ["d30", "1–30"], ["d60", "31–60"], ["d90", "61–90"], ["over90", "90+"], ["notInvoiced", "Not invoiced"], ["total", "Total"]];
  if (!a.rows.length) return <Empty>{tr("No client owes you anything.")}</Empty>;
  return <div className="space-y-2.5" data-testid="fleet-aging">
    <p className={"text-[12.5px] " + muted}>{tr("What each client still owes, by how many days its invoices are past due. The oldest debts are the hardest to collect — call those first.")}</p>
    <div className={card + " overflow-x-auto"}><table className="w-full text-[13px]"><thead><tr className={"text-[11.5px] tracking-[0.02em] bg-[var(--c-surf-2)] " + muted}><th className="px-3 py-2.5 text-start font-extrabold">{tr("Client")}</th>{H.map(([k, l]) => <th key={k} className="px-3 py-2.5 text-end font-extrabold whitespace-nowrap">{tr(l)}</th>)}</tr></thead>
      <tbody>{a.rows.map((r) => <tr key={r.client.id} className="border-t border-[var(--c-ln)] cursor-pointer hover:bg-[var(--c-surf-2)]" onClick={() => setOpen({ kind: "client", id: r.client.id })} data-testid="fleet-aging-row">
        <td className="px-3 py-2.5 whitespace-nowrap" dir="auto">{r.client.name}</td>{H.map(([k]) => <td key={k} className={"px-3 py-2.5 text-end tabular-nums " + ((k === "d90" || k === "over90") && r[k] ? "text-[var(--c-neg)] font-semibold" : k === "total" ? "font-bold" : "")} dir="ltr">{r[k] ? num(r[k]) : "—"}</td>)}</tr>)}
        <tr className="border-t-2 border-[var(--c-ln)] font-bold"><td className="px-3 py-2.5">{tr("Total")}</td>{H.map(([k]) => <td key={k} className="px-3 py-2.5 text-end tabular-nums" dir="ltr">{num(a.sum[k])}</td>)}</tr></tbody></table></div>
    <p className={"text-[12.5px] " + muted}>{tr("Total owed: {v}", { v: money(a.sum.total) })}</p>
  </div>;
}

// ---- Money → Reports -------------------------------------------------------------------------------------------------------
export function ReportsPane({ s, money }) {
  const [rep, setRep] = useState("use"), [ym, setYm] = useState(ymOf(F.isoDay())), [year, setYear] = useState(+F.isoDay().slice(0, 4));
  return <div className="space-y-2.5" data-testid="fleet-reports">
    <Seg value={rep} onChange={setRep} items={[["use", "Utilisation"], ["revenue", "Revenue by month"], ["fuel", "Fuel"]]} testid="fleet-rseg" />
    {rep === "use" ? <>
      <MonthPick ym={ym} setYm={setYm} testid="fleet-use-month" />
      <p className={"text-[12.5px] " + muted}>{tr("Days each crane worked, was broken down, or stood idle. An idle crane costs money every day — offer it first.")}</p>
      {P.utilisation(s, ym).map((r) => <div key={r.crane.id} className={card + " p-3.5 space-y-1.5"} data-testid="fleet-use-row">
        <div className="flex items-center gap-2"><b className="flex-1 min-w-0 truncate text-[14px]" dir="auto">{r.crane.name}</b><span className="text-[15px] font-extrabold tabular-nums" dir="ltr">{r.pct}%</span></div>
        <div className="h-2.5 rounded-full overflow-hidden flex bg-[var(--c-surf-2)]" aria-hidden="true"><span style={{ width: (r.days ? (r.worked / r.days) * 100 : 0) + "%", background: "var(--c-acc)" }} /><span style={{ width: (r.days ? (r.down / r.days) * 100 : 0) + "%", background: "var(--c-neg)" }} /></div>
        <p className={"text-[12px] " + muted}>{tr("{w} worked · {d} down · {i} idle of {n} days", { w: r.worked, d: r.down, i: r.idle, n: r.days })}</p></div>)}
    </> : rep === "revenue" ? (() => { const m = P.revenueMatrix(s, year), M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return <>
        <div className="flex items-center gap-2"><button className={btnS + " w-11 px-0"} aria-label={tr("Previous year")} onClick={() => setYear(year - 1)}><ChevronLeft size={16} className="rtl:rotate-180" /></button><b className="tabular-nums" dir="ltr">{year}</b><button className={btnS + " w-11 px-0"} aria-label={tr("Next year")} onClick={() => setYear(year + 1)}><ChevronRight size={16} className="rtl:rotate-180" /></button>
          <span className={"ms-auto text-[13px] " + muted}>{tr("Year")}: <b className="tabular-nums" dir="ltr">{money(m.total)}</b></span></div>
        <div className={card + " overflow-x-auto"} data-testid="fleet-revenue"><table className="w-full text-[12.5px]"><thead><tr className={"text-[11.5px] tracking-[0.02em] bg-[var(--c-surf-2)] " + muted}><th className="px-2.5 py-2 text-start font-extrabold">{tr("Crane")}</th>{M.map((x) => <th key={x} className="px-2.5 py-2 text-end font-extrabold">{tr(x)}</th>)}<th className="px-2.5 py-2 text-end font-extrabold">{tr("Total")}</th></tr></thead>
          <tbody>{m.rows.map((r) => <tr key={r.crane.id} className="border-t border-[var(--c-ln)]"><td className="px-2.5 py-2 whitespace-nowrap" dir="auto">{r.crane.name}</td>{r.months.map((v, i) => <td key={i} className="px-2.5 py-2 text-end tabular-nums" dir="ltr">{v ? num(v) : "—"}</td>)}<td className="px-2.5 py-2 text-end tabular-nums font-bold" dir="ltr">{num(r.total)}</td></tr>)}
            <tr className="border-t-2 border-[var(--c-ln)] font-bold"><td className="px-2.5 py-2">{tr("Total")}</td>{m.months.map((v, i) => <td key={i} className="px-2.5 py-2 text-end tabular-nums" dir="ltr">{v ? num(v) : "—"}</td>)}<td className="px-2.5 py-2 text-end tabular-nums" dir="ltr">{num(m.total)}</td></tr></tbody></table></div></>; })()
    : <div className="space-y-2" data-testid="fleet-fuel-report">{F.live(s.cranes).map((c) => { const f = P.fuelReport(s, c.id).slice(-4).reverse(); if (!f.length) return null;
        return <div key={c.id} className={card + " p-3.5"}><b className="block text-[14px] mb-1" dir="auto">{c.name}</b>
          {f.map((m) => <p key={m.ym} className={"flex gap-2 text-[13px] py-0.5 " + (m.high ? "text-[var(--c-neg)] font-semibold" : "")}><span dir="ltr" className="w-16">{showYm(m.ym)}</span><span className="flex-1" dir="ltr">{num(m.litres)} L · {money(m.cost)}</span><span dir="ltr">{m.lph != null ? num(m.lph) + " L/h" : "—"}</span>{m.high ? <AlertTriangle size={14} className="mt-0.5" /> : null}</p>)}</div>; })}
      {!F.live(s.cranes).some((c) => P.fuelReport(s, c.id).length) ? <Empty>{tr("No fuel logged yet — add it from a crane's page.")}</Empty> : null}</div>}
  </div>;
}

// ---- Fleet → Team -----------------------------------------------------------------------------------------------------------
export function TeamPane({ s, run, money, setSheet }) {
  const [ym, setYm] = useState(ymOf(F.isoDay()));
  const people = F.live(s.people || []), pay = P.payroll(s, ym), t = F.isoDay();
  return <div className="space-y-3" data-testid="fleet-team">
    {people.length ? <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2.5 lg:space-y-0">{people.map((p) => { const left = p.licenceExp ? F.daysBetween(t, p.licenceExp) : null;
      return <Row key={p.id} onClick={() => setSheet({ kind: "person", rec: p })} testid="fleet-person">
        <span className="w-10 h-10 rounded-[14px] grid place-items-center shrink-0 bg-[var(--c-soft)] text-[var(--c-acc)]"><Users size={18} /></span>
        <span className="flex-1 min-w-0"><span className="block font-bold text-[14.5px] truncate" dir="auto">{p.name}</span>
          <span className="flex items-center gap-1.5 mt-0.5 flex-wrap"><Tag tone="blue">{tr(ROLE_L[p.role] || p.role)}</Tag>{p.crane ? <span className={"text-[12px] truncate " + muted} dir="auto">{nameOf(s.cranes, p.crane)}</span> : null}
            {left != null && left < 0 ? <Tag tone="red">{tr("Licence expired")}</Tag> : left != null && left <= 30 ? <Tag tone="amber">{tr("Licence: {d} days", { d: left })}</Tag> : null}</span></span>
        <span className="text-[12.5px] tabular-nums" dir="ltr">{p.salary ? money(p.salary) + "/" + tr("mo") : p.wage ? money(p.wage) + "/" + tr("day") : ""}</span></Row>; })}</div>
      : <Empty>{tr("Add your operators, drivers, riggers and mechanics — their licences, wages and advances.")}</Empty>}
    {people.length ? <div className={card + " p-3.5 space-y-2"} data-testid="fleet-payroll">
      <div className="flex items-center gap-2"><b className="flex-1 text-[15px]">{tr("Payroll")}</b><MonthPick ym={ym} setYm={setYm} testid="fleet-pay-month" /></div>
      <p className={"text-[12px] " + muted}>{tr("Days come from the work of each person's crane; type a number to change it.")}</p>
      <div className="overflow-x-auto"><table className="w-full text-[13px]"><thead><tr className={"text-[11.5px] tracking-[0.02em] bg-[var(--c-surf-2)] " + muted}>{["Name", "Days", "Gross", "Advances", "Net"].map((h, i) => <th key={h} className={"px-2 py-2 font-extrabold " + (i ? "text-end" : "text-start")}>{tr(h)}</th>)}<th /></tr></thead>
        <tbody>{pay.rows.map((r) => <tr key={r.person.id} className="border-t border-[var(--c-ln)]" data-testid="fleet-pay-row">
          <td className="px-2 py-2" dir="auto">{r.person.name}</td>
          <td className="px-2 py-1 text-end"><input defaultValue={r.days} key={ym + r.person.id + r.days} inputMode="numeric" className={inp + " w-16 text-end px-2"} dir="ltr" data-testid="fleet-pay-days" disabled={r.person.salary > 0}
            onBlur={(e) => { const v = e.target.value.trim(); if (String(r.days) !== v) run((x) => P.setDays(x, r.person.id, ym, v === "" ? null : v)); }} /></td>
          <td className="px-2 py-2 text-end tabular-nums" dir="ltr">{num(r.gross)}</td><td className="px-2 py-2 text-end tabular-nums" dir="ltr">{r.advances ? "−" + num(r.advances) : "—"}</td><td className="px-2 py-2 text-end tabular-nums font-bold" dir="ltr">{num(r.net)}</td>
          <td className="px-1"><button className={btnS + " h-8 px-2 text-[12px]"} onClick={() => setSheet({ kind: "advance", person: r.person.id })} data-testid="fleet-advance">{tr("Advance")}</button></td></tr>)}
          <tr className="border-t-2 border-[var(--c-ln)] font-bold"><td className="px-2 py-2">{tr("Total")}</td><td /><td className="px-2 py-2 text-end tabular-nums" dir="ltr">{num(pay.sum.gross)}</td><td className="px-2 py-2 text-end tabular-nums" dir="ltr">{num(pay.sum.advances)}</td><td className="px-2 py-2 text-end tabular-nums" dir="ltr" data-testid="fleet-pay-total">{num(pay.sum.net)}</td><td /></tr></tbody></table></div>
    </div> : null}
  </div>;
}
export function PersonForm({ s, run, sheet, close }) {
  const [r, setR] = useState({ role: "operator", ...sheet.rec });
  const set = (k) => (v) => setR({ ...r, [k]: v });
  const adv = F.live(s.advances || []).filter((a) => a.person === r.id).slice(-6).reverse();
  return <div className="space-y-3" data-testid="fleet-person-form">
    <Txt label={tr("Name")} value={r.name} onChange={set("name")} testid="fleet-f-pname" />
    <div className="grid grid-cols-2 gap-2"><Sel label={tr("Role")} value={r.role} onChange={set("role")} options={P.ROLES.map((x) => ({ v: x, l: tr(ROLE_L[x]) }))} testid="fleet-f-role" /><Txt label={tr("Phone")} value={r.phone} onChange={set("phone")} mode="tel" dir="ltr" /></div>
    <Sel label={tr("Works on crane")} value={r.crane || ""} onChange={set("crane")} options={opts(s.cranes)} empty={tr("— none —")} testid="fleet-f-pcrane" />
    <div className="grid grid-cols-2 gap-2"><Txt label={tr("Day wage")} value={r.wage} onChange={set("wage")} mode="decimal" testid="fleet-f-wage" /><Txt label={tr("Or monthly salary")} value={r.salary} onChange={set("salary")} mode="decimal" /></div>
    <div className="grid grid-cols-2 gap-2"><Txt label={tr("Licence no.")} value={r.licence} onChange={set("licence")} dir="ltr" /><DateF label={tr("Licence expires")} value={r.licenceExp || ""} onChange={set("licenceExp")} testid="fleet-f-lic" /></div>
    <SaveBtn onClick={() => { if (run((x) => P.upsertPerson(x, r), tr("Saved"))) close(); }} disabled={!String(r.name || "").trim()} />
    {adv.length ? <div className={card + " p-3"}><p className="font-bold text-[13.5px] mb-1">{tr("Advances")}</p>{adv.map((a) => <p key={a.id} className="flex justify-between text-[13px] py-0.5"><span dir="ltr">{F.showDate(a.date)}</span><span className="tabular-nums" dir="ltr">{num(a.amount)}</span></p>)}</div> : null}
    {r.id ? <button className={btnS + " w-full text-[var(--c-neg)]"} onClick={async () => { if (await askConfirm("Move this person to the Recycle Bin?", { yes: "Delete" })) { if (run((x) => F.remove(x, "people", r.id), tr("In the Recycle Bin for 7 days"))) close(); } }}><Trash2 size={15} />{tr("Delete")}</button> : null}
  </div>;
}
export function AdvanceForm({ s, run, sheet, close }) {
  const [x, setX] = useState({ person: sheet.person, date: F.isoDay(), amount: "", notes: "" });
  const set = (k) => (v) => setX({ ...x, [k]: v });
  return <div className="space-y-3" data-testid="fleet-advance-form">
    <p className="text-[14px] font-semibold" dir="auto">{nameOf(s.people || [], x.person)}</p>
    <DateF label={tr("Date")} value={x.date} onChange={set("date")} /><Txt label={tr("Amount")} value={x.amount} onChange={set("amount")} mode="decimal" testid="fleet-f-adv" /><Txt label={tr("Notes")} value={x.notes} onChange={set("notes")} />
    <SaveBtn onClick={() => { if (run((st) => P.addAdvance(st, x), tr("Advance saved — it comes off this month's pay"))) close(); }} />
  </div>;
}

// ---- a crane's page: papers, breakdowns, fuel -------------------------------------------------------------------------------
export function CraneMore({ s, run, money, setSheet, id }) {
  const t = F.isoDay();
  const docs = F.live(s.docs || []).filter((d) => d.crane === id).sort((a, b) => (a.expiry < b.expiry ? -1 : 1));
  const reps = F.live(s.repairs || []).filter((r) => r.crane === id).slice(-5).reverse();
  const fuel = P.fuelReport(s, id).slice(-3).reverse();
  return <div className="space-y-3" data-testid="fleet-crane-more">
    <div className="flex flex-wrap gap-2">
      <button className={btnS} onClick={() => setSheet({ kind: "paper", crane: id })} data-testid="fleet-add-paper"><ShieldCheck size={15} />{tr("Add a paper")}</button>
      <button className={btnS} onClick={() => setSheet({ kind: "repair", crane: id })} data-testid="fleet-add-repair"><Wrench size={15} />{tr("Breakdown")}</button>
      <button className={btnS} onClick={() => setSheet({ kind: "fuel", crane: id })} data-testid="fleet-add-fuel"><Fuel size={15} />{tr("Fuel")}</button></div>
    {docs.length ? <div className={card + " p-4"} data-testid="fleet-papers"><p className="font-bold text-[14.5px] mb-1.5">{tr("Papers")}</p>
      {docs.map((d) => { const left = F.daysBetween(t, d.expiry);
        return <button key={d.id} className="w-full flex items-center gap-2 py-1.5 text-start text-[13.5px]" onClick={() => setSheet({ kind: "paper", crane: id, rec: d })}>
          <span className="flex-1 min-w-0" dir="auto">{d.title || tr(DOC_L[d.kind])}{d.no ? <span className={muted} dir="ltr"> · {d.no}</span> : null}</span>
          <Tag tone={left < 0 ? "red" : left <= 30 ? "amber" : "green"}>{left < 0 ? tr("Expired {d} days ago", { d: -left }) : tr("Until {d}", { d: F.showDate(d.expiry) })}</Tag></button>; })}</div> : null}
    {reps.length ? <div className={card + " p-4"} data-testid="fleet-repairs"><p className="font-bold text-[14.5px] mb-1.5">{tr("Breakdowns")}</p>
      {reps.map((r) => <div key={r.id} className="flex items-center gap-2 py-1.5 text-[13.5px]">
        <span className="flex-1 min-w-0" dir="auto">{F.showDate(r.from)} → {r.to ? F.showDate(r.to) : tr("still down")}{r.cause ? " · " + r.cause : ""}</span>
        {r.cost ? <span className="tabular-nums" dir="ltr">{money(r.cost)}</span> : null}
        {!r.to ? <button className={btnS + " h-8 px-2 text-[12px]"} onClick={() => run((x) => P.closeRepair(x, r.id), tr("Back at work"))} data-testid="fleet-repair-fixed"><Check size={13} />{tr("Fixed today")}</button> : null}</div>)}</div> : null}
    {fuel.length ? <div className={card + " p-4"} data-testid="fleet-fuel"><p className="font-bold text-[14.5px] mb-1.5">{tr("Fuel")}</p>
      {fuel.map((m) => <p key={m.ym} className={"flex gap-2 text-[13px] py-0.5 " + (m.high ? "text-[var(--c-neg)] font-semibold" : "")}><span dir="ltr" className="w-16">{showYm(m.ym)}</span><span className="flex-1" dir="ltr">{num(m.litres)} L · {money(m.cost)}</span><span dir="ltr">{m.lph != null ? num(m.lph) + " L/h" : "—"}</span></p>)}
      {fuel[0] && fuel[0].high ? <p className="text-[12.5px] text-[var(--c-neg)] mt-1">{tr("{l} L/h this month against a usual {u} — check for a leak, the tank, or the engine.", { l: num(fuel[0].lph), u: num(fuel[0].usual) })}</p> : null}</div> : null}
  </div>;
}
export function PaperForm({ s, run, sheet, close, flash }) {
  const [d, setD] = useState({ kind: "licence", crane: sheet.crane, expiry: "", ...sheet.rec });
  const set = (k) => (v) => setD({ ...d, [k]: v });
  return <div className="space-y-3" data-testid="fleet-paper-form">
    <Sel label={tr("Paper")} value={d.kind} onChange={set("kind")} options={P.DOC_KINDS.map((k) => ({ v: k, l: tr(DOC_L[k]) }))} testid="fleet-f-pkind" />
    {d.kind === "other" ? <Txt label={tr("Name")} value={d.title} onChange={set("title")} /> : null}
    <div className="grid grid-cols-2 gap-2"><Txt label={tr("Number")} value={d.no} onChange={set("no")} dir="ltr" /><DateF label={tr("Expires")} value={d.expiry} onChange={set("expiry")} testid="fleet-f-pexp" /></div>
    <Evidence value={d.evidence} onChange={set("evidence")} flash={flash} />
    <SaveBtn onClick={() => { if (run((x) => P.upsertDoc(x, d), tr("Saved — Attune warns you before it runs out"))) close(); }} disabled={!d.expiry} />
    {d.id ? <button className={btnS + " w-full text-[var(--c-neg)]"} onClick={async () => { if (await askConfirm("Move this paper to the Recycle Bin?", { yes: "Delete" })) { if (run((x) => F.remove(x, "docs", d.id))) close(); } }}><Trash2 size={15} />{tr("Delete")}</button> : null}
  </div>;
}
export function RepairForm({ s, run, sheet, close, flash }) {
  const [r, setR] = useState({ crane: sheet.crane, from: F.isoDay(), to: "", cause: "", cost: "" });
  const set = (k) => (v) => setR({ ...r, [k]: v });
  return <div className="space-y-3" data-testid="fleet-repair-form">
    <p className="text-[14px] font-semibold" dir="auto">{nameOf(s.cranes, r.crane)}</p>
    <div className="grid grid-cols-2 gap-2"><DateF label={tr("Broke down on")} value={r.from} onChange={set("from")} /><DateF label={tr("Fixed on (empty = still down)")} value={r.to} onChange={set("to")} /></div>
    <Txt label={tr("What broke")} value={r.cause} onChange={set("cause")} testid="fleet-f-cause" />
    <Txt label={tr("Repair cost (saved as a Maintenance expense)")} value={r.cost} onChange={set("cost")} mode="decimal" testid="fleet-f-rcost" />
    <Evidence value={r.evidence} onChange={set("evidence")} flash={flash} />
    <SaveBtn onClick={() => { if (run((x) => P.addRepair(x, r), tr("Saved"))) close(); }} />
  </div>;
}
export function FuelForm({ s, run, sheet, close, flash }) {
  const [f, setF] = useState({ crane: sheet.crane, date: F.isoDay(), litres: "", cost: "" });
  const set = (k) => (v) => setF({ ...f, [k]: v });
  return <div className="space-y-3" data-testid="fleet-fuel-form">
    <p className="text-[14px] font-semibold" dir="auto">{nameOf(s.cranes, f.crane)}</p>
    <DateF label={tr("Date")} value={f.date} onChange={set("date")} />
    <div className="grid grid-cols-2 gap-2"><Txt label={tr("Litres")} value={f.litres} onChange={set("litres")} mode="decimal" testid="fleet-f-litres" /><Txt label={tr("Cost")} value={f.cost} onChange={set("cost")} mode="decimal" testid="fleet-f-fcost" /></div>
    <Evidence value={f.evidence} onChange={set("evidence")} flash={flash} />
    <SaveBtn onClick={() => { if (run((x) => P.addFuel(x, f), tr("Fuel saved"))) close(); }} />
  </div>;
}
