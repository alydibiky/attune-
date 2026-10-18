// v6.37 Missions (agent A): reading a goal, sensing your data, the forecast, the one step, the debrief, conflicts.
import { parseMission, deadlineIn, startMission, evaluate, chanceToGather, debrief, conflicts, logDay } from "../../web-src/missions.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const now = Date.parse("2026-10-18T10:00:00");
// 1 reading
ok(deadlineIn("save 60k by June", now) === "2027-06-30", "by June → the end of next June");
ok(deadlineIn("lose 6 kg before 20 January", now) === "2027-01-20", "before 20 January");
ok(deadlineIn("قبل 1 ديسمبر", now) === "2026-12-01", "«قبل 1 ديسمبر»");
ok(deadlineIn("خلال شهرين", now) === "2026-12-18", "«خلال شهرين» = in two months");
let p = parseMission("عايز أوفر 60 ألف قبل يونيو", now);
ok(p && p.kind === "save" && p.target === 60000 && p.deadline === "2027-06-30", "«عايز أوفر 60 ألف قبل يونيو» → save 60,000 by 30 June (" + JSON.stringify(p) + ")");
p = parseMission("lose 6 kg before 20 January", now);
ok(p && p.kind === "weight" && p.target === 6, "lose 6 kg");
p = parseMission("عايز أخس ٤ كيلو خلال شهرين", now);
ok(p && p.kind === "weight" && p.target === 4 && p.deadline === "2026-12-18", "Arabic digits, «أخس ٤ كيلو خلال شهرين»");
p = parseMission("أشتري كورولا 2022 بأقل من 900 ألف قبل 1 ديسمبر", now);
ok(p && p.kind === "buy" && p.target === 900000 && /كورولا 2022/.test(p.item) && p.deadline === "2026-12-01", "buy a Corolla 2022 under 900k by 1 Dec (" + (p && p.item) + ")");
ok(parseMission("what's the weather", now) === null && parseMission("save the file", now) === null, "not a goal → nothing");
// 2-3 saving: 60 days, 30,000 salary twice, spending ~600 a day → keeps ~ (60,000 − 36,000) / 60 = 400 a day
const day = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const txns = [];
for (let i = 0; i < 60; i++) { txns.push({ type: "expense", account: "a", amount: i % 7 === 4 ? 1500 : 450, cat: i % 7 === 4 ? "eatingout" : "food", date: day(i) }); }
txns.push({ type: "income", account: "a", amount: 30000, date: day(5) }, { type: "income", account: "a", amount: 30000, date: day(35) });
const ledger = { currency: "EGP", accounts: [{ id: "a", currency: "EGP", start: 10000 }], txns };
const data = { ledger, fit: null, market: {} };
const m = startMission(parseMission("save 20k in 3 months", now), data, now);
ok(m.base.balance > 0 && m.deadline === "2027-01-18", "a mission remembers where you start (" + m.base.balance + ")");
let e = evaluate(m, data, now);
ok(e.value === 0 && e.left === 20000 && e.days === 92, "progress counts from today: 0 of 20,000, 92 days left");
ok(e.chance > 0.5, "keeping ~" + Math.round(e.perDayNow * 30) + " a month, 20,000 in 3 months is likely: " + Math.round(e.chance * 100) + "%");
const hard = evaluate(startMission(parseMission("save 200k in 3 months", now), data, now), data, now);
ok(hard.chance < 0.05 && hard.state === "behind" && hard.step && /Move the date to .* or lower the target/.test(hard.step.en), "200,000 in 3 months is not: " + Math.round(hard.chance * 100) + "% — the step: " + (hard.step && hard.step.en));
const mid = evaluate(startMission(parseMission("save 40k in 3 months", now), data, now), data, now);
ok(mid.chance > 0.05 && mid.chance < 0.8 && mid.step && /less a month on food/.test(mid.step.en) && mid.step.chance > mid.chance, "40,000 in 3 months: " + Math.round(mid.chance * 100) + "% → the step that raises it most: " + (mid.step && mid.step.en));
ok(chanceToGather([1, 2], 10, 30) === null, "too little history → no fake percentage");
ok(chanceToGather(new Array(28).fill(100), 2000, 30, { seed: 3 }) === 1 && chanceToGather(new Array(28).fill(10), 2000, 30, { seed: 3 }) === 0, "the forecast is exact on steady days");
ok(evaluate(m, data, now).chance === e.chance, "the same data gives the same chance (seeded)");
// weight: 4 weeks of weigh-ins, ~0.5 kg a week down
const weights = []; for (let i = 28; i >= 0; i -= 3) weights.push({ d: day(i), kg: Math.round((90 - (28 - i) * 0.07 + (i % 2 ? 0.2 : -0.2)) * 10) / 10 });
const fit = { weights };
const wm = startMission(parseMission("lose 6 kg before 20 January", now), { fit }, now);
const we = evaluate(wm, { fit }, now);
ok(we.days === 94 && we.chance > 0.5 && /kcal/.test(we.step.en), "−0.5 kg a week for 13 weeks ≈ 6.5 kg → likely: " + Math.round(we.chance * 100) + "%; step: " + we.step.en);
const fast = evaluate(startMission(parseMission("lose 10 kg in 2 weeks", now), { fit }, now), { fit }, now);
ok(/faster than is safe/.test(fast.step.en), "10 kg in 2 weeks → it says that is not safe");
ok(evaluate(startMission(parseMission("lose 5 kg by June", now), { fit: { weights: [] } }, now), { fit: { weights: [] } }, now).state === "unknown", "no weigh-ins → asks for them, no fake number");
// buy: money + the market book
const book = { "car:corolla 2022": [880000, 950000, 990000, 870000, 1010000, 960000].map((v, i) => ({ id: "x" + i, at: now - i * DAY0(), facts: { price: v, cur: "EGP" } })) };
function DAY0() { return 86400000; }
const bm = { ...startMission(parseMission("buy a Corolla 2022 under 900k by 1 Dec", now), data, now), marketKey: "car:corolla 2022" };
const be = evaluate(bm, { ...data, market: book }, now);
ok(be.market && be.market.under === 2 && be.evidence.some((x) => /2 of 6 ads/.test(x.en)), "a buy mission reads Scout's market: 2 of 6 ads under the price");
ok(be.chance != null && be.chance < evaluate({ ...bm, marketKey: null }, data, now).chance + 1e-9, "the market makes the chance lower or equal, never higher");
// debrief, log, conflicts
const d = debrief([m, hard.state ? startMission(parseMission("save 200k in 3 months", now), data, now) : m], data, now, "ar");
ok(d.length === 2 && /فرصتك/.test(d[0].head), "the morning report in Egyptian Arabic");
ok(logDay(m, e, now).log.length === 1 && logDay(logDay(m, e, now), e, now).log.length === 1, "one log entry per day");
ok(conflicts([m, startMission(parseMission("save 200k in 3 months", now), data, now)], data, now) !== null, "two savings that need more than you keep → a conflict is shown");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
