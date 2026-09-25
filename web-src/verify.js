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
  const story = /\b(if|when|each|per|every|at a|takes?|travels?|drives?|costs?|speed|km|hours?|minutes?|workers?|shirts?|trains?|tank|pipe|price|profit|loss|discount|interest|rents?|rental|hire|days?|weeks?|months?|years?|salary|wages?|vat|tax|egp|usd|eur|sar|aed|pounds?|dollars?|fee|invoice|bill|total|tons?|kg|litres?|liters?|meters?|metres?|load)\b|%|لو|إذا|اذا|كل|سرعة|ساعة|دقيقة|عامل|سعر|ربح|إيجار|ايجار|يوم|أيام|ايام|شهر|ضريبة|جنيه|فاتورة|إجمالي|اجمالي|طن/i;
  // "How much is the rent, and with 14% VAT?" — money sums are word problems too (v5.13).
  const money = /\b(how much|total|with vat|incl(uding)?\.? vat|plus vat|\+ ?vat)\b|كام|الإجمالي|الاجمالي/i;
  return (ask.test(t) || money.test(t)) && story.test(t);
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
export async function verifyMath({ question, llm, runPy, warm, onStep = () => {}, onToken, explain = true }) {
  onStep("Working it out as a program…");
  // Python starts while the program is being written (it takes a few
  // seconds the first time), and the screen shows the program growing
  // instead of one line that looks stuck.
  try { warm && warm(); } catch (e) {}
  let shown = 0;
  let ans = await llm(solveMessages(question), { maxTokens: 900, onToken: (t) => {
    if (!shown && String(t || "").length > 8) { shown = 1; onStep("Writing the program…"); }
  } });
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

// ---- arithmetic slips in an ordinary answer ----------------------------------------------
/* "25,000 × 4 = 10,000", "10,000 × 0.04% = 40": the model wrote a sum and got
   it wrong. Every "a op b … = c" in an answer is recomputed here; any that is
   off means the answer is re-done the checked way (as a program).  (v5.13) */
const NUM_RE = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?%?|-?\d+(?:\.\d+)?%?/y;
const val = (t) => { const pct = /%$/.test(t); const n = Number(String(t).replace(/[,%]/g, "")); return pct ? n / 100 : n; };

/** Tokens of one side of a sum: numbers and × ÷ + −; words (units, currencies) are skipped. */
function sumTokens(seg) {
  const toks = [];
  let i = 0;
  while (i < seg.length) {
    const c = seg[i];
    NUM_RE.lastIndex = i;
    const m = NUM_RE.exec(seg);
    if (m && !(c === "-" && toks.length && toks[toks.length - 1].n != null)) { toks.push({ n: val(m[0]), raw: m[0] }); i += m[0].length; continue; }
    if (c === "/" && /^\s*[A-Za-z\u0600-\u06FF]/.test(seg.slice(i + 1))) { i++; continue; }   // "EGP/day": a unit, not ÷
    if ("×*÷/+-−".includes(c)) { toks.push({ op: c === "*" ? "×" : c === "/" ? "÷" : c === "−" ? "-" : c }); i++; continue; }
    if (c === "x" && toks.length && toks[toks.length - 1].n != null && /^\s*\d/.test(seg.slice(i + 1)) && /\s|\d/.test(seg[i - 1] || " ")) { toks.push({ op: "×" }); i++; continue; }
    if (/[()\[\]]/.test(c)) return null;          // brackets: too clever to judge here
    i++;
  }
  // numbers glued to units stay numbers; drop leading/trailing operators
  while (toks.length && toks[0].op) toks.shift();
  while (toks.length && toks[toks.length - 1].op) toks.pop();
  return toks;
}

/** → [{ expr, wrote, right }] for every written sum that doesn't add up. */
export function arithmeticSlips(text) {
  const out = [];
  const lines = String(text || "").replace(/\*\*/g, "").split("\n");
  let inCode = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) { inCode = !inCode; continue; }
    if (inCode || !line.includes("=")) continue;
    const parts = line.split("=");
    for (let k = 0; k + 1 < parts.length; k++) {
      let left = parts[k];
      const cut = Math.max(left.lastIndexOf(":"), left.lastIndexOf("،"), left.lastIndexOf(";"));
      if (cut >= 0) left = left.slice(cut + 1);
      const L = sumTokens(left);
      if (!L || L.length < 3) continue;
      // strict alternation number op number …
      let okShape = true;
      for (let j = 0; j < L.length; j++) if ((j % 2 === 0) !== (L[j].n != null)) okShape = false;
      if (!okShape) continue;
      const nums = L.filter((t) => t.n != null).map((t) => t.n), ops = L.filter((t) => t.op).map((t) => t.op);
      if (ops.every((o) => o === "-") && nums.every((n) => n >= 1900 && n <= 2100)) continue;   // 2024-2025
      const rm = /^\s*(?:[A-Za-z؀-ۿ$€£]{1,6}\.?\s*)?(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?%?|-?\d+(?:\.\d+)?%?)/.exec(parts[k + 1]);
      if (!rm) continue;
      // × ÷ before + −
      const n2 = [nums[0]], o2 = [];
      ops.forEach((o, i) => {
        if (o === "×") n2[n2.length - 1] *= nums[i + 1];
        else if (o === "÷") n2[n2.length - 1] = nums[i + 1] ? n2[n2.length - 1] / nums[i + 1] : NaN;
        else { o2.push(o); n2.push(nums[i + 1]); }
      });
      let r = n2[0]; o2.forEach((o, i) => { r = o === "+" ? r + n2[i + 1] : r - n2[i + 1]; });
      const wrote = val(rm[1]);
      if (!isFinite(r) || !isFinite(wrote)) continue;
      // a rounded answer is fine (1/3 = 0.33); a wrong one is not
      const tol = Math.max(0.011, Math.abs(r) * 0.006);
      if (Math.abs(r - wrote) > tol) out.push({ expr: left.trim() + " = " + rm[1], wrote, right: Math.round(r * 1e6) / 1e6 });
    }
  }
  return out;
}
