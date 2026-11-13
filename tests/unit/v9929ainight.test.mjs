// v9.9.29 AI jobs at night while charging: a 2,500 sample of tests/ainight/gen.mjs at 100%, a held-out 500, plus by hand.
import { run } from "../ainight/gen.mjs";
import * as A from "../../web-src/aijobs.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const r = run(2500, 0); ok(r.pass === 2500, "2,500 generated nights: " + r.pass + " / 2500 " + JSON.stringify(r.bad.slice(0, 1)));
const h = run(500, 70000); ok(h.pass === 500, "500 held-out: " + h.pass + " / 500");
const D = 864e5, T = Date.parse("2026-11-15T21:00:00"), j = { id: "j1", text: "every day at 21:00 sum up", schedule: { kind: "daily", at: { h: 21, m: 0 } }, next: T };
const plan = A.nightPlan([j], {}, T - 3600e3);
ok(plan.length === 3 && plan[1].at - plan[0].at === D, "a daily job: its next 3 runs, a day apart");
ok(A.dueNight(plan, [], T - 60e3).length === 0, "nothing before its time");
const d = A.dueNight(plan, [], T + 2 * D + 60e3);
ok(d.length === 1 && d[0].at === T + 2 * D, "phone off for 2 days → runs once, the newest");
ok(A.nightPlan([{ ...j, on: false }], {}, T).length === 0, "a switched-off job is never in the plan");
const m = A.mergeNight({ jobs: [j], results: [] }, [{ key: "j1@" + T, job: "j1", title: j.text, at: T, ranAt: T + 6e4, text: "OK", data: "" }], T + 10 * 3600e3);
ok(m.results.length === 1 && m.jobs[0].next === T + D, "taken: the answer kept, next is tomorrow 21:00");
ok(A.mergeNight(m, [{ key: "j1@" + T, job: "j1", title: j.text, at: T, text: "OK" }], T + 11 * 3600e3) === m, "the same answer twice → nothing changes");
ok(A.mergeNight({ jobs: [], results: [] }, [{ key: "x@1", job: "x", title: "gone", at: 1, text: "kept" }]).results[0].text === "kept", "a job deleted meanwhile still shows its answer");
console.log(fail ? fail + " FAILED" : "ALL PASSED"); process.exit(fail ? 1 : 0);
