/* ---- v6.32 Business "Pro" — the screens: the "Business" tab of every built system ------------------------------------
   Ali: every system (a grocery store, any company) as good and professional as his crane system. One page, minimal
   design A: the month's numbers · what needs you (overdue, low stock) · stock on hand · who owes what (statements) ·
   tools (sample data, Excel, recycle bin, the rules it follows). Logic: erp-pro.js. Tests: tests/e2e_v732pro.py.   */
import React, { useState } from "react";
import { X, Printer, Download, Trash2, Package, Wallet, AlertTriangle, Check, Sparkles, ChevronRight, Undo2 } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as E from "./erp.js";
import * as P from "./erp-pro.js";
import { insights } from "./erp-insights.js";   // v6.44: trend, top customers, statuses, bookings, stock value
import { xlsxFromSheets } from "./convert.js";
import { useSubBack } from "./backstack.js";
import { askConfirm } from "./confirm.jsx";

const card = "rounded-2xl bg-[#FFFFFF] border border-[#DCE3EC] shadow-[0_1px_3px_rgba(15,23,42,.06)]";
const btnS = "h-10 px-3 rounded-xl border border-[#DCE3EC] bg-[#FFFFFF] text-[13.5px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40";
const muted = "text-[#5B6B80]";
const today = () => new Date().toISOString().slice(0, 10);
const money = (sys, n) => E.show(sys, { type: "money" }, n || 0);
const dmy = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d\d)-(\d\d)/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };
const ar = () => getLang() === "ar";

export function saveOut(saveFile, name, data, mime) {
  if (saveFile) {
    if (data instanceof Uint8Array) { let s = ""; for (let i = 0; i < data.length; i += 0x8000) s += String.fromCharCode.apply(null, data.subarray(i, i + 0x8000)); return saveFile(name, "", mime, btoa(s)); }
    return saveFile(name, data, mime);
  }
  try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); } catch (e) {}
}
/** Print a page (or save it, where printing isn't possible). Also used by the Form's Print button. */
export function printPage(html, saveFile, name) {
  if (typeof window !== "undefined") window.__lastPrint = html;
  try {
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
    document.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
    setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { saveOut(saveFile, name, html, "text/html"); } setTimeout(() => f.remove(), 2000); }, 200);
  } catch (e) { saveOut(saveFile, name, html, "text/html"); }
}
export const docWords = () => ({ date: tr("Date"), total: tr("Total"), sign: tr("Signature"), received: tr("Received by"), title: tr("Statement of account"), what: tr("Details"), debit: tr("Debit"), credit: tr("Credit"), balance: tr("Balance") });
export function printRecord(sys, tid, rid, saveFile) {
  printPage(P.recordDoc(sys, tid, rid, { company: sys.company || sys.name, rtl: ar(), words: docWords() }), saveFile, "document.html");
}

function Kpi({ label, value, tone, testid }) {
  return <div className={card + " p-3"} data-testid={testid}><p className="text-[20px] font-extrabold tabular-nums leading-tight" style={tone ? { color: tone } : null}>{value}</p><p className={"text-[11.5px] leading-snug " + muted}>{label}</p></div>;
}

