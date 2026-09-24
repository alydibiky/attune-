// Unit tests for web-src/code.js — the write → run → fix loop of the Code workbench.
import { extractBlocks, pickProgram, parseEdits, applyEdits, applyFix, countTests, judge, errorSummary,
  writeMessages, fixMessages, workLoop, guessLang, PASS_MARK } from "../../web-src/code.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }
const T = (c, what) => eq(!!c, true, what);

// blocks
const ans = "Here:\n```python\nprint(1)\n```\nand\n```js\nconsole.log(2)\n```\n```python\ndef f():\n    return 3\nprint(f())\n```\nDone.";
const bl = extractBlocks(ans);
eq(bl.map((b) => b.lang), ["python", "javascript", "python"], "fenced blocks and their languages (py/js aliases)");
eq(pickProgram(ans, "python").code, "def f():\n    return 3\nprint(f())", "the program = the longest block in the wanted language");
eq(pickProgram("```js\nlet a=1\n```", "python"), { lang: "javascript", code: "let a=1" }, "falls back to any runnable block, keeping its language");
eq(extractBlocks("```python\nprint(1)").map((b) => b.closed), [false], "an unfinished block (still streaming) is marked open");
eq(pickProgram("def add(a, b):\n    return a + b\nprint(add(1, 2))", "python").code.startsWith("def add"), true, "code without fences is still found");
eq(pickProgram("Sorry, I can't do that.", "python"), null, "no code → null");
eq([guessLang("make a web page with a button"), guessLang("javascript function to sort"), guessLang("sort a list of cranes by capacity")], ["html", "javascript", "python"], "language guessed from the request");

// edits
const code = "def area(w, h):\n    return w + h\n\nprint(area(2, 3))\n# --- tests ---\nassert area(2, 3) == 6\nprint(\"ALL TESTS PASSED\")";
const fix = "<<<<<<< SEARCH\n    return w + h\n=======\n    return w * h\n>>>>>>> REPLACE";
eq(parseEdits(fix), [{ search: "    return w + h", replace: "    return w * h" }], "SEARCH/REPLACE block parsed");
eq(applyEdits(code, parseEdits(fix)).code.includes("return w * h"), true, "exact edit applied");
eq(applyEdits(code, [{ search: "return w + h   ", replace: "return w * h" }]).code.split("\n")[1], "    return w * h", "edit with wrong indentation/trailing spaces still lands, re-indented");
eq(applyEdits(code, [{ search: "return w - h", replace: "x" }]).failed.length, 1, "an edit that matches nothing is reported, not guessed");
eq(applyEdits("a = 1\na = 1\n", [{ search: "a = 1", replace: "a = 2" }]).failed.length, 1, "an ambiguous edit (two places) is refused");
eq(applyEdits("x = 1", [{ search: "", replace: "y = 2" }]).code, "x = 1\ny = 2\n", "empty SEARCH appends");
eq(applyFix("```python\nprint('whole')\nprint(2)\nprint(3)\nprint(4)\n```", code, "python").how, "rewrite", "a whole new program is accepted as a rewrite");
eq(applyFix("I think it's fine.", code, "python").how, "none", "no code in the answer → no change");
eq(countTests(code, "python"), 1, "python asserts counted");
eq(countTests("assert(a); assertEqual(f(1), 2)", "javascript"), 2, "js asserts counted");

// judging
eq(judge({ ok: true, stdout: "6\n" + PASS_MARK }, code, "python").passed, true, "pass = ran + printed the pass mark");
eq(judge({ ok: true, stdout: "6" }, code, "python").reason, "no-pass-mark", "tests present but never finished → not passed");
eq(judge({ ok: false, error: "AssertionError" }, code, "python").passed, false, "an error → not passed");
eq(judge({ ok: true, stdout: "hi" }, "print('hi')", "python").reason, "no-tests", "no tests → ran, marked 'no tests'");
eq(judge({ ok: true, errors: ["x is not defined"] }, "<p>", "html").passed, false, "a web page with a script error fails");
T(errorSummary({ error: "Traceback (most recent call last):\n  File \"/lib/python314.zip/_pyodide/_base.py\", line 1\n  File \"main.py\", line 6, in <module>\nAssertionError", stdout: "5" }).includes("main.py\", line 6"),
  "error summary keeps the program's lines and drops the runtime's");
