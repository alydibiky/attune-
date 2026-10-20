/* ---- v6.32 Fleet & rentals — the screens (Business → "Fleet & rentals") -------------------------------------------------
   Ali's two desktop ERP apps (Crane Management v2.7 + Crane Warehouse) as one app inside Business, minimal design A.
   Phone: five tabs on top — Today · Jobs · Fleet · Money · Store. Computer (≥ 900 px): the same five as a side rail and
   two columns. Forms open in a sheet (bottom on a phone, centred on a computer). Logic: fleet.js; storage: fleet-store.js.
   Kept from the old apps' hard-won lessons: no native alert/confirm (askConfirm + flash), dates typed DD/MM/YYYY (never
   the phone's M/D), every save wrapped so a real error shows instead of failing silently, a version-free data file.
   Tests: tests/unit/v732fleet.test.mjs (logic), tests/e2e_v732fleet.py (screens).                                       */
import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Camera, Paperclip, AlertTriangle, Check, X, Search, Printer, Download, Upload, Menu, Truck, Package, Wallet, CalendarDays, Building2, MapPin, Undo2, Pencil, Lock, Wrench, Clock, Users, Globe, MessageSquare, Copy } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as F from "./fleet.js";
import * as FO from "./fleet-order.js";
import { loadFleet, saveFleet, saveAttachment, loadAttachment } from "./fleet-store.js";
import { askConfirm } from "./confirm.jsx";
import { useSubBack, useSticky } from "./backstack.js";
import { xlsxFromRows } from "./convert.js";
import { sealData, openData, vaultHeader } from "./biz-vault.js";
import { saveProject } from "./biz-v2-ui.jsx";
import * as P from "./fleet-pro.js";
import * as Q from "./fleet-trade.js";
import { QuotesPane, QuoteForm, QuoteView, OrdersPane, POForm, POView, VendorsPane, VendorForm } from "./fleet-trade-ui.jsx";   // v6.44 quotes, purchase orders, suppliers
import { PortalForm, TableOut, TodayCash, RatesForm, SitesPane, QueryPane, StoreKpis, StoreFilters, HistorySheet, RefIssues, ListsPane } from "./fleet-desk-ui.jsx";   // v6.45 from Ali's desktop programs
import { InvoicesPane, InvoiceForm, InvoiceView, AgingPane, ReportsPane, TeamPane, PersonForm, AdvanceForm, CraneMore, PaperForm, RepairForm, FuelForm, DOC_L } from "./fleet-pro-ui.jsx";

export const card = "rounded-2xl bg-[#FFFFFF] border border-[#DCE3EC] shadow-[0_1px_3px_rgba(15,23,42,.06)]";
export const btnP = "h-12 px-5 rounded-2xl text-[#FFFFFF] font-bold text-[15px] disabled:opacity-40 flex items-center justify-center gap-2";
export const btnS = "h-10 px-3 rounded-xl border border-[#DCE3EC] bg-[#FFFFFF] text-[13.5px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40";
export const inp = "w-full min-w-0 h-11 rounded-xl bg-[#EEF2F7] border border-transparent px-3 text-[15px] text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:border-[var(--biz)] focus:bg-[#FFFFFF]";
export const muted = "text-[#5B6B80]";
const WIDE = "(min-width: 900px)";
function useWide() {
  const mq = typeof window !== "undefined" && window.matchMedia ? window.matchMedia(WIDE) : null;
  const [w, setW] = useState(() => !!(mq && mq.matches));
  useEffect(() => { if (!mq) return; const f = () => setW(mq.matches); f(); mq.addEventListener ? mq.addEventListener("change", f) : mq.addListener(f); return () => (mq.removeEventListener ? mq.removeEventListener("change", f) : mq.removeListener(f)); }, []);
  return w;
}
const isAr = () => getLang() === "ar";
export const num = (n) => (+n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const TABS = [["today", "Today", CalendarDays], ["jobs", "Jobs", Clock], ["fleet", "Fleet", Truck], ["money", "Money", Wallet], ["store", "Store", Package]];
const MODE_L = { hourly: "Hourly", daily: "Daily", period: "Period" };
const STATUS_L = { active: "Active", completed: "Completed", cancelled: "Cancelled", pending: "Pending", cleared: "Cleared", bounced: "Bounced" };
export const nameOf = (arr, id) => (F.byId(arr, id) || {}).name || "";

/** Download / save a file: the Android app's saveFile, else a browser download. */
export function saveOut(saveFile, name, data, mime) {
  if (saveFile) {
    if (data instanceof Uint8Array) { let s = ""; for (let i = 0; i < data.length; i += 0x8000) s += String.fromCharCode.apply(null, data.subarray(i, i + 0x8000)); return saveFile(name, "", mime, btoa(s)); }
    return saveFile(name, data, mime);
  }
  try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); } catch (e) {}
}
export function printHTML(html, saveFile, name) {
  try {
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
    document.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
    setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { saveOut(saveFile, name, html, "text/html"); } setTimeout(() => f.remove(), 2000); }, 200);
  } catch (e) { saveOut(saveFile, name, html, "text/html"); }
}

// ---- small fields ------------------------------------------------------------------------------------------------------
export function Field({ label, children, hint }) {
  return <label className="block min-w-0"><span className={"block text-[12px] mb-1 " + muted}>{label}</span>{children}{hint ? <span className="block text-[11.5px] text-[#B45309] mt-1">{hint}</span> : null}</label>;
}
export function Txt({ label, value, onChange, testid, placeholder, mode, dir = "auto" }) {
  return <Field label={label}><input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={inp} data-testid={testid} placeholder={placeholder} inputMode={mode} dir={dir} /></Field>;
}
export function Sel({ label, value, onChange, options, testid, empty }) {
  return <Field label={label}><select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={inp} data-testid={testid}>
    {empty != null ? <option value="">{empty}</option> : null}{options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></Field>;
}
/** A date typed DD/MM/YYYY (never the phone's own M/D picker — lesson 2 of the crane app), with Today / Yesterday. */
export function DateF({ label, value, onChange, testid }) {
  const [t, setT] = useState(F.showDate(value));
  useEffect(() => { if (F.readDate(t) !== value) setT(F.showDate(value)); }, [value]);
  const bad = t && !F.readDate(t);
  return <Field label={label} hint={bad ? tr("Write the date as DD/MM/YYYY") : null}>
    <div className="flex gap-1.5"><input value={t} onChange={(e) => { setT(e.target.value); const d = F.readDate(e.target.value); onChange(d || ""); }} placeholder="DD/MM/YYYY" inputMode="numeric" className={inp + " flex-1"} data-testid={testid} dir="ltr" />
      <button type="button" className={btnS + " shrink-0"} onClick={() => { const d = F.isoDay(); setT(F.showDate(d)); onChange(d); }}>{tr("Today")}</button></div></Field>;
}
export function Evidence({ value, onChange, flash, required }) {
  const [busy, setBusy] = useState(false);
  return <Field label={required ? tr("Evidence (required)") : tr("Evidence (optional)")}>
    <label className={btnS + " w-full cursor-pointer " + (value ? "text-[#15803D] border-[#86EFAC]" : "")} data-testid="fleet-evidence">
      {value ? <Check size={16} /> : <Camera size={16} />}{busy ? tr("Saving…") : value ? tr("Attached — tap to replace") : tr("Photo or PDF of the time sheet")}
      <input type="file" accept="image/*,application/pdf" className="hidden" data-testid="fleet-evidence-file" onChange={async (e) => {
        const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
        setBusy(true); try { onChange(await saveAttachment(f)); } catch (err) { flash(tr(err.message)); } setBusy(false);
      }} /></label></Field>;
}
function Sheet({ title, onClose, children, wide }) {
  useSubBack(true, onClose);
  return <div className={"fixed inset-0 z-[70] bg-[#0F172A80] flex " + (wide ? "items-center justify-center p-6" : "items-end")} onClick={onClose}>
    <div className={"bg-[#F4F6FA] w-full max-h-[92vh] overflow-y-auto p-4 space-y-3 " + (wide ? "max-w-xl rounded-3xl" : "rounded-t-3xl pb-8")} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" data-testid="fleet-sheet">
      <div className="flex items-center gap-2"><p className="flex-1 text-[18px] font-extrabold" dir="auto">{title}</p>
        <button onClick={onClose} aria-label={tr("Close")} className="w-10 h-10 rounded-full bg-[#FFFFFF] border border-[#DCE3EC] grid place-items-center"><X size={18} /></button></div>
      {children}
    </div></div>;
}
export function Seg({ value, onChange, items, testid }) {
  return <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" data-testid={testid}>{items.map(([v, l]) =>
    <button key={v} onClick={() => onChange(v)} data-testid={testid + "-" + v} className={"h-9 px-3.5 rounded-full text-[13.5px] font-semibold whitespace-nowrap border " + (value === v ? "text-[#FFFFFF] border-transparent" : "bg-[#FFFFFF] border-[#DCE3EC] text-[#334155]")} style={value === v ? { background: "var(--biz)" } : null}>{tr(l)}</button>)}</div>;
}
export const Tag = ({ tone = "gray", children }) => {
  const c = { gray: "bg-[#E2E8F0] text-[#475569]", green: "bg-[#DCFCE7] text-[#15803D]", red: "bg-[#FEE2E2] text-[#B91C1C]", amber: "bg-[#FEF3C7] text-[#B45309]", blue: "bg-[#DBEAFE] text-[#1D4ED8]" }[tone];
  return <span className={"text-[11px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap " + c}>{children}</span>;
};
export const Row = ({ onClick, children, testid }) => <button onClick={onClick} data-testid={testid} className={card + " w-full text-start p-3.5 flex items-center gap-3"}>{children}<ChevronRight size={18} className="text-[#94A3B8] rtl:-scale-x-100 shrink-0" /></button>;
export const Empty = ({ children }) => <p className={card + " p-5 text-center text-[14px] " + muted}>{children}</p>;
export const Kpi = ({ label, value, tone }) => <div className={card + " p-3.5"}><p className={"text-[12px] " + muted}>{label}</p><p className={"text-[20px] font-extrabold mt-0.5 tabular-nums " + (tone === "red" ? "text-[#B91C1C]" : "")} dir="ltr">{value}</p></div>;

// ---- the app -------------------------------------------------------------------------------------------------------------
/** Fleet & rentals — opened from the Business hub. */
export function FleetApp({ flash, saveFile, onBack, seed = null, site = false }) {
  const [s, setRaw] = useState(null);
  const [tab, setTab] = useSticky("fleet:tab", "today");
  const [sheet, setSheet] = useState(null);       // { kind, ...props }
  const [open, setOpen] = useState(null);         // a detail screen: { kind: "job"|"crane"|"client", id }
  const [menu, setMenu] = useState(false);
  const wide = useWide();
  const cur = s ? s.settings.currency : "EGP";
  const money = (n) => num(n) + " " + cur;
  useEffect(() => { (async () => {
    let st = (await loadFleet()) || (seed ? F.heal(seed) : F.EMPTY());     // a website made from Fleet starts with the exported records
    const p = F.purge(st);                         // the Recycle Bin forgets after 7 days (run on open, like the old app)
    if (p.purged) { st = p.state; saveFleet(st); }
    setRaw(st);
    // v6.37 (W1): a crane request shared from WhatsApp opens in "Order from a message"
    try { const inc = localStorage.getItem("attune:fleet:incoming"); if (inc && !site) { localStorage.removeItem("attune:fleet:incoming"); setSheet({ kind: "order", text: inc }); } } catch (e) {}
  })(); }, []);
  useEffect(() => { if (site) return; const on = () => { try { const inc = localStorage.getItem("attune:fleet:incoming"); if (inc) { localStorage.removeItem("attune:fleet:incoming"); setOpen(null); setSheet({ kind: "order", text: inc }); } } catch (e) {} };
    window.addEventListener("attune-fleet-order", on); return () => window.removeEventListener("attune-fleet-order", on); }, []);
  useSubBack(!!open, () => setOpen(null));
  // v6.34 (§5.77 idea): what needs you → one phone notification at 09:00 (cheques, jobs past their end, service, stock)
  useEffect(() => { if (!s || site) return; const N = typeof window !== "undefined" && window.AttuneNative; if (!N) return;
    const n = F.reminderNote(s);
    const NAME = { chequeOverdue: "cheque overdue", chequeToday: "cheque due today", jobPast: "job past its end", jobEnding: "job ending", lowStock: "item low in the store", serviceDue: "crane due for service", serviceSoon: "service soon",
      docExpired: "crane paper expired", docSoon: "crane paper expiring", licenceExpired: "licence expired", licenceSoon: "licence expiring", invoiceOverdue: "invoice overdue", repairOpen: "crane still broken down", fuelHigh: "fuel use high", poLate: "purchase order late" };
    const say = n && { id: n.id, at: n.at, open: "fleet", title: n.n === 1 ? tr("Fleet: 1 thing needs you") : tr("Fleet: {n} things need you", { n: n.n }), body: Object.entries(n.counts).map(([k, c]) => c + " " + tr(NAME[k] || k)).join(" · ") };
    try { if (say && N.schedule) N.schedule(JSON.stringify(say)); else if (!n && N.unschedule) N.unschedule("fleet-needs"); } catch (e) {} }, [s]);
  /** Every change goes through here: the pure function runs, a refusal shows its real reason, the result is saved. */
  const run = (fn, ok) => {
    try {
      const next = fn(s);
      const st = next && next.state ? next.state : next;
      setRaw(st);
      saveFleet(st).then((done) => { if (!done) flash(tr("Could not save — the phone's storage may be full")); });
      if (ok) flash(typeof ok === "function" ? ok(next) : ok);
      return next || true;
    } catch (e) { flash(tr(e.tpl || e.message || String(e), e.vars)); return null; }
  };
  if (!s) return <div className="p-6 text-center text-[14px] text-[#5B6B80]">{tr("Loading…")}</div>;
  const ctx = { s, run, money, setSheet, setOpen, flash, saveFile, wide, setTab, site };
  const body = open ? (open.kind === "job" ? <JobDetail {...ctx} id={open.id} /> : open.kind === "crane" ? <CraneDetail {...ctx} id={open.id} /> : <ClientDetail {...ctx} id={open.id} />)
    : tab === "jobs" ? <Jobs {...ctx} /> : tab === "fleet" ? <FleetTab {...ctx} /> : tab === "money" ? <Money {...ctx} /> : tab === "store" ? <Store {...ctx} /> : <Today {...ctx} />;
  const head = (
    <div className="sticky top-0 z-30 bg-[#F4F6FAF2] backdrop-blur px-3 pt-2 pb-2 flex items-center gap-2">
      {open || onBack ? <button onClick={open ? () => setOpen(null) : onBack} aria-label={tr("Back")} className="w-11 h-11 rounded-full bg-[#FFFFFF] border border-[#DCE3EC] grid place-items-center shrink-0" data-testid="fleet-back"><ChevronLeft size={20} className="rtl:-scale-x-100" /></button> : null}
      <div className="flex-1 min-w-0"><p className="text-[17px] font-extrabold truncate">{tr("Fleet & rentals")}</p><p data-intro="" className={"text-[12px] truncate " + muted}>{tr("Cranes, jobs, cheques and the store — on your phone, offline")}</p></div>
      <button onClick={() => setMenu(true)} aria-label={tr("More")} className="w-11 h-11 rounded-full bg-[#FFFFFF] border border-[#DCE3EC] grid place-items-center shrink-0" data-testid="fleet-menu"><Menu size={19} /></button>
    </div>);
  const tabs = (vertical) => TABS.map(([k, l, I]) => (
    <button key={k} onClick={() => { setOpen(null); setTab(k); }} data-testid={"fleet-tab-" + k}
      className={vertical ? "w-full h-11 px-3 rounded-xl flex items-center gap-2.5 text-[14.5px] font-semibold " + (tab === k && !open ? "text-[#FFFFFF]" : "text-[#334155] hover:bg-[#EEF2F7]")
        : "flex-1 min-w-0 h-10 rounded-xl flex flex-col items-center justify-center text-[11.5px] font-semibold " + (tab === k && !open ? "text-[#FFFFFF]" : "text-[#475569]")}
      style={tab === k && !open ? { background: "var(--biz)" } : null}><I size={vertical ? 18 : 16} />{tr(l)}</button>));
  return (
    <section className="pb-8" data-testid="fleet-app">
      {head}
      {wide ? <div className="flex gap-5 px-4 max-w-[1280px] mx-auto">
        <nav className="w-52 shrink-0 space-y-1 sticky top-16 self-start pt-1" data-testid="fleet-rail">{tabs(true)}</nav>
        <div className="flex-1 min-w-0 space-y-4 pt-1">{body}</div></div>
        : <><nav className="sticky top-[60px] z-20 bg-[#F4F6FAF2] backdrop-blur px-3 pb-2 flex gap-1" data-testid="fleet-tabs">{tabs(false)}</nav>
          <div className="px-4 space-y-4">{body}</div></>}
      {sheet ? <Sheet title={sheetTitle(sheet)} onClose={() => setSheet(null)} wide={wide}><SheetBody {...ctx} sheet={sheet} close={() => setSheet(null)} /></Sheet> : null}
      {menu ? <Sheet title={tr("More")} onClose={() => setMenu(false)} wide={wide}><MoreMenu {...ctx} close={() => setMenu(false)} /></Sheet> : null}
    </section>);
}
const sheetTitle = (sh) => tr({ order: "Order from a message", job: "New job order", work: "Add work", cheque: sh.dir === "out" ? "Pay out" : "Payment received", expense: "New expense", in: "Incoming invoice", out: "Issue parts", move: "Move crane",
  list: sh.rec && sh.rec.id ? "Edit" : "Add", item: "Item", doc: "Document", bin: "Recycle Bin", settings: "Settings", backup: "Encrypted backup",
  invoice: "New invoice", invoiceView: "Invoice", person: sh.rec && sh.rec.id ? "Edit" : "Add a person", advance: "Advance", paper: "Crane paper", repair: "Breakdown", fuel: "Fuel",
  quote: "Quotation", quoteView: "Quotation", po: "Purchase order", poView: "Purchase order", vendor: sh.rec && sh.rec.name ? "Supplier" : "New supplier", rates: "Rates", portal: "Client page" }[sh.kind] || (sh.kind === "history" ? sh.name : ""));

