// v9.9.17 (Ali, 11 Nov 2026: "exactly 10000 hard scenarios … a sample of 10000 notifications in every area"): the two runs stay above
// their marks (a 2,500 sample of each, same proportions; the full ones: bash tests/scenarios/run.sh hard · bash tests/notifs/run.sh),
// nothing that is not a payment reaches Money, and the held-out notifications (written after the rules) stay read right.
import { execFileSync } from "child_process";
const run = (f, a = []) => execFileSync("node", [new URL(f, import.meta.url).pathname, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 26 });
const ok = (c, t) => { console.log((c ? "PASS " : "FAIL ") + t); if (!c) process.exitCode = 1; };
const n = run("../notifs/gen.mjs", ["2500"]), np = +(/\(([\d.]+)%\)/.exec(n) || [])[1], fm = +(/NOT a payment: \*\*(\d+)\*\*/.exec(n) || [])[1];
ok(np >= 99, "2,500 generated notifications: " + np + "% handled right (the mark: 99%)");
ok(fm === 0, "no notification that is not a payment becomes money (" + fm + ")");
const h = run("../notifs/heldout.mjs"), hp = +(/\(([\d.]+)%\)/.exec(h) || [])[1];
ok(hp >= 95, "held-out notifications: " + hp + "% (the mark: 95%)");
const s = run("../scenarios/hard.mjs", ["2500"]), sp = +(/\(([\d.]+)%\)/.exec(s) || [])[1];
const row = (g) => { const r = new RegExp("\\| " + g + " \\| (\\d+) \\| (\\d+) \\|").exec(s); return r ? +r[2] : -1; };
ok(sp >= 93, "2,500 hard sentences: " + sp + "% handled right, details checked (the mark: 93%)");
for (const g of ["not_a_payment", "remind_ar_time", "remind_repeat", "deadlines", "repay", "income"]) ok(row(g) >= 0 && row(g) <= 1, g + ": at most one wrong (" + row(g) + ")");
