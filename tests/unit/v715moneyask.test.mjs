// v6.13 — Yusr's write-or-ask bar: "how much on food this week?" answered by code, short.
import assert from "node:assert/strict";
import { answerMyMoney, catAsked } from "../../web-src/myledger.js";
import { isQuestion } from "../../web-src/yusr/logtext.js";
const now = new Date("2026-10-04T12:00:00").getTime();
const L = { currency: "EGP", accounts: [{ id: "c", currency: "EGP" }], txns: [
  { type: "expense", amount: 150, cat: "food", account: "c", date: "2026-10-04", note: "Lunch" },
  { type: "expense", amount: 820, cat: "groceries", account: "c", date: "2026-10-03", note: "Carrefour" },
  { type: "expense", amount: 90, cat: "food", account: "c", date: "2026-10-03", note: "Koshary" },
  { type: "expense", amount: 60, cat: "transport", account: "c", date: "2026-10-04", note: "Uber" },
  { type: "income", amount: 30000, cat: "salary", account: "c", date: "2026-10-01", note: "Salary" }] };
assert.equal(catAsked("how much did I spend on food this week?"), "food");
assert.equal(catAsked("كام صرفت على المواصلات الشهر ده"), "transport");
let a = answerMyMoney("how much did I spend on food this week?", L, { now, short: true });
assert.match(a.text, /You spent 240 EGP\*\* on Food in this week · 2 entries/);
assert.match(a.text, /Biggest: Lunch 150 EGP/);
assert.doesNotMatch(a.text, /\|/, "no table in a chat bubble");
a = answerMyMoney("what did I spend this month?", L, { now, short: true });
assert.match(a.text, /1,120 EGP/); assert.match(a.text, /Groceries 820 EGP/);
a = answerMyMoney("كام صرفت على الأكل النهارده؟", L, { now, short: true });
assert.match(a.text, /صرفت 150 EGP/);
assert.equal(isQuestion("how much on food this week?"), true);
assert.equal(isQuestion("كام صرفت النهارده"), true);
assert.equal(isQuestion("lunch 150, taxi 60"), false);
assert.equal(isQuestion("قبضت المرتب ٣٠٠٠٠"), false);
assert.equal(isQuestion("show my spending"), true);
console.log("v715moneyask ok");
