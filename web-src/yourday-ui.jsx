/* ---- v9.3 "Your day" on Home + its Settings (Ali, 5 Nov 2026: D1 A — prayers only when turned on in Settings; A2 A — Ramadan, also
   switched on in Settings, with a box to write anything; notifications → the day; D5 A simple mode; D2 B "safe to spend" on the widget).
   The logic is in yourday.js / daynotes.js / dayset.js (pure, tested); this file only shows it. */
import { allowed } from "./plan.js";
import React, { useEffect, useMemo, useState } from "react";
import { Moon, ListChecks, MessageCircle, Package, Plus, X, Bell, Radar, CalendarDays } from "lucide-react";
import { tr, dateLocale } from "./i18n.js";
import * as U from "./ui-kit.jsx";
import * as Y from "./yourday.js";
import { dayFromNotes, reminderFromAsk, kindOf } from "./daynotes.js";
import { loadDayset, saveDayset } from "./dayset.js";
import { loadAgents } from "./agents.js";
import * as NT from "./noteteach.js";
import { labelOf, hiddenBy } from "./notelabels.js";   // v9.9.11
import { loadDir } from "./entities.js";
import { WhoAskCard } from "./noteteach-ui.jsx";
import { loadReminders, saveReminders, syncToPhone } from "./actions.js";
import { CITIES } from "./fitplus.js";
import { isRamadan } from "./prayer-ui.jsx";

const PRAYER_KEY = "attune:prayer:v1";
const ADDED_KEY = "attune:dayasks:v1";   // asks the person added or dismissed (ids) — shown once
const N = () => (typeof window !== "undefined" ? window.AttuneNative : null);
const readJson = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } };
export const PRAYER_NAMES = { fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };

