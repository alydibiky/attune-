// Unit tests for web-src/crane.js — each expected value worked out by hand.
import { parseChart, chartCapacity, liftCheck, outriggerPressure, slingTension, windCheck, windAtHeight, beaufort } from "../../web-src/crane.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

const chart = parseChart(`m\t12\t20\t30
3\t60\t45\t-
5\t42\t38\t30
10\t20\t19\t17
20\t-\t6.5\t6`);
eq(chart.booms, [12, 20, 30], "chart: boom lengths from the header");
eq(chart.radii, [3, 5, 10, 20], "chart: radii down the side");
eq(chart.problems, [], "chart: no problems");
eq(chartCapacity(chart, 5, 20).cap, 38, "exact point: 5 m radius, 20 m boom → 38 t");
eq(chartCapacity(chart, 7, 25).cap, 17, "in between (7 m, 25 m boom): lowest of 38/30/19/17 → 17 t, never interpolated up");
eq(chartCapacity(chart, 20, 12).cap, null, "an empty cell ('-') means not permitted");
eq(chartCapacity(chart, 25, 20).cap, null, "beyond the largest radius: not permitted");
eq(chartCapacity(chart, 4, 30).cap, null, "next to an empty cell: not permitted");
eq(parseChart("12 20\n5 40 30").cap, [[40, 30]], "header without a label, spaces as separators");

let l = liftCheck({ load: 14.5, hook: 0.8, rigging: 0.3, capacity: 22.3 });
eq([l.gross, l.pct, l.level], [15.6, 70, "ok"], "lift 14.5 + 0.8 hook + 0.3 rigging on 22.3 t → 15.6 t, 70 %, OK");
l = liftCheck({ load: 18, hook: 0.8, rigging: 0.3, capacity: 22.3 });
eq([l.pct, l.level], [85.7, "plan"], "19.1 t on 22.3 t = 85.7 % → needs a written lift plan");
l = liftCheck({ load: 21, hook: 0.8, rigging: 0.3, capacity: 22.3 });
eq([l.pct, l.level, l.ok], [99.1, "stop", false], "99 % → stop and replan");
eq(liftCheck({ load: 23, capacity: 22.3 }).level, "over", "over the chart → over");

let o = outriggerPressure({ force: 60, matL: 1.2, matW: 1.2, allowable: 300 });
eq([o.forceKN, o.pressure, o.ok, o.needArea, o.needSide], [589, 409, false, 1.96, 1.4], "60 t on a 1.2×1.2 mat = 409 kN/m² > 300 → needs 1.96 m² (1.4 m square)");
o = outriggerPressure({ craneMass: 48, counterweight: 22, gross: 15.6, matL: 2, matW: 2, allowable: 300 });
eq([o.estimated, o.forceT, o.pressure, o.ok], [true, 64.2, 157, true], "no force given: 75 % of (48+22+15.6) = 64.2 t → 157 kN/m² on 2×2 m, OK on 300");

let s = slingTension({ load: 10, legs: 2, angle: 30 });
eq([s.perLeg, s.included, s.level], [5.77, 60, "ok"], "10 t, 2 legs at 30° from vertical → 5.77 t per leg");
s = slingTension({ load: 10, legs: 4, angle: 45 });
eq([s.carrying, s.perLeg, s.level], [2, 7.07, "ok"], "4 legs counted as 2 carrying: 7.07 t per leg at 45°");
s = slingTension({ load: 10, legs: 4, angle: 45, allLegs: true });
eq(s.perLeg, 3.54, "all 4 legs sharing (engineered): 3.54 t");
eq(slingTension({ load: 10, legs: 2, angle: 65 }).level, "stop", "65° from vertical → not allowed");

let w = windCheck({ vChart: 9.8, mass: 5, area: 20, cw: 1.2, vNow: 6 });
eq([w.windArea, w.vAllowed, w.reduced, w.forceKN, w.ok], [24, 4.9, true, 0.54, false], "5 t panel of 20 m²: allowed wind drops from 9.8 to 4.9 m/s; 6 m/s is too much");
w = windCheck({ vChart: 9.8, mass: 20, area: 8, vNow: 7 });
eq([w.vAllowed, w.reduced, w.ok], [9.8, false, true], "a compact 20 t load keeps the chart's 9.8 m/s");
eq(Math.round(windAtHeight(8, 10, 50) * 100) / 100, 10.02, "8 m/s at 10 m → 10.02 m/s at 50 m (α 0.14)");
eq(beaufort(10), 5, "10 m/s is Beaufort 5");

console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
process.exit(fails.length ? 1 : 0);
