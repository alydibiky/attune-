// Unit tests for v5.28: never overflow the window; logic puzzles aren't code.
import { fitNotes } from "../../web-src/research.js";
import { looksLikeDeduction, looksLikeReasoning } from "../../web-src/reason.js";
import { looksLikeMathProblem } from "../../web-src/verify.js";
import { codeInsteadOfAnswer, NO_CODE_RULE } from "../../web-src/boost.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

const notes = Array.from({ length: 9 }, (_, i) => ({ title: "S" + i, url: "u" + i, text: Array.from({ length: 30 }, (_, j) => "- trim " + j + ": 845 hp; 1,200 Nm" + (j === 20 ? " (also in [2])" : "")).join("\n") }));
const fit = fitNotes(notes, 6000);
const total = fit.reduce((k, n) => k + n.text.length, 0);
eq(total <= 6000, true, "9 pages of notes are cut to fit the window (" + total + " ≤ 6000 characters)");
eq(fit.length, 9, "…every source keeps some notes");
eq(fit.every((n) => n.text.includes("(also in [2])")), true, "…lines confirmed by another site are kept first");
eq(fit[0].text.startsWith("- trim 0"), true, "…and the first (most relevant) lines");
eq(fitNotes(notes.slice(0, 1), 99999)[0].text, notes[0].text, "notes that fit are left alone");

const flurbs = "All flurbs are either glips or morps, but never both. Exactly 40% of flurbs are glips. All morps can fly. No glip can breathe underwater. Only creatures that can breathe underwater are immortal. Can an immortal flurb exist? What percentage of flurbs cannot fly? Show your deduction step-by-step.";
eq([looksLikeDeduction(flurbs), looksLikeReasoning(flurbs)], [true, true], "the flurbs puzzle is a deduction (logic route, not the maths program)");
eq([looksLikeDeduction("3 cranes × 4 days × 12,500 EGP a day + 14% VAT — total?"), looksLikeMathProblem("3 cranes × 4 days × 12,500 EGP a day + 14% VAT — total?")], [false, true], "…a priced sum is still maths");
eq(looksLikeDeduction("Some cats are black. All black things absorb heat. Is it possible that no cat absorbs heat?"), true, "syllogisms count too");

eq(codeInsteadOfAnswer("```tool_code\nprint(default_api.solve(x=40))\n```"), true, "a tool_code reply is caught");
eq(codeInsteadOfAnswer("```python\ndef solve():\n    glips = 0.4\n    return 1 - glips\nprint(solve())\n```"), true, "…so is a bare function with no explanation");
eq(codeInsteadOfAnswer("**No immortal flurb can exist.**\n1. Every flurb is a glip or a morp…\n2. Glips can't breathe underwater…\n3. So 40% cannot fly."), false, "a worded answer is fine");
eq(codeInsteadOfAnswer("Here is the program you asked for, with an explanation of each step and how to run it on your phone. It reads the file, groups by crane and prints the totals.\n```python\nprint(1)\n```"), false, "code with a real explanation is fine");
eq(/Never answer with a function/.test(NO_CODE_RULE), true, "every model is told not to answer with a function");

console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
if (fails.length) process.exit(1);
