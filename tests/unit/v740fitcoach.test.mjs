// v6.38 (F2) — the coach that adapts every week. node tests/unit/v740fitcoach.test.mjs
import assert from "node:assert/strict";
import { slope, adaptiveTdee, weeklyAdapt } from "../../web-src/fitcoach.js";
import { today } from "../../web-src/fit.js";
const now = new Date(2026, 9, 18, 12).getTime(), D = 86400000;
const day = (n) => today(new Date(now - n * D));
const meal = (k) => ({ meals: { lunch: [{ name: "x", kcal: k, p: 0, c: 0, f: 0 }] } });
assert.ok(Math.abs(slope([{ x: 0, y: 90 }, { x: 7, y: 89.5 }, { x: 14, y: 89 }]) + 1 / 14) < 1e-9);
// 28 days at 2,000 kcal, losing 0.5 kg a week (with water noise) → burns about 2,000 + 0.5 × 7700 / 7 = 2,550
const days = {}; for (let i = 0; i < 28; i++) days[day(i)] = meal(2000);
days[day(3)] = meal(300);   // a half-logged day: not counted
const weights = []; for (let i = 27; i >= 0; i -= 3) weights.push({ d: day(i), kg: 90 - (27 - i) * 0.5 / 7 + (i % 2 ? 0.3 : -0.3) });
const a = adaptiveTdee({ days, weights, formulaTdee: 2300, now });
assert.ok(a.ready); assert.equal(a.days, 27);
assert.ok(Math.abs(a.measured - 2550) < 120, "measured " + a.measured);
assert.ok(a.used > 2300 && a.used <= a.measured + 10, "blended toward the measurement: " + a.used);
assert.ok(a.perWeek < -0.4 && a.perWeek > -0.6);
// not enough data → says what is missing
assert.equal(adaptiveTdee({ days: { [day(0)]: meal(2000) }, weights, formulaTdee: 2300, now }).why, "days");
assert.equal(adaptiveTdee({ days, weights: weights.slice(-2), formulaTdee: 2300, now }).why, "weights");
// the weekly step: at most 150 kcal, once a week
const r = weeklyAdapt({ kg: 88 }, { days, weights }, 2300, now);
assert.equal(r.profile.adapt.tdee, 2450); assert.ok(r.changed);
assert.match(r.line[0], /lost \{kg\} kg a week/);
const again = weeklyAdapt(r.profile, { days, weights }, 2300, now + 2 * D);
assert.equal(again.profile, r.profile, "not again within the week");
const week2 = weeklyAdapt(r.profile, { days, weights }, 2300, now + 8 * D);
assert.ok(week2.profile.adapt.tdee > 2450 || week2.a.why, "next week moves on toward the measurement");
console.log("v740fitcoach: all passed");
