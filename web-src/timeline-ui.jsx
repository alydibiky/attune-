/* ---- v9.9: FU6 — Attune asks, you answer (the FU1 page is in archive/followups-fu1/). Before: v6.38 (upgrade M3) — Follow-ups → Timeline: everything coming up on one list by day — reminders, dates, People & plans
   payments, bills, debts and the promises people made in chats — each with "what slips if you skip this" and a tap that opens
   the page that owns it. Code only (timeline.js), from the same stores those pages keep. */
import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Bell, Radar, Users, Wallet, MessageSquare, AlertTriangle, ShieldCheck as ShieldAlert, Plus, Check, ChevronLeft, ChevronRight, SlidersHorizontal as MoreHorizontal } from "lucide-react";
import { tr, getLang, dateLocale } from "./i18n.js";
import { timeline, byDay, totals, daysFrom, GROUP_OF, weekDays, searchItems, byDayLate, feedOf, actionOf } from "./timeline.js";
import { tickRegular } from "./regular.js";
import { PersonAsk } from "./home-ui.jsx";
import { findings as guardianFindings, loadGuardian, saveGuardian, collected } from "./guardian.js";
import { loadLife, saveLife, payAmount, progressOf, skipDay } from "./life.js";
import { PayBox } from "./life-ui.jsx";
import { loadReminders } from "./actions.js";
import { fmt } from "./money-calm.js";
import * as U from "./ui-kit.jsx";
import { NoteAskCard, LearnedButton, currentAsks } from "./notelabels-ui.jsx";
import { PayerAsk, PaidStep } from "./payer-ui.jsx";   // v9.9.13 who pays a subscription added by itself   // v9.9.11 A1 + L (Ali: "ask me, I tell it, it remembers")

const j = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } };
const ICON = { reminders: Bell, radar: Radar, life: Users, money: Wallet, xray: MessageSquare, guardian: ShieldAlert };
// v8.2 (Ali picked 1A): the chips on top — All · Money · Reminders · Dates · Guardian
const CHIPS = [["all", "All"], ["money", "Money"], ["reminders", "Reminders"], ["dates", "Dates"], ["guardian", "Guardian"]];
// the parts' own pages [page, name, the chip it belongs to]
const PAGES = [["life", "People & plans", "money"], ["reminders", "Reminders", "reminders"], ["errands", "Errands", "reminders"], ["radar", "Dates", "dates"], ["xray", "Chat X-Ray", ""], ["guardian", "Guardian", "guardian"]];
const KIND = { errand: "Errand", reminder: "Reminder", trial: "Free trial", renewal: "Renewal", return: "Return window", warranty: "Warranty", expiry: "Document expiry", other: "Date",
  pay: "You pay", collect: "Comes in", bill: "Bill", owe: "You owe", owed: "Owed to you", promise: "Promise", guardian: "Guardian" };
