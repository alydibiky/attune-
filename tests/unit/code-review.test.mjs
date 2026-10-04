// Review / refactor / find bugs in pasted code: issues with line numbers, SEARCH/REPLACE fix, proof in the sandbox.
import { spawnSync } from "child_process";
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] };
const C = await import("../../web-src/code.js");
let fail = 0;
const ok = (c, what) => { console.log((c ? "PASS " : "FAIL ") + what); if (!c) fail++; };
const run = async (lang, code) => { const r = lang === "python" ? spawnSync("python3", ["-c", code], { encoding: "utf8", timeout: 10000 }) : spawnSync("node", ["-e", 'const assert=(c,m)=>{if(!c)throw new Error("AssertionError"+(m?": "+m:""))};const assertEqual=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error("expected "+JSON.stringify(b)+", got "+JSON.stringify(a))};\n' + code], { encoding: "utf8", timeout: 10000 }); return { ok: r.status === 0, stdout: r.stdout || "", stderr: r.stderr || "", error: r.status === 0 ? "" : (r.stderr || "").split("\n").slice(-8).join("\n") }; };

const BUGGY = "def average(xs):\n    total = 0\n    for i in range(1, len(xs)):\n        total += xs[i]\n    return total / len(xs)";
const msg = "Find the bug in this function:\n```python\n" + BUGGY + "\n```";
ok(C.looksLikeCodeReview(msg), "fenced code + 'find the bug' → review");
ok(C.looksLikeCodeReview("راجع الكود ده وصلّح الغلط\n" + BUGGY), "Arabic ask + unfenced code → review");
ok(!C.looksLikeCodeReview("explain how photosynthesis works"), "no code → not a review");
ok(!C.looksLikeCodeReview("Write a function average(xs) in python"), "a request to WRITE code is not a review");
const p = C.extractPastedCode(msg);
ok(p.lang === "python" && p.code === BUGGY && /Find the bug/.test(p.ask), "the code, its language and the ask are separated");
ok(C.extractPastedCode("review this\nfunction maxOf(a) {\n  let m = 0;\n  return m;\n}").lang === "javascript", "unfenced JavaScript is recognised");
const rm = C.reviewMessages(p.ask, p.code, "python");
ok(/3\|     for i in range\(1, len\(xs\)\)/.test(rm[1].content) && /SEARCH/.test(rm[0].content) && /\(possible\)/.test(rm[0].content), "lines are numbered; the prompt asks for edit blocks and 'possible' labels");

const GOOD = "Summary: averages a list.\nIssues:\n- L3: the loop starts at 1 — the first number is skipped\n- L5: (possible) an empty list divides by zero\nFix:\n<<<<<<< SEARCH\n3|     for i in range(1, len(xs)):\n=======\n    for i in range(len(xs)):\n>>>>>>> REPLACE\nTests:\n```python\nassert average([1, 2, 3]) == 2\nassert average([5]) == 5\n```";
const pr = C.parseReview(GOOD, BUGGY, "python");
ok(pr.issues.length === 2 && pr.issues[0].line === 3 && !pr.issues[0].possible && pr.issues[1].possible, "issues with line numbers and 'possible' labels are read");
ok(pr.edits.length === 1 && !/3\|/.test(pr.edits[0].search), "the line numbers a model copies into SEARCH are taken off");
ok(pr.tests.split("\n").length === 2, "the tests are read");

let r = await C.reviewCode({ text: msg, run, llm: async () => GOOD });
ok(r.fixed.includes("range(len(xs))") && r.proven, "the fix is applied and PROVEN: tests fail before, pass after");
ok(r.issues[0].shown && !r.issues[0].possible && r.issues[1].possible && !r.issues[1].shown, "only the issue the proven fix touches is 'shown'; the other stays 'possible'");
const txt = C.formatReview(r);
ok(/Line 3/.test(txt) && /shown by a test/.test(txt) && /\(possible\)/.test(txt) && /<<<<<<< SEARCH/.test(txt) && /Fixed code/.test(txt), "the answer: issues with lines, the edit blocks, the proof, the fixed code");

// a claimed bug the sandbox cannot show → every issue is "possible"
const WRONG = GOOD.replace("assert average([1, 2, 3]) == 2\nassert average([5]) == 5", "assert average([0, 2]) == 1");
r = await C.reviewCode({ text: msg.replace("range(1, len(xs))", "range(len(xs))"), run, llm: async () => WRONG.replace("3|     for i in range(1, len(xs)):", "    for i in range(len(xs)):") });
ok(!r.proven && r.issues.every((x) => x.possible && !x.shown), "tests pass on the original → nothing is claimed as shown");
ok(/not proven/.test(C.formatReview(r)), "…and the answer says so");

// a fix that does not pass yet goes through one fix round
let calls = 0;
const HALF = GOOD.replace("    for i in range(len(xs)):", "    for i in range(0, len(xs) - 1):");
r = await C.reviewCode({ text: msg, run, llm: async () => (++calls === 1 ? HALF : "<<<<<<< SEARCH\n    for i in range(0, len(xs) - 1):\n=======\n    for i in range(len(xs)):\n>>>>>>> REPLACE") });
ok(r.proven && r.fixed.includes("range(len(xs))") && !r.fixed.includes("--- tests ---") && calls === 2, "a wrong first fix is repaired in the sandbox loop, tests stripped from the fixed code");

// JavaScript
const JS = "function maxOf(arr) {\n  let m = 0;\n  for (const x of arr) if (x > m) m = x;\n  return m;\n}";
r = await C.reviewCode({ text: "review this code\n```js\n" + JS + "\n```", run, llm: async () => "Summary: max.\nIssues:\n- L2: starts at 0 — wrong for all-negative arrays\n<<<<<<< SEARCH\n  let m = 0;\n=======\n  let m = -Infinity;\n>>>>>>> REPLACE\nTests:\n```javascript\nassertEqual(maxOf([-3, -1]), -1);\nassertEqual(maxOf([1, 5]), 5);\n```" });
ok(r.lang === "javascript" && r.proven && r.issues[0].shown, "JavaScript: proven in the sandbox too");
// not runnable
r = await C.reviewCode({ text: "review this\n```go\nfunc a() {\n  x := 1\n  return x\n}\n```", run, llm: async () => "Summary: go.\nIssues:\n- L3: returns a value from a function with no result type" });
ok(r && !r.runnable && r.issues[0].possible && /can't be run/.test(C.formatReview(r)), "code the phone cannot run: everything 'possible', said plainly");

if (fail) { console.log(`\n${fail} FAILED`); process.exit(1); }
console.log("\nall passed");