// ---- Today ------------------------------------------------------------------------------------------------------------
function Today({ s, run, money, setSheet, setOpen, setTab, wide }) {
  const k = F.kpis(s), w = F.warnings(s), act = F.activeNow(s);
  if (!F.live(s.cranes).length) return (
    <div className="space-y-4" data-testid="fleet-empty">
      <div className="rounded-3xl bg-[#0F172A] text-[#FFFFFF] p-6 space-y-2">
        <p className="text-[24px] font-extrabold leading-tight">{tr("Your cranes, jobs and money in one place")}</p>
        <p className="text-[14px] text-[#CBD5E1]">{tr("Job orders by the hour or day, cheques with reminders, client balances, expenses, and a parts store linked to each crane.")}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button className={btnP} style={{ background: "var(--biz)" }} onClick={() => setSheet({ kind: "list", coll: "cranes", rec: {} })} data-testid="fleet-first-crane"><Plus size={18} />{tr("Add your first crane")}</button>
        <button className={btnS + " h-12"} onClick={() => run((x) => F.loadDemo(x), tr("Demo data loaded — erase it any time from More"))} data-testid="fleet-demo">{tr("Try it with demo data")}</button>
      </div>
    </div>);
  const W = { chequeOverdue: (x) => tr("Cheque {no} is {d} days overdue — {who}", { no: x.no || "", d: x.days, who: x.who }), chequeToday: (x) => tr("Cheque {no} is due today — {who}", { no: x.no || "", who: x.who }),
    chequeSoon: (x) => tr("Cheque {no} is due in {d} days — {who}", { no: x.no || "", d: x.days, who: x.who }), jobPast: (x) => tr("{no} passed its end date {d} days ago — {c}", { no: x.no, d: x.days, c: x.crane }),
    jobEnding: (x) => tr("{no} ends in {d} days — {c}", { no: x.no, d: x.days, c: x.crane }), lowStock: (x) => tr("{item}: {b} left (minimum {m})", { item: x.item, b: x.balance, m: x.min }),
    serviceDue: (x) => tr("{c} is due for its service ({h} h)", { c: x.crane, h: num(x.hours) }), serviceSoon: (x) => tr("{c}: service in {h} h", { c: x.crane, h: num(x.left) }),
    // v6.44 (fleet-pro.js)
    docExpired: (x) => tr("{c}: {p} expired {d} days ago", { c: x.crane, p: x.title || tr(DOC_L[x.doc]), d: x.days }), docSoon: (x) => tr("{c}: {p} expires in {d} days", { c: x.crane, p: x.title || tr(DOC_L[x.doc]), d: x.days }),
    licenceExpired: (x) => tr("{who}'s licence expired {d} days ago", { who: x.who, d: x.days }), licenceSoon: (x) => tr("{who}'s licence expires in {d} days", { who: x.who, d: x.days }),
    invoiceOverdue: (x) => tr("Invoice {no} is {d} days overdue — {who}", { no: x.no, d: x.days, who: x.who }), repairOpen: (x) => tr("{c} has been broken down for {d} days", { c: x.crane, d: x.days }),
    fuelHigh: (x) => tr("{c} used {l} L/h of fuel — its usual is {u}", { c: x.crane, l: num(x.lph), u: num(x.usual) }),
    quoteExpiring: (x) => tr("Quotation {no} for {who} expires in {d} days", { no: x.no, who: x.who, d: x.days }), poLate: (x) => tr("Purchase order {no} from {who} is {d} days late", { no: x.no, who: x.who, d: x.days }) };
  const go = (x) => (x.kind.startsWith("cheque") ? setTab("money") : x.kind.startsWith("job") ? setOpen({ kind: "job", id: x.id }) : /^(service|doc|repair|fuel)/.test(x.kind) ? setOpen({ kind: "crane", id: x.id })
    : x.kind === "invoiceOverdue" ? setSheet({ kind: "invoiceView", id: x.id }) : x.kind === "quoteExpiring" ? setSheet({ kind: "quoteView", id: x.id }) : x.kind === "poLate" ? setSheet({ kind: "poView", id: x.id }) : x.kind.startsWith("licence") ? setSheet({ kind: "person", rec: F.byId(s.people, x.id) }) : setTab("store"));
  return (
    <div className="space-y-4" data-testid="fleet-today">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Kpi label={tr("Working now")} value={`${k.working} / ${k.cranes}`} />
        <Kpi label={tr("Work this month")} value={money(k.month)} />
        <Kpi label={tr("Clients owe you")} value={money(k.owed)} />
        <Kpi label={tr("Cheques to collect")} value={money(k.chequesIn)} />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {[["order", "From a message", MessageSquare], ["work", "Work", Clock], ["job", "Job order", Plus], ["cheque", "Payment", Wallet], ["expense", "Expense", Wrench], ["out", "Issue parts", Package]].map(([kind, l, I]) =>
          <button key={kind} className={btnS + " whitespace-nowrap shrink-0"} onClick={() => setSheet({ kind, dir: "in" })} data-testid={"fleet-quick-" + kind}><I size={15} />{tr(l)}</button>)}
      </div>
      <TodayCash s={s} money={money} setOpen={setOpen} />
      <div className={wide ? "grid grid-cols-2 gap-4 items-start" : "space-y-4"}>
        <div className="space-y-2"><p className="text-[15px] font-bold">{tr("Needs attention")}</p>
          {w.length ? w.slice(0, 12).map((x, i) => (
            <button key={i} onClick={() => go(x)} data-testid="fleet-warning" className={card + " w-full text-start p-3 flex items-start gap-2.5"}>
              <AlertTriangle size={17} className={"shrink-0 mt-0.5 " + (x.level === "bad" ? "text-[#B91C1C]" : x.level === "warn" ? "text-[#B45309]" : "text-[#1D4ED8]")} />
              <span className="flex-1 text-[13.5px] leading-snug" dir="auto">{W[x.kind](x)}</span>{x.amount ? <span className="text-[13px] font-semibold tabular-nums" dir="ltr">{money(x.amount)}</span> : null}</button>))
            : <Empty>{tr("Nothing needs attention.")}</Empty>}</div>
        <div className="space-y-2"><p className="text-[15px] font-bold">{tr("Active now")}</p>
          {act.length ? act.map((a) => (
            <Row key={a.job.id} onClick={() => setOpen({ kind: "job", id: a.job.id })} testid="fleet-active">
              <span className="w-10 h-10 rounded-xl grid place-items-center text-[#FFFFFF] shrink-0" style={{ background: "var(--biz)" }}><Truck size={18} /></span>
              <span className="flex-1 min-w-0"><span className="block font-bold text-[14.5px] truncate" dir="auto">{(a.crane || {}).name}</span>
                <span className={"block text-[12.5px] truncate " + muted} dir="auto">{(a.client || {}).name} · {(a.site || {}).name}</span></span>
              <span className="text-[13px] font-semibold tabular-nums" dir="ltr">{money(a.total)}</span></Row>))
            : <Empty>{tr("No crane is working right now.")}</Empty>}</div>
      </div>
    </div>);
}

