// v10.8 (Ali, 22 Nov 2026: "U never fix it for good … what's the use of AI if it didn't do anything"): money the code wasn't sure of is
// re-read by the model with HIS categories; code checks the answer (his categories only, his amount, words from his sentence); the result
// card shows the change with "Put back" (e2e_v1080moneyai). Also: a sentence that says money was SPENT is never turned into an agent
// ("New agent: 25000 egp expense · Amazon, noon…"). 2,500 cases of tests/moneyai/gen.mjs (10,000: 100 %, held-out 100 %, 98 % shapes).
process.env.N = "2500";
const { RESULT } = await import("../moneyai/gen.mjs");
const { verify, needsCheck } = await import("../../web-src/moneyai.js");
const fs = await import("fs");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const L = { customCats: [{ id: "c_nada", en: "masroof nada", ar: "مصروف ندى" }] };
const item = { type: "expense", amount: 25000, cat: "other", note: "for nada's winter stuff" };
ok(needsCheck(item, "paid 25000 for nada's winter stuff", L), "an Others item is checked by the AI");
ok(!needsCheck({ type: "expense", amount: 150, cat: "food", note: "lunch" }, "lunch 150", L), "a clear one (lunch 150 → Food) is not — no time or battery wasted");
ok(verify('{"items":[{"amount":25000,"cat":"c_nada","note":"winter stuff"}]}', "paid 25000 for nada's winter stuff", L, [item])[0].cat === "c_nada", "a right answer is taken");
ok(!verify('{"items":[{"amount":25000,"cat":"clothes","note":"winter stuff"}]}', "paid 25000 for nada's winter stuff", L, [item]).length, "a category that isn't his is refused");
ok(!verify('{"items":[{"amount":2500,"cat":"c_nada","note":"winter stuff"}]}', "paid 25000 for nada's winter stuff", L, [item]).length, "an amount he didn't write is refused");
ok(verify('{"items":[{"amount":25000,"cat":"c_nada","note":"Zara coat"}]}', "paid 25000 for nada's winter stuff", L, [item])[0].note === item.note, "words he didn't write never become the note");
const A = fs.readFileSync(new URL("../../web-src/attune.jsx", import.meta.url), "utf8");
ok(/window\.__attuneMoneyAi = modelState === "ready"/.test(A) && /MAI\.needsCheck\(/.test(A) && /MAI\.verify\(/.test(A), "Home asks the model only when unsure, and checks its answer");
ok((A.match(/spentDone/g) || []).length >= 4, "money said to be spent is never an agent (Home's detector and Home's own step)");
ok(RESULT.ok / RESULT.n >= 0.995, `2,500 cases: ${RESULT.ok}/${RESULT.n}`);
ok(RESULT.share >= 0.6, `different shapes ${(100 * RESULT.share).toFixed(1)} %`);
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`);
process.exit(fail ? 1 : 0);
