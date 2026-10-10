// v6.13 — copy food from day to day, like Yazio (fitplus.js copyFood).
import assert from "node:assert/strict";
import { copyFood } from "../../web-src/fitplus.js";
const days = { "2026-10-09": { meals: { breakfast: [{ name: "Eggs", grams: 100, kcal: 155, t: 1 }], lunch: [{ name: "Koshary", grams: 350, kcal: 600, t: 2 }] }, water: 1500, workouts: [] },
  "2026-10-10": { meals: { breakfast: [{ name: "Tea", grams: 250, kcal: 2, t: 3 }] }, water: 0, workouts: [] } };
let d = copyFood(days, "2026-10-09", "2026-10-10", "breakfast", "breakfast", 100);
assert.deepEqual(d["2026-10-10"].meals.breakfast.map((x) => x.name), ["Tea", "Eggs"], "added to what is there");
assert.equal(d["2026-10-10"].meals.breakfast[1].t, 100, "fresh time");
assert.equal(days["2026-10-10"].meals.breakfast.length, 1, "the original is not changed");
d = copyFood(days, "2026-10-09", "2026-10-10", "lunch", "dinner");
assert.equal(d["2026-10-10"].meals.dinner[0].name, "Koshary", "to another meal");
d = copyFood(days, "2026-10-09", "2026-10-12");
assert.deepEqual(Object.keys(d["2026-10-12"].meals).sort(), ["breakfast", "lunch"], "the whole day, to an empty day");
assert.equal(d["2026-10-12"].water, 0, "water is not copied");
assert.equal(copyFood(days, "2026-10-09", "2026-10-09", "lunch", "lunch"), days, "copying onto itself does nothing");
assert.equal(copyFood(days, "2026-10-01", "2026-10-10"), days, "an empty day copies nothing");
console.log("v717copyfood ok");
