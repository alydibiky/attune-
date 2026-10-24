/* ---- v7.2 Money in two levels — Gemini's mock-up "Area 1: Money" (Direction 2 Quiet Atelier, Option C), which Ali sent on
   24 Oct 2026, built into the app. Level 1, the calm view that opens first: the box (write it or ask it), Safe to spend today,
   the balance with the accounts as pills, two quiet totals, the 3 latest entries and "See all → Money Report". Level 2, the
   Money Report: where the money went (donut), the weeks against the target, six months of money in and out, Zakāt as Yusr
   calculated it, and the month's ledger with Excel / PDF export. Phone and computer. Every number is code (money-report.js);
   the ledger itself (Yusr) stays one tap away. The screens are driven by MoneyTab (attune.jsx), which keeps Yusr connected.  */
import React, { useState } from "react";
import { Camera, Mic, ArrowRight, ArrowLeft, FileDown, FileText, Upload, BookOpen, ShieldCheck, Loader2, Sparkles } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { fmt } from "./money-calm.js";
import { donutArcs } from "./money-report.js";
import { SafeSpend } from "./safespend-ui.jsx";
import * as U from "./ui-kit.jsx";

// numbers inside a translated sentence are isolated left-to-right, so «صافي ‎+16,455 EGP» and «حوّشت 91.4% منه» read right in Arabic
const T = (k, v) => tr(k, v ? Object.fromEntries(Object.entries(v).map(([x, y]) => [x, /\d/.test(String(y)) ? "\u2066" + y + "\u2069" : y])) : v);
const SLICE = ["var(--c-chart-1)", "var(--c-chart-2)", "var(--c-chart-3)", "var(--c-chart-4)"];
const amt = (n, cur, o) => fmt(n, o) + (cur ? " " + cur : "");
const dayLabel = (iso) => { try { return new Date(iso + "T12:00:00").toLocaleDateString(getLang() === "ar" ? "ar-EG" : undefined, { day: "numeric", month: "short" }); } catch (e) { return iso; } };
const monthLabel = (key, long) => { try { return new Date(key + "-15T12:00:00").toLocaleDateString(getLang() === "ar" ? "ar-EG" : undefined, long ? { month: "long", year: "numeric" } : { month: "short" }); } catch (e) { return key; } };
const Arrow = ({ back, size = 15 }) => back ? <ArrowLeft size={size} className="rtl:-scale-x-100" /> : <ArrowRight size={size} className="rtl:-scale-x-100" />;

/** The one box: write payments ("lunch 150, taxi 60") or ask ("how much on food this week?"). */
export function MoneyBox({ onSubmit, busy, onReceipt, onVoice, listening, wide }) {
  const [text, setText] = useState("");
  const go = () => { const t = text.trim(); if (!t || busy) return; onSubmit(t); setText(""); };
  const fileRef = React.useRef(null);
  const tools = (
    <>
      <button type="button" className={U.btnS + " h-10! min-h-[40px]! px-3!"} onClick={() => fileRef.current && fileRef.current.click()} data-testid="money-box-receipt"><Camera size={15} />{tr("Receipt")}</button>
      {onVoice ? <button type="button" className={U.btnS + " h-10! min-h-[40px]! px-3! " + (listening ? "border-[var(--c-neg)]! text-[var(--c-neg)]!" : "")} onClick={onVoice} data-testid="money-box-voice"><Mic size={15} />{listening ? tr("Listening…") : tr("Voice")}</button> : null}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onReceipt(e.target.files && e.target.files[0]); e.target.value = ""; }} />
    </>);
  const send = <button type="button" onClick={go} disabled={busy || !text.trim()} data-testid="money-box-go"
    className="min-h-[44px] h-11 px-4 rounded-[14px] bg-[var(--c-acc)] text-[var(--c-on-acc)] font-extrabold text-[14px] inline-flex items-center gap-1.5 disabled:opacity-40">
    {busy ? <Loader2 size={15} className="animate-spin" /> : null}{tr(wide ? "Record" : "Add")}<Arrow /></button>;
  return (
    <div className={U.card + " p-3.5 focus-within:border-[var(--c-acc)] transition-colors duration-150"} data-testid="money-box">
      <div className="flex items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") go(); }} dir="auto" data-testid="money-box-input"
          placeholder={wide ? tr("Write a payment or ask… «lunch 150, taxi 60»") : tr("Write or ask… lunch 150, taxi 60")}
          aria-label={tr("Write a payment or ask a question")}
          className="flex-1 min-w-0 min-h-[40px] bg-transparent border-0 outline-none text-[15px] font-semibold text-[var(--c-ink)] placeholder:text-[var(--c-mut)] placeholder:font-medium" />
        {wide ? <>{tools}{send}</> : null}
      </div>
      {!wide ? <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[var(--c-ln)]"><div className="flex items-center gap-1.5">{tools}</div>{send}</div> : null}
    </div>);
}