// ---- Jobs ------------------------------------------------------------------------------------------------------------
function Jobs({ s, money, setSheet, setOpen }) {
  const [f, setF] = useSticky("fleet:jobsf", "active");
  const jobs = F.live(s.jobs).filter((j) => f === "all" || (f === "active" ? j.status === "active" : j.status !== "active")).slice().reverse();
  if (f === "quotes") return <div className="space-y-3" data-testid="fleet-jobs"><Seg value={f} onChange={setF} items={[["active", "Active"], ["closed", "Closed"], ["all", "All"], ["quotes", "Quotes"]]} testid="fleet-jobsf" /><QuotesPane s={s} money={money} setSheet={setSheet} /></div>;
  return (
    <div className="space-y-3" data-testid="fleet-jobs">
      <div className="flex items-center gap-2"><div className="flex-1 min-w-0"><Seg value={f} onChange={setF} items={[["active", "Active"], ["closed", "Closed"], ["all", "All"], ["quotes", "Quotes"]]} testid="fleet-jobsf" /></div>
        <button className={btnP + " h-10 shrink-0"} style={{ background: "var(--biz)" }} onClick={() => setSheet({ kind: "job" })} data-testid="fleet-new-job"><Plus size={17} />{tr("Job order")}</button></div>
      {jobs.length ? <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2.5 lg:space-y-0">{jobs.map((j) => (
        <Row key={j.id} onClick={() => setOpen({ kind: "job", id: j.id })} testid="fleet-job">
          <span className="flex-1 min-w-0"><span className="flex items-center gap-2"><span className="font-bold text-[14.5px]" dir="ltr">{j.no}</span><Tag tone={j.status === "active" ? "green" : j.status === "cancelled" ? "red" : "gray"}>{tr(STATUS_L[j.status])}</Tag><Tag tone="blue">{tr(MODE_L[j.mode])}</Tag></span>
            <span className={"block text-[12.5px] truncate mt-0.5 " + muted} dir="auto">{nameOf(s.cranes, j.crane)} · {nameOf(s.clients, j.client)} · {nameOf(s.sites, j.site)}</span></span>
          <span className="text-[13px] font-semibold tabular-nums" dir="ltr">{money(F.jobTotal(s, j.id))}</span></Row>))}</div>
        : <Empty>{f === "active" ? tr("No active job orders.") : tr("No job orders here.")}</Empty>}
    </div>);
}
function JobDetail({ s, run, money, setSheet, setOpen, id, flash }) {
  const j = F.byId(s.jobs, id);
  const [view, setView] = useState(null);
  if (!j || j.del) return <Empty>{tr("This job order was deleted.")}</Empty>;
  const months = F.monthsOf(s, id);
  const close = async (status) => { if (await askConfirm(status === "completed" ? "Complete this job? The crane goes back to its garage." : "Cancel this job? The crane goes back to its garage.", { yes: status === "completed" ? "Complete" : "Cancel the job", no: "Back" })) run((x) => F.closeJob(x, id, status), tr("Done — the crane is back in the garage")); };
  const del = async () => { if (await askConfirm("Move this job order and its work to the Recycle Bin?", { yes: "Delete" })) { if (run((x) => F.remove(x, "jobs", id), tr("In the Recycle Bin for 7 days"))) setOpen(null); } };
  return (
    <div className="space-y-3" data-testid="fleet-job-detail">
      <div className={card + " p-4 space-y-1.5"}>
        <div className="flex items-center gap-2"><p className="text-[20px] font-extrabold" dir="ltr">{j.no}</p><Tag tone={j.status === "active" ? "green" : "gray"}>{tr(STATUS_L[j.status])}</Tag><Tag tone="blue">{tr(MODE_L[j.mode])}</Tag></div>
        <p className="text-[14px]" dir="auto">{nameOf(s.cranes, j.crane)} · {nameOf(s.clients, j.client)} · {nameOf(s.sites, j.site)}</p>
        <p className={"text-[13px] " + muted}>{tr("Rate")}: <span dir="ltr">{money(j.rate)}</span> · {F.showDate(j.start)} → {j.end ? F.showDate(j.end) : tr("open")}</p>
        <p className="text-[22px] font-extrabold tabular-nums pt-1" dir="ltr">{money(F.jobTotal(s, id))}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {j.status === "active" ? <><button className={btnP + " h-10"} style={{ background: "var(--biz)" }} onClick={() => setSheet({ kind: "work", job: id })} data-testid="fleet-add-work"><Plus size={16} />{tr("Add work")}</button>
          <button className={btnS} onClick={() => close("completed")} data-testid="fleet-complete"><Check size={15} />{tr("Complete")}</button>
          <button className={btnS} onClick={() => close("cancelled")}>{tr("Cancel the job")}</button></> : null}
        <button className={btnS + " text-[#B91C1C]"} onClick={del} data-testid="fleet-del-job"><Trash2 size={15} />{tr("Delete")}</button>
      </div>
      {months.length ? months.map((m) => (
        <div key={m.ym} className={card + " overflow-hidden"}>
          <div className="px-4 py-2.5 bg-[#EEF2F7] flex items-center justify-between text-[13.5px] font-bold"><span dir="ltr">{m.ym.slice(5)}/{m.ym.slice(0, 4)}</span>
            <span className="tabular-nums" dir="ltr">{m.hours ? num(m.hours) + " h · " : ""}{money(m.amount)}</span></div>
          {m.entries.map((e) => (
            <div key={e.id} className="px-4 py-2.5 border-t border-[#EEF2F7] flex items-center gap-2 text-[13.5px]" data-testid="fleet-entry">
              <span className="flex-1 min-w-0" dir="ltr">{F.showDate(e.date)}{e.mode === "hourly" ? ` · ${e.start}–${e.end}${e.endDate ? " (" + F.showDate(e.endDate) + ")" : ""} · ${num(e.hours)} h` : e.mode === "daily" ? ` · ${num(e.qty)} ${tr("days")}` : ` · ${F.showDate(e.pStart)}–${F.showDate(e.pEnd)}`}</span>
              <span className="tabular-nums font-semibold" dir="ltr">{money(e.amount)}</span>
              {e.evidence && e.evidence !== "demo" ? <button aria-label={tr("Evidence")} className="w-8 h-8 grid place-items-center text-[#475569]" onClick={() => setView(e.evidence)}><Paperclip size={15} /></button> : null}
            </div>))}
        </div>)) : <Empty>{tr("No work entered yet.")}</Empty>}
      {view ? <EvidenceView id={view} onClose={() => setView(null)} /> : null}
    </div>);
}
function EvidenceView({ id, onClose }) {
  const [a, setA] = useState(null);
  useEffect(() => { loadAttachment(id).then((x) => setA(x || { missing: true })); }, [id]);
  useSubBack(true, onClose);
  return <div className="fixed inset-0 z-[75] bg-[#0F172AF0] flex flex-col" onClick={onClose} data-testid="fleet-evidence-view">
    <div className="p-3 flex justify-end"><button className="w-11 h-11 rounded-full bg-[#FFFFFF] grid place-items-center" aria-label={tr("Close")}><X size={20} /></button></div>
    <div className="flex-1 min-h-0 flex items-center justify-center p-3" onClick={(e) => e.stopPropagation()}>
      {!a ? <p className="text-[#FFFFFF]">{tr("Loading…")}</p> : a.missing ? <p className="text-[#FFFFFF]">{tr("The file is not on this phone.")}</p>
        : /^data:image\//.test(a.url) ? <img src={a.url} alt="" className="max-w-full max-h-full object-contain" />
        : <a href={a.url} download={a.name || "evidence.pdf"} className="text-[#FFFFFF] underline">{tr("Open the PDF")}</a>}
    </div></div>;
}

// ---- Fleet: cranes, clients, sites, garages, banks ---------------------------------------------------------------------
function FleetTab({ s, run, money, setSheet, setOpen }) {
  const [seg, setSeg] = useSticky("fleet:seg", "cranes");
  const L = { cranes: "Cranes", team: "Team", clients: "Clients", sites: "Sites", garages: "Garages", banks: "Banks" };
  const rows = seg === "team" ? [] : F.live(s[seg]);
  const ym = F.isoDay().slice(0, 7);
  return (
    <div className="space-y-3" data-testid="fleet-fleet">
      <div className="flex items-center gap-2"><div className="flex-1 min-w-0"><Seg value={seg} onChange={setSeg} items={Object.entries(L)} testid="fleet-seg" /></div>
        <button className={btnP + " h-10 shrink-0"} style={{ background: "var(--biz)" }} onClick={() => setSheet(seg === "team" ? { kind: "person", rec: {} } : { kind: "list", coll: seg, rec: {} })} data-testid="fleet-add"><Plus size={17} />{tr("Add")}</button></div>
      {seg === "team" ? <TeamPane s={s} run={run} money={money} setSheet={setSheet} /> : !rows.length ? <Empty>{tr("Nothing here yet.")}</Empty> : <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2.5 lg:space-y-0">{rows.map((r) => {
        if (seg === "cranes") { const w = F.whereIs(s, r.id), p = F.craneProfit(s, r.id, { from: ym + "-01" });
          return <Row key={r.id} onClick={() => setOpen({ kind: "crane", id: r.id })} testid="fleet-crane">
            <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-[#EEF2F7] text-[#334155]"><Truck size={18} /></span>
            <span className="flex-1 min-w-0"><span className="block font-bold text-[14.5px] truncate" dir="auto">{r.name}</span>
              <span className="flex items-center gap-1.5 mt-0.5"><Tag tone={w.kind === "site" ? "green" : "gray"}>{w.kind === "site" ? tr("At site") : tr("In garage")}</Tag><span className={"text-[12px] truncate " + muted} dir="auto">{w.name}</span></span></span>
            <span className={"text-[12.5px] font-semibold tabular-nums " + (p.profit < 0 ? "text-[#B91C1C]" : "")} dir="ltr">{money(p.profit)}</span></Row>; }
        if (seg === "clients") { const b = F.clientBalance(s, r.id);
          return <Row key={r.id} onClick={() => setOpen({ kind: "client", id: r.id })} testid="fleet-client">
            <span className="flex-1 min-w-0 font-bold text-[14.5px] truncate" dir="auto">{r.name}</span>{r.inactive ? <Tag>{tr("Inactive")}</Tag> : null}
            <span className={"text-[13px] font-semibold tabular-nums " + (b.balance > 0 ? "text-[#B45309]" : "text-[#15803D]")} dir="ltr">{money(b.balance)}</span></Row>; }
        return <Row key={r.id} onClick={() => setSheet({ kind: "list", coll: seg, rec: r })} testid="fleet-place">
          <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-[#EEF2F7] text-[#334155]">{seg === "banks" ? <Building2 size={18} /> : <MapPin size={18} />}</span>
          <span className="flex-1 min-w-0"><span className="block font-bold text-[14.5px] truncate" dir="auto">{r.name}</span>{r.address ? <span className={"block text-[12px] truncate " + muted} dir="auto">{r.address}</span> : null}</span></Row>;
      })}</div>}
    </div>);
}
function CraneDetail({ s, run, money, setSheet, setOpen, id }) {
  const c = F.byId(s.cranes, id);
  const [range, setRange] = useState("month");
  if (!c || c.del) return <Empty>{tr("This crane was deleted.")}</Empty>;
  const t = F.isoDay(), from = range === "month" ? t.slice(0, 7) + "-01" : range === "year" ? t.slice(0, 4) + "-01-01" : "";
  const p = F.craneProfit(s, id, { from }), w = F.whereIs(s, id), parts = F.cranePartsReport(s, id, { from });
  const moves = s.moves.filter((m) => m.crane === id).slice(-6).reverse();
  const place = (l) => (l ? nameOf(l.kind === "site" ? s.sites : s.garages, l.id) : "");
  const del = async () => { if (await askConfirm("Move this crane to the Recycle Bin?", { yes: "Delete" })) { if (run((x) => F.remove(x, "cranes", id), tr("In the Recycle Bin for 7 days"))) setOpen(null); } };
  return (
    <div className="space-y-3" data-testid="fleet-crane-detail">
      <div className={card + " p-4 space-y-1"}>
        <p className="text-[20px] font-extrabold" dir="auto">{c.name}</p>
        <p className={"text-[13px] " + muted} dir="auto">{[c.brand, c.tons ? c.tons + " t" : ""].filter(Boolean).join(" · ")} · {tr("Hourly")} <span dir="ltr">{money(c.hourly)}</span> · {tr("Daily")} <span dir="ltr">{money(c.daily)}</span></p>
        <p className="text-[13.5px] flex items-center gap-1.5"><MapPin size={14} /><span dir="auto">{w.kind === "site" ? tr("At site") : tr("In garage")}: {w.name || "—"}</span></p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={btnP + " h-10"} style={{ background: "var(--biz)" }} onClick={() => setSheet({ kind: "move", crane: id })} data-testid="fleet-move"><Truck size={16} />{tr("Move crane")}</button>
        <button className={btnS} onClick={() => setSheet({ kind: "list", coll: "cranes", rec: c })}><Pencil size={15} />{tr("Edit")}</button>
        <button className={btnS + " text-[#B91C1C]"} onClick={del}><Trash2 size={15} />{tr("Delete")}</button>
      </div>
      {(() => { const sv = F.serviceStatus(s, id); if (!sv) return null;   // v6.34: maintenance by engine hours
        return <div className={card + " p-4 flex items-center gap-3"} data-testid="fleet-service"><Wrench size={18} className={sv.left <= 0 ? "text-[#B91C1C]" : "text-[#475569]"} />
          <span className="flex-1 min-w-0 text-[14px]"><b className="block">{sv.left <= 0 ? tr("Service due — {h} h since the last one", { h: num(sv.used) }) : tr("Service in {h} h", { h: num(sv.left) })}</b>
            <span className={"text-[12.5px] " + muted}>{tr("Every {e} h", { e: num(sv.every) })}{sv.last ? " · " + tr("last {d}", { d: F.showDate(sv.last) }) : ""}</span></span>
          <button className={btnS + " shrink-0"} onClick={() => run((x) => F.markServiced(x, id), tr("Service saved — the hours start again"))} data-testid="fleet-serviced"><Check size={15} />{tr("Serviced today")}</button></div>; })()}
      <CraneMore s={s} run={run} money={money} setSheet={setSheet} id={id} />
      <Seg value={range} onChange={setRange} items={[["month", "This month"], ["year", "This year"], ["all", "All time"]]} testid="fleet-range" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5" data-testid="fleet-profit">
        <Kpi label={tr("Income")} value={money(p.income)} /><Kpi label={tr("Expenses")} value={money(p.expenses)} />
        <Kpi label={tr("Parts from the store")} value={money(p.parts)} /><Kpi label={tr("Profit")} value={money(p.profit)} tone={p.profit < 0 ? "red" : null} />
      </div>
      {parts.items.length ? <div className={card + " p-4"}><p className="font-bold text-[14.5px] mb-2">{tr("Parts issued to this crane")}</p>
        {parts.items.map((x) => <div key={x.item} className="flex justify-between text-[13.5px] py-1"><span dir="auto">{x.item} × {num(x.qty)}</span><span className="tabular-nums" dir="ltr">{money(x.total)}</span></div>)}</div> : null}
      {moves.length ? <div className={card + " p-4"}><p className="font-bold text-[14.5px] mb-2">{tr("Moves")}</p>
        {moves.map((m) => <p key={m.id} className="text-[13px] py-0.5" dir="auto">{F.showDate(m.date)} · {place(m.from) || "—"} → {place(m.to) || "—"}{m.note ? " · " + m.note : ""}</p>)}</div> : null}
    </div>);
}
function ClientDetail({ s, run, money, setSheet, setOpen, id, saveFile }) {
  const c = F.byId(s.clients, id);
  if (!c || c.del) return <Empty>{tr("This client was deleted.")}</Empty>;
  const b = F.clientBalance(s, id);
  const jobs = F.live(s.jobs).filter((j) => j.client === id);
  const pays = F.live(s.cheques).filter((q) => q.client === id && q.dir === "in");
  const del = async () => { if (await askConfirm("Move this client to the Recycle Bin?", { yes: "Delete" })) { if (run((x) => F.remove(x, "clients", id), tr("In the Recycle Bin for 7 days"))) setOpen(null); } };
  return (
    <div className="space-y-3" data-testid="fleet-client-detail">
      <div className={card + " p-4"}><p className="text-[20px] font-extrabold" dir="auto">{c.name}</p>{c.phone ? <p className={"text-[13px] " + muted} dir="ltr">{c.phone}</p> : null}
        <p className="text-[24px] font-extrabold tabular-nums mt-1" dir="ltr" data-testid="fleet-balance">{money(b.balance)}</p>
        <p className={"text-[12.5px] " + muted}>{tr("Opening")} <span dir="ltr">{money(b.opening)}</span> + {tr("work")} <span dir="ltr">{money(b.work)}</span>{b.tax ? <> + {tr("VAT")} <span dir="ltr">{money(b.tax)}</span></> : null} − {tr("paid")} <span dir="ltr">{money(b.paid)}</span>{b.pending ? <> · {tr("cheques not yet due")} <span dir="ltr">{money(b.pending)}</span></> : null}</p></div>
      <div className="flex flex-wrap gap-2">
        <button className={btnP + " h-10"} style={{ background: "var(--biz)" }} onClick={() => setSheet({ kind: "cheque", dir: "in", client: id })}><Plus size={16} />{tr("Payment received")}</button>
        {P.uninvoiced(s, id).length ? <button className={btnS} onClick={() => setSheet({ kind: "invoice", client: id })} data-testid="fleet-client-invoice"><Printer size={15} />{tr("Invoice the work")}</button> : null}
        <button className={btnS} onClick={() => printHTML(F.statementHTML(s, id, { rtl: isAr() }), saveFile, `statement-${String(c.name).replace(/[^\p{L}\p{N}]+/gu, "-")}.html`)} data-testid="fleet-statement"><Printer size={15} />{tr("Statement")}</button>
        <button className={btnS} onClick={() => setSheet({ kind: "portal", client: id })} data-testid="fleet-portal-open"><Globe size={15} />{tr("Client page")}</button>
        <button className={btnS} onClick={() => setSheet({ kind: "list", coll: "clients", rec: c })}><Pencil size={15} />{tr("Edit")}</button>
        <button className={btnS + " text-[#B91C1C]"} onClick={del}><Trash2 size={15} />{tr("Delete")}</button></div>
      {(() => { const inv = P.invoiceStatus(s).filter((v) => v.client === id); return inv.length ? <><p className="font-bold text-[14.5px]">{tr("Invoices")}</p>
        {inv.map((v) => <Row key={v.id} onClick={() => setSheet({ kind: "invoiceView", id: v.id })}><span className="flex-1 min-w-0 text-[14px]" dir="auto"><b dir="ltr">{v.no}</b> · {F.showDate(v.date)}</span><Tag tone={v.status === "paid" ? "green" : v.status === "overdue" ? "red" : v.status === "partial" ? "amber" : "gray"}>{tr({ paid: "Paid", partial: "Partly paid", unpaid: "Unpaid", overdue: "Overdue" }[v.status])}</Tag><span className="tabular-nums text-[13px]" dir="ltr">{money(v.left)}</span></Row>)}</> : null; })()}
      <p className="font-bold text-[14.5px]">{tr("Job orders")}</p>
      {jobs.length ? jobs.map((j) => <Row key={j.id} onClick={() => setOpen({ kind: "job", id: j.id })}><span className="flex-1 min-w-0 text-[14px]" dir="auto"><b dir="ltr">{j.no}</b> · {nameOf(s.cranes, j.crane)}</span><span className="tabular-nums text-[13px]" dir="ltr">{money(F.jobTotal(s, j.id))}</span></Row>) : <Empty>{tr("No job orders yet.")}</Empty>}
      <p className="font-bold text-[14.5px]">{tr("Payments")}</p>
      {pays.length ? pays.map((q) => <div key={q.id} className={card + " p-3 flex items-center gap-2 text-[13.5px]"}><span className="flex-1" dir="auto">{F.showDate(q.due)} · {q.method === "cheque" ? tr("Cheque") + " " + q.no : tr(q.method === "cash" ? "Cash" : "Transfer")}</span><Tag tone={q.status === "cleared" ? "green" : q.status === "bounced" ? "red" : "amber"}>{tr(STATUS_L[q.status])}</Tag><span className="tabular-nums" dir="ltr">{money(q.amount)}</span></div>) : <Empty>{tr("No payments yet.")}</Empty>}
    </div>);
}

