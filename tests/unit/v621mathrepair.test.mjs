import { programFrom, repairAnswerLines } from "../../web-src/verify.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const bad = "```python\nprice = 4200\nn = 3\nfinal_price = price * n * 0.9\nANSWER: {final_price} جنيه\n```";
const fixed = programFrom(bad);
ok(/print\(f"""ANSWER: \{final_price\} جنيه"""\)/.test(fixed), "a bare ANSWER: line becomes the print it meant");
ok(!/^ANSWER:/m.test(fixed), "…and no bare ANSWER line is left");
ok(repairAnswerLines('print("ANSWER:", x)') === 'print("ANSWER:", x)', "a correct print is untouched");
ok(repairAnswerLines("# ANSWER: later") === "# ANSWER: later", "a comment is untouched");
ok(repairAnswerLines("  ANSWER: {a + b}").startsWith('  print(f"""ANSWER: {a + b}'), "indentation is kept");
ok(repairAnswerLines('ANSWER: "quoted" {x}').includes('"quoted"'), "quotes inside are kept");
// the repaired program actually runs (python3 available here)
import { execFileSync } from "node:child_process";
try { const out = execFileSync("python3", ["-c", fixed], { encoding: "utf8" }); ok(/ANSWER: 11340\.0 جنيه/.test(out), "…and runs: " + out.trim()); } catch (e) { ok(false, "repaired program failed: " + String(e.message).slice(0, 120)); }