/** What the box did: the answer to a question, or the entries it added (with a way to the ledger to change them). */
function BoxResult({ res, clear, openLedger }) {
  if (!res) return null;
  return (
    <div className={U.cardPad.replace("border-[var(--c-ln)]", res.err ? "border-[var(--c-warn)]" : "border-[var(--c-acc)]")} data-testid="money-box-result">
      <div className="flex items-start gap-2">
        <Sparkles size={15} className="shrink-0 mt-0.5 text-[var(--c-acc)]" />
        <div className="flex-1 min-w-0 text-[13.5px] font-semibold whitespace-pre-wrap" dir="auto">
          {res.answer || res.err || (res.added ? T("Added {n}: {list}", { n: res.added.length, list: res.added.map((x) => (x.note || x.cat) + " " + fmt(x.amount)).join(" · ") }) : "")}
          {res.warnings && res.warnings.length ? <div className={"mt-1 text-[12px] font-normal " + U.muted}>{res.warnings.join(" ")}</div> : null}
        </div>
        <button className={"shrink-0 min-h-[32px] px-2 text-[12px] font-bold " + U.muted} onClick={clear} aria-label={tr("Close")}>✕</button>
      </div>
      {res.added ? <button className="mt-1 min-h-[36px] text-[12.5px] font-bold text-[var(--c-acc)]" onClick={openLedger}>{tr("Change it in the ledger")}</button> : null}
    </div>);
}

/** The balance card: the total (or one account), this month's net, and the accounts as pills that filter the view. */
function BalanceHero({ rep, all, account, setAccount, wide, safe }) {
  const name = account ? (rep.accounts.find((a) => a.id === account) || {}).name : null;
  return (
    <div className={U.card + " relative overflow-hidden p-[18px]"} data-testid="money-balance-hero">
      <span aria-hidden="true" className="pointer-events-none absolute -top-8 -end-8 w-36 h-36 rounded-full bg-[var(--c-soft)] opacity-60" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={U.label}>{name ? T("Balance · {a}", { a: name }) : tr("Total balance · All accounts")}</div>
          <div className={"mt-1 tabular-nums font-black tracking-tight leading-tight " + (wide ? "text-[34px]" : "text-[30px]")} dir="ltr" data-testid="money-balance">
            <span>{fmt(rep.balance)}</span><span className={"ms-1.5 text-[16px] font-bold " + U.muted}>{rep.cur}</span></div>
          {!account && rep.others.length ? <div className={"text-[12.5px] tabular-nums " + U.muted} dir="ltr">{rep.others.map((x) => fmt(x.balance) + " " + x.currency).join(" · ")}</div> : null}
        </div>
        {safe || (rep.month.in || rep.month.out ? <span className={U.tag(rep.month.net >= 0 ? "green" : "red") + " tabular-nums"} data-testid="money-net">{T("{a} net", { a: amt(rep.month.net, rep.cur, { sign: true }) })}</span> : null)}
      </div>
      {all.accounts.length > 1 ? (
        <div className="relative flex flex-wrap gap-1.5 mt-3.5" role="tablist" aria-label={tr("Accounts")} data-testid="money-accounts">
          <button role="tab" aria-selected={!account} onClick={() => setAccount(null)} data-testid="money-acc-all" className={pill(!account)}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />{wide ? T("All accounts ({a})", { a: amt(all.balance, all.cur) }) : tr("All accounts")}</button>
          {all.accounts.map((a) => (
            <button key={a.id} role="tab" aria-selected={account === a.id} onClick={() => setAccount(a.id)} data-testid="money-acc" className={pill(account === a.id)}>
              <span dir="auto">{a.name}</span><span aria-hidden="true">·</span><span className="tabular-nums" dir="ltr">{amt(a.balance, a.currency)}</span></button>))}
        </div>) : null}
    </div>);
}
const pill = (on) => "min-h-[36px] px-3 rounded-full text-[12.5px] font-bold inline-flex items-center gap-1.5 border transition-colors duration-150 "
  + (on ? "bg-[var(--c-soft)] border-[var(--c-acc)] text-[var(--c-acc)]" : "bg-[var(--c-surf-2)] border-[var(--c-ln)] text-[var(--c-mut)] hover:text-[var(--c-ink)]");

/** A quiet KPI tile (Gemini's): label with a mark, the number, one line under it. */
function Tile({ label, mark, value, tone, sub, testid }) {
  const col = tone === "neg" ? "text-[var(--c-neg)]" : tone === "pos" ? "text-[var(--c-pos)]" : tone === "warn" ? "text-[var(--c-warn)]" : tone === "acc" ? "text-[var(--c-acc)]" : "";
  return (
    <div className={U.card + " p-3.5 flex flex-col gap-1 min-w-0"} data-testid={testid}>
      <div className={"flex items-center justify-between gap-1.5 text-[11.5px] font-bold " + U.muted}><span className="truncate">{label}</span>{mark}</div>
      <b className={"block tabular-nums text-[19px] font-black tracking-tight truncate " + col} dir="ltr">{value}</b>
      {sub ? <span className={"block text-[11.5px] font-semibold truncate " + U.muted} dir="auto">{sub}</span> : null}
    </div>);
}