/** v6.44 Insights — for any system: the last 6 months, the top customers, every status, bookings, stock value. */
function Insights({ sys }) {
  const I = insights(sys, today());
  const top = Math.max(1, ...I.series.map((x) => x.total));
  const any = I.series.some((x) => x.total) || I.statuses.length || I.usage.length || I.stock.some((x) => x.value);
  if (!any) return null;
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return <div className="space-y-3" data-testid="biz-insights">
    {I.series.some((x) => x.total) ? <div className={card + " p-3.5"} data-testid="biz-insights-trend">
      <p className="text-[13px] font-bold mb-2">{tr("The last 6 months")}{I.change != null ? <span className={"ms-2 font-semibold " + (I.change >= 0 ? "text-emerald-700" : "text-[#B91C1C]")}>{I.change >= 0 ? "+" : ""}{I.change}% {tr("vs last month")}</span> : null}</p>
      <div className="flex items-end gap-1.5 h-24">{I.series.map((x) => <div key={x.ym} className="flex-1 flex flex-col items-center gap-1"><span className="w-full rounded-t-md" style={{ height: Math.max(2, (x.total / top) * 80), background: "var(--biz)" }} /><span className={"text-[10.5px] " + muted}>{tr(M[+x.ym.slice(5, 7) - 1])}</span></div>)}</div>
      <p className={"text-[12px] mt-1 " + muted}>{tr("This month")}: <b>{money(sys, I.thisMonth)}</b></p></div> : null}
    {I.top.length ? <div className={card + " p-3.5"} data-testid="biz-insights-top"><p className="text-[13px] font-bold mb-1.5">{tr("Top this year")}</p>
      {I.top.map((x, i) => <p key={i} className="flex justify-between gap-2 text-[13px] py-0.5"><span className="truncate" dir="auto">{i + 1}. {x.name} <span className={muted}>· {tr("{n} records", { n: x.count })}</span></span><b className="tabular-nums shrink-0">{money(sys, x.total)}</b></p>)}</div> : null}
    {I.usage.map((u) => <div key={u.table} className={card + " p-3.5"} data-testid="biz-insights-usage"><p className="text-[13px] font-bold mb-1.5"><span dir="auto">{u.assets}</span> · {tr("booked this month")} <span className={muted}>({tr("average {p}%", { p: u.avg })})</span></p>
      {u.rows.slice(0, 8).map((r, i) => <div key={i} className="flex items-center gap-2 text-[12.5px] py-0.5"><span className="w-28 truncate" dir="auto">{r.name}</span><span className="flex-1 h-2 rounded-full bg-[#EEF2F7] overflow-hidden"><span className="block h-full" style={{ width: r.pct + "%", background: "var(--biz)" }} /></span><span className="w-10 text-end tabular-nums">{r.pct}%</span></div>)}</div>)}
    {I.statuses.length ? <div className={card + " p-3.5"} data-testid="biz-insights-status"><p className="text-[13px] font-bold mb-1.5">{tr("By status")}</p>
      {I.statuses.map((x) => <div key={x.tid} className="py-1"><p className={"text-[12px] " + muted} dir="auto">{x.table} · {x.total}</p><div className="flex flex-wrap gap-1.5 mt-0.5">{x.counts.map((c) => <span key={c.value} className="px-2 py-0.5 rounded-full bg-[#EEF2F7] text-[12px]" dir="auto">{c.value} <b>{c.n}</b></span>)}</div></div>)}</div> : null}
    {I.stock.filter((x) => x.value != null).map((x) => <div key={x.table} className={card + " p-3.5 flex justify-between text-[13px]"} data-testid="biz-insights-stock"><span dir="auto">{tr("Stock value at cost")} · {x.table}</span><b className="tabular-nums">{money(sys, x.value)}</b></div>)}
  </div>;
}

