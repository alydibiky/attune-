/* ---- v9.9.19 T5 Auto-plan my week (Ali picked A — a calendar with blocks). The person lists tasks (name, how long, by when);
   Attune places them (b4plan.js planWeek — earliest deadline first, 30-minute chunks, inside the hours chosen, never on a reminder /
   appointment, never on a prayer when prayers are on, never after the deadline; a task that can't fit is said, never squeezed —
   10,000 weeks). Shown as 3 days side by side (your things grey, prayers green, Attune's blocks in colour), with ‹ › for the rest of
   the week. "Keep plan" turns each block into a reminder (source "weekplan"; an older plan's reminders are replaced, not doubled).
   Opened from To-dos & lists ("Plan my week") and by the window event "attune-weekplan". */
import React, { useEffect, useMemo, useState } from "react";
import { tr, dateLocale } from "./i18n.js";
import { planWeek } from "./b4plan.js";
import { loadReminders, saveReminders, newReminderId, nextOccurrence, syncToPhone } from "./actions.js";
import { loadDayset } from "./dayset.js";
import { prayersToday } from "./yourday.js";
import { btnP, btnS, inp, label } from "./ui-kit.jsx";
export const WP_KEY = "attune:weekplan:v1";
const DAY = 864e5, M = 60000;
const get = () => { try { const v = JSON.parse(localStorage.getItem(WP_KEY) || "null"); return v && Array.isArray(v.tasks) ? v : { tasks: [], from: "09:00", to: "22:00" }; } catch (e) { return { tasks: [], from: "09:00", to: "22:00" }; } };
const put = (v) => { try { localStorage.setItem(WP_KEY, JSON.stringify(v)); } catch (e) {} return v; };
const iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const dayStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const hhmm = (t) => new Date(t).toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" });
/** Busy times for the next 7 days: every reminder still to come (30 min each; repeating ones each time), the plan's own excluded. */
export function busyOf(list = loadReminders(), now = Date.now(), days = 7) {
  const out = [];
  for (const r of list) { if (r.done || r.source === "weekplan") continue; let t = nextOccurrence(r, now - 30 * M), g = 0;
    while (t && t < now + days * DAY && g++ < 60) { if (t >= now - 30 * M) out.push({ from: t, to: t + 30 * M, title: r.title }); if (!r.repeat || r.repeat === "none") break; const n = nextOccurrence(r, t + 1000); if (!n || n <= t) break; t = n; } }
  return out;
}
/** Prayer times (ms) for the next 7 days — only when the person turned prayers on. */
export function prayersOf(now = Date.now(), days = 7) {
  let on = false; try { on = !!loadDayset().prayers; } catch (e) {}
  if (!on) return [];
  let city = "cairo"; try { city = (JSON.parse(localStorage.getItem("attune:prayer:v1") || "{}").city) || "cairo"; } catch (e) {}
  const out = [];
  for (let i = 0; i < days; i++) { const d0 = dayStart(now) + i * DAY + 12 * 3600e3; try { for (const p of prayersToday(city, d0).list) out.push(dayStart(d0) + p.min * M); } catch (e) {} }
  return out;
}
export function WeekPlanPage({ onClose, flash }) {
  const [v, setV] = useState(get), [form, setForm] = useState({ name: "", hours: "1", due: iso(Date.now() + 3 * DAY) }), [off, setOff] = useState(0), [kept, setKept] = useState(false);
  const save = (x) => { setV(put(x)); setKept(false); };
  const now = Date.now();
  const busy = useMemo(() => busyOf(), [v]), prayers = useMemo(() => prayersOf(), [v]);
  const plan = useMemo(() => planWeek(v.tasks.map((k) => ({ id: k.id, minutes: k.minutes, due: k.due })), busy, { now, work: { from: v.from, to: v.to }, prayers }), [v, busy, prayers]);
  const name = (id) => (v.tasks.find((k) => k.id === id) || {}).name || "";
  const days = [0, 1, 2].map((i) => dayStart(now) + (off + i) * DAY);
  const hours = []; for (let h = +v.from.slice(0, 2); h < +v.to.slice(0, 2); h++) hours.push(h);
  const cell = (d, h) => { const a = d + h * 3600e3, b = a + 3600e3;
    const mine = plan.blocks.filter((x) => x.from < b && x.to > a), theirs = busy.filter((x) => x.from < b && x.to > a), pr = prayers.filter((p) => p >= a && p < b);
    if (mine.length) return { k: "plan", t: name(mine[0].id) };
    if (theirs.length) return { k: "busy", t: theirs[0].title };
    if (pr.length) return { k: "pr", t: tr("Prayer") };
    return { k: "", t: "" }; };
  const COL = { plan: { background: "var(--c-acc)", color: "var(--c-on-acc, #fff)" }, busy: { background: "var(--c-surf-2, #E6E3E0)", color: "var(--c-ink)" }, pr: { background: "rgba(44,143,128,.18)", color: "var(--c-ink)" }, "": { background: "transparent" } };
  const keep = () => {
    const L = loadReminders().filter((r) => r.source !== "weekplan");
    for (const b of plan.blocks) L.push({ id: newReminderId(), at: b.from, title: name(b.id), body: hhmm(b.from) + "–" + hhmm(b.to), repeat: "none", created: Date.now(), source: "weekplan", done: false });
    saveReminders(L); try { if (window.AttuneNative) syncToPhone(window.AttuneNative, L); } catch (e) {}
    setKept(true); flash && flash((plan.blocks.length === 1 ? tr("Plan kept — 1 reminder") : tr("Plan kept — {n} reminders", { n: plan.blocks.length })));
  };
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "var(--c-bg)", color: "var(--c-ink)" }} data-testid="weekplan-page">
      <div className="max-w-2xl mx-auto p-4 pb-16 space-y-3">
        <div className="flex items-center gap-2"><button onClick={onClose} className={btnS} aria-label={tr("Back")} data-testid="weekplan-back">‹</button>
          <h2 className="text-[20px] font-black m-0 flex-1">{tr("Week plan")}</h2></div>
        <p className="c-sub text-[13px] m-0">{tr("Around your reminders and appointments, inside your hours{p}.", { p: prayers.length ? tr(", and around prayer times") : "" })}</p>
        <div className="c-card p-3 space-y-2" data-testid="weekplan-tasks">
          <p className={label + " m-0"}>{tr("Tasks")}</p>
          {v.tasks.map((k) => <div key={k.id} className="flex items-center gap-2 text-[14px]" data-testid="weekplan-task">
            <b className="flex-1 min-w-0 truncate" dir="auto">{k.name}</b><span className="c-sub text-[12.5px]">{tr("{h} h · by {d}", { h: +(k.minutes / 60).toFixed(1), d: new Date(k.due - 1).toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short" }) })}</span>
            <button onClick={() => save({ ...v, tasks: v.tasks.filter((x) => x.id !== k.id) })} className="w-9 h-9 c-sub" aria-label={tr("Remove")}>×</button></div>)}
          <input className={inp} dir="auto" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={tr("Task (e.g. Tender file)")} data-testid="weekplan-name" />
          <div className="flex gap-2">
            <label className="flex-1 text-[12px] c-sub">{tr("Hours")}<input className={inp} type="number" min="0.5" step="0.5" inputMode="decimal" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} data-testid="weekplan-hours" /></label>
            <label className="flex-1 text-[12px] c-sub">{tr("By")}<input className={inp} type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} data-testid="weekplan-due" /></label></div>
          <button className={btnP + " w-full"} disabled={!form.name.trim() || !(+form.hours > 0) || !form.due} data-testid="weekplan-add"
            onClick={() => { const d = new Date(+form.due.slice(0, 4), +form.due.slice(5, 7) - 1, +form.due.slice(8, 10) + 1).getTime();   // by the END of that day
              save({ ...v, tasks: [...v.tasks, { id: "w" + Date.now(), name: form.name.trim(), minutes: Math.round(+form.hours * 60), due: d }] }); setForm({ ...form, name: "" }); }}>{tr("Add task")}</button>
          <div className="flex gap-2 items-end text-[12px] c-sub">
            <label className="flex-1">{tr("From")}<input className={inp} type="time" value={v.from} onChange={(e) => e.target.value && e.target.value < v.to && save({ ...v, from: e.target.value })} data-testid="weekplan-from" /></label>
            <label className="flex-1">{tr("To")}<input className={inp} type="time" value={v.to} onChange={(e) => e.target.value && e.target.value > v.from && save({ ...v, to: e.target.value })} data-testid="weekplan-to" /></label></div>
        </div>
        {plan.late.length ? <div className="c-card p-3 text-[13px]" style={{ borderColor: "var(--c-neg)" }} data-testid="weekplan-late">
          {plan.late.map((id) => <p key={id} className="m-0" dir="auto">⚠ {tr("{t} doesn't fit before its deadline — free some time or move the date.", { t: name(id) })}</p>)}</div> : null}
        {v.tasks.length ? <>
          <div className="flex items-center gap-2"><button className={btnS} disabled={off <= 0} onClick={() => setOff(off - 3)} aria-label={tr("Earlier")} data-testid="weekplan-prev">‹</button><span className="flex-1" />
            <button className={btnS} disabled={off >= 4} onClick={() => setOff(off + 3)} aria-label={tr("Later")} data-testid="weekplan-next">›</button></div>
          <div className="grid gap-[3px] text-[11px]" style={{ gridTemplateColumns: "38px repeat(3, 1fr)" }} data-testid="weekplan-cal">
            <span />{days.map((d) => <span key={d} className="text-center font-extrabold text-[12px] pb-1">{new Date(d).toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric" })}</span>)}
            {hours.map((h) => <React.Fragment key={h}><span className="c-sub c-num pt-1">{String(h).padStart(2, "0")}</span>
              {days.map((d) => { const c = cell(d, h); return <span key={d} className="rounded-[6px] min-h-[26px] px-1 py-0.5 truncate" style={COL[c.k]} data-testid={c.k ? "weekplan-" + c.k : undefined} dir="auto">{c.t}</span>; })}</React.Fragment>)}
          </div>
          <div className="c-card p-3 space-y-1" data-testid="weekplan-blocks">
            {v.tasks.map((k) => { const bs = plan.blocks.filter((b) => b.id === k.id); if (!bs.length) return null;
              return <p key={k.id} className="m-0 text-[13px]" dir="auto"><b>✦ {k.name}</b>: {bs.map((b) => new Date(b.from).toLocaleDateString(dateLocale(), { weekday: "short" }) + " " + hhmm(b.from) + "–" + hhmm(b.to)).join(" · ")}</p>; })}
          </div>
          <button className={btnP + " w-full"} disabled={!plan.blocks.length || kept} onClick={keep} data-testid="weekplan-keep">{kept ? tr("Kept ✓") : tr("Keep plan")}</button>
        </> : null}
      </div>
    </div>);
}
export function WeekPlanHost({ flash }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { const f = () => setOpen(true); window.addEventListener("attune-weekplan", f); return () => window.removeEventListener("attune-weekplan", f); }, []);
  return open ? <WeekPlanPage onClose={() => setOpen(false)} flash={flash} /> : null;
}
