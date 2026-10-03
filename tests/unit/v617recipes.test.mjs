import { RECIPES, recipeNutrients, food } from "../../web-src/fit.js";
import { EXTRA_RECIPES } from "../../web-src/fit-recipes2.js";
import assert from "node:assert";
const ids = new Set();
for (const r of EXTRA_RECIPES) {
  assert(!ids.has(r.id), "dup " + r.id); ids.add(r.id);
  assert(r.ar && r.en && r.steps.length >= 1, "text " + r.id);
  for (const [i, g] of r.items) { assert(food(i), `${r.id}: unknown ${i}`); assert(g > 0, r.id + " grams"); }
  const n = recipeNutrients(r); const k = n.kcal ?? n.cal ?? n.energy;
  assert(k > 40 && k < 1400, `${r.id} kcal/serving ${k}`);
}
assert(RECIPES.length >= 54 + EXTRA_RECIPES.length - 5);
console.log("recipes ok", EXTRA_RECIPES.length, RECIPES.length);
