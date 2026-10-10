// Fit & Food home ("Log bar"): one-tap chips, timeline, undo, week chart, the 3-question first visit, data untouched.
import * as H from "../../web-src/fithome.js";
import * as F from "../../web-src/fit.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };

const now = new Date(2026, 9, 4, 13, 0);
const dk = (i) => { const d = new Date(now); d.setDate(d.getDate() - i); return F.today(d); };
const foul = (g, t) => ({ id: "ful", name: "Ful medames", grams: g, kcal: g, p: g / 10, c: g / 5, f: g / 20, fib: 1, t });
const days = {
  [dk(0)]: { meals: { breakfast: [foul(200, 30)] }, water: 500, workouts: [] },
  [dk(1)]: { meals: { breakfast: [foul(300, 20)], lunch: [{ name: "Koshari", grams: 350, kcal: 630, p: 20, c: 110, f: 12, t: 21 }] }, water: 0, workouts: [] },
  [dk(2)]: { meals: { breakfast: [foul(250, 10)], snacks: [{ name: "Tea", grams: 250, kcal: 40, p: 0, c: 10, f: 0, t: 11 }] } },
  [dk(40)]: { meals: { dinner: [{ name: "Old", grams: 100, kcal: 100, t: 1 }] } },
};
const chips = H.frequentChips(days, { from: now });
ok(chips[0].key === "ful" && chips[0].count === 3, "the food eaten most comes first");
ok(chips[0].item.grams === 250 && chips[0].item.kcal === 250, "its chip uses the usual (median) portion with calories scaled: " + chips[0].item.grams);
ok(chips[0].meal === "breakfast", "a chip remembers the meal it is eaten in");
ok(!("t" in chips[0].item), "a chip's item has no old time stamp");
ok(chips[1].key === "koshari", "then the recent foods, newest first");
ok(!chips.some((c) => c.key === "old"), "older than 30 days is left out");
ok(H.frequentChips({}, { from: now }).length === 0 && H.frequentChips(undefined, { from: now }).length === 0, "no log → no chips, no crash");
ok(H.frequentChips(days, { from: now, limit: 2 }).length === 2, "the row is capped");

const tl = H.timeline(days[dk(1)]);
ok(tl.map((e) => e.meal).join() === "breakfast,lunch", "the timeline is in the order eaten");
const r = H.removeAt(days[dk(1)], "lunch", 0);
ok(r.removed.name === "Koshari" && r.day.meals.lunch.length === 0, "delete removes one item and hands it back");
ok(JSON.stringify(H.insertAt(r.day, "lunch", 0, r.removed)) === JSON.stringify(days[dk(1)]), "undo puts it back exactly as it was");

const wk = H.weekKcal(days, now);
ok(wk.length === 7 && wk[6].kcal === 200 && wk[5].kcal === 930, "the week chart has 7 days, today last");

ok(H.atGrams(foul(200), 100).kcal === 100 && H.atGrams({ name: "x", grams: 50 }, 80).grams === 80, "editing grams scales the numbers");

// first visit: 3 questions
const a = H.quickProfile({ goal: "lose", mode: "body", sex: "m", age: "21", cm: "178", kg: "92", country: "eg" });
ok(a.profile && a.country === "eg" && F.targets(a.profile).kcal > 1500, "goal + body numbers make a full plan");
ok(H.quickProfile({ goal: "lose", mode: "body", age: "", cm: "", kg: "" }).error === "body", "missing body numbers are asked again");
const b = H.quickProfile({ goal: "maintain", mode: "kcal", kcal: "2000", country: "sa" });
ok(b.profile.kcalGoal === 2000 && H.targetsOf(b.profile).kcal === 2000, "or just a calorie target");
const tb = H.targetsOf(b.profile);
ok(Math.abs(tb.protein * 4 + tb.carbs * 4 + tb.fat * 9 - 2000) < 20, "the calorie target splits into macros that add up");
ok(H.quickProfile({ mode: "kcal", kcal: "100" }).error === "kcal", "an impossible target is refused");

// existing data is untouched: an old plan gives exactly the old targets, and nothing is rewritten
const old = { profile: { sex: "m", age: 21, cm: 178, kg: 92, activity: "light", goal: "lose", rate: 0.5, goalKg: 80, diet: "balanced" }, days, weights: [], fast: null, myRecipes: [], favs: ["x"], favFoods: [{ id: "ful" }] };
const before = JSON.stringify(old);
ok(JSON.stringify(H.targetsOf(old.profile)) === JSON.stringify(F.targets(old.profile)), "an old plan: same targets as before");
H.frequentChips(old.days, { from: now }); H.timeline(old.days[dk(0)]); H.weekKcal(old.days, now);
ok(JSON.stringify(old) === before, "reading the home never changes the stored log, plan or favourites");

const sg = H.countrySuggestions("eg", "breakfast", 3);
ok(sg.length === 3 && sg.every((s) => s.item.kcal > 0 && s.item.grams > 0 && s.ar), "suggestions come from the country's dishes, with calories: " + sg.map((s) => s.en).join(", "));
ok(H.countrySuggestions("jp", "dinner", 2).length === 2, "another country works too");
