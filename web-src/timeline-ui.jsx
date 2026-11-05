/* ---- v6.38 (upgrade M3) — Follow-ups → Timeline: everything coming up on one list by day — reminders, dates, People & plans
   payments, bills, debts and the promises people made in chats — each with "what slips if you skip this" and a tap that opens
   the page that owns it. Code only (timeline.js), from the same stores those pages keep. */
import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Bell, Radar, Users, Wallet, MessageSquare, AlertTriangle, ShieldCheck as ShieldAlert, Plus, Check, ChevronLeft, ChevronRight, SlidersHorizontal as MoreHorizontal } from "lucide-react";
import { tr, getLang, dateLocale } from "./i18n.js";
import { timeline, byDay, totals, daysFrom, GROUP_OF, weekDays, searchItems, byDayLate } from "./timeline.js";
import { PersonAsk } from "./home-ui.jsx";
import { findings as guardianFindings, loadGuardian, saveGuardian, collected } from "./guardian.js";
import { loadLife, saveLife, payAmount, progressOf } from "./life.js";
import { PayBox } from "./life-ui.jsx";
import { loadReminders } from "./actions.js";
import { fmt } from "./money-calm.js";
import * as U from "./ui-kit.jsx";

const j = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } };
const ICON = { reminders: Bell, radar: Radar, life: Users, money: Wallet, xray: MessageSquare, guardian: ShieldAlert };
// v8.2 (Ali picked 1A): the chips on top — All · Money · Reminders · Dates · Guardian
const CHIPS = [["all", "All"], ["money", "Money"], ["reminders", "Reminders"], ["dates", "Dates"], ["guardian", "Guardian"]];
// the parts' own pages [page, name, the chip it belongs to]
const PAGES = [["life", "People & plans", "money"], ["reminders", "Reminders", "reminders"], ["radar", "Dates", "dates"], ["xray", "Chat X-Ray", ""], ["guardian", "Guardian", "guardian"]];
const KIND = { reminder: "Reminder", trial: "Free trial", renewal: "Renewal", return: "Return window", warranty: "Warranty", expiry: "Document expiry", other: "Date",
  pay: "You pay", collect: "Comes in", bill: "Bill", owe: "You owe", owed: "Owed to you", promise: "Promise", guardian: "Guardian" };
const RANGES = [[7, "7 days"], [30, "30 days"], [90, "3 months"]];

