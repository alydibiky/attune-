// v9.0 (Ali picked B, "for all languages"): the referee. A bank of real sentences in all 20 languages — each must be seen as its
// kind; a sentence with two kinds goes to the model (and is learned); without a model, doing wins over looking up; a kind only
// the words suggest is never forced by code.
import { lexSignals, signalsOf, decide, judgeMessages, parseJudge, referee, learn, loadLearned, looksFranco } from "../../web-src/understand.js";
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } };
const BANK = {
  action: ["Remind me on the last day of each month to pay interest for mom", "set an alarm for 6", "فكرني آخر يوم في كل شهر أدفع فوايد ماما", "ذكّرني بموعد الطبيب غدًا",
    "Recuérdame pagar el alquiler el día 1", "Rappelle-moi d'appeler maman demain", "Erinnere mich morgen an den Arzttermin", "Lembre-me de pagar a conta amanhã", "Ricordami di pagare l'affitto",
    "Напомни мне заплатить за квартиру", "Yarın faturayı ödemeyi hatırlat", "Ingatkan saya bayar listrik besok", "मुझे कल बिल भरने की याद दिलाना", "مجھے کل بل ادا کرنے کی یاد دلانا",
    "فردا یادم بنداز قبض را بپردازم", "আমাকে কাল বিল দিতে মনে করিয়ে দিও", "Nikumbushe kulipa kodi kesho", "เตือนฉันจ่ายค่าไฟพรุ่งนี้", "Nhắc tôi trả tiền điện ngày mai",
    "明天提醒我交电费", "明日電気代を払うのをリマインドして", "내일 전기세 내라고 리마인드 해줘"],
  "money-ask": ["how much did I spend this month?", "صرفت كام الشهر ده", "كم أنفقت هذا الشهر؟", "¿Cuánto gasté este mes?", "Combien j'ai dépensé ce mois-ci ?", "Wie viel habe ich diesen Monat ausgegeben?",
    "Quanto gastei este mês?", "Quanto ho speso questo mese?", "Сколько я потратил в этом месяце?", "Bu ay ne kadar harcadım?", "Berapa yang saya habiskan bulan ini?", "इस महीने मैंने कितना खर्च किया?",
    "اس مہینے میں نے کتنا خرچ کیا؟", "این ماه چقدر خرج کردم؟", "এই মাসে আমি কত খরচ করেছি?", "Mwezi huu nimetumia kiasi gani?", "เดือนนี้ฉันใช้เงินไปเท่าไหร่", "Tháng này tôi đã tiêu bao nhiêu?",
    "这个月我花了多少钱？", "今月いくら使った？", "이번 달에 얼마나 썼어?"],
  research: ["gather information on solar panels for a flat in Cairo", "جمعلي معلومات عن الطاقة الشمسية", "اجمع لي معلومات عن السيارات الكهربائية", "Reúne información sobre paneles solares", "Fais une recherche sur les voitures électriques",
    "Sammle Informationen über Solaranlagen", "Pesquise sobre carros elétricos", "Raccogli informazioni sui pannelli solari", "Собери информацию о солнечных панелях", "Elektrikli arabaları araştır",
    "Kumpulkan informasi tentang panel surya", "सोलर पैनल के बारे में जानकारी इकट्ठा करो", "سولر پینلز کے بارے میں معلومات جمع کرو", "درباره پنل خورشیدی تحقیق کن", "সোলার প্যানেল নিয়ে তথ্য জোগাড় করো",
    "Kusanya taarifa kuhusu paneli za jua", "รวบรวมข้อมูลเกี่ยวกับแผงโซลาร์", "Thu thập thông tin về pin mặt trời", "收集一下太阳能板的信息", "ソーラーパネルについて情報を集めて", "태양광 패널에 대해 정보를 모아 줘"],
  agent: ["tell me when Huawei FreeClip 2 is under 8400", "نبهني لما الايفون ينزل أقل من 40 ألف", "Avísame cuando el iPhone baje de 900", "Préviens-moi quand l'iPhone passe sous 900 €", "Sag mir, wenn das iPhone unter 900 fällt",
    "Me avise quando o iPhone ficar abaixo de 900", "Avvisami quando l'iPhone scende sotto 900", "Сообщи, когда iPhone станет дешевле 900", "iPhone 900'ün altına düşünce haber ver", "Kabari saya kalau iPhone di bawah 900",
    "जब iPhone 900 से सस्ता हो तो बताना", "خبرم کن وقتی آیفون زیر ۹۰۰ شد", "บอกฉันเมื่อราคา iPhone ต่ำกว่า 900", "Báo tôi khi giá iPhone dưới 900", "iPhone降到900以下告诉我", "iPhoneが900以下に下がったら教えて", "아이폰이 900 아래로 떨어지면 알려줘"],
};
for (const [k, list] of Object.entries(BANK)) for (const s of list) ok(lexSignals(s).has(k), k + " not seen: " + s);
// plain questions and chat are not taken by any kind
for (const s of ["what's the capital of France?", "اشرحلي النسبية", "¿Qué hora es en Tokio?", "Explique-moi la photosynthèse", "Wer hat die Relativitätstheorie entdeckt?", "日本の首都はどこ？", "How are you today?", "what is the best alarm clock app?"])
  ok(decide(signalsOf(s), s, {}, new Set()).pick === null, "a plain question is not forced into a kind: " + s);