export function useDayset() {
  const [v, setV] = useState(loadDayset);
  useEffect(() => { const f = () => setV(loadDayset()); window.addEventListener("attune-dayset", f); window.addEventListener("storage", f); return () => { window.removeEventListener("attune-dayset", f); window.removeEventListener("storage", f); }; }, []);
  return [v, (p) => setV(saveDayset({ ...loadDayset(), ...p }))];
}
const prayerCity = () => readJson(PRAYER_KEY, {}).city || "cairo";
const ramadanNow = (now) => { try { if (window.__attuneForceRamadan) return true; } catch (e) {} return isRamadan(new Date(now)); };
const access = () => { const n = N(); try { return !n || !n.payAccess || n.payAccess(); } catch (e) { return true; } };
const timeOf = (t) => { try { return new Date(t).toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };
const dayTime = (t, now) => { const d = new Date(t), n = new Date(now); const same = d.toDateString() === n.toDateString(); const tm = new Date(n); tm.setDate(n.getDate() + 1);
  try { return (same ? tr("today") : d.toDateString() === tm.toDateString() ? tr("tomorrow") : d.toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short" })) + " " + timeOf(t); } catch (e) { return ""; } };

/** The notifications kept on the phone (RecallLog), read again every 5 minutes. */
function useNotes(on, now) {
  const slot = Math.floor(now / 300000);
  return useMemo(() => { if (!on) return []; const n = N(); try { return n && n.recallNotes ? JSON.parse(n.recallNotes() || "[]") : []; } catch (e) { return []; } }, [on, slot]);
}

/** Everything "Your day" adds to Home's To do card: Ramadan, the prayers, agents' news, what your messages say, Close the day. */
export function YourDay({ records = [], navTo, flash: flash0, now: now0 }) {
  const flash = flash0 || ((m) => { try { window.dispatchEvent(new CustomEvent("attune-flash", { detail: m })); } catch (e) {} });
  const [ds] = useDayset();
  const [now, setNow] = useState(() => now0 || Date.now());
  const ram = ds.ramadan && ramadanNow(now);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ram ? 1000 : 60000); return () => clearInterval(t); }, [ram]);
  const [, bump] = useState(0);
  const notes0 = useNotes(ds.notes, now);
  // v9.9.3 L2 + L4: hidden apps ("never show Yazio") are left out; a person you taught about reads as "Your wife (Nada) · …"
  const [tv, setTv] = useState(0);
  useEffect(() => { const f = () => setTv((x) => x + 1); window.addEventListener("attune-noteteach", f); window.addEventListener("attune-people", f); return () => { window.removeEventListener("attune-noteteach", f); window.removeEventListener("attune-people", f); }; }, []);
  const notes = useMemo(() => { const t = NT.loadTeach(); return notes0.filter((n) => !NT.isHidden(n, t) && !hiddenBy(labelOf(n, t))); }, [notes0, tv]);
  const fam = useMemo(() => { const dir = loadDir(), seen = new Set(), out = [];
    for (const n of [...notes].filter((x) => /life ?360|find my|family/i.test(String(x.app || "") + " " + String(x.pkg || "")) && (x.ts || 0) > now - 864e5).sort((a, b) => (b.ts || 0) - (a.ts || 0))) {
      const d = NT.describe(n, dir, { tr }); if (!d || seen.has(d.name)) continue; seen.add(d.name); out.push({ ...d, ts: n.ts, id: n.id }); }
    return out.slice(0, 3); }, [notes, tv, Math.floor(now / 60000)]);
  const day = useMemo(() => dayFromNotes(notes, { now, offApps: ds.offApps, first: NT.firstNames(NT.loadTeach()) }), [notes, Math.floor(now / 60000), ds.offApps.join(), tv]);
  const hidden = new Set(readJson(ADDED_KEY, []));
  const asks = day.asks.filter((a) => !hidden.has(a.id)).slice(0, 3);
  const hide = (id) => { try { localStorage.setItem(ADDED_KEY, JSON.stringify([...hidden, id].slice(-300))); } catch (e) {} bump((x) => x + 1); };
  const addAsk = (a) => { const r = reminderFromAsk(a); const list = [...loadReminders().filter((x) => x.id !== r.id), r]; saveReminders(list); try { syncToPhone(N(), list); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent("attune-lists")); } catch (e) {} hide(a.id); flash && flash(tr("Reminder set: {t}", { t: dayTime(r.at, now) })); };
  const news = useMemo(() => Y.agentNews(loadAgents().agents || [], now), [Math.floor(now / 60000)]);
  const pr = ds.prayers ? Y.prayersToday(prayerCity(), now) : null;
  const evening = Y.isEvening(now, ds.evening);
  const rem = loadReminders(), close = evening && allowed("closeDay") ? Y.closeDay(rem, records, now) : null;   // v9.9.34 FP-4: Close the day is Pro
  const move = () => { const next = Y.moveToTomorrow(loadReminders(), close.movable, now); saveReminders(next); try { syncToPhone(N(), next); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent("attune-lists")); } catch (e) {} bump((x) => x + 1); flash && flash(tr("{n} moved to tomorrow", { n: close.movable.length })); };
  const showNotes = ds.notes && (day.people.length || asks.length || day.arriving.length || fam.length);
  const askAccess = ds.notes && !access();
  return <div className="space-y-2" data-testid="your-day">
    {ram ? <RamadanCard now={now} navTo={navTo} /> : null}
    {pr ? <div className="c-card space-y-2" data-testid="day-prayers">
      <div className="flex items-center gap-2"><span className="text-[12px] font-extrabold tracking-wide c-acc flex-1 uppercase">{tr("Prayer times")} · {tr(CITIES[pr.city].en)}</span>
        <button onClick={() => navTo && navTo("reminders")} className="text-[12.5px] font-extrabold c-acc min-h-[36px] px-1" data-testid="day-plan">{tr("Plan my day")} ›</button></div>
      <div className="grid grid-cols-5 gap-1 text-center">{pr.list.map((x) => <span key={x.k} className={"rounded-[10px] py-1.5 " + (x.k === pr.next ? "bg-[var(--c-soft)] c-acc font-extrabold" : "c-sub")} data-testid={"day-prayer-" + x.k} data-next={x.k === pr.next ? "1" : ""}>
        <span className="block text-[11px]">{tr(PRAYER_NAMES[x.k])}</span><b className="block text-[13px] tabular-nums" dir="ltr">{x.at}</b></span>)}</div>
    </div> : null}
    {close && (close.left || close.done) ? <div className="c-card space-y-1.5" style={{ borderColor: "var(--c-acc)" }} data-testid="day-close">
      <span className="text-[12px] font-extrabold tracking-wide c-acc uppercase flex items-center gap-1.5"><ListChecks size={14} />{tr("Close the day")}</span>
      <b className="block text-[15px]">{tr("Done {a} today · {b} left", { a: close.done, b: close.left })}</b>
      {close.movable.length ? <button onClick={move} className={U.btnP + " h-10! min-h-[40px]!"} data-testid="day-move">{tr("Move {n} to tomorrow", { n: close.movable.length })}</button>
        : <p className="m-0 text-[12.5px] c-sub">{close.left ? tr("Your to-dos stay on Home until you tick them.") : tr("Nothing left — well done.")}</p>}
    </div> : null}
    {news.length ? <div className="c-card space-y-0.5" data-testid="day-agents">
      <span className="text-[12px] font-extrabold tracking-wide c-acc uppercase flex items-center gap-1.5"><Radar size={14} />{tr("Agents")}</span>
      {news.map((x) => <button key={x.id} onClick={() => navTo && navTo("agents")} className="w-full min-h-[44px] flex items-center gap-2 text-start" data-testid="day-agent">
        <span className={U.tag(x.status === "needs" ? "amber" : "blue")}>{tr(x.status === "needs" ? "Needs you" : "Found")}</span>
        <span className="flex-1 min-w-0 truncate text-[13.5px] font-bold" dir="auto">{x.title}</span>
        {x.price ? <b className="text-[13px] tabular-nums shrink-0">{Math.round(x.price).toLocaleString("en-US")}{x.currency ? " " + x.currency : ""}</b> : null}</button>)}
    </div> : null}
    {ds.notes ? <WhoAskCard notes={notes} flash={flash} bump={() => setTv((x) => x + 1)} /> : null}
    {showNotes ? <div className="c-card space-y-1.5" data-testid="day-notes">
      <div className="flex items-center gap-2"><span className="text-[12px] font-extrabold tracking-wide c-acc flex-1 uppercase flex items-center gap-1.5"><MessageCircle size={14} />{tr("From your messages")}</span>
        <button onClick={() => navTo && navTo("recall")} className="text-[12.5px] font-extrabold c-acc min-h-[36px] px-1" data-testid="day-notes-all">{tr("See all")} ›</button></div>
      {fam.map((x) => <div key={x.id} className="flex items-center gap-2.5 min-h-[36px] text-[13px]" data-testid="day-family" dir="auto"><span className="w-8 h-8 rounded-full bg-[var(--c-soft)] c-acc grid place-items-center text-[12px] font-extrabold shrink-0">{String(x.name).slice(0, 1).toUpperCase()}</span>
        <span className="flex-1 min-w-0 truncate">{x.line}</span><span className="c-sub text-[12px] shrink-0 tabular-nums">{new Date(x.ts).toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" })}</span></div>)}
      {asks.map((a) => <div key={a.id} className="rounded-[14px] border border-[var(--c-ln)] p-2.5 space-y-1.5" data-testid="day-ask">
        <p className="m-0 text-[13px]" dir="auto"><b>{a.who}</b>{a.app ? <span className="c-sub"> · {a.app}</span> : null}: {a.text}</p>
        <div className="flex items-center gap-2"><span className="flex-1 text-[12px] c-sub">{tr("For {t}", { t: dayTime(a.at, now) })}</span>
          <button onClick={() => hide(a.id)} className="w-9 h-9 grid place-items-center c-sub" aria-label={tr("Dismiss")} data-testid="day-ask-no"><X size={15} /></button>
          <button onClick={() => addAsk(a)} className={U.btnP + " h-9! min-h-[36px]! px-3! text-[12.5px]!"} data-testid="day-ask-add"><Plus size={14} />{tr("Add a reminder")}</button></div></div>)}
      {day.people.slice(0, 3).map((p) => <div key={p.who + p.kind} className="flex items-center gap-2.5 min-h-[40px]" data-testid="day-person">
        <span className="w-8 h-8 rounded-full bg-[var(--c-soft)] c-acc grid place-items-center text-[12px] font-extrabold shrink-0">{String(p.who || "?").trim().slice(0, 1).toUpperCase()}</span>
        <span className="flex-1 min-w-0"><b className="block text-[13.5px] truncate" dir="auto">{p.who}{(() => { const c = NT.cardOf({ title: p.who, app: p.app, pkg: p.pkg }, loadDir()), r = c && NT.roleOf(c.role); return r ? <span className="c-sub font-semibold" data-testid="day-person-role"> · {tr(r[1])}</span> : null; })()}{p.group ? <span className="c-sub font-semibold"> · {p.group}</span> : null}</b>
          <span className="block text-[12px] c-sub truncate" dir="auto">{p.last}</span></span>
        <span className="text-[11.5px] c-sub shrink-0 text-end">{p.app}<span className="block tabular-nums">{p.n > 1 ? tr("{n} messages", { n: p.n }) : timeOf(p.at)}</span></span></div>)}
      {day.arriving.map((x, i) => <p key={i} className="m-0 text-[12.5px] flex gap-2 items-start" data-testid="day-arriving"><Package size={14} className="c-acc shrink-0 mt-0.5" /><span dir="auto"><b>{tr("Arriving")}</b> · {x.text}</span></p>)}
      {day.apps.length ? <p className="m-0 text-[12px] c-sub" data-testid="day-apps">{tr("Also today:")} {day.apps.slice(0, 4).map((x) => x.app + " " + x.n).join(" · ")}</p> : null}
    </div> : askAccess ? <button onClick={() => { try { window.dispatchEvent(new CustomEvent("attune-notif-ask")); } catch (e) {} }} className="w-full c-card text-start flex items-center gap-2.5 min-h-[52px]" data-testid="day-notes-on">
      <Bell size={18} className="c-acc shrink-0" /><span className="flex-1 text-[13.5px] font-bold">{tr("Let Attune read your notifications to plan your day")}<span className="block text-[12px] c-sub font-semibold">{tr("On this phone only — nothing is sent anywhere.")}</span></span></button> : null}
  </div>;
}

/** A2 A: Ramadan — the countdown to iftar (or to the end of suhoor), a day planned around the fast, and a box to write anything. */
function RamadanCard({ now, navTo }) {
  const c = Y.ramadanCountdown(prayerCity(), now);
  const [text, setText] = useState("");
  const send = () => { const t = text.trim(); if (!t) return; try { window.dispatchEvent(new CustomEvent("attune-open", { detail: { mode: "chat", text: t } })); } catch (e) {} setText(""); };
  return <div className="c-card space-y-2 text-center" style={{ borderColor: "var(--c-acc)" }} data-testid="ramadan-card" data-to={c.to}>
    <span className="text-[12px] font-extrabold tracking-wide c-acc uppercase inline-flex items-center gap-1.5 justify-center"><Moon size={14} />{c.to === "iftar" ? tr("Iftar · Maghrib {t}", { t: c.maghrib }) : tr("Suhoor ends · Fajr {t}", { t: c.fajr })}</span>
    <b className="block text-[30px] font-black tabular-nums leading-none" dir="ltr" data-testid="ramadan-left">{Y.hms(c.left)}</b>
    <p className="m-0 text-[12.5px] c-sub">{tr("Your day is planned around the fast: heavy tasks stay away from the last hour before iftar.")}</p>
    <div className="flex gap-2 text-start">
      <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} dir="auto" placeholder={tr("Write anything — a question, a to-do, a reminder…")} className={U.inp + " flex-1"} data-testid="ramadan-ask" />
      <button onClick={send} className={U.btnP + " shrink-0"} data-testid="ramadan-send">{tr("Send")}</button></div>
    <button onClick={() => navTo && navTo("reminders")} className={U.btnS + " w-full h-10! min-h-[40px]!"} data-testid="ramadan-plan"><CalendarDays size={15} />{tr("Plan my day around the fast")}</button>
  </div>;
}

const Switch = ({ on, onChange, label, sub, testid }) => <button onClick={() => onChange(!on)} role="switch" aria-checked={!!on} className="w-full min-h-[56px] flex items-center gap-3 text-start" data-testid={testid}>
  <span className="flex-1 min-w-0"><span className="block text-[14px] font-bold text-[var(--c-ink)]">{label}</span>{sub ? <span className="block text-[12.5px] c-sub">{sub}</span> : null}</span>
  <span className="w-11 h-6 rounded-full shrink-0 relative transition-colors" style={{ background: on ? "var(--c-acc)" : "var(--c-ln)" }}><span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ insetInlineStart: on ? "22px" : "2px" }} /></span></button>;

