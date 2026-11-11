// v9.9.18 batch B2: AU2 suggestions (suggest.js) and AU3 recipes (recipes.js) — 2,500 samples of their 10,000 runs at 100%.
import { execFileSync } from "child_process";
const run = (f, a = []) => execFileSync("node", [new URL(f, import.meta.url).pathname, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
let bad = 0; const ok = (c, t) => { console.log((c ? "PASS " : "FAIL ") + t); if (!c) bad++; };
const p = (s) => +(/\(([\d.]+)%\)/.exec(s) || [])[1];
{ const s = run("../suggest/gen.mjs", ["2500"]); ok(p(s) === 100, "suggestions: 2,500 histories — " + p(s) + "%"); }
{ const s = run("../recipes/gen.mjs", ["2500"]); ok(p(s) === 100, "recipes: 2,500 people — " + p(s) + "%"); }
console.log(bad ? "FAIL " + bad + " failed" : "ALL PASSED"); if (bad) process.exitCode = 1;
