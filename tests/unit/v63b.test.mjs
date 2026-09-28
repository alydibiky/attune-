// v6.3 logic sweeps: not a few examples — the answers must make sense across every case.
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); } };
const F = await import("../../web-src/fit.js");
const P = await import("../../web-src/fitplus.js");
const R = await import("../../web-src/fitread.js");
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

// ---- calorie targets: every age / size / sex / activity / goal / pace ----
let n = 0; const bad = [];
for (const sex of ["m", "f"]) for (const age of [14, 17, 18, 25, 40, 60, 80]) for (const cm of [150, 165, 180, 195]) for (const kg of [40, 55, 70, 90, 120, 160])
  for (const activity of Object.keys(F.ACTIVITY)) for (const goal of ["lose", "maintain", "gain"]) for (const rate of [0.25, 1]) for (const pregnant of sex === "f" ? [false, true] : [false]) {
    const t = F.targets({ sex, age, cm, kg, activity, goal, rate, goalKg: goal === "lose" ? kg - 10 : kg + 5, diet: "balanced", pregnant }); n++;
    const floor = sex === "m" ? 1500 : 1200, bmi = kg / (cm / 100) ** 2;
    const why = [];
    if (!t) { bad.push(`no plan ${sex} ${age} ${cm} ${kg}`); continue; }
    if (t.kcal < floor) why.push("under the floor");
    if (goal === "lose" && (age < 18 || pregnant || bmi < 18.5) && t.kcal < t.tdee - 5) why.push("a deficit where none is safe");
    if (goal === "gain" && t.kcal < t.tdee) why.push("gain below upkeep");
    if (goal === "lose" && t.tdee - t.kcal > t.tdee * 0.25 + 10 && t.kcal > floor) why.push("deficit over a quarter");
    if (Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.kcal) > t.kcal * 0.06) why.push("macros don't add up");
    if (t.carbs < 0 || t.fat <= 0 || t.protein <= 0) why.push("a negative macro");
    if (why.length) bad.push(`${sex} ${age}y ${cm}cm ${kg}kg ${activity} ${goal} ${rate}${pregnant ? " pregnant" : ""}: ${why.join(", ")}`);
  }
eq(bad.slice(0, 5), [], `${n} profiles: floors, no unsafe deficits, macros add up to the calories`);

// ---- every diet's meal plan over 30 days ----
const tg = F.targets({ sex: "m", age: 30, cm: 175, kg: 85, activity: "moderate", goal: "lose", rate: 0.5, goalKg: 75 });
const planBad = [];
for (const diet of Object.keys(F.DIETS)) for (let s = 0; s < 30; s++) {
  const mp = F.mealPlan(tg, { diet, seed: s });
  const ids = Object.values(mp.meals).map((m) => m.recipe.id);
  if (new Set(ids).size !== ids.length) planBad.push(`${diet} day ${s}: a recipe twice`);
  if (diet === "vegetarian" && Object.values(mp.meals).some((m) => !m.recipe.tags.includes("vegetarian"))) planBad.push(`${diet} day ${s}: meat`);
  if (!(mp.total.kcal > tg.kcal * 0.6 && mp.total.kcal < tg.kcal * 1.2)) planBad.push(`${diet} day ${s}: ${mp.total.kcal} kcal vs ${tg.kcal}`);
}
eq(planBad.slice(0, 5), [], "5 diets × 30 days: no recipe twice a day, vegetarian stays vegetarian, 60–120 % of the target");

// ---- Ramadan: every city, every day of the year ----
const rBad = [];
for (const [k, c] of Object.entries(P.CITIES)) for (let d = 0; d < 365; d += 1) {
  const date = new Date(Date.UTC(2026, 0, 1 + d, 12));
  const t = P.fastTimes(date, c.lat, c.lon, P.zoneOffset(date, c.tz));
  if (t.fajrMin == null || t.maghribMin == null) { rBad.push(`${k} ${d}: no time`); continue; }
  if (!(t.hours >= 10.3 && t.hours <= 17.6)) rBad.push(`${k} day ${d}: a ${t.hours} h fast`);
  if (!(t.fajrMin >= 3 * 60 && t.fajrMin <= 7 * 60)) rBad.push(`${k} day ${d}: Fajr ${t.fajr}`);
  if (!(t.maghribMin >= 16.5 * 60 && t.maghribMin <= 21 * 60)) rBad.push(`${k} day ${d}: Maghrib ${t.maghrib}`);
}
eq(rBad.slice(0, 5), [], "16 cities × 365 days: Fajr 03:00–07:00 (Istanbul winter ≈ 06:40), Maghrib 16:30–21:00, fasts 10–17.5 h, never missing");

// ---- body fat, score, search, reader: behave as they should when inputs change ----
const bf = [80, 90, 100, 110, 120].map((w) => P.bodyFat({ sex: "m", height: 178, waist: w, neck: 40 }));
eq(bf.every((v, i) => i === 0 || v > bf[i - 1]), true, "body fat rises with the waist: " + bf.join(" < "));
const day = (kcal) => ({ meals: { lunch: [{ id: "x", kcal, p: 150, c: 200, f: 60, fib: 30 }] }, water: 3000 });
const s = [0.5, 0.8, 1, 1.3, 1.8].map((k) => P.dayScore(day(Math.round(tg.kcal * k)), tg).score);
eq(s[2] >= s[1] && s[1] >= s[0] && s[2] >= s[3] && s[3] >= s[4], true, "the day's score peaks at the target and falls either side: " + s.join(", "));
eq(["egg", "rice", "koshari", "cola", "banana"].every((id) => R.readMealText(F.food(id).en).items[0]?.id === id || R.readMealText(F.food(id).ar).items[0]?.id === id), true, "the table's own names are always read back to the same food");
const all = F.FOODS.filter((f) => R.readMealText(f.en).items.length === 0 && R.readMealText(f.ar).items.length === 0).map((f) => f.id);
eq(all.length <= F.FOODS.length * 0.05, true, `the reader finds ${F.FOODS.length - all.length} of ${F.FOODS.length} table foods by their own name or Arabic name (missing: ${all.slice(0, 8).join(", ")}${all.length > 8 ? "…" : ""})`);

if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
