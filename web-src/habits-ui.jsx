/* ---- v9.9.19 T2 Habits (Ali picked A — a Home card with week dots). Each habit: this week's 7 dots (done / due / not due / ahead)
   and its streak; tap today's dot to tick (tap again to untick). "+ Habit" adds one: a name and its days (every day, or chosen
   weekdays). Streak / dots / goal = b4time.js (a day the habit wasn't due never breaks a streak; a day counts once — 10,000 cases). */
import React, { useEffect, useMemo, useState } from "react";
import { tr, dateLocale } from "./i18n.js";
import { streak, weekDots, goalCount } from "./b4time.js";
import { btnP, btnDanger, inp, label } from "./ui-kit.jsx";
export const HB_KEY = "attune:habits:v1";
export function loadHabits() { try { const v = JSON.parse(localStorage.getItem(HB_KEY) || "null"); return v && Array.isArray(v.items) ? v : { items: [], done: {} }; } catch (e) { return { items: [], done: {} }; } }
function save(v) { try { localStorage.setItem(HB_KEY, JSON.stringify(v)); } catch (e) {} try { window.dispatchEvent(new CustomEvent("attune-habits")); } catch (e) {} return v; }
const sameDay = (a, b) => { const x = new Date(a), y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); };
/** Tick or untick today (a day counts once). */
export function toggleToday(v, id, now = Date.now()) {
  const done = (v.done[id] || []).slice(), i = done.findIndex((t) => sameDay(t, now));
  if (i >= 0) done.splice(i, 1); else done.push(now);
  return { ...v, done: { ...v.done, [id]: done } };
}
const dayName = (d) => { try { const x = new Date(2026, 10, 1 + d); return x.toLocaleDateString(dateLocale(), { weekday: "narrow" }); } catch (e) { return "SMTWTFS"[d]; } }; // 1 Nov 2026 = Sunday
export function HabitsCard() {
  const [v, setV] = useState(loadHabits), [add, setAdd] = useState(null), [open, setOpen] = useState(null);
  const now = Date.now(), today = new Date(now).getDay();
  const put = (x) => setV(save(x));
  // Home stays calm (Ali: no "set it up" adverts): with no habits the card is hidden; "+ Habit" next to the countdown chips opens the form
  useEffect(() => { const f = () => setAdd({ name: "", days: [] }); window.addEventListener("attune-habit-add", f); return () => window.removeEventListener("attune-habit-add", f); }, []);
  const rows = useMemo(() => v.items.map((h) => ({ h, dots: weekDots(h, v.done[h.id], now, 0), st: streak(h, v.done[h.id], now), n: goalCount(h, v.done[h.id]) })), [v]);
  if (!rows.length && !add) return null;
  return (
    <div className={rows.length ? "c-card space-y-1" : ""} data-testid="home-habits">
      {rows.length ? <div className="flex items-center gap-2"><span className="text-[12px] font-extrabold tracking-wide flex-1 uppercase c-sub">{tr("Habits · this week")}</span>
        <button onClick={() => setAdd({ name: "", days: [] })} className="text-[12.5px] font-extrabold c-acc min-h-[36px] px-1" data-testid="habit-add">+ {tr("Habit")}</button></div> : null}
      {rows.map(({ h, dots, st, n }) => (
        <div key={h.id} className="flex items-center gap-2 min-h-[48px]" data-testid="habit-row" data-id={h.id}>
          <button onClick={() => setOpen(h)} className="flex-1 min-w-0 text-start"><b className="block text-[14px] truncate" dir="auto">{h.name}</b>
            <span className="c-sub text-[12px]" data-testid="habit-streak">{st === 1 ? tr("streak 1 day") : tr("streak {n} days", { n: st })}{h.goal ? " · " + tr("{n} of {g}", { n, g: h.goal }) : ""}</span></button>
          <div className="flex gap-1 shrink-0" dir="ltr">{dots.map((d, i) => {
            const isToday = i === today, bg = d === "d" ? "var(--c-acc)" : d === "o" ? "transparent" : d === "x" ? "var(--c-surf-2, #EFEDEA)" : "transparent";
            return <button key={i} disabled={!isToday || d === "x"} onClick={() => put(toggleToday(v, h.id))} aria-label={dayName(i) + (d === "d" ? " ✓" : "")} data-testid={isToday ? "habit-today" : "habit-dot"} data-s={d}
              className="w-[22px] h-[22px] rounded-full text-[9px] font-extrabold grid place-items-center" style={{ background: bg, border: d === "o" || d === "f" ? "1.5px solid " + (isToday ? "var(--c-acc)" : "var(--c-ln)") : "none", color: d === "d" ? "var(--c-on-acc, #fff)" : "var(--c-mut)" }}>{dayName(i)}</button>; })}</div>
        </div>))}
      {add ? <Sheet onClose={() => setAdd(null)} testid="habit-form">
        <p className={label + " m-0"}>{add.id ? tr("Edit habit") : tr("New habit")}</p>
        <input className={inp} dir="auto" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} placeholder={tr("e.g. Read 20 pages")} data-testid="habit-name" />
        <p className="c-sub text-[12.5px] m-0">{tr("Which days? (none = every day)")}</p>
        <div className="flex gap-1.5" dir="ltr">{[0, 1, 2, 3, 4, 5, 6].map((d) => { const on = add.days.includes(d); return <button key={d} onClick={() => setAdd({ ...add, days: on ? add.days.filter((x) => x !== d) : [...add.days, d].sort() })} className="w-10 h-10 rounded-full font-extrabold text-[13px]" data-testid={"habit-day-" + d} style={{ background: on ? "var(--c-acc)" : "var(--c-surf-2, var(--c-bg))", color: on ? "var(--c-on-acc, #fff)" : "inherit" }}>{dayName(d)}</button>; })}</div>
        <input className={inp} type="number" min="0" inputMode="numeric" value={add.goal || ""} onChange={(e) => setAdd({ ...add, goal: Math.max(0, parseInt(e.target.value || "0", 10)) || 0 })} placeholder={tr("Goal: how many days (optional)")} data-testid="habit-goal" />
        <button className={btnP + " w-full"} disabled={!add.name.trim()} data-testid="habit-save" onClick={() => {
          const item = { id: add.id || "h" + Date.now(), name: add.name.trim(), days: add.days.length && add.days.length < 7 ? add.days : null, start: add.start || new Date(now).setHours(0, 0, 0, 0), goal: add.goal || 0 };
          put({ ...v, items: add.id ? v.items.map((x) => (x.id === add.id ? item : x)) : [...v.items, item] }); setAdd(null); }}>{tr("Save")}</button>
      </Sheet> : null}
      {open ? <Sheet onClose={() => setOpen(null)} testid="habit-sheet">
        <b className="block text-[17px]" dir="auto">{open.name}</b>
        <p className="c-sub text-[13px] m-0">{open.days ? open.days.map(dayName).join(" · ") : tr("Every day")}</p>
        <div className="flex gap-2">
          <button className={btnP} onClick={() => { setAdd({ ...open, days: open.days || [] }); setOpen(null); }} data-testid="habit-edit">{tr("Edit")}</button>
          <button className={btnDanger} onClick={() => { const d = { ...v.done }; delete d[open.id]; put({ items: v.items.filter((x) => x.id !== open.id), done: d }); setOpen(null); }} data-testid="habit-remove">{tr("Remove")}</button></div>
      </Sheet> : null}
    </div>);
}
export function Sheet({ children, onClose, testid }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,.35)" }} onClick={onClose}>
      <div className="w-full max-w-[520px] rounded-t-[24px] p-5 space-y-3" style={{ background: "var(--c-surf)", color: "var(--c-ink)" }} onClick={(e) => e.stopPropagation()} data-testid={testid}>
        {children}
        <button onClick={onClose} className="w-full h-10 c-sub text-[13px] font-bold">{tr("Close")}</button>
      </div>
    </div>);
}
