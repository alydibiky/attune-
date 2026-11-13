// v9.9.32 (Ali, 13 Nov 2026: "try the code and model with 100,000 scenarios and unique texts, also 100,000 texts chatting with the chat
// and ordering it in a very hard and unique way"): a 2,500 sample of each 100,000 run stays above its mark, and the cleaner that made
// the difference (wrapclean.js: wake words, fillers, thanks, indirect asking, a change of mind, negations, 7 more languages) keeps
// every case it was built for. The full runs: node tests/scenarios/mega.mjs · node tests/scenarios/chat100k.mjs
import { execFileSync } from "child_process";
import { cleanTyped, readable, negatedOrder } from "../../web-src/wrapclean.js";
const ok = (c, t) => { console.log((c ? "PASS " : "FAIL ") + t); if (!c) process.exitCode = 1; };
const run = (f) => execFileSync("node", [new URL("../scenarios/" + f, import.meta.url).pathname, "2500"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 26 });
const pct = (out) => +((/right \(([\d.]+)%\)/.exec(out) || [])[1] || 0);
const row = (out, g) => { const r = new RegExp("\\| " + g + " \\| (\\d+) \\| (\\d+) \\|").exec(out); return r ? +r[2] : -1; };

const mega = run("mega.mjs");
ok(pct(mega) >= 98.5, "100,000-sentence run, 2,500 sample: " + pct(mega) + "% right (the mark: 98.5%)");
for (const g of ["spend_story_en", "spend_story_ar", "spend_short_mix", "income", "remind_en_time", "remind_ar_time", "remind_repeat", "debt_ar", "plans", "two_orders"]) ok(row(mega, g) === 0, "mega " + g + ": none wrong (" + row(mega, g) + ")");
const chat = run("chat100k.mjs");
ok(pct(chat) >= 98.5, "100,000 chat orders, 2,500 sample: " + pct(chat) + "% right (the mark: 98.5%)");
for (const g of ["corrections", "negations", "open_pages", "ai_questions_numbers", "own_data_questions", "agents_odd", "other_languages", "franco_hard", "indirect_remind_ar"]) ok(row(chat, g) === 0, "chat " + g + ": none wrong (" + row(chat, g) + ")");

// the cleaner, case by case
const C = [
  ["hey attune, remind me tomorrow at 9 to call mama thanks", "remind me tomorrow at 9 to call mama"], ["يا أتيون، صرفت 150 على الغدا شكرا", "صرفت 150 على الغدا"],
  ["ok so lunch 150 🙏", "lunch 150"], ["remind me at 5 to call Sara ok?", "remind me at 5 to call Sara"], ["half of 850.", "half of 850"], ["pay 2.5.", "pay 2.5"],
  ["TELL ME IF HASSAN TEXTS ME", "tell me if Hassan texts me"], ["hi", "hi"], ["thanks 🙏", "thanks 🙏"], ["hey attune, thanks", "hey attune, thanks"], ["بص على سعر الايفون", "بص على سعر الايفون"],
  ["listen to the podcast", "listen to the podcast"], ["what is the capital of Peru?", "what is the capital of Peru?"],
];
for (const [a, b] of C) ok(cleanTyped(a) === b, "clean «" + a + "» → «" + cleanTyped(a) + "»");
const R = [
  ["ping me tomorrow at 9 am to call mama", "remind me tomorrow at 9 am to call mama"], ["can you make sure I send the report on Saturday at 11 am", "remind me to send the report on Saturday at 11 am"],
  ["I keep forgetting to take my medicine, remind me at 9 am", "remind me at 9 am to take my medicine"], ["heads up this evening at 7: buy bread", "remind me this evening at 7 to buy bread"],
  ["ping me if a Kindle dips below 15000", "tell me when a Kindle goes under 15000"], ["خليك فاكرلي بكرة الساعة 9 الصبح اني اكلم ماما", "فكرني بكرة الساعة 9 الصبح اني اكلم ماما"],
  ["remind me tomorrow at 7 am, sorry 8 am, to move the car", "remind me tomorrow at 8 am to move the car"], ["paid 1750 for breakfast — no wait, it was 650", "paid 650 for breakfast"],
  ["دفعت 275 الغدا لا قصدي 600", "دفعت 600 الغدا"], ["Aisha fronted me 8000", "Aisha lent me 8000"], ["زياد لسه مرجعليش ال40000", "زياد عليه 40000"],
  ["gasté 50 en el almuerzo", "spent 50 on el almuerzo"], ["benzin için 658 lira harcadım", "spent 658 TRY on benzin"], ["bayar 50 ribu untuk kopi", "spent 50000 IDR on kopi"],
  ["recuérdame mañana a las 9 llamar a Sara", "remind me tomorrow at 9 to llamar a Sara"], ["ricordami tra 2 ore di chiamare Sara", "remind me in 2 hours to chiamare Sara"],
  ["it costs 300 euros", "it costs 300 euros"], ["take me to the airport", "take me to the airport"],
];
for (const [a, b] of R) ok(readable(a) === b, "readable «" + a + "» → «" + readable(a) + "»");
for (const s of ["don't remind me to pick up the kids", "I don't owe Ahmed anything", "متفكرنيش ادفع للشغالة", "مصرفتش حاجة النهارده"]) ok(negatedOrder(s), "negated: «" + s + "»");
for (const s of ["Ahmed owes me 500", "don't let me forget to call mama", "remind me to call Sara"]) ok(!negatedOrder(s), "not negated: «" + s + "»");