// ---- Money: payments, expenses, profit, export ---------------------------------------------------------------------------
function Money({ s, run, money, setSheet, setOpen, saveFile, flash }) {
  const [seg, setSeg] = useSticky("fleet:money", "payments");
  return (
    <div className="space-y-3" data-testid="fleet-money">
      <Seg value={seg} onChange={setSeg} items={[["payments", "Cheques & payments"], ["invoices", "Invoices"], ["aging", "Who owes what"], ["expenses", "Expenses"], ["profit", "Profit per crane"], ["sites", "Profit per site"], ["query", "Query"], ["reports", "Reports"], ["export", "Export"]]} testid="fleet-mseg" />
      {seg === "payments" ? <Payments s={s} run={run} money={money} setSheet={setSheet} /> : seg === "invoices" ? <InvoicesPane s={s} money={money} setSheet={setSheet} />
        : seg === "aging" ? <AgingPane s={s} money={money} setOpen={setOpen} /> : seg === "reports" ? <ReportsPane s={s} money={money} /> : seg === "expenses" ? <Expenses s={s} run={run} money={money} setSheet={setSheet} />
        : seg === "profit" ? <Profit s={s} money={money} saveFile={saveFile} flash={flash} /> : seg === "sites" ? <SitesPane s={s} money={money} saveFile={saveFile} flash={flash} />
        : seg === "query" ? <QueryPane s={s} saveFile={saveFile} flash={flash} /> : <ExportPane s={s} saveFile={saveFile} flash={flash} />}
    </div>);
}
function Payments({ s, run, money, setSheet }) {
  const [f, setF] = useState("pending");
  const list = F.live(s.cheques).filter((q) => f === "all" || q.status === f).sort((a, b) => (a.due < b.due ? -1 : 1));
  const t = F.isoDay();
  return <div className="space-y-2.5">
    <div className="flex gap-2"><button className={btnP + " h-10 flex-1"} style={{ background: "var(--biz)" }} onClick={() => setSheet({ kind: "cheque", dir: "in" })} data-testid="fleet-pay-in"><Plus size={16} />{tr("Received")}</button>
      <button className={btnS + " flex-1"} onClick={() => setSheet({ kind: "cheque", dir: "out" })} data-testid="fleet-pay-out"><Plus size={16} />{tr("Paid out")}</button></div>
    <Seg value={f} onChange={setF} items={[["pending", "Pending"], ["cleared", "Cleared"], ["bounced", "Bounced"], ["all", "All"]]} testid="fleet-qf" />
    {list.length ? list.map((q) => {
      const late = q.status === "pending" && q.due < t;
      return <div key={q.id} className={card + " p-3.5 space-y-2"} data-testid="fleet-cheque">
        <div className="flex items-center gap-2"><Tag tone={q.dir === "in" ? "green" : "blue"}>{q.dir === "in" ? tr("In") : tr("Out")}</Tag>
          <span className="flex-1 min-w-0 text-[14px] font-semibold truncate" dir="auto">{q.client ? nameOf(s.clients, q.client) : q.payee}</span>
          <span className="text-[14px] font-bold tabular-nums" dir="ltr">{money(q.amount)}</span></div>
        <p className={"text-[12.5px] " + (late ? "text-[#B91C1C] font-semibold" : muted)} dir="auto">{q.method === "cheque" ? `${tr("Cheque")} ${q.no}${q.bank ? " · " + q.bank : ""} · ` : tr(q.method === "cash" ? "Cash" : "Transfer") + " · "}{tr("Due")} {F.showDate(q.due)} · {tr(STATUS_L[q.status])}</p>
        {q.method === "cheque" ? <div className="flex gap-1.5">
          {q.status !== "cleared" ? <button className={btnS + " h-9"} onClick={() => run((x) => F.setChequeStatus(x, q.id, "cleared"), tr("Marked cleared"))} data-testid="fleet-clear"><Check size={14} />{tr("Cleared")}</button> : null}
          {q.status !== "bounced" ? <button className={btnS + " h-9"} onClick={() => run((x) => F.setChequeStatus(x, q.id, "bounced"), tr("Marked bounced — it stays owed"))}>{tr("Bounced")}</button> : null}
          {q.status !== "pending" ? <button className={btnS + " h-9"} onClick={() => run((x) => F.setChequeStatus(x, q.id, "pending"))}>{tr("Pending")}</button> : null}
          <button className={btnS + " h-9 ms-auto text-[#B91C1C]"} aria-label={tr("Delete")} onClick={async () => { if (await askConfirm("Move this payment to the Recycle Bin?", { yes: "Delete" })) run((x) => F.remove(x, "cheques", q.id)); }}><Trash2 size={14} /></button></div> : null}
      </div>; }) : <Empty>{tr("Nothing here.")}</Empty>}
  </div>;
}
function Expenses({ s, run, money, setSheet }) {
  const list = F.live(s.expenses).slice().reverse();
  const ym = F.isoDay().slice(0, 7), byType = F.expensesByType(s, { from: ym + "-01" });
  return <div className="space-y-2.5">
    <button className={btnP + " h-10 w-full"} style={{ background: "var(--biz)" }} onClick={() => setSheet({ kind: "expense" })} data-testid="fleet-new-expense"><Plus size={16} />{tr("New expense")}</button>
    {Object.keys(byType).length ? <div className={card + " p-4"}><p className="font-bold text-[14px] mb-1.5">{tr("This month by type")}</p>
      {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => <div key={k} className="flex justify-between text-[13.5px] py-0.5"><span dir="auto">{tr(k)}</span><span className="tabular-nums" dir="ltr">{money(v)}</span></div>)}</div> : null}
    {list.length ? list.map((x) => <div key={x.id} className={card + " p-3.5 flex items-center gap-2"} data-testid="fleet-expense">
      <span className="flex-1 min-w-0"><span className="block text-[14px] font-semibold truncate" dir="auto">{x.lines.map((l) => tr(l.type)).join(" · ")}</span>
        <span className={"block text-[12.5px] " + muted} dir="auto">{x.period ? F.showDate(x.from) + " → " + F.showDate(x.to) : F.showDate(x.date)} · {x.crane ? nameOf(s.cranes, x.crane) : x.site ? nameOf(s.sites, x.site) : tr("General")}</span></span>
      <span className="tabular-nums font-bold text-[14px]" dir="ltr">{money(x.total)}</span>
      <button className="w-9 h-9 grid place-items-center text-[#94A3B8]" aria-label={tr("Delete")} onClick={async () => { if (await askConfirm("Move this expense to the Recycle Bin?", { yes: "Delete" })) run((st) => F.remove(st, "expenses", x.id)); }}><Trash2 size={15} /></button></div>) : <Empty>{tr("No expenses yet.")}</Empty>}
  </div>;
}
function Profit({ s, money, saveFile, flash }) {
  const [range, setRange] = useState("month");
  const t = F.isoDay(), from = range === "month" ? t.slice(0, 7) + "-01" : range === "year" ? t.slice(0, 4) + "-01-01" : "";
  const rows = F.fleetProfit(s, { from });
  const tot = rows.reduce((a, r) => ({ income: a.income + r.income, expenses: a.expenses + r.expenses, parts: a.parts + r.parts, profit: a.profit + r.profit }), { income: 0, expenses: 0, parts: 0, profit: 0 });
  const general = Object.values(F.expensesByType(s, { from, general: true })).reduce((n, v) => n + v, 0);
  return <div className="space-y-2.5" data-testid="fleet-profit-all">
    <Seg value={range} onChange={setRange} items={[["month", "This month"], ["year", "This year"], ["all", "All time"]]} testid="fleet-prange" />
    <div className={card + " overflow-x-auto"}><table className="w-full text-[13px]"><thead><tr className={"text-start " + muted}>{["Crane", "Income", "Expenses", "Parts", "Profit"].map((h, i) => <th key={h} className={"px-3 py-2.5 font-semibold " + (i ? "text-end" : "text-start")}>{tr(h)}</th>)}</tr></thead>
      <tbody>{rows.map((r) => <tr key={r.crane.id} className="border-t border-[#EEF2F7]"><td className="px-3 py-2.5" dir="auto">{r.crane.name}</td>{["income", "expenses", "parts", "profit"].map((k) => <td key={k} className={"px-3 py-2.5 text-end tabular-nums " + (k === "profit" && r.profit < 0 ? "text-[#B91C1C] font-semibold" : k === "profit" ? "font-semibold" : "")} dir="ltr">{num(r[k])}</td>)}</tr>)}
        <tr className="border-t-2 border-[#DCE3EC] font-bold"><td className="px-3 py-2.5">{tr("Total")}</td>{["income", "expenses", "parts", "profit"].map((k) => <td key={k} className="px-3 py-2.5 text-end tabular-nums" dir="ltr">{num(tot[k])}</td>)}</tr></tbody></table></div>
    {general ? <p className={"text-[12.5px] " + muted}>{tr("General expenses (not tied to a crane): {v} — net after them: {n}", { v: money(general), n: money(tot.profit - general) })}</p> : null}
    {rows.length ? <TableOut s={s} saveFile={saveFile} flash={flash} title="Profit per crane" head={["Crane", "Income", "Expenses", "Parts", "Profit"]} rows={rows.map((r) => [r.crane.name, r.income, r.expenses, r.parts, r.profit])} total={tot.profit} file={"fleet-profit-" + t} testid="fleet-profit" /> : null}
  </div>;
}
function ExportPane({ s, saveFile, flash }) {
  const ym = F.isoDay().slice(0, 7), yr = F.isoDay().slice(0, 4);
  const K = [["entries", "Work entries"], ["balances", "Client balances"], ["cheques", "Cheques & payments"], ["expenses", "Expenses"], ["profit", "Profit per crane"], ["store", "Store movements"],
    ["invoices", "Invoices"], ["aging", "Who owes what (aging)"], ["payroll:" + ym, "Payroll this month"], ["utilisation:" + ym, "Utilisation this month"], ["revenue:" + yr, "Revenue by month"], ["fuel", "Fuel"], ["quotes", "Quotations"], ["pos", "Purchase orders"], ["vendors", "Supplier balances"]];
  const rowsOf = (k) => (/^(quotes|pos|vendors)$/.test(k) ? Q.exportTradeRows(s, k) : /^(invoices|aging|fuel|payroll:|utilisation:|revenue:)/.test(k) ? P.exportProRows(s, k) : F.exportRows(s, k));
  const go = (k, l) => { k = String(k); try { saveOut(saveFile, `fleet-${k.replace(":", "-")}-${F.isoDay()}.xlsx`, xlsxFromRows(rowsOf(k), tr(l).slice(0, 30)), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); flash(tr("Saved {f}", { f: `fleet-${k.replace(":", "-")}.xlsx` })); } catch (e) { flash(tr(e.message)); } };
  return <div className="space-y-2" data-testid="fleet-export"><p className={"text-[13px] " + muted}>{tr("Each one is an Excel file you can open on a computer or send to your accountant.")}</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{K.map(([k, l]) => <button key={k} className={btnS + " h-12 justify-start px-4"} onClick={() => go(k, l)} data-testid={"fleet-x-" + k.split(":")[0]}><Download size={16} />{tr(l)}</button>)}</div></div>;
}