/** Settings → Your day: everything here is off until the person turns it on (Ali: "this is a global app"). */
export function DaySettings() {
  const [ds, set] = useDayset();
  const [city, setCity] = useState(prayerCity());
  const [showApps, setShowApps] = useState(false);
  const putCity = (c) => { setCity(c); try { localStorage.setItem(PRAYER_KEY, JSON.stringify({ ...readJson(PRAYER_KEY, {}), city: c })); } catch (e) {} set({}); };
  const apps = useMemo(() => { const n = N(); let notes = []; try { notes = n && n.recallNotes ? JSON.parse(n.recallNotes() || "[]") : []; } catch (e) {}
    const m = new Map(); for (const x of notes) if (x && x.pkg && !m.has(x.pkg)) m.set(x.pkg, { pkg: x.pkg, app: x.app || x.pkg, kind: kindOf(x.pkg, x.app) }); return [...m.values()].sort((a, b) => a.app.localeCompare(b.app)); }, [showApps]);
  const off = new Set(ds.offApps);
  return <section className="space-y-1" data-testid="day-settings">
    <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-[var(--c-mut)] mt-0 mb-1">{tr("Your day")}</p>
    <Switch on={ds.prayers} onChange={(v) => set({ prayers: v })} label={tr("Prayer times on Home")} sub={tr("The five prayers for your city, and a day planned around them. Off unless you want it.")} testid="set-prayers" />
    {ds.prayers ? <label className="flex items-center gap-2 ps-1 pb-2 text-[13px] font-bold"><span className="c-sub">{tr("City")}</span>
      <select value={city} onChange={(e) => putCity(e.target.value)} className={U.inp + " !w-auto !min-h-[40px] !h-10 text-[13px]"} data-testid="set-prayer-city">{Object.entries(CITIES).map(([k, v]) => <option key={k} value={k}>{tr(v.en)}</option>)}</select></label> : null}
    <Switch on={ds.ramadan} onChange={(v) => set({ ramadan: v })} label={tr("Ramadan mode")} sub={tr("Only during Ramadan: the countdown to iftar on Home and a day planned around the fast.")} testid="set-ramadan" />
    <Switch on={ds.notes} onChange={(v) => set({ notes: v })} label={tr("Use my notifications to plan my day")} sub={tr("Who wrote, what someone asked for at a time, what arrives today — read on this phone only.")} testid="set-notes" />
    {ds.notes ? <div className="ps-1 pb-2 space-y-1.5">
      {!access() ? <button onClick={() => { try { window.dispatchEvent(new CustomEvent("attune-notif-ask")); } catch (e) {} }} className={U.btnS + " h-10! min-h-[40px]!"} data-testid="set-notes-access">{tr("Turn on notification access")}</button> : null}
      <button onClick={() => setShowApps(!showApps)} className="text-[13px] font-extrabold c-acc min-h-[36px]" aria-expanded={showApps} data-testid="set-notes-apps">{showApps ? tr("Hide the apps") : tr("Choose the apps ({n} left out)", { n: ds.offApps.length })}</button>
      {showApps ? (apps.length ? <div className="grid gap-1" data-testid="set-apps">{apps.map((a) => <label key={a.pkg} className="flex items-center gap-2.5 min-h-[40px] text-[13.5px]">
        <input type="checkbox" checked={!off.has(a.pkg)} onChange={(e) => set({ offApps: e.target.checked ? ds.offApps.filter((x) => x !== a.pkg) : [...ds.offApps, a.pkg] })} data-testid="set-app" />
        <span className="flex-1 min-w-0 truncate font-bold">{a.app}</span></label>)}</div>
        : <p className="m-0 text-[12.5px] c-sub">{tr("The apps show up here after their first notifications.")}</p>) : null}
    </div> : null}
    <label className="flex items-center gap-3 min-h-[56px]"><span className="flex-1"><span className="block text-[14px] font-bold text-[var(--c-ink)]">{tr("“Close the day” from")}</span><span className="block text-[12.5px] c-sub">{tr("In the evening Home shows what's done and moves the rest to tomorrow in one tap.")}</span></span>
      <select value={ds.evening} onChange={(e) => set({ evening: +e.target.value })} className={U.inp + " !w-auto !min-h-[40px] !h-10 text-[13px]"} data-testid="set-evening">{[17, 18, 19, 20, 21, 22, 23].map((h) => <option key={h} value={h}>{timeOf(new Date(2026, 0, 1, h).getTime())}</option>)}</select></label>
    <Switch on={ds.widgetMoney} onChange={(v) => set({ widgetMoney: v })} label={tr("Safe to spend on the Today widget")} sub={tr("The home-screen widget also shows how much you can spend today.")} testid="set-widget-money" />
    <Switch on={ds.simple} onChange={(v) => set({ simple: v })} label={tr("Simple mode")} sub={tr("Big text and five big buttons — for parents, or anyone who wants it simple.")} testid="set-simple" />
  </section>;
}

