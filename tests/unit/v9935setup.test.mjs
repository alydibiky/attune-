// v9.9.35 "Set up your life" (GD-5 + GW-A + TR-3; Ali: "the extra 7 days only by ACTUALLY completing the setting up"): the 10,000 generator
// on a 2,500 sample, held-out cases with Ali's own examples, the tips, and the wiring.
import { execFileSync } from "child_process";
import fs from "fs";
const S = await import("../../web-src/setup.js");
const C = await import("../../web-src/coach.js");
const ok = (c, t) => { console.log((c ? "PASS " : "FAIL ") + t); if (!c) process.exitCode = 1; };
const out = execFileSync("node", [new URL("../setup/gen.mjs", import.meta.url).pathname, "2500"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
ok(/2500 people, 2500 right/.test(out), "2,500 generated people all right: " + out.split("\n")[0]);
const NOW = Date.parse("2026-11-14T12:00:00"), DAY = 86400000;
// held-out: Ali's own life
const ali = { ledger: { txns: [{ type: "income", amount: 18500, date: "2026-11-01", source: "notification" }], recurring: [S.salaryRecurring({ amount: 18500, day: 25 }, NOW)] },
  life: { items: [{ kind: "installment", dir: "in", person: "Sheikh", amount: 2500, every: "month", total: 19500 }, { kind: "regular", dir: "out", amount: 600, every: "week", title: "Maid" },
    { kind: "bill", dir: "out", amount: 612, every: "month", title: "Electricity" }, { kind: "subscription", dir: "out", amount: 450, every: "month", title: "Internet" }] },
  radar: { items: [{ kind: "passport", title: "Passport", date: "2028-03-03" }, { kind: "licence", title: "Car licence", date: "2026-12-04" }] },
  reminders: [], agents: { agents: [{ id: "a", kind: "watch", on: true, what: "Huawei FreeClip 2" }] }, backup: { on: true, pw: "x", last: 0 } };
const st = S.stepState(ali), p = S.progress(ali, true);
ok(st.salary.done && st.bank.done && st.bills.done && st.people.done && st.papers.done && st.week.done && st.agent.done, "Ali's own data: salary, bank, bills, Sheikh, papers, the maid every Saturday, the FreeClip agent — all really done");
ok(!st.backup.done && p.done === 7 && p.next.id === "backup", "backup switched on but never run is NOT done (7 of 8, next: backup)");
ok(S.bonusDue({ done: p.done, trial: { first: NOW - 3 * DAY, left: 4, bought: false } }), "7 of 8 during the trial → the 7 days are due");
ok(S.bonusEnd(NOW - 3 * DAY, NOW) === NOW - 3 * DAY + 14 * DAY, "…and the trial then ends 14 days after it started");
ok(!S.bonusDue({ done: 8, trial: { first: NOW - 9 * DAY, left: 0 } }) && !S.bonusDue({ done: 8, trial: { left: 3, bought: true } }) && !S.bonusDue({ done: 8, trial: { left: 3 }, given: true }), "never after the trial, after buying, or twice");
const tapOnly = { ledger: { txns: [{ type: "expense", amount: 300, date: "2026-11-14" }] }, life: { items: [{ kind: "bill", dir: "out", amount: 600, every: "month" }] }, radar: { items: [{ title: "Passport", date: "2028-01-01" }] }, backup: { on: true, pw: "x", last: 0 } };
ok(S.progress(tapOnly, true).done === 0, "half-done steps count for nothing: a typed payment, one bill, one paper, backup never run → 0 of 8");
ok(S.progress({}, false).steps.slice(3).every((s) => s.locked) && !S.progress({}, false).steps.slice(0, 3).some((s) => s.locked), "Free: steps 1–3 open, 4–8 Pro (GW-A)");
for (const [t, a, d] of [["On the 25th, 18,500", 18500, 25], ["مرتبي ١٨٥٠٠ يوم ٢٥", 18500, 25], ["salary 32.5k on the 1st", 32500, 1], ["25th, 18500 on CIB", 18500, 25]]) { const r = S.readSalary(t); ok(r && r.amount === a && r.day === d, "salary «" + t + "» → " + JSON.stringify(r)); }
ok(S.readSalary("18,500") === null && S.readSalary("on the 25th") === null, "no salary without both the amount and the day");
const cu = S.checkup(ali, NOW);
ok(cu[0] && cu[0].kind === "paper" && /Car licence/.test(cu[0].title) && cu.some((x) => x.kind === "step" && x.id === "backup"), "the monthly check-up: the car licence ending in 20 days first, then the step not done");
// tips: once each, one a day
let cs = {}; const t1 = C.tipFor("money", cs, NOW); cs = C.markSeen(t1.id, cs, NOW);
ok(t1 && !C.tipFor("money", cs, NOW) && C.tipFor("money", cs, NOW, true) && C.tipFor("money", cs, NOW + DAY).id !== t1.id, "tips: one a day, never the same one twice, more on request");
ok(!C.tipFor("home", { seen: ["*"] }, NOW), "“*” = every tip seen (Settings → Show the tips again clears it)");
// wiring
const src = (f) => fs.readFileSync(new URL("../../web-src/" + f, import.meta.url), "utf8");
ok(/setupAnswer\(typed\)/.test(src("chat.jsx")) && /c\.op === "say"/.test(src("chat.jsx")) && /act\.startsWith\("setup:"\)/.test(src("chat.jsx")), "Chat: the salary answer, the guide's cards and its buttons");
ok(/<SetupDriver/.test(src("attune.jsx")) && /mode === "setup"/.test(src("attune.jsx")) && /<CoachHost/.test(src("attune.jsx")) && /<SetupHomeCard/.test(src("home-ui.jsx")) && /side-setup/.test(src("side-ui.jsx")), "the driver, the Settings page, the tips, the Home card and the side menu entry");
ok(/attune:pro-bonus-until/.test(src("setup-ui.jsx")) && /BONUS_KEY = "attune:pro-bonus-until"/.test(src("referral.js")), "the 7 days go into the same bonus Pro reads");
