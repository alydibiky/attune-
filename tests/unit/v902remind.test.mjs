// v9.0 (Ali, 2 Nov: "Remind me on the last day of each month to pay interest for mom" was answered with this month's spending):
// a reminder is never a money question, and "the last day of each month" is a real repeat (30 Nov, 31 Dec, 31 Jan, 28 Feb…).
import { quickAction, nextOccurrence } from "../../web-src/actions.js";
import { myMoneyIntent } from "../../web-src/myledger.js";
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } };
const now = Date.parse("2026-11-02T22:10:00"), d = (t) => { const x = new Date(t); return `${x.getMonth() + 1}/${x.getDate()} ${x.getHours()}:${String(x.getMinutes()).padStart(2, "0")}`; };
ok(myMoneyIntent("Remind me on the last day of each month to pay interest for mom") === "", "a reminder to pay is not a spending question");
ok(myMoneyIntent("فكرني ادفع الكهربا") === "" && myMoneyIntent("I need to pay the electricity bill") === "", "a payment to make is not a spending question");
ok(myMoneyIntent("how much did I spend this month") === "expense" && myMoneyIntent("صرفت كام الشهر ده") === "expense" && myMoneyIntent("what did I pay for food this week") === "expense", "real spending questions still are");
const a = quickAction("Remind me on the last day of each month to pay interest for mom", now);
ok(a.kind === "reminder" && a.repeat === "lastday" && d(a.at) === "11/30 9:00" && a.title === "pay interest for mom" && !a.problems.length, "→ reminder, 30 Nov 9:00, every month's last day, 'pay interest for mom': " + JSON.stringify([a.kind, a.repeat, d(a.at), a.title]));
let t = a.at; const seen = []; for (let i = 0; i < 4; i++) { t = nextOccurrence({ ...a, at: t }, t + 1); seen.push(d(t)); }
ok(seen.join() === "12/31 9:00,1/31 9:00,2/28 9:00,3/31 9:00", "then 31 Dec, 31 Jan, 28 Feb, 31 Mar: " + seen.join());
const b = quickAction("remind me at the end of every month at 8pm to pay rent", now);
ok(b.repeat === "lastday" && d(b.at) === "11/30 20:00" && b.title === "pay rent", "end of every month at 8pm");
const c = quickAction("فكرني آخر يوم في كل شهر أدفع فوايد ماما", now);
ok(c.repeat === "lastday" && d(c.at) === "11/30 9:00" && c.title === "أدفع فوايد ماما", "Egyptian Arabic");
ok(quickAction("remind me every month on the 28th to pay rent", now).repeat === "monthly", "a fixed day stays monthly");
console.log(bad ? bad + " FAILED" : "PASS v902remind: reminders are reminders, last day of each month");
