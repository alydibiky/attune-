/* ---- v6.41 (upgrade F4) — Cycle from the watch's night temperature. After ovulation the body's resting temperature rises by
   about 0.2–0.5 °C and stays up until the next period. The watch (through Health Connect) gives one number a night: the skin
   temperature's change from its own baseline, or a basal temperature. The classic "3 over 6" rule finds the rise: three nights
   in a row at least 0.2 °C above the highest of the 6 nights before → ovulation was the night before the first high one. The
   next period is then ovulation + this person's own luteal length (from past cycles; 14 days until there are two).
   Pure; tests/unit/v741cycletemp.test.mjs. Health.kt reads the nights; cycle.jsx shows it.                               */

const DAY = 86400000;
const t0 = (k) => Date.parse(k + "T12:00:00Z");
const add = (k, n) => new Date(t0(k) + n * DAY).toISOString().slice(0, 10);
const diff = (a, b) => Math.round((t0(b) - t0(a)) / DAY);

/** Every temperature rise in the nights [{ day, t }] → [{ ovulation, firstHigh, base, rise }] (oldest first). */
export function tempShifts(nights) {
  const n = [...(nights || [])].filter((x) => x && x.day && Number.isFinite(x.t)).sort((a, b) => a.day.localeCompare(b.day));
  const out = [];
  for (let i = 6; i + 2 < n.length; i++) {
    const prev = n.slice(i - 6, i);
    if (diff(prev[0].day, n[i + 2].day) > 12) continue;              // too many nights missing to judge
    const base = Math.max(...prev.map((x) => x.t));
    const hi = [n[i], n[i + 1], n[i + 2]];
    if (hi.every((x) => x.t >= base + 0.2) && diff(hi[0].day, hi[2].day) <= 3) {
      if (out.length && diff(out[out.length - 1].firstHigh, n[i].day) < 18) continue;   // the same rise, still up
      out.push({ ovulation: add(n[i].day, -1), firstHigh: n[i].day, base: Math.round(base * 100) / 100, rise: Math.round((Math.min(...hi.map((x) => x.t)) - base) * 100) / 100 });
    }
  }
  return out;
}

/** This person's luteal length: from each past rise to the period that followed (10–17 days kept); 14 until there are two. */
export function lutealLength(periodStarts, shifts) {
  const L = [];
  for (const s of shifts || []) {
    const next = (periodStarts || []).find((p) => p > s.ovulation);
    if (next) { const d = diff(s.ovulation, next); if (d >= 10 && d <= 17) L.push(d); }
  }
  if (L.length < 2) return { days: 14, own: false, n: L.length };
  L.sort((a, b) => a - b);
  return { days: L[Math.floor(L.length / 2)], own: true, n: L.length };
}

/**
 * The cycle's numbers corrected by the temperature: { ...stats, temp: { ovulation, nextStart, luteal, rise, waiting } }.
 * A rise seen this cycle → ovulation is known and the next period = ovulation + luteal. No rise yet past the usual day →
 * "waiting": ovulation is late, so the period will be later than the average says.
 */
export function withTemperature(stats, nights, todayKey) {
  if (!stats || !stats.last || !nights || nights.length < 9) return { ...stats, temp: null };
  const shifts = tempShifts(nights);
  const starts = (stats.periods || []).map((p) => p.start);
  const lut = lutealLength(starts, shifts);
  const cur = shifts.filter((s) => s.ovulation > stats.last.start).pop();
  if (cur) {
    const nextStart = add(cur.ovulation, lut.days);
    return { ...stats, ovulation: cur.ovulation, nextStart, fertile: { from: add(cur.ovulation, -5), to: add(cur.ovulation, 1) },
      temp: { ovulation: cur.ovulation, nextStart, luteal: lut, rise: cur.rise, waiting: false } };
  }
  const usual = stats.ovulation;
  const waiting = usual && todayKey && diff(usual, todayKey) >= 3 && nights.some((x) => x.day > stats.last.start);
  return { ...stats, temp: { ovulation: null, nextStart: null, luteal: lut, rise: null, waiting: !!waiting } };
}

export const TEMPS_KEY = "attune:cycle:temps:v1";
/** Nights kept on the phone, merged by day (the newest reading of a night wins), 400 nights at most. */
export function mergeNights(old, add) {
  const m = new Map((old || []).map((x) => [x.day, x]));
  for (const x of add || []) if (x && x.day && Number.isFinite(x.t)) m.set(x.day, { day: x.day, t: Math.round(x.t * 100) / 100, kind: x.kind || "" });
  return [...m.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-400);
}
