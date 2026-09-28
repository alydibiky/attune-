// v6.6 — Ali: "test that you get all logical and correct answers in everything". The answer set in
// tests/eval/logic.mjs (crane, calculator, Deal Check, debts, business formulas, the AI-arithmetic checker,
// file conversion, body maths — answers worked out outside Attune) must stay 100 % right.
// First contact was 92/103 (89 %): see HANDOFF §5.35 for what was wrong.
const { result } = await import("../eval/logic.mjs");
const bad = Object.entries(result.byTool).filter(([, v]) => v < 1).map(([k]) => k);
console.log((bad.length ? "FAIL " : "PASS ") + `${result.ok}/${result.all} answers right in every tool${bad.length ? " — wrong in: " + bad.join(", ") : ""}`);
if (bad.length) { console.log("\n1 FAILED"); process.exit(1); } else console.log("\nALL PASSED");
