// v6.27 Homework Coach — the maths engine (coach-math.js): exact answers, steps in the order of operations, every step and
// every answer checked a second way; anything it can't prove → null (never a guess). Brute-force checks against a reference.
import * as M from "../../web-src/coach-math.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
const ans = (p) => { const r = M.solve(p); return r && r.display ? r.display : r && r.error ? "ERR" : r ? String(r.answer) : null; };
const is = (p, want) => { const a = ans(p); ok(a === want, `${p} → ${a} (want ${want})`); };
// arithmetic and the order of operations
is("3 + 4 × 2", "11"); is("(3 + 4) × 2", "14"); is("20 − 12 ÷ 4 × 2", "14"); is("2^3 × 3", "24"); is("−5 + 3", "−2"); is("8 ÷ 2(2+2)", "16");
is("٣ + ٤ × ٢", "11"); is("10 - (2 - 5)", "13"); is("2³ + 1", "9"); is("0.1 + 0.2", "0.3");
// fractions and mixed numbers (exact, simplified)
is("1/2 + 1/3", "5/6"); is("3/4 − 1/6", "7/12"); is("2/3 × 9/4", "3/2"); is("1 1/2 + 2 3/4", "4 1/4"); is("3/4 ÷ 1/2", "3/2"); is("½ + ¼", "3/4"); is("12 ÷ 8", "1.5"); is("1) 7 − 2", "5"); is("10 - 4", "6");
// equations
is("2x + 3 = 11", "x = 4"); is("3(x − 2) = x + 4", "x = 5"); is("x/2 + 1 = 5", "x = 8"); is("5 − x = 2", "x = 3"); is("0.5x = 3", "x = 6"); is("3x = 2", "x = 2/3");
ok(/every x/.test(M.solve("2(x+1) = 2x + 2").steps.pop().text) && /no solution/.test(M.solve("x + 1 = x + 2").steps.pop().text), "always true / no solution are said");
is("Solve: 4x - 7 = 2x + 9", "x = 8"); is("حل: 2س + 1 = 7", "x = 3");
// percentages
is("15% of 80", "12"); is("20 is what percent of 80", "25%"); is("increase 50 by 10%", "55"); is("decrease 200 by 15%", "170");
// errors are said, not guessed
ok(M.solve("5 ÷ 0").error && /zero/.test(M.solve("5 ÷ 0").error), "÷ 0 → 'you can't divide by zero'");
ok(M.solve("What is the capital of France?") === null && M.solve("x^2 = 4") === null && M.solve("x + y = 3") === null, "not school arithmetic / not linear / two unknowns → null (the model + Python takes it)");
// the steps: the order of operations, a check step for equations
const s1 = M.solve("3 + 4 × (2 − 5)");
ok(s1.steps.map((s) => s.text).join(" | ") === "3 + 4 × (2 − 5) | 3 + 4 × (−3) | 3 + (−12) | −9", "steps: brackets, then ×, then +: " + s1.steps.map((s) => s.text).join(" | "));
const s2 = M.solve("3(x − 2) = x + 4");
ok(s2.steps[s2.steps.length - 1].check && /both sides are 9/.test(s2.steps[s2.steps.length - 1].rule), "an equation ends with the check (x = 5 → both sides 9): " + s2.steps.map((s) => s.rule).join(" | "));
ok(s2.steps.some((s) => s.visual && s.visual.kind === "balance"), "…with the balance picture");
ok(M.solve("1/2 + 1/3").steps.some((s) => s.visual && s.visual.kind === "fractions" && /Same denominator 6/.test(s.rule)), "fractions: the common denominator, with the fraction picture");
ok(M.solve("4 × 3").steps.some((s) => s.visual && s.visual.kind === "array"), "4 × 3: the dots picture");
// brute force: 400 random expressions — the engine's answer equals an independent float evaluation
let wrong = 0, tried = 0;
const R = (k) => Math.floor(Math.random() * k);
for (let i = 0; i < 400; i++) {
  const n = () => String(R(19) + 1), op = () => ["+", "-", "*", "/"][R(4)];
  const e = `${n()} ${op()} (${n()} ${op()} ${n()}) ${op()} ${n()}`;
  let ref; try { ref = Function("return " + e)(); } catch (x) { continue; }
  if (!isFinite(ref)) continue;
  const r = M.solve(e.replace(/\*/g, "×").replace(/\//g, "÷"));
  tried++; if (!r || !r.answer || Math.abs(r.answer.toNumber() - ref) > 1e-9) { wrong++; if (wrong < 3) console.log("  mismatch", e, ref, r && r.answer && r.answer.toString()); }
}
ok(wrong === 0 && tried > 300, `brute force: ${tried} random sums, ${wrong} wrong`);
let wrongEq = 0;
for (let i = 0; i < 300; i++) {
  const a = R(9) + 1, b = R(21) - 10, c = R(9) + 1, x = R(21) - 10, d = a * x + b - c * x;   // a x + b = c x + d with the answer x
  if (a === c) continue;
  const r = M.solve(`${a}x ${b < 0 ? "-" : "+"} ${Math.abs(b)} = ${c}x ${d < 0 ? "-" : "+"} ${Math.abs(d)}`);
  if (!r || !r.answer || !r.answer.eq(x)) wrongEq++;
}
ok(wrongEq === 0, `brute force: 300 equations with known answers, ${wrongEq} wrong`);
// ---- coach.js: pages, lessons, practice, progress ----
const C = await import("../../web-src/coach.js");
const page = "Homework — page 12\n1. 3 + 4 × 2\n2. 2x + 3 = 11\n3) 1/2 + 1/3\na) 15% of 80\nQ5: 20 ÷ (2 + 3)";
const ps = C.splitProblems(page);
ok(ps.length === 5 && ps[0].text === "3 + 4 × 2" && ps[1].text === "2x + 3 = 11" && ps[4].text === "20 ÷ (2 + 3)", "a homework page → its problems (the header is not one): " + JSON.stringify(ps.map((p) => p.text)));
ok(C.splitProblems("١- ٣ + ٤\n٢- ٥ × ٢").length === 2, "Arabic numbering ١- ٢-");
const L = C.lessonFor("2x + 3 = 11");
const ask = L.lesson.steps.find((s) => s.ask);
ok(L.topic === "equations" && ask && ask.ask.answer === "4" && L.lesson.steps[L.lesson.steps.length - 1].check, "a lesson: the child is asked x before it is shown; the check step stays");
ok(C.lessonFor("2x + 3 = 11", { teach: false }).lesson.steps.every((s) => !s.ask), "'show answers' mode: no questions");
ok(C.lessonFor("Why is the sky blue?") === null, "not maths the engine can prove → null (the model teaches it)");
ok(C.topicOf("1/2 + 1/3", M.solve("1/2 + 1/3")) === "fractions" && C.topicOf("3 + 4 × 2", M.solve("3 + 4 × 2")) === "order of operations" && C.topicOf("15% of 80", M.solve("15% of 80")) === "percent", "topics");
for (const src of ["2x + 3 = 11", "3 + 4 × 2", "1/2 + 1/3", "15% of 80", "3(x − 2) = x + 4"]) {
  const pr = C.practiceLike(src, 3);
  ok(pr.length === 3 && pr.every((q) => { const s = M.solve(q.text); return s && s.display === q.answer; }) && pr.every((q) => q.text !== src), `practice like «${src}»: ${pr.map((q) => q.text + " → " + q.answer).join(" ; ")}`);
}
let c = { topics: {}, history: [] };
c = C.record(c, "fractions", false, "1/2+1/3"); c = C.record(c, "fractions", false, "x"); c = C.record(c, "fractions", true, "y"); c = C.record(c, "equations", true, "z"); c = C.record(c, "equations", true, "w");
ok(JSON.stringify(C.weakTopics(c)) === '["fractions"]', "what is hard: fractions (1 of 3 right), not equations");
ok(C.readCoachModel('{"steps":[{"text":"H2O","rule":"water is two hydrogens and one oxygen"}],"answer":"H2O"}').answer === "H2O" && C.readCoachModel("no json") === null, "the model's lesson is read and checked for shape");
console.log(bad ? bad + " FAILED" : "v727coach ok");
