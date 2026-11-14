// v9.9.38 CG-3 + BK-2 + WK-1 + WK-2 (Ali's picks): 2,500 samples of the count-goal generator (and its held-out phrasings) and of the
// week-start generator, plus the cases each fix came from.
import { execFileSync } from "child_process";
const M = await import("../../web-src/missions.js");
let fail = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const run = (f, env = {}) => { const o = execFileSync("node", [new URL(f, import.meta.url).pathname, "2500"], { env: { ...process.env, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); return +((/\(([\d.]+)%\)/.exec(o) || [0, 0])[1]); };
const a = run("../countgoals/gen.mjs"), h = run("../countgoals/gen.mjs", { HELDOUT: "1" }), w = run("../weekstart/gen.mjs");
ok(a === 100, "count goals + books, 2,500 sample: " + a + "%");
ok(h >= 99, "held-out phrasings, 2,500 sample: " + h + "% (the mark: 99%)");
ok(w === 100, "week start, 2,500 weeks over 30 countries and the Settings choice: " + w + "%");
const now = Date.parse("2026-11-14T12:00:00");
ok(M.parseMission("read 18 novels before August 2027", now).deadline === "2027-08-31", "«18 novels» is not 18 November (the month must end where the word ends)");
ok(M.parseMission("read 14 books before December 2027", now).deadline === "2027-12-31", "«December 2027» is not the 20th");
ok(M.readCountDone("read the book before the meeting") === null && M.readCountDone("did I finish a book?") === null, "reading something is not finishing a book");
ok(M.readCountDone("قريت كتابين").n === 2 && M.readCountDone("finished reading The Alchemist").title === "The Alchemist", "«قريت كتابين» = 2; a title starting with The is kept");
console.log(fail ? `FAIL ${fail}` : "ALL PASSED");
process.exit(fail ? 1 : 0);
