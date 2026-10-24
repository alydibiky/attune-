/* ---- v6.37 (upgrade M1): the "Safe to spend today" line on Money (phone: a slim row above the ledger; computer: a card on
   Overview). The number is code (safespend.js) from the ledger, People & plans and the Radar — the same data Money shows.
   A tap opens what it counted: everything due until the next income, so the number is never a mystery. */
import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { tr } from "./i18n.js";
import { safeToSpend } from "./safespend.js";
import { fmt } from "./money-calm.js";
import * as U from "./ui-kit.jsx";

const KEY = "attune:safespend:v1";
const j = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } };
const FROM = { money: "Bills", plans: "People & plans", dates: "Dates", debts: "You owe" };

/** Re-reads when Money (in its frame) or another tab writes the ledger. */
function useSafe(nonce) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const on = (e) => { if (!e || !e.key || /ledger\.v3|attune:life|attune:radar|attune:safespend/.test(e.key)) setV((x) => x + 1); };
    const vis = () => { if (document.visibilityState === "visible") setV((x) => x + 1); };
    window.addEventListener("storage", on); document.addEventListener("visibilitychange", vis);
    const t = setInterval(() => setV((x) => x + 1), 60000);   // a new day, today's spending
    return () => { window.removeEventListener("storage", on); document.removeEventListener("visibilitychange", vis); clearInterval(t); };
  }, []);
  return useMemo(() => {
    const ledger = j("ledger.v3", null);
    if (!ledger || !(ledger.accounts || []).length) return null;
    const cfg = j(KEY, {});
    return { ...safeToSpend({ ledger, life: j("attune:life:v1", { items: [] }), radar: j("attune:radar:v1", { items: [] }), cushion: cfg.cushion || 0 }), cushion: cfg.cushion || 0 };
  }, [v, nonce]);
}

