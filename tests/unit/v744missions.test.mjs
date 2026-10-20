// v6.44 Missions phases 3–4: a spending cap, a debt, a course — and company missions from Fleet (revenue, collect).
import { parseMission, startMission, evaluate, deadlineIn, debrief } from "../../web-src/missions.js";
import { heal, loadDemo } from "../../web-src/fleet.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const now = new Date("2026-10-20T12:00:00").getTime();
const day = (n) => { const d = new Date(now + n * 86400e3); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
ok(deadlineIn("this month", now) === "2026-10-31" && deadlineIn("الشهر ده", now) === "2026-10-31", "'this month' / «الشهر ده» → the 31st");
// ---- cap
const p1 = parseMission("مش عايز أصرف أكتر من 3000 على الأكل الشهر ده", now);
ok(p1 && p1.kind === "cap" && p1.target === 3000 && p1.cat === "food" && p1.deadline === "2026-10-31", "«مش عايز أصرف أكتر من 3000 على الأكل الشهر ده» → cap, food, 3000, 31 Oct: " + JSON.stringify(p1));
ok(parseMission("Spend no more than 1500 on transport by 30/11", now).cat === "transport", "English: transport cap");
const txns = [];
for (let i = 59; i >= 0; i--) { txns.push({ id: "f" + i, type: "expense", cat: "food", amount: 80, date: day(-i) }); txns.push({ id: "i" + i, type: "income", amount: 400, date: day(-i) }); }
const ledger = { currency: "EGP", accounts: [{ id: "c", currency: "EGP", start: 1000 }], txns: txns.map((t) => ({ ...t, account: "c" })), debts: [{ id: "d1", person: "Ahmed Samir", amount: 12000, type: "i_owe", payments: [{ amount: 2000 }] }] };
const m1 = startMission(p1, { ledger }, now);
ok(m1.base.from === "2026-10-01", "a 'this month' cap counts from the 1st");
const e1 = evaluate(m1, { ledger }, now);
ok(e1.value === 80 * 20 && e1.left === 3000 - 1600 && e1.chance > 0.8 && /a day on food/.test(e1.step.en), "spent 1,600 of 3,000 at 80/day → room for 11 days: likely (" + Math.round(e1.chance * 100) + "%) — " + e1.step.en);
const tight = evaluate({ ...m1, target: 2000 }, { ledger }, now);
ok(tight.chance < 0.2 && tight.state === "behind", "a 2,000 cap at the same pace is very unlikely (" + Math.round(tight.chance * 100) + "%)");
const over = evaluate({ ...m1, target: 1000 }, { ledger }, now);
ok(over.state === "behind" && over.chance === 0 && /Over the limit by 600/.test(over.step.en), "over the limit already: says by how much");
// ---- debt
const p2 = parseMission("عايز أخلص دين أحمد قبل ديسمبر", now);
ok(p2 && p2.kind === "debt" && p2.deadline === "2026-12-31", "«عايز أخلص دين أحمد قبل ديسمبر» → debt by the end of December (the same rule as «قبل يونيو»)");
const m2 = startMission({ ...parseMission("Pay off what I owe Ahmed by December", now) }, { ledger }, now);
const e2 = evaluate(m2, { ledger }, now);
ok(m2.base.left === 10000 && e2.left === 10000 && e2.person === "Ahmed Samir" && e2.chance > 0.5 && /Pay Ahmed Samir/.test(e2.step.en), "the debt to Ahmed is found in Money → People: 10,000 left, a monthly payment (" + e2.step.en + ")");
const paidLedger = { ...ledger, debts: [{ ...ledger.debts[0], payments: [{ amount: 2000 }, { amount: 4000 }] }] };
ok(evaluate(m2, { ledger: paidLedger }, now).value === 4000, "a payment made counts as progress");
ok(evaluate(m2, { ledger: { ...ledger, debts: [] } }, now).state === "unknown", "no such debt → it says to add it in Money");
const owedMe = evaluate(startMission(parseMission("collect the debt Mona owes me by December", now), { ledger: { ...ledger, debts: [{ id: "d2", person: "Mona", amount: 3000, type: "owed_to_me" }] } }, now), { ledger: { ...ledger, debts: [{ id: "d2", person: "Mona", amount: 3000, type: "owed_to_me" }] } }, now);
ok(owedMe.chance === null && /reminder/.test(owedMe.step.en), "money owed TO you: no made-up chance, a reminder instead");
// ---- learn
const p3 = parseMission("I want to finish the Turkish course by 31 December", now);
ok(p3 && p3.kind === "learn", "'finish the Turkish course' → learn");
const course = { id: "tr", topic: "Turkish", plan: Array.from({ length: 30 }, (_, i) => "L" + i), lessons: Array.from({ length: 10 }, (_, i) => ({ n: i, done: true, day: day(-i * 1.5) })) };
const e3 = evaluate(startMission(p3, {}, now), { courses: [{ id: "x", topic: "Cooking", plan: ["a"] }, course] }, now);
ok(e3.value === 10 && e3.target === 30 && e3.chance > 0.8 && /lessons a week/.test(e3.step.en), "the Turkish course (not Cooking): 10/30, ~5 a week → " + Math.round(e3.chance * 100) + "% — " + e3.step.en);
// ---- company: Fleet
const fleet = loadDemo(heal({}), "2026-10-20");
const p4 = parseMission("عايز الأسطول يجيب 500 ألف الشهر ده", now);
ok(p4 && p4.kind === "revenue" && p4.target === 500000, "«عايز الأسطول يجيب 500 ألف الشهر ده» → company revenue 500k");
const e4 = evaluate(startMission(p4, { fleet }, now), { fleet }, now);
ok(e4.value > 0 && e4.left > 0 && /idle/.test(e4.step.en) && /Grove/.test(e4.step.en), "Fleet's work this month counted; the idle Grove is the step: " + e4.step.en);
const p5 = parseMission("Collect 30,000 from clients by the end of the month", now);
ok(p5 && p5.kind === "collect" && p5.target === 30000 && p5.deadline === "2026-10-31", "'Collect 30,000 from clients by the end of the month' → collect");
const e5 = evaluate(startMission(p5, { fleet }, now), { fleet }, now);
ok(e5.state && /cheque|call/i.test(e5.step.en), "collect: the cheques due and who to call — " + e5.step.en);
ok(evaluate(startMission(p4, {}, now), {}, now).state === "unknown", "no Fleet yet → it says where to add the cranes");
// the morning report has a line for each
const lines = debrief([m1, m2].map((m) => ({ ...m, status: "active" })), { ledger }, now, "ar");
ok(lines.length === 2 && lines.every((l) => l.step && /[؀-ۿ]/.test(l.step)), "the morning report speaks Egyptian Arabic for the new kinds");
// the old kinds still read the same
ok(parseMission("عايز أوفر 60 ألف قبل يونيو", now).kind === "save" && parseMission("Lose 6 kg before 20 January", now).kind === "weight" && parseMission("Buy a Corolla 2022 under 900k by 1 December", now).kind === "buy", "save / weight / buy unchanged");
// questions and plain records are not missions
for (const q of ["How much did Fleet earn this month?", "الونشات جابت كام الشهر ده؟", "I paid Ahmed 2000 of the debt", "how many lessons are left in the course by December?", "Fleet earned 50k this month"])
  ok(!parseMission(q, now) || !["revenue", "collect", "debt", "learn", "cap"].includes(parseMission(q, now).kind), "not a mission: «" + q + "»");
ok(parseMission("عايز الونشات تجيب 400 ألف الشهر ده", now).kind === "revenue", "«الونشات تجيب» (feminine) is a company revenue mission");
const cs2 = [{ id: "e", topic: "English for work", plan: ["a", "b"] }, { id: "t", topic: "Turkish: beginner to expert", plan: ["a", "b"] }];
ok(evaluate(startMission(parseMission("عايز أخلص كورس التركي قبل ديسمبر", now), {}, now), { courses: cs2 }, now).course === "t", "«كورس التركي» finds the course called 'Turkish …' (not English)");
ok(evaluate(startMission(parseMission("finish the english course by december", now), {}, now), { courses: cs2 }, now).course === "e", "'the english course' finds English for work");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