function TxRow({ t, cur, onClick }) {
  return (
    <button onClick={onClick} className="w-full text-start flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-[14px] bg-[var(--c-surf-2)] border border-transparent hover:border-[var(--c-ln)] min-h-[56px]" data-testid="money-tx">
      <span className="flex items-center gap-2.5 min-w-0">
        <span className="w-[38px] h-[38px] shrink-0 rounded-[12px] grid place-items-center bg-[var(--c-surf)] border border-[var(--c-ln)] text-[16px]" aria-hidden="true">{t.emoji}</span>
        <span className="min-w-0"><span className="block truncate font-bold text-[13.5px]" dir="auto">{t.note || t.catName}</span>
          <span className={"block truncate text-[11.5px] font-semibold " + U.muted} dir="auto">{dayLabel(t.date)}{t.account ? " · " + t.account : ""} · {t.catName}</span></span>
      </span>
      <span className={"shrink-0 tabular-nums font-extrabold text-[14px] " + (t.type === "income" ? "text-[var(--c-pos)]" : "text-[var(--c-neg)]")} dir="ltr">
        {fmt(t.type === "income" ? t.amount : -t.amount, { sign: true })} {t.currency !== cur ? t.currency : cur}</span>
    </button>);
}

function Recent({ rep, openLedger, title }) {
  return (
    <div className={U.cardPad} data-testid="money-recent">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="font-extrabold text-[14.5px]">{title}</span>
        <button onClick={openLedger} className={U.tag("gray") + " tabular-nums min-h-[28px]"} data-testid="money-recent-count">{T("{n} this month", { n: rep.month.count })}</button>
      </div>
      {rep.recent.length ? <div className="flex flex-col gap-2">{rep.recent.map((t) => <TxRow key={t.id} t={t} cur={rep.cur} onClick={openLedger} />)}</div>
        : <p className={"m-0 text-[13px] " + U.muted}>{tr("Nothing logged yet — write it in the box above: “lunch 150, taxi 60”.")}</p>}
    </div>);
}

/** The entry to level 2. */
function ReportCta({ onClick, wide }) {
  return (
    <button onClick={onClick} data-testid="money-open-report"
      className={U.card + " w-full min-h-[48px] px-4 py-3 flex items-center justify-between gap-3 text-start hover:border-[var(--c-acc)] hover:bg-[var(--c-surf-2)]"}>
      <span className="min-w-0"><span className="block font-extrabold text-[14px]">{wide ? tr("Open Money Report") : tr("See all · Trends, Bills & Zakāt")}</span>
        {wide ? <span className={"block text-[12px] font-semibold " + U.muted}>{tr("Where the money went, six months of money in and out, Zakāt and the month's full ledger")}</span> : null}</span>
      <span className="shrink-0 inline-flex items-center gap-1 text-[12.5px] font-bold text-[var(--c-acc)]">{tr("Money Report")}<Arrow size={14} /></span>
    </button>);
}

