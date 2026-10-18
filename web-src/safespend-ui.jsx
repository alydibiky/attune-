/* ---- v6.37 (upgrade M1): the "Safe to spend today" line on Money (phone: a slim row above the ledger; computer: a card on
   Overview). The number is code (safespend.js) from the ledger, People & plans and the Radar — the same data Money shows.
   A tap opens what it counted: everything due until the next income, so the number is never a mystery. */
import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { tr } from "./i18n.js";
import { safeToSpend } from "./safespend.js";
import { fmt } from "./money-calm.js";

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
      <p className="opacity-80">{tr("You have {b}. Until {d} ({n} days) these are due: {t}. What is left, shared over the days, is what you can spend each day.").replace("{b}", s.cur + " " + fmt(s.balance)).replace("{d}", dayName(s.until)).replace("{n}", s.days).replace("{t}", s.cur + " " + fmt(s.dueTotal))}</p>
      {s.due.length ? (
        <ul className="grid gap-1 m-0 p-0 list-none">
          {s.due.slice(0, 12).map((d, i) => (
            <li key={i} className="flex justify-between gap-3"><span className="min-w-0 truncate">{dayName(d.date)} · {d.what} <span className="opacity-60">· {tr(FROM[d.from])}</span></span><b className="shrink-0 tabular-nums">{fmt(d.amount)}</b></li>))}
          {s.due.length > 12 ? <li className="opacity-60">+{s.due.length - 12}</li> : null}
        </ul>) : <p className="opacity-70">{tr("Nothing due before then.")}</p>}
      {!s.income ? <p className="opacity-70">{tr("Tip: add your salary as a repeating income in Money, and this counts until payday.")}</p> : null}
      <label className="flex items-center gap-2"><span className="opacity-80">{tr("Keep aside")}</span>
        <input value={c} onChange={(e) => setC(e.target.value.replace(/[^\d.]/g, ""))} onBlur={() => setCushion(Number(c) || 0)} inputMode="decimal" data-testid="safe-cushion"
          className="w-28 rounded-md border border-slate-700 bg-transparent px-2 py-1 tabular-nums" placeholder="0" /><span className="opacity-60">{s.cur}</span></label>
    </div>);
}

/** calm = the computer's Overview card style (money-desk.jsx); else the phone's slim row. */
export function SafeSpend({ calm = false }) {
  const [open, setOpen] = useState(false);
  const [nonce, setNonce] = useState(0);
  const s = useSafe(nonce);
  if (!s) return null;
  const setCushion = (v) => { try { localStorage.setItem(KEY, JSON.stringify({ ...j(KEY, {}), cushion: v })); } catch (e) {} setNonce((x) => x + 1); };
  const line = s.short > 0
    ? tr("Short by {x} before {d}").replace("{x}", s.cur + " " + fmt(s.short)).replace("{d}", dayName(s.income ? s.income.d : s.until))
    : tr("about {x} a day until {d}").replace("{x}", fmt(s.perDay)).replace("{d}", dayName(s.until));
  if (calm) return (
    <div className="c-card" data-testid="safe-spend">
      <button className="w-full text-start flex items-start justify-between gap-2" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span><span className="c-lbl">{tr("Safe to spend today")}</span>
          <span className="c-amt mt-1 block" data-testid="safe-today">{s.cur} {fmt(s.today)}</span>
          <span className={"c-sub" + (s.short > 0 ? " c-neg" : "")}>{line}</span></span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open ? <div className="mt-3"><Details s={s} setCushion={setCushion} /></div> : null}
    </div>);
  return (
    <div className="shrink-0 bg-slate-950 border-b border-slate-800 px-3 py-2 text-slate-200" data-testid="safe-spend">
      <button className="w-full flex items-center gap-2 text-start" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="text-[12px] text-slate-400">{tr("Safe to spend today")}</span>
        <b className={"tabular-nums " + (s.short > 0 ? "text-amber-300" : "text-teal-300")} data-testid="safe-today">{s.cur} {fmt(s.today)}</b>
        <span className="flex-1 min-w-0 truncate text-[11.5px] text-slate-500">{line}</span>
        {open ? <ChevronUp size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
      </button>
      {open ? <div className="pt-2 text-slate-300"><Details s={s} setCushion={setCushion} /></div> : null}
    </div>);
}
