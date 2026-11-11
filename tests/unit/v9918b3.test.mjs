// v9.9.18 batch B3 (money): M1 salary sorter, M3 groups / settle-up, M5 categories that learn — 2,500 samples of each 10,000 run.
import { execFileSync } from "child_process";
const run = (f, a = []) => execFileSync("node", [new URL(f, import.meta.url).pathname, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
let bad = 0; const ok = (c, t) => { console.log((c ? "PASS " : "FAIL ") + t); if (!c) bad++; };
const p = (s) => +(/\(([\d.]+)%\)/.exec(s) || [])[1];
for (const [d, name] of [["salarysort", "salary sorter"], ["groups", "groups settle-up"], ["catlearn", "categories that learn"]]) { const s = run("../" + d + "/gen.mjs", ["2500"]); ok(p(s) === 100, name + ": 2,500 — " + p(s) + "%"); }
const { digitsOf } = await import("../../web-src/moneyunits.js");
ok(digitsOf("KWD") === 3 && digitsOf("EGP") === 2 && digitsOf("JPY") === 0, "each currency's smallest coin (KWD 3 · EGP 2 · JPY 0)");
console.log(bad ? "FAIL " + bad + " failed" : "ALL PASSED"); if (bad) process.exitCode = 1;
