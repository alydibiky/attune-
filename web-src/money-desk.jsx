/* ---- v6.27: Money on a computer in design A "Calm" (Ali picked it, 13 Oct 2026; mock-up: claude.ai/artifact/ES7tU5XVeN4wPDWSPf3wV4)
   A real wide layout instead of the phone column: the title, tabs, and on Overview three columns —
     1. balance, this month in/out, spending by week against the budget, Zakat
     2. the latest entries
     3. people (who owes you, with the instalments as ticks), bills due this week, an "ask" line
   The numbers are computed by code (money-calm.js) from the same ledger Money (Yusr) keeps; every other tab is Yusr itself,
   opened on the matching screen (bridge "go"), so nothing is lost. Tests: tests/e2e_v727moneydesk.py.            */
import React, { useEffect, useMemo, useState } from "react";
import { ShoppingCart, Car, Building2, Zap, User, Utensils, House, Heart, Gift, Coffee, FileText, Wallet } from "lucide-react";
import { moneyOverview, fmt } from "./money-calm.js";
import { loadLedger } from "./myledger.js";
import { loadLife, progressOf } from "./life.js";

/** v6.27: People & plans' money between people (debts and installments with a person), in the same shape as Money's own
 *  debts, so the Overview shows everyone who owes you — whichever page it was written in. */
export function lifePeople(life, now = Date.now()) {
  const owed = [], owe = [];
  for (const c of (life && life.items) || []) {
    if (!c.person || !(c.kind === "debt" || c.kind === "installment")) continue;
    const pr = progressOf(c, now), left = pr.left != null ? pr.left : c.amount;
    if (!(left > 0)) continue;
    const row = { person: c.person, left, amount: c.total || c.amount, paid: pr.paidCount, note: c.kind === "installment" ? c.count + " × " + fmt(c.amount) : "", life: true };
    (c.dir === "in" ? owed : owe).push(row);
  }
  return { owed, owe };
}
import { tr } from "./i18n.js";

export const MONEY_TABS = [["overview", "Overview", null], ["home", "Transactions", "home"], ["bills", "Bills", "bills"], ["people", "People & debts", "goals"],
  ["zakat", "Zakat", "zakat"], ["reports", "Reports", "trends"], ["accounts", "Accounts", "accounts"]];
const ICON = { groceries: ShoppingCart, transport: Car, salary: Building2, bills: Zap, food: Utensils, rent: House, health: Heart, gifts: Gift, coffee: Coffee, invoice: FileText, shopping: ShoppingCart };

