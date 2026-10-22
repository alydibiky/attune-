// v7.0 My report: the week's spend and calories, by code.
import { weekRhythm } from "../../web-src/home-now.js";
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const now = new Date(2026, 9, 22, 15).getTime();
const ledger = { txns: [{ type: "expense", amount: 85, date: "2026-10-22" }, { type: "expense", amount: 15, date: "2026-10-22" }, { type: "income", amount: 9000, date: "2026-10-22" },
  { type: "expense", amount: 600, date: "2026-10-17" }, { type: "expense", amount: 999, date: "2026-10-10" }] };
const days = { "2026-10-22": { k: 810 }, "2026-10-20": { k: 1500 } };
const w = weekRhythm({ ledger, days, kcalOf: (d) => ({ kcal: d.k }), now, locale: "en-US" });
ok(w.length === 7 && w[0].day === "2026-10-16" && w[6].day === "2026-10-22", "seven days, oldest first, today last");
ok(w[6].spend === 100 && w[6].today && w[6].label === "Today", "today: the two expenses (85 + 15), income not counted");
ok(w[1].spend === 600 && w.every((x) => x.day !== "2026-10-10"), "a day inside the week counts; one outside does not");
ok(w[6].kcal === 810 && w[4].kcal === 1500 && w[5].kcal === 0, "calories per day from Fit (a day with nothing is 0)");
ok(weekRhythm({ now }).every((x) => x.spend === 0 && x.kcal === 0), "no Money and no Fit → an empty week, no crash");
console.log(fails ? fails + " FAILED" : "ALL PASSED"); process.exit(fails ? 1 : 0);
