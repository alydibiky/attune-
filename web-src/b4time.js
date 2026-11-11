/* ---- v9.9.18 batch B4, the time parts (Ali picked T3-A "chips that open", T2-A "Home card with week dots", T6-A "full-screen timer,
   only if Play allows"). Pure; tests: tests/b4time (10,000 cases each) + tests/unit/v9918b4.test.mjs.
   T3 countdown: whole calendar days from today to the date in the person's own time zone (the day itself = 0, "today").
   T2 habits: a habit is due on its days (every day / some weekdays / N times a week); the streak counts DUE days in a row that were
        done — a day the habit wasn't due never breaks it, and today not done yet doesn't break it either; a day counts once.
   T6 focus: a session's focused time = the time it ran, minus pauses, never more than the planned length (an app closed mid-way
        keeps the time already focused).                                                                                         */
const DAY = 864e5;
const mid = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d; };
/** Whole days from today to `date` ("YYYY-MM-DD" or ms): 0 = today, negative = past. Counted by calendar, so DST never shifts it. */
export function daysLeft(date, now = Date.now()) {
  const a = mid(now), b = typeof date === "string" ? new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) : mid(date);
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY);
}
const key = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
/** habit: { days: [0..6] | null (every day), start: ms }. done: [ms] (ticks). → was the habit due on that day? */
export const dueOn = (h, d) => (!h.days || !h.days.length || h.days.includes(d.getDay())) && mid(d).getTime() >= mid(h.start || 0).getTime();
/** The streak: due days in a row (going back from today) that were done; today counts only when done. */
export function streak(h, done = [], now = Date.now()) {
  const set = new Set((done || []).map((t) => key(new Date(t))));
  let n = 0; const d = mid(now);
  if (dueOn(h, d) && set.has(key(d))) n++;
  d.setDate(d.getDate() - 1);
  for (let i = 0; i < 3700; i++) { if (mid(d).getTime() < mid(h.start || 0).getTime()) break; if (dueOn(h, d)) { if (set.has(key(d))) n++; else break; } d.setDate(d.getDate() - 1); }
  return n;
}
/** This week's dots (Sunday → Saturday, or from the person's first day): "d" done, "o" due not done, "x" not due, "f" future. */
export function weekDots(h, done = [], now = Date.now(), firstDay = 0) {
  const set = new Set((done || []).map((t) => key(new Date(t)))), d = mid(now), out = [];
  d.setDate(d.getDate() - ((d.getDay() - firstDay + 7) % 7));
  for (let i = 0; i < 7; i++) { const x = new Date(d); x.setDate(d.getDate() + i);
    out.push(x.getTime() > mid(now).getTime() ? "f" : !dueOn(h, x) ? "x" : set.has(key(x)) ? "d" : "o"); }
  return out;
}
/** Days done toward a goal (a day counts once, only on due days). */
export const goalCount = (h, done = []) => new Set((done || []).filter((t) => dueOn(h, new Date(t))).map((t) => key(new Date(t)))).size;
/** events: [{ t, e: "start" | "pause" | "resume" | "stop" }] in order; plan = minutes. → focused ms (capped at the plan). */
export function focused(events = [], plan = 25) {
  let ms = 0, from = null;
  for (const ev of events || []) {
    if ((ev.e === "start" || ev.e === "resume") && from == null) from = ev.t;
    else if ((ev.e === "pause" || ev.e === "stop") && from != null) { ms += Math.max(0, ev.t - from); from = null; }
    if (ev.e === "stop") break;
  }
  return Math.min(ms, plan * 60000);
}
