// v8.7 health from the watch (persona 4, idea 15)
import assert from "node:assert/strict";
import { mergeVitals, bpIntoCare, sleepIntoFit, vitalsWeek } from "../../web-src/vitals.js";
let n = 0; const t = (name, f) => { f(); n++; };
const now = new Date(2026, 9, 28, 12).getTime(), DAY = 864e5;
const iso = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const days = [];
for (let i = 36; i >= 0; i--) {
  const d = { day: iso(now - i * DAY), restHr: i < 7 && i >= 3 ? 70 : 60, hrv: i < 7 ? 30 : 50, sleepMin: i < 7 ? 330 : 450, spo2: 96, spo2Min: i === 2 ? 89 : 94 };
  if (i === 1) d.bp = [{ sys: 150, dia: 95, at: now - DAY }];
  if (i === 0) d.bp = [{ sys: 120, dia: 78, at: now - 3600e3 }];
  days.push(d);
}
const v = mergeVitals({ days: { "2026-01-01": { day: "2026-01-01", restHr: 50 } } }, { days, granted: 5, of: 7 }, now);

t("the watch's days are kept (120 days back), the newest read wins", () => {
  assert.ok(!v.days["2026-01-01"], "older than 120 days drops"); assert.equal(Object.keys(v.days).length, 37); assert.equal(v.granted, 5);
  const v2 = mergeVitals(v, { days: [{ day: iso(now), restHr: 58 }] }, now); assert.equal(v2.days[iso(now)].restHr, 58); assert.equal(v2.days[iso(now)].hrv, 30);
});
t("the week flags only what is off against the person's own usual", () => {
  const w = vitalsWeek(v, now);
  assert.deepEqual(w.flags.sort(), ["bp", "restHr", "sleep", "spo2", "stress"]);
  assert.equal(w.lines[0].level, "red");
  const L = w.lines.map((l) => l.en).join("\n");
  assert.match(L, /Blood pressure: 135\/87 on average \(2 readings\) — 1 high; show a doctor/);
  assert.match(L, /Oxygen \(SpO₂\): 96% on average — under 92% on 1 day; talk to a doctor/);
  assert.match(L, /Sleep: 5 h 30 min a night — under 6 hours/);
  assert.match(L, /Resting heart rate: 66 \(usually 60\) — higher than usual/);
  assert.match(L, /Stress \(HRV\): 30 ms \(usually 50\) — lower than usual/);
  assert.match(w.lines.map((l) => l.ar).join("\n"), /النوم: 5 ساعة و30 دقيقة/);
  assert.equal(w.rows.length, 7);
});
t("a calm week flags nothing", () => {
  const calm = { days: Object.fromEntries(days.map((d) => [d.day, { day: d.day, restHr: 60, hrv: 50, sleepMin: 450, spo2: 97, spo2Min: 95 }])) };
  const w = vitalsWeek(calm, now); assert.equal(w.flags.length, 0); assert.ok(w.lines.every((l) => l.level === "ok"));
  assert.equal(vitalsWeek({ days: {} }, now).has, false);
});
t("blood pressure goes into Family health once; sleep into Fit where it wasn't logged", () => {
  const c1 = bpIntoCare({ labs: [] }, v), c2 = bpIntoCare(c1, v);
  assert.equal(c1.labs.length, 2); assert.equal(c2.labs.length, 2); assert.equal(c1.labs[0].source, "watch"); assert.equal(c1.labs[0].value, 150);
  const f = sleepIntoFit({ days: { [iso(now)]: { sleep: 480 } } }, v);
  assert.equal(f.days[iso(now)].sleep, 480, "the person's own entry stays"); assert.equal(f.days[iso(now - DAY)].sleep, 330); assert.equal(f.days[iso(now - DAY)].sleepFrom, "watch");
});
console.log(`v870vitals: ${n} checks passed`);
import { morningCard } from "../../web-src/morning.js";
t("the morning card says the first thing that is off", () => {
  const c = morningCard({ vitals: v }, now, "en"); assert.ok(c.lines.some((l) => /^Blood pressure: .* show a doctor/.test(l)), c.lines.join(" | "));
});
console.log(`v870vitals (+ morning): ${n} checks passed`);
