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
import { SafeSpend } from "./safespend-ui.jsx";
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
import * as U from "./ui-kit.jsx";

export const MONEY_TABS = [["overview", "Overview", null], ["home", "Transactions", "home"], ["bills", "Bills", "bills"], ["people", "People & debts", "goals"],
  ["zakat", "Zakat", "zakat"], ["reports", "Reports", "trends"], ["accounts", "Accounts", "accounts"]];
const ICON = { groceries: ShoppingCart, transport: Car, salary: Building2, bills: Zap, food: Utensils, rent: House, health: Heart, gifts: Gift, coffee: Coffee, invoice: FileText, shopping: ShoppingCart };

function Overview({ o, go, onAsk, onPeople }) {
  const max = Math.max(1, ...o.weeks.map((w) => w.out)), wkBudget = o.budget ? o.budget / 4.3 : 0;
  const label = (t) => t.note || tr(t.cat ? t.cat[0].toUpperCase() + t.cat.slice(1) : "Entry");
  return (
    <div className="grid gap-4 p-6 pt-5" style={{ gridTemplateColumns: "1.1fr 1.35fr 1fr" }} data-testid="money-overview">
      <div className="flex flex-col gap-4 min-w-0">
        <div className={U.cardPad + " space-y-1.5"}>
          <span className={U.label}>{tr("Balance")}</span>
          <div className="block tabular-nums text-[28px] font-black tracking-tight" dir="ltr" data-testid="money-balance">{o.cur} {fmt(o.balance)}</div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <span className="rounded-[14px] bg-[var(--c-bg)] border border-[var(--c-ln)] px-3 py-2 min-w-0"><span className={"block text-[12px] font-bold " + U.muted}>{tr("In")}</span><b className="block tabular-nums text-[16px] font-black text-[var(--c-pos)]" dir="ltr">{fmt(o.monthIn, { sign: true })}</b></span>
            <span className="rounded-[14px] bg-[var(--c-bg)] border border-[var(--c-ln)] px-3 py-2 min-w-0"><span className={"block text-[12px] font-bold " + U.muted}>{tr("Out")}</span><b className="block tabular-nums text-[16px] font-black text-[var(--c-neg)]" dir="ltr">{fmt(-o.monthOut)}</b></span>
          </div>
          <span className={"block text-[12px] " + U.muted}>{tr("this month")}</span>
          {o.others.length ? <div className={"text-[12.5px] tabular-nums " + U.muted}>{o.others.map((x) => x.currency + " " + fmt(x.balance)).join(" · ")}</div> : null}
        </div>
        <SafeSpend calm />
        <div className={U.cardPad}>
          <div className="flex items-center"><span className={U.label}>{tr("Spending by week")}</span>{o.budget ? <span className={"ms-auto text-[12.5px] " + U.muted}>{tr("Budget")} <span className="tabular-nums font-bold text-[var(--c-ink)]">{fmt(o.budget)}</span></span> : null}</div>
          <div className="flex items-end gap-2 mt-3" style={{ height: 96 }}>
            {o.weeks.map((w, i) => (<i key={i} title={fmt(w.out)} style={{ flex: 1, height: Math.max(4, (w.out / max) * 100) + "%", borderRadius: "8px 8px 3px 3px", background: i === 3 ? "var(--c-acc)" : wkBudget && w.out > wkBudget ? "var(--c-warn)" : "var(--c-soft)" }} />))}
          </div>
          <div className={"flex justify-between mt-1.5 text-[11px] font-bold " + U.muted}>{o.weeks.map((w, i) => <span key={i}>{i === 3 ? tr("This week") : tr("Week") + " " + (i + 1)}</span>)}</div>
        </div>
        <button className={U.cardPad + " text-start min-h-[56px] hover:border-[var(--c-acc)]"} onClick={() => go("zakat")} data-testid="money-zakat-card"><span className={U.label}>{tr("Zakat")}</span><div className="mt-1"><b className="font-extrabold">{tr("Open Zakat")}</b> <span className={"text-[12.5px] " + U.muted}>· {tr("checked against today's gold price")}</span></div></button>
      </div>

      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex items-center"><span className={U.label}>{tr("Latest")}</span><button className={"ms-auto min-h-[44px] px-2 text-[13px] font-bold text-[var(--c-acc)] hover:underline"} onClick={() => go("home")}>{tr("All transactions")}</button></div>
        <div className={U.card + " overflow-hidden divide-y divide-[var(--c-ln)]"} data-testid="money-latest">
          {o.latest.length ? o.latest.map((t, i) => { const I = ICON[t.cat] || Wallet; return (
            <div key={i} className="flex items-center gap-3 px-3.5 py-3 min-h-[56px]">
              <span className="w-10 h-10 rounded-[14px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] shrink-0"><I size={17} /></span>
              <div className="flex-1 min-w-0"><b className="block truncate font-extrabold text-[14.5px]" dir="auto">{label(t)}</b><div className={"truncate text-[12.5px] " + U.muted}>{tr(t.cat ? t.cat[0].toUpperCase() + t.cat.slice(1) : "")} · {t.date}</div></div>
              <span className={"tabular-nums font-extrabold shrink-0 " + (t.type === "income" ? "text-[var(--c-pos)]" : "text-[var(--c-neg)]")} dir="ltr">{fmt(t.type === "income" ? t.amount : -t.amount, { sign: true })}{t.currency !== o.cur ? " " + t.currency : ""}</span>
            </div>); })
            : <div className={"px-4 py-6 text-[13.5px] " + U.muted}>{tr("Nothing logged yet — add an expense in Transactions, or type it in Chat.")}</div>}
        </div>
      </div>

      <div className="flex flex-col gap-4 min-w-0">
        {o.owed.slice(0, 2).map((p, i) => (
          <button key={i} className={U.cardPad + " text-start hover:border-[var(--c-acc)]"} onClick={() => (p.life && onPeople ? onPeople() : go("people"))} data-testid="money-owed">
            <div className="flex items-center gap-2"><span className={U.label + " truncate"}>{tr("{p} owes you", { p: p.person })}</span><b className="tabular-nums font-black text-[17px] ms-auto" dir="ltr">{fmt(p.left)}</b></div>
            <div className={"mt-1 text-[12.5px] " + U.muted}>{tr("{n} payments so far", { n: p.paid })}{p.note ? " · " + p.note : ""}</div>
            {p.paid > 0 && p.paid < 24 ? <div className="c-ticks mt-2">{Array.from({ length: Math.min(12, Math.max(p.paid + 1, Math.round(p.amount / Math.max(1, (p.amount - p.left) / p.paid)))) }, (_, k) => <i key={k} className={k < p.paid ? "d" : k === p.paid ? "n" : ""} />)}</div> : null}
          </button>))}
        {o.owe.length ? <button className={U.cardPad + " text-start hover:border-[var(--c-acc)]"} onClick={() => go("people")}><span className={U.label}>{tr("You owe")}</span>{o.owe.slice(0, 3).map((p, i) => <div key={i} className="flex mt-2"><span className="flex-1 truncate font-semibold" dir="auto">{p.person}</span><b className="tabular-nums font-extrabold text-[var(--c-warn)]" dir="ltr">{fmt(p.left)}</b></div>)}</button> : null}
        <div className={U.cardPad} data-testid="money-due">
          <span className={U.label}>{tr("Due this week")}</span>
          {o.due.length ? o.due.slice(0, 5).map((d, i) => (
            <div key={i} className="flex items-center gap-2 mt-2.5"><span className="flex-1 truncate font-semibold" dir="auto">{d.note}</span><span className={U.tag(d.late ? "red" : "amber")}>{d.late ? tr("Late") : d.date.slice(5)} · <span className="tabular-nums">{fmt(d.amount)}</span></span></div>))
            : <div className={"mt-2 text-[13px] " + U.muted}>{tr("No bills due this week.")}</div>}
        </div>
        <button className={U.cardPad + " text-start flex items-center gap-2 min-h-[56px] text-[13.5px] hover:border-[var(--c-acc)] " + U.muted} onClick={onAsk}><User size={15} className="shrink-0 text-[var(--c-acc)]" />“{tr("How much did I spend on food this month?")}”</button>
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
    <div className={U.page + " rounded-[22px] overflow-hidden border border-[var(--c-ln)]"} style={{ minHeight: "calc(100vh - 32px)" }} data-testid="money-desk">
      <div className="flex items-center gap-4 px-6 pt-5"><h2 className={U.h1}>{tr("Money")}</h2><span className={"text-[13px] " + U.muted}>{month} · {tr("all accounts")}</span>
        <button className={U.btnP + " ms-auto"} onClick={() => setTab("home")}>+ {tr("Add")}</button></div>
      <div className="flex gap-1.5 px-6 pt-4 pb-3 border-b border-[var(--c-ln)] overflow-x-auto" role="tablist">
        {MONEY_TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} className={U.chip(tab === k)} onClick={() => setTab(k)} data-testid={"money-tab-" + k}>{tr(label)}</button>)}
      </div>
      {tab === "overview" ? <Overview o={o} go={go} onAsk={onAsk} onPeople={onPeople} /> : null}
      {/* Yusr stays loaded (hidden on Overview), so switching tabs is instant */}
      <div className="p-4" data-testid="money-yusr" style={{ display: tab === "overview" ? "none" : "block" }}>{renderYusr(screen || "home")}</div>
    </div>);
}