/** Level 1 — the calm view. `rep` = the report for the chosen account; `all` = for all accounts (the pills). */
export function MoneyCalm({ rep, all, account, setAccount, wide, box, result, clearResult, openReport, openLedger, rightNow, zak, inbox }) {
  const top2 = rep.month.cats.filter((c) => c.id !== "_rest").slice(0, 2).map((c) => c.name + " " + c.pct + "%").join(" · ");
  const spent = <Tile label={tr("Spent · This month")} mark={<span className="text-[var(--c-neg)]">↓</span>} value={amt(rep.month.out, rep.cur)} tone="neg" sub={top2 || tr("Nothing spent yet")} testid="money-kpi-out" />;
  const earned = <Tile label={wide ? T("Earned · {m}", { m: monthLabel(rep.month.from.slice(0, 7)) }) : tr("Earned · This month")} mark={<span className="text-[var(--c-pos)]">↑</span>} value={amt(rep.month.in, rep.cur)} tone="pos"
    sub={wide ? T("Net saved: {a}", { a: amt(rep.month.net, rep.cur) }) : rep.month.rate != null ? (rep.month.rate >= 0 ? T("{p}% of it kept", { p: rep.month.rate }) : T("Spent {a} more than earned", { a: amt(-rep.month.net, rep.cur) })) : tr("No income logged yet")} testid="money-kpi-in" />;
  if (!wide) return (
    <div className="flex flex-col gap-3" data-testid="money-calm">
      {box}
      <BoxResult res={result} clear={clearResult} openLedger={openLedger} />
      <SafeSpend card />
      <BalanceHero rep={rep} all={all} account={account} setAccount={setAccount} />
      <div className="grid grid-cols-2 gap-2.5">{spent}{earned}</div>
      {inbox}
      <Recent rep={rep} openLedger={openLedger} title={tr("Recent activity")} />
      <ReportCta onClick={openReport} />
    </div>);
  // the computer: two calm panes — the box, the balance and the latest on one side; the totals, one "right now" and the Report on the other
  const safe = <SafeSpend inline />;
  return (
    <div className="grid gap-[18px] items-start" style={{ gridTemplateColumns: "minmax(0,1.15fr) minmax(0,0.85fr)" }} data-testid="money-calm">
      <div className="flex flex-col gap-3.5 min-w-0">
        {box}
        <BoxResult res={result} clear={clearResult} openLedger={openLedger} />
        <BalanceHero rep={rep} all={all} account={account} setAccount={setAccount} wide safe={safe} />
        {inbox}
        <div className={U.cardPad} data-testid="money-recent">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="font-extrabold text-[14.5px]">{T("Recent activity ({a} of {b})", { a: rep.recent.length, b: rep.month.count })}</span>
            <button onClick={openLedger} className="min-h-[36px] px-2.5 rounded-[10px] text-[12.5px] font-bold text-[var(--c-acc)] hover:bg-[var(--c-soft)] inline-flex items-center gap-1" data-testid="money-recent-count">{tr("Full ledger")}<Arrow size={13} /></button>
          </div>
          {rep.recent.length ? <div className="flex flex-col gap-2">{rep.recent.map((t) => <TxRow key={t.id} t={t} cur={rep.cur} onClick={openLedger} />)}</div>
            : <p className={"m-0 text-[13px] " + U.muted}>{tr("Nothing logged yet — write it in the box above: “lunch 150, taxi 60”.")}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-3.5 min-w-0">
        <div className="grid grid-cols-2 gap-2.5">
          <Tile label={T("Spent · {m}", { m: monthLabel(rep.month.from.slice(0, 7)) })} value={amt(rep.month.out, rep.cur)} tone="neg"
            sub={rep.month.pace == null ? top2 || tr("Nothing spent yet") : rep.month.pace <= 0 ? T("{p}% below last month's pace", { p: -rep.month.pace }) : T("{p}% above last month's pace", { p: rep.month.pace })} testid="money-kpi-out" />
          {earned}
          <Tile label={tr("Bills · Next 7 days")} value={amt(rep.dueTotal, rep.cur)} tone={rep.due.length ? "warn" : ""} testid="money-kpi-bills"
            sub={rep.due.length ? T("{n} due ({list})", { n: rep.due.length, list: rep.due.slice(0, 2).map((d) => d.note).join(", ") }) : tr("No bills due this week.")} />
          <Tile label={tr("Zakāt status")} tone="acc" testid="money-kpi-zakat"
            value={!zak ? "—" : zak.noPrice ? tr("Needs a price") : zak.due ? tr("Due") : zak.pct != null ? T("{p}% of niṣāb", { p: zak.pct }) : "—"}
            sub={!zak ? tr("Open Zakāt in the ledger") : zak.noPrice ? tr("Set today's gold price in Zakāt") : zak.due && zak.amount != null ? T("{a} — as Yusr calculated", { a: amt(zak.amount, all.cur) }) : tr("As Yusr's zakāt engine calculated")} />
        </div>
        {rightNow}
        <ReportCta onClick={openReport} wide />
      </div>
    </div>);
}

/** The one "right now" card on the computer: the Guardian's first catch, else the first bill due. */
export function RightNow({ item, open, testid = "money-right-now" }) {
  if (!item) return null;
  return (
    <div className={U.cardPad.replace("border-[var(--c-ln)]", "border-[var(--c-warn)]")} data-testid={testid}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-extrabold text-[14.5px] flex items-center gap-2"><ShieldCheck size={16} className="text-[var(--c-acc)]" />{tr("Right now · 1 thing needs your eye")}</span>
        {item.tag ? <span className={U.tag("amber")}>{item.tag}</span> : null}
      </div>
      <p className="m-0 mb-2.5 text-[13px] font-semibold" dir="auto">{item.text}</p>
      <button className={U.btnS + " h-10! min-h-[40px]! bg-[var(--c-soft)]! text-[var(--c-acc)]! border-[var(--c-acc)]!"} onClick={open}>{item.action}<Arrow size={13} /></button>
    </div>);
}

// ---- level 2: the Money Report ----------------------------------------------------------------------------------------------------
function Donut({ rep, size = 112 }) {
  const C = 2 * Math.PI * 44, arcs = donutArcs(rep.month.cats, C);
  const k = rep.month.out >= 10000 ? fmt(Math.round(rep.month.out / 100) / 10) + "k" : fmt(rep.month.out);
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={tr("Spending by category")} className="shrink-0" data-testid="money-donut">
      <circle cx="60" cy="60" r="44" fill="none" stroke="var(--c-surf-2)" strokeWidth="14" />
      {rep.month.cats.map((c, i) => <circle key={c.id} cx="60" cy="60" r="44" fill="none" stroke={SLICE[i % 4]} strokeWidth="14" strokeDasharray={arcs[i].dash + " " + C} strokeDashoffset={arcs[i].offset} transform="rotate(-90 60 60)" />)}
      <text x="60" y="58" textAnchor="middle" fill="var(--c-ink)" fontSize="15" fontWeight="800" style={{ fontVariantNumeric: "tabular-nums" }}>{k}</text>
      <text x="60" y="74" textAnchor="middle" fill="var(--c-mut)" fontSize="10" fontWeight="700">{rep.cur}</text>
    </svg>);
}

