// Coding plan-first: only for requests with several functions or several rules; a short plan goes into the write prompt.
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] };
const C = await import("../../web-src/code.js");
let fail = 0;
const ok = (c, what) => { console.log((c ? "PASS " : "FAIL ") + what); if (!c) fail++; };

ok(C.needsPlan("Two functions roman_to_int(s) and int_to_roman(n) for numbers 1 to 3999; with tests", "python"), "two functions → plan");
ok(C.needsPlan("A function groupAnagrams(words) that returns groups of anagrams; sort the words inside each group and sort the groups by their first word, and ignore case; with tests", "javascript"), "several rules → plan");
ok(!C.needsPlan("A function chunk(arr, size) that splits an array into arrays of at most size items; with tests", "javascript"), "one simple function → no plan");
ok(!C.needsPlan("write a function that adds two numbers", "python"), "trivial → no plan");
ok(!C.needsPlan("Two functions a() and b() and c() on a website", "html"), "web pages never plan");
const pm = C.planMessages("task", "python");
ok(/Under 150 tokens/.test(pm[0].content) && /Tests:/.test(pm[0].content), "the plan prompt is short: plan + tests");
ok(C.cleanPlan("Plan:\n- parse\n- check\nTests:\n- f(1) == 2") .includes("f(1) == 2"), "a plan is kept");
ok(C.cleanPlan("```python\ndef f(): pass\n```") === "", "code instead of a plan is dropped");
ok(C.writeMessages("t", "python", { plan: "- step one" })[1].content.includes("Follow this plan") && !C.writeMessages("t", "python")[1].content.includes("plan"), "the plan reaches the write prompt only when there is one");

// the loop: plan call first (150 tokens), then the write call carries it; plan=false makes no plan call
const runPy = async () => ({ ok: true, stdout: C.PASS_MARK, stderr: "", error: "" });
const prog = "```python\ndef f(x):\n    return x\nprint(f(1))\n# --- tests ---\nassert f(1) == 1\nprint(\"ALL TESTS PASSED\")\n```";
let asked = [];
await C.workLoop({ task: "Two functions first(x) and second(x); with tests", lang: "python", plan: "auto", run: runPy, llm: async (m, o) => { asked.push({ m, o }); return asked.length === 1 ? "Plan:\n- f returns x\nTests:\n- f(1) == 1" : prog; } });
ok(asked.length === 2 && asked[0].o.maxTokens === 150 && asked[1].m[1].content.includes("f returns x"), "auto: a plan call, then the code with the plan");
asked = [];
await C.workLoop({ task: "Two functions first(x) and second(x); with tests", lang: "python", plan: false, run: runPy, llm: async (m, o) => { asked.push({ m, o }); return prog; } });
ok(asked.length === 1, "plan off: no extra call");

if (fail) { console.log(`\n${fail} FAILED`); process.exit(1); }
console.log("\nall passed");
