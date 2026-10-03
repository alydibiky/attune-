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

// ---- the generated recipe book ----
import { GENERATED_COUNT, getGenerated, generatedId, searchGenerated } from "../../web-src/fit-recipegen.js";
{
  assert(GENERATED_COUNT >= 10000, "count " + GENERATED_COUNT);
  const names = new Set(), arNames = new Set(); const bad = [];
  let minK = 1e9, maxK = 0; const t0 = Date.now();
  for (let g = 0; g < GENERATED_COUNT; g++) {
    const id = generatedId(g), r = getGenerated(id);
    if (!r) { bad.push("null " + id); continue; }
    for (const [i, gr] of r.items) if (!food(i)) bad.push(`${id}: unknown ${i}`); else if (!(gr > 0)) bad.push(`${id}: grams ${i}`);
    const k = recipeNutrients(r).kcal; minK = Math.min(minK, k); maxK = Math.max(maxK, k);
    if (k < 150 || k > 1300) bad.push(`${id} ${r.en}: ${k} kcal`);
    if (names.has(r.en)) bad.push("dup en " + r.en); names.add(r.en);
    if (arNames.has(r.ar)) bad.push("dup ar " + r.ar); arNames.add(r.ar);
    if (!r.steps.length || !/[؀-ۿ]/.test(r.ar) || /undefined|null|\[object/.test(r.en + r.ar + r.steps.join(" "))) bad.push("text " + id);
  }
  if (bad.length) { console.log(bad.slice(0, 15).join("\n")); }
  assert(bad.length === 0, bad.length + " bad generated recipes");
  console.log("generated recipes ok", GENERATED_COUNT, "kcal", minK, "-", maxK, "built in", Date.now() - t0, "ms");
  const t1 = Date.now();
  const r1 = searchGenerated("salmon broccoli", { n: 20, ingredientNames: (i) => (food(i) || {}).names });
  assert(r1.length > 0 && r1.every((r) => /salmon/i.test(r.en + r.items.map(([i]) => i)) && /broccoli/i.test(r.en)), "search finds salmon + broccoli");
  const r2 = searchGenerated("فراخ كوسة", { n: 10 });
  assert(r2.length > 0, "Arabic search works");
  const r3 = searchGenerated("", { tag: "breakfast", n: 12 });
  assert(r3.length === 12 && r3.every((r) => r.tags.includes("breakfast")), "tag filter");
  console.log("search ok in", Date.now() - t1, "ms");
}