function WhereItWent({ rep, wide }) {
  return (
    <div className={U.cardPad} data-testid="money-cats">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="font-extrabold text-[14.5px]">{wide ? tr("Spending by category") : T("Where the money went · {m}", { m: monthLabel(rep.month.from.slice(0, 7), true) })}</span>
        <span className="tabular-nums font-extrabold text-[13px] text-[var(--c-neg)]" dir="ltr">{amt(rep.month.out, rep.cur)}</span>
      </div>
      {rep.month.cats.length ? (
        <div className="flex items-center gap-4">
          <Donut rep={rep} size={wide ? 96 : 112} />
          <div className={wide ? "flex-1 grid grid-cols-2 gap-2" : "flex-1 flex flex-col gap-2"}>
            {rep.month.cats.map((c, i) => wide ? (
              <div key={c.id} className="p-2 rounded-[10px] bg-[var(--c-surf-2)] min-w-0"><div className={"flex items-center gap-1.5 text-[12px] font-bold truncate " + U.muted}><i className="w-2 h-2 rounded-full shrink-0" style={{ background: SLICE[i % 4] }} />{c.name}</div>
                <div className="tabular-nums font-extrabold text-[14px]" dir="ltr">{fmt(c.amount)} <span className={"text-[12px] font-semibold " + U.muted}>({c.pct}%)</span></div></div>
            ) : (
              <div key={c.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                <span className="flex items-center gap-1.5 font-bold min-w-0"><i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SLICE[i % 4] }} /><span className="truncate">{c.name}</span></span>
                <span className="tabular-nums font-extrabold shrink-0" dir="ltr">{fmt(c.amount)} <span className={"font-semibold " + U.muted}>({c.pct}%)</span></span></div>))}
          </div>
        </div>) : <p className={"m-0 text-[13px] " + U.muted}>{tr("Nothing spent this month yet.")}</p>}
    </div>);
}

function Weeks({ rep }) {
  const max = Math.max(1, rep.weekTarget, ...rep.weeks.map((w) => w.out)), H = 70, y0 = 98;
  const over = rep.weekTarget && rep.weeks[3].out > rep.weekTarget;
  return (
    <div className={U.cardPad} data-testid="money-weeks">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-extrabold text-[14.5px]">{tr("Weekly spending vs. pace")}</span>
        {rep.weekTarget ? <span className={U.tag(over ? "amber" : "green")}>{over ? tr("Over the weekly target") : tr("Under budget")}</span> : null}
      </div>
      <svg width="100%" viewBox="0 0 320 120" role="img" aria-label={tr("Weekly spending")} dir="ltr">
        {rep.weekTarget ? <g><line x1="10" x2="310" y1={y0 - (rep.weekTarget / max) * H} y2={y0 - (rep.weekTarget / max) * H} stroke="var(--c-warn)" strokeWidth="1.5" strokeDasharray="4 4" />
          <text x="10" y={y0 - (rep.weekTarget / max) * H - 6} textAnchor="start" fill="var(--c-warn)" fontSize="9.5" fontWeight="700">{T("Target {a}/wk", { a: fmt(rep.weekTarget) })}</text></g> : null}
        {rep.weeks.map((w, i) => { const h = Math.max(3, (w.out / max) * H), x = 28 + i * 74, now = i === 3; return (
          <g key={i}><rect x={x} y={y0 - h} width="38" height={h} rx="7" fill={now ? "var(--c-acc-2)" : "var(--c-chart-1)"} opacity={now ? 1 : 0.85} />
            <text x={x + 19} y={y0 - h - 5} textAnchor="middle" fill="var(--c-ink)" fontSize="10" fontWeight={now ? 800 : 700}>{fmt(Math.round(w.out))}</text>
            <text x={x + 19} y="113" textAnchor="middle" fill={now ? "var(--c-ink)" : "var(--c-mut)"} fontSize="10" fontWeight={now ? 800 : 600}>{now ? tr("Now") : T("Wk {n}", { n: i + 1 })}</text></g>); })}
      </svg>
    </div>);
}

