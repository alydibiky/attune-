// v6.14 — Fit has everything Yazio has: quick add, fasting stages, goal per weekday, measurements, averages, export.
import assert from "node:assert/strict";
import * as Y from "../../web-src/fityazio.js";
assert.equal(Y.quickItem({ kcal: "350", p: "20" }).kcal, 350); assert.equal(Y.quickItem({ kcal: "350" }).name, "Quick add");
assert.equal(Y.quickItem({ kcal: "abc" }), null); assert.equal(Y.quickItem({ kcal: 0 }), null);
assert.match(Y.fastStage(13).now[1], /Fat burning begins/); assert.equal(Y.fastStage(13).inH, 3);
assert.match(Y.fastStage(40).now[1], /Deep ketosis/); assert.equal(Y.fastStage(40).next, null);
// +300 on Thu (4) and Fri (5): those days 2300, the other 5 days give 120 each — the week stays 7 × 2000
const ex = { 4: 300, 5: 300 }, wk = ["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"];
const goals = wk.map((d) => Y.dayGoal(2000, d, ex));
assert.deepEqual(goals, [1880, 1880, 1880, 1880, 2300, 2300, 1880]); assert.equal(goals.reduce((a, b) => a + b, 0), 14000);
assert.equal(Y.dayGoal(2000, "2026-10-10", {}), 2000);
let m = Y.addMeasure([], { d: "2026-09-01", waist: "98", hip: "105" }); m = Y.addMeasure(m, { d: "2026-10-01", waist: "94.5" });
assert.deepEqual(Y.measureChange(m).waist, { first: 98, last: 94.5, change: -3.5, since: "2026-09-01" });
assert.equal(Y.addMeasure(m, { d: "2026-10-02", waist: "" }), m, "an empty entry adds nothing");
const days = { "2026-10-09": { meals: { lunch: [{ name: "Koshary, large", grams: 400, kcal: 700, p: 20, c: 120, f: 15 }] } }, "2026-10-10": { meals: { breakfast: [{ name: "Eggs", grams: 100, kcal: 150, p: 12, c: 1, f: 10 }] } } };
const a = Y.nutritionAverages(days, 7, new Date("2026-10-10T12:00:00"));
assert.equal(a.days, 2); assert.equal(a.kcal, 425); assert.equal(a.split.p + a.split.c + a.split.f >= 99, true);
const csv = Y.diaryCSV(days);
assert.equal(csv.split("\n").length, 3); assert.match(csv, /2026-10-09,lunch,"Koshary, large",400,700,20,120,15/);
console.log("v720fityazio ok");
