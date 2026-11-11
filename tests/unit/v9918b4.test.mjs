// v9.9.18 batch B4 (time parts): T3 countdowns, T2 habit streaks, T6 focus time — 2,500 of each, in two time zones, all right.
import { execFileSync } from "child_process";
const run = (tz) => execFileSync("node", [new URL("../b4time/gen.mjs", import.meta.url).pathname, "2500"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, TZ: tz } });
let bad = 0; const ok = (c, t) => { console.log((c ? "PASS " : "FAIL ") + t); if (!c) bad++; };
for (const z of ["Africa/Cairo", "America/New_York"]) { const s = run(z); ok(/\(100\.00%\)/.test(s), "countdowns, habits, focus in " + z + ": " + s.split("\n")[0].replace(/^# /, "")); }
console.log(bad ? "FAIL " + bad + " failed" : "ALL PASSED"); if (bad) process.exitCode = 1;