// ---- Store (the warehouse) ------------------------------------------------------------------------------------------------
function Store({ s, run, money, setSheet, saveFile, flash }) {
  // v6.44: Purchase orders and Suppliers live here too
  const [seg, setSeg] = useSticky("fleet:store", "stock");
  return (
    <div className="space-y-3" data-testid="fleet-store">
      <div className="flex gap-2"><button className={btnP + " h-10 flex-1"} style={{ background: "var(--biz)" }} onClick={() => setSheet({ kind: "in" })} data-testid="fleet-in"><Plus size={16} />{tr("Incoming")}</button>
        <button className={btnS + " flex-1 h-10"} onClick={() => setSheet({ kind: "out" })} data-testid="fleet-out"><Package size={16} />{tr("Issue parts")}</button></div>
      <Seg value={seg} onChange={setSeg} items={[["stock", "Stock"], ["log", "Movements"], ["orders", "Purchase orders"], ["suppliers", "Suppliers"], ["reports", "Reports"], ["lists", "Lists"]]} testid="fleet-sseg" />
      {seg === "lists" ? <ListsPane s={s} run={run} /> : seg === "orders" ? <OrdersPane s={s} money={money} setSheet={setSheet} /> : seg === "suppliers" ? <VendorsPane s={s} money={money} setSheet={setSheet} /> : seg === "stock" ? <StockList s={s} money={money} setSheet={setSheet} /> : seg === "log" ? <StoreLog s={s} money={money} setSheet={setSheet} /> : <StoreReports s={s} money={money} setSheet={setSheet} />}
    </div>);
}
function StockList({ s, money, setSheet }) {
  const list = F.stockList(s.store);
  const value = list.reduce((n, x) => n + x.value, 0);
  if (!list.length) return <Empty>{tr("The store is empty. Add an incoming invoice to start.")}</Empty>;
  return <div className="space-y-2"><StoreKpis s={s} money={money} /><p className={"text-[13px] " + muted}>{tr("Stock value at purchase price")}: <b className="tabular-nums" dir="ltr">{money(value)}</b></p>
    <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2.5 lg:space-y-0">{list.map((it) => <Row key={it.name} onClick={() => setSheet({ kind: "item", name: it.name })} testid="fleet-item">
      <span className="flex-1 min-w-0"><span className="block font-bold text-[14.5px] truncate" dir="auto">{it.name}</span><span className={"block text-[12px] " + muted}>{tr("Avg. price")} <span dir="ltr">{money(it.avg)}</span>{it.min ? " · " + tr("min") + " " + it.min : ""}</span></span>
      {it.low ? <Tag tone={it.balance <= 0 ? "red" : "amber"}>{tr("Low")}</Tag> : null}<span className="text-[15px] font-extrabold tabular-nums" dir="ltr">{num(it.balance)}</span></Row>)}</div></div>;
}
function StoreLog({ s, money, setSheet }) {
  const [q, setQ] = useState(""), [kind, setKind] = useState(""), [f, setF] = useState({});
  const r = F.searchStore(s.store, { ...f, text: q, kind });
  const rows = r.rows.slice().reverse();
  return <div className="space-y-2.5">
    <div className="flex gap-2"><div className="relative flex-1"><Search size={16} className="absolute top-3.5 start-3 text-[#94A3B8]" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search code, item, supplier, technician…")} className={inp + " ps-9"} data-testid="fleet-store-search" dir="auto" /></div>
      <select value={kind} onChange={(e) => setKind(e.target.value)} className={inp + " w-32"}><option value="">{tr("All")}</option><option value="in">{tr("Incoming")}</option><option value="out">{tr("Outgoing")}</option></select></div>
    <StoreFilters s={s} f={f} setF={setF} />
    <p className={"text-[12.5px] " + muted} data-testid="fleet-store-stats">{tr("{n} lines · in {i} · out {o}", { n: r.count, i: money(r.inTotal), o: money(r.outTotal) })}{r.balance != null ? " · " + tr("balance {b}", { b: num(r.balance) }) : ""}</p>
    {rows.length ? <div className={card + " overflow-x-auto"}><table className="w-full text-[13px]"><thead><tr className={muted}>{["Code", "Date", "Item", "Qty", "Total", "Balance"].map((h, i) => <th key={h} className={"px-3 py-2.5 font-semibold whitespace-nowrap " + (i > 2 ? "text-end" : "text-start")}>{tr(h)}</th>)}</tr></thead>
      <tbody>{rows.slice(0, 300).map((t) => <tr key={t.id} className="border-t border-[#EEF2F7] cursor-pointer hover:bg-[#F8FAFC]" onClick={() => setSheet({ kind: "doc", doc: t.doc })} data-testid="fleet-tx">
        <td className="px-3 py-2.5 whitespace-nowrap" dir="ltr"><span className={"inline-block w-2 h-2 rounded-full me-1.5 " + (t.kind === "in" ? "bg-[#15803D]" : "bg-[#B91C1C]")} />{t.doc}</td>
        <td className="px-3 py-2.5 whitespace-nowrap" dir="ltr">{F.showDate(t.date)}</td><td className="px-3 py-2.5" dir="auto">{t.item}{t.ref ? <span className={"block text-[11px] " + muted} dir="ltr">↳ {t.ref}</span> : null}</td>
        <td className="px-3 py-2.5 text-end tabular-nums" dir="ltr">{t.kind === "in" ? "+" : "−"}{num(t.qty)}</td><td className="px-3 py-2.5 text-end tabular-nums" dir="ltr">{num(t.total)}</td><td className="px-3 py-2.5 text-end tabular-nums font-semibold" dir="ltr">{num(t.balance)}</td></tr>)}</tbody></table></div>
      : <Empty>{tr("No movements.")}</Empty>}
  </div>;
}
function StoreReports({ s, money, setSheet }) {
  const [rep, setRep] = useState("crane");
  const docs = F.incomingDocs(s.store);
  const [doc, setDoc] = useState(docs[docs.length - 1] || "");
  const list = rep === "ref" ? null : F.storeBy(s, rep === "crane" ? "crane" : rep === "tech" ? "tech" : "supplier");
  const sup = rep === "supplier" ? Object.values((s.store.tx || []).filter((t) => t.kind === "in").reduce((m, t) => { const k = t.supplier || "—"; m[k] = m[k] || { name: k, total: 0, lines: 0 }; m[k].total = F.r2(m[k].total + t.total); m[k].lines++; return m; }, {})).sort((a, b) => b.total - a.total) : null;
  return <div className="space-y-2.5">
    <Seg value={rep} onChange={setRep} items={[["crane", "By crane / destination"], ["tech", "By technician"], ["supplier", "By supplier"], ["ref", "Reference code"]]} testid="fleet-rep" />
    {rep === "ref" ? <>
      <select value={doc} onChange={(e) => setDoc(e.target.value)} className={inp} data-testid="fleet-ref-pick" dir="ltr">{docs.map((d) => <option key={d} value={d}>{d}</option>)}</select>
      {doc ? <div className={card + " overflow-x-auto"}><table className="w-full text-[13px]"><thead><tr className={muted}>{["Item", "Bought", "Issued", "Left", "Unit price"].map((h, i) => <th key={h} className={"px-3 py-2.5 font-semibold " + (i ? "text-end" : "text-start")}>{tr(h)}</th>)}</tr></thead>
        <tbody>{F.invoiceItems(s.store, doc).map((x) => <tr key={x.item} className="border-t border-[#EEF2F7]"><td className="px-3 py-2.5" dir="auto">{x.item}</td>{[x.qty, x.issued, x.remaining, x.unit].map((v, i) => <td key={i} className="px-3 py-2.5 text-end tabular-nums" dir="ltr">{num(v)}</td>)}</tr>)}</tbody></table></div> : <Empty>{tr("No incoming invoices yet.")}</Empty>}
      {doc ? <RefIssues s={s} doc={doc} money={money} /> : null}
    </> : (sup || list).length ? <div className="space-y-2">{(sup || list).map((x) => <Row key={x.name} onClick={() => setSheet({ kind: "history", key: rep === "crane" ? "crane" : rep, name: x.name })} testid="fleet-rep-row"><span className="flex-1 min-w-0 font-semibold text-[14px] truncate" dir="auto">{x.name}</span><span className={"text-[12px] " + muted}>{tr("{n} lines", { n: x.lines })}</span><span className="tabular-nums font-bold text-[14px]" dir="ltr">{money(x.total)}</span></Row>)}</div> : <Empty>{tr("Nothing yet.")}</Empty>}
  </div>;
}

// ---- the sheets (forms) ----------------------------------------------------------------------------------------------------
function SheetBody(p) {
  const k = p.sheet.kind;
  if (k === "list") return <ListForm {...p} />;
  if (k === "job") return <JobForm {...p} />;
  if (k === "order") return <OrderForm {...p} />;
  if (k === "work") return <WorkForm {...p} />;
  if (k === "cheque") return <ChequeForm {...p} />;
  if (k === "expense") return <ExpenseForm {...p} />;
  if (k === "move") return <MoveForm {...p} />;
  if (k === "in") return <InForm {...p} />;
  if (k === "out") return <OutForm {...p} />;
  if (k === "item") return <ItemForm {...p} />;
  if (k === "doc") return <DocView {...p} />;
  if (k === "bin") return <BinView {...p} />;
  if (k === "settings") return <SettingsForm {...p} />;
  if (k === "backup") return <BackupForm {...p} />;
  if (k === "invoice") return <InvoiceForm {...p} />;
  if (k === "invoiceView") return <InvoiceView {...p} />;
  if (k === "person") return <PersonForm {...p} />;
  if (k === "advance") return <AdvanceForm {...p} />;
  if (k === "paper") return <PaperForm {...p} />;
  if (k === "repair") return <RepairForm {...p} />;
  if (k === "fuel") return <FuelForm {...p} />;
  if (k === "quote") return <QuoteForm {...p} />;
  if (k === "quoteView") return <QuoteView {...p} />;
  if (k === "po") return <POForm {...p} />;
  if (k === "poView") return <POView {...p} />;
  if (k === "vendor") return <VendorForm {...p} />;
  if (k === "rates") return <RatesForm {...p} />;
  if (k === "portal") return <PortalForm {...p} />;
  if (k === "history") return <HistorySheet {...p} />;
  return null;
}
export const SaveBtn = ({ onClick, children, disabled, testid = "fleet-save" }) => <button className={btnP + " w-full"} style={{ background: "var(--biz)" }} onClick={onClick} disabled={disabled} data-testid={testid}><Check size={18} />{children || tr("Save")}</button>;
export const opts = (arr) => F.live(arr).map((x) => ({ v: x.id, l: x.name }));