T(!errorSummary({ error: "x\n  File \"/lib/python314.zip/_pyodide/_base.py\"" }).includes("_pyodide"), "…and hides Pyodide internals");

// prompts
T(writeMessages("sum a list", "python")[0].content.includes(PASS_MARK) && writeMessages("x", "python")[0].content.includes("numpy"), "write prompt asks for tests + the pass mark and names the packages");
T(fixMessages({ task: "t", lang: "python", code: "c", error: "E" })[0].content.includes("<<<<<<< SEARCH"), "fix prompt asks for SEARCH/REPLACE edits");
T(fixMessages({ task: "t", lang: "python", code: "c", change: "add a total" })[1].content.includes("add a total"), "change requests use the same edit format");

// the loop — JavaScript really runs here (Node), like in the phone's sandbox
const runJs = async (lang, src) => {
  const out = [];
  const cons = { log: (...a) => out.push(a.join(" ")), error: (...a) => out.push(a.join(" ")) };
  const assert = (c, m) => { if (!c) throw new Error("AssertionError" + (m ? ": " + m : "")); };
  const assertEqual = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`AssertionError: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
  try { await new Function("console", "assert", "assertEqual", "return (async()=>{\n" + src + "\n})()")(cons, assert, assertEqual); return { ok: true, stdout: out.join("\n") }; }
  catch (e) { return { ok: false, stdout: out.join("\n"), error: "Error: " + e.message }; }
};
const buggy = "```javascript\nfunction tonnes(kg){ return kg / 100; }\nconsole.log(tonnes(2500));\n// --- tests ---\nassertEqual(tonnes(1000), 1);\nassertEqual(tonnes(2500), 2.5);\nconsole.log(\"ALL TESTS PASSED\");\n```";
const patch = "<<<<<<< SEARCH\nfunction tonnes(kg){ return kg / 100; }\n=======\nfunction tonnes(kg){ return kg / 1000; }\n>>>>>>> REPLACE";
(async () => {
{
  const q = [buggy, patch]; const asked = []; const ev = [];
  const r = await workLoop({ task: "kg to tonnes", lang: "javascript", llm: async (m) => { asked.push(m); return q.shift(); }, run: runJs, onEvent: (e) => ev.push(e.type) });
  eq([r.ok, r.rounds, r.tests], [true, 1, 2], "loop: buggy first try → error sent back → one edit → tests pass");
  T(asked[1][1].content.includes("expected 1, got 10"), "…the fix request carries the real failure (expected 1, got 10)");
  eq(ev.filter((t) => !/ing$/.test(t)), ["write", "wrote", "run", "result", "fix", "fixed", "run", "result", "done"], "…and every step is reported for the screen");
}
{
  const cheat = "```javascript\nfunction tonnes(kg){ return 0; }\nconsole.log(\"ALL TESTS PASSED\");\n```";
  const q = [buggy, cheat, patch];
  const r = await workLoop({ task: "kg to tonnes", lang: "javascript", llm: async () => q.shift(), run: runJs });
  eq([r.ok, r.rounds, r.tests], [true, 2, 2], "a 'fix' that deletes the tests is refused; the next real fix passes");
}
{
  const r = await workLoop({ task: "x", lang: "javascript", llm: async (m) => (m.length && m[0].content.includes("fixing") ? "no idea" : buggy), run: runJs, maxRounds: 3 });
  eq([r.ok, r.gaveUp, r.rounds], [false, true, 3], "gives up honestly after the round limit");
}
{
  const r = await workLoop({ task: "t", lang: "javascript", code: "let a = 2;\nconsole.log(a * 2);", change: "print a * 3 instead",
    llm: async () => "<<<<<<< SEARCH\nconsole.log(a * 2);\n=======\nconsole.log(a * 3);\n>>>>>>> REPLACE", run: runJs });
  eq([r.ok, r.code.includes("a * 3"), r.last.stdout], [true, true, "6"], "change request on existing code: edited, then run");
}
{
  let threw = "";
  try { await workLoop({ task: "t", lang: "python", llm: async () => "Sorry.", run: runJs }); } catch (e) { threw = e.message; }
  T(/without any code/.test(threw), "a model answer with no code is a clear error, not a crash");
}

console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
process.exit(fails.length ? 1 : 0);
})();
