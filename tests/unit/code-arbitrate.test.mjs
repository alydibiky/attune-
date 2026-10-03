// Unit tests for v6.12 test arbitration in web-src/code.js (a wrong self-written test is settled by code).
import { spawnSync } from "child_process";
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] };
const { calledFn, altProgram, arbitrationProbe, arbitrationResults, rewriteExpect, refusalRepair, workLoop } = await import("../../web-src/code.js");
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }
const run = async (lang, code) => { const r = spawnSync("python3", ["-c", code], { encoding: "utf8", timeout: 15000 }); return { ok: r.status === 0, stdout: r.stdout || "", stderr: r.stderr || "", error: r.status === 0 ? "" : (r.stderr || "").split("\n").slice(-8).join("\n") }; };

eq([calledFn("vat(100)"), calledFn("round(vat(1), 2)"), calledFn("x + 1")], ["vat", null, null], "the function a test calls");
eq(altProgram("```python\ndef vat(a):\n    return round(a * 1.14, 2)\nprint(vat(1))\n```", "vat"), "def _alt_vat(a):\n    return round(a * 1.14, 2)", "second version renamed, demo dropped");
eq(altProgram("```python\ndef other(a):\n    return a\n```", "vat"), null, "a second version without the function is ignored");
eq(rewriteExpect("x\n    assert vat(19.99) == 22.78\n", "assert vat(19.99) == 22.78", "22.79"), "x\n    assert vat(19.99) == 22.79\n", "expected value rewritten, indent kept");
eq(rewriteExpect("assert abs(pay(1) - 88.4) < 0.01", "assert abs(pay(1) - 88.4) < 0.01", "88.49"), "assert abs(pay(1) - (88.49)) < 0.01", "abs-style test rewritten, tolerance kept");
eq(rewriteExpect("assert f(1) == 2 and f(2) == 4", "assert f(1) == 2 and f(2) == 4", "3"), "assert f(1) == 2 and f(2) == 4", "a combined test is not rewritten");
eq(rewriteExpect("assert f(1) == 2", "assert f(1) == 2", "raises ValueError"), "assert f(1) == 2", "a non-value is never written into a test");
eq(refusalRepair("assert vat(-5) == 0", "assert vat(-5) == 0", "ValueError"), "try:\n    vat(-5)\n    raise AssertionError(\"expected ValueError\")\nexcept ValueError:\n    pass", "a test of refused input becomes a must-raise test");

const prog = "def vat(a):\n    return round(a * 1.14, 2)\n# --- tests ---\nassert vat(19.99) == 22.78\nprint('ALL TESTS PASSED')";
const items = [{ line: "assert vat(19.99) == 22.78", got: "vat(19.99)", want: "22.78", value: "22.79" }];
const r = arbitrationResults(await run("python", arbitrationProbe(prog, "def _alt_vat(a):\n    return round(a + a * 0.14, 2)", items)), items);
eq(r.map((x) => [x.prog, x.alt, x.agree]), [["22.79", "22.79", true]], "both versions run on the failing call and agree");

// whole loop: the program is right, its test is wrong, and the model keeps "fixing" the program
{
  const write = "```python\ndef vat(a):\n    return round(a * 1.14, 2)\n# --- tests ---\nassert vat(100) == 114.0\nassert vat(19.99) == 22.78\nprint('ALL TESTS PASSED')\n```";
  let fixCalls = 0, altCalls = 0;
  const llm = async (m) => {
    const sys = m[0].content, user = m[m.length - 1].content;
    if (/fixing/.test(sys)) { fixCalls++; return "<<<<<<< SEARCH\n    return round(a * 1.14, 2)\n=======\n    return round(a * 1.140, 2)\n>>>>>>> REPLACE"; }
    if (/Write ONLY the function/.test(user)) { altCalls++; return "```python\ndef vat(a):\n    return round(a + a * 0.14, 2)\n```"; }
    return write;
  };
  const ev = [];
  const res = await workLoop({ task: "vat(amount) adds 14% VAT, rounded to 2 decimals", lang: "python", llm, run, maxRounds: 4, restart: false, onEvent: (e) => ev.push(e.type) });
  eq([res.ok, altCalls, ev.includes("arbitrated"), fixCalls <= 2], [true, 1, true, true], "a wrong expected value is settled by a second version, not by more fix rounds");
  eq(res.code.includes("assert vat(19.99) == 22.79"), true, "…and the test now holds the agreed value");
}
console.log(fails.length ? `\n${fails.length} FAILED` : "\nall arbitration tests passed");
process.exit(fails.length ? 1 : 0);