function ListForm({ s, run, sheet, close }) {
  const { coll } = sheet;
  const [r, setR] = useState({ ...sheet.rec });
  const set = (k) => (v) => setR({ ...r, [k]: v });
  const save = () => { if (run((x) => F.upsert(x, coll, r), tr("Saved"))) close(); };
  return <div className="space-y-3" data-testid="fleet-list-form">
    <Txt label={tr("Name")} value={r.name} onChange={set("name")} testid="fleet-f-name" />
    {coll === "cranes" ? <><div className="grid grid-cols-2 gap-2"><Txt label={tr("Brand")} value={r.brand} onChange={set("brand")} /><Txt label={tr("Capacity (t)")} value={r.tons} onChange={set("tons")} mode="decimal" /></div>
      <div className="grid grid-cols-2 gap-2"><Txt label={tr("Hourly rate")} value={r.hourly} onChange={set("hourly")} mode="decimal" testid="fleet-f-hourly" /><Txt label={tr("Daily rate")} value={r.daily} onChange={set("daily")} mode="decimal" testid="fleet-f-daily" /></div>
      <Txt label={tr("Service every (engine hours, optional)")} value={r.serviceEvery} onChange={set("serviceEvery")} mode="decimal" testid="fleet-f-service" />
      <div className="grid grid-cols-3 gap-2"><Txt label={tr("Code")} value={r.code} onChange={set("code")} dir="ltr" testid="fleet-f-code" /><Txt label={tr("Model")} value={r.model} onChange={set("model")} /><Txt label={tr("Year")} value={r.year} onChange={set("year")} mode="numeric" dir="ltr" /></div>
      <Txt label={tr("Notes")} value={r.notes} onChange={set("notes")} />
      {!r.id ? <Sel label={tr("Garage")} value={r.loc ? r.loc.id : ""} onChange={(v) => setR({ ...r, loc: { kind: "garage", id: v || null }, home: v || null })} options={opts(s.garages)} empty={F.live(s.garages).length ? null : tr("— add a garage first (optional) —")} /> : null}</> : null}
    {coll === "clients" ? <><Txt label={tr("Phone")} value={r.phone} onChange={set("phone")} mode="tel" dir="ltr" /><Txt label={tr("Tax reg. no. (on invoices)")} value={r.taxNo} onChange={set("taxNo")} dir="ltr" /><Txt label={tr("Opening balance (what they owed before)")} value={r.opening} onChange={set("opening")} mode="decimal" testid="fleet-f-opening" />
      <div className="grid grid-cols-2 gap-2"><Txt label={tr("Contact person")} value={r.contact} onChange={set("contact")} testid="fleet-f-contact" /><Txt label={tr("Email")} value={r.email} onChange={set("email")} dir="ltr" /></div>
      <Txt label={tr("Address")} value={r.address} onChange={set("address")} />
      <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={!!r.inactive} onChange={(e) => setR({ ...r, inactive: e.target.checked })} className="w-5 h-5" data-testid="fleet-f-inactive" />{tr("Not active any more")}</label></> : null}
    {coll === "banks" ? <><div className="grid grid-cols-2 gap-2"><Txt label={tr("Account number")} value={r.account} onChange={set("account")} dir="ltr" testid="fleet-f-account" /><Txt label={tr("Branch")} value={r.branch} onChange={set("branch")} /></div>
      <div className="grid grid-cols-2 gap-2"><Txt label={tr("Account holder")} value={r.holder} onChange={set("holder")} /><Txt label={tr("Opening balance")} value={r.opening} onChange={set("opening")} mode="decimal" /></div></> : null}
    {coll === "sites" ? <Txt label={tr("Address")} value={r.address} onChange={set("address")} /> : null}
    <SaveBtn onClick={save} disabled={!String(r.name || "").trim()} />
    {r.id ? <button className={btnS + " w-full text-[#B91C1C]"} onClick={async () => { if (await askConfirm("Move this to the Recycle Bin?", { yes: "Delete" })) { if (run((x) => F.remove(x, coll, r.id), tr("In the Recycle Bin for 7 days"))) close(); } }}><Trash2 size={15} />{tr("Delete")}</button> : null}
  </div>;
}
/** A quick "add one" inside another form (a new client / site while making a job). */
function QuickAdd({ s, run, coll, onAdded, label }) {
  const [v, setV] = useState(null);
  if (v == null) return <button type="button" className="text-[12.5px] font-semibold mt-1" style={{ color: "var(--biz)" }} onClick={() => setV("")}>+ {label}</button>;
  return <div className="flex gap-1.5 mt-1.5"><input autoFocus value={v} onChange={(e) => setV(e.target.value)} className={inp + " h-10"} dir="auto" data-testid={"fleet-qa-" + coll} />
    <button type="button" className={btnS} onClick={() => { const r = run((x) => F.upsert(x, coll, { name: v })); if (r) { onAdded(r[coll][r[coll].length - 1].id); setV(null); } }}>{tr("Add")}</button></div>;
}
function JobForm({ s, run, sheet, close, money }) {
  const [j, setJ] = useState({ mode: "hourly", start: F.isoDay(), crane: sheet.crane || "", client: "", site: "", rate: "", end: "" });
  const set = (k) => (v) => setJ({ ...j, [k]: v });
  const c = F.byId(s.cranes, j.crane), can = j.crane && j.site ? F.canStartJob(s, j.crane, j.site) : null;
  const def = c ? (j.mode === "hourly" ? c.hourly : c.daily) : "";
  const save = () => { if (run((x) => F.addJob(x, j), tr("Job order saved"))) close(); };
  return <div className="space-y-3" data-testid="fleet-job-form">
    <Sel label={tr("Crane")} value={j.crane} onChange={set("crane")} options={F.live(s.cranes).map((x) => { const w = F.whereIs(s, x.id); return { v: x.id, l: `${x.name} — ${w.kind === "site" ? tr("at") + " " + w.name : tr("free")}` }; })} empty={tr("Choose…")} testid="fleet-f-crane" />
    <div><Sel label={tr("Client")} value={j.client} onChange={set("client")} options={opts(s.clients)} empty={tr("Choose…")} testid="fleet-f-client" /><QuickAdd s={s} run={run} coll="clients" label={tr("New client")} onAdded={set("client")} /></div>
    <div><Sel label={tr("Site")} value={j.site} onChange={set("site")} options={opts(s.sites)} empty={tr("Choose…")} testid="fleet-f-site" /><QuickAdd s={s} run={run} coll="sites" label={tr("New site")} onAdded={set("site")} /></div>
    {can && !can.ok ? <p className="text-[13px] text-[#B91C1C] flex gap-1.5" data-testid="fleet-blocked"><AlertTriangle size={15} className="shrink-0 mt-0.5" />{tr(can.tpl || can.why, can.vars)}</p> : null}
    <Seg value={j.mode} onChange={set("mode")} items={[["hourly", "Hourly"], ["daily", "Daily"], ["period", "Period"]]} testid="fleet-f-mode" />
    <Txt label={tr(j.mode === "hourly" ? "Rate per hour" : j.mode === "daily" ? "Rate per day" : "Rate per period")} value={j.rate} onChange={set("rate")} mode="decimal" placeholder={def !== "" ? num(def) : ""} />
    <div className="grid grid-cols-2 gap-2"><DateF label={tr("Start")} value={j.start} onChange={set("start")} /><DateF label={tr("End (optional)")} value={j.end} onChange={set("end")} /></div>
    <SaveBtn onClick={save} disabled={!j.crane || !j.client || !j.site || (can && !can.ok)} />
  </div>;
}
/** v6.37 (W1): a client's WhatsApp message → the cranes free those days, the price, the reply, a quote, and the booking. */
function OrderForm({ s, run, sheet, close, money, flash, saveFile }) {
  const [text, setText] = useState(sheet.text || "");
  const [edit, setEdit] = useState({});            // what the person corrected (wins over what was read)
  const [client, setClient] = useState("");
  const [pick, setPick] = useState(null);
  const read = useMemo(() => FO.readOrder(text, { today: F.isoDay(), sites: F.live(s.sites) }), [text, s.sites]);
  const o = { ...read, ...edit };
  if (edit.mode === "hourly") { o.hours = edit.hours || read.hours || 8; o.days = 0; } else if (edit.mode === "daily") { o.days = edit.days || read.days || 1; o.hours = 0; }
  const list = text.trim() ? FO.cranesFor(s, o) : [];
  const chosen = list.find((x) => x.crane.id === pick) || list.find((x) => !x.busy) || null;
  const cur = s.settings.currency, ar = isAr();
  const site = F.live(s.sites).find((x) => x.name.toLowerCase() === String(o.siteText || "").toLowerCase());
  const reply = chosen ? FO.quoteText(o, chosen, { lang: /[\u0600-\u06FF]/.test(text) ? "ar" : "en", currency: cur }) : "";   // in the client's own language
  const book = () => {
    const r = run((x) => {
      let y = x, siteId = site ? site.id : null;
      if (!siteId) { y = F.upsert(y, "sites", { name: o.siteText || tr("Site") }); siteId = y.sites[y.sites.length - 1].id; }
      const end = o.mode === "hourly" ? o.start : F.addDays(o.start, Math.max(1, o.days) - 1);
      return F.addJob(y, { crane: chosen.crane.id, client, site: siteId, mode: o.mode, start: o.start, end, rate: chosen.rate, notes: text.slice(0, 300) });
    }, tr("Job order saved"));
    if (r) close();
  };
  return <div className="space-y-3" data-testid="fleet-order-form">
    <Field label={tr("The client's message")}><textarea value={text} onChange={(e) => { setText(e.target.value); setEdit({}); setPick(null); }} rows={3} dir="auto" data-testid="fleet-order-text"
      placeholder={tr("Paste it, e.g. «محتاج ونش 50 طن السبت في 6 أكتوبر يومين»")} className={inp + " h-auto py-2"} /></Field>
    {text.trim() ? <>
      <div className="grid grid-cols-2 gap-2">
        <Txt label={tr("Capacity (t)")} value={String(o.tons || "")} onChange={(v) => setEdit({ ...edit, tons: +v || 0 })} mode="decimal" testid="fleet-order-tons" />
        <DateF label={tr("Start")} value={o.start} onChange={(v) => setEdit({ ...edit, start: v })} testid="fleet-order-start" />
      </div>
      <Seg value={o.mode} onChange={(v) => setEdit({ ...edit, mode: v })} items={[["daily", "Daily"], ["hourly", "Hourly"]]} testid="fleet-order-mode" />
      <div className="grid grid-cols-2 gap-2">
        <Txt label={tr(o.mode === "hourly" ? "Hours" : "Days")} value={String(o.mode === "hourly" ? o.hours : o.days)} onChange={(v) => setEdit({ ...edit, [o.mode === "hourly" ? "hours" : "days"]: Math.max(1, +v || 1) })} mode="decimal" testid="fleet-order-qty" />
        <Txt label={tr("Site")} value={o.siteText} onChange={(v) => setEdit({ ...edit, siteText: v })} testid="fleet-order-site" />
      </div>
      {!o.start ? <p className="text-[13px] text-[#B45309]">{tr("No date found in the message — pick the start.")}</p> : null}
      <div className="space-y-1.5" data-testid="fleet-order-cranes">
        <p className="text-[13px] font-bold">{tr("Cranes for this job")}</p>
        {list.length ? list.map((x) => (
          <button key={x.crane.id} onClick={() => !x.busy && setPick(x.crane.id)} disabled={!!x.busy} data-testid="fleet-order-crane"
            className={card + " w-full text-start p-3 flex items-center gap-2.5 " + (x.busy ? "opacity-60" : "") + (chosen && chosen.crane.id === x.crane.id ? " ring-2" : "")} style={chosen && chosen.crane.id === x.crane.id ? { "--tw-ring-color": "var(--biz)" } : null}>
            <span className="flex-1 min-w-0"><span className="block font-bold text-[14px] truncate" dir="auto">{x.crane.name} · {x.crane.tons} t</span>
              <span className={"block text-[12.5px] " + muted}>{x.busy ? tr("Booked: {no}", { no: x.busy.no }) : num(x.rate) + " × " + x.qty}</span></span>
            {!x.busy ? <b className="text-[13.5px] tabular-nums" dir="ltr">{money(x.price)}</b> : null}</button>))
          : <Empty>{tr("No crane of {t} t or more.", { t: o.tons })}</Empty>}
      </div>
      {chosen ? <>
        <Field label={tr("Reply to send")}><p className={card + " p-3 text-[13px] whitespace-pre-wrap"} dir="auto" data-testid="fleet-order-reply">{reply}</p></Field>
        <div className="grid grid-cols-2 gap-2">
          <button className={btnS} onClick={() => { try { navigator.clipboard.writeText(reply).then(() => flash(tr("Copied")), () => {}); } catch (e) {} }} data-testid="fleet-order-copy"><Copy size={15} />{tr("Copy the reply")}</button>
          <button className={btnS} onClick={() => printHTML(FO.quoteHTML(o, chosen, { client: (F.byId(s.clients, client) || {}).name || "", currency: cur, rtl: ar }), saveFile, "quote.html")} data-testid="fleet-order-quote"><Printer size={15} />{tr("Quote")}</button>
        </div>
        <div><Sel label={tr("Client")} value={client} onChange={setClient} options={opts(s.clients)} empty={tr("Choose…")} testid="fleet-order-client" /><QuickAdd s={s} run={run} coll="clients" label={tr("New client")} onAdded={setClient} /></div>
        <SaveBtn onClick={book} disabled={!client || !o.start} testid="fleet-order-book">{tr("Book it")}</SaveBtn>
      </> : null}
    </> : null}
  </div>;
}
function WorkForm({ s, run, sheet, close, money, flash }) {
  const active = F.live(s.jobs).filter((j) => j.status === "active");
  const [e, setE] = useState({ job: sheet.job || (active.length === 1 ? active[0].id : ""), date: F.isoDay(), start: "08:00", end: "16:00", endDate: "", qty: "1", pStart: "", pEnd: "", evidence: null, rate: "" });
  const set = (k) => (v) => setE({ ...e, [k]: v });
  const j = F.byId(s.jobs, e.job);
  const rate = e.rate !== "" ? +e.rate : j ? j.rate : 0;
  const hours = j && j.mode === "hourly" ? F.hoursOf({ date: e.date, start: e.start, end: e.end, endDate: e.endDate }) : NaN;
  const clash = j && j.mode === "hourly" && hours > 0 ? F.overlapOf(s, j.crane, { date: e.date, start: e.start, hours }) : null;
  const amount = j ? (j.mode === "hourly" ? (hours > 0 ? hours * rate : 0) : (+e.qty || 0) * rate) : 0;
  const save = () => { if (run((x) => F.addEntry(x, e), tr("Work saved"))) close(); };
  return <div className="space-y-3" data-testid="fleet-work-form">
    <Sel label={tr("Job order")} value={e.job} onChange={set("job")} options={active.map((x) => ({ v: x.id, l: `${x.no} · ${nameOf(s.cranes, x.crane)} · ${nameOf(s.clients, x.client)}` }))} empty={tr("Choose…")} testid="fleet-f-job" />
    {!active.length ? <p className={"text-[13px] " + muted}>{tr("Make a job order first.")}</p> : null}
    {j ? <>
      <DateF label={tr("Work date")} value={e.date} onChange={set("date")} testid="fleet-f-date" />
      {j.mode === "hourly" ? <><div className="grid grid-cols-2 gap-2"><Txt label={tr("From (HH:MM)")} value={e.start} onChange={set("start")} dir="ltr" testid="fleet-f-start" /><Txt label={tr("To (HH:MM)")} value={e.end} onChange={set("end")} dir="ltr" testid="fleet-f-end" /></div>
        <DateF label={tr("End date (only if it ends another day)")} value={e.endDate} onChange={set("endDate")} /></> : null}
      {j.mode === "daily" ? <Txt label={tr("Days")} value={e.qty} onChange={set("qty")} mode="decimal" testid="fleet-f-qty" /> : null}
      {j.mode === "period" ? <><div className="grid grid-cols-2 gap-2"><DateF label={tr("Period from")} value={e.pStart} onChange={set("pStart")} /><DateF label={tr("Period to")} value={e.pEnd} onChange={set("pEnd")} /></div><Txt label={tr("Periods")} value={e.qty} onChange={set("qty")} mode="decimal" /></> : null}
      <Txt label={tr("Rate")} value={e.rate} onChange={set("rate")} mode="decimal" placeholder={num(j.rate)} />
      <div className={card + " p-3.5 flex items-center justify-between"} data-testid="fleet-live"><span className={"text-[13px] " + muted} dir="ltr">{j.mode === "hourly" ? (hours > 0 ? `${num(hours)} h × ${num(rate)}` : tr("Enter the times")) : `${num(e.qty)} × ${num(rate)}`}</span><span className="text-[18px] font-extrabold tabular-nums" dir="ltr">{money(amount)}</span></div>
      {clash ? <p className="text-[13px] text-[#B91C1C] flex gap-1.5" data-testid="fleet-clash"><AlertTriangle size={15} className="shrink-0 mt-0.5" />{tr("These hours overlap work already saved for this crane ({when})", { when: `${F.showDate(clash.date)} ${clash.start}–${clash.end}` })}</p> : null}
      <Evidence value={e.evidence} onChange={set("evidence")} flash={flash} required />
    </> : null}
    <SaveBtn onClick={save} disabled={!j || !!clash || !e.evidence} />
  </div>;
}
function ChequeForm({ s, run, sheet, close }) {
  const [q, setQ] = useState({ dir: sheet.dir || "in", method: "cheque", client: sheet.client || "", payee: sheet.payee || "", no: "", bank: "", amount: "", due: F.isoDay() });
  const set = (k) => (v) => setQ({ ...q, [k]: v });
  const save = () => { if (run((x) => F.addCheque(x, q), tr("Saved"))) close(); };
  return <div className="space-y-3" data-testid="fleet-cheque-form">
    <Seg value={q.dir} onChange={set("dir")} items={[["in", "Received"], ["out", "Paid out"]]} testid="fleet-f-dir" />
    <Seg value={q.method} onChange={set("method")} items={[["cheque", "Cheque"], ["cash", "Cash"], ["transfer", "Transfer"]]} testid="fleet-f-method" />
    {q.dir === "in" ? <Sel label={tr("Client")} value={q.client} onChange={set("client")} options={opts(s.clients)} empty={tr("Choose…")} testid="fleet-f-qclient" />
      : <Txt label={tr("Paid to")} value={q.payee} onChange={set("payee")} testid="fleet-f-payee" />}
    <Txt label={tr("Amount")} value={q.amount} onChange={set("amount")} mode="decimal" testid="fleet-f-amount" />
    {q.method === "cheque" ? <div className="grid grid-cols-2 gap-2"><Txt label={tr("Cheque number")} value={q.no} onChange={set("no")} dir="ltr" testid="fleet-f-no" />
      <Field label={tr("Bank")}><input list="fleet-banks" value={q.bank} onChange={(e) => set("bank")(e.target.value)} className={inp} dir="auto" /><datalist id="fleet-banks">{F.live(s.banks).map((b) => <option key={b.id} value={b.name} />)}</datalist></Field></div> : null}
    <DateF label={tr(q.method === "cheque" ? "Maturity date" : "Date")} value={q.due} onChange={set("due")} testid="fleet-f-due" />
    <SaveBtn onClick={save} />
  </div>;
}
function ExpenseForm({ s, run, close, flash }) {
  const [x, setX] = useState({ date: F.isoDay(), crane: "", site: "", lines: [{ type: s.expTypes[0], amount: "" }], notes: "", evidence: null, period: false, from: "", to: "" });
  const set = (k) => (v) => setX({ ...x, [k]: v });
  const setLine = (i, k, v) => setX({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) });
  const save = () => { if (run((st) => F.addExpense(st, x), tr("Expense saved"))) close(); };
  return <div className="space-y-3" data-testid="fleet-expense-form">
    <DateF label={tr("Date")} value={x.date} onChange={set("date")} />
    <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={x.period} onChange={(e) => setX({ ...x, period: e.target.checked })} className="w-5 h-5" data-testid="fleet-f-xperiod" />{tr("It covers a period (rent, insurance, a monthly salary…)")}</label>
    {x.period ? <div className="grid grid-cols-2 gap-2"><DateF label={tr("From")} value={x.from} onChange={set("from")} testid="fleet-f-xfrom" /><DateF label={tr("To")} value={x.to} onChange={set("to")} testid="fleet-f-xto" /></div> : null}
    <div className="grid grid-cols-2 gap-2"><Sel label={tr("Crane")} value={x.crane} onChange={set("crane")} options={opts(s.cranes)} empty={tr("— none —")} testid="fleet-f-xcrane" /><Sel label={tr("Site")} value={x.site} onChange={set("site")} options={opts(s.sites)} empty={tr("— none —")} /></div>
    {!x.crane && !x.site ? <p className={"text-[12px] -mt-1 " + muted}>{tr("No crane and no site = a general expense.")}</p> : null}
    {x.lines.map((l, i) => <div key={i} className="flex gap-2 items-end">
      <Field label={i ? "" : tr("Type")}><input list="fleet-types" value={l.type} onChange={(e) => setLine(i, "type", e.target.value)} className={inp} dir="auto" /></Field>
      <div className="w-32 shrink-0"><Txt label={i ? "" : tr("Amount")} value={l.amount} onChange={(v) => setLine(i, "amount", v)} mode="decimal" testid="fleet-f-xamount" /></div>
      {x.lines.length > 1 ? <button className="w-10 h-11 grid place-items-center text-[#94A3B8] shrink-0" aria-label={tr("Remove")} onClick={() => setX({ ...x, lines: x.lines.filter((_, j) => j !== i) })}><X size={16} /></button> : null}</div>)}
    <datalist id="fleet-types">{s.expTypes.map((t) => <option key={t} value={t} />)}</datalist>
    <button className={btnS} onClick={() => setX({ ...x, lines: [...x.lines, { type: "", amount: "" }] })}><Plus size={15} />{tr("Another type")}</button>
    <Txt label={tr("Notes")} value={x.notes} onChange={set("notes")} />
    <Evidence value={x.evidence} onChange={set("evidence")} flash={flash} />
    <SaveBtn onClick={save} />
  </div>;
}
function MoveForm({ s, run, sheet, close }) {
  const [to, setTo] = useState(""), [date, setDate] = useState(F.isoDay());
  const places = [...F.live(s.garages).map((g) => ({ v: "garage:" + g.id, l: tr("Garage") + " — " + g.name })), ...F.live(s.sites).map((x) => ({ v: "site:" + x.id, l: tr("Site") + " — " + x.name }))];
  const save = () => { const [kind, id] = to.split(":"); if (run((x) => F.moveCrane(x, { crane: sheet.crane, to: { kind, id }, date }), tr("Moved"))) close(); };
  return <div className="space-y-3" data-testid="fleet-move-form">
    <p className="text-[14px]" dir="auto">{nameOf(s.cranes, sheet.crane)} — {F.whereIs(s, sheet.crane).name || "—"}</p>
    <Sel label={tr("Move to")} value={to} onChange={setTo} options={places} empty={tr("Choose…")} testid="fleet-f-to" />
    <DateF label={tr("Date")} value={date} onChange={setDate} />
    <SaveBtn onClick={save} disabled={!to} />
  </div>;
}
function InForm({ s, run, close, money, flash }) {
  const st = s.store;
  const [x, setX] = useState({ date: F.isoDay(), purchaser: "", requester: "", supplier: "", crane: "", notes: "", lines: [{ item: "", qty: "", total: "" }] });
  const set = (k) => (v) => setX({ ...x, [k]: v });
  const setLine = (i, k, v) => setX({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) });
  const next = F.docCode(st.nextDoc, x.date || F.isoDay());
  const tot = x.lines.reduce((n, l) => n + (+l.total || 0), 0);
  const save = () => { const r = run((s0) => F.addIncoming(s0, { ...x, crane: x.crane || null }), (r) => tr("Invoice {c} saved", { c: r.doc })); if (r) close(); };
  const DL = ({ id, list }) => <datalist id={id}>{list.map((v) => <option key={v} value={v} />)}</datalist>;
  return <div className="space-y-3" data-testid="fleet-in-form">
    <p className={"text-[13px] " + muted}>{tr("Internal code")}: <b dir="ltr" data-testid="fleet-next-code">{next}</b></p>
    <DateF label={tr("Date")} value={x.date} onChange={set("date")} />
    <div className="grid grid-cols-2 gap-2">
      <Field label={tr("Bought by (required)")}><input list="fl-p" value={x.purchaser} onChange={(e) => set("purchaser")(e.target.value)} className={inp} dir="auto" data-testid="fleet-f-purchaser" /></Field>
      <Field label={tr("Requested by")}><input list="fl-r" value={x.requester} onChange={(e) => set("requester")(e.target.value)} className={inp} dir="auto" /></Field></div>
    <div className="grid grid-cols-2 gap-2">
      <Field label={tr("Supplier")}><input list="fl-s" value={x.supplier} onChange={(e) => set("supplier")(e.target.value)} className={inp} dir="auto" data-testid="fleet-f-supplier" /></Field>
      <Sel label={tr("For crane (optional)")} value={x.crane} onChange={set("crane")} options={opts(s.cranes)} empty={tr("— none —")} /></div>
    <DL id="fl-p" list={st.purchasers} /><DL id="fl-r" list={st.requesters} /><DL id="fl-s" list={st.suppliers} /><DL id="fl-i" list={st.items.map((i) => i.name)} />
    <p className="font-bold text-[14px] pt-1">{tr("Items on this invoice")}</p>
    {x.lines.map((l, i) => <div key={i} className="flex gap-1.5 items-end">
      <Field label={i ? "" : tr("Item")}><input list="fl-i" value={l.item} onChange={(e) => setLine(i, "item", e.target.value)} className={inp} dir="auto" data-testid="fleet-f-item" /></Field>
      <div className="w-20 shrink-0"><Txt label={i ? "" : tr("Qty")} value={l.qty} onChange={(v) => setLine(i, "qty", v)} mode="decimal" testid="fleet-f-iqty" /></div>
      <div className="w-28 shrink-0"><Txt label={i ? "" : tr("Total price")} value={l.total} onChange={(v) => setLine(i, "total", v)} mode="decimal" testid="fleet-f-itotal" /></div>
      {x.lines.length > 1 ? <button className="w-9 h-11 grid place-items-center text-[#94A3B8] shrink-0" aria-label={tr("Remove")} onClick={() => setX({ ...x, lines: x.lines.filter((_, j) => j !== i) })}><X size={16} /></button> : null}</div>)}
    <div className="flex items-center justify-between"><button className={btnS} onClick={() => setX({ ...x, lines: [...x.lines, { item: "", qty: "", total: "" }] })} data-testid="fleet-add-line"><Plus size={15} />{tr("Another item")}</button>
      <span className="font-extrabold tabular-nums" dir="ltr">{money(tot)}</span></div>
    <Txt label={tr("Notes")} value={x.notes} onChange={set("notes")} />
    <SaveBtn onClick={save} disabled={!x.purchaser.trim()}>{tr("Save the invoice")}</SaveBtn>
  </div>;
}
/** Issue parts — the same order as Ali's warehouse app (sadrBox): reference code first (optional), then the invoice's items as
    rows to tap (fills the item and its unit price; the item box is locked meanwhile), then quantity · technician ·
    destination (ONE list: a crane or another place) · notes, then the preview (planOut) and save. */
