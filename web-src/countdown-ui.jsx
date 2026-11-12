/* ---- v9.9.19 T3 Countdowns (Ali picked A + his note "make it openable" — combined screen OK'd 12 Nov). Small chips under the Home
   box ("♡ Wedding · 39 days"); tapping one opens its big card (the days in big numbers, the date in words, a bar from the day it was
   added, Edit / Remove). "+" adds one (name + date). Ramadan shows by itself when prayers are on (recipes.js nextRamadan, Umm al-Qura).
   Days left = b4time.js daysLeft (by calendar in the person's own time zone; the day itself = "Today"; tested on 10,000 dates). */
import React, { useEffect, useMemo, useState } from "react";
import { tr, dateLocale } from "./i18n.js";
import { daysLeft } from "./b4time.js";
import { nextRamadan } from "./recipes.js";
import { loadDayset } from "./dayset.js";
import { btnP, btnS, btnDanger, inp, label } from "./ui-kit.jsx";
import { loadHabits } from "./habits-ui.jsx";
export const CD_KEY = "attune:countdowns:v1";
const ICONS = ["♡", "✈", "☾", "★", "🎂", "🎓", "⌂", "✦"];
const DAY = 864e5;
export function loadCountdowns() { try { const v = JSON.parse(localStorage.getItem(CD_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function save(list) { try { localStorage.setItem(CD_KEY, JSON.stringify(list)); } catch (e) {} return list; }
const iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
/** The chips to show: the person's own (not past), plus Ramadan when prayers are on — nearest first. */
export function countdownsNow(now = Date.now(), list = loadCountdowns(), prayersOn = (() => { try { return !!(loadDayset() || {}).prayers; } catch (e) { return false; } })()) {
  const out = list.map((c) => ({ ...c, left: daysLeft(c.date, now) })).filter((c) => c.left >= 0);
  if (prayersOn && !out.some((c) => c.auto === "ramadan")) { const r = nextRamadan(now); if (r != null) { const left = daysLeft(iso(r), now); if (left >= 0 && left <= 365) out.push({ id: "ramadan", auto: "ramadan", icon: "☾", name: tr("Ramadan"), date: iso(r), left, added: now - 30 * DAY }); } }
  return out.sort((a, b) => a.left - b.left);
}
const daysText = (n) => (n === 0 ? tr("Today") : n === 1 ? tr("Tomorrow") : tr("{n} days", { n }));
const when = (d) => { try { return new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)).toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "long", year: "numeric" }); } catch (e) { return d; } };
export function CountdownChips() {
  const [v, setV] = useState(0), [open, setOpen] = useState(null), [edit, setEdit] = useState(null);
  const list = useMemo(() => countdownsNow(), [v]);
  const refresh = () => setV((x) => x + 1);
  useEffect(() => { const f = () => refresh(); window.addEventListener("attune-habits", f); return () => window.removeEventListener("attune-habits", f); }, []);
  useEffect(() => { const f = () => setEdit({ icon: "♡", name: "", date: "" }); window.addEventListener("attune-countdown-add", f); return () => window.removeEventListener("attune-countdown-add", f); }, []);
  const chip = "h-9 px-3.5 rounded-full text-[13px] font-extrabold whitespace-nowrap inline-flex items-center gap-1.5 shrink-0";
  return (
    <div data-testid="home-countdowns">
      <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
        {list.map((c) => (
          <button key={c.id} onClick={() => setOpen(c)} className={chip} style={{ background: "var(--c-soft)", color: "var(--c-ink)" }} data-testid="countdown-chip" data-id={c.id}>
            <span aria-hidden="true">{c.icon || "★"}</span><span dir="auto">{c.name}</span><span className="c-sub">· {daysText(c.left)}</span></button>))}
        <button onClick={() => setEdit({ icon: "♡", name: "", date: "" })} className={chip} style={{ border: "1px dashed var(--c-ln)", color: "var(--c-sub, var(--c-mut))" }} aria-label={tr("Add a countdown")} data-testid="countdown-add">
          + {list.length ? "" : tr("Countdown")}</button>
        {loadHabits().items.length ? null : <button onClick={() => window.dispatchEvent(new CustomEvent("attune-habit-add"))} className={chip} style={{ border: "1px dashed var(--c-ln)", color: "var(--c-sub, var(--c-mut))" }} data-testid="habit-add-chip">+ {tr("Habit")}</button>}
      </div>
      {open ? <Sheet onClose={() => setOpen(null)} testid="countdown-card">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0"><b className="block text-[17px]" dir="auto">{(open.icon || "★") + " " + open.name}</b><span className="c-sub text-[13px]" data-testid="countdown-date">{when(open.date)}</span></div>
          <div className="text-end"><div className="text-[40px] font-black leading-none c-acc c-num" data-testid="countdown-days">{open.left}</div><div className="c-sub text-[12px]">{open.left === 0 ? tr("Today") : tr("days")}</div></div>
        </div>
        {(() => { const all = Math.max(1, daysLeft(open.date, open.added || Date.now()) ), p = Math.min(100, Math.max(0, Math.round(100 * (all - open.left) / all))); return <div className="c-bar mt-1"><i style={{ width: p + "%" }} /></div>; })()}
        {open.auto ? <p className="c-sub text-[12.5px] m-0">{tr("Shows because prayer times are on (Umm al-Qura calendar).")}</p> :
        <div className="flex gap-2">
          <button className={btnS} onClick={() => { setEdit(open); setOpen(null); }} data-testid="countdown-edit">{tr("Edit")}</button>
          <button className={btnDanger} onClick={() => { save(loadCountdowns().filter((x) => x.id !== open.id)); setOpen(null); refresh(); }} data-testid="countdown-remove">{tr("Remove")}</button></div>}
      </Sheet> : null}
      {edit ? <Sheet onClose={() => setEdit(null)} testid="countdown-form">
        <p className={label + " m-0"}>{edit.id ? tr("Edit countdown") : tr("Add a countdown")}</p>
        <div className="flex gap-1.5 flex-wrap">{ICONS.map((i) => <button key={i} onClick={() => setEdit({ ...edit, icon: i })} className="w-10 h-10 rounded-full text-[17px]" style={{ background: edit.icon === i ? "var(--c-acc)" : "var(--c-surf-2, var(--c-bg))", color: edit.icon === i ? "var(--c-on-acc, #fff)" : "inherit" }} aria-label={i}>{i}</button>)}</div>
        <input className={inp} dir="auto" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder={tr("What is it? (e.g. Wedding)")} data-testid="countdown-name" />
        <input className={inp} type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} data-testid="countdown-when" />
        {edit.date && daysLeft(edit.date) < 0 ? <p className="text-[12.5px] m-0" style={{ color: "var(--c-neg)" }}>{tr("That date has passed — pick a day from today on.")}</p> : null}
        <button className={btnP + " w-full"} disabled={!edit.name.trim() || !edit.date || daysLeft(edit.date) < 0} data-testid="countdown-save"
          onClick={() => { const L = loadCountdowns(), item = { id: edit.id || "c" + Date.now(), icon: edit.icon, name: edit.name.trim(), date: edit.date, added: edit.added || Date.now() };
            save(edit.id ? L.map((x) => (x.id === edit.id ? item : x)) : [...L, item]); setEdit(null); refresh(); }}>{tr("Save")}</button>
      </Sheet> : null}
    </div>);
}
function Sheet({ children, onClose, testid }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,.35)" }} onClick={onClose}>
      <div className="w-full max-w-[520px] rounded-t-[24px] p-5 space-y-3" style={{ background: "var(--c-surf)", color: "var(--c-ink)" }} onClick={(e) => e.stopPropagation()} data-testid={testid}>
        {children}
        <button onClick={onClose} className="w-full h-10 c-sub text-[13px] font-bold">{tr("Close")}</button>
      </div>
    </div>);
}
