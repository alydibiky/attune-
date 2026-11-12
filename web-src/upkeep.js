/* ---- v9.9.24 B6 X2 Upkeep (Ali picked A + "add a Done option only, too"; combined screen OK'd 12 Nov). One page for what needs doing
   again and again: the car's services (from car.js — by km or by months, WHICHEVER COMES FIRST) and the home's (the water filter every
   6 months, the gas cylinder "about every 5 weeks" — learned from when it was done when no fixed time is set). Each line: how far along
   it is, when it is next; two buttons — Done (just marks it) and Done + cost (also puts the cost in Money). Pure.
   Tests: tests/x2/gen.mjs (10,000 logs) + tests/unit/v9924x2.test.mjs. */
import { carStats, SERVICES } from "./car.js";
const DAY = 864e5;
const iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const at = (s) => Date.parse(String(s).slice(0, 10) + "T12:00:00");
const addMonths = (s, n) => { const d = new Date(at(s)); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return iso(d.getTime()); };
/** How often, learned from the dates it was done (the median gap, in days) — null with fewer than 2 gaps. */
export function learnedEvery(dates = []) {
  const ds = [...new Set(dates.map((d) => String(d).slice(0, 10)))].sort(), gaps = [];
  for (let i = 1; i < ds.length; i++) { const g = Math.round((at(ds[i]) - at(ds[i - 1])) / DAY); if (g > 0) gaps.push(g); }
  if (gaps.length < 2) return null; gaps.sort((a, b) => a - b); const m = gaps.length >> 1;
  return gaps.length % 2 ? gaps[m] : Math.round((gaps[m - 1] + gaps[m]) / 2);
}
/** A home item: { id, name, everyMonths?, everyDays?, log: [{ date, cost? }] } → its line. */
export function homeLine(it, now = Date.now()) {
  const log = [...(it.log || [])].sort((a, b) => (a.date < b.date ? -1 : 1)), last = log[log.length - 1];
  const learned = !it.everyMonths && !it.everyDays ? learnedEvery(log.map((x) => x.date)) : null;
  const everyDays = it.everyDays || learned || 0;
  let due = null;
  if (last && it.everyMonths) due = addMonths(last.date, it.everyMonths); else if (last && everyDays) due = iso(at(last.date) + everyDays * DAY);
  const total = due && last ? Math.max(1, Math.round((at(due) - at(last.date)) / DAY)) : 0, gone = last ? Math.round((at(iso(now)) - at(last.date)) / DAY) : 0;
  const daysLeft = due ? Math.round((at(due) - at(iso(now))) / DAY) : null;
  return { id: it.id, kind: "home", name: it.name, last: last ? last.date : null, due, daysLeft, everyMonths: it.everyMonths || 0, everyDays, learned: !!learned,
    progress: total ? Math.min(1.5, gone / total) : 0, dueNow: daysLeft != null && daysLeft <= 7 };
}
/** The car's services as upkeep lines (whichever comes first: km or months). */
export function carLines(car, now = Date.now()) {
  const st = carStats(car, now);
  return st.next.map((n) => { const [, everyKm, everyMo] = SERVICES[n.service];
    const pk = n.kmLeft != null && everyKm ? (everyKm - n.kmLeft) / everyKm : 0, pd = n.daysLeft != null && everyMo ? 1 - n.daysLeft / (everyMo * 30.44) : 0;
    const byKm = n.kmLeft != null && everyKm && (n.daysLeft == null || pk >= pd);
    return { id: "car:" + n.service, kind: "car", service: n.service, dueKm: n.dueKm, kmLeft: n.kmLeft, kmNow: st.kmNow, due: n.dueDate, daysLeft: n.daysLeft,
      by: byKm ? "km" : "date", progress: Math.min(1.5, Math.max(pk, pd, 0)), dueNow: n.due }; });
}
/** Everything, the most urgent first. */
export function upkeepLines({ car = null, home = [] } = {}, now = Date.now()) {
  return [...(car ? carLines(car, now) : []), ...(home || []).map((h) => homeLine(h, now))].sort((a, b) => Number(b.dueNow) - Number(a.dueNow) || b.progress - a.progress);
}
/** Done (cost optional) on a home item → the new item + the Money entry when there is a cost. */
export function doneHome(it, { date, cost = 0, now = Date.now() } = {}) {
  const d = date || iso(now), item = { ...it, log: [...(it.log || []), cost > 0 ? { date: d, cost: +cost } : { date: d }] };
  return { item, money: cost > 0 ? { type: "expense", amount: +cost, note: it.name, date: d, cat: "home" } : null };
}