function OutForm({ s, run, close, money }) {
  const st = s.store;
  const [x, setX] = useState({ date: F.isoDay(), item: "", qty: "", ref: "", tech: "", to: "", newDest: "", notes: "", prices: [] });
  const set = (k) => (v) => setX({ ...x, [k]: v });
  const rows = x.ref ? F.invoiceItems(st, x.ref) : [];
  const pickRef = (ref) => { const its = ref ? F.invoiceItems(st, ref) : []; setX({ ...x, ref, item: ref ? (its.some((r) => r.item === x.item) ? x.item : its.length === 1 ? its[0].item : "") : x.item }); };
  const plan = x.item && +x.qty > 0 ? F.planOut(st, { item: x.item, qty: x.qty, ref: x.ref }) : null;
  const typed = plan && plan.ok ? plan.lines.filter((l) => !l.auto) : [];
  const crane = x.to.startsWith("c:") ? x.to.slice(2) : null, dest = x.to === "__new" ? x.newDest.trim() : x.to.startsWith("d:") ? x.to.slice(2) : "";
  const dests = [...F.live(s.cranes).map((c) => ({ v: "c:" + c.id, l: c.name })), ...st.dests.map((d) => ({ v: "d:" + d, l: d })), { v: "__new", l: tr("Another place…") }];
  const save = () => { const r = run((s0) => F.addOutgoing(s0, { date: x.date, item: x.item, qty: x.qty, ref: x.ref, tech: x.tech, crane, dest, notes: x.notes, prices: x.prices }), (r) => tr("Saved as {c}", { c: r.doc }) + (r.lines > 1 ? " — " + tr("split into {n} lines", { n: r.lines }) : "")); if (r) close(); };
  return <div className="space-y-3" data-testid="fleet-out-form">
    <p className={"text-[13px] " + muted}>{tr("Internal code")}: <b dir="ltr">{F.docCode(st.nextDoc, x.date || F.isoDay())}</b></p>
    <DateF label={tr("Date")} value={x.date} onChange={set("date")} />
    <Sel label={tr("Reference code (optional — the original purchase invoice)")} value={x.ref} onChange={pickRef} options={F.incomingDocs(st).map((d) => ({ v: d, l: d }))} empty={tr("— no link (from the general stock) —")} testid="fleet-f-ref" />
    <Field label={<>{tr("Item")}{x.ref ? <span className={"ms-1 text-[11.5px] " + muted}>{tr("(pick from the table below)")}</span> : null}</>}>
      <input list="fl-oi" value={x.item} disabled={!!x.ref} onChange={(e) => setX({ ...x, item: e.target.value })} className={inp + (x.ref ? " opacity-60" : "")} dir="auto" data-testid="fleet-f-oitem" /><datalist id="fl-oi">{F.stockList(st).map((i) => <option key={i.name} value={i.name}>{`${i.name} (${num(i.balance)})`}</option>)}</datalist></Field>
    {x.ref ? <div className={card + " overflow-hidden"} data-testid="fleet-ref-items">
      <div className={"grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2 text-[11.5px] font-semibold " + muted}><span>{tr("Item")}</span><span>{tr("Original")}</span><span>{tr("Left on it")}</span><span>{tr("Unit price")}</span></div>
      {rows.map((r) => <button key={r.item} onClick={() => setX({ ...x, item: r.item })} data-testid="fleet-ref-item"
        className={"w-full grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2.5 text-start text-[13.5px] border-t border-[#E2E8F0] " + (x.item === r.item ? "bg-[#FEF3C7] font-semibold" : "")}>
        <span dir="auto" className="truncate">{r.item}</span><span className="tabular-nums" dir="ltr">{num(r.qty)}</span><span className="tabular-nums" dir="ltr">{num(r.remaining)}</span><span className="tabular-nums" dir="ltr">{money(r.unit)}</span></button>)}
    </div> : x.item ? <p className={"text-[12.5px] -mt-1.5 " + muted}>{tr("In stock")}: <b dir="ltr">{num(F.itemBalance(st, x.item))}</b></p> : null}
    <div className="grid grid-cols-2 gap-2"><Txt label={tr("Quantity")} value={x.qty} onChange={set("qty")} mode="decimal" testid="fleet-f-oqty" />
      <Field label={tr("Technician (who installed it)")}><input list="fl-t" value={x.tech} onChange={(e) => set("tech")(e.target.value)} className={inp} dir="auto" data-testid="fleet-f-tech" /><datalist id="fl-t">{st.techs.map((v) => <option key={v} value={v} />)}</datalist></Field></div>
    <Sel label={tr("Destination (a crane or another place)")} value={x.to} onChange={set("to")} options={dests} empty={tr("Choose…")} testid="fleet-f-ocrane" />
    {x.to === "__new" ? <Txt label={tr("Other destination")} value={x.newDest} onChange={set("newDest")} testid="fleet-f-odest" /> : null}
    <Txt label={tr("Notes")} value={x.notes} onChange={set("notes")} />
    {plan ? plan.ok ? <div className={card + " p-3.5 space-y-2"} data-testid="fleet-plan">
      <p className="text-[13px] font-bold">{plan.lines.length > 1 ? tr("This issue will be split:") : tr("This will be saved as:")}</p>
      {plan.lines.map((l, i) => <div key={i} className="flex items-center gap-2 text-[13.5px]"><span className="flex-1" dir="auto">{num(l.qty)} × {x.item} — {l.ref ? <span dir="ltr">{tr("from")} {l.ref}</span> : tr("from the general stock")}</span>
        {l.auto ? <span className="tabular-nums font-semibold" dir="ltr">{money(l.total)}</span>
          : <input value={x.prices[typed.indexOf(l)] ?? ""} onChange={(e) => { const p = [...x.prices]; p[typed.indexOf(l)] = e.target.value; setX({ ...x, prices: p }); }} placeholder={tr("Total price")} inputMode="decimal" className={inp + " w-28 h-9"} data-testid="fleet-f-oprice" />}</div>)}
      {plan.lines[0] && plan.lines[0].fromInvoiceDepleted ? <p className={"text-[12px] " + muted}>{tr("That invoice is used up for this item, so it all comes from the general stock.")}</p> : null}
    </div> : <p className="text-[13px] text-[#B91C1C] flex gap-1.5" data-testid="fleet-plan-error"><AlertTriangle size={15} className="shrink-0 mt-0.5" />{tr(plan.tpl || plan.error, plan.vars)}</p> : null}
    <SaveBtn onClick={save} disabled={!plan || !plan.ok || (!crane && !dest)}>{tr("Issue")}</SaveBtn>
  </div>;
}
function ItemForm({ s, run, sheet, close, money }) {
  const it = F.stockList(s.store).find((i) => i.name === sheet.name) || { name: sheet.name };
  const [o, setO] = useState(String(it.opening || "")), [m, setM] = useState(String(it.min || ""));
  const lines = F.searchStore(s.store, { item: sheet.name });
  return <div className="space-y-3" data-testid="fleet-item-form">
    <p className="text-[15px] font-bold" dir="auto">{it.name}: <span className="tabular-nums" dir="ltr">{num(it.balance)}</span> {tr("in stock")}</p>
    <div className="grid grid-cols-2 gap-2"><Txt label={tr("Opening stock")} value={o} onChange={setO} mode="decimal" testid="fleet-f-iopen" /><Txt label={tr("Warn me at (minimum)")} value={m} onChange={setM} mode="decimal" testid="fleet-f-imin" /></div>
    <SaveBtn onClick={() => { if (run((x) => F.setItem(x, sheet.name, { opening: o || 0, min: m || 0 }), tr("Saved"))) close(); }} />
    <p className={"text-[12.5px] " + muted}>{tr("{n} lines · in {i} · out {o}", { n: lines.count, i: num(lines.inQty), o: num(lines.outQty) })}</p>
  </div>;
}
function DocView({ s, run, sheet, close, money, saveFile }) {
  const lines = F.runningBalances(s.store).filter((t) => t.doc === sheet.doc);
  const [edit, setEdit] = useState(null);
  if (!lines.length) return <Empty>{tr("This document was deleted.")}</Empty>;
  const t0 = lines[0];
  const print = () => printHTML(F.docHTML(s, sheet.doc, { rtl: isAr() }), saveFile, `${sheet.doc.replace("/", "-")}.html`);
  return <div className="space-y-3" data-testid="fleet-doc">
    <div className="flex items-center gap-2"><Tag tone={t0.kind === "in" ? "green" : "red"}>{t0.kind === "in" ? tr("Incoming") : tr("Outgoing")}</Tag><b dir="ltr">{sheet.doc}</b><span className={"text-[13px] " + muted} dir="ltr">{F.showDate(t0.date)}</span></div>
    <p className={"text-[13px] " + muted} dir="auto">{t0.kind === "in" ? [t0.supplier, t0.purchaser && tr("bought by") + " " + t0.purchaser].filter(Boolean).join(" · ") : [t0.crane ? nameOf(s.cranes, t0.crane) : t0.dest, t0.tech].filter(Boolean).join(" · ")}</p>
    {lines.map((t) => <div key={t.id} className={card + " p-3 space-y-2"}>
      <div className="flex items-center gap-2 text-[13.5px]"><span className="flex-1 min-w-0" dir="auto">{t.item}{t.ref ? <span className={"text-[11.5px] " + muted} dir="ltr"> ↳ {t.ref}</span> : null}</span><span className="tabular-nums" dir="ltr">{num(t.qty)} · {money(t.total)}</span>
        <button className="w-8 h-8 grid place-items-center text-[#475569]" aria-label={tr("Edit")} onClick={() => setEdit({ id: t.id, qty: String(t.qty), total: String(t.total), auto: !!t.ref && t.kind === "out" })} data-testid="fleet-edit-line"><Pencil size={14} /></button>
        <button className="w-8 h-8 grid place-items-center text-[#94A3B8]" aria-label={tr("Delete")} onClick={async () => { if (await askConfirm("Delete this line?", { yes: "Delete" })) run((x) => F.deleteLines(x, { id: t.id }), tr("Deleted")); }}><Trash2 size={14} /></button></div>
      {edit && edit.id === t.id ? <div className="flex gap-1.5 items-end"><Txt label={tr("Qty")} value={edit.qty} onChange={(v) => setEdit({ ...edit, qty: v })} mode="decimal" testid="fleet-e-qty" />
        {!edit.auto ? <Txt label={tr("Total price")} value={edit.total} onChange={(v) => setEdit({ ...edit, total: v })} mode="decimal" /> : null}
        <button className={btnS + " h-11 shrink-0"} onClick={() => { if (run((x) => F.editLine(x, t.id, edit.auto ? { qty: edit.qty } : { qty: edit.qty, total: edit.total }), tr("Saved"))) setEdit(null); }} data-testid="fleet-e-save"><Check size={15} /></button></div> : null}
    </div>)}
    <div className="flex gap-2"><button className={btnS + " flex-1"} onClick={print} data-testid="fleet-print"><Printer size={15} />{tr("Print")}</button>
      {lines.length > 1 ? <button className={btnS + " flex-1 text-[#B91C1C]"} onClick={async () => { if (await askConfirm(tr("Delete the whole document ({n} lines)?", { n: lines.length }), { yes: "Delete" })) { if (run((x) => F.deleteLines(x, { doc: sheet.doc }), tr("Deleted"))) close(); } }}><Trash2 size={15} />{tr("Delete all")}</button> : null}</div>
  </div>;
}