/** D5 A — Simple mode (Settings → Your day → Simple mode): Home becomes five big buttons with big text — for parents, or anyone who
 *  wants it simple. Talk to Attune first. The prayer button only when prayer times are on (else To-dos & lists). Leaving is one tap. */
export function SimpleHome({ navTo, openMenu }) {
  const [ds, set] = useDayset();
  const now = Date.now();
  const pr = ds.prayers ? Y.prayersToday(prayerCity(), now) : null;
  const nx = pr && pr.next ? pr.list.find((x) => x.k === pr.next) : null;
  let date = ""; try { date = new Date(now).toLocaleDateString(dateLocale(), { weekday: "long", day: "numeric", month: "long" }); } catch (e) {}
  const h = new Date(now).getHours();
  const tile = "rounded-[24px] border border-[var(--c-ln)] bg-[var(--c-surf)] flex flex-col items-center justify-center gap-2 text-center p-4 min-h-[132px] active:scale-[.98] transition-transform";
  const T2 = ({ icon, label, sub, onClick, testid, main }) => <button onClick={onClick} className={tile + (main ? " col-span-2 min-h-[150px]! border-[var(--c-acc)] bg-[var(--c-soft)] c-acc" : "")} data-testid={testid}>
    <span className="text-[38px] leading-none" aria-hidden="true">{icon}</span><b className="text-[21px] font-black leading-tight">{label}</b>{sub ? <span className="text-[15px] font-bold c-acc">{sub}</span> : null}</button>;
  return <div className="calm pt-2 pb-10 space-y-4" data-testid="simple-home">
    <div className="flex items-start gap-3">
      {openMenu ? <button onClick={openMenu} className="w-12 h-12 grid place-items-center rounded-[14px] text-[26px] c-sub" aria-label={tr("Menu")} data-testid="simple-menu">☰</button> : null}
      <div className="flex-1"><p className="m-0 text-[16px] font-bold c-sub">{date}</p>
        <p className="m-0 text-[30px] font-black leading-tight">{tr(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening")}</p></div></div>
    <div className="grid grid-cols-2 gap-3">
      <T2 main icon="🎙️" label={tr("Talk to Attune")} onClick={() => navTo("voice")} testid="simple-talk" />
      <T2 icon="⏰" label={tr("Reminders")} onClick={() => navTo("reminders")} testid="simple-reminders" />
      <T2 icon="💰" label={tr("Money")} onClick={() => navTo("money")} testid="simple-money" />
      {nx ? <T2 icon="🕌" label={tr("Prayer times")} sub={tr(PRAYER_NAMES[nx.k]) + " " + nx.at} onClick={() => navTo("reminders")} testid="simple-prayer" />
        : <T2 icon="📝" label={tr("To-dos & lists")} onClick={() => navTo("lists")} testid="simple-lists" />}
      <T2 icon="💊" label={tr("Medicines")} onClick={() => navTo("care")} testid="simple-meds" />
    </div>
    <button onClick={() => set({ simple: false })} className="w-full min-h-[52px] text-[15px] font-bold c-sub underline underline-offset-4" data-testid="simple-leave">{tr("Show the full Home")}</button>
  </div>;
}
