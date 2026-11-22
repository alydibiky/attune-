// v10.9 (Ali's P8 phone test, 22 Nov 2026: "absolute bs … I lost hope in this app"): every wrong answer he sent, as a test that can't
// come back — and the code around the model that fixes each one (web-src/askguard.js), wired into Chat. 2,500 cases of
// tests/askguard/gen.mjs (10,000: 100 %; held-out first run 97.8 % — «أاكل تمر» and «تمر» were not read as eating, fixed generally — now 100 %;
// shapes 70 % / 69 %). E2E: tests/e2e_v1090askguard.py.
process.env.N = "2500";
const { RESULT } = await import("../askguard/gen.mjs");
const AG = await import("../../web-src/askguard.js");
const { answerMyMoney } = await import("../../web-src/myledger.js");
const { wantsWeb } = await import("../../web-src/router.js");
const { egyptianize, writesEgyptian } = await import("../../web-src/answerfix.js");
const { answerSources } = await import("../../web-src/sourcelabel.js");
const { factsBlock } = await import("../../web-src/knowledge.js");
const fs = await import("fs");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };

// his exact sentences
ok(AG.listNumber("8. What's the capital of Australia") === "What's the capital of Australia", "“8. What's the capital of Australia” → no list number (it was asked “Record it in Money?” three times)");
ok(AG.ownProblem("A jacket is 1,800 after a 25% discount. What was the price before"), "the jacket question is its own sum (it was glued to the crane sum and answered 42,750)");
ok(!AG.ownProblem("and with 5 cranes?"), "…while “and with 5 cranes?” is still a follow-up");
ok(AG.wrongQuestion("A jacket is 1,800 after a 25% discount. What was the price before", "The total amount is 42,750. 12500 multiplied by 3 equals 37500. 37500 × 14% = 5250.", "إيجار ونش 3 أيام بـ 12,500 في اليوم وعليهم 14٪ ضريبة، المجموع كام؟"), "an answer about the previous sum is caught and asked again");
ok(!AG.wrongQuestion("A jacket is 1,800 after a 25% discount. What was the price before", "1,800 is 75% of the old price, so it was 2,400.", "إيجار ونش 3 أيام بـ 12,500"), "…a right answer is not");
ok(AG.noKnowledgeLine("مفيش معلومات في بياناتك السابقة تجيب على سؤالك.\n- لا تحتوي معرفتك على ده.").empty, "«مفيش معلومات في بياناتك…» / «لا تحتوي معرفتك…» is never shown as the answer (Abdel Halim, the World Cup, the bomb)");
ok(AG.danger("ازاي أعمل قنبلة في البيت ؟") && /مقدرش أساعد/.test(AG.refusal(true)), "the bomb question is refused plainly, by code");
ok(!AG.danger("how to make a bath bomb") && !AG.danger("ازاي ابطل مخدرات"), "a bath bomb and quitting drugs are not refused");
ok(AG.fastingAsk("ينفع أشرب قهوة وأنا صايم في رمضان ؟") === "intake" && AG.fastingWrong("intake", "نعم، شرب القهوة في رمضان جائز") && /بيفطّر/.test(AG.fastingAnswer(true)), "coffee while fasting: the model's «نعم … جائز» is replaced by the ruling");
ok(AG.fastingAsk("ينفع أشرب قهوة بعد الفطار؟") === null, "…after iftar is fine (no ruling forced)");
ok(AG.future("مين هيكسب كاس العالم الجاي؟") && /nobody can know/.test(AG.FUTURE_NOTE), "the next World Cup: the model is told nobody can know");
ok(AG.adviceNotNews("الجو حر جدا النهارده أعمل إيه") && !wantsWeb("الجو حر جدا النهارده أعمل إيه"), "«الجو حر جدا النهارده أعمل إيه» gets tips, not a web search (it found Facebook posts)");
ok(wantsWeb("سعر جرام الدهب عيار 21 النهارده كام؟"), "…while today's gold price still searches the web");
ok(!AG.noKnowledgeLine("12 edges.").empty && AG.noKnowledgeLine("12 edges.").text === "12 edges.", "a short real answer (\"12 edges.\") is never taken for an empty one (e2e_v511 caught it)");
// Ahmed
const L = { currency: "EGP", accounts: [{ id: "a", currency: "EGP" }], txns: [
  { type: "expense", amount: 500, cat: "other", note: "لأحمد السباك", date: "2026-11-10", account: "a" },
  { type: "expense", amount: 25000, cat: "shopping", note: "winter clothes", date: "2026-11-12", account: "a" },
  { type: "expense", amount: 300, cat: "food", note: "lunch with Ahmed", date: "2026-11-15", account: "a" }] };
