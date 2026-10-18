/* ---- v6.38 (upgrade F2) — the coach that adapts every week. The formula (Mifflin-St Jeor × activity) is a guess; after a few
   weeks your own numbers say what you really burn: average eaten per day − (weight trend change × 7,700 kcal per kg) =
   energy used per day (adaptive TDEE). Once a week the target is re-computed from it, with the reason in one line. Pure;
   tests/unit/v740fitcoach.test.mjs. Rules that keep it honest:
   - at least 14 logged days and 4 weigh-ins over 14+ days in the last 28 days; a day counts when it has ≥ 800 kcal logged
     (a half-logged day would make you look like you burn nothing);
   - the trend is a least-squares line through the weigh-ins, not first − last (water jumps);
   - the measured value is blended with the formula by how much data there is, and a week can move the target ≤ 150 kcal. */
import { dayTotals, today } from "./fit.js";

const DAY = 86400000, KCAL_PER_KG = 7700;
const at12 = (s) => Date.parse(s + "T12:00:00");

/** Least-squares slope of kg over days → kg per day (null with < 2 points). */
export function slope(points) {
  if (!points || points.length < 2) return null;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y), n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den ? num / den : null;
}

/**
 * → { ready, why (when not), measured (kcal/day), formula, used (the TDEE to plan with), eaten (avg), perWeek (kg),
 *     days, weighIns, confidence 0..1 }
 */
export function adaptiveTdee({ days = {}, weights = [], formulaTdee, now = Date.now(), window = 28 } = {}) {
  const from = today(new Date(now - (window - 1) * DAY)), to = today(new Date(now));
  const logged = [];
  for (const [d, day] of Object.entries(days || {})) { if (d < from || d > to) continue; const t = dayTotals(day); if (t.kcal >= 800) logged.push(t.kcal); }
  const w = (weights || []).filter((x) => x.d >= from && x.d <= to && +x.kg > 0).sort((a, b) => (a.d < b.d ? -1 : 1));
  const span = w.length >= 2 ? Math.round((at12(w[w.length - 1].d) - at12(w[0].d)) / DAY) : 0;
  const base = { ready: false, formula: formulaTdee || null, used: formulaTdee || null, days: logged.length, weighIns: w.length };
  if (logged.length < 14) return { ...base, why: "days", need: 14 - logged.length };
  if (w.length < 4 || span < 14) return { ...base, why: "weights" };
  const k = slope(w.map((x) => ({ x: at12(x.d) / DAY, y: +x.kg })));
  const eaten = logged.reduce((a, b) => a + b, 0) / logged.length;
  const measured = Math.round(eaten - k * KCAL_PER_KG);
  if (!(measured > 900 && measured < 6000)) return { ...base, why: "odd", measured };
  // more data → trust the measurement more (all of it at 28 logged days and 8 weigh-ins)
  const confidence = Math.min(1, logged.length / 28) * Math.min(1, w.length / 8);
  const f = formulaTdee || measured;
  const used = Math.round((f + (measured - f) * (0.4 + 0.6 * confidence)) / 10) * 10;
  return { ready: true, measured, formula: formulaTdee || null, used, eaten: Math.round(eaten), perWeek: Math.round(k * 7 * 100) / 100, days: logged.length, weighIns: w.length, confidence: Math.round(confidence * 100) / 100 };
}

/**
 * The weekly check: profile.adapt = { tdee, at, prev } is updated at most once in 7 days, moving ≤ 150 kcal per week.
 * → { profile (new or the same), changed, line: [english sentence, values] }
 */
export function weeklyAdapt(profile, data, formulaTdee, now = Date.now()) {
  const a = adaptiveTdee({ ...data, formulaTdee, now });
  const cur = profile && profile.adapt;
  if (!a.ready) return { profile, changed: false, a, line: a.why === "days" ? ["Log food on {n} more days and your target will follow what your body really does.", { n: a.need }] : a.why === "weights" ? ["Weigh yourself 2–3 times a week for two weeks and your target will follow what your body really does.", {}] : null };
  if (cur && now - (cur.at || 0) < 7 * DAY) return { profile, changed: false, a, line: lineOf(a, cur.tdee) };
  const before = (cur && cur.tdee) || formulaTdee || a.used;
  const next = Math.round(Math.max(before - 150, Math.min(before + 150, a.used)) / 10) * 10;
  return { profile: { ...profile, adapt: { tdee: next, at: now, prev: before } }, changed: next !== before, a, line: lineOf(a, next) };
}
function lineOf(a, tdee) {
  const v = { eaten: a.eaten.toLocaleString("en-US"), kg: Math.abs(a.perWeek).toLocaleString("en-US"), burn: a.measured.toLocaleString("en-US"), tdee: tdee.toLocaleString("en-US") };
  if (Math.abs(a.perWeek) < 0.05) return ["You ate about {eaten} kcal a day and your weight held — so you burn about {burn}. Your plan now counts {tdee}.", v];
  return a.perWeek < 0 ? ["You ate about {eaten} kcal a day and lost {kg} kg a week — so you burn about {burn}. Your plan now counts {tdee}.", v]
    : ["You ate about {eaten} kcal a day and gained {kg} kg a week — so you burn about {burn}. Your plan now counts {tdee}.", v];
}
