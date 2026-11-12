// v9.9.25 B8 AU4 scheduled AI jobs: a 2,500 sample of tests/au4/gen.mjs must stay at 100%, a held-out 500, plus the mock-up's jobs and the
// number check (an answer's number that isn't in the person's data is flagged).
import { run } from "../au4/gen.mjs";
import * as J from "../../web-src/aijobs.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const r = run(2500, 0); ok(r.pass === 2500, "2,500 generated schedules in 21 languages: " + r.pass + " / 2500 " + JSON.stringify(r.bad.slice(0, 1)));
const h = run(500, 90000); ok(h.pass === 500, "500 held-out: " + h.pass + " / 500");
const NOW = Date.parse("2026-11-12T12:00:00");   // Thursday 12 Nov
const a = J.makeJob("every Sunday 9 pm plan my week", NOW);
ok(a.schedule.kind === "weekly" && a.schedule.days[0] === 0 && new Date(a.next).toString().startsWith("Sun Nov 15 2026 21:00"), "the mock-up: Plan my week — every Sunday 21:00, next Sun 15 Nov");
const b = J.makeJob("on the 25th tell me what's left until salary", NOW);
ok(b.schedule.kind === "monthly" && new Date(b.next).getDate() === 25, "What's left until salary — on the 25th");
ok(new Date(J.makeJob("le 31 de chaque mois fais le point", NOW).next).getDate() === 30, "the 31st in November → the 30th (the month's last day)");
ok(J.makeJob("plan my week please", NOW) === null, "no time said → no job yet (the screen asks when)");
const c = J.checkNumbers("You spent 4,200 this week, 3 big things, Sheikh owes 2,500 and 14,000 is left", "spent 4200; Sheikh instalment 2500; left 11000");
ok(!c.ok && c.unknown.join() === "14000", "the number check: 14,000 isn't in your data → flagged (4,200 and 2,500 are)");
ok(J.dueJobs([{ next: NOW - 1 }, { next: NOW + 1 }, { next: NOW - 1, on: false }], NOW).length === 1, "due jobs: only the one whose time passed and is on");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
