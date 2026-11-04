// v6.6 — Ali: "test that you get all logical and correct answers in everything". Questions with answers
// worked out OUTSIDE Attune (by hand, in Python, from the WMO Beaufort table, Excel's ROUND, the
// crane manufacturers' chart rules), then Attune's answer is compared. Written before any fix;
// the first score of each tool is kept in the HANDOFF. Run: node tests/eval/logic.mjs -v
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] };
const K = await import("../../web-src/calc.js");
const D = await import("../../web-src/deal.js");
const X = await import("../../web-src/chatxray.js");
const V = await import("../../web-src/verify.js");
const CV = await import("../../web-src/convert.js");
const verbose = process.argv.includes("-v");
const near = (a, b, tol = 0.01) => a != null && b != null && Math.abs(a - b) <= tol;
const T = {};   // tool → [ok, total, misses]
function q(tool, what, got, ok) { const t = (T[tool] ||= [0, 0, []]); t[1]++; if (ok) t[0]++; else t[2].push(`${what} → got ${JSON.stringify(got)}`); }

// (v9.1: this section is archived with Business — archive/business/tests/eval/logic.mjs)
// ---------------- calculator ----------------
const calc = [["3 cranes × 4 days × 12,500 EGP a day + 14% VAT — total?", 171000], ["15% of 2,400", 360], ["2,400 - 10%", 2160], ["(100 + 50) × 2", 300], ["100 + 50 × 2", 200],
  ["10 / 4 =", 2.5], ["١٠٠ × ٣", 300], ["100 + 14% + 500", 614], ["1,000,000 × 1.5%", 15000], ["50% of 50% of 200", 50], ["20 x 30", 600], ["7.5% of 1,200", 90],
  ["كام 250 × 4", 1000], ["5,000 - 1,250.50 =", 3749.5], ["2.5 × 4 × 1.5", 15], ["٣ في ٤ كام", 12], ["١٢٠٠٠ + ١٤ في المية", 13680], ["احسب 3 في 4 في 5", 60], ["120 ÷ 8 × 3", 45], ["-5 + 10 =", 5]];
for (const [t, want] of calc) { const r = K.calculate(t); q("calculator", `${t} = ${want}`, r && r.value, r && near(r.value, want)); }
q("calculator", "the currency is kept: EGP", K.calculate(calc[0][0])?.unit, K.calculate(calc[0][0])?.unit === "EGP");
for (const t of ["25/9", "call me 0100 123 4567", "10-12 days", "iPhone 15 Pro 256GB", "عندي معاد 5 في 6", "اشتريت 3 في 2025", "ميعادنا ٢٥/٩"]) q("calculator", `“${t}” is not a sum`, K.looksLikeCalc(t), K.looksLikeCalc(t) === false);