function Cashflow({ rep, wide }) {
  const W = wide ? 620 : 340, step = (W - 60) / 6, bw = wide ? 22 : 13, gap = wide ? 4 : 2, fs = wide ? 11 : 10;
  const max = Math.max(1, ...rep.months.map((m) => Math.max(m.in, m.out))), top = 30, base = 145, H = base - top;
  const nice = (v) => v >= 1000 ? fmt(Math.round(v / 100) / 10) + "k" : fmt(Math.round(v));
  const minNet = Math.min(0, ...rep.months.map((m) => m.net)), span = Math.max(1, max - minNet);
  const ny = (v) => base - ((v - minNet) / span) * H;
  const cx = (i) => 44 + step * i + step / 2;
  const pts = rep.months.map((m, i) => [cx(i), ny(m.net)]);
  return (
    <div className={U.cardPad} data-testid="money-cashflow">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <div><div className="font-extrabold text-[14.5px]">{tr("6-month cashflow · Earned vs. Spent")}</div>
          <div className={"text-[12px] " + U.muted}>{tr("Bars show each month's money in and out; the line is what was left")}</div></div>
        <div className="flex gap-3 text-[11.5px] font-bold">
          <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-[3px]" style={{ background: "var(--c-chart-1)" }} />{tr("Earned")}</span>
          <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-[3px] opacity-50" style={{ background: "var(--c-mut)" }} />{tr("Spent")}</span>
          <span className="inline-flex items-center gap-1.5"><i className="w-3 h-[3px]" style={{ background: "var(--c-acc-2)" }} />{tr("Net saved")}</span>
        </div>
      </div>
      <svg width="100%" viewBox={"0 0 " + W + " 175"} role="img" aria-label={tr("6-month cashflow")} dir="ltr">
        {[0, 0.5, 1].map((f) => <g key={f}><line x1="40" x2={W - 8} y1={base - f * H} y2={base - f * H} stroke="var(--c-ln)" strokeWidth="1" strokeDasharray={f ? "3 3" : null} />
          <text x="34" y={base - f * H + 4} textAnchor="end" fill="var(--c-mut)" fontSize={fs}>{nice(f * max)}</text></g>)}
        {rep.months.map((m, i) => { const x = cx(i), now = i === 5, hi = (m.in / max) * H, ho = (m.out / max) * H; return (
          <g key={m.key}><rect x={x - bw - gap / 2} y={base - hi} width={bw} height={Math.max(0, hi)} rx={wide ? 5 : 3} fill="var(--c-chart-1)" />
            <rect x={x + gap / 2} y={base - ho} width={bw} height={Math.max(0, ho)} rx={wide ? 5 : 3} fill={now ? "var(--c-acc-2)" : "var(--c-mut)"} opacity={now ? 1 : 0.45} />
            <text x={x} y="163" textAnchor="middle" fill={now ? "var(--c-ink)" : "var(--c-mut)"} fontSize={fs} fontWeight={now ? 800 : 700}>{monthLabel(m.key)}</text></g>); })}
        <polyline fill="none" stroke="var(--c-acc-2)" strokeWidth="2.5" points={pts.map((p) => p.join(",")).join(" ")} />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === 5 ? 5 : 3.5} fill="var(--c-acc-2)" stroke={i === 5 ? "var(--c-surf)" : "none"} strokeWidth="2" />)}
      </svg>
    </div>);
}

function ZakatCard({ zak, cur, openZakat }) {
  return (
    <button className={U.cardPad + " w-full text-start hover:border-[var(--c-acc)]"} onClick={openZakat} data-testid="money-zakat">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-extrabold text-[14.5px] flex items-center gap-2"><span aria-hidden="true">🌙</span>{tr("Zakāt & niṣāb")}</span>
        <span className={U.tag("gray")}>{tr("2.5% after a lunar year")}</span>
      </div>
      {!zak ? <p className={"m-0 text-[12.5px] " + U.muted}>{tr("Open Zakāt to see where you stand — Yusr's engine calculates it.")}</p>
        : zak.noPrice ? <p className={"m-0 text-[12.5px] " + U.muted}>{tr("Zakāt can't be told yet: there's no gold or silver price. Open Zakāt and set today's price.")}</p>
        : <>
          {zak.base != null && zak.nisab != null ? <p className={"m-0 mb-2 text-[12.5px] " + U.muted}>{T("What counts for zakāt ({b}) against the niṣāb ({n})", { b: amt(zak.base, cur), n: amt(zak.nisab, cur) })}</p> : null}
          {zak.pct != null ? <><div className="h-2 rounded-full bg-[var(--c-surf-2)] border border-[var(--c-ln)] overflow-hidden"><i className="block h-full rounded-full" style={{ width: Math.min(100, zak.pct) + "%", background: zak.due ? "var(--c-warn)" : "var(--c-acc)" }} /></div>
            <div className="flex justify-between mt-1.5 text-[11.5px] font-bold tabular-nums"><span className="text-[var(--c-acc)]" dir="ltr">{amt(zak.base, cur)} ({zak.pct}%)</span><span className={U.muted}>{T("Niṣāb: {a}", { a: amt(zak.nisab, cur) })}</span></div></> : null}
          {zak.due ? <p className="m-0 mt-2 text-[13px] font-extrabold text-[var(--c-warn)]">{zak.amount != null ? T("Zakāt is due: {a}", { a: amt(zak.amount, cur) }) : tr("Zakāt is due")}</p> : null}
          <p className={"m-0 mt-1.5 text-[11px] " + U.muted}>{tr("Figures from Yusr's zakāt engine, not recalculated.")}</p></>}
    </button>);
}

