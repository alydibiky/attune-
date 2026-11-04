// v7.3: Health in two levels (Gemini's Area 2 mock-up) — the Health Report's numbers, by code from Fit, Family health and Cycle.
import { fitWeek, weightTrend, medsWeek, latestLab, cycleSummary, healthReport } from "../../web-src/health-report.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const now = new Date("2026-10-24T18:00:00").getTime();
const k = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const M = (kcal, p = 20) => ({ name: "x", grams: 100, kcal, p, c: 10, f: 5 });
const fit = { profile: { sex: "f", age: 29, cm: 165, kg: 64, activity: "light", goal: "lose", rate: 0.5, goalKg: 60, kcalGoal: 1400 },
  days: { [k(0)]: { meals: { lunch: [M(615)] }, water: 1500 }, [k(1)]: { meals: { lunch: [M(1400)] }, water: 2000, workouts: [{ kcal: 200 }] },
    [k(2)]: { meals: { lunch: [M(1600)] }, water: 2000 }, [k(3)]: { meals: { lunch: [M(1300)] }, water: 2000, workouts: [{ kcal: 150 }] } },
  weights: [{ d: k(40), kg: 66 }, { d: k(25), kg: 65.4 }, { d: k(10), kg: 65 }, { d: k(2), kg: 64.6 }] };
const w = fitWeek(fit, now);
ok(w.rows.length === 7 && w.rows[6].today && w.rows[6].kcal === 615, "7 days, today last (615 so far)");
ok(w.avg === Math.round((1400 + 1600 + 1300) / 3), "the average leaves out today and empty days: " + w.avg);
ok(w.tg && w.tg.kcal > 0 && w.rows[4].above && !w.rows[5].above, "a day above the target is marked (kindly), the others not");
ok(w.water === 1.9 && w.workouts === 2, "water per day (L) and workouts this week: " + w.water + " / " + w.workouts);
const wt = weightTrend(fit, now);
ok(wt && wt.last === 64.6 && wt.goal === 60 && wt.change < 0, "weight: the latest, the goal, going down: " + JSON.stringify({ last: wt.last, change: wt.change }));
ok(weightTrend({ weights: [] }, now) === null, "no weights → nothing");
const care = { members: [{ id: "me", name: "Me" }, { id: "mom", name: "Mom" }],
  meds: [{ id: "m1", member: "mom", name: "Metformin", dose: "1 tablet", times: ["09:00", "21:00"], start: k(30), days: 0, stock: 30, stockAt: 1 },
    { id: "m2", member: "me", name: "Vitamin D", dose: "1 capsule", times: ["10:00"], start: k(30), days: 0 }],
  labs: [{ member: "mom", test: "HbA1c", value: 6.8, unit: "%", low: 4, high: 5.6, date: "2025-11-01" }, { member: "mom", test: "HbA1c", value: 5.9, unit: "%", low: 4, high: 5.6, date: "2026-10-01" }],
  taken: {} };
for (let i = 1; i <= 6; i++) { care.taken["m1|" + k(i) + "|09:00"] = 1; care.taken["m1|" + k(i) + "|21:00"] = 1; if (i % 2) care.taken["m2|" + k(i) + "|10:00"] = 1; }
care.taken["m1|" + k(0) + "|09:00"] = 1;
const md = medsWeek(care, now);
// due: m1 = 6×2 + today 09:00 (21:00 not yet) = 13; m2 = 6 + today 10:00 = 7 → 20; taken 13 + 3 = 16
ok(md.due === 20 && md.taken === 16 && md.pct === 80, "doses due this week (later today not counted yet) and taken: " + md.taken + "/" + md.due);
ok(md.rows.find((r) => r.med.id === "m1").pct === 100 && md.rows.find((r) => r.med.id === "m1").left === 30 - 13, "Metformin 100%, and what is left: " + md.rows.find((r) => r.med.id === "m1").left);
const lab = latestLab(care);
ok(lab && lab.test === "HbA1c" && lab.member === "Mom" && lab.history.change === -0.9, "the latest lab with its history: HbA1c 6.8 → 5.9");
const stats = (st, today) => ({ inPeriod: false, cycleDay: 31, late: 2, nextStart: k(2), cycleLen: 28, periodLen: 5, last: { start: k(30) }, known: 2, fertile: null });
const cs = cycleSummary({ days: { [k(30)]: { flow: "medium" } } }, now, stats);
ok(cs && cs.late === 2 && cs.cycleLen === 28 && cs.daysTo === -2, "cycle in a few words, from Cycle's own statistics");
ok(cycleSummary({ days: {} }, now, stats) === null, "no cycle logged → nothing");
const all = healthReport({ fit: null, care: null, cycle: null, now });
ok(all.fit.rows.length === 7 && all.fit.avg === 0 && all.weight === null && all.meds.pct === null && all.lab === null && all.cycle === null, "nothing set up → an empty report that does not break");
console.log(fail ? "FAIL " + fail : "PASS all");