// ---------------- Deal Check (money) ----------------
const pc = (a) => D.planCost(a);
let p = pc({ cash: 12400, monthly: 4133, months: 3 });
q("deal", "12,400 or 3 × 4,133: total 12,399 — a real 0 % plan", p, p.total === 12399 && p.extra === 0 && p.yearlyRate === 0);
p = pc({ cash: 12000, monthly: 1100, months: 12 });
q("deal", "12,000 cash vs 1,100 × 12: pays 1,200 more = 19.53 %/yr (Python)", p, p.total === 13200 && p.extra === 1200 && near(p.yearlyRate, 0.1953, 0.0005));
p = pc({ cash: 10000, down: 2000, monthly: 1000, months: 10 });
q("deal", "10,000 cash, 2,000 down + 1,000 × 10: 65.31 %/yr (Python)", p, p.total === 12000 && p.extra === 2000 && near(p.yearlyRate, 0.6531, 0.0005));
p = pc({ cash: 10000, fees: 500, monthly: 1000, months: 10 });
q("deal", "a 500 fee up front is interest: 11.93 %/yr (Python)", p, p.total === 10500 && near(p.yearlyRate, 0.1193, 0.0005));
p = pc({ cash: 300000, down: 60000, monthly: 8500, months: 36 });
q("deal", "car 300,000: 60,000 down + 8,500 × 36 = 366,000; 17.84 %/yr (Python)", p, p.total === 366000 && p.extra === 66000 && near(p.yearlyRate, 0.1784, 0.0005));
p = pc({ cash: 10000, monthly: 900, months: 10 });
q("deal", "a plan cheaper than cash means misread terms — never shown as a saving", p, p.inconsistent === true);
const pl = (t) => D.plansIn(t)[0] || {};
q("deal", "“12,400 EGP or 3 × 4,133 with valU”", pl("12,400 EGP or 3 × 4,133 with valU"), pl("12,400 EGP or 3 × 4,133 with valU").months === 3 && pl("12,400 EGP or 3 × 4,133 with valU").monthly === 4133 && pl("12,400 EGP or 3 × 4,133 with valU").cash === 12400);
q("deal", "«قسط 4133 على 12 شهر»", pl("قسط 4133 على 12 شهر"), pl("قسط 4133 على 12 شهر").months === 12 && pl("قسط 4133 على 12 شهر").monthly === 4133);
q("deal", "“4,133 a month for 12 months”", pl("4,133 a month for 12 months"), pl("4,133 a month for 12 months").months === 12);
q("deal", "“12 installments of 4,133”", pl("12 installments of 4,133"), pl("12 installments of 4,133").months === 12 && pl("12 installments of 4,133").monthly === 4133);
q("deal", "“down payment 5,000 then 24 × 2,000”", pl("down payment 5,000 then 24 × 2,000"), pl("down payment 5,000 then 24 × 2,000").down === 5000 && pl("down payment 5,000 then 24 × 2,000").months === 24);
q("deal", "«مقدم ١٠٠٠٠ و ١٢ قسط × ٣٠٠٠»", pl("مقدم ١٠٠٠٠ و ١٢ قسط × ٣٠٠٠"), pl("مقدم ١٠٠٠٠ و ١٢ قسط × ٣٠٠٠").down === 10000 && pl("مقدم ١٠٠٠٠ و ١٢ قسط × ٣٠٠٠").monthly === 3000);
for (const [t, want] of [["13.550,00", 13550], ["5k", 5000], ["١٢٠٠٠", 12000], ["1.5 مليون", 1500000], ["12,400", 12400], ["12.400", 12400], ["2.5k", 2500]]) q("deal", `“${t}” = ${want}`, D.num(t), D.num(t) === want);
const mr = D.marketRange([100, 110, 120, 130, 1000]);
q("deal", "market of 100/110/120/130 + a 1,000 outlier: median 115 from 4 prices", mr, mr.median === 115 && mr.n === 4);

// ---------------- Chat X-Ray: who owes whom ----------------
const it = (type, from, to, amount, currency = "EGP") => ({ type, from, to, amount, currency });
const led = X.ledgerOf([it("owes", "Hassan", "Ali", 500), it("paid", "Hassan", "Ali", 200), it("owes", "Ali", "Mona", 1000), it("paid", "Ali", "Mona", 400), it("owes", "Hassan", "Ali", 50, "USD"), it("owes", "Mona", "Karim", 300)], "Ali");
q("debts", "Mona: Ali owes 600 (1,000 − 400)", led, led.find((r) => r.person === "Mona")?.net === -600);
q("debts", "Hassan owes Ali 300 EGP (500 − 200) and 50 USD — currencies never mixed", led, led.find((r) => r.person === "Hassan" && r.currency === "EGP")?.net === 300 && led.find((r) => r.person === "Hassan" && r.currency === "USD")?.net === 50);
q("debts", "a debt between two other people is not Ali's", led, !led.some((r) => r.person === "Karim"));
q("debts", "biggest first", led.map((r) => r.net), led[0].net === -600);
q("debts", "“hassan” → “Hassan Ali”", X.matchPerson("hassan", ["Hassan Ali", "Mona"]), X.matchPerson("hassan", ["Hassan Ali", "Mona"]) === "Hassan Ali");

// (v9.1: this section is archived with Business — archive/business/tests/eval/logic.mjs)
// ---------------- the checker that catches the AI's arithmetic ----------------
const sl = (t) => V.arithmeticSlips(t);
q("checker", "“500,000 + 70,000 = 453,000” is caught → 570,000", sl("500,000 + 70,000 = 453,000"), sl("500,000 + 70,000 = 453,000")[0]?.right === 570000);
q("checker", "“12 × 4 = 46” → 48", sl("12 × 4 = 46"), sl("12 × 4 = 46")[0]?.right === 48);
q("checker", "“5 + 3 × 2 = 11” is right (× first)", sl("5 + 3 × 2 = 11"), sl("5 + 3 × 2 = 11").length === 0);
q("checker", "“3 × 4,000 = 12,000” is right", sl("Total: 3 × 4,000 = 12,000"), sl("Total: 3 × 4,000 = 12,000").length === 0);
q("checker", "“2024-2025” is years, not a sum", sl("season 2024-2025 = great"), sl("season 2024-2025 = great").length === 0);
q("checker", "“3. 10 + 5 = 15” — the list number isn't part of the sum", sl("3. 10 + 5 = 15"), sl("3. 10 + 5 = 15").length === 0);
const fx = V.fixSlips("The total is 12 × 4 = 46 EGP.", sl("The total is 12 × 4 = 46 EGP."));
q("checker", "the wrong result is corrected in the text", fx.text, fx.text === "The total is 12 × 4 = 48 EGP.");

