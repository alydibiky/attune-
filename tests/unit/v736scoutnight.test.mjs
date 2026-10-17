// v6.32 Scout at night: the plan handed to the phone, and night hits checked like any run.
import * as S from "../../web-src/scout.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
let d = { goals: [] };
d = S.addGoal(d, "3-bedroom flat for rent in Maadi under 15,000", 1e12).data;
d = S.addGoal(d, "iPhone 16 Pro 256GB new under 70,000", 1e12).data;
d.goals[0].seen = [{ id: "a", url: "https://www.olx.com.eg/ad/1" }];
d.goals[1].on = false;
const p = S.nightPlan(d);
ok(p.length === 1, "paused goals are not searched at night");
ok(p[0].queries.length >= 1 && p[0].queries.length <= 6, "the goal's searches go with it (" + p[0].queries.length + ")");
ok(p[0].seen[0] === "https://www.olx.com.eg/ad/1", "links already seen go too, so only new ads are kept");
ok(p[0].title.length <= 40 && p[0].id === d.goals[0].id, "short title and the goal's id");
ok(S.nightPlan({ goals: [] }).length === 0, "no goals → an empty plan (the night run turns off)");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
