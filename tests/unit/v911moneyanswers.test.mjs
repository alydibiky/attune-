// v9.0 (Ali: "99 percent accurate"): money questions answered by code, checked against sums worked out by hand.
import { answerMyMoney } from "../../web-src/myledger.js";
const now = Date.parse("2026-11-12T20:00:00");   // Thursday 12 Nov
const L = { currency: "EGP", accounts: [{ id: "c", name: "Cash", currency: "EGP" }, { id: "u", name: "USD", currency: "USD" }], customCats: [{ id: "cx9k2m4p1q", en: "Car loan", ar: "قسط العربية" }], txns: [
 { type: "expense", amount: 150, cat: "food", note: "lunch", date: "2026-11-12", account: "c" },
 { type: "expense", amount: 60, cat: "transport", note: "taxi", date: "2026-11-11", account: "c" },
 { type: "expense", amount: 300, cat: "food", note: "dinner", date: "2026-11-08", account: "c" },   // Sunday (this week starts Sat 7 Nov)
 { type: "expense", amount: 200, cat: "food", note: "groceries", date: "2026-11-06", account: "c" },   // Friday — last week
 { type: "expense", amount: 5000, cat: "cx9k2m4p1q", note: "car", date: "2026-11-02", account: "c" },
 { type: "expense", amount: 40, cat: "coffee", note: "coffee", date: "2026-10-30", account: "c" },   // last month
 { type: "income", amount: 25000, cat: "salary", note: "salary", date: "2026-11-01", account: "c" },
 { type: "expense", amount: 100, cat: "food", note: "amazon", date: "2026-11-10", account: "u" } ] };
const C = [
 ["how much did I spend this month?", ["5,710", "EGP"], ["5,810"]], ["how much did I spend on food this month?", ["650"], []], ["how much did I spend this week?", ["510"], ["710"]],
 ["how much did I spend today?", ["150"], []], ["how much did I spend yesterday?", ["60"], []], ["how much did I earn this month?", ["25,000"], []],
 ["how much did I spend last month?", ["40"], []], ["صرفت كام الشهر ده؟", ["5,710"], []], ["صرفت كام على الأكل الشهر ده؟", ["650"], []], ["how much did I spend in the last 7 days?", ["710"], []],
];
let bad = 0;
for (const [q, has, not] of C) { const r = answerMyMoney(q, L, { now, ar: /[؀-ۿ]/.test(q) }); const t = String(r.text || "");
  const ok = has.every((h) => t.includes(h)) && not.every((h) => !t.includes(h)) && !/cx9k2m4p1q/.test(t);
  if (!ok) { bad++; console.log(`FAIL ${q}\n   ${t.split("\n").slice(0, 4).join(" | ")}`); } }
console.log(bad ? bad + " FAILED" : `PASS v911moneyanswers: ${C.length} money questions answered with the exact sums (dollars never mixed in, the Egyptian week, custom categories by name)`);