function Overview({ o, go, onAsk }) {
  const max = Math.max(1, ...o.weeks.map((w) => w.out)), wkBudget = o.budget ? o.budget / 4.3 : 0;
  const label = (t) => t.note || tr(t.cat ? t.cat[0].toUpperCase() + t.cat.slice(1) : "Entry");
  return (
    <div className="grid gap-4 p-6 pt-5" style={{ gridTemplateColumns: "1.1fr 1.35fr 1fr" }} data-testid="money-overview">
      <div className="flex flex-col gap-4 min-w-0">
        <div className="c-card">
          <span className="c-lbl">{tr("Balance")}</span>
          <div className="c-amt mt-1" data-testid="money-balance">{o.cur} {fmt(o.balance)}</div>
          <div className="flex gap-4 mt-2 c-sub"><span>{tr("In")} <b className="c-num c-pos">{fmt(o.monthIn, { sign: true })}</b></span><span>{tr("Out")} <b className="c-num c-neg">{fmt(-o.monthOut)}</b></span><span>{tr("this month")}</span></div>
          {o.others.length ? <div className="c-sub mt-2">{o.others.map((x) => x.currency + " " + fmt(x.balance)).join(" · ")}</div> : null}
        </div>
        <div className="c-card">
          <div className="flex items-center"><span className="c-lbl">{tr("Spending by week")}</span>{o.budget ? <span className="c-sub ms-auto">{tr("Budget")} <span className="c-num">{fmt(o.budget)}</span></span> : null}</div>
          <div className="flex items-end gap-2 mt-3" style={{ height: 96 }}>
            {o.weeks.map((w, i) => (<i key={i} title={fmt(w.out)} style={{ flex: 1, height: Math.max(4, (w.out / max) * 100) + "%", borderRadius: "5px 5px 0 0", background: i === 3 ? "var(--c-acc)" : wkBudget && w.out > wkBudget ? "var(--c-warn)" : "var(--c-soft)" }} />))}
          </div>
          <div className="flex justify-between c-sub mt-1" style={{ fontSize: 11 }}>{o.weeks.map((w, i) => <span key={i}>{i === 3 ? tr("This week") : tr("Week") + " " + (i + 1)}</span>)}</div>
        </div>
        <button className="c-card text-start" onClick={() => go("zakat")} data-testid="money-zakat-card"><span className="c-lbl">{tr("Zakat")}</span><div className="mt-1"><b>{tr("Open Zakat")}</b> <span className="c-sub">· {tr("checked against today's gold price")}</span></div></button>
      </div>

      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex items-center"><span className="c-lbl">{tr("Latest")}</span><button className="c-sub ms-auto underline" onClick={() => go("home")}>{tr("All transactions")}</button></div>
        <div className="c-list" data-testid="money-latest">
          {o.latest.length ? o.latest.map((t, i) => { const I = ICON[t.cat] || Wallet; return (
            <div key={i} className="flex items-center gap-3 px-3.5 py-2.5">
              <span className="c-ic"><I size={16} /></span>
              <div className="flex-1 min-w-0"><b className="block truncate" dir="auto">{label(t)}</b><div className="c-sub truncate">{tr(t.cat ? t.cat[0].toUpperCase() + t.cat.slice(1) : "")} · {t.date}</div></div>
              <span className={"c-num font-semibold " + (t.type === "income" ? "c-pos" : "c-neg")}>{fmt(t.type === "income" ? t.amount : -t.amount, { sign: true })}{t.currency !== o.cur ? " " + t.currency : ""}</span>
            </div>); })
            : <div className="px-4 py-6 c-sub">{tr("Nothing logged yet — add an expense in Transactions, or type it in Chat.")}</div>}
        </div>
      </div>

      <div className="flex flex-col gap-4 min-w-0">
        {o.owed.slice(0, 2).map((p, i) => (
          <button key={i} className="c-card text-start" onClick={() => (p.life && onPeople ? onPeople() : go("people"))} data-testid="money-owed">
            <div className="flex items-center"><span className="c-lbl">{tr("{p} owes you", { p: p.person })}</span><b className="c-num ms-auto">{fmt(p.left)}</b></div>
            <div className="c-sub mt-1">{tr("{n} payments so far", { n: p.paid })}{p.note ? " · " + p.note : ""}</div>
            {p.paid > 0 && p.paid < 24 ? <div className="c-ticks mt-2">{Array.from({ length: Math.min(12, Math.max(p.paid + 1, Math.round(p.amount / Math.max(1, (p.amount - p.left) / p.paid)))) }, (_, k) => <i key={k} className={k < p.paid ? "d" : k === p.paid ? "n" : ""} />)}</div> : null}
          </button>))}
        {o.owe.length ? <button className="c-card text-start" onClick={() => go("people")}><span className="c-lbl">{tr("You owe")}</span>{o.owe.slice(0, 3).map((p, i) => <div key={i} className="flex mt-2"><span className="flex-1 truncate">{p.person}</span><b className="c-num c-warn">{fmt(p.left)}</b></div>)}</button> : null}
        <div className="c-card" data-testid="money-due">
          <span className="c-lbl">{tr("Due this week")}</span>
          {o.due.length ? o.due.slice(0, 5).map((d, i) => (
            <div key={i} className="flex items-center mt-2.5"><span className="flex-1 truncate" dir="auto">{d.note}</span><span className={"c-pill " + (d.late ? "late" : "due")}>{d.late ? tr("Late") : d.date.slice(5)} · <span className="c-num">{fmt(d.amount)}</span></span></div>))
            : <div className="c-sub mt-2">{tr("No bills due this week.")}</div>}
        </div>
        <button className="c-card text-start c-sub flex items-center gap-2" onClick={onAsk}><User size={15} />“{tr("How much did I spend on food this month?")}”</button>
      </div>
    </div>);
}

/** The computer layout of Money. `yusr` = the Money app (MoneyTab) for every tab but Overview; `screen` is passed to it. */
export function MoneyDesk({ renderYusr, onAsk, onPeople }) {
  const [tab, setTab] = useState("overview");
  const [v, setV] = useState(0);
  useEffect(() => { const on = (e) => { if (!e || !e.key || e.key === "ledger.v3") setV((x) => x + 1); }; window.addEventListener("storage", on); return () => window.removeEventListener("storage", on); }, []);
  const o = useMemo(() => {
    const m = moneyOverview(loadLedger()), lp = lifePeople(loadLife());
    return { ...m, owed: [...m.owed, ...lp.owed].sort((a, b) => b.left - a.left), owe: [...m.owe, ...lp.owe].sort((a, b) => b.left - a.left) };
  }, [v, tab]);
  const go = (k) => setTab(k);
  const screen = (MONEY_TABS.find((t) => t[0] === tab) || [])[2];
  const month = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return (
    <div className="calm rounded-2xl overflow-hidden border" style={{ borderColor: "var(--c-ln)", minHeight: "calc(100vh - 32px)" }} data-testid="money-desk">
      <div className="flex items-center gap-4 px-6 pt-5"><h2 className="text-[22px] font-bold m-0">{tr("Money")}</h2><span className="c-sub">{month} · {tr("all accounts")}</span>
        <button className="c-btn ms-auto" onClick={() => setTab("home")}>+ {tr("Add")}</button></div>
      <div className="flex gap-5 px-6 pt-3 border-b overflow-x-auto" role="tablist" style={{ borderColor: "var(--c-ln)" }}>
        {MONEY_TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} className="c-tab" onClick={() => setTab(k)} data-testid={"money-tab-" + k}>{tr(label)}</button>)}
      </div>
      {tab === "overview" ? <Overview o={o} go={go} onAsk={onAsk} /> : null}
      {/* Yusr stays loaded (hidden on Overview), so switching tabs is instant */}
      <div className="p-4" data-testid="money-yusr" style={{ display: tab === "overview" ? "none" : "block" }}>{renderYusr(screen || "home")}</div>
    </div>);
}