// ---------------- file converter: nothing lost ----------------
const rows = [["Name", "City", "Amount"], ["Hassan, Ali", "القاهرة", "12,500"], ["Mona \"M\"", "Alex\nandria", "0"]];
const back = CV.csvParse(CV.csvStringify(rows));
q("convert", "CSV round trip keeps commas, quotes, Arabic and line breaks", back, JSON.stringify(back) === JSON.stringify(rows));
try { const x = await CV.xlsxToRows(CV.xlsxFromRows(rows)); const r0 = Array.isArray(x) ? x : x && (x.rows || (x.sheets && x.sheets[0] && x.sheets[0].rows));
  q("convert", "Excel round trip keeps every cell", r0, JSON.stringify((r0 || []).map((r) => r.map(String))) === JSON.stringify(rows)); } catch (e) { q("convert", "Excel round trip", String(e), false); }

// ---------------- Fit: the body maths (hand-worked from the published formulas) ----------------
const F = await import("../../web-src/fit.js"), P = await import("../../web-src/fitplus.js");
const tg = F.targets({ sex: "m", age: 30, cm: 175, kg: 85, activity: "moderate", goal: "maintain", diet: "balanced" });
q("fit", "BMR (Mifflin-St Jeor) 10×85 + 6.25×175 − 5×30 + 5 = 1,799", tg.bmr, tg.bmr === 1799);
q("fit", "TDEE moderate = 1,798.75 × 1.55 = 2,788", tg.tdee, tg.tdee === 2788);
q("fit", "BMI 85 / 1.75² = 27.8", tg.bmi, tg.bmi === 27.8);
q("fit", "protein + carbs + fat add back up to the calories (±1 %)", tg, Math.abs(tg.protein * 4 + tg.carbs * 4 + tg.fat * 9 - tg.kcal) <= tg.kcal * 0.01);
const tf = F.targets({ sex: "f", age: 25, cm: 165, kg: 60, activity: "sedentary", goal: "maintain", diet: "balanced" });
q("fit", "BMR woman 10×60 + 6.25×165 − 5×25 − 161 = 1,345; × 1.2 = 1,614", [tf.bmr, tf.tdee], tf.bmr === 1345 && tf.tdee === 1614);
q("fit", "body fat, US Navy, man 178 cm, waist 90, neck 40 = 18.7 %", P.bodyFat({ sex: "m", height: 178, waist: 90, neck: 40 }), P.bodyFat({ sex: "m", height: 178, waist: 90, neck: 40 }) === 18.7);
q("fit", "body fat, US Navy, woman 165 cm, waist 75, hip 95, neck 32 = 27.4 %", P.bodyFat({ sex: "f", height: 165, waist: 75, neck: 32, hip: 95 }), P.bodyFat({ sex: "f", height: 165, waist: 75, neck: 32, hip: 95 }) === 27.4);
const lose = F.targets({ sex: "m", age: 30, cm: 175, kg: 85, activity: "moderate", goal: "lose", rate: 0.5, goalKg: 75, diet: "balanced" });
q("fit", "losing 0.5 kg a week ≈ 550 kcal a day under upkeep (7,700 kcal per kg)", lose.tdee - lose.kcal, Math.abs(lose.tdee - lose.kcal - 550) <= 15);
const d = { meals: { lunch: [{ id: "rice", kcal: 260, p: 5, c: 56, f: 1 }, { id: "egg", kcal: 143, p: 13, c: 1, f: 10 }] }, water: 0, workouts: [{ kcal: 300 }] };
const tot = F.dayTotals(d);
q("fit", "a day: 260 + 143 = 403 kcal eaten, 300 burned", [tot.kcal, tot.burned], tot.kcal === 403 && tot.burned === 300);

// ---------------- report ----------------
let ok = 0, all = 0;
for (const [tool, [a, n, miss]] of Object.entries(T)) { ok += a; all += n; console.log(`${tool.padEnd(11)} ${a}/${n} right${miss.length ? "" : " ✓"}`); if (verbose) for (const m of miss) console.log("   ✗ " + m); }
console.log(`ALL TOOLS: ${ok}/${all} answers right (${Math.round(ok / all * 100)} %)`);
export const result = { ok, all, byTool: Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v[0] / v[1]])) };
