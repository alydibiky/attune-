// Unit tests for v5.42: Fit & Food — the food table, reading a meal, the plan, meal plans, workouts, recipes.
import * as F from "../../web-src/fit.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

// ---- the table: big, no duplicate ids, every recipe ingredient exists ----
const ids = F.FOODS.map((f) => f.id);
eq([F.FOODS.length >= 350, new Set(ids).size === ids.length, F.RECIPES.length >= 50], [true, true, true], "350+ foods with unique ids, 50+ recipes");
eq(F.RECIPES.flatMap((r) => r.items.map(([id]) => id)).filter((id) => !F.food(id)), [], "every recipe ingredient is in the table");
eq(F.FOODS.filter((f) => !(f.kcal >= 0 && f.kcal <= 900 && f.p >= 0 && f.c >= 0 && f.f >= 0)).map((f) => f.id), [], "every food has sane per-100 g values");

// ---- names in English, Egyptian and Gulf Arabic ----
eq(["كشري", "فتة", "شاورما لحمة", "بيتزا فراخ", "كبسة", "اندومي", "boiled egg", "baladi bread"].map((n) => (F.matchFood(n) || {}).id),
  ["koshari", "fatta", "meat-shawarma", "pizza-chicken", "kabsa", "noodles", "egg", "baladi"], "food names matched");
eq(F.searchFoods("كشري", 3).map((f) => f.id)[0], "koshari", "search finds a food by its Arabic name");

// ---- a sentence read by code (no model) ----
const q = F.quickParse("٢ بيض ورغيف عيش بلدي وطبق فول");
eq(q.map((x) => [x.id, x.qty]), [["egg", 2], ["baladi", 1], ["ful", 1]], "«٢ بيض ورغيف عيش وطبق فول» → 3 foods with amounts");
eq(q.every((x) => x.kcal > 0 && !x.estimate), true, "…with the table's calories, not guesses");
eq(F.quickParse("2 eggs, 1 slice of toast and a cup of milk").length >= 2, true, "English list read too");

// ---- the model's reading: table values win; an estimate is sanity-checked ----
const m = F.parseMeal('{"items":[{"food":"koshari","qty":1,"unit":"plate","kcal_per_100g":999},{"food":"mystery pie","qty":100,"unit":"g","kcal_per_100g":300,"protein_per_100g":50,"carbs_per_100g":50,"fat_per_100g":50}]}');
eq([m[0].id, m[0].estimate, m[0].kcal === Math.round(F.food("koshari").kcal * m[0].grams / 100)], ["koshari", false, true], "a known food uses the table (the model's 999 kcal is ignored)");
eq([m[1].estimate, m[1].kcal, Math.round(m[1].p * 4 + m[1].c * 4 + m[1].f * 9) <= 330], [true, 300, true], "an unknown food's macros are rescaled to match its calories");

// ---- the plan (Mifflin-St Jeor) and its safety rules ----
const tg = F.targets({ sex: "m", age: 21, cm: 178, kg: 92, activity: "light", goal: "lose", rate: 0.5, goalKg: 80 });
eq([tg.bmr, tg.kcal, tg.protein > 140, tg.weeks > 20], [1933, 2110, true, true], "21 y, 178 cm, 92 kg: BMR 1933, 2110 kcal to lose 0.5 kg a week");
eq(F.targets({ sex: "f", age: 16, cm: 160, kg: 60, goal: "lose" }).goal, "maintain", "under 18 → no diet");
eq(F.targets({ sex: "f", age: 30, cm: 170, kg: 50, goal: "lose" }).goal, "maintain", "BMI under 18.5 → no diet");
eq(F.targets({ sex: "f", age: 30, cm: 150, kg: 45, activity: "sedentary", goal: "lose", rate: 1 }).kcal >= 1200, true, "never under 1200 kcal (women)");

// ---- a day's meal plan, sized by code ----
const mp = F.mealPlan(tg, { seed: 1 });
eq([Object.keys(mp.meals).length, Math.abs(mp.total.kcal - tg.kcal) < tg.kcal * 0.15], [4, true], "4 meals within 15% of the target");
const veg = F.mealPlan(tg, { diet: "vegetarian", seed: 2 });
eq(Object.values(veg.meals).every((x) => x.recipe.tags.includes("vegetarian")), true, "vegetarian plan uses vegetarian recipes only");
eq(F.mealPlan(tg, { seed: 1 }).meals.lunch.recipe.id !== F.mealPlan(tg, { seed: 2 }).meals.lunch.recipe.id || F.mealPlan(tg, { seed: 3 }).meals.lunch.recipe.id !== F.mealPlan(tg, { seed: 1 }).meals.lunch.recipe.id, true, "different days get different meals");

// ---- the day, streaks, water ----
const d0 = F.today(), y = new Date(); y.setDate(y.getDate() - 1);
const days = { [d0]: { meals: { breakfast: q }, water: 750, workouts: [{ kcal: 200 }] }, [F.today(y)]: { meals: { lunch: [{ kcal: 500, p: 20, c: 60, f: 10 }] } } };
const tot = F.dayTotals(days[d0]);
eq([tot.kcal === F.sumN(q).kcal, tot.burned, tot.water], [true, 200, 750], "day totals: eaten, burned, water");
eq(F.streak(days), 2, "2 days in a row logged");

// ---- workouts: MET formula, plans, matching ----
eq(F.burned(4.3, 80, 30), 172, "brisk walk 30 min at 80 kg ≈ 172 kcal (MET × kg × h)");
eq([(F.matchExercise("مشي") || {}).id != null, (F.matchExercise("football") || {}).id != null], [true, true], "activities matched in Arabic and English");
eq(F.PLANS.find((p) => p.id === "hiit-7").en, "Quick HIIT — 8 moves", "the HIIT plan's name matches its real length");
eq(F.planCost(F.PLANS[0].workout, 80).minutes > 10, true, "a plan's minutes are computed");

// ---- recipes from the model: only table foods counted ----
const rc = F.parseRecipe('{"name":"Egg salad","serves":2,"minutes":10,"ingredients":[{"food":"boiled egg","grams":200},{"food":"dragon sauce","grams":20}],"steps":["Mix"]}');
eq([rc.items.length, rc.unknown.length, F.recipeNutrients(rc).kcal > 100], [1, 1, true], "a model recipe: known foods counted, the rest listed as not counted");

// ---- the Chat chip ----
eq(["I ate 2 eggs and a loaf of bread", "كلت طبق كشري", "what did you eat?", "How many calories in koshari?"].map(F.looksLikeFoodLog), [true, true, false, false], "“I ate…” offers Fit; questions don't");

if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
