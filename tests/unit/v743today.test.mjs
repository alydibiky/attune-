// v6.43 Home "1 + the Today line" (Ali): one line for today across the apps — meals, money spent, reminders ahead, by time.
import { todayLine } from "../../web-src/home.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
const now = new Date("2026-10-20T15:00:00").getTime(), d = "2026-10-20";
const t = (h, m = 0) => new Date(`2026-10-20T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`).getTime();
const fit = { days: { [d]: { meals: { breakfast: [{ name: "Eggs", kcal: 150, t: t(8, 30) }, { name: "Toast", kcal: 150, t: t(8, 31) }], lunch: [{ name: "Koshari", kcal: 810, t: t(13, 10) }] } } } };
const ledger = { txns: [{ id: "n" + t(13, 12).toString(36) + "ab0", type: "expense", amount: 85, cat: "food", note: "Koshari", date: d }, { id: "x1", type: "expense", amount: 40, note: "Taxi", date: d }, { id: "x2", type: "expense", amount: 999, date: "2026-10-19" }], accounts: [{ id: "c" }] };
const reminders = [{ id: "r1", at: t(20), title: "Call the client" }, { id: "r2", at: t(10), title: "Gone" }, { id: "r3", at: t(21), title: "Done", done: true }];
const r = todayLine({ fit, ledger, reminders, now });
ok(r.line.map((x) => x.app).join() === "fit,fit,money,reminders", "breakfast, lunch, money, the evening reminder — by time: " + r.line.map((x) => x.hm + " " + x.app).join(", "));
ok(r.line[0].hm === "08:30" && /Eggs, Toast/.test(r.line[0].title) && r.line[0].sub === "300 kcal", "a meal: its foods and calories, at the time it was logged");
ok(/125/.test(r.line[2].title) && /Koshari, Taxi/.test(r.line[2].sub) && r.line[2].hm === "13:12", "money: today's spending only (125), at the last payment's time");
ok(r.line[3].ahead && r.line[3].title === "Call the client", "a reminder still to come today is ahead; past and done ones are not shown");
ok(Array.isArray(r.needs), "what is waiting comes with it");
console.log(bad ? bad + " FAILED" : "ALL PASSED");
