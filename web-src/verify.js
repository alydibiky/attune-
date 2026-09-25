/* ---- verified answers ---------------------------------------------------------------------
   The way a small model beats a big one at maths is not by thinking harder —
   it is by not doing the arithmetic in its head. For a word problem the model
   writes a short Python program, the phone RUNS it (sandbox, offline), and
   only then does the model write the answer, from the computed result. A
   wrong step shows up as a failing program instead of a confident wrong
   answer; an impossible question (no speed averages 60 km/h there) shows up
   as "no solution" instead of a page of "corrections".

   Coding requests in Chat go through the Code workbench's loop (code.js):
   written with tests, run, fixed from the real error, and only then shown.   */

import { extractBlocks } from "./code.js";

const NUM = /\d/g;

/** A question that needs exact working: numbers + a question about them. Plain sums are calc.js's. */
export function looksLikeMathProblem(text) {
  const t = String(text || "");
  if (t.length < 25 || t.length > 1500) return false;
  if ((t.match(NUM) || []).length < 2) return false;
  if (/```|def |class |function\s*\(|=>/.test(t)) return false;
  const ask = /\b(how (long|many|much|far|fast|old)|what (speed|time|is the|was the|must|should|percentage|fraction|ratio|probability)|at what|find|solve|calculate|compute|work out|average|probability|percent|ratio|interest|rate|minimum|maximum|how would)\b|كام|كم|احسب|أوجد|اوجد|ما هو|متوسط|نسبة|احتمال/i;
  const story = /\b(if|when|each|per|every|at a|takes?|travels?|drives?|costs?|speed|km|hours?|minutes?|workers?|shirts?|trains?|tank|pipe|price|profit|loss|discount|interest)\b|لو|إذا|اذا|كل|سرعة|ساعة|دقيقة|عامل|سعر|ربح/i;
  return ask.test(t) && story.test(t);
}

/** "write a python function that…", "implement a class…", "اكتب كود…" */
export function looksLikeCodeTask(text) {
  const t = String(text || "");
  if (t.length < 15) return false;
  if (/\b(write|implement|create|build|make|code|program|develop|fix|debug|refactor)\b[^.?!\n]{0,80}\b(python|javascript|js|typescript|function|class|script|program|algorithm|code|api|method|snippet|html page|web page)\b/i.test(t)) return true;
  if (/\b(python|javascript)\b/i.test(t) && /\b(write|implement|solve|return|class|def)\b/i.test(t)) return true;
  return /(اكتب|اعمل|اعملي|صمم|برمج)\s*(لي\s*)?(كود|برنامج|دالة|فانكشن|سكريبت|كلاس)/.test(t);
}

export function solveMessages(question) {
  return [
    { role: "system", content: "You check word problems by computing them. Write ONE short Python 3 program that solves the problem exactly: define the quantities as variables, use fractions.Fraction or sympy for exact algebra, and compute the answer step by step with a comment on each step. Read the problem literally and watch for tricks (things that happen at the same time, impossible conditions, units). The LAST line printed must be exactly 'ANSWER: <the answer with units>' — or 'ANSWER: impossible — <short reason>' if no value can satisfy the problem. Reply with the code block only." },
    { role: "user", content: String(question || "").trim() },
  ];
}

export function fixSolveMessages(question, code, error) {
  return [
    ...solveMessages(question),
    { role: "assistant", content: "```python\n" + code + "\n```" },
    { role: "user", content: "Running it failed:\n```\n" + String(error || "").slice(-1500) + "\n```\nSend the corrected full program, code block only." },
  ];
}

/** The answer the program printed, or null. */
export function readAnswer(stdout) {
  const m = String(stdout || "").match(/ANSWER:\s*(.+)\s*$/m);
  return m ? m[1].trim() : null;
}

export function explainMessages(question, code, output, answer) {
  return [
    { role: "system", content: "You explain the solution of a problem that has already been computed exactly by a program. The program and its result are correct — use them; do not recompute differently and do not contradict the result. Write: a one-line answer in bold first, then the short working as numbered steps in plain text maths (1/x = 1/30, no LaTeX, no $ signs). If the result says impossible, say so in the first line and explain why in simple words. Match the language of the question. No code in the answer." },
    { role: "user", content: `Question:\n${String(question).trim()}\n\nProgram:\n\`\`\`python\n${code}\n\`\`\`\n\nIt printed:\n${String(output).trim().split("\n").slice(-12).join("\n")}\n\nFinal result: ${answer}` },
  ];
}

export function programFrom(text) {
  const b = extractBlocks(text).filter((x) => x.lang === "python" || !x.lang).sort((a, c) => c.code.length - a.code.length)[0];
  if (b) return b.code;
  const t = String(text || "").trim();
  return /(^|\n)(print\(|import |from |[a-z_]+\s*=)/.test(t) ? t : null;
}

/**
 * The verified-maths pipeline. llm(messages, {maxTokens, onToken}) → text; runPy(code) → run result.
 * → { ok, answer, code, output, text } or { ok:false, why }
 */
export async function verifyMath({ question, llm, runPy, onStep = () => {}, onToken, explain = true }) {
  onStep("Working it out as a program…");
  let ans = await llm(solveMessages(question), { maxTokens: 900 });
  let code = programFrom(ans);
  if (!code) return { ok: false, why: "no program" };
  let res = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    onStep(attempt ? "Fixing the program and running it again…" : "Running it on this phone…");
    res = await runPy(code);
    if (res.ok && readAnswer(res.stdout)) break;
    if (attempt === 2) return { ok: false, why: res.error || "no ANSWER line", code, output: res.stdout };
    ans = await llm(fixSolveMessages(question, code, res.ok ? "The program did not print a line starting with 'ANSWER:'." + (res.stdout ? "\nIt printed:\n" + res.stdout.slice(-600) : "") : res.error), { maxTokens: 900 });
    const next = programFrom(ans);
    if (!next) return { ok: false, why: "no program", code };
    code = next;
  }
  const answer = readAnswer(res.stdout);
  if (!explain) return { ok: true, answer, code, output: res.stdout, text: "" };
  onStep("Checked by running code — writing the answer…");
  const text = await llm(explainMessages(question, code, res.stdout, answer), { maxTokens: 700, onToken });
  return { ok: true, answer, code, output: res.stdout, text };
}