// Ali's sentence: a reminder, never a money question — even though "me" + "pay" looked like one
const ali = "Remind me on the last day of each month to pay interest for mom";
const sa = signalsOf(ali, { action: true, "money-ask": true });
ok(sa.has("action") && !sa.has("money-ask"), "Ali's sentence: the money question drops out");
ok(decide(sa, ali, {}, new Set(["action"])).pick === "action", "→ action at once, no model needed");
// two kinds → the model decides, the pick is learned
const mem = { m: {}, getItem(k) { return this.m[k] || null; }, setItem(k, v) { this.m[k] = v; } };
const two = "I paid 500 for the gym, remind me next month";
const d2 = decide(signalsOf(two, { "money-log": true, action: true }), two, {}, new Set(["money-log", "action"]));
ok(d2.unsure && d2.candidates.includes("money-log") && d2.candidates.includes("action") && d2.candidates.includes("chat") && d2.fallback === "action", "two kinds → ask the model; without it, doing first");
ok(judgeMessages(two, d2.candidates)[0].content.includes("money-log:") && parseJudge("money-log", d2.candidates) === "money-log" && parseJudge(" **Action**.", d2.candidates) === "action" && parseJudge("I don't know", d2.candidates) === null, "the model's short answer is read");
const run = async () => {
  const r1 = await referee(two, { "money-log": true, action: true }, { ask: async () => "money-log", ls: mem });
  ok(r1.kind === "money-log" && r1.how === "model", "the model picks money-log");
  const r2 = await referee("I paid 700 for the gym, remind me next month", { "money-log": true, action: true }, { ask: async () => { throw new Error("not asked"); }, ls: mem });
  ok(r2.kind === "money-log" && r2.how === "learned", "the same shape is learned (numbers don't matter)");
  const r3 = await referee("Recuérdame pagar el alquiler el día 1", {}, { ask: async () => "action", ls: mem });
  ok(r3.kind === "action" && r3.how === "model", "Spanish: only the words saw it → the model confirms → action");
  const r4 = await referee("what is the best alarm clock app?", {}, { ask: async () => "chat", ls: mem });
  ok(r4.kind === "chat", "'best alarm clock app?' → the model says it's a question");
  const r5 = await referee("Recuérdame pagar el alquiler", {}, { ask: null, ls: { getItem: () => null, setItem() {} } });
  ok(r5.kind === null, "no model: words alone change nothing");
  const r6 = await referee("x", {}, { ask: () => new Promise(() => {}), timeoutMs: 50, ls: mem });
  ok(r6.kind === null, "nothing seen → nothing forced");
  const r7 = await referee(two.replace("500", "900") + "!", { "money-log": true, action: true }, { ask: () => new Promise(() => {}), timeoutMs: 50, ls: { getItem: () => null, setItem() {} } });
  ok(r7.kind === "action" && r7.how === "order", "the model too slow → doing first");
  // v9.1 (e2e_v542): an English sentence with one Egyptian dish in it is not Franco (it was rewritten «…of كشري…» and answered in Arabic)
  for (const t of ["I ate a plate of koshari and a can of cola", "I had ful and taameya for breakfast", "can you call mama tomorrow"]) ok(!looksFranco(t), "English, not Franco: " + t);
  for (const t of ["fakarny bokra el sa3a 9 akalem mama", "ana 3ayez koshari", "akalt koshari"]) ok(looksFranco(t), "Franco: " + t);
  console.log(bad ? bad + " FAILED" : "PASS v903understand: the referee, in all 20 languages");
};
run();
