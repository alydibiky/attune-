/* ---- v9.9.19 T6 Focus timer (Ali picked A "full-screen timer — only if Play allows"; combined screen OK'd 12 Nov). A normal Attune
   screen over everything (no full-screen-intent permission — Play keeps that for calls and alarms): the task, a ring with the time
   left, Pause / Resume / Stop. The time kept = b4time.js focused() (pauses out, never more than the plan, an app closed mid-way keeps
   what was focused — 10,000 sessions). Sessions are saved per task ("2nd session today", "This week: 1 h 40 m").
   "Make the phone quiet" uses Android's Do Not Disturb only if the person allowed it once in Android's settings (AttuneNative.setQuiet;
   until the phone part exists the switch is hidden). Opened from any to-do on Home (◷) and by window event "attune-focus". */
import React, { useEffect, useState } from "react";
import { tr } from "./i18n.js";
import { focused } from "./b4time.js";
import { btnP, btnS } from "./ui-kit.jsx";
export const FC_KEY = "attune:focus:v1", FC_RUN = "attune:focus:run";
const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
const put = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
/** Sessions of a task today, and the focused minutes of the last 7 days. */
export function focusStats(task, now = Date.now(), list = get(FC_KEY, [])) {
  const mine = list.filter((s) => s.task === task);
  return { today: mine.filter((s) => sameDay(s.at, now)).length, weekMs: mine.filter((s) => now - s.at < 7 * 864e5).reduce((a, s) => a + s.ms, 0) };
}
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
export const hm = (ms) => { const m = Math.round(ms / 60000); return m >= 60 ? tr("{h} h {m} m", { h: Math.floor(m / 60), m: m % 60 }) : tr("{m} m", { m }); };
/** Start a focus session on a task (any screen can call it). */
export function startFocus(task, plan = 25) { put(FC_RUN, { task, plan, events: [{ t: Date.now(), e: "start" }] }); try { window.dispatchEvent(new CustomEvent("attune-focus")); } catch (e) {} }
export function FocusHost() {
  const [run, setRun] = useState(() => get(FC_RUN, null)), [, tick] = useState(0), [done, setDone] = useState(null), [pick, setPick] = useState(null);
  useEffect(() => { const f = () => setPick({ task: "", plan: 25 }); window.addEventListener("attune-focus-pick", f); return () => window.removeEventListener("attune-focus-pick", f); }, []);
  useEffect(() => { const f = () => setRun(get(FC_RUN, null)); window.addEventListener("attune-focus", f); return () => window.removeEventListener("attune-focus", f); }, []);
  useEffect(() => { if (!run) return; const i = setInterval(() => tick((x) => x + 1), 500); return () => clearInterval(i); }, [run]);
  if (done) return <Full><div className="text-center space-y-3 px-6" data-testid="focus-done">
    <p className="text-[20px] font-black m-0">{tr("Well done")}</p>
    <p className="c-sub m-0" dir="auto">{done.task}</p>
    <p className="text-[34px] font-black c-num m-0" data-testid="focus-kept">{hm(done.ms)}</p>
    <p className="c-sub text-[13px] m-0">{tr("This week on this: {t}", { t: hm(focusStats(done.task).weekMs) })}</p>
    <button className={btnP + " w-full"} onClick={() => setDone(null)} data-testid="focus-close">{tr("Close")}</button></div></Full>;
  if (!run && pick) return <Full><div className="w-full max-w-[420px] px-6 space-y-3" data-testid="focus-pick">
    <p className="text-[12px] font-extrabold tracking-[0.08em] uppercase c-sub m-0">{tr("Focus")}</p>
    <input autoFocus dir="auto" value={pick.task} onChange={(e) => setPick({ ...pick, task: e.target.value })} placeholder={tr("Focus on what?")} className="w-full min-h-[48px] rounded-[12px] bg-[var(--c-surf)] border border-[var(--c-ln)] px-3.5 text-[15px]" data-testid="focus-what" />
    <div className="flex gap-1.5">{[15, 25, 50, 90].map((m) => <button key={m} onClick={() => setPick({ ...pick, plan: m })} className="flex-1 min-h-[44px] rounded-full font-extrabold text-[13px]" style={{ background: pick.plan === m ? "var(--c-acc)" : "var(--c-surf-2, var(--c-surf))", color: pick.plan === m ? "var(--c-on-acc, #fff)" : "inherit" }} data-testid={"focus-min-" + m}>{tr("{m} m", { m })}</button>)}</div>
    <button className={btnP + " w-full"} disabled={!pick.task.trim()} onClick={() => { const t = pick.task.trim(), pl = pick.plan; setPick(null); startFocus(t, pl); }} data-testid="focus-start">{tr("Start")}</button>
    <button className="w-full h-10 c-sub text-[13px] font-bold" onClick={() => setPick(null)}>{tr("Cancel")}</button></div></Full>;
  if (!run) return null;
  const now = Date.now(), last = run.events[run.events.length - 1], paused = last.e === "pause";
  const ms = focused([...run.events, { t: now, e: "stop" }], run.plan), left = run.plan * 60000 - ms, pct = ms / (run.plan * 60000);
  const save = (events) => { const r = { ...run, events }; put(FC_RUN, r); setRun(r); };
  const stop = () => { const kept = focused([...run.events, { t: Date.now(), e: "stop" }], run.plan); const L = get(FC_KEY, []);
    if (kept >= 60000) { L.push({ task: run.task, at: Date.now(), ms: kept }); put(FC_KEY, L.slice(-500)); }
    put(FC_RUN, null); setRun(null); setDone({ task: run.task, ms: kept }); };
  if (left <= 0) setTimeout(stop, 0);
  const n = focusStats(run.task, now).today + 1, R = 88, C = 2 * Math.PI * R;
  return <Full><div className="text-center w-full max-w-[420px] px-6 space-y-4" data-testid="focus-screen">
    <div><p className="text-[12px] font-extrabold tracking-[0.08em] uppercase c-sub m-0">{tr("Focus")}</p><p className="text-[16px] font-extrabold m-0" dir="auto" data-testid="focus-task">{run.task}</p></div>
    <svg viewBox="0 0 200 200" className="w-[230px] h-[230px] mx-auto block" aria-hidden="true">
      <circle cx="100" cy="100" r={R} fill="none" stroke="var(--c-ln)" strokeWidth="10" />
      <circle cx="100" cy="100" r={R} fill="none" stroke="var(--c-acc)" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 100 100)" />
      <text x="100" y="98" textAnchor="middle" fontSize="38" fontWeight="900" fill="var(--c-ink)" data-testid="focus-left">{mmss(left)}</text>
      <text x="100" y="126" textAnchor="middle" fontSize="13" fill="var(--c-mut)">{tr("of {t}", { t: mmss(run.plan * 60000) })}</text>
    </svg>
    <p className="c-sub text-[13px] m-0">{paused ? tr("Paused") : n === 1 ? tr("1st session today") : tr("Session {n} today", { n })}</p>
    <div className="flex gap-2 justify-center">
      <button className={btnP} onClick={() => save([...run.events, { t: Date.now(), e: paused ? "resume" : "pause" }])} data-testid="focus-pause">{paused ? tr("Resume") : tr("Pause")}</button>
      <button className={btnS} onClick={stop} data-testid="focus-stop">{tr("Stop")}</button></div>
  </div></Full>;
}
const Full = ({ children }) => <div className="fixed inset-0 z-[60] grid place-items-center" style={{ background: "var(--c-bg)", color: "var(--c-ink)" }}>{children}</div>;
