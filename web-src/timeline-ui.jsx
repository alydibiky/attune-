/* ---- v6.38 (upgrade M3) — Follow-ups → Timeline: everything coming up on one list by day — reminders, dates, People & plans
   payments, bills, debts and the promises people made in chats — each with "what slips if you skip this" and a tap that opens
   the page that owns it. Code only (timeline.js), from the same stores those pages keep. */
import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Bell, Radar, Users, Wallet, MessageSquare, AlertTriangle } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { timeline, byDay, totals, daysFrom } from "./timeline.js";
import { loadReminders } from "./actions.js";
import { fmt } from "./money-calm.js";
import * as U from "./ui-kit.jsx";

const j = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } };
const ICON = { reminders: Bell, radar: Radar, life: Users, money: Wallet, xray: MessageSquare };
const KIND = { reminder: "Reminder", trial: "Free trial", renewal: "Renewal", return: "Return window", warranty: "Warranty", expiry: "Document expiry", other: "Date",
  pay: "You pay", collect: "Comes in", bill: "Bill", owe: "You owe", owed: "Owed to you", promise: "Promise" };
const RANGES = [[7, "7 days"], [30, "30 days"], [90, "3 months"]];

function dayLabel(date) {
  const n = daysFrom(date);
  if (n === 0) return tr("Today");
  if (n === 1) return tr("Tomorrow");
  if (n < 0) return tr("{n} days late", { n: -n });
  try { return new Date(date + "T12:00:00").toLocaleDateString(getLang() === "ar" ? "ar-EG" : undefined, { weekday: "short", day: "numeric", month: "short" }); } catch (e) { return date; }
}
const money = (x) => (x.amount ? (x.cur ? x.cur + " " : "") + fmt(x.amount) : "");

export function TimelinePage({ navTo }) {
  const [days, setDays] = useState(30);
  const [v, setV] = useState(0);
  useEffect(() => { const on = () => { if (document.visibilityState === "visible") setV((x) => x + 1); }; document.addEventListener("visibilitychange", on); return () => document.removeEventListener("visibilitychange", on); }, []);
  const list = useMemo(() => timeline({ reminders: loadReminders(), radar: j("attune:radar:v1", null), life: j("attune:life:v1", null), ledger: j("ledger.v3", null), xray: j("attune:xray:v1", []), days }), [days, v]);
  const groups = byDay(list), t = totals(list), late = list.filter((x) => x.late).length;
  const sum = (o) => Object.entries(o).map(([c, a]) => (c ? c + " " : "") + fmt(a)).join(" · ");
  return (
    <div className={U.page + " rounded-[22px] p-4 md:p-6 space-y-4 lg:max-w-[80ch]"} style={{ minHeight: "70vh" }} data-testid="timeline-page">
      <div className="flex items-start gap-3"><span className="w-11 h-11 rounded-[14px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] shrink-0"><CalendarDays size={18} /></span>
        <div className="min-w-0"><h2 className={U.h1}>{tr("Timeline")}</h2>
          <p className={"m-0 mt-0.5 text-[13px] " + U.muted}>{tr("Everything coming up, from every follow-up page, on one list.")}</p></div></div>
      <div className="flex flex-wrap items-center gap-1.5">
        {RANGES.map(([d, l]) => <button key={d} onClick={() => setDays(d)} aria-pressed={days === d} className={U.chip(days === d)} data-testid={"timeline-range-" + d}>{tr(l)}</button>)}
      </div>
      {list.length ? (
        <p className="text-[13.5px] font-semibold m-0 tabular-nums" data-testid="timeline-sum">
          {late ? <span className="text-[var(--c-neg)] font-extrabold">{tr("{n} late", { n: late })} · </span> : null}
          {Object.keys(t.out).length ? <span>{tr("Going out: {a}", { a: sum(t.out) })}</span> : null}
          {Object.keys(t.in).length ? <span>{Object.keys(t.out).length ? " · " : ""}{tr("Coming in: {a}", { a: sum(t.in) })}</span> : null}
        </p>) : null}
      {!list.length ? <p className={"text-[14px] " + U.muted} data-testid="timeline-empty">{tr("Nothing coming up. Add a reminder, a date (a trial, a renewal, a warranty), a payment with someone, or X-ray a chat — it all shows here.")}</p> : null}
      <div className="space-y-4">
        {groups.map((g) => (
          <section key={g.date} data-testid="timeline-day">
            <h3 className={"text-[11px] font-extrabold uppercase tracking-[0.08em] m-0 mb-1.5 " + (g.date < groups[0].date || daysFrom(g.date) < 0 ? "text-[var(--c-neg)]" : "text-[var(--c-mut)]")}>{dayLabel(g.date)}</h3>
            <ul className="m-0 p-0 list-none space-y-1.5">
              {g.items.map((x) => { const I = ICON[x.page] || Bell; return (
                <li key={x.id}>
                  <button onClick={() => navTo && navTo(x.page)} className={U.card + " w-full text-start p-3.5 min-h-[56px] flex items-start gap-3 hover:border-[var(--c-acc)]"} data-testid="timeline-item" data-kind={x.kind}>
                    <span className="w-9 h-9 rounded-[12px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] shrink-0"><I size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-[14.5px] font-extrabold truncate" dir="auto">{x.what}</span>
                        {x.amount ? <span className="tabular-nums font-extrabold text-[13.5px] shrink-0" dir="ltr">{money(x)}</span> : null}
                      </span>
                      <span className={"block text-[12px] " + U.muted}>{tr(KIND[x.kind] || x.kind)}{x.time ? " · " + new Date(x.time).toLocaleTimeString(getLang() === "ar" ? "ar-EG" : undefined, { hour: "numeric", minute: "2-digit" }) : ""}</span>
                      <span className={"block text-[12px] mt-0.5 " + (x.late ? "font-bold text-[var(--c-neg)]" : U.muted)} data-testid="timeline-slip">
                        {x.late ? <AlertTriangle size={12} className="inline me-1 -mt-0.5" /> : null}
                        {tr(x.slip[0], { amount: money(x) || "", who: x.who || "" })}</span>
                    </span>
                  </button>
                </li>); })}
            </ul>
          </section>))}
      </div>
    </div>);
}
