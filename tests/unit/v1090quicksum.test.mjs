// v10.9 S1–S3 (Ali, 22 Nov 2026: "make the speed much faster"). S1: everyday sums worked out by code at once (quicksum.js) — the real
// phone model took 40–60 s on each; 2,500 cases of tests/quicksum/gen.mjs (10,000: 100 %, held-out 100 % — and hand-written new phrasings
// found 5 misses («6 علب لبن العلبة بـ 38», «تذكرة القطر بـ 250 وإحنا 5 أفراد», "20 percent of 3500", "I want 60k by saving 2500 a month"),
// fixed generally, kept below). S2: a checked sum shows its number the moment the program prints it. S3: the fast engine is no longer
// kept on the CPU forever after one crash. E2E: tests/e2e_v1090quicksum.py.
process.env.N = "2500";
const { RESULT } = await import("../quicksum/gen.mjs");
const { quickSum, quickSumMarkdown } = await import("../../web-src/quicksum.js");
const { verifyMath } = await import("../../web-src/verify.js");
const fs = await import("fs");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const v = (t) => { const q = quickSum(t); return q ? q.value : null; };
// Ali's own sums from the P8 test
ok(v("إيجار ونش 3 أيام بـ 12,500 في اليوم وعليهم 14٪ ضريبة، المجموع كام؟") === 42750, "the crane rent: 42,750 at once (the model took 46 s, once said 562,500)");
ok(v("عندي ٢٢٠٠٠ هقسمهم على ٩ شهور، كام كل شهر؟") === 2444.44, "22,000 over 9 months: 2,444.44 (the model once wrote 22000/9)");
ok(v("A jacket is 1,800 after a 25% discount. What was the price before?") === 2400, "the jacket: 2,400");
ok(v("عربية بـ 900 ألف مقدم 30% والباقي على 5 سنين، القسط الشهري كام من غير فوايد؟") === 10500, "the car instalment: 10,500 (the model once said 17,250)");
ok(v("A phone costs 18,000 with 14% VAT included. What is the price before VAT?") === 15789.47, "before VAT: 15,789.47 (the model once said 157.89)");
ok(v("15% tip on 640 pounds") === 96, "the tip: 96 (the model turned pounds into kilograms)");
// new phrasings written by hand after the generator (they found the misses named above)
ok(v("هشتري 6 علب لبن العلبة بـ 38، كام؟") === 228 && v("تذكرة القطر بـ 250 وإحنا 5 أفراد، هندفع كام؟") === 1250, "«العلبة بـ 38», «تذكرة القطر بـ 250 … 5 أفراد»");
ok(v("how much is 20 percent of 3500") === 700 && v("I want 60k by saving 2500 a month, how many months") === 24, "'20 percent of', 'I want 60k by saving…'");
// never a wrong instant answer: what code can't place goes to the model (or to Money)
for (const t of ["صرفت 300 على الغدا", "4 people split a 1,240 bill with 12% service, how much each?", "shirts are 3 for 200, how much for 9?",
  "the price went from 1000 to 1200, what percent increase?", "100000 at 20% a year for 3 years, how much in the end?", "remind me tomorrow at 9 to pay 1200"]) ok(v(t) === null, "left to the model / Money: " + t);
ok(/^\*\*الإجمالي: 42,750 جنيه\*\*/.test(quickSumMarkdown(quickSum("إيجار ونش 3 أيام بـ 12,500 جنيه في اليوم وعليهم 14٪ ضريبة، المجموع كام؟"), "إيجار ونش 3 أيام بـ 12,500 جنيه في اليوم وعليهم 14٪ ضريبة، المجموع كام؟")), "the answer: the result in bold with its label, then the working");
const C = fs.readFileSync(new URL("../../web-src/chat.jsx", import.meta.url), "utf8");
ok(/const qs = fu \? fu\.q : quickSum\(typed\)/.test(C) && C.indexOf("quickSum(typed)") < C.indexOf("const pay = route && !img && !agentK"), "Chat answers these before Money's step and before anything reaches the model");
{ const { quickFollowUp } = await import("../../web-src/quicksum.js");
  ok(quickFollowUp("A phone costs 18,000 with 14% VAT included. What is the price before VAT?", "and with 10% VAT?").q.value === 16363.64, "the follow-up 'and with 10% VAT?' is the same sum with 10 % (the model took 100 s)");
  ok(quickFollowUp("إيجار ونش 3 أيام بـ 12,500 في اليوم وعليهم 14٪ ضريبة، المجموع كام؟", "ولو 5 أيام؟").q.value === 71250 && !quickFollowUp("إيجار ونش 3 أيام بـ 12,500 في اليوم وعليهم 14٪ ضريبة، المجموع كام؟", "thanks"), "«ولو 5 أيام؟» → 71,250; 'thanks' is not a follow-up"); }
ok(v("انا عندي 3 تفاحات وأكلت 2 فاضل كام") === 1 && v("مرتبي 12000 وبصرف 9000، فاضل كام؟") === 3000 && v("دفعت 2000 من 5000 والباقي كام") === 3000, "what is left: 1 apple (the model took 56 s), 3,000 of the salary, «دفعت 2000 من 5000» → 3,000");
for (const l of ["ar", "arb", "es", "fr", "de", "pt", "it", "ru", "tr", "id", "hi", "ur", "fa", "bn", "sw", "th", "vi", "zh", "ja", "ko"]) {
  const D = fs.readFileSync(new URL(`../../web-src/i18n-${l}.js`, import.meta.url), "utf8");
  ok(["Monthly payment", "Months needed", "Per year", "Per month", "Each part", "Price before", "Price after discount", "Tip", "Total", "Left"].every((k) => D.includes(JSON.stringify(k) + ":")), `the labels are in ${l}`);
}
// S2: the checked number is shown before the working is written
{
  let shown = null, explained = false;
  const llm = async (m) => { if (/explain the solution/.test(m[0].content)) { explained = shown != null; return "**42,750**\n1. …"; } return "```python\nprint('ANSWER: 42750')\n```"; };
  const r = await verifyMath({ question: "x", llm, runPy: async () => ({ ok: true, stdout: "ANSWER: 42750" }), onAnswer: (a) => { shown = a; } });
  ok(r.ok && shown === "42750" && explained, "S2: the number reaches the screen before the explanation is asked for");
  ok(/onAnswer: \(a\) => onToken\("\*\*"/.test(C), "…Chat shows it in bold at once");
}
// S3
{
  const P = fs.readFileSync(new URL("../../app/src/main/java/com/aldibiki/attune/Prefs.kt", import.meta.url), "utf8"), F = fs.readFileSync(new URL("../../app/src/main/java/com/aldibiki/attune/FastEngine.kt", import.meta.url), "utf8");
  ok(/fast_cpu_auto/.test(P) && /3L \* 24 \* 3600_000L/.test(P) && /fast_cpu_ver/.test(P), "S3: a move to the CPU the app made lasts 3 days or until an update, then the GPU is tried again");
  ok(/ExitWatch\.unexpectedAt >= at/.test(F) && (F.match(/setFastCpu\(ctx, true, auto = true\)/g) || []).length === 2, "S3: only a real crash (Android says so) moves it — not closing the app while it starts");
}
ok(RESULT.ok / RESULT.n >= 0.995, `2,500 cases: ${RESULT.ok}/${RESULT.n}`);
ok(RESULT.share >= 0.6, `different shapes ${(100 * RESULT.share).toFixed(1)} %`);
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`);
process.exit(fail ? 1 : 0);
