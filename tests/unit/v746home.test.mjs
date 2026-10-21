// v6.46 Home option A (Ali picked it): RIGHT NOW · four numbers · Attune noticed — chosen by code from the apps' data.
import * as F from "../../web-src/fleet.js";
import { nowCard, homeNumbers, noticed } from "../../web-src/home-now.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const today = "2026-10-21", now = new Date(today + "T08:30:00").getTime();
const fleet = F.loadDemo(F.EMPTY(), today);   // the demo: a cheque due yesterday (overdue), one in 4 days, 2 of 3 cranes working
// ---- RIGHT NOW
const c1 = nowCard({ needs: [{ from: "life", title: "Maid", date: today, amount: 600, pay: { kind: "life", id: "x", i: 0, cur: "EGP" } }], fleet, now });
ok(c1 && c1.from === "fleet" && c1.kind === "chequeOverdue" && c1.level === "bad" && c1.actions.map((a) => a.id).join() === "cleared,bounced", "a cheque already late in Fleet comes first, with It cleared / Bounced: " + (c1 && c1.title));
const c2 = nowCard({ needs: [{ from: "life", title: "Maid", date: today, amount: 600, late: true, pay: { kind: "life", id: "x", i: 0, cur: "EGP" } }], fleet: null, now });
ok(c2 && c2.kind === "pay" && c2.level === "bad" && c2.actions[0].id === "paid", "no Fleet: a late payment, with Paid");
const c3 = nowCard({ needs: [{ from: "care", title: "21:00 · Metformin", date: today, dose: true }], fleet: null, now });
ok(c3 && c3.kind === "dose" && c3.open === "care", "a dose due today");
ok(nowCard({ needs: [], fleet: null, now }) === null, "a quiet day: no card");
// ---- the numbers
const n = homeNumbers({ safe: { cur: "EGP", today: 420 }, kcal: 640, kcalGoal: 2100, fleet, mission: { chance: 0.58 } });
ok(n.map((x) => x.k).join() === "spend,kcal,cranes,goal" && n[0].value === "420" && n[2].value === "2 / 3" && n[3].value === "58%", "four numbers: spend 420 · 640 kcal · 2 / 3 cranes · 58%");
ok(homeNumbers({ kcal: 0, kcalGoal: 0 }).length === 0, "no data → no numbers (nothing invented)");
// ---- Attune noticed
const t1 = noticed({ safe: { cur: "EGP", spentToday: 900, today: 0, perDay: 420 } });
ok(t1 && t1.k === "spend" && /900/.test(t1.text), "spent past today's safe amount → said first");
const t2 = noticed({ mission: { title: "Fleet earns 500,000", chance: 0.31, step: "one job on the free crane" } });
ok(t2 && t2.k === "goal" && /31%/.test(t2.text), "a goal falling behind");
const t3 = noticed({ fleet });
ok(t3 && t3.k === "crane" && /free/.test(t3.text), "a crane standing free while others work: " + (t3 && t3.text));
ok(noticed({ scout: { goals: [{ text: "Tucson", unseen: ["a", "b"] }] } }).k === "scout", "new Scout finds");
ok(noticed({}) === null, "nothing worth saying → nothing");