function dayLabel(date) {
  const n = daysFrom(date);
  if (n === 0) return tr("Today");
  if (n === 1) return tr("Tomorrow");
  if (n < 0) return tr("{n} days late", { n: -n });
  try { return new Date(date + "T12:00:00").toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short" }); } catch (e) { return date; }
}
const money = (x) => (x.amount ? (x.cur ? x.cur + " " : "") + fmt(x.amount) : "");

const isoOf = (t) => { const x = new Date(t); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
/** v9.6 (Ali picked F4 + F1): the week on top — a dot on a day with something due, a red one when money goes out; ‹ › moves a week;
 *  a tap on a day jumps the list to it. */
function WeekStrip({ list, week, setWeek, pick, picked }) {
  const start = isoOf(Date.now() + week * 7 * 86400000), days = weekDays(list, start), today = isoOf(Date.now());
  const nav = "w-9 h-9 shrink-0 grid place-items-center rounded-full border border-[var(--c-ln)] bg-[var(--c-surf)] text-[var(--c-ink)] disabled:opacity-30";
  return <div className="flex items-center gap-1.5" data-testid="fu-week">
    <button className={nav} onClick={() => setWeek(week - 1)} disabled={week <= -2} aria-label={tr("Previous week")} data-testid="fu-week-prev"><ChevronLeft size={16} className="rtl:-scale-x-100" /></button>
    <div className="grid grid-cols-7 gap-1 flex-1 min-w-0">
      {days.map((d) => { const dt = new Date(d.date + "T12:00:00"), on = d.date === (picked || today);
        return <button key={d.date} onClick={() => pick(d.date)} data-testid="fu-week-day" data-date={d.date} aria-pressed={on}
          className={"rounded-[14px] py-1.5 flex flex-col items-center min-w-0 " + (on ? "bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))]" : "bg-[var(--c-surf)] text-[var(--c-ink)] border border-[var(--c-ln)]")}>
          <span className="text-[10.5px] font-bold opacity-80 truncate max-w-full">{dt.toLocaleDateString(dateLocale(), { weekday: "short" })}</span>
          <b className="text-[15px] leading-tight tabular-nums">{dt.getDate()}</b>
          <i className="block w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: d.count ? (on ? "var(--c-on-acc)" : d.pays ? "var(--c-neg)" : "var(--c-acc)") : "transparent" }} data-testid={d.count ? (d.pays ? "fu-dot-pay" : "fu-dot") : undefined} />
        </button>; })}
    </div>
    <button className={nav} onClick={() => setWeek(week + 1)} disabled={week >= 12} aria-label={tr("Next week")} data-testid="fu-week-next"><ChevronRight size={16} className="rtl:-scale-x-100" /></button>
  </div>;
}

export function TimelinePage({ navTo, doIt, flash }) {
  const [week, setWeek] = useState(0);
  const [picked, setPicked] = useState(null);
  const [more, setMore] = useState(false);
  const days = Math.max(30, (week + 1) * 7 + 1);
  const [v, setV] = useState(0);
  const [chip, setChip] = useState("all");
  const [say, setSay] = useState("");
  const [pay, setPay] = useState(null);   // { key, i, v } — v8.3: what really came for this payment
  useEffect(() => { const on = () => { if (document.visibilityState === "visible") setV((x) => x + 1); }; document.addEventListener("visibilitychange", on); return () => document.removeEventListener("visibilitychange", on); }, []);
  const all = useMemo(() => {
    const ledger = j("ledger.v3", null), life = j("attune:life:v1", null);
    let guardian = []; try { guardian = guardianFindings({ ledger, life, dismissed: (loadGuardian().dismissed || []), lang: getLang() }); } catch (e) {}
    return timeline({ reminders: loadReminders(), radar: j("attune:radar:v1", null), life, ledger, xray: j("attune:xray:v1", []), guardian, days });
  }, [days, v]);
  const count = (c) => (c === "all" ? all.length : all.filter((x) => GROUP_OF[x.kind] === c).length);
  // v9.6: one box searches the list as you type (and adds what you send); the kind filter sits behind ⋯
  const list = searchItems(chip === "all" ? all : all.filter((x) => GROUP_OF[x.kind] === chip), say);
  const groups = byDayLate(list), t = totals(list), late = list.filter((x) => x.late).length;
  const pick = (d) => { setPicked(d); setTimeout(() => { try { const el = document.querySelector('[data-day="' + d + '"]'); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); else flash && flash(tr("Nothing due that day")); } catch (e) {} }, 30); };
  // one sentence adds anything — the same reader as Home's box (a payment plan, a reminder, a date, an agent…)
  const add = (t0) => {
    const text = (t0 != null ? t0 : say).trim(); if (!text || !doIt) return false;
    let r = null; try { r = doIt(text); } catch (e) {}
    // v8.6 (persona 5: "call mom tomorrow at 6pm" here said "I couldn't read that"): on Follow-ups, anything with a day or a time is a
    // reminder even without "remind me"
    if (!r && /\b(today|tonight|tomorrow|mon|tue|wed|thu|fri|sat|sun)\w*\b|\b\d{1,2}\s*(am|pm)\b|\d{1,2}:\d{2}|النهارده|بكره|بكرة|الساعه|الساعة|السبت|الحد|الاتنين|التلات|الاربع|الخميس|الجمعه|الجمعة/i.test(text)) { try { r = doIt((/[\u0600-\u06ff]/.test(text) ? "فكرني " : tr("remind me ")) + text); } catch (e) {} }
    if (r && r.lines && r.lines.length) { flash && flash(r.lines.map((x) => x.text).join(" · ")); setSay(""); setV((x) => x + 1); }
    else if (r && r.answer) flash && flash(r.answer);
    else { flash && flash(tr("I couldn't read that — try: “Ahmed owes me 12,000, 1,000 a month” or “remind me Sunday at 5 to call the client”")); return false; }
  };
  // a payment with someone: tick it here when it is paid
  const lifeOf = (x) => { const [, id, i] = x.id.split(":"); const c = (loadLife().items || []).find((y) => y.id === id); return c ? { c, i: +i } : null; };
  const paid = (c, i, v) => {
    const d = payAmount(loadLife(), c.id, i, v); saveLife(d); setV((y) => y + 1); setPay(null);
    // (as on People & plans: a late payment that came back counts as saved by the Guardian)
    if (c.dir === "in") { try { saveGuardian(collected(loadGuardian(), c.id, i, v)); } catch (e) {} }
    const pr = progressOf(d.items.find((y) => y.id === c.id));
    flash && flash(pr.left > 0.004 ? tr("Recorded {a} — {l} left, next {d}: {n}", { a: fmt(v), l: fmt(pr.left), d: pr.next ? pr.next.date : "—", n: pr.next ? fmt(pr.next.amount) : "—" }) : tr("Recorded {a} — all paid", { a: fmt(v) }));
  };
  const sum = (o) => Object.entries(o).map(([c, a]) => (c ? c + " " : "") + fmt(a)).join(" · ");
  return (
    <div className={U.page + " rounded-[20px] p-4 md:p-6 space-y-4 lg:max-w-[80ch]"} style={{ minHeight: "70vh" }} data-testid="timeline-page">
      <div className="flex items-start gap-3"><span className="w-11 h-11 rounded-[12px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] shrink-0"><CalendarDays size={18} /></span>
        <div className="min-w-0"><h2 className={U.h1}>{tr("Follow-ups")}</h2>
          <p className={"m-0 mt-0.5 text-[13px] " + U.muted}>{tr("Everything you must pay, collect, remember or watch — on one list.")}</p></div></div>
      {/* v8.7 (Ali picked P5-C): the same box as Home and every page — only the hint is Follow-ups' */}
      {doIt ? <U.PageBox value={say} setValue={setSay} onSend={(t) => add(t)} hint={tr("Add anything — “Ahmed owes me 12,000, 1,000 a month”")} sendLabel={tr("Add")}
        ids={{ box: "fu-add-form", input: "fu-add", go: "fu-add-go" }} /> : null}
      <WeekStrip list={all} week={week} setWeek={setWeek} pick={pick} picked={picked} />
      {/* v9.6 (Ali: "follow-ups are scattered"): the kind filter and the parts' own pages wait behind ⋯ */}
      <div className="flex items-center gap-2">
        <button onClick={() => setMore(!more)} aria-expanded={more} className={U.chip(more || chip !== "all") + " inline-flex items-center gap-1"} data-testid="fu-more"><MoreHorizontal size={14} />{chip === "all" ? tr("Show") : tr(CHIPS.find((c) => c[0] === chip)[1])}</button>
      </div>
      {more ? <div className="space-y-2" data-testid="fu-more-panel">
        <div className="flex flex-wrap items-center gap-1.5" data-testid="fu-chips">
          {CHIPS.map(([c, l]) => <button key={c} onClick={() => setChip(c)} aria-pressed={chip === c} className={U.chip(chip === c)} data-testid={"fu-chip-" + c}>{tr(l)} {count(c)}</button>)}
        </div>
        {navTo ? <div className={"flex flex-wrap items-center gap-1.5 text-[12.5px] " + U.muted} data-testid="fu-pages">
          <span>{tr("Open:")}</span>
          {PAGES.map(([pg, l]) => <button key={pg} onClick={() => navTo(pg)} className="min-h-[36px] px-3 rounded-full border border-[var(--c-ln)] bg-[var(--c-surf)] text-[12.5px] font-bold text-[var(--c-ink)]" data-testid={"fu-open-" + pg}>{tr(l)} ›</button>)}
        </div> : null}
      </div> : null}
      {list.length ? (
        <p className="text-[13.5px] font-semibold m-0 tabular-nums" data-testid="timeline-sum">
          {late ? <span className="text-[var(--c-neg)] font-extrabold">{tr("{n} late", { n: late })} · </span> : null}
          {Object.keys(t.out).length ? <span>{tr("Going out: {a}", { a: sum(t.out) })}</span> : null}
          {Object.keys(t.in).length ? <span>{Object.keys(t.out).length ? " · " : ""}{tr("Coming in: {a}", { a: sum(t.in) })}</span> : null}
        </p>) : null}
      {/* v8.7 (Ali picked V-D): with nothing at all yet (no people & plans, reminders or dates), a friendly start with examples */}
      {!list.length && doIt && (() => { try { return !(loadLife().items || []).length && !loadReminders().length && !((JSON.parse(localStorage.getItem("attune:radar:v1") || "null") || {}).items || []).length; } catch (e) { return false; } })()
        ? <U.EmptyStart testid="timeline-start" title={tr("Nothing to follow yet")} sub={tr("Debts, installments, renewals and reminders — write one and Attune keeps the dates.")}
            examples={getLang() === "ar" ? ["أحمد عليه 12,000، ألف كل شهر", "نتفليكس بيتجدد يوم 5", "فكرني أدفع النت يوم 1"] : ["Ahmed owes me 12,000, 1,000 a month", "Netflix renews on the 5th", "remind me to pay the internet on the 1st"]}
            onPick={(x) => setSay(x)} />
      : !list.length ? <p className={"text-[14px] " + U.muted} data-testid="timeline-empty">{tr("Nothing coming up. Add a reminder, a date (a trial, a renewal, a warranty), a payment with someone, or X-ray a chat — it all shows here.")}</p> : null}
      <div className="space-y-4">
        {groups.map((g) => (
          <section key={g.date} data-testid="timeline-day" data-day={g.date} style={{ scrollMarginTop: 72 }}>
            <h3 className={"text-[12px] font-extrabold uppercase tracking-[0.08em] m-0 mb-1.5 " + (g.date === "late" ? "text-[var(--c-neg)]" : g.date === picked ? "text-[var(--c-acc)]" : "text-[var(--c-mut)]")}>{g.date === "late" ? tr("Late") : dayLabel(g.date)}</h3>
            <ul className="m-0 p-0 list-none space-y-1.5">
              {g.items.map((x) => { const I = ICON[x.page] || Bell; return (
                <li key={x.id}>
                  <button onClick={() => navTo && navTo(x.page)} className={U.card + " w-full text-start p-3.5 min-h-[56px] flex items-start gap-3 hover:border-[var(--c-acc)]"} data-testid="timeline-item" data-kind={x.kind}>
                    <span className="w-9 h-9 rounded-[12px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] shrink-0"><I size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-[14.5px] font-extrabold truncate" dir="auto">{x.T ? tr(x.T[0], x.T[1]) : x.what}</span>
                        {x.amount ? <span className="tabular-nums font-extrabold text-[13.5px] shrink-0" dir="ltr">{money(x)}</span> : null}
                      </span>
                      <span className={"block text-[12px] " + U.muted}>{tr(KIND[x.kind] || x.kind)}{x.time ? " · " + new Date(x.time).toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" }) : ""}</span>
                      <span className={"block text-[12px] mt-0.5 " + (x.late ? "font-bold text-[var(--c-neg)]" : U.muted)} data-testid="timeline-slip">
                        {x.late ? <AlertTriangle size={12} className="inline me-1 -mt-0.5" /> : null}
                        {x.D ? tr(x.D[0], x.D[1]) + " — " : ""}{tr(x.slip[0], { amount: money(x) || "", who: x.who || "" })}</span>
                    </span>
                  </button>
                  {x.page === "life" && /^p:/.test(x.id) && ["debt", "installment"].includes(x.ck) && daysFrom(x.date) <= 0 && lifeOf(x) && lifeOf(x).c.person
                    ? <div className="ms-12">{(() => { const l = lifeOf(x); return <PersonAsk x={{ amount: x.amount, title: x.what, late: x.late, ask: { id: l.c.id, i: l.i, cur: l.c.currency, person: l.c.person, dir: l.c.dir } }} onDone={(m) => { flash && flash(m); setV((y) => y + 1); }} />; })()}</div>
                  : x.page === "life" && /^p:/.test(x.id) && ["debt", "installment", "circle"].includes(x.ck) ? <button onClick={() => { const l = lifeOf(x); if (l) setPay({ key: x.id, c: l.c, i: l.i, v: String(x.amount) }); }} className="mt-1 ms-12 min-h-[36px] px-3 rounded-[12px] border border-[var(--c-ln)] text-[12.5px] font-bold inline-flex items-center gap-1.5" data-testid="fu-tick"><Check size={14} />{tr(x.kind === "collect" ? "Got it — mark as paid" : "Paid — tick it")}</button> : null}
                  {pay && pay.key === x.id ? <div className="ms-12"><PayBox c={pay.c} ed={{ i: pay.i, v: pay.v }} setEd={(e) => (e ? setPay({ ...pay, v: e.v }) : setPay(null))} onPay={paid} /></div> : null}
                </li>); })}
            </ul>
          </section>))}
      </div>
    </div>);
}
