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
import * as K from "./ui-kit.jsx";

const card = K.card;
const btnS = K.btnS;
const muted = "text-[var(--c-mut)]";
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
  return <div className={card + " p-3.5 flex flex-col-reverse justify-end gap-1.5 min-w-0"} data-testid={testid}><p className="text-[clamp(17px,4.6vw,21px)] font-black tracking-tight tabular-nums leading-tight m-0 truncate" style={tone ? { color: tone } : null} dir="ltr">{value}</p><p className={"text-[12px] font-bold leading-snug m-0 truncate " + muted}>{label}</p></div>;
}

/** v6.44 Insights — for any system: the last 6 months, the top customers, every status, bookings, stock value. */
function Insights({ sys }) {
  const I = insights(sys, today());
  const top = Math.max(1, ...I.series.map((x) => x.total));
  const any = I.series.some((x) => x.total) || I.statuses.length || I.usage.length || I.stock.some((x) => x.value);
  if (!any) return null;
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return <div className="space-y-3" data-testid="biz-insights">
    {I.series.some((x) => x.total) ? <div className={card + " p-4"} data-testid="biz-insights-trend">
      <p className="text-[15px] font-extrabold mb-3 m-0">{tr("The last 6 months")}{I.change != null ? <span className={"ms-2 font-semibold " + (I.change >= 0 ? "text-[var(--c-pos)]" : "text-[var(--c-neg)]")}>{I.change >= 0 ? "+" : ""}{I.change}% {tr("vs last month")}</span> : null}</p>
      <div className="flex items-end gap-2 h-28 border-b border-[var(--c-ln)] pb-1">{I.series.map((x, i) => <div key={x.ym} className="flex-1 flex flex-col items-center justify-end gap-1 h-full"><span className="w-full max-w-[44px] rounded-t-[8px]" style={{ height: Math.max(2, (x.total / top) * 80), background: "var(--c-acc)", opacity: i === I.series.length - 1 ? 1 : 0.55 }} /><span className={"text-[11px] font-bold " + muted}>{tr(M[+x.ym.slice(5, 7) - 1])}</span></div>)}</div>
      <p className={"text-[12.5px] mt-2 m-0 " + muted}>{tr("This month")}: <b className="tabular-nums text-[var(--c-ink)]" dir="ltr">{money(sys, I.thisMonth)}</b></p></div> : null}
    {I.top.length ? <div className={card + " p-4"} data-testid="biz-insights-top"><p className="text-[15px] font-extrabold mb-1.5 m-0">{tr("Top this year")}</p>
      {I.top.map((x, i) => <p key={i} className="flex justify-between gap-2 text-[13.5px] py-2 m-0 border-t border-[var(--c-ln)] first-of-type:border-t-0"><span className="truncate font-semibold" dir="auto">{i + 1}. {x.name} <span className={muted}>· {tr("{n} records", { n: x.count })}</span></span><b className="tabular-nums shrink-0" dir="ltr">{money(sys, x.total)}</b></p>)}</div> : null}
    {I.usage.map((u) => <div key={u.table} className={card + " p-4"} data-testid="biz-insights-usage"><p className="text-[15px] font-extrabold mb-2 m-0"><span dir="auto">{u.assets}</span> · {tr("booked this month")} <span className={muted}>({tr("average {p}%", { p: u.avg })})</span></p>
      {u.rows.slice(0, 8).map((r, i) => <div key={i} className="flex items-center gap-2 text-[12.5px] py-1"><span className="w-28 truncate font-semibold" dir="auto">{r.name}</span><span className="flex-1 h-2 rounded-full bg-[var(--c-surf-2)] overflow-hidden"><span className="block h-full rounded-full" style={{ width: r.pct + "%", background: "var(--c-acc)" }} /></span><span className="w-10 text-end tabular-nums font-bold" dir="ltr">{r.pct}%</span></div>)}</div>)}
    {I.statuses.length ? <div className={card + " p-4"} data-testid="biz-insights-status"><p className="text-[15px] font-extrabold mb-1.5 m-0">{tr("By status")}</p>
      {I.statuses.map((x) => <div key={x.tid} className="py-1"><p className={"text-[12px] " + muted} dir="auto">{x.table} · {x.total}</p><div className="flex flex-wrap gap-1.5 mt-0.5">{x.counts.map((c) => <span key={c.value} className={K.tag("gray") + " text-[12px]"} dir="auto">{c.value} <b>{c.n}</b></span>)}</div></div>)}</div> : null}
    {I.stock.filter((x) => x.value != null).map((x) => <div key={x.table} className={card + " p-4 flex justify-between gap-2 text-[13.5px]"} data-testid="biz-insights-stock"><span className="font-semibold" dir="auto">{tr("Stock value at cost")} · {x.table}</span><b className="tabular-nums" dir="ltr">{money(sys, x.value)}</b></div>)}
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
        {o.has.balances ? <Kpi label={tr("Sales this month")} value={money(sys, o.monthSales)} tone="var(--c-acc)" testid="biz-pro-month" /> : null}
        {o.has.balances ? <Kpi label={tr("Owed to you")} value={money(sys, o.receivable)} testid="biz-pro-owed" /> : null}
        {o.payable ? <Kpi label={tr("You owe suppliers")} value={money(sys, o.payable)} testid="biz-pro-payable" /> : null}
        {o.has.stock ? <Kpi label={tr("Low stock")} value={o.low.length} tone={o.low.length ? "var(--c-warn)" : null} testid="biz-pro-low" /> : null}
        {o.has.dues ? <Kpi label={tr("Due or overdue")} value={o.due.length} tone={o.due.some((x) => x.overdue) ? "var(--c-neg)" : null} testid="biz-pro-due" /> : null}
      </div>

      <Insights sys={sys} />
      {nothing ? <div className={card + " p-6 text-center text-[14px] font-semibold " + muted} data-testid="biz-pro-none">{tr("This system has no stock, balances, due dates or bookings yet. Ask the AI to add them, e.g. \"add a Payments table linked to Invoices\".")}</div> : null}

      {o.due.length || o.low.length ? <div className={card + " p-4 space-y-0.5"} data-testid="biz-pro-warn"><p className="text-[15px] font-extrabold flex items-center gap-1.5 m-0 pb-1"><AlertTriangle size={15} className="text-[var(--c-warn)]" />{tr("Needs you")}</p>
        {o.due.slice(0, 8).map((x) => <button key={x.rid + x.field} onClick={() => go("form", x.tid)} className="w-full min-h-[44px] flex items-center justify-between gap-2 text-start text-[13.5px] font-semibold border-t border-[var(--c-ln)] hover:text-[var(--c-acc)]" data-testid="biz-pro-due-row">
          <span className="truncate" dir="auto">{x.table}: {x.name} · {x.field}</span><span className={"shrink-0 font-semibold " + (x.overdue ? "text-[var(--c-neg)]" : "text-[var(--c-warn)]")}>{x.overdue ? tr("{n} days late", { n: -x.left }) : x.left === 0 ? tr("today") : tr("in {n} days", { n: x.left })}</span></button>)}
        {o.low.slice(0, 8).map((x) => <button key={x.row._id} onClick={() => go("form", x.tid)} className="w-full min-h-[44px] flex items-center justify-between gap-2 text-start text-[13.5px] font-semibold border-t border-[var(--c-ln)] hover:text-[var(--c-acc)]" data-testid="biz-pro-low-row">
          <span className="truncate" dir="auto">{tr("Low stock")}: {x.name}</span><span className="shrink-0 font-semibold text-[var(--c-warn)] tabular-nums">{x.onHand}{x.reorder != null ? " / " + x.reorder : ""}</span></button>)}
      </div> : null}

      <div className={wide ? "grid grid-cols-2 gap-3 items-start" : "space-y-3"}>
        {R.stock.map((s) => { const lv = P.stockLevels(sys, s); const shown = allStock ? lv : lv.slice(0, 8); return (
          <div key={s.items} className={card + " p-4"} data-testid="biz-pro-stock">
            <p className="text-[15px] font-extrabold flex items-center gap-1.5 mb-2 m-0"><Package size={15} style={{ color: "var(--c-acc)" }} />{tr("Stock on hand")} · <span dir="auto">{tname(s.items)}</span></p>
            {lv.length ? <div className="overflow-x-auto -mx-1"><table className="w-full text-[13px]"><thead><tr className={"text-[11.5px] tracking-[0.02em] " + muted}><th className="text-start font-extrabold px-1 pb-2">{tr("Item")}</th><th className="text-end font-extrabold px-1 pb-2">{tr("Qty in")}</th><th className="text-end font-extrabold px-1 pb-2">{tr("Qty out")}</th><th className="text-end font-extrabold px-1 pb-2">{tr("On hand")}</th></tr></thead>
              <tbody>{shown.map((x) => <tr key={x.row._id} className="border-t border-[var(--c-ln)]" data-testid="biz-pro-stock-row"><td className="px-1 py-2.5 truncate max-w-[9rem] font-semibold" dir="auto">{x.name}</td><td className="px-1 text-end tabular-nums" dir="ltr">{x.opening + x.in}</td><td className="px-1 text-end tabular-nums" dir="ltr">{x.out}</td>
                <td className={"px-1 text-end tabular-nums font-black " + (x.low ? "text-[var(--c-warn)]" : "")} dir="ltr">{x.onHand}</td></tr>)}</tbody></table></div> : <p className={"text-[13px] " + muted}>{tr("No records yet")}</p>}
            {lv.length > 8 ? <button className={"min-h-[44px] text-[13px] font-bold mt-1 text-[var(--c-acc)]"} onClick={() => setAllStock(!allStock)}>{allStock ? tr("Show less") : tr("Show all {n}", { n: lv.length })}</button> : null}
          </div>); })}
        {R.parties.map((p) => { const b = P.balances(sys, p); return (
          <div key={p.tid} className={card + " p-4"} data-testid="biz-pro-balances">
            <p className="text-[15px] font-extrabold flex items-center gap-1.5 mb-2 m-0"><Wallet size={15} style={{ color: "var(--c-acc)" }} />{tr("Balances")} · <span dir="auto">{tname(p.tid)}</span></p>
            {b.length ? b.slice(0, 10).map((x) => <button key={x.row._id} onClick={() => setStmt({ p, id: x.row._id })} className="w-full min-h-[44px] flex items-center justify-between gap-2 py-2 border-t border-[var(--c-ln)] first:border-0 text-start text-[13.5px] font-semibold hover:text-[var(--c-acc)]" data-testid="biz-pro-balance">
              <span className="truncate" dir="auto">{x.name}</span><span className={"tabular-nums font-bold shrink-0 " + (x.balance > 0 ? "" : "text-[var(--c-pos)]")}>{money(sys, x.balance)}<ChevronRight size={14} className={"inline rtl:rotate-180 ms-1 " + muted} /></span></button>)
              : <p className={"text-[13px] " + muted}>{tr("No records yet")}</p>}
          </div>); })}
      </div>

      <div className={card + " p-4 space-y-2.5"} data-testid="biz-pro-tools">
        <p className={K.label + " m-0"}>{tr("Tools")}</p>
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
    <div className={"calm fixed inset-0 z-[70] bg-black/60 flex " + (wide ? "items-center justify-center p-6" : "items-end")} onClick={onClose}>
      <div className={"bg-[var(--c-bg)] text-[var(--c-ink)] border border-[var(--c-ln)] w-full max-h-[92vh] overflow-y-auto p-5 space-y-3.5 shadow-2xl " + (wide ? "max-w-2xl rounded-[26px]" : "rounded-t-[28px] pb-8")} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" data-testid={testid}>
        <div className="flex items-center gap-2 pb-1 border-b border-[var(--c-ln)]"><p className="flex-1 text-[18px] font-extrabold m-0" dir="auto">{title}</p>
          <button onClick={onClose} aria-label={tr("Close")} className="w-11 h-11 rounded-full bg-[var(--c-surf)] border border-[var(--c-ln)] text-[var(--c-ink)] grid place-items-center shrink-0"><X size={18} /></button></div>
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
      <div className="grid grid-cols-3 gap-2"><Kpi label={tr("Charged")} value={money(sys, s.charged)} /><Kpi label={tr("Paid")} value={money(sys, s.paid)} /><Kpi label={tr("Balance")} value={money(sys, s.balance)} tone="var(--c-acc)" testid="biz-pro-stmt-balance" /></div>
      <div className={card + " p-3.5 overflow-x-auto"}>
        {s.lines.length ? <table className="w-full text-[13px]"><thead><tr className={"text-[11.5px] tracking-[0.02em] " + muted}><th className="text-start font-extrabold px-1 pb-2">{tr("Date")}</th><th className="text-start font-extrabold px-1 pb-2">{tr("Details")}</th><th className="text-end font-extrabold px-1 pb-2">{tr("Debit")}</th><th className="text-end font-extrabold px-1 pb-2">{tr("Credit")}</th><th className="text-end font-extrabold px-1 pb-2">{tr("Balance")}</th></tr></thead>
          <tbody>{s.lines.map((l, i) => <tr key={i} className="border-t border-[var(--c-ln)]" data-testid="biz-pro-stmt-line"><td className="px-1 py-2.5 tabular-nums whitespace-nowrap" dir="ltr">{dmy(l.date)}</td><td className="truncate max-w-[10rem]" dir="auto">{l.what}</td><td className="text-end tabular-nums">{l.debit ? money(sys, l.debit) : ""}</td><td className="text-end tabular-nums">{l.credit ? money(sys, l.credit) : ""}</td><td className="text-end tabular-nums font-semibold">{money(sys, l.balance)}</td></tr>)}</tbody></table>
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
          <label className="min-h-[44px] flex items-center gap-2.5 text-[14px] font-extrabold"><input type="checkbox" checked={!off.has(r)} onChange={(e) => setSys(P.setRule(sys, r, e.target.checked))} className="w-5 h-5 accent-[var(--c-acc)]" />{name[r]}</label>
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
