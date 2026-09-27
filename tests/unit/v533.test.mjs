// Unit tests for v5.33: Deal Check (money maths and scam signs by code).
import { num, pricesIn, marketRange, planCost, scamSigns, verdict, parseTerms, marketFrom, questionsFor } from "../../web-src/deal.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }
const near = (a, b, tol) => Math.abs(a - b) <= tol;

eq([num("12,400"), num("13,550.00"), num("13.550,00"), num("5k"), num("١٢٠٠٠"), num("EGP 3,950")], [12400, 13550, 13550, 5000, 12000, 3950], "numbers as people write them (commas, k, Arabic digits)");
eq(pricesIn("Crucial 16GB now EGP 5,250 (was 5,800 EGP), also $39.99").map((p) => [p.value, p.cur]), [[5250, "EGP"], [5800, "EGP"], [39.99, "USD"]], "prices with their currency are found in a page");
eq(pricesIn("سعرها ٤٥٠٠ جنيه بدل ٥٠٠٠ جنيه").map((p) => p.value), [4500, 5000], "…in Arabic too");
eq(pricesIn("DDR4 3200 MHz 16GB, 2 slots").length, 0, "numbers without a currency are not prices");

const mr = marketRange([5250, 5400, 4900, 6200, 5100, 52000]);
eq(mr.n === 5 && near(mr.median, 5250, 1), true, "the market median ignores a wild outlier (52,000)");

// Ali's noon screenshot: valU "3 monthly payments of EGP 4,133.33" on EGP 12,400 → a true 0%
const p0 = planCost({ cash: 12400, monthly: 4133.33, months: 3 });
eq(near(p0.extra, 0, 1) && p0.yearlyRate === 0, true, "3 × 4,133.33 on 12,400 is a real 0%");
// a typical "0% interest" plan with an admin fee and a down payment
const p1 = planCost({ cash: 10000, down: 1000, monthly: 900, months: 12, fees: 300 });
eq(p1.total, 12100, "total paid = down + fees + 12 × 900");
eq(p1.extra, 2100, "…2,100 more than cash");
eq(near(p1.yearlyRate, 0.53, 0.05), true, "…a real interest of about 53% a year (" + Math.round(p1.yearlyRate * 100) + "%)");
eq(planCost({ cash: 10000, monthly: 0, months: 0 }), null, "no installments → no plan");

const s1 = scamSigns("Congratulations you won an iPhone! Send the code you received and pay 200 EGP delivery on Vodafone Cash today only");
eq(s1.map((s) => s.id).sort(), ["code", "prize", "urgent", "wallet"], "a prize + OTP + wallet + urgency message is caught");
eq(verdict({ price: 200, cur: "EGP", signs: s1 }).level, "scam", "…and called a scam");
eq(scamSigns("ابعت العربون فودافون كاش والكود اللي وصلك").map((s) => s.id).sort(), ["code", "pay-first", "wallet"], "Arabic: deposit + wallet + OTP code");
eq(scamSigns("Crucial 16GB DDR4 3200 Desktop, sold by Amazon.eg, 2-year warranty").length, 0, "an honest listing has no signs");

const mk = { low: 4900, median: 5250, high: 5600, n: 6 };
eq(verdict({ price: 13550, cur: "EGP", market: { low: 9800, median: 10500, high: 12000 }, signs: [] }).level, "overpriced", "far above the market → overpriced");
eq(verdict({ price: 5250, cur: "EGP", market: mk, signs: [] }).level, "fair", "at the market → fair");
eq(verdict({ price: 4700, cur: "EGP", market: mk, signs: [] }).level, "good", "below the market → good deal");
eq(verdict({ price: 1500, cur: "EGP", market: mk, signs: [] }).level, "risky", "far BELOW the market → risky (too good to be true)");
eq(verdict({ price: 12400, cur: "EGP", market: { low: 9000, median: 10000, high: 11000 }, signs: scamSigns("Generic brand, not enough ratings") }).level, "risky", "Ali's noon listing: generic + no ratings + overpriced → risky");
const v2 = verdict({ price: 10000, cur: "EGP", plan: p1, claimsZero: true, signs: scamSigns("0% interest") });
eq(v2.level, "overpriced", "a '0%' plan that really costs 53% a year is flagged");
eq(v2.reasons.some((r) => /although it says 0%/.test(r.en)), true, "…and the reason says it claimed 0%");
eq(verdict({ price: 6000, cur: "EGP", market: mk, signs: [] }).target, 5100, "the price to ask for is near the market median");

eq(parseTerms('Sure: {"item":"Crucial 32GB DDR4","kind":"product","price":"13,550","currency":"egp","monthly":null,"claims":["fast"]}').price, 13550, "the model's JSON is read even with text around it");
const mf = marketFrom([{ title: "Crucial 32GB", text: "Price: EGP 10,999 at Sigma" }, { title: "x", text: "EGP 11,500 at El Badr, $50 abroad" }, { title: "y", text: "nothing here" }], "EGP", 13550);
eq([mf.market.n, mf.sources.length], [2, 2], "market prices come only from pages that list a price in the same currency");
eq(questionsFor({ level: "scam" }, s1, "product").length >= 2, true, "questions to ask the seller are suggested");

if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