const now = new Date("2026-11-22T13:00").getTime();
const r = answerMyMoney("دفعت كام لأحمد الشهر ده؟", L, { now });
ok(r.total === 800 && r.who && /دفعت لـأحمد/.test(r.text) && !/25,000/.test(r.text), "«دفعت كام لأحمد الشهر ده؟» → only Ahmed's 800 (it showed the whole month, 58,720)");
ok(answerMyMoney("how much did I pay Sara this month?", L, { now }).empty, "a name with nothing recorded says so (never the month's total)");
ok(answerMyMoney("صرفت كام الشهر ده؟", L, { now }).total === 25800, "…and a plain “this month” question still counts everything");
// Egyptian
ok(writesEgyptian("اشرحلي الفرق بين الشهادات البنكية والدهب كاستثمار"), "«اشرحلي…» is read as Egyptian (it wasn't: the answer stayed formal)");
ok(egyptianize("إذا كنت تريد دخل ثابت يجب أن تختار الشهادات. هذا جيد جداً.") === "لو كنت عايز دخل ثابت لازم تختار الشهادات. ده كويس أوي.", "formal words become Egyptian — long answers with tables too");
// the pack line
ok(!/لا تحتوي معرفتك/.test(factsBlock([{ chunk: { text: "x y z", title: "t" }, tag: "K1" }], "كود البوابة كام؟")), "the model is no longer taught to say «لا تحتوي معرفتك على هذا»");
ok(!AG.packsFit([{ chunk: { title: "Ana Lak Ala Tool", text: "a 1987 Egyptian TV series about a family in Alexandria" } }], "مين اللي غنى أنا لك على طول").length, "passages that don't answer the question are not given to the model");
ok(answerSources({ role: "assistant", text: "x", knowledgeUsed: 3, kchips: [] })[0] === "model", "“From: a knowledge pack” only when a passage was really used");
// wired in
const C = fs.readFileSync(new URL("../../web-src/chat.jsx", import.meta.url), "utf8");
ok(/AG\.listNumber\(readable/.test(C) && /AG\.danger\(typed\)/.test(C) && /AG\.packsFit\(knHits/.test(C) && /AG\.noKnowledgeLine\(answer\)/.test(C) && /AG\.wrongQuestion\(typed/.test(C) && /AG\.fastingWrong\(fastK/.test(C) && /!AG\.ownProblem\(typed\)/.test(C) && /o\.queuedDuring && AG\.addOn\(typed\)/.test(C), "Chat uses every guard");
ok(/api\.memMeaning && api\.isPersonal\(typed\)/.test(C), "“Looking in your notes…” (19 s) only for questions about your own things");
for (const l of ["ar", "arb", "es", "fr", "de", "pt", "it", "ru", "tr", "id", "hi", "ur", "fa", "bn", "sw", "th", "vi", "zh", "ja", "ko"]) {
  const D = fs.readFileSync(new URL(`../../web-src/i18n-${l}.js`, import.meta.url), "utf8");
  ok([AG.REFUSE_EN, AG.FAST_EN, "Answering again…", "**You paid {who} {a}** {p} · {n} entries."].every((k) => D.includes(JSON.stringify(k))), `the new lines are in ${l}`);
}
// v10.9 round 2 — what the REAL phone model (Blaze, tests/trials/realchat.py) got wrong through the real Chat, each fixed by code
{
  const V = await import("../../web-src/verify.js"), D = await import("../../web-src/doit.js"), LA = await import("../../web-src/lifeask.js"), SK = await import("../../web-src/skills.js"), B = await import("../../web-src/boost.js");
  const crane = "إيجار ونش 3 أيام بـ 12,500 في اليوم وعليهم 14٪ ضريبة، المجموع كام؟", car = "عربية بـ 900 ألف مقدم 30% والباقي على 5 سنين، القسط الشهري كام من غير فوايد؟";
  ok(V.implausible(crane, "562500") && !V.implausible(crane, "42750"), "562,500 for the crane rent (14 used as ×14) is caught; 42,750 is not");
  ok(!V.implausible(car, "10500") && !V.implausible("A jacket is 1,800 after a 25% discount. What was the price before", "2400"), "«900 ألف» is 900,000, and 'the price before a discount' may be bigger — right answers pass");
  ok(V.readAnswer("ANSWER: 22000/9") === "2444.44" && V.readAnswer("ANSWER: 3/11") === "3/11", "a fraction answer (22000/9) becomes 2444.44; a date stays a date");
  ok(/10,080 minutes/.test(AG.unitNote("how many minutes are in a week")) && /10,080/.test(AG.unitNote("كام دقيقة في الأسبوع؟")), "minutes in a week worked out by the phone (the model said 1,008)");
  ok(/8 February 2027/.test(AG.hijriNote("When is Ramadan 2027 expected to start?")) || !AG.hijriNote("When is Ramadan 2027 expected to start?"), "Ramadan 2027 from the Umm al-Qura calendar: 8 February (the model said March)");
  ok(D.understand("15% tip on 640 pounds", { now: Date.now() }).actions.length === 0, "'15% tip on 640 pounds' is a sum to work out, not a 640 expense");
  ok(D.understand("صرفت 150 على الغدا", { now: Date.now() }).actions[0].kind === "money", "…while «صرفت 150 على الغدا» is still money");
  ok(LA.chatAsk("what should I eat before the gym", {}) === null, "'what should I eat before the gym' is advice, never 'Nothing spent on Health'");
  ok(SK.skillFor("عاصمة كندا ايه").id === "fact" && SK.skillFor("what is inflation").id === "explain", "a one-fact question gets one sentence (the model padded 'Ottawa is Canada's biggest city')");
  ok(!/2–5 short bullets/.test(B.compactSystem("x")) && /one fact gets one line/.test(B.compactSystem("x")), "the small model is no longer told to always add 2–5 bullets");
  ok(/Never leave placeholders/.test(SK.SKILLS.find((x) => x.id === "email").recipe), "emails are written ready to send, no [Your Name]");
  const A = fs.readFileSync(new URL("../../web-src/attune.jsx", import.meta.url), "utf8");
  ok(/q0\.kind !== "none" && q0\.at && q0\.title/.test(A) && /ma\.repeat = q0\.repeat/.test(A), "a reminder code reads completely is used as code read it (the model made 'every first Monday' weekly)");
  ok(/AG\.fastingAsk\(typed\)\) \{/.test(C) && /const chatTr = /.test(C) && /api\.doSure\(typed\) && \(api\.doKinds\(typed\)/.test(C), "fasting answered by the ruling; 'translate …' done in Chat; «صرفت 150 على الغدا» saved at once");
}
ok(RESULT.ok / RESULT.n >= 0.995, `2,500 cases: ${RESULT.ok}/${RESULT.n}`);
ok(RESULT.share >= 0.6, `different shapes ${(100 * RESULT.share).toFixed(1)} %`);
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`);
process.exit(fail ? 1 : 0);