/** The Business tab. */
export function ProPanel({ sys, setSys, flash, saveFile, go, wide }) {
  const [stmt, setStmt] = useState(null);        // { p, id }
  const [bin, setBin] = useState(false), [rulesOpen, setRulesOpen] = useState(false), [allStock, setAllStock] = useState(false);
  const d = today(), o = P.overview(sys, d), R = P.rules(sys);
  const tname = (tid) => (sys.tables.find((t) => t.id === tid) || {}).name || "";
  const empty = !sys.tables.some((t) => (sys.rows[t.id] || []).length);
  const demo = P.hasDemo(sys);
  const excel = () => { try { saveOut(saveFile, (sys.name || "system").replace(/[^\p{L}\p{N}]+/gu, "-") + "-" + d + ".xlsx", xlsxFromSheets(P.sheets(sys)), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); flash(tr("Saved {f}", { f: "Excel" })); } catch (e) { flash(tr(e.message)); } };
  const binN = P.binList(sys).length;
  const nothing = !o.has.stock && !o.has.balances && !o.has.dues && !o.has.bookings;
  return (
    <div className="space-y-3" data-testid="biz-pro">
      <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${wide ? 5 : 2}, minmax(0, 1fr))` }} data-testid="biz-pro-kpis">
        {o.has.balances ? <Kpi label={tr("Sales this month")} value={money(sys, o.monthSales)} tone="var(--biz)" testid="biz-pro-month" /> : null}
        {o.has.balances ? <Kpi label={tr("Owed to you")} value={money(sys, o.receivable)} testid="biz-pro-owed" /> : null}
        {o.payable ? <Kpi label={tr("You owe suppliers")} value={money(sys, o.payable)} testid="biz-pro-payable" /> : null}
        {o.has.stock ? <Kpi label={tr("Low stock")} value={o.low.length} tone={o.low.length ? "#B45309" : null} testid="biz-pro-low" /> : null}
        {o.has.dues ? <Kpi label={tr("Due or overdue")} value={o.due.length} tone={o.due.some((x) => x.overdue) ? "#B91C1C" : null} testid="biz-pro-due" /> : null}
      </div>

      <Insights sys={sys} />
      {nothing ? <div className={card + " p-4 text-[13.5px] " + muted} data-testid="biz-pro-none">{tr("This system has no stock, balances, due dates or bookings yet. Ask the AI to add them, e.g. \"add a Payments table linked to Invoices\".")}</div> : null}

      {o.due.length || o.low.length ? <div className={card + " p-3.5 space-y-1.5"} data-testid="biz-pro-warn"><p className="text-[13px] font-bold flex items-center gap-1.5"><AlertTriangle size={15} className="text-amber-600" />{tr("Needs you")}</p>
        {o.due.slice(0, 8).map((x) => <button key={x.rid + x.field} onClick={() => go("form", x.tid)} className="w-full flex justify-between gap-2 text-start text-[13px]" data-testid="biz-pro-due-row">
          <span className="truncate" dir="auto">{x.table}: {x.name} · {x.field}</span><span className={"shrink-0 font-semibold " + (x.overdue ? "text-[#B91C1C]" : "text-amber-700")}>{x.overdue ? tr("{n} days late", { n: -x.left }) : x.left === 0 ? tr("today") : tr("in {n} days", { n: x.left })}</span></button>)}
        {o.low.slice(0, 8).map((x) => <button key={x.row._id} onClick={() => go("form", x.tid)} className="w-full flex justify-between gap-2 text-start text-[13px]" data-testid="biz-pro-low-row">
          <span className="truncate" dir="auto">{tr("Low stock")}: {x.name}</span><span className="shrink-0 font-semibold text-amber-700 tabular-nums">{x.onHand}{x.reorder != null ? " / " + x.reorder : ""}</span></button>)}
      </div> : null}

      <div className={wide ? "grid grid-cols-2 gap-3 items-start" : "space-y-3"}>
        {R.stock.map((s) => { const lv = P.stockLevels(sys, s); const shown = allStock ? lv : lv.slice(0, 8); return (
          <div key={s.items} className={card + " p-3.5"} data-testid="biz-pro-stock">
            <p className="text-[13px] font-bold flex items-center gap-1.5 mb-2"><Package size={15} style={{ color: "var(--biz)" }} />{tr("Stock on hand")} · <span dir="auto">{tname(s.items)}</span></p>
            {lv.length ? <table className="w-full text-[12.5px]"><thead><tr className={muted}><th className="text-start font-semibold pb-1">{tr("Item")}</th><th className="text-end font-semibold">{tr("Qty in")}</th><th className="text-end font-semibold">{tr("Qty out")}</th><th className="text-end font-semibold">{tr("On hand")}</th></tr></thead>
              <tbody>{shown.map((x) => <tr key={x.row._id} className="border-t border-[#EEF2F7]" data-testid="biz-pro-stock-row"><td className="py-1.5 truncate max-w-[9rem]" dir="auto">{x.name}</td><td className="text-end tabular-nums">{x.opening + x.in}</td><td className="text-end tabular-nums">{x.out}</td>
                <td className={"text-end tabular-nums font-bold " + (x.low ? "text-amber-700" : "")}>{x.onHand}</td></tr>)}</tbody></table> : <p className={"text-[13px] " + muted}>{tr("No records yet")}</p>}
            {lv.length > 8 ? <button className={"text-[12.5px] font-semibold mt-1"} style={{ color: "var(--biz)" }} onClick={() => setAllStock(!allStock)}>{allStock ? tr("Show less") : tr("Show all {n}", { n: lv.length })}</button> : null}
          </div>); })}
        {R.parties.map((p) => { const b = P.balances(sys, p); return (
          <div key={p.tid} className={card + " p-3.5"} data-testid="biz-pro-balances">
            <p className="text-[13px] font-bold flex items-center gap-1.5 mb-2"><Wallet size={15} style={{ color: "var(--biz)" }} />{tr("Balances")} · <span dir="auto">{tname(p.tid)}</span></p>
            {b.length ? b.slice(0, 10).map((x) => <button key={x.row._id} onClick={() => setStmt({ p, id: x.row._id })} className="w-full flex items-center justify-between gap-2 py-1.5 border-t border-[#EEF2F7] first:border-0 text-start text-[13px]" data-testid="biz-pro-balance">
              <span className="truncate" dir="auto">{x.name}</span><span className={"tabular-nums font-bold shrink-0 " + (x.balance > 0 ? "" : "text-emerald-700")}>{money(sys, x.balance)}<ChevronRight size={14} className={"inline rtl:-scale-x-100 ms-1 " + muted} /></span></button>)
              : <p className={"text-[13px] " + muted}>{tr("No records yet")}</p>}
          </div>); })}
      </div>

      <div className={card + " p-3.5 space-y-2"} data-testid="biz-pro-tools">
        <p className="text-[13px] font-bold">{tr("Tools")}</p>
        <div className="flex flex-wrap gap-2">
          {empty || !demo ? <button className={btnS} data-testid="biz-pro-demo" onClick={() => { const n = P.loadDemo(sys, { today: d }); setSys(n, tr("Sample records added — erase them any time")); }}><Sparkles size={15} />{tr("Add sample records")}</button>
            : <button className={btnS} data-testid="biz-pro-erase-demo" onClick={async () => { if (await askConfirm("Erase all the sample records? Your own records stay.", { yes: "Erase" })) setSys(P.eraseDemo(sys), tr("Sample records erased")); }}><Trash2 size={15} />{tr("Erase sample records")}</button>}
          <button className={btnS} onClick={excel} data-testid="biz-pro-excel"><Download size={15} />{tr("Excel (every table)")}</button>
          <button className={btnS} onClick={() => setBin(true)} data-testid="biz-pro-bin"><Undo2 size={15} />{tr("Recycle bin")}{binN ? " (" + binN + ")" : ""}</button>
          <button className={btnS} onClick={() => setRulesOpen(true)} data-testid="biz-pro-rules"><Check size={15} />{tr("What it does for you")}</button>
        </div>
      </div>

      {stmt ? <Statement sys={sys} p={stmt.p} id={stmt.id} saveFile={saveFile} wide={wide} onClose={() => setStmt(null)} /> : null}
      {bin ? <Bin sys={sys} setSys={setSys} flash={flash} wide={wide} onClose={() => setBin(false)} /> : null}
      {rulesOpen ? <Rules sys={sys} setSys={setSys} wide={wide} onClose={() => setRulesOpen(false)} /> : null}
    </div>
  );
}

function Sheet({ title, onClose, wide, children, testid }) {
  useSubBack(true, onClose);
  return (
    <div className={"fixed inset-0 z-[70] bg-[#0F172A80] flex " + (wide ? "items-center justify-center p-6" : "items-end")} onClick={onClose}>
      <div className={"bg-[#F4F6FA] w-full max-h-[92vh] overflow-y-auto p-4 space-y-3 " + (wide ? "max-w-2xl rounded-3xl" : "rounded-t-3xl pb-8")} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" data-testid={testid}>
        <div className="flex items-center gap-2"><p className="flex-1 text-[17px] font-extrabold" dir="auto">{title}</p>
          <button onClick={onClose} aria-label={tr("Close")} className="w-10 h-10 rounded-full bg-[#FFFFFF] border border-[#DCE3EC] grid place-items-center"><X size={18} /></button></div>
        {children}
      </div>
    </div>);
}

function Statement({ sys, p, id, saveFile, wide, onClose }) {
  const t = sys.tables.find((x) => x.id === p.tid), row = (sys.rows[p.tid] || []).find((r) => r._id === id);
  const s = P.statement(sys, p, id);
  const print = () => printPage(P.statementDoc(sys, p, id, { company: sys.company || sys.name, rtl: ar(), words: docWords() }), saveFile, "statement.html");
  return (
    <Sheet title={tr("Statement of account") + " · " + (row ? E.displayOf(t, row) : "")} onClose={onClose} wide={wide} testid="biz-pro-statement">
      <div className="grid grid-cols-3 gap-2"><Kpi label={tr("Charged")} value={money(sys, s.charged)} /><Kpi label={tr("Paid")} value={money(sys, s.paid)} /><Kpi label={tr("Balance")} value={money(sys, s.balance)} tone="var(--biz)" testid="biz-pro-stmt-balance" /></div>
      <div className={card + " p-3 overflow-x-auto"}>
        {s.lines.length ? <table className="w-full text-[12.5px]"><thead><tr className={muted}><th className="text-start font-semibold pb-1">{tr("Date")}</th><th className="text-start font-semibold">{tr("Details")}</th><th className="text-end font-semibold">{tr("Debit")}</th><th className="text-end font-semibold">{tr("Credit")}</th><th className="text-end font-semibold">{tr("Balance")}</th></tr></thead>
          <tbody>{s.lines.map((l, i) => <tr key={i} className="border-t border-[#EEF2F7]" data-testid="biz-pro-stmt-line"><td className="py-1.5 tabular-nums whitespace-nowrap">{dmy(l.date)}</td><td className="truncate max-w-[10rem]" dir="auto">{l.what}</td><td className="text-end tabular-nums">{l.debit ? money(sys, l.debit) : ""}</td><td className="text-end tabular-nums">{l.credit ? money(sys, l.credit) : ""}</td><td className="text-end tabular-nums font-semibold">{money(sys, l.balance)}</td></tr>)}</tbody></table>
          : <p className={"text-[13px] " + muted}>{tr("No records yet")}</p>}
      </div>
      <button className={btnS + " w-full h-12"} onClick={print} data-testid="biz-pro-stmt-print"><Printer size={16} />{tr("Print or save as PDF")}</button>
    </Sheet>);
}

function Bin({ sys, setSys, flash, wide, onClose }) {
  const list = P.binList(sys);
  return (
    <Sheet title={tr("Recycle bin")} onClose={onClose} wide={wide} testid="biz-pro-binlist">
      <p className={"text-[13px] " + muted}>{tr("Deleted records stay here for {n} days.", { n: P.BIN_DAYS })}</p>
      {list.length ? list.map((b) => <div key={b.row._id} className={card + " p-3 flex items-center gap-2"} data-testid="biz-pro-bin-row">
        <div className="flex-1 min-w-0"><p className="text-[13.5px] font-semibold truncate" dir="auto">{b.name}</p><p className={"text-[12px] " + muted} dir="auto">{b.table} · {tr("{n} days left", { n: b.daysLeft })}</p></div>
        <button className={btnS} data-testid="biz-pro-restore" onClick={() => { try { setSys(P.restore(sys, b.row._id), tr("Restored")); } catch (e) { flash(tr(e.message)); } }}><Undo2 size={15} />{tr("Restore")}</button></div>)
        : <p className={"text-[13px] " + muted}>{tr("The recycle bin is empty")}</p>}
    </Sheet>);
}

function Rules({ sys, setSys, wide, onClose }) {
  const all = P.describeRules(sys), off = new Set((sys.pro && sys.pro.off) || []);
  const name = { stock: tr("Stock"), balances: tr("Balances and statements"), dues: tr("Due-date warnings"), bookings: tr("No double bookings") };
  return (
    <Sheet title={tr("What it does for you")} onClose={onClose} wide={wide} testid="biz-pro-rulelist">
      <p className={"text-[13px] " + muted}>{tr("Found from your tables. Switch off anything you don't want.")}</p>
      {P.RULES.map((r) => { const mine = all.filter((x) => x.rule === r); if (!mine.length) return null; return (
        <div key={r} className={card + " p-3.5 space-y-1.5"} data-testid={"biz-pro-rule-" + r}>
          <label className="flex items-center gap-2 text-[14px] font-bold"><input type="checkbox" checked={!off.has(r)} onChange={(e) => setSys(P.setRule(sys, r, e.target.checked))} className="w-5 h-5 accent-[var(--biz)]" />{name[r]}</label>
          {mine.map((x, i) => <p key={i} className={"text-[12.5px] " + muted} dir="auto">{ar() ? x.ar : x.en}</p>)}
        </div>); })}
      {!all.length ? <p className={"text-[13px] " + muted}>{tr("This system has no stock, balances, due dates or bookings yet. Ask the AI to add them, e.g. \"add a Payments table linked to Invoices\".")}</p> : null}
    </Sheet>);
}

/** Home "alerts" from the Pro rules (for HomeDash). */
export function proAlerts(sys) {
  const o = P.overview(sys, today());
  return [...o.due.slice(0, 4).map((x) => ({ tid: x.tid, text: `${x.table}: ${x.name} · ${x.field} — ${x.overdue ? tr("{n} days late", { n: -x.left }) : x.left === 0 ? tr("today") : tr("in {n} days", { n: x.left })}` })),
    ...o.low.slice(0, 3).map((x) => ({ tid: x.tid, text: `${tr("Low stock")}: ${x.name} (${x.onHand})` }))];
}