function Ledger({ rep, openLedger, wide }) {
  return (
    <div className={U.cardPad} data-testid="money-ledger">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-extrabold text-[14.5px]">{T("{m} ledger ({n} entries)", { m: monthLabel(rep.month.from.slice(0, 7)), n: rep.rows.length })}</span>
        <button className="min-h-[36px] px-2 text-[12.5px] font-bold text-[var(--c-acc)] inline-flex items-center gap-1" onClick={openLedger}>{tr("Edit in the ledger")}<Arrow size={13} /></button>
      </div>
      {rep.rows.length && !wide ? <div className="divide-y divide-[var(--c-ln)]">{rep.rows.slice(0, 60).map((t) => (
        // a phone: one line per entry, the amount always in sight (a 5-column table would scroll sideways)
        <div key={t.id} className="flex items-center justify-between gap-3 py-2.5 min-h-[48px]" data-testid="money-ledger-row">
          <span className="min-w-0"><span className="block truncate font-bold text-[13.5px]" dir="auto">{t.note || t.catName}</span>
            <span className={"block truncate text-[11.5px] font-semibold " + U.muted} dir="auto">{dayLabel(t.date)} · {t.type === "income" ? tr("Income") : t.catName}{t.account ? " · " + t.account : ""}</span></span>
          <span className={"shrink-0 tabular-nums font-extrabold text-[13.5px] " + (t.type === "income" ? "text-[var(--c-pos)]" : "text-[var(--c-neg)]")} dir="ltr">{fmt(t.type === "income" ? t.amount : -t.amount, { sign: true })} {t.currency}</span>
        </div>))}</div>
      : rep.rows.length ? <div className="overflow-x-auto"><table className="w-full border-collapse text-[13px]">
        <thead><tr>{["Date", "Description", "Category", "Account", "Amount"].map((h, i) => <th key={h} className={"py-2.5 px-3 border-b border-[var(--c-ln)] text-[11.5px] font-extrabold whitespace-nowrap " + U.muted + (i === 4 ? " text-end" : " text-start")}>{tr(h)}</th>)}</tr></thead>
        <tbody>{rep.rows.slice(0, 60).map((t) => (
          <tr key={t.id} className="border-b border-[var(--c-ln)] last:border-0">
            <td className="py-2.5 px-3 tabular-nums whitespace-nowrap font-semibold">{dayLabel(t.date)}</td>
            <td className="py-2.5 px-3 font-semibold max-w-[220px] truncate" dir="auto">{t.note || t.catName}</td>
            <td className="py-2.5 px-3"><span className={U.tag(t.type === "income" ? "green" : "gray")}>{t.type === "income" ? tr("Income") : t.catName}</span></td>
            <td className="py-2.5 px-3 whitespace-nowrap font-semibold" dir="auto">{t.account}</td>
            <td className={"py-2.5 px-3 text-end tabular-nums font-extrabold whitespace-nowrap " + (t.type === "income" ? "text-[var(--c-pos)]" : "text-[var(--c-neg)]")} dir="ltr">{fmt(t.type === "income" ? t.amount : -t.amount, { sign: true })} {t.currency}</td>
          </tr>))}</tbody></table></div>
        : <p className={"m-0 text-[13px] " + U.muted}>{tr("No entries this month yet.")}</p>}
    </div>);
}

