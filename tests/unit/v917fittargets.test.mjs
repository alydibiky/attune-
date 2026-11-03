// v9.0 (Ali: "99 percent accurate"): the daily target against Mifflin–St Jeor worked out by hand, and the safety rules.
import { targets } from "../../web-src/fit.js";
let bad = 0; const ok = (c, m, x) => { if (!c) { bad++; console.log("FAIL " + m + (x !== undefined ? "  " + JSON.stringify(x) : "")); } };
// man 80 kg, 180 cm, 30 y: BMR = 10·80 + 6.25·180 − 5·30 + 5 = 1,780
let t = targets({ kg: 80, cm: 180, age: 30, sex: "m", activity: "light", goal: "maintain" });
ok(t.bmr === 1780, "man 80 kg · 180 cm · 30 y → BMR 1,780", t.bmr);
ok(t.bmi === 24.7, "BMI 24.7", t.bmi);
// woman 60 kg, 165 cm, 25 y: 600 + 1031.25 − 125 − 161 = 1,345
t = targets({ kg: 60, cm: 165, age: 25, sex: "f", activity: "light", goal: "maintain" });
ok(t.bmr === 1345, "woman 60 kg · 165 cm · 25 y → BMR 1,345", t.bmr);
// losing 0.5 kg a week = 550 kcal a day under what you burn
t = targets({ kg: 80, cm: 180, age: 30, sex: "m", activity: "light", goal: "lose", rate: 0.5 });
ok(t.tdee - t.kcal >= 540 && t.tdee - t.kcal <= 560, "lose 0.5 kg a week → about 550 kcal a day less", [t.tdee, t.kcal]);
// never below the floor
t = targets({ kg: 50, cm: 155, age: 60, sex: "f", activity: "sedentary", goal: "lose", rate: 1 });
ok(t.kcal >= 1200, "a woman's target never under 1,200", t.kcal);
t = targets({ kg: 60, cm: 165, age: 30, sex: "m", activity: "sedentary", goal: "lose", rate: 1 });
ok(t.kcal >= 1500, "a man's target never under 1,500", t.kcal);
// under 18 / pregnant / BMI under 18.5 → no weight loss
ok(targets({ kg: 70, cm: 170, age: 16, sex: "m", goal: "lose" }).goal === "maintain", "under 18: no diet");
ok(targets({ kg: 65, cm: 165, age: 28, sex: "f", goal: "lose", pregnant: true }).goal === "maintain", "pregnant: no diet");
ok(targets({ kg: 48, cm: 170, age: 25, sex: "f", goal: "lose" }).goal === "maintain", "BMI under 18.5: no losing more");
// the pace is capped at a quarter of daily energy
t = targets({ kg: 70, cm: 170, age: 30, sex: "m", activity: "sedentary", goal: "lose", rate: 1 });
ok(t.tdee - t.kcal <= Math.round(t.tdee * 0.25) + 10, "loss capped at a quarter of what you burn", [t.tdee, t.kcal]);
// the macros add up to the calories (within rounding)
t = targets({ kg: 80, cm: 180, age: 30, sex: "m", activity: "moderate", goal: "maintain" });
ok(Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.kcal) <= 15, "protein + carbs + fat add up to the target", [t.protein, t.carbs, t.fat, t.kcal]);
console.log(bad ? bad + " FAILED" : "PASS v917fittargets: daily targets match Mifflin–St Jeor and the safety rules");
