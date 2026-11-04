/* ---- v7.3 Health in two levels (Gemini's mock-up "Area 2: Health", Ali sent it 24 Oct 2026): the numbers of the Health Report,
   computed by code from each tool's own data — Fit & Food (attune:fit:v1), Family health (attune:care:v1) and Cycle
   (attune:cycle:v1). Pure (no DOM); the screens are health-calm-ui.jsx; tests: tests/unit/v760healthreport.test.mjs.
   Kind on purpose (Gemini's rule 4): a day above the calorie target is "above", never "bad"; a late period is "late", never red. */
import { dayTotals, today as dayOf, trend } from "./fit.js";
import { targetsOf } from "./fithome.js";
import { dosesOn, stockLeft, daysOfSupply, labHistory } from "./care.js";

const DAY = 86400000;
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const dayAt = (now, back) => { const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - back); return d; };

/** The last 7 days of Fit & Food, oldest first (today last): kcal, protein, water, burned, steps; with the target. */
export function fitWeek(fit, now = Date.now()) {
  const tg = fit && fit.profile ? targetsOf(fit.profile) : null;
  const rows = [];
  for (let i = 6; i >= 0; i--) {
    const d = dayAt(now, i), k = dayOf(d), t = dayTotals((fit && fit.days && fit.days[k]) || null);
    const day = (fit && fit.days && fit.days[k]) || {};
    rows.push({ day: k, dow: d.getDay(), today: i === 0, kcal: Math.round(t.kcal || 0), p: Math.round(t.p || 0), water: t.water || 0, burned: t.burned || 0, steps: t.steps || 0,
      workouts: (day.workouts || []).length, above: !!(tg && tg.kcal && t.kcal > tg.kcal * 1.05) });
  }
  // the average leaves out today (not finished) and days with nothing logged
  const done = rows.filter((r) => !r.today && r.kcal > 0);
  const avg = done.length ? Math.round(done.reduce((a, r) => a + r.kcal, 0) / done.length) : 0;
  const avgP = done.length ? Math.round(done.reduce((a, r) => a + r.p, 0) / done.length) : 0;
  const wDays = rows.filter((r) => r.water > 0);
  const water = wDays.length ? r1(wDays.reduce((a, r) => a + r.water, 0) / wDays.length / 1000) : 0;
  const sDays = rows.filter((r) => r.steps > 0);
  return { tg, rows, avg, avgP, logged: done.length, pctOfTarget: tg && tg.kcal && avg ? Math.round((avg / tg.kcal) * 100) : null,
    water, workouts: rows.reduce((a, r) => a + r.workouts, 0), steps: sDays.length ? Math.round(sDays.reduce((a, r) => a + r.steps, 0) / sDays.length) : 0 };
}

/** Weight: the entries with their 7-entry average (Fit's own trend), the latest, the change over 30 days, the goal. */
export function weightTrend(fit, now = Date.now()) {
  const list = trend((fit && fit.weights) || []);
  if (!list.length) return null;
  const last = list[list.length - 1], from = dayOf(new Date(now - 30 * DAY));
  const base = list.find((x) => x.d >= from) || list[0];
  return { points: list.slice(-14), last: last.kg, avg: last.avg, change: r1(last.avg - base.avg), since: base.d, goal: fit && fit.profile ? Number(fit.profile.goalKg) || null : null };
}

/** Family medicines this week: every dose that was due in the last 7 days (today: only those whose time has come), and how many
 *  were ticked; per medicine too, with what is left. */
export function medsWeek(care, now = Date.now()) {
  const meds = {}; let due = 0, taken = 0;
  const hhmm = (() => { const d = new Date(now); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); })();
  for (let i = 6; i >= 0; i--) {
    const t = dayAt(now, i).getTime();
    for (const x of dosesOn(care || {}, t)) {
      if (i === 0 && x.time > hhmm && !x.taken) continue;   // a dose later today is not missed yet
      const m = meds[x.med.id] || (meds[x.med.id] = { med: x.med, member: x.member, due: 0, taken: 0 });
      m.due++; due++; if (x.taken) { m.taken++; taken++; }
    }
  }
  const rows = Object.values(meds).map((m) => ({ ...m, pct: m.due ? Math.round((m.taken / m.due) * 100) : null, left: stockLeft(care, m.med), days: daysOfSupply(care, m.med) }));
  return { due, taken, pct: due ? Math.round((taken / due) * 100) : null, rows };
}

/** The latest lab test with more than one result: its history (care.js labHistory), newest test first. */
export function latestLab(care) {
  const labs = ((care && care.labs) || []).filter((l) => l && l.test && l.value != null);
  if (!labs.length) return null;
  const byTest = {};
  for (const l of labs) (byTest[(l.member || "") + "|" + l.test] = byTest[(l.member || "") + "|" + l.test] || []).push(l);
  const groups = Object.values(byTest).map((g) => g.sort((a, b) => String(a.date).localeCompare(String(b.date))));
  groups.sort((a, b) => String(b[b.length - 1].date).localeCompare(String(a[a.length - 1].date)));
  const g = groups.find((x) => x.length >= 2) || groups[0], last = g[g.length - 1];
  const member = ((care.members || []).find((m) => m.id === last.member) || {}).name || "";
  return { test: last.test, member, last, list: g, history: labHistory(g) };
}

/** Cycle in a few words, from Cycle's own statistics (cycle.jsx cycleStats, passed in — that file is a screen) — null when nothing is logged. */
export function cycleSummary(cycle, now = Date.now(), cycleStats = null) {
  if (!cycle || !Object.keys(cycle.days || {}).length || !cycleStats) return null;
  const k = dayOf(new Date(now)), s = cycleStats(cycle, k);
  const daysTo = s.nextStart ? Math.round((Date.parse(s.nextStart + "T12:00:00") - Date.parse(k + "T12:00:00")) / DAY) : null;
  return { inPeriod: s.inPeriod, cycleDay: s.cycleDay, late: s.late, daysTo, cycleLen: s.cycleLen, periodLen: s.periodLen, last: s.last ? s.last.start : null, known: s.known, nextStart: s.nextStart, fertile: s.fertile };
}

/** Everything the Health Report shows. */
export function healthReport({ fit = null, care = null, cycle = null, cycleStats = null, now = Date.now() } = {}) {
  return { fit: fitWeek(fit, now), weight: weightTrend(fit, now), meds: medsWeek(care, now), lab: latestLab(care), cycle: cycleSummary(cycle, now, cycleStats) };
}
