/* ---- v6.45 Fleet & rentals ← Ali's two desktop programs: the screens for fleet-desk.js, inside Fleet's own tabs.
   Today → money this month on a cash basis, the 6-month summary, who owes most, Active now's counts;
   Money → Profit per site · Query (each with Excel and Print / PDF); More → Rates (every crane's rates in one table);
   Store → the dashboard numbers, filters on Movements, a report row opens its history, Lists (rename / remove a name).
   The small parts are Fleet's own (fleet-ui.jsx exports them). Tests: tests/e2e_v745fleetdesk.py.                     */
import React, { useState } from "react";
import { Printer, Download, ChevronDown, ChevronUp, Pencil, Trash2, Plus, X } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as F from "./fleet.js";
import * as D from "./fleet-desk.js";
import { xlsxFromRows } from "./convert.js";
import { askConfirm } from "./confirm.jsx";
import { portalData, portalHTML } from "./fleet-portal.js";
import { sealData } from "./biz-vault.js";
import * as K from "./ui-kit.jsx";
import { card, btnP, btnS, inp, muted, num, nameOf, Txt, DateF, Seg, Tag, Empty, Kpi, SaveBtn, printHTML, saveOut } from "./fleet-ui.jsx";

const isAr = () => getLang() === "ar";
const showYm = (ym) => ym.slice(5) + "/" + ym.slice(0, 4);
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
function saveX(saveFile, flash, name, title, head, rows) {
  try { saveOut(saveFile, name, xlsxFromRows([head, ...rows], title.slice(0, 30)), XLSX); flash(tr("Saved {f}", { f: name })); } catch (e) { flash(tr(e.message)); }
}
/** Print / PDF and Excel for any table on these screens. */
export function TableOut({ s, saveFile, flash, title, head, rows, total = null, file, testid }) {
  const H = head.map((h) => tr(h));
  return <div className="flex gap-2">
    <button className={btnS + " flex-1"} onClick={() => printHTML(D.tableHTML({ title: tr(title), head: H, rows, total, company: s.settings.company || "", rtl: isAr() }), saveFile, file + ".html")} data-testid={(testid || "fleet-desk") + "-print"}><Printer size={15} />{tr("Print / PDF")}</button>
    <button className={btnS + " flex-1"} onClick={() => saveX(saveFile, flash, file + ".xlsx", tr(title), H, total != null ? [...rows, [tr("Total"), ...Array(H.length - 2).fill(""), total]] : rows)} data-testid={(testid || "fleet-desk") + "-xlsx"}><Download size={15} />{tr("Excel")}</button></div>;
}
const Table = ({ head, rows, total, testid, swatch = null }) => <div className={card + " overflow-x-auto"} data-testid={testid}><table className="w-full text-[13px]">
  <thead><tr className={"text-[11.5px] tracking-[0.02em] bg-[var(--c-surf-2)] " + muted}>{head.map((h, i) => <th key={h + i} className={"px-3.5 py-3 font-extrabold whitespace-nowrap " + (rows[0] && typeof rows[0][i] === "number" ? "text-end" : "text-start")}>{swatch && swatch[i] ? <i aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-full me-1.5 align-middle" style={{ background: swatch[i] }} /> : null}{tr(h)}</th>)}</tr></thead>
  <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-[var(--c-ln)]" data-testid={testid ? testid + "-row" : null}>{r.map((v, j) => <td key={j} className={"px-3.5 py-2.5 " + (typeof v === "number" ? "text-end tabular-nums whitespace-nowrap" : "")} dir={typeof v === "number" ? "ltr" : "auto"}>{typeof v === "number" ? num(v) : v}</td>)}</tr>)}
    {total != null ? <tr className="border-t-2 border-[var(--c-ln)] font-black bg-[var(--c-bg)]"><td className="px-3.5 py-3" colSpan={head.length - 1}>{tr("Total")}</td><td className="px-3.5 py-3 text-end tabular-nums" dir="ltr">{num(total)}</td></tr> : null}</tbody></table></div>;

// ---- Today: the crane program's Dashboard money -------------------------------------------------------------------------------
export function TodayCash({ s, money, setOpen }) {
  const [more, setMore] = useState(false);
  const t = F.isoDay(), ym = t.slice(0, 7), m = D.cashTotals(s, { from: ym + "-01", to: ym + "-31" }), all = D.cashTotals(s), a = D.activeCounts(s);
  const six = more ? D.monthlyCash(s, 6, t) : null, owe = more ? D.topOwing(s, 6) : null;
  return <div className={card + " p-4 space-y-3"} data-testid="fleet-cash">
    <div className="flex items-center gap-2 flex-wrap"><p className="flex-1 min-w-0 font-extrabold text-[15px] m-0">{tr("Money this month (cash)")}</p>
      <span className={K.tag("gray")} data-testid="fleet-active-counts">{tr("{j} jobs · {si} sites · {c} clients", { j: a.jobs, si: a.sites, c: a.clients })}</span></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <Kpi label={tr("Collected")} value={money(m.income)} /><Kpi label={tr("Spent")} value={money(m.expenses)} />
      <Kpi label={tr("Profit this month")} value={money(m.profit)} tone={m.profit < 0 ? "red" : ""} /><Kpi label={tr("Profit, all time")} value={money(all.profit)} tone={all.profit < 0 ? "red" : ""} /></div>
    <p className={"text-[12px] m-0 " + muted}>{tr("Collected = payments received that didn't bounce, by their date. Spent = expenses.")}</p>
    <button className={btnS + " w-full"} onClick={() => setMore(!more)} data-testid="fleet-cash-more">{more ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{more ? tr("Less") : tr("Last 6 months and who owes most")}</button>
    {more ? <>
      {/* Gemini's chart card: the six months as paired bars (jade = collected, terracotta = spent); the table under it keeps the numbers */}
      {(() => { const top = Math.max(1, ...six.map((x) => Math.max(x.income, x.expenses))); return <div className="rounded-[18px] bg-[var(--c-bg)] border border-[var(--c-ln)] p-3.5" aria-hidden="true" data-chart="six">
        <div className="flex items-end gap-2 h-32 border-b border-[var(--c-ln)]">{six.map((x, i) => <div key={x.ym} className="flex-1 h-full flex items-end justify-center gap-1">
          <span className="w-full max-w-[18px] rounded-t-[6px]" style={{ height: Math.max(2, (x.income / top) * 100) + "%", background: "var(--c-acc)", opacity: i === six.length - 1 ? 1 : 0.7 }} />
          <span className="w-full max-w-[18px] rounded-t-[6px]" style={{ height: Math.max(2, (x.expenses / top) * 100) + "%", background: "var(--c-acc-2)", opacity: i === six.length - 1 ? 1 : 0.7 }} /></div>)}</div>
        <div className="flex gap-2 pt-1.5">{six.map((x) => <span key={x.ym} className={"flex-1 text-center text-[11px] font-bold tabular-nums " + muted} dir="ltr">{x.ym.slice(5)}</span>)}</div></div>; })()}
      <Table head={["Month", "Collected", "Spent", "Profit"]} rows={six.map((x) => [showYm(x.ym), x.income, x.expenses, x.profit])} testid="fleet-six" swatch={[null, "var(--c-acc)", "var(--c-acc-2)", null]} />
      {owe.length ? <div className="space-y-1"><p className="font-extrabold text-[15px] m-0 pb-1">{tr("Who owes most")}</p>
        {owe.map((x) => <button key={x.client.id} onClick={() => setOpen({ kind: "client", id: x.client.id })} className="w-full min-h-[52px] text-start py-2 border-t border-[var(--c-ln)] hover:text-[var(--c-acc)]" data-testid="fleet-owe"><span className="flex justify-between gap-2 text-[13.5px]"><span className="font-semibold truncate" dir="auto">{x.client.name}</span><span className="tabular-nums font-extrabold text-[var(--c-warn)] shrink-0" dir="ltr">{money(x.balance)}</span></span>
          <span className="c-bar block mt-1.5" aria-hidden="true"><i style={{ width: Math.max(2, Math.min(100, (x.balance / Math.max(1, owe[0].balance)) * 100)) + "%", background: "var(--c-warn)" }} /></span></button>)}</div> : null}
    </> : null}
  </div>;
}

// ---- More → Rates ---------------------------------------------------------------------------------------------------------------
export function RatesForm({ s, run, close }) {
  const cr = F.live(s.cranes);
  const [r, setR] = useState(Object.fromEntries(cr.map((c) => [c.id, { hourly: c.hourly || "", daily: c.daily || "" }])));
  const set = (id, k, v) => setR({ ...r, [id]: { ...r[id], [k]: v } });
  if (!cr.length) return <Empty>{tr("Add a crane first.")}</Empty>;
  return <div className="space-y-3" data-testid="fleet-rates">
    <p className={"text-[13px] " + muted}>{tr("Every crane's rates in one place. New job orders start with these.")}</p>
    {cr.map((c) => <div key={c.id} className={card + " p-4 space-y-2"}><p className="font-extrabold text-[14.5px] m-0" dir="auto">{c.name}</p>
      <div className="grid grid-cols-2 gap-2"><Txt label={tr("Hourly rate")} value={r[c.id].hourly} onChange={(v) => set(c.id, "hourly", v)} mode="decimal" testid="fleet-rate-h" /><Txt label={tr("Daily rate")} value={r[c.id].daily} onChange={(v) => set(c.id, "daily", v)} mode="decimal" testid="fleet-rate-d" /></div></div>)}
    <SaveBtn onClick={() => { if (run((x) => D.setRates(x, r), tr("Rates saved"))) close(); }} />
  </div>;
}

// ---- Money → Profit per site -------------------------------------------------------------------------------------------------------
export function SitesPane({ s, money, saveFile, flash }) {
  const [range, setRange] = useState("month");
  const t = F.isoDay(), from = range === "month" ? t.slice(0, 7) + "-01" : range === "year" ? t.slice(0, 4) + "-01-01" : "";
  const list = D.siteProfit(s, { from });
  const rows = list.map((x) => [x.site.name, x.income, x.expenses, x.profit]), tot = F.r2(list.reduce((n, x) => n + x.profit, 0));
  return <div className="space-y-2.5" data-testid="fleet-sites">
    <Seg value={range} onChange={setRange} items={[["month", "This month"], ["year", "This year"], ["all", "All time"]]} testid="fleet-srange" />
    {rows.length ? <><Table head={["Site", "Income", "Expenses", "Profit"]} rows={rows} total={tot} testid="fleet-sites-table" />
      <TableOut s={s} saveFile={saveFile} flash={flash} title="Profit per site" head={["Site", "Income", "Expenses", "Profit"]} rows={rows} total={tot} file={"fleet-sites-" + t} testid="fleet-sites" /></> : <Empty>{tr("No sites yet.")}</Empty>}
  </div>;
}

// ---- Money → Query ------------------------------------------------------------------------------------------------------------------
const STATUS_L = { pending: "Pending", cleared: "Cleared", bounced: "Bounced", active: "Active", completed: "Completed", cancelled: "Cancelled" };
const TABLES = [["cheques", "Cheques & payments"], ["jobs", "Job orders"], ["expenses", "Expenses"], ["moves", "Crane moves"]];
export function QueryPane({ s, saveFile, flash }) {
  const [q, setQ] = useState({ table: "cheques", status: "", from: "", to: "" });
  let r = null, err = "";
  try { r = D.query(s, q); } catch (e) { err = tr(e.tpl || e.message, e.vars); }
  const label = (h, v) => (h === "Status" ? tr(STATUS_L[v] || v) : h === "In / out" ? tr(v) : h === "Pricing" ? tr({ hourly: "Hourly", daily: "Daily", period: "Period" }[v] || v) : v);
  const rows = r ? r.rows.map((row) => row.map((v, i) => label(r.head[i], v))) : [];
  const st = D.QUERY_STATUS[q.table];
  return <div className="space-y-2.5" data-testid="fleet-query">
    <Seg value={q.table} onChange={(v) => setQ({ ...q, table: v, status: "" })} items={TABLES} testid="fleet-qt" />
    {st.length ? <Seg value={q.status || "all"} onChange={(v) => setQ({ ...q, status: v === "all" ? "" : v })} items={[["all", "All"], ...st.map((x) => [x, STATUS_L[x]])]} testid="fleet-qs" /> : null}
    <div className="grid grid-cols-2 gap-2"><DateF label={tr("From")} value={q.from} onChange={(v) => setQ({ ...q, from: v })} testid="fleet-q-from" /><DateF label={tr("To")} value={q.to} onChange={(v) => setQ({ ...q, to: v })} testid="fleet-q-to" /></div>
    {err ? <p className="text-[13px] text-[var(--c-neg)]">{err}</p> : null}
    {r ? <><p className={"text-[12.5px] " + muted} data-testid="fleet-q-count">{tr("{n} rows", { n: rows.length })}</p>
      {rows.length ? <><Table head={r.head} rows={rows.slice(0, 400)} total={r.total} testid="fleet-q-table" />
        <TableOut s={s} saveFile={saveFile} flash={flash} title={(TABLES.find((x) => x[0] === q.table) || [])[1]} head={r.head} rows={rows} total={r.total} file={"fleet-query-" + q.table + "-" + F.isoDay()} testid="fleet-q" /></> : <Empty>{tr("Nothing matches.")}</Empty>}</> : null}
  </div>;
}

// ---- Store: the dashboard numbers, filters, history, lists --------------------------------------------------------------------------
export function StoreKpis({ s, money }) {
  const k = D.storeKpis(s);
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" data-testid="fleet-store-kpis">
    <Kpi label={tr("Items")} value={num(k.items)} /><Kpi label={tr("Stock value")} value={money(k.value)} />
    <Kpi label={tr("In this month")} value={money(k.inMonth)} /><Kpi label={tr("Out this month")} value={money(k.outMonth)} />
    {k.low ? <p className="col-span-2 lg:col-span-4 text-[12.5px] text-[var(--c-warn)] font-semibold">{tr("{n} items low", { n: k.low })}</p> : null}</div>;
}
/** The warehouse program's search panel: dates, item, technician, crane, supplier (the text box and in / out stay in Movements). */
export function StoreFilters({ s, f, setF }) {
  const [open, setOpen] = useState(false);
  const n = ["from", "to", "item", "tech", "crane", "supplier"].filter((k) => f[k]).length;
  const sel = (k, label, list) => <label className="block min-w-0"><span className={"block text-[12px] font-bold mb-1.5 " + muted}>{label}</span>
    <select value={f[k] || ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={inp} dir="auto" data-testid={"fleet-sf-" + k}><option value="">{tr("All")}</option>{list.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
  const names = (arr) => arr.map((x) => [x, x]);
  return <div className="space-y-2">
    <button className={btnS + " w-full"} onClick={() => setOpen(!open)} data-testid="fleet-sf-toggle">{open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{tr("Filters")}{n ? <Tag tone="blue">{n}</Tag> : null}</button>
    {open ? <div className={card + " p-4 space-y-2.5"}>
      <div className="grid grid-cols-2 gap-2"><DateF label={tr("From")} value={f.from || ""} onChange={(v) => setF({ ...f, from: v })} testid="fleet-sf-from" /><DateF label={tr("To")} value={f.to || ""} onChange={(v) => setF({ ...f, to: v })} testid="fleet-sf-to" /></div>
      <div className="grid grid-cols-2 gap-2">{sel("item", tr("Item"), names((s.store.items || []).map((x) => x.name)))}{sel("tech", tr("Technician"), names(s.store.techs || []))}
        {sel("crane", tr("Crane"), F.live(s.cranes).map((c) => [c.id, c.name]))}{sel("supplier", tr("Supplier"), names(s.store.suppliers || []))}</div>
      {n ? <button className={btnS + " w-full"} onClick={() => setF({ text: f.text, kind: f.kind })} data-testid="fleet-sf-clear"><X size={14} />{tr("Clear filters")}</button> : null}
    </div> : null}</div>;
}
/** What a supplier sold us / what a crane, place or technician received — opened from a Store report row. */
export function HistorySheet({ s, sheet, money, saveFile, flash }) {
  const h = D.storeHistory(s, sheet.key, sheet.name);
  const head = ["Date", "Code", "Item", "Qty", "Unit price", "Total"], rows = h.rows.map((r) => [F.showDate(r.date), r.doc, r.item, r.qty, r.unit, r.total]);
  return <div className="space-y-2.5" data-testid="fleet-history">
    <p className={"text-[13px] " + muted}>{tr("{n} lines · {q} units · {t}", { n: rows.length, q: num(h.qty), t: money(h.total) })}</p>
    {rows.length ? <><Table head={head} rows={rows} total={h.total} testid="fleet-history-table" /><TableOut s={s} saveFile={saveFile} flash={flash} title={sheet.name} head={head} rows={rows} total={h.total} file={"fleet-history-" + F.isoDay()} testid="fleet-history" /></> : <Empty>{tr("Nothing yet.")}</Empty>}</div>;
}
/** The issues taken from one incoming invoice (under the reference-code report). */
export function RefIssues({ s, doc, money }) {
  const list = D.refIssues(s, doc);
  if (!list.length) return <p className={"text-[12.5px] " + muted}>{tr("Nothing issued from this invoice yet.")}</p>;
  return <div className="space-y-1.5" data-testid="fleet-ref-issues"><p className="font-bold text-[14px]">{tr("Issued from it")}</p>
    <Table head={["Date", "Code", "Item", "Qty", "To", "Technician", "Total"]} rows={list.map((x) => [F.showDate(x.date), x.doc, x.item, x.qty, x.to, x.tech, x.total])} testid="fleet-ref-issues-table" /></div>;
}
const LISTS = [["items", "Items"], ["suppliers", "Suppliers"], ["techs", "Technicians"], ["dests", "Destinations"], ["purchasers", "Purchasers"], ["requesters", "Requested by"]];
export function ListsPane({ s, run }) {
  const [list, setList] = useState("techs"), [add, setAdd] = useState(""), [edit, setEdit] = useState(null);
  const names = D.namesOf(s, list);
  return <div className="space-y-2.5" data-testid="fleet-lists">
    <p className={"text-[13px] " + muted}>{tr("The names your store forms suggest. Renaming one changes it on every line.")}</p>
    <Seg value={list} onChange={(v) => { setList(v); setEdit(null); }} items={LISTS} testid="fleet-ln" />
    <div className="flex gap-2"><input value={add} onChange={(e) => setAdd(e.target.value)} placeholder={tr("Add a name")} className={inp} dir="auto" data-testid="fleet-ln-add" />
      <button className={btnP + " h-11 shrink-0"} style={{ background: "var(--c-acc)" }} disabled={!add.trim()} onClick={() => { if (run((x) => D.addName(x, list, add), tr("Added"))) setAdd(""); }} data-testid="fleet-ln-add-btn"><Plus size={16} />{tr("Add")}</button></div>
    {names.length ? names.map((x) => <div key={x.name} className={card + " p-3 flex items-center gap-2"} data-testid="fleet-ln-row">
      {edit && edit.from === x.name ? <><input autoFocus value={edit.to} onChange={(e) => setEdit({ ...edit, to: e.target.value })} className={inp} dir="auto" data-testid="fleet-ln-edit" />
        <button className={btnS} onClick={() => { if (run((st) => D.renameName(st, list, edit.from, edit.to), tr("Renamed everywhere"))) setEdit(null); }} data-testid="fleet-ln-save">{tr("Save")}</button></>
        : <><span className="flex-1 min-w-0 font-semibold text-[14px] truncate" dir="auto">{x.name}</span><span className={"text-[12px] " + muted}>{tr("{n} lines", { n: x.used })}</span>
          <button className="w-11 h-11 grid place-items-center rounded-full text-[var(--c-mut)] hover:text-[var(--c-ink)]" aria-label={tr("Rename")} onClick={() => setEdit({ from: x.name, to: x.name })} data-testid="fleet-ln-rename"><Pencil size={15} /></button>
          <button className="w-11 h-11 grid place-items-center rounded-full text-[var(--c-mut)] hover:text-[var(--c-ink)]" aria-label={tr("Remove")} onClick={async () => { if (await askConfirm("Remove this name from the list?", { yes: "Remove" })) run((st) => D.removeName(st, list, x.name), tr("Removed")); }} data-testid="fleet-ln-remove"><Trash2 size={15} /></button></>}</div>)
      : <Empty>{tr("Nothing here yet.")}</Empty>}
  </div>;
}

// ---- a client's page → "Client page" (the portal: fleet-portal.js) ------------------------------------------------------------------
/** Make the page a client opens on their own phone: their balance, invoices, payments and job orders — locked with a PIN. */
export function PortalForm({ s, sheet, saveFile, flash, close }) {
  const c = F.byId(s.clients, sheet.client) || {};
  const [pin, setPin] = useState(""), [lang, setLang] = useState(isAr() ? "ar" : "en"), [busy, setBusy] = useState(false);
  const make = async () => {
    setBusy(true);
    try {
      const data = portalData(s, sheet.client), file = "account-" + String(c.name || "client").replace(/[^\p{L}\p{N}]+/gu, "-") + ".html";
      const sealed = pin ? await sealData(data, pin, { kind: "portal" }) : null;   // no name in the readable header
      saveOut(saveFile, file, portalHTML({ data: sealed ? null : data, sealed, lang, title: sealed ? "" : c.name }), "text/html");
      flash(pin ? tr("Saved {f} — send it with the PIN in a separate message", { f: file }) : tr("Saved {f}", { f: file })); close();
    } catch (e) { flash(tr(e.message || String(e))); }
    setBusy(false);
  };
  return <div className="space-y-3" data-testid="fleet-portal">
    <p className={"text-[13.5px] " + muted}>{tr("One page {c} can open on any phone: what they owe, their invoices, payments and job orders. No costs, no other client. Send it on WhatsApp or by email.", { c: c.name })}</p>
    <Txt label={tr("PIN to open it (4+ digits — recommended)")} value={pin} onChange={setPin} mode="numeric" dir="ltr" testid="fleet-portal-pin" />
    {pin && pin.length < 4 ? <p className="text-[12.5px] text-[var(--c-neg)]">{tr("At least 4 digits")}</p> : null}
    <Seg value={lang} onChange={setLang} items={[["ar", "Arabic page"], ["en", "English page"]]} testid="fleet-portal-lang" />
    <SaveBtn onClick={make} disabled={busy || (pin && pin.length < 4)} testid="fleet-portal-make">{busy ? tr("Locking…") : tr("Make the page")}</SaveBtn>
  </div>;
}