const T2 = (k, v) => tr(k, v);
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
    return timeline({ reminders: loadReminders(), radar: j("attune:radar:v1", null), life, ledger, xray: j("attune:xray:v1", []), guardian, errands: j("attune:errands:v1", []), days });
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
  // v9.8 FU1 (Ali picked "one feed: Today · This week · Later"): every item ticked the same way, nothing else to open
  const [doneSet, setDoneSet] = useState(() => new Set(j("attune:fu:done", [])));
  const markDone = (key) => { const n = new Set(doneSet); n.add(key); setDoneSet(n); try { localStorage.setItem("attune:fu:done", JSON.stringify([...n].slice(-300))); } catch (e) {} };
  const [asking, setAsking] = useState("");
  const [paying, setPaying] = useState("");   // v9.9.16 OK3: the payment whose "Paid" is asking balance + category
  const shown = list.filter((x) => !doneSet.has(x.id + "@" + x.date));
  const feed = feedOf(shown);
  const tick = (x) => {
    const act = actionOf(x);
    if (act === "pay") { const l = lifeOf(x); if (!l) return; const r = tickRegular(l.c.id, l.i, true); setV((y) => y + 1);
      flash && flash(r && r.recorded ? tr("Recorded in Money: {a} {cur} — {t}", { a: fmt(r.recorded), cur: l.c.currency || "", t: x.what }) : tr("Done")); return; }
    if (act === "ask") { setAsking(asking === x.id ? "" : x.id); return; }
    if (act === "done") { markDone(x.id + "@" + x.date); flash && flash(tr("Done")); return; }
    if (act === "errand") { navTo && navTo("errands"); return; }
    navTo && navTo(x.page);
  };
  // ---- v9.9 FU6 (Ali picked "Attune asks, you answer", 8 Nov): one short question for each thing that needs you, answered with one
  // button (or by voice / the box); each answer is done at once, with Undo. What's coming is one line below; the box adds AND changes
  // anything in your words ("the maid is now taking 700" — lifeedit.js).
  const [log, setLog] = useState([]);   // [{ id, q, a, msg, undo }] — what was answered on this visit, newest last
  const [allOpen, setAllOpen] = useState(false);
  const today = isoOf(Date.now());
  const snoozeKey = (x) => x.id + "@" + x.date + "@" + today;
  const qs = feed.today.filter((x) => !doneSet.has(snoozeKey(x)) && !log.some((l) => l.id === x.id + "@" + x.date));
  // v9.9.11 A1: what Attune isn't sure about in your notifications — asked here, once per chat / app
  const [asks, setAsks] = useState(() => { try { return currentAsks(); } catch (e) { return []; } });
  const coming = [...feed.week, ...feed.later];
  const answer = (x, a, msg, undo) => { setLog((l) => [...l, { id: x.id + "@" + x.date, q: qText(x), a, msg, undo }]); setV((y) => y + 1); };
  const who = (x) => (x.who || x.what || "").split(" · ")[0];
  function qText(x) {
    const act = actionOf(x);
    if (act === "pay" && x.ck === "regular") return x.date === today ? tr("Did {w} come today?", { w: x.what }) : tr("Did {w} come on {d}?", { w: x.what, d: new Date(x.date + "T12:00:00").toLocaleDateString(dateLocale(), { weekday: "long", day: "numeric", month: "short" }) });
    if (act === "pay") { const l = lifeOf(x), c = l && l.c;   // v9.9.14: someone else pays it / nobody set → ask about THEM, Money stays as it is
      if (c && c.payer && c.payer !== "me") return c.payer === "none" ? tr("{w} renews today — was it paid?", { w: x.what }) : tr("{w} renews today — did {p} pay it?", { w: x.what, p: c.payer });
      if (c && c.planned) return tr("Did you pay {w}?", { w: c.person || c.title || x.what });   // v9.9.16 OK3: "Did you pay Ahmed?" (the amount is on the line under it)
      return tr("Did you pay {w}?", { w: x.what }); }
    if (act === "ask") return tr("Did {w} pay?", { w: who(x) });
    if (act === "done") return x.what;
    return x.T ? tr(x.T[0], x.T[1]) : x.what;
  }
  const snooze = (x) => markDone(snoozeKey(x));
  const came = (x) => { const l = lifeOf(x); if (!l) return; const r = tickRegular(l.c.id, l.i, true);
    answer(x, x.ck === "regular" ? tr("Came ✓") : tr("Paid"), r && r.recorded ? tr("{a} out of Money", { a: fmt(r.recorded) }) : l.c.payer && l.c.payer !== "me" ? tr("Done — your balance stays the same") : tr("Done"), () => { tickRegular(l.c.id, l.i, false); setV((y) => y + 1); }); };
  const didnt = (x) => { const l = lifeOf(x); if (!l) return; saveLife(skipDay(loadLife(), l.c.id, l.i, true));
    answer(x, tr("Didn't come"), tr("Nothing paid"), () => { saveLife(skipDay(loadLife(), l.c.id, l.i, false)); setV((y) => y + 1); }); };
  const later = (x, label) => { snooze(x); answer(x, label, tr("I'll ask again tomorrow"), () => { const n = new Set(doneSet); n.delete(snoozeKey(x)); setDoneSet(n); try { localStorage.setItem("attune:fu:done", JSON.stringify([...n])); } catch (e) {} setV((y) => y + 1); }); };
  const did = (x) => { markDone(x.id + "@" + x.date); answer(x, tr("Done"), tr("Done"), () => { const n = new Set(doneSet); n.delete(x.id + "@" + x.date); setDoneSet(n); try { localStorage.setItem("attune:fu:done", JSON.stringify([...n])); } catch (e) {} setV((y) => y + 1); }); };
  // the box: add or change anything — the answer shows in the thread
  const say2 = (t0) => { const text = String(t0 || "").trim(); if (!text || !doIt) return false;
    let r = null; try { r = doIt(text); } catch (e) {}
    // v9.9.4 M1: not sure → the question in the thread, Save / Not this — nothing saved before Save
    if (r && r.confirm) { setLog((l) => [...l, { id: "say:" + Date.now(), q: "", a: text, msg: getLang() === "ar" ? r.confirm.q.ar : r.confirm.q.en, confirm: text }]); setSay(""); return true; }
    if (!r && /\b(today|tonight|tomorrow|mon|tue|wed|thu|fri|sat|sun)\w*\b|\b\d{1,2}\s*(am|pm)\b|\d{1,2}:\d{2}|النهارده|بكره|بكرة|الساعه|الساعة/i.test(text)) { try { r = doIt((/[\u0600-\u06ff]/.test(text) ? "فكرني " : tr("remind me ")) + text); } catch (e) {} }
    const ans = r && r.answer ? (typeof r.answer === "string" ? r.answer : (getLang() === "ar" ? r.answer.ar : r.answer.en)) : "";
    if (r && r.lines && r.lines.length) { setLog((l) => [...l, { id: "say:" + Date.now(), q: "", a: text, msg: r.lines.map((x) => x.text).join(" · "), undo: r.undo ? () => { r.undo(); setV((y) => y + 1); } : null }]); setSay(""); setV((y) => y + 1); return true; }
    if (ans) { setLog((l) => [...l, { id: "say:" + Date.now(), q: "", a: text, msg: ans, undo: null }]); setSay(""); return true; }
    flash && flash(tr("I couldn't read that — try: “the maid is now taking 700” or “remind me Sunday at 5 to call the client”")); return false; };
  const B = "min-h-[38px] px-3.5 rounded-[12px] text-[13px] font-extrabold border border-[var(--c-ln)] bg-[var(--c-surf)] text-[var(--c-ink)]";
  const BP = "min-h-[38px] px-3.5 rounded-[12px] text-[13px] font-extrabold bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))]";
  const bubble = "rounded-[18px] rounded-es-[6px] px-3.5 py-2.5 bg-[var(--c-soft)] max-w-[92%]";
  const nextUp = coming[0];
  const tone = (x) => (x.kind === "collect" || x.kind === "owed" ? "c-pos" : ["pay", "bill", "owe"].includes(x.kind) ? "c-neg" : "");
  return (
    <div className={U.page + " rounded-[20px] p-4 md:p-6 space-y-3 lg:max-w-[80ch]"} style={{ minHeight: "70vh" }} data-testid="timeline-page">
      <div className="flex items-start gap-3"><span className="w-11 h-11 rounded-[12px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] shrink-0"><CalendarDays size={18} /></span>
        <div className="min-w-0 flex-1"><h2 className={U.pageH1}>{tr("Follow-ups")}</h2>
          <p className={"m-0 mt-0.5 text-[13px] " + U.muted} data-testid="fu-count">{qs.length + asks.length ? tr("Today · {n} to answer", { n: qs.length + asks.length }) : tr("Today")}</p></div></div>
      <div className="flex flex-col gap-2" data-testid="fu-thread">
        {log.map((l) => <React.Fragment key={l.id}>
          {l.q ? <div className={bubble + " opacity-70"}><span className="text-[14px] font-bold" dir="auto">{l.q}</span></div> : null}
          <div className="self-end rounded-[18px] rounded-ee-[6px] px-3.5 py-2 bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] text-[14px] font-bold max-w-[85%]" dir="auto" data-testid="fu-me">{l.a}</div>
          {l.confirm ? <div className={bubble} data-testid="fu-confirm"><p className="m-0 text-[14px] font-bold" dir="auto">{l.msg}</p>
            <div className="flex gap-1.5 mt-2"><button className={BP} onClick={() => { let r2 = null; try { r2 = doIt(l.confirm, { force: true }); } catch (e) {} setLog((g) => g.map((y) => (y.id === l.id ? { ...y, confirm: "", msg: r2 && r2.lines && r2.lines.length ? r2.lines.map((x) => x.text).join(" · ") : tr("Done"), undo: r2 && r2.undo ? () => { r2.undo(); setV((v) => v + 1); } : null } : y))); setV((v) => v + 1); }} data-testid="fu-confirm-yes">{tr("Save")}</button>
              <button className={B} onClick={() => setLog((g) => g.map((y) => (y.id === l.id ? { ...y, confirm: "", msg: tr("Not saved") } : y)))} data-testid="fu-confirm-no">{tr("Not this")}</button></div></div> :
          <p className="m-0 self-center text-[12.5px] font-bold text-[var(--c-pos)] text-center" data-testid="fu-result" dir="auto">{l.msg}{l.undo ? <> · <button className="underline" onClick={() => { l.undo(); setLog((g) => g.filter((y) => y.id !== l.id)); }} data-testid="fu-undo">{tr("Undo")}</button></> : null}</p>}
        </React.Fragment>)}
        <PayerAsk flash={flash} onDone={(m) => setLog((l) => [...l, { id: "payer:" + Date.now(), q: "", a: tr("Who pays it?"), msg: m, undo: null }])} />
        {asks.map((a) => <div key={a.id} className={bubble} data-testid="fu-q" data-act="note-ask">
          <NoteAskCard ask={a} flash={flash} onDone={(m) => { setAsks((x) => x.filter((y) => y.id !== a.id)); if (m) setLog((l) => [...l, { id: "na:" + a.id, q: "", a: a.src.name, msg: m, undo: null }]); }} /></div>)}
        {qs.map((x) => { const act = actionOf(x), l = act === "ask" ? lifeOf(x) : null;
          return <div key={x.id + "@" + x.date} className={bubble} data-testid="fu-q" data-act={act || "open"} data-kind={x.kind}>
            {act === "ask" && l && l.c.person
              ? <PersonAsk x={{ amount: x.amount, title: x.what + (x.late ? " · " + tr("Late") : ""), late: x.late, ask: { id: l.c.id, i: l.i, cur: l.c.currency, person: l.c.person, dir: l.c.dir } }} onDone={(m) => answer(x, m.startsWith(tr("I'll ask again tomorrow")) ? tr("Not yet") : tr("Paid"), m, null)} />
              : <>
                <p className="m-0 text-[14.5px] font-bold" dir="auto">{qText(x)}{x.amount ? <span className={"ms-1.5 text-[12.5px] tabular-nums " + U.muted} dir="ltr">· {money(x)}</span> : null}</p>
                {x.late || (!act && x.slip) ? <p className={"m-0 text-[12px] " + (x.late ? "text-[var(--c-neg)] font-bold" : U.muted)} dir="auto">{x.late ? tr("Late") + " · " + dayLabel(x.date) : ""}{!act && x.slip && x.ck !== "regular" ? (x.late ? " — " : "") + (x.D ? tr(x.D[0], x.D[1]) + " — " : "") + tr(x.slip[0], { amount: money(x) || "", who: x.who || "" }) : ""}</p> : null}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {act === "pay" && paying === x.id + "@" + x.date ? (() => { const l = lifeOf(x); return l ? <PaidStep c={l.c} i={l.i} onCancel={() => setPaying("")}
                    onDone={(r) => { setPaying(""); answer(x, tr("Paid"), r.recorded ? tr("Recorded in Money: {a} {cur} — {t}", { a: fmt(r.recorded), cur: l.c.currency || "", t: [r.account, r.cat].filter(Boolean).join(" · ") }) : tr("Done"), () => { r.undo(); setV((y) => y + 1); }); }} /> : null; })()
                  : act === "pay" ? <><button className={BP} onClick={() => { const l = lifeOf(x); if (l && l.c.planned && !(l.c.payer && l.c.payer !== "me")) setPaying(x.id + "@" + x.date); else came(x); }} data-testid="fu-yes">{x.ck === "regular" ? tr("Came ✓") : tr("Paid")}</button>
                    {x.ck === "regular" ? <button className={B} onClick={() => didnt(x)} data-testid="fu-no">{tr("Didn't come")}</button> : <button className={B} onClick={() => later(x, tr("Not yet"))} data-testid="fu-no">{tr("Not yet")}</button>}</> : null}
                  {act === "done" ? <><button className={BP} onClick={() => did(x)} data-testid="fu-yes">{tr("Done")}</button><button className={B} onClick={() => later(x, tr("Tomorrow"))} data-testid="fu-no">{tr("Tomorrow")}</button></> : null}
                  {act === "errand" ? <button className={BP} onClick={() => navTo && navTo("errands")} data-testid="fu-open">{tr("Open")}</button> : null}
                  {!act ? <><button className={BP} onClick={() => navTo && navTo(x.page)} data-testid="fu-open">{tr("Open")}</button><button className={B} onClick={() => later(x, tr("Later"))} data-testid="fu-no">{tr("Later")}</button></> : null}
                </div></>}
          </div>; })}
        {!qs.length && !asks.length ? <div className={bubble} data-testid="fu-clear"><p className="m-0 text-[14.5px] font-bold">{nextUp ? tr("All clear until {d}", { d: dayLabel(nextUp.date) }) : tr("All clear")}</p>
          {!shown.length && !log.length ? <p className={"m-0 mt-1 text-[12.5px] " + U.muted}>{tr("Write a payment, a date or a reminder below — Attune asks you when it's due.")}</p> : null}</div> : null}
      </div>
      {coming.length ? <section className={U.card + " p-3"} data-testid="fu-coming">
        <button onClick={() => setAllOpen(!allOpen)} className="w-full text-start text-[13px]" aria-expanded={allOpen} data-testid="fu-coming-toggle">
          <b>{tr("Coming:")}</b> <span dir="auto">{coming.slice(0, 4).map((x) => x.what + (x.amount ? " " + fmt(x.amount) : "") + " · " + dayLabel(x.date)).join(" — ")}</span>
          <span className={"ms-1 " + U.muted}>{allOpen ? tr("Hide") : tr("See all ({n})", { n: coming.length })}</span></button>
        {allOpen ? <ul className="m-0 mt-2 p-0 list-none" data-testid="fu-coming-all">
          {coming.map((x) => { const I = ICON[x.page] || Bell; return <li key={x.id + "@" + x.date} className="border-t border-[var(--c-ln)]" data-testid="timeline-item" data-kind={x.kind}>
            <button onClick={() => navTo && navTo(x.kind === "errand" ? "errands" : x.page)} className="w-full flex items-center gap-2.5 py-2 text-start">
              <I size={14} className="shrink-0 text-[var(--c-acc)]" />
              <span className="flex-1 min-w-0"><span className="block text-[13.5px] font-bold break-words" dir="auto">{x.T ? tr(x.T[0], x.T[1]) : x.what}</span>
                <span className={"block text-[11.5px] " + U.muted}>{dayLabel(x.date)} · {tr(KIND[x.kind] || x.kind)}</span></span>
              {x.amount ? <b className={"tabular-nums text-[13px] shrink-0 " + tone(x)} dir="ltr">{money(x)}</b> : null}</button></li>; })}
        </ul> : null}
      </section> : null}
      {doIt ? <U.PageBox value={say} setValue={setSay} onSend={(t) => say2(t)} hint={tr("Say or type it — “the maid is now 700”")} sendLabel={tr("Send")}
        ids={{ box: "fu-add-form", input: "fu-add", go: "fu-add-go" }} /> : null}
      {navTo ? <div className={"flex flex-wrap items-center gap-1.5 text-[12.5px] pt-1 " + U.muted} data-testid="fu-pages">
        <span>{tr("Manage:")}</span>
        <LearnedButton flash={flash} />
        {PAGES.map(([pg, l]) => <button key={pg} onClick={() => navTo(pg)} className="min-h-[34px] px-3 rounded-full border border-[var(--c-ln)] bg-[var(--c-surf)] text-[12px] font-bold text-[var(--c-ink)]" data-testid={"fu-open-" + pg}>{tr(l)}</button>)}
      </div> : null}
    </div>);
}