// ---- More: recycle bin, settings, demo, backup --------------------------------------------------------------------------------
function MoreMenu({ s, run, setSheet, close, flash, saveFile, site }) {
  const bin = F.binList(s).length;
  const item = (I, label, onClick, testid, extra) => <button onClick={onClick} data-testid={testid} className={card + " w-full text-start p-3.5 flex items-center gap-3"}><I size={18} className="text-[#475569]" /><span className="flex-1 font-semibold text-[14.5px]">{label}</span>{extra}<ChevronRight size={17} className="text-[#94A3B8] rtl:-scale-x-100" /></button>;
  return <div className="space-y-2">
    {item(Pencil, tr("Rates"), () => { close(); setSheet({ kind: "rates" }); }, "fleet-rates-open")}
    {item(Trash2, tr("Recycle Bin"), () => { close(); setSheet({ kind: "bin" }); }, "fleet-bin", bin ? <Tag>{bin}</Tag> : null)}
    {item(Lock, tr("Encrypted backup"), () => { close(); setSheet({ kind: "backup" }); }, "fleet-backup")}
    {item(Wrench, tr("Settings"), () => { close(); setSheet({ kind: "settings" }); }, "fleet-settings")}
    {site ? null : item(Globe, tr("Website & desktop app"), () => { close(); saveProject(s, { kind: "fleet", name: tr("Fleet & rentals"), saveFile, flash }); }, "fleet-site")}
    {F.hasDemo(s) ? item(Undo2, tr("Erase the demo data"), async () => { if (await askConfirm("Erase all demo records? Your own records stay.", { yes: "Erase" })) { run((x) => F.eraseDemo(x), tr("Demo data erased")); close(); } }, "fleet-erase-demo")
      : item(Plus, tr("Load demo data"), () => { run((x) => F.loadDemo(x), tr("Demo data loaded — erase it any time from More")); close(); }, "fleet-load-demo")}
  </div>;
}
function BinView({ s, run }) {
  const list = F.binList(s);
  const L = { cranes: "Crane", clients: "Client", sites: "Site", garages: "Garage", banks: "Bank", jobs: "Job order", entries: "Work", cheques: "Payment", expenses: "Expense", invoices: "Invoice", people: "Person", advances: "Advance", docs: "Crane paper", repairs: "Breakdown", quotes: "Quotation", pos: "Purchase order", vendors: "Supplier" };
  const label = (b) => b.rec.name || b.rec.no || (b.coll === "docs" ? tr(DOC_L[b.rec.kind] || "Other paper") : "") || (b.coll === "cheques" ? (b.rec.no || b.rec.method) + " · " + num(b.rec.amount) : b.coll === "expenses" ? F.showDate(b.rec.date) + " · " + num(b.rec.total) : F.showDate(b.rec.date));
  return <div className="space-y-2" data-testid="fleet-bin-view"><p className={"text-[13px] " + muted}>{tr("Deleted items stay here for 7 days, then they're gone for good.")}</p>
    {list.length ? list.map((b) => <div key={b.coll + b.id} className={card + " p-3 flex items-center gap-2"}><span className="flex-1 min-w-0"><span className="block text-[14px] font-semibold truncate" dir="auto">{label(b)}</span><span className={"block text-[12px] " + muted}>{tr(L[b.coll])} · {tr("{d} days left", { d: b.left })}</span></span>
      <button className={btnS + " h-9"} onClick={() => run((x) => F.restore(x, b.coll, b.id), tr("Restored"))} data-testid="fleet-restore"><Undo2 size={14} />{tr("Restore")}</button></div>) : <Empty>{tr("The Recycle Bin is empty.")}</Empty>}</div>;
}
function SettingsForm({ s, run, close }) {
  const [x, setX] = useState({ ...s.settings });
  const set = (k) => (v) => setX({ ...x, [k]: v });
  return <div className="space-y-3" data-testid="fleet-settings-form">
    <Txt label={tr("Currency")} value={x.currency} onChange={(v) => set("currency")(v.toUpperCase().slice(0, 3))} dir="ltr" />
    <div className="grid grid-cols-2 gap-2"><Txt label={tr("Warn about cheques due within (days)")} value={x.chequeDays} onChange={set("chequeDays")} mode="numeric" /><Txt label={tr("Warn about jobs ending within (days)")} value={x.jobDays} onChange={set("jobDays")} mode="numeric" /></div>
    {/* v6.44: what the invoices carry */}
    <Txt label={tr("Company name (on invoices)")} value={x.company} onChange={set("company")} testid="fleet-f-company" /><Txt label={tr("Tax reg. no. (on invoices)")} value={x.taxNo} onChange={set("taxNo")} dir="ltr" />
    <div className="grid grid-cols-3 gap-2"><Txt label={tr("VAT %")} value={x.vat} onChange={set("vat")} mode="decimal" /><Txt label={tr("Withholding tax %")} value={x.wht} onChange={set("wht")} mode="decimal" /><Txt label={tr("Invoices due in (days)")} value={x.dueDays} onChange={set("dueDays")} mode="numeric" /></div>
    <SaveBtn onClick={() => { const pc = (v, d) => { const n = parseFloat(v); return n >= 0 && n <= 100 ? n : d; };
      if (run((st) => ({ ...st, settings: { ...st.settings, currency: x.currency || "EGP", chequeDays: Math.max(0, parseInt(x.chequeDays) || 0), jobDays: Math.max(0, parseInt(x.jobDays) || 0),
        company: String(x.company || "").trim(), taxNo: String(x.taxNo || "").trim(), vat: pc(x.vat, 14), wht: pc(x.wht, 0), dueDays: Math.max(0, parseInt(x.dueDays) || 0) } }), tr("Saved"))) close(); }} />
  </div>;
}
function BackupForm({ s, run, close, saveFile, flash }) {
  const [pass, setPass] = useState(""), [busy, setBusy] = useState(false), [file, setFile] = useState(null);
  const make = async () => {
    setBusy(true);
    try { const text = await sealData(s, pass, { kind: "fleet", name: "Fleet", counts: { cranes: F.live(s.cranes).length, jobs: F.live(s.jobs).length, store: s.store.tx.length } });
      saveOut(saveFile, `fleet-backup-${F.isoDay()}.attune-biz`, text, "application/json"); flash(tr("Encrypted backup saved — keep the passphrase safe")); close(); }
    catch (e) { flash(tr(e.message)); }
    setBusy(false);
  };
  const restore = async () => {
    setBusy(true);
    try { const { data } = await openData(file.text, pass, "fleet");
      if (await askConfirm("Replace everything in Fleet with this backup?", { yes: "Replace" })) { run(() => F.heal(data), tr("Restored from the backup")); close(); } }
    catch (e) { flash(tr(e.message)); }
    setBusy(false);
  };
  return <div className="space-y-3" data-testid="fleet-backup-form">
    <p className={"text-[13px] " + muted}>{tr("One file with all of Fleet, locked with your passphrase (AES-256). Without the passphrase nobody can open it — not even us.")}</p>
    <Field label={tr("Passphrase")}><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} className={inp} data-testid="fleet-pass" /></Field>
    <SaveBtn onClick={make} disabled={busy || pass.length < 4} testid="fleet-make-backup">{busy ? tr("Working…") : tr("Save an encrypted backup")}</SaveBtn>
    <label className={btnS + " w-full h-12 cursor-pointer"}><Upload size={16} />{file ? file.name : tr("Choose a backup file to restore")}
      <input type="file" className="hidden" accept=".attune-biz,.json,application/json" data-testid="fleet-restore-file" onChange={async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; const text = await f.text(); try { vaultHeader(text); setFile({ name: f.name, text }); } catch (err) { flash(tr(err.message)); } }} /></label>
    {file ? <button className={btnS + " w-full h-12"} onClick={restore} disabled={busy || pass.length < 4} data-testid="fleet-do-restore">{tr("Restore from this file")}</button> : null}
  </div>;
}
