// Persona 8 (the AI model tester, 28 Oct 2026): what the code now catches before the person sees it.
import assert from "node:assert/strict";
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] };
const V = await import("../../web-src/verify.js");
const F = await import("../../web-src/fit.js");
const R = await import("../../web-src/fitread.js");
let n = 0; const t = (name, fn) => { fn(); n++; };

t("Arabic-Indic digits make a word problem", () => {
  assert.equal(V.looksLikeMathProblem("عندي ٢٢٠٠٠ هتتقسم على ٩ شهور، كل شهر كام؟"), true);
  assert.equal(V.looksLikeMathProblem("محمد عنده ضعف فلوس أحمد، ومع بعض معاهم ٩٠٠٠ جنيه. أحمد معاه كام؟"), true);
});
t("the solver is told how reversed percentages work", () => {
  assert.match(V.solveMessages("x")[0].content, /÷ \(1 − d\)/);
});
const est = (txt, k) => F.writtenItem(JSON.stringify({ qty: 1, unit: "plate", grams_each: 300, kcal_per_100g: k, protein_per_100g: 10, carbs_per_100g: 40, fat_per_100g: 12 }), txt, {}).item;
t("an AI estimate far above the table is pulled back", () => {
  const it = est("a plate of koshari", 380), c = F.checkWritten(it, R.readMealText("a plate of koshari").items);
  assert.equal(c.checked, "pulled"); assert.ok(c.kcal < it.kcal && c.kcal > 600, String(c.kcal)); assert.equal(c.aiKcal, it.kcal);
});
t("a believable estimate is kept", () => {
  const it = est("a plate of koshari", 190), c = F.checkWritten(it, R.readMealText("a plate of koshari").items);
  assert.equal(c.kcal, it.kcal); assert.equal(c.checked, "table");
});
t("no table food → the estimate stays as it is", () => {
  const it = est("zzqx dish", 380); assert.equal(F.checkWritten(it, []), it);
});
const RS = await import("../../web-src/research.js");
t("who-made-it questions are offered a web check", () => {
  for (const q of ["مين اللي غنى أنا لك على طول؟", "who sang ana lak ala tool", "مين مؤلف رواية بين القصرين"]) assert.equal(RS.needsWeb(q), true, q);
  assert.equal(RS.needsWeb("what's the capital of Egypt"), false);
});
t("an ANSWER print without the f becomes an f-string", () => {
  assert.equal(V.repairAnswerLines('print("ANSWER: {full_months} months")'), 'print(f"ANSWER: {full_months} months")');
  assert.equal(V.repairAnswerLines("    print('ANSWER: {x:.2f} EGP')"), "    print(f'ANSWER: {x:.2f} EGP')");
  assert.equal(V.repairAnswerLines('print(f"ANSWER: {x}")'), 'print(f"ANSWER: {x}")');
  assert.equal(V.repairAnswerLines('print("ANSWER: 21 months")'), 'print("ANSWER: 21 months")');
});
console.log(`v860p8: ${n} checks passed`);
