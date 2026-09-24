// Unit tests for web-src/calc.js — instant, exact arithmetic in Chat.
import { looksLikeCalc, calculate } from "../../web-src/calc.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }
const V = (t) => { const r = calculate(t); return r ? Math.round(r.value * 100) / 100 : null; };

eq(V("3 cranes × 4 days × 12,500 EGP a day + 14% VAT — total?"), 171000, "Ali's question: 3 × 4 × 12,500 + 14% VAT = 171,000");
eq(calculate("3 cranes × 4 days × 12,500 EGP a day + 14% VAT — total?").unit, "EGP", "…in EGP");
eq(calculate("3 cranes × 4 days × 12,500 EGP a day + 14% VAT — total?").markdown.split("\n")[0], "**Total: 171,000 EGP**", "total first, then the working");
eq(V("3 ونش × 4 أيام × 12,500 جنيه + 14% ضريبة، الإجمالي كام؟"), 171000, "the same in Egyptian Arabic");
eq(V("٣ × ٤ × ١٢٥٠٠"), 150000, "Arabic digits");
eq(V("150000 - 10%"), 135000, "10% off");
eq(V("What's 15% of 2,400?"), 360, "15% of 2,400");
eq(V("(2 + 3) × 4"), 20, "brackets");
eq(V("2 + 3 × 4"), 14, "× before +");
eq(V("1200 / 3 + 50"), 450, "divide then add");
eq(V("12.5 x 8"), 100, "'x' as times between numbers");
eq(V("48 t + 22 t counterweight + 15.6 t load = ?"), 85.6, "tonnes add up");
eq(V("100 + 14% + 500"), 614, "percent then more");
// must NOT be treated as sums
eq(looksLikeCalc("My period started 25/9"), false, "a date is not a sum");
eq(looksLikeCalc("call me on +20 100 123 4567"), false, "a phone number is not a sum");
eq(looksLikeCalc("We need 3 cranes for 4 days next week"), false, "numbers in a sentence are not a sum");
eq(looksLikeCalc("Is 18 t at 22 m enough for a 16 t load with rigging 0.8 t?"), false, "a crane question is left to the model");
eq(looksLikeCalc("the job takes 10-12 days"), false, "a range is not a subtraction");
eq(looksLikeCalc("Write a 3-step plan with 2 options"), false, "ordinary text");
eq(looksLikeCalc("3 × 4"), true, "3 × 4 is a sum");
console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
process.exit(fails.length ? 1 : 0);