const dayName = (s) => { try { return new Date(s + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" }); } catch (e) { return s; } };

function Details({ s, setCushion }) {
  const [c, setC] = useState(String(s.cushion || ""));
  return (
    <div className="grid gap-2 text-[12.5px]" data-testid="safe-details">
      <p className="m-0 text-[var(--c-ink)]">{tr("You have {b}. Until {d} ({n} days) these are due: {t}. What is left, shared over the days, is what you can spend each day.").replace("{b}", s.cur + " " + fmt(s.balance)).replace("{d}", dayName(s.until)).replace("{n}", s.days).replace("{t}", s.cur + " " + fmt(s.dueTotal))}</p>
      {s.due.length ? (
        <ul className="grid gap-1 m-0 p-0 list-none">
          {s.due.slice(0, 12).map((d, i) => (
            <li key={i} className="flex justify-between gap-3 py-1 border-b border-[var(--c-ln)] last:border-0"><span className="min-w-0 truncate" dir="auto">{dayName(d.date)} · {d.what} <span className={U.muted}>· {tr(FROM[d.from])}</span></span><b className="shrink-0 tabular-nums font-extrabold" dir="ltr">{fmt(d.amount)}</b></li>))}
          {s.due.length > 12 ? <li className={U.muted}>+{s.due.length - 12}</li> : null}
        </ul>) : <p className={"m-0 " + U.muted}>{tr("Nothing due before then.")}</p>}
      {!s.income ? <p className={"m-0 " + U.muted}>{tr("Tip: add your salary as a repeating income in Money, and this counts until payday.")}</p> : null}
      <label className="flex items-center gap-2"><span className="font-bold">{tr("Keep aside")}</span>
        <input value={c} onChange={(e) => setC(e.target.value.replace(/[^\d.]/g, ""))} onBlur={() => setCushion(Number(c) || 0)} inputMode="decimal" data-testid="safe-cushion"
          className={U.inp.replace("w-full", "w-28") + " tabular-nums"} placeholder="0" /><span className={U.muted}>{s.cur}</span></label>
    </div>);
}

/** calm = a big Overview card; card = the v7.2 Money calm view's card (Gemini's mock-up); inline = inside the computer's balance
 *  card (the number and its line, at the end); else the phone's slim row. */
export function SafeSpend({ calm = false, card = false, inline = false }) {
  const [open, setOpen] = useState(false);
  const [nonce, setNonce] = useState(0);
  const s = useSafe(nonce);
  if (!s) return null;
  const setCushion = (v) => { try { localStorage.setItem(KEY, JSON.stringify({ ...j(KEY, {}), cushion: v })); } catch (e) {} setNonce((x) => x + 1); };
  const line = s.short > 0
    ? tr("Short by {x} before {d}").replace("{x}", s.cur + " " + fmt(s.short)).replace("{d}", dayName(s.income ? s.income.d : s.until))
    : tr("about {x} a day until {d}").replace("{x}", fmt(s.perDay)).replace("{d}", dayName(s.until));
  const good = s.short > 0 ? "text-[var(--c-warn)]" : "text-[var(--c-pos)]";
  if (inline) return (
    <div className="text-end shrink-0" data-testid="safe-spend" title={line}>
      <div className={"text-[12px] font-bold " + U.muted}>{tr("Safe to spend today")}</div>
      <div className={"tabular-nums text-[22px] font-black " + good} dir="ltr" data-testid="safe-today">{fmt(s.today)} {s.cur}</div>
      <div className={"text-[11.5px] max-w-[240px] " + (s.short > 0 ? "font-bold text-[var(--c-warn)]" : U.muted)}>{line}{s.cushion ? " · " + tr("{a} kept aside", { a: fmt(s.cushion) + " " + s.cur }) : ""}</div>
    </div>);
  if (card) return (
    <div className="calm rounded-[18px] bg-[var(--c-surf)] border border-[var(--c-ln)] px-3.5 py-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]" data-testid="safe-spend">
      <button className="w-full min-h-[36px] flex items-center justify-between gap-2 text-start" onClick={() => setOpen(!open)} aria-expanded={open} data-testid="safe-spend-toggle">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
          <span className={"text-[12.5px] font-bold " + U.muted}>{tr("Safe to spend today")}</span>
          <b className={"tabular-nums font-black text-[16px] " + good} dir="ltr" data-testid="safe-today">{fmt(s.today)} {s.cur}</b>
          <span className={"text-[12px] font-semibold " + (s.short > 0 ? "text-[var(--c-warn)]" : U.muted)}>· {line}</span></span>
        {open ? <ChevronUp size={15} className={"shrink-0 " + U.muted} /> : <ChevronDown size={15} className={"shrink-0 " + U.muted} />}
      </button>
      {open ? <div className="mt-2.5 pt-2.5 border-t border-[var(--c-ln)]"><Details s={s} setCushion={setCushion} /></div> : null}
    </div>);
  if (calm) return (
    <div className={U.cardPad} data-testid="safe-spend">
      <button className="w-full text-start flex items-start justify-between gap-2" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="min-w-0"><span className={U.label}>{tr("Safe to spend today")}</span>
          <span className={"mt-1 block tabular-nums text-[28px] font-black tracking-tight " + (s.short > 0 ? "text-[var(--c-neg)]" : "")} dir="ltr" data-testid="safe-today">{s.cur} {fmt(s.today)}</span>
          <span className={"block text-[12.5px] " + (s.short > 0 ? "font-bold text-[var(--c-neg)]" : U.muted)}>{line}</span></span>
        {open ? <ChevronUp size={16} className={"shrink-0 " + U.muted} /> : <ChevronDown size={16} className={"shrink-0 " + U.muted} />}
      </button>
      {open ? <div className="mt-3"><Details s={s} setCushion={setCushion} /></div> : null}
    </div>);
  return (
    <div className="calm shrink-0 border-b border-[var(--c-ln)] px-3 py-1" data-testid="safe-spend">
      <button className="w-full min-h-[44px] flex items-center gap-2 text-start" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={"text-[12px] font-bold shrink-0 " + U.muted}>{tr("Safe to spend today")}</span>
        <b className={"tabular-nums font-black text-[15px] shrink-0 " + (s.short > 0 ? "text-[var(--c-warn)]" : "text-[var(--c-acc)]")} dir="ltr" data-testid="safe-today">{s.cur} {fmt(s.today)}</b>
        <span className={"flex-1 min-w-0 truncate text-[11.5px] " + U.muted}>{line}</span>
        {open ? <ChevronUp size={15} className={"shrink-0 " + U.muted} /> : <ChevronDown size={15} className={"shrink-0 " + U.muted} />}
      </button>
      {open ? <div className="pt-1 pb-2"><Details s={s} setCushion={setCushion} /></div> : null}
    </div>);
}
