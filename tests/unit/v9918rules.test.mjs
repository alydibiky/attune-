// v9.9.18 AU1 rules reader (web-src/rules.js): a 2,500 sample of the 10,000 sentences in 20 languages stays ≥ 99.5%, and the
// held-out phrasings (written after the fixes) stay ≥ 97%. Full: node tests/rules/gen.mjs · node tests/rules/heldout.mjs
import { execFileSync } from "child_process";
const run = (f, a = []) => execFileSync("node", [new URL(f, import.meta.url).pathname, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
let bad = 0; const ok = (c, t) => { console.log((c ? "PASS " : "FAIL ") + t); if (!c) bad++; };
const p = (s) => +(/\(([\d.]+)%\)/.exec(s) || [])[1];
{ const s = run("../rules/gen.mjs", ["2500"]); ok(p(s) >= 99.5, "rules: 2,500 sentences in 20 languages — " + p(s) + "% (mark 99.5%)"); }
{ const s = run("../rules/heldout.mjs"); ok(p(s) >= 97 && !/^FAIL/m.test(s), "rules held-out — " + p(s) + "% (mark 97%)"); }
// v9.9.23: "Switch on 2" saves two rules in the same millisecond — each must keep its own id (the second used to replace the first)
{ const RS = await import("../../web-src/rulestore.js"); const t = Date.parse("2026-11-12T10:00:00"); const a = RS.ruleId(t), b = RS.ruleId(t), c = RS.ruleId(t + 1);
  ok(a !== b && b !== c && a !== c, "rules saved in the same millisecond get different ids: " + [a, b, c].join(" ")); }
console.log(bad ? "FAIL " + bad + " failed" : "ALL PASSED"); if (bad) process.exitCode = 1;
