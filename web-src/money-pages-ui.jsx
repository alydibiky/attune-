/* ---- v7.6 Money's bottom bar and its pages (Ali, 24 Oct 2026, layout A): Home · Accounts · (+) · Bills · Zakāt, and More (Goals,
   Trends, Notes, Invoices, the full ledger). Every page is calm first, then "See all → … report" (Gemini's Option C). The + sheet
   adds an expense, an income or a transfer to the ledger (Yusr) through the bridge, with the account the person picked; lending /
   borrowing and new bills open the ledger's own forms. Numbers: money-pages.js (code). Zakāt is shown as Yusr calculated it. */
import React, { useState, useMemo } from "react";
import { House as HomeIc, Wallet, Plus, RefreshCw as Repeat, Moon, X, ChevronRight, ArrowLeft, Target, TrendingUp, FileText, Zap, BookOpen, SlidersHorizontal as Settings, Download, Check } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { fmt } from "./money-calm.js";
import { accountsPage, billsPage, zakatPage, sheetCats, sheetTxn } from "./money-pages.js";
import { isoDay } from "./money-report.js";
import { Bars, SeeAll } from "./biz-dash-ui.jsx";
import * as U from "./ui-kit.jsx";

const ar = () => getLang() === "ar";
const I = (s) => "⁦" + s + "⁩";
const T = (k, v) => tr(k, v ? Object.fromEntries(Object.entries(v).map(([x, y]) => [x, /\d/.test(String(y)) ? I(y) : y])) : v);
const amt = (n, cur) => fmt(n) + (cur ? " " + cur : "");
const monthLabel = (key) => { try { return new Date(key + "-15T12:00:00").toLocaleDateString(ar() ? "ar-EG" : "en-US", { month: "short" }); } catch (e) { return key; } };
const dayLabel = (iso) => { try { return new Date(iso + "T12:00:00").toLocaleDateString(ar() ? "ar-EG" : undefined, { day: "numeric", month: "short" }); } catch (e) { return iso; } };
const C1 = "var(--c-chart-1)", C2 = "var(--c-chart-2)";
const FREQ = { daily: "Every day", weekly: "Every week", monthly: "Every month", yearly: "Every year" };
const csvOf = (rows) => "﻿" + rows.map((r) => r.map((c) => { const s = String(c ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(",")).join("\n");

function Tile({ label, value, sub, tone, pill, testid }) {
  return <div className={U.card + " p-3.5 min-w-0 space-y-1"} data-testid={testid}>
    <div className="flex items-start justify-between gap-2"><span className="text-[12px] font-bold text-[var(--c-mut)] leading-tight">{label}</span>{pill ? <span className={U.tag(tone === "neg" ? "red" : tone === "warn" ? "amber" : "green") + " shrink-0"}>{pill}</span> : null}</div>
    <b className={"block tabular-nums text-[clamp(18px,5vw,22px)] font-black tracking-tight leading-tight " + (tone === "pos" ? "text-[var(--c-pos)]" : tone === "neg" ? "text-[var(--c-neg)]" : tone === "warn" ? "text-[var(--c-warn)]" : "")} dir="ltr">{value}</b>
    {sub ? <span className="block text-[11.5px] text-[var(--c-mut)] leading-snug">{sub}</span> : null}
  </div>;
}
const Head = ({ title, back, right, testid }) => <div className="flex items-center gap-2.5 pt-1" data-testid={testid}>
  {back ? <button onClick={back} aria-label={tr("Back")} className="w-10 h-10 rounded-full grid place-items-center bg-[var(--c-surf)] border border-[var(--c-ln)] shrink-0" data-testid="money-pane-back"><ArrowLeft size={17} className="rtl:-scale-x-100" /></button> : null}
  <h3 className="flex-1 min-w-0 text-[18px] font-black tracking-tight m-0 truncate">{title}</h3>{right}</div>;
const Row = ({ icon, title, sub, end, endSub, tone, onClick, testid }) => <button onClick={onClick} data-testid={testid}
  className="w-full text-start flex items-center gap-3 min-h-[60px] py-2.5 px-1 border-t border-[var(--c-ln)] first:border-t-0">
  <span className="w-10 h-10 rounded-[14px] grid place-items-center bg-[var(--c-bg)] border border-[var(--c-ln)] shrink-0 text-[17px]">{icon}</span>
  <span className="min-w-0 flex-1"><span className="block text-[14.5px] font-bold truncate" dir="auto">{title}</span>{sub ? <span className="block text-[12px] text-[var(--c-mut)] truncate">{sub}</span> : null}</span>
  <span className="text-end shrink-0"><b className={"block tabular-nums text-[14.5px] " + (tone === "neg" ? "text-[var(--c-neg)]" : tone === "warn" ? "text-[var(--c-warn)]" : "")} dir="ltr">{end}</b>{endSub ? <span className={"block text-[11.5px] " + (tone === "warn" ? "text-[var(--c-warn)] font-bold" : "text-[var(--c-mut)]")}>{endSub}</span> : null}</span>
</button>;
const Card = ({ title, right, children, testid }) => <div className={U.card + " p-4 min-w-0"} data-testid={testid}>
  {title ? <div className="flex items-center justify-between gap-2 mb-1.5"><p className="text-[15px] font-extrabold m-0">{title}</p>{right}</div> : null}{children}</div>;

// ---- the bar ---------------------------------------------------------------------------------------------------------------------------
export const PANES = [["home", "Home", HomeIc], ["accounts", "Accounts", Wallet], ["add", "", Plus], ["bills", "Bills", Repeat], ["zakat", "Zakāt", Moon]];
/** Phone: the bottom bar with the + in the middle. Computer: the same as pills under the title, with "+ Add". */
export function MoneyBar({ pane, setPane, onAdd, wide, dots = {} }) {
  if (wide) return <div className="flex flex-wrap items-center gap-2 mb-4" data-testid="money-bar">
    {PANES.filter((p) => p[0] !== "add").map(([id, l, Ic]) => <button key={id} onClick={() => setPane(id)} data-testid={"money-bar-" + id}
      className={"h-10 px-4 rounded-full border text-[13.5px] font-extrabold inline-flex items-center gap-1.5 transition-colors duration-150 " + (pane === id ? "bg-[var(--c-acc-2)] text-[var(--c-on-acc-2)] border-transparent" : "bg-[var(--c-surf)] border-[var(--c-ln)] text-[var(--c-mut)] hover:text-[var(--c-ink)]")}>
      <Ic size={15} />{tr(l)}{dots[id] ? <i className="w-2 h-2 rounded-full bg-[var(--c-warn)]" /> : null}</button>)}
    <button onClick={onAdd} className={U.btnP + " h-10! min-h-[40px]! rounded-full ms-auto"} data-testid="money-add"><Plus size={16} />{tr("Add")}</button>
  </div>;
  return <nav className="shrink-0 grid grid-cols-5 items-end bg-[var(--c-surf)] border-t border-[var(--c-ln)] px-1" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} data-testid="money-bar">
    {PANES.map(([id, l, Ic]) => id === "add"
      ? <div key={id} className="grid place-items-center"><button onClick={onAdd} aria-label={tr("Add an expense, income or transfer")} data-testid="money-add"
          className="-mt-5 w-14 h-14 rounded-full grid place-items-center bg-[var(--c-acc)] text-[var(--c-on-acc)] shadow-[0_6px_18px_rgba(0,0,0,0.25)] border-4 border-[var(--c-bg)]"><Plus size={26} strokeWidth={2.6} /></button></div>
      : <button key={id} onClick={() => setPane(id)} data-testid={"money-bar-" + id} aria-current={pane === id ? "page" : undefined}
          className={"relative h-16 flex flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold transition-colors duration-150 " + (pane === id ? "text-[var(--c-acc-2)]" : "text-[var(--c-mut)]")}>
          <span className={"w-12 h-7 rounded-full grid place-items-center " + (pane === id ? "bg-[var(--c-acc-2)] text-[var(--c-on-acc-2)]" : "")}><Ic size={18} /></span>{tr(l)}
          {dots[id] ? <i className="absolute top-2.5 end-[22%] w-2 h-2 rounded-full bg-[var(--c-warn)]" /> : null}</button>)}
  </nav>;
}

// ---- the + sheet -----------------------------------------------------------------------------------------------------------------------
export function AddSheet({ L, onSave, onDebt, onClose }) {
  const accs = ((L && L.accounts) || []).filter((a) => !["gold", "silver", "camels", "cattle", "sheep"].includes(a.kind));
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("food");
  const [account, setAccount] = useState(accs[0] ? accs[0].id : "");
  const [toAccount, setTo] = useState("");
  const [date, setDate] = useState(isoDay(Date.now()));
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const cats = useMemo(() => sheetCats(L, type, ar()), [L, type]);
  const from = accs.find((a) => a.id === account);
  const tos = accs.filter((a) => a.id !== account && (!from || (a.currency || "") === (from.currency || "")));
  const pick = (t) => { setType(t); setErr(""); if (t === "income") setCat("salary"); else if (t === "expense") setCat("food"); };
  const save = () => { const r = sheetTxn({ type, amount, cat, account, toAccount, date, note }); if (!r.ok) return setErr(tr(r.why)); onSave(r.txn); };
  const pill = (on) => "min-h-[40px] px-3.5 rounded-full border text-[13px] font-bold whitespace-nowrap transition-colors duration-150 " + (on ? "bg-[var(--c-acc-2)] text-[var(--c-on-acc-2)] border-transparent" : "bg-[var(--c-bg)] border-[var(--c-ln)] text-[var(--c-mut)]");
  return <div className="calm fixed inset-0 z-[80] bg-black/55 flex flex-col justify-end lg:items-center lg:justify-center" onClick={onClose} data-testid="money-add-sheet">
    <div onClick={(e) => e.stopPropagation()} className="bg-[var(--c-surf)] text-[var(--c-ink)] rounded-t-[26px] lg:rounded-[26px] w-full lg:max-w-lg max-h-[92vh] overflow-y-auto p-4 pb-6 space-y-3.5 shadow-[0_-8px_30px_rgba(0,0,0,0.3)]" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>
      <div className="flex items-center gap-2"><p className="flex-1 text-[18px] font-black m-0">{tr("Add to Money")}</p>
        <button onClick={onClose} aria-label={tr("Close")} className="w-10 h-10 rounded-full grid place-items-center c-sub"><X size={18} /></button></div>
      <div className="grid grid-cols-4 gap-1 p-1 rounded-full bg-[var(--c-bg)] border border-[var(--c-ln)]" role="radiogroup" data-testid="add-type">
        {[["expense", "Expense"], ["income", "Income"], ["transfer", "Transfer"], ["debt", "Lend / borrow"]].map(([id, l]) => <button key={id} role="radio" aria-checked={type === id}
          onClick={() => (id === "debt" ? onDebt() : pick(id))} data-testid={"add-type-" + id}
          className={"min-h-[38px] rounded-full text-[12.5px] font-extrabold leading-tight px-1 " + (type === id ? (id === "income" ? "bg-[var(--c-pos)] text-white" : id === "expense" ? "bg-[var(--c-neg)] text-white" : "bg-[var(--c-acc-2)] text-[var(--c-on-acc-2)]") : "c-sub")}>{tr(l)}</button>)}
      </div>
      <div className="flex items-baseline gap-2 border-b-2 border-[var(--c-acc)] pb-1">
        <input value={amount} onChange={(e) => { setAmount(e.target.value); setErr(""); }} inputMode="decimal" placeholder="0" autoFocus dir="ltr" data-testid="add-amount"
          className="flex-1 min-w-0 bg-transparent font-black tabular-nums focus:outline-none placeholder:text-[var(--c-mut)]" style={{ fontSize: 34, lineHeight: 1.15 }} />
        <span className="text-[15px] font-bold c-sub">{from ? from.currency || "" : ""}</span></div>
      {type !== "transfer" ? <div><p className={U.label + " m-0 mb-1.5"}>{tr("Category")}</p>
        <div className="flex flex-wrap gap-1.5" data-testid="add-cats">{cats.map((c) => <button key={c.id} onClick={() => setCat(c.id)} className={pill(cat === c.id)} data-testid={"add-cat-" + c.id}><span className="me-1">{c.emoji}</span>{c.name}</button>)}</div></div> : null}
      <div><p className={U.label + " m-0 mb-1.5"}>{type === "transfer" ? tr("From") : tr("Account")}</p>
        <div className="flex flex-wrap gap-1.5" data-testid="add-accounts">{accs.map((a) => <button key={a.id} onClick={() => { setAccount(a.id); if (toAccount === a.id) setTo(""); }} className={pill(account === a.id)} data-testid="add-account"><span className="me-1">{a.emoji}</span>{a.name}</button>)}
          {!accs.length ? <span className="text-[13px] c-sub">{tr("No account yet — add one in Accounts.")}</span> : null}</div></div>
      {type === "transfer" ? <div><p className={U.label + " m-0 mb-1.5"}>{tr("To")}</p>
        <div className="flex flex-wrap gap-1.5">{tos.map((a) => <button key={a.id} onClick={() => setTo(a.id)} className={pill(toAccount === a.id)} data-testid="add-to-account"><span className="me-1">{a.emoji}</span>{a.name}</button>)}
          {!tos.length ? <span className="text-[13px] c-sub">{tr("You need a second account in the same currency.")}</span> : null}</div></div> : null}
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={U.inp + " !w-auto"} dir="ltr" data-testid="add-date" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Note (optional)")} className={U.inp} dir="auto" data-testid="add-note" /></div>
      {err ? <p className="m-0 text-[13px] font-bold text-[var(--c-neg)]" data-testid="add-err">{err}</p> : null}
      <button onClick={save} className={U.btnP + " w-full"} data-testid="add-save"><Check size={17} />{tr("Save")}</button>
    </div></div>;
}

// ---- More ----------------------------------------------------------------------------------------------------------------------------
export function MoreSheet({ open, onClose }) {
  // v7.9 (Ali): Notes left Money (its notes were copied into Mind), and invoices live in Business → Books now
  const items = [["goals", "Goals", Target, "Saving for something"], ["trends", "Trends", TrendingUp, "How your spending moves"],
    ["automations", "Automations", Zap, "When money comes in or goes out, do something by itself"], ["biz-invoices", "Invoices", FileText, "Now in Business → Books"], ["home", "Full ledger", BookOpen, "Every entry, edit or delete"], ["settings", "Ledger settings", Settings, "Currency, categories, budgets, backup"]];
  return <div className="calm fixed inset-0 z-[80] bg-black/55 flex flex-col justify-end lg:items-center lg:justify-center" onClick={onClose} data-testid="money-more-sheet">
    <div onClick={(e) => e.stopPropagation()} className="bg-[var(--c-surf)] text-[var(--c-ink)] rounded-t-[26px] lg:rounded-[26px] w-full lg:max-w-md p-3 pb-5" style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}>
      <div className="flex items-center gap-2 px-1 pb-1"><p className="flex-1 text-[17px] font-black m-0">{tr("More")}</p>
        <button onClick={onClose} aria-label={tr("Close")} className="w-10 h-10 rounded-full grid place-items-center c-sub"><X size={18} /></button></div>
      {items.map(([id, l, Ic, sub]) => <button key={id} onClick={() => open(id)} data-testid={id === "home" ? "money-open-ledger" : "money-more-" + id}
        className="w-full text-start flex items-center gap-3 min-h-[56px] px-2 rounded-[16px] hover:bg-[var(--c-bg)]">
        <span className="w-10 h-10 rounded-[14px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] shrink-0"><Ic size={18} /></span>
        <span className="min-w-0 flex-1"><span className="block text-[14.5px] font-bold">{tr(l)}</span><span className="block text-[12px] c-sub">{tr(sub)}</span></span>
        <ChevronRight size={17} className="c-sub rtl:rotate-180" /></button>)}
    </div></div>;
}

// ---- Accounts ----------------------------------------------------------------------------------------------------------------------------
export function AccountsPane({ L, wide, openLedger, saveFile }) {
  const [rep, setRep] = useState(false);
  const a = useMemo(() => accountsPage(L, { ar: ar() }), [L]);
  const cur = a.cur;
  if (rep) return <div className="space-y-3" data-testid="money-accounts-report">
    <Head title={tr("Accounts report")} back={() => setRep(false)} right={saveFile ? <button className={U.btnS + " h-10! min-h-[40px]!"} onClick={() => saveFile("accounts-" + isoDay(Date.now()) + ".csv", csvOf([[tr("Account"), tr("Currency"), tr("Balance"), tr("In this month"), tr("Out this month")], ...a.money.map((x) => [x.name, x.currency, x.balance, x.in, x.out])]), "text/csv")} data-testid="money-accounts-csv"><Download size={14} />CSV</button> : null} />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      <Tile label={tr("Balance")} value={amt(a.balance, cur)} tone={a.balance < 0 ? "neg" : undefined} testid="acc-rep-balance" />
      <Tile label={tr("In this month")} value={amt(a.monthIn, cur)} tone="pos" />
      <Tile label={tr("Out this month")} value={amt(a.monthOut, cur)} tone="neg" />
      <Tile label={tr("Accounts")} value={String(a.money.length + a.other.length)} sub={a.other.length ? T("{n} gold, silver or livestock", { n: a.other.length }) : null} />
    </div>
    <Card title={T("Balance at the end of each month ({c})", { c: cur })} testid="acc-rep-trend">
      <Bars rows={a.trend.map((x, i) => ({ ...x, hi: i === a.trend.length - 1, pos: Math.max(0, x.balance), neg: Math.max(0, -x.balance) }))} bars={[{ key: "pos", color: C1 }, { key: "neg", color: C2 }]} label={(r) => monthLabel(r.key)} height={150} /></Card>
    <Card title={tr("This month by account")} testid="acc-rep-table">
      {a.money.map((x) => <div key={x.id} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center text-[13.5px] py-2 border-t border-[var(--c-ln)] first:border-t-0">
        <span className="truncate font-semibold" dir="auto">{x.emoji} {x.name}</span><span className="tabular-nums text-[var(--c-pos)]" dir="ltr">+{fmt(x.in)}</span><span className="tabular-nums text-[var(--c-neg)]" dir="ltr">−{fmt(x.out)}</span></div>)}
    </Card>
  </div>;
  return <div className="space-y-3" data-testid="money-accounts">
    <Head title={tr("Accounts")} right={<button className={U.btnS + " h-10! min-h-[40px]!"} onClick={() => openLedger("add-account")} data-testid="money-accounts-add"><Plus size={15} />{tr("Account")}</button>} />
    <div className={U.card + " p-4"} data-testid="acc-total"><p className="text-[12px] font-bold c-sub m-0">{tr("All your money")}</p>
      <b className={"block text-[30px] font-black tabular-nums tracking-tight " + (a.balance < 0 ? "text-[var(--c-neg)]" : "")} dir="ltr">{amt(a.balance, cur)}</b>
      {a.totals.filter((x) => x.currency !== cur).map((x) => <span key={x.currency} className="me-3 text-[13px] font-bold c-sub tabular-nums" dir="ltr">{amt(x.balance, x.currency)}</span>)}</div>
    <div className={wide ? "grid grid-cols-2 gap-3" : "space-y-3"}>
      <Card title={tr("Money accounts")}>
        {a.money.map((x) => <Row key={x.id} icon={x.emoji} title={x.name} sub={x.last ? T("{n} entries · last {d}", { n: x.count, d: dayLabel(x.last) }) : tr("No entries yet")} end={amt(x.balance, x.currency)} tone={x.balance < 0 ? "neg" : undefined} onClick={() => openLedger("accounts")} testid="acc-row" />)}
        {!a.money.length ? <p className="text-[13px] c-sub m-0 py-2">{tr("No account yet.")}</p> : null}
      </Card>
      {a.other.length ? <Card title={tr("Gold, silver & livestock")}>
        {a.other.map((x) => <Row key={x.id} icon={x.emoji} title={x.name} sub={x.unit} end={fmt(x.balance) + " " + (x.kind === "herd" ? tr("head") : tr("g"))} onClick={() => openLedger("accounts")} testid="acc-row-other" />)}</Card> : null}
    </div>
    <SeeAll testid="money-accounts-open-report" onClick={() => setRep(true)} title={tr("See all → Accounts report")} sub={tr("Balance month by month, money in and out of each account")} cta={tr("Report")} />
  </div>;
}

// ---- Bills -------------------------------------------------------------------------------------------------------------------------------
const whenText = (b) => b.next == null ? "" : b.late ? T("late since {d}", { d: dayLabel(b.next) }) : b.daysTo === 0 ? tr("today") : b.daysTo === 1 ? tr("tomorrow") : b.daysTo < 8 ? T("in {n} days", { n: b.daysTo }) : dayLabel(b.next);
export function BillsPane({ L, wide, openLedger, saveFile }) {
  const [rep, setRep] = useState(false);
  const b = useMemo(() => billsPage(L, { ar: ar() }), [L]);
  const cur = b.cur;
  if (rep) return <div className="space-y-3" data-testid="money-bills-report">
    <Head title={tr("Bills report")} back={() => setRep(false)} right={saveFile ? <button className={U.btnS + " h-10! min-h-[40px]!"} onClick={() => saveFile("bills-" + isoDay(Date.now()) + ".csv", csvOf([[tr("Bill"), tr("Amount"), tr("How often"), tr("Next"), tr("A month")], ...b.list.map((x) => [x.name, x.amount, tr(FREQ[x.freq] || x.freq), x.next || "", x.monthly])]), "text/csv")} data-testid="money-bills-csv"><Download size={14} />CSV</button> : null} />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      <Tile label={tr("Bills a month")} value={amt(b.monthly, cur)} testid="bills-rep-monthly" />
      <Tile label={tr("Paid this month")} value={amt(b.paidThisMonth, cur)} />
      <Tile label={tr("Due in 7 days")} value={amt(b.dueTotal, cur)} tone={b.late ? "warn" : undefined} pill={b.late ? T("{n} late", { n: b.late }) : null} />
      <Tile label={tr("Bills")} value={String(b.list.length)} />
    </div>
    <Card title={T("What bills cost each month ({c})", { c: cur })} testid="bills-rep-chart">
      <Bars rows={b.months.map((x, i) => ({ ...x, hi: i === b.months.length - 1 }))} bars={[{ key: "out", color: C1 }]} hiColor={C2} label={(r) => monthLabel(r.key)} height={150} /></Card>
    <Card title={tr("Paid this month")} testid="bills-rep-paid">
      {b.paid.length ? b.paid.map((x) => <div key={x.id} className="flex justify-between gap-3 text-[13.5px] py-2 border-t border-[var(--c-ln)] first:border-t-0"><span className="truncate" dir="auto">{x.name} · <span className="c-sub">{dayLabel(x.date)}</span></span><b className="tabular-nums" dir="ltr">{fmt(x.amount)}</b></div>)
        : <p className="text-[13px] c-sub m-0">{tr("Nothing paid yet this month.")}</p>}</Card>
  </div>;
  return <div className="space-y-3" data-testid="money-bills">
    <Head title={tr("Bills")} right={<button className={U.btnS + " h-10! min-h-[40px]!"} onClick={() => openLedger("add-bill")} data-testid="money-bills-add"><Plus size={15} />{tr("Bill")}</button>} />
    <div className="grid grid-cols-2 gap-2.5">
      <Tile label={tr("Bills a month")} value={amt(b.monthly, cur)} sub={b.list.length === 1 ? tr("1 bill") : T("{n} bills", { n: b.list.length })} testid="bills-monthly" />
      <Tile label={tr("Due in 7 days")} value={amt(b.dueTotal, cur)} tone={b.late ? "warn" : undefined} pill={b.late ? T("{n} late", { n: b.late }) : null} sub={b.due7.length === 1 ? tr("1 bill") : T("{n} bills", { n: b.due7.length })} testid="bills-due" />
    </div>
    <Card title={tr("Coming up")} testid="bills-list">
      {b.list.map((x) => <Row key={x.id} icon={x.emoji} title={x.name} sub={tr(FREQ[x.freq] || x.freq) + (x.account ? " · " + x.account : "")} end={amt(x.amount, x.currency)} endSub={whenText(x)} tone={x.late ? "warn" : undefined} onClick={() => openLedger("bills")} testid="bill-row" />)}
      {!b.list.length ? <p className="text-[13px] c-sub m-0 py-2" data-testid="bills-empty">{tr("No bills yet — add rent, internet, school fees… and Attune posts them on their day.")}</p> : null}
    </Card>
    <SeeAll testid="money-bills-open-report" onClick={() => setRep(true)} title={tr("See all → Bills report")} sub={tr("What bills cost each month, and what was paid")} cta={tr("Report")} />
  </div>;
}

// ---- Zakāt ---------------------------------------------------------------------------------------------------------------------------
export function ZakatPane({ L, snap, wide, openLedger }) {
  const [rep, setRep] = useState(false);
  const [why, setWhy] = useState(false);
  const z = useMemo(() => zakatPage(L, snap), [L, snap]);
  const cur = (L && L.currency) || "";
  const s = z.status;
  if (rep) return <div className="space-y-3" data-testid="money-zakat-report">
    <Head title={tr("Zakāt report")} back={() => setRep(false)} />
    <div className="grid grid-cols-2 gap-2.5">
      <Tile label={tr("Paid in the last 12 months")} value={amt(z.paidYear, cur)} tone="pos" testid="zakat-rep-year" />
      <Tile label={tr("Payments recorded")} value={String(z.payments.length)} />
    </div>
    <Card title={tr("Zakāt paid each year")} testid="zakat-rep-years">
      {z.years.length ? <Bars rows={z.years.map((x, i) => ({ ...x, hi: i === z.years.length - 1 }))} bars={[{ key: "amount", color: C1 }]} label={(r) => r.year} height={140} />
        : <p className="text-[13px] c-sub m-0">{tr("No payment recorded yet.")}</p>}</Card>
    <Card title={tr("Payments")}>{z.payments.map((p) => <div key={p.id || p.date + p.amount} className="flex justify-between gap-3 text-[13.5px] py-2 border-t border-[var(--c-ln)] first:border-t-0">
      <span className="truncate" dir="auto">{dayLabel(p.date)}{p.to ? " · " + p.to : ""}</span><b className="tabular-nums" dir="ltr">{fmt(p.amount)}</b></div>)}</Card>
  </div>;
  return <div className="space-y-3" data-testid="money-zakat">
    <Head title={tr("Zakāt")} />
    <div className={U.card + " p-4 space-y-2.5"} data-testid="zakat-status">
      {!s ? <><p className="m-0 text-[14.5px] font-bold">{tr("Zakāt is worked out by the ledger's own Zakāt engine.")}</p><p className="m-0 text-[13px] c-sub">{tr("Open it once to set your madhhab and gold price — then the figures show here.")}</p></>
        : s.noPrice ? <p className="m-0 text-[14.5px] font-bold">{tr("Add today's gold price in the Zakāt calculator to see the niṣāb.")}</p>
        : <>
          <div className="flex items-start justify-between gap-2"><span className="text-[12px] font-bold c-sub">{s.due ? tr("Zakāt due") : tr("Not due yet")}</span>
            {z.hawlDays != null ? <span className={U.tag(s.due ? "amber" : "gray")}>{z.hawlDays > 0 ? T("ḥawl ends in {n} days", { n: z.hawlDays }) : tr("ḥawl complete")}</span> : null}</div>
          <b className={"block text-[30px] font-black tabular-nums tracking-tight " + (s.due ? "text-[var(--c-warn)]" : "")} dir="ltr" data-testid="zakat-amount">{s.due ? amt(s.amount, cur) : "—"}</b>
          {s.base != null && s.nisab != null ? <>
            <div className="flex justify-between text-[12.5px] c-sub"><span>{tr("Your zakatable wealth")} <b className="text-[var(--c-ink)] tabular-nums" dir="ltr">{fmt(s.base)}</b></span><span>{tr("Niṣāb")} <b className="text-[var(--c-ink)] tabular-nums" dir="ltr">{fmt(s.nisab)}</b></span></div>
            <div className="c-bar" aria-hidden="true"><i style={{ width: Math.min(100, s.pct || 0) + "%", background: (s.pct || 0) >= 100 ? "var(--c-warn)" : undefined }} /></div>
            <p className="m-0 text-[12px] c-sub">{T("{p}% of the niṣāb", { p: s.pct })}{z.madhhab ? " · " + z.madhhab : ""}</p></> : null}
          {z.basis ? <button onClick={() => setWhy((v) => !v)} className="text-[13px] font-bold c-acc min-h-[36px]" data-testid="zakat-why">{why ? tr("Hide how it was worked out") : tr("How it was worked out")}</button> : null}
          {why ? <div className="text-[12.5px] leading-relaxed c-sub space-y-1" dir="auto"><p className="m-0 whitespace-pre-line">{z.basis}</p>{z.sources.map((x, i) => <p key={i} className="m-0">· {x}</p>)}</div> : null}
        </>}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button className={U.btnP} onClick={() => openLedger("zakat")} data-testid="zakat-open">{tr("Zakāt calculator")}</button>
        <button className={U.btnS + " h-12! min-h-[48px]!"} onClick={() => openLedger("zakat")} data-testid="zakat-pay">{tr("Record a payment")}</button></div>
      <p className="m-0 text-[11.5px] c-sub">{tr("The rulings and the numbers come from the ledger's Zakāt engine, unchanged — Attune only shows them.")}</p>
    </div>
    <Card title={tr("Paid")} right={<span className="text-[12.5px] font-bold c-sub tabular-nums">{T("last 12 months: {a}", { a: amt(z.paidYear, cur) })}</span>} testid="zakat-paid">
      {z.payments.slice(0, 4).map((p) => <Row key={p.id || p.date + p.amount} icon="☪" title={p.to || tr("Zakāt")} sub={dayLabel(p.date)} end={amt(p.amount, cur)} onClick={() => openLedger("zakat")} testid="zakat-row" />)}
      {!z.payments.length ? <p className="text-[13px] c-sub m-0 py-2">{tr("No payment recorded yet.")}</p> : null}</Card>
    <SeeAll testid="money-zakat-open-report" onClick={() => setRep(true)} title={tr("See all → Zakāt report")} sub={tr("What you paid each year, every payment")} cta={tr("Report")} />
  </div>;
}