/** Level 2 — the Money Report. */
export function MoneyReport({ rep, all, wide, back, zak, exportCsv, exportPdf, openLedger, openZakat, account }) {
  const accName = account ? (rep.accounts.find((a) => a.id === account) || {}).name : null;
  const sub = monthLabel(rep.month.from.slice(0, 7), true) + " · " + (accName || tr("All accounts"));
  const exports = (
    <div className="flex gap-1.5 shrink-0">
      <button className={U.btnS + " h-10! min-h-[40px]! px-3!"} onClick={exportPdf} data-testid="money-export-pdf"><FileText size={14} />PDF</button>
      <button className={U.btnS + " h-10! min-h-[40px]! px-3! " + (wide ? "bg-[var(--c-soft)]! text-[var(--c-acc)]! border-[var(--c-acc)]!" : "")} onClick={exportCsv} data-testid="money-export-csv"><FileDown size={14} />Excel</button>
    </div>);
  const head = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <button className="w-11 h-11 shrink-0 rounded-[14px] grid place-items-center bg-[var(--c-surf)] border border-[var(--c-ln)] hover:border-[var(--c-acc)]" onClick={back} aria-label={tr("Back")} data-testid="money-report-back"><Arrow back size={17} /></button>
        <div className="min-w-0"><h2 className={(wide ? "text-[21px]" : "text-[17px]") + " font-black tracking-tight m-0 truncate"}>{wide ? T("Money Report · {m}", { m: monthLabel(rep.month.from.slice(0, 7), true) }) : tr("Money Report")}</h2>
          <div className={"text-[12px] font-semibold truncate " + U.muted}>{wide ? (accName ? accName : tr("All accounts")) + " · " + tr("updated from your entries") : sub}</div></div>
      </div>
      {exports}
    </div>);
  if (!wide) return (
    <div className="flex flex-col gap-3" data-testid="money-report">
      {head}
      <div className="grid grid-cols-2 gap-2.5">
        <Tile label={tr("Spent · This month")} value={amt(rep.month.out, rep.cur)} tone="neg" sub={T("{n} entries", { n: rep.month.count })} testid="money-rep-out" />
        <Tile label={tr("Earned · This month")} value={amt(rep.month.in, rep.cur)} tone="pos" sub={rep.month.rate != null ? (rep.month.rate >= 0 ? T("{p}% of it kept", { p: rep.month.rate }) : T("Spent {a} more than earned", { a: amt(-rep.month.net, rep.cur) })) : "—"} testid="money-rep-in" />
      </div>
      <WhereItWent rep={rep} />
      <Weeks rep={rep} />
      <Cashflow rep={rep} />
      <ZakatCard zak={zak} cur={all.cur} openZakat={openZakat} />
      <Ledger rep={rep} openLedger={openLedger} />
    </div>);
  return (
    <div className="flex flex-col gap-[18px]" data-testid="money-report">
      {head}
      <div className="grid grid-cols-4 gap-3">
        <Tile label={tr("Balance")} value={amt(rep.balance, rep.cur)} sub={rep.accounts.filter((a) => a.currency === rep.cur && (!account || a.id === account)).slice(0, 3).map((a) => a.name + " " + fmt(a.balance)).join(" · ")} testid="money-rep-balance" />
        <Tile label={tr("Earned this month")} value={amt(rep.month.in, rep.cur)} tone="pos" sub={rep.month.rate != null ? T("Savings rate: {p}% so far", { p: rep.month.rate }) : "—"} testid="money-rep-in" />
        <Tile label={tr("Spent this month")} value={amt(rep.month.out, rep.cur)} tone="neg" sub={T("{n} entries across {c} categories", { n: rep.month.count, c: rep.month.cats.length })} testid="money-rep-out" />
        <Tile label={tr("Bills · Next 7 days")} value={amt(rep.dueTotal, rep.cur)} tone={rep.due.length ? "warn" : ""} sub={rep.due.length ? rep.due.slice(0, 2).map((d) => d.note + " " + dayLabel(d.date)).join(" · ") : tr("No bills due this week.")} testid="money-rep-bills" />
      </div>
      <div className="grid gap-[18px] items-start" style={{ gridTemplateColumns: "minmax(0,1.15fr) minmax(0,0.85fr)" }}>
        <div className="flex flex-col gap-3.5 min-w-0"><Cashflow rep={rep} wide /><ZakatCard zak={zak} cur={all.cur} openZakat={openZakat} /></div>
        <div className="flex flex-col gap-3.5 min-w-0"><WhereItWent rep={rep} wide /><Weeks rep={rep} /></div>
      </div>
      <Ledger rep={rep} openLedger={openLedger} wide />
    </div>);
}

/** The phone's header on the calm view and the Report: menu, title, Import (a payment message or photo) and the ledger. */
export function MoneyPhoneHead({ onMenu, onImport, onLedger, ready }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {onMenu ? <button onClick={onMenu} aria-label={tr("Menu")} data-testid="header-menu" className="w-10 h-10 rounded-[12px] grid place-items-center bg-[var(--c-surf)] border border-[var(--c-ln)]">☰</button> : null}
        <h2 className="text-[18px] font-black tracking-tight m-0">{tr("Money")}</h2>
        <span className={"w-2 h-2 rounded-full " + (ready ? "bg-[var(--c-acc)]" : "bg-[var(--c-ln)]")} title={ready ? tr("Connected") : tr("Starting…")} />
      </div>
      <div className="flex items-center gap-1.5">
        <button className={U.btnS + " h-10! min-h-[40px]! px-3!"} onClick={onImport} data-testid="money-tools"><Upload size={14} />{tr("Import")}</button>
        <button className={U.btnS + " h-10! min-h-[40px]! px-3!"} onClick={onLedger} data-testid="money-more" aria-label={tr("More")}><BookOpen size={15} />{tr("More")}</button>
      </div>
    </div>);
}

