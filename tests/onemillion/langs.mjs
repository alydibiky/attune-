// 1M test part A3 (TEST_1M.md): EXACTLY 100,000 different sentences in Attune's 20 interface languages + Franco — the way people in
// each language say: I spent N on X · remind me tomorrow at H to X · X owes me N / I owe X N · tell me when X is under N · how much did I
// spend this month · and a general question that must NOT be saved. Written here by hand per language (not copied from the app's own
// word lists, so the test can fail). Right = the app does it by code with the right kind (and the amount / hour where the code reads it),
// or it hands it to the model with the right kind among the model's choices (the referee) — counted apart as "left to the model".
//     node tests/onemillion/langs.mjs [count]
import fs from "fs";
const { classify } = await import("../scenarios/brain.mjs");
const { parseLife } = await import("../../web-src/life.js");
const { readable } = await import("../../web-src/wrapclean.js");
const UND = await import("../../web-src/understand.js");
const asRead = (s) => { const rd = readable(s); return UND.looksFranco(rd) ? UND.francoToArabic(rd) : rd; };   // the same steps as chat.jsx
const TOTAL = +(process.argv[2] || 100000);
let seed = 4242 + 7919 * +(process.env.SEED_SHIFT || 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const NOW = Date.parse("2026-11-10T12:00:00");
const AMT = [25, 40, 55, 75, 90, 120, 150, 180, 220, 250, 300, 350, 420, 480, 550, 600, 750, 900, 1200, 1500, 1800, 2400, 3000, 4500, 6000];
// per language: items, tasks, products, names, and templates {spend, remind, owe_in, owe_out, watch, ask, chat}, polite wrappers
const L0 = {
  en: { it: ["lunch", "a taxi", "coffee", "groceries", "petrol", "medicine", "the gym", "a haircut"], tk: ["call Sara", "pay the rent", "take my medicine", "send the report"], pr: ["iPhone 16", "PS5", "AirPods Pro", "a Kindle"],
    spend: ["I spent {a} on {i}", "paid {a} for {i}", "{i} cost me {a}"], remind: ["remind me tomorrow at {h} to {t}", "set a reminder for tomorrow at {h}: {t}"], owe_in: ["{n} owes me {a}", "I lent {n} {a}"], owe_out: ["I owe {n} {a}", "I borrowed {a} from {n}"],
    watch: ["tell me when the {p} is under {a}", "let me know if the {p} drops below {a}"], ask: ["how much did I spend this month?", "where did my money go this week?"], chat: ["what is the capital of Japan?", "write a poem about the sea", "explain how vaccines work"], wrap: ["", "please ", "hey, "] },
  ar: { it: ["الغدا", "تاكسي", "القهوة", "الخضار", "البنزين", "الدوا", "الجيم", "الحلاق"], tk: ["اكلم سارة", "ادفع الايجار", "اخد الدوا", "ابعت التقرير"], pr: ["ايفون 16", "بلايستيشن 5", "سماعة ابل", "كيندل"],
    spend: ["صرفت {a} على {i}", "دفعت {a} في {i}", "{i} كلفني {a}"], remind: ["فكرني بكرة الساعة {h} {t}", "عايز تذكير بكرة الساعة {h} عشان {t}"], owe_in: ["{n} عليه {a}", "سلفت {n} {a}"], owe_out: ["عليا ل{n} {a}", "استلفت {a} من {n}"],
    watch: ["قولي لما {p} يبقى اقل من {a}", "نبهني لو {p} نزل تحت {a}"], ask: ["صرفت كام الشهر ده؟", "فلوسي راحت فين الاسبوع ده؟"], chat: ["ايه عاصمة اليابان؟", "اكتبلي شعر عن البحر", "اشرحلي التطعيمات بتشتغل ازاي"], wrap: ["", "لو سمحت ", "بقولك "] },
  arb: { it: ["الغداء", "سيارة أجرة", "القهوة", "البقالة", "الوقود", "الدواء", "النادي", "الحلاقة"], tk: ["أتصل بسارة", "أدفع الإيجار", "آخذ الدواء", "أرسل التقرير"], pr: ["آيفون 16", "بلايستيشن 5", "سماعة أبل", "كيندل"],
    spend: ["أنفقت {a} على {i}", "دفعت {a} مقابل {i}", "كلفني {i} {a}"], remind: ["ذكّرني غدًا الساعة {h} أن {t}", "أريد تذكيرًا غدًا الساعة {h} كي {t}"], owe_in: ["{n} مدين لي بـ {a}", "أقرضت {n} {a}"], owe_out: ["أنا مدين لـ {n} بـ {a}", "اقترضت {a} من {n}"],
    watch: ["أخبرني عندما يصبح {p} أقل من {a}", "نبهني إذا انخفض {p} عن {a}"], ask: ["كم أنفقت هذا الشهر؟", "أين ذهبت أموالي هذا الأسبوع؟"], chat: ["ما عاصمة اليابان؟", "اكتب قصيدة عن البحر", "اشرح كيف تعمل اللقاحات"], wrap: ["", "من فضلك ", "مرحبًا، "] },
  fr: { it: ["le déjeuner", "un taxi", "le café", "les courses", "l'essence", "les médicaments", "la salle de sport", "le coiffeur"], tk: ["appeler Sara", "payer le loyer", "prendre mes médicaments", "envoyer le rapport"], pr: ["iPhone 16", "PS5", "AirPods Pro", "Kindle"],
    spend: ["j'ai dépensé {a} pour {i}", "j'ai payé {a} pour {i}", "{i} m'a coûté {a} euros"], remind: ["rappelle-moi demain à {h}h de {t}", "mets un rappel demain à {h}h pour {t}"], owe_in: ["{n} me doit {a}", "j'ai prêté {a} à {n}"], owe_out: ["je dois {a} à {n}", "j'ai emprunté {a} à {n}"],
    watch: ["préviens-moi quand l'{p} passe sous {a}", "dis-moi si le {p} descend sous {a}"], ask: ["combien j'ai dépensé ce mois-ci ?", "où est passé mon argent cette semaine ?"], chat: ["quelle est la capitale du Japon ?", "écris un poème sur la mer", "explique comment marchent les vaccins"], wrap: ["", "s'il te plaît ", "dis, "] },
  es: { it: ["el almuerzo", "un taxi", "el café", "el súper", "la gasolina", "la medicina", "el gimnasio", "el barbero"], tk: ["llamar a Sara", "pagar el alquiler", "tomar la medicina", "enviar el informe"], pr: ["iPhone 16", "PS5", "AirPods Pro", "Kindle"],
    spend: ["gasté {a} en {i}", "pagué {a} por {i}", "{i} me costó {a} euros"], remind: ["recuérdame mañana a las {h} {t}", "ponme un recordatorio mañana a las {h} para {t}"], owe_in: ["{n} me debe {a}", "le presté {a} a {n}"], owe_out: ["le debo {a} a {n}", "le pedí prestados {a} a {n}"],
    watch: ["avísame cuando el {p} baje de {a}", "dime si el {p} cuesta menos de {a}"], ask: ["¿cuánto gasté este mes?", "¿en qué gasté esta semana?"], chat: ["¿cuál es la capital de Japón?", "escribe un poema sobre el mar", "explica cómo funcionan las vacunas"], wrap: ["", "por favor, ", "oye, "] },
  de: { it: ["Mittagessen", "ein Taxi", "Kaffee", "Lebensmittel", "Benzin", "Medikamente", "das Fitnessstudio", "den Friseur"], tk: ["Sara anzurufen", "die Miete zu zahlen", "meine Medizin zu nehmen", "den Bericht zu schicken"], pr: ["iPhone 16", "PS5", "AirPods Pro", "Kindle"],
    spend: ["ich habe {a} euro für {i} bezahlt", "{a} euro für {i} ausgegeben", "{i} hat mich {a} euro gekostet"], remind: ["erinnere mich morgen um {h} daran, {t}", "stell eine Erinnerung für morgen um {h}: {t}"], owe_in: ["{n} schuldet mir {a}", "ich habe {n} {a} geliehen"], owe_out: ["ich schulde {n} {a}", "ich habe mir {a} von {n} geliehen"],
    watch: ["sag mir, wenn das {p} unter {a} fällt", "benachrichtige mich, wenn das {p} weniger als {a} kostet"], ask: ["wie viel habe ich diesen Monat ausgegeben?", "wofür habe ich diese Woche Geld ausgegeben?"], chat: ["was ist die Hauptstadt von Japan?", "schreib ein Gedicht über das Meer", "erkläre, wie Impfungen funktionieren"], wrap: ["", "bitte ", "hey, "] },
  pt: { it: ["almoço", "táxi", "café", "mercado", "gasolina", "remédio", "academia", "barbeiro"], tk: ["ligar para a Sara", "pagar o aluguel", "tomar o remédio", "enviar o relatório"], pr: ["iPhone 16", "PS5", "AirPods Pro", "Kindle"],
    spend: ["gastei {a} no {i}", "paguei {a} pelo {i}", "o {i} me custou {a} reais"], remind: ["me lembre amanhã às {h} de {t}", "coloca um lembrete amanhã às {h} para {t}"], owe_in: ["{n} me deve {a}", "emprestei {a} para {n}"], owe_out: ["devo {a} para {n}", "peguei {a} emprestado com {n}"],
    watch: ["me avise quando o {p} ficar abaixo de {a}", "me diga se o {p} cair para menos de {a}"], ask: ["quanto eu gastei este mês?", "onde foi parar meu dinheiro esta semana?"], chat: ["qual é a capital do Japão?", "escreva um poema sobre o mar", "explique como as vacinas funcionam"], wrap: ["", "por favor, ", "ei, "] },
  it: { it: ["il pranzo", "un taxi", "il caffè", "la spesa", "la benzina", "le medicine", "la palestra", "il barbiere"], tk: ["chiamare Sara", "pagare l'affitto", "prendere la medicina", "mandare il report"], pr: ["iPhone 16", "PS5", "AirPods Pro", "Kindle"],
    spend: ["ho speso {a} per {i}", "ho pagato {a} per {i}", "{i} mi è costato {a} euro"], remind: ["ricordami domani alle {h} di {t}", "metti un promemoria domani alle {h} per {t}"], owe_in: ["{n} mi deve {a}", "ho prestato {a} a {n}"], owe_out: ["devo {a} a {n}", "ho preso in prestito {a} da {n}"],
    watch: ["avvisami quando l'{p} scende sotto {a}", "dimmi se la {p} costa meno di {a}"], ask: ["quanto ho speso questo mese?", "dove sono finiti i miei soldi questa settimana?"], chat: ["qual è la capitale del Giappone?", "scrivi una poesia sul mare", "spiega come funzionano i vaccini"], wrap: ["", "per favore ", "ehi, "] },
  tr: { it: ["öğle yemeği", "taksi", "kahve", "market", "benzin", "ilaç", "spor salonu", "berber"], tk: ["Sara'yı aramayı", "kirayı ödemeyi", "ilacımı almayı", "raporu göndermeyi"], pr: ["iPhone 16", "PS5", "AirPods Pro", "Kindle"],
    spend: ["{i} için {a} lira harcadım", "{i} için {a} lira ödedim", "{i} bana {a} liraya patladı"], remind: ["yarın saat {h}'da {t} hatırlat", "yarın saat {h} için hatırlatıcı kur: {t}"], owe_in: ["{n} bana {a} borçlu", "{n}'e {a} borç verdim"], owe_out: ["{n}'e {a} borcum var", "{n}'den {a} borç aldım"],
    watch: ["{p} {a}'in altına düşünce haber ver", "{p} {a}'den ucuz olursa bana söyle"], ask: ["bu ay ne kadar harcadım?", "bu hafta param nereye gitti?"], chat: ["Japonya'nın başkenti neresi?", "deniz hakkında bir şiir yaz", "aşılar nasıl çalışır anlat"], wrap: ["", "lütfen ", "baksana, "] },
  id: { it: ["makan siang", "taksi", "kopi", "belanja", "bensin", "obat", "gym", "potong rambut"], tk: ["telepon Sara", "bayar sewa", "minum obat", "kirim laporan"], pr: ["iPhone 16", "PS5", "AirPods Pro", "Kindle"],
    spend: ["bayar {a} untuk {i}", "habis {a} buat {i}", "{i} {a} ribu"], remind: ["ingatkan aku besok jam {h} untuk {t}", "pasang pengingat besok jam {h} untuk {t}"], owe_in: ["{n} utang {a} ke aku", "aku pinjamkan {a} ke {n}"], owe_out: ["aku utang {a} ke {n}", "aku pinjam {a} dari {n}"],
    watch: ["kabari saya kalau {p} di bawah {a}", "kasih tahu kalau harga {p} turun di bawah {a}"], ask: ["berapa yang aku habiskan bulan ini?", "uangku habis ke mana minggu ini?"], chat: ["apa ibu kota Jepang?", "tulis puisi tentang laut", "jelaskan cara kerja vaksin"], wrap: ["", "tolong ", "eh, "] },
  ru: { it: ["обед", "такси", "кофе", "продукты", "бензин", "лекарства", "спортзал", "стрижку"], tk: ["позвонить Саре", "заплатить за квартиру", "выпить лекарство", "отправить отчёт"], pr: ["iPhone 16", "PS5", "AirPods Pro", "Kindle"],
    spend: ["потратил {a} на {i}", "заплатил {a} за {i}", "{i} обошёлся мне в {a}"], remind: ["напомни завтра в {h} {t}", "поставь напоминание на завтра в {h}: {t}"], owe_in: ["{n} должен мне {a}", "я одолжил {n} {a}"], owe_out: ["я должен {n} {a}", "я занял {a} у {n}"],
    watch: ["сообщи, когда {p} станет дешевле {a}", "скажи, если {p} упадёт ниже {a}"], ask: ["сколько я потратил в этом месяце?", "куда ушли мои деньги на этой неделе?"], chat: ["какая столица Японии?", "напиши стихотворение о море", "объясни, как работают вакцины"], wrap: ["", "пожалуйста, ", "слушай, "] },
  hi: { it: ["लंच", "टैक्सी", "कॉफ़ी", "राशन", "पेट्रोल", "दवा", "जिम", "बाल कटाई"], tk: ["सारा को फ़ोन करना", "किराया भरना", "दवा लेना", "रिपोर्ट भेजना"], pr: ["iPhone 16", "PS5", "AirPods Pro", "Kindle"],
    spend: ["{i} पर {a} खर्च किए", "{i} के लिए {a} दिए", "{i} में {a} लग गए"], remind: ["कल {h} बजे मुझे याद दिलाना {t}", "कल {h} बजे का रिमाइंडर लगाओ: {t}"], owe_in: ["{n} पर मेरे {a} बाकी हैं", "मैंने {n} को {a} उधार दिए"], owe_out: ["मुझे {n} को {a} देने हैं", "मैंने {n} से {a} उधार लिए"],
    watch: ["जब {p} {a} से सस्ता हो तो बताना", "अगर {p} {a} से नीचे आए तो बताओ"], ask: ["इस महीने मैंने कितना खर्च किया?", "इस हफ़्ते मेरा पैसा कहाँ गया?"], chat: ["जापान की राजधानी क्या है?", "समुद्र पर एक कविता लिखो", "टीके कैसे काम करते हैं समझाओ"], wrap: ["", "प्लीज़ ", "सुनो, "] },
  ur: { it: ["دوپہر کا کھانا", "ٹیکسی", "کافی", "سودا", "پیٹرول", "دوا", "جم", "بال کٹوانا"], tk: ["سارہ کو فون کرنا", "کرایہ دینا", "دوا لینا", "رپورٹ بھیجنا"], pr: ["iPhone 16", "PS5", "AirPods Pro", "Kindle"],
    spend: ["{i} پر {a} خرچ کیے", "{i} کے لیے {a} دیے", "{i} میں {a} لگ گئے"], remind: ["کل {h} بجے مجھے یاد دلانا {t}", "کل {h} بجے کی یاد دہانی لگاؤ: {t}"], owe_in: ["{n} پر میرے {a} باقی ہیں", "میں نے {n} کو {a} ادھار دیے"], owe_out: ["مجھے {n} کو {a} دینے ہیں", "میں نے {n} سے {a} ادھار لیے"],
    watch: ["جب {p} {a} سے سستا ہو تو بتانا", "اگر {p} {a} سے نیچے آئے تو بتاؤ"], ask: ["اس مہینے میں نے کتنا خرچ کیا؟", "اس ہفتے میرا پیسہ کہاں گیا؟"], chat: ["جاپان کا دارالحکومت کیا ہے؟", "سمندر پر ایک نظم لکھو", "ویکسین کیسے کام کرتی ہے سمجھاؤ"], wrap: ["", "پلیز ", "سنو، "] },
  fa: { it: ["ناهار", "تاکسی", "قهوه", "خرید خانه", "بنزین", "دارو", "باشگاه", "آرایشگاه"], tk: ["به سارا زنگ بزنم", "اجاره را بدهم", "دارویم را بخورم", "گزارش را بفرستم"], pr: ["iPhone 16", "PS5", "AirPods Pro", "Kindle"],
    spend: ["{a} برای {i} خرج کردم", "{a} بابت {i} پرداختم", "{i} برایم {a} تمام شد"], remind: ["فردا ساعت {h} یادم بینداز {t}", "یک یادآور برای فردا ساعت {h} بگذار: {t}"], owe_in: ["{n} به من {a} بدهکار است", "به {n} {a} قرض دادم"], owe_out: ["به {n} {a} بدهکارم", "از {n} {a} قرض گرفتم"],
    watch: ["وقتی {p} زیر {a} شد خبرم کن", "اگر قیمت {p} کمتر از {a} شد بگو"], ask: ["این ماه چقدر خرج کردم؟", "این هفته پولم کجا رفت؟"], chat: ["پایتخت ژاپن کجاست؟", "یک شعر دربارهٔ دریا بنویس", "توضیح بده واکسن‌ها چطور کار می‌کنند"], wrap: ["", "لطفاً ", "ببین، "] },
  bn: { it: ["দুপুরের খাবার", "ট্যাক্সি", "কফি", "বাজার", "পেট্রল", "ওষুধ", "জিম", "চুল কাটা"], tk: ["সারাকে ফোন করতে", "ভাড়া দিতে", "ওষুধ খেতে", "রিপোর্ট পাঠাতে"], pr: ["iPhone 16", "PS5", "AirPods Pro", "Kindle"],
    spend: ["{i}-এ {a} খরচ করেছি", "{i}-এর জন্য {a} দিয়েছি", "{i}-এ {a} লেগেছে"], remind: ["কাল {h}টায় মনে করিয়ে দিও {t}", "কাল {h}টার জন্য রিমাইন্ডার দাও: {t}"], owe_in: ["{n} আমার কাছে {a} ধারে", "আমি {n}-কে {a} ধার দিয়েছি"], owe_out: ["আমি {n}-এর কাছে {a} ধারি", "আমি {n}-এর থেকে {a} ধার নিয়েছি"],
    watch: ["{p} যখন {a}-এর নিচে নামবে জানিও", "{p} যদি {a}-এর কম হয় বলো"], ask: ["এই মাসে কত খরচ করেছি?", "এই সপ্তাহে আমার টাকা কোথায় গেল?"], chat: ["জাপানের রাজধানী কী?", "সমুদ্র নিয়ে একটা কবিতা লেখো", "টিকা কীভাবে কাজ করে বুঝিয়ে বলো"], wrap: ["", "প্লিজ ", "শোনো, "] },
  sw: { it: ["chakula cha mchana", "teksi", "kahawa", "mboga", "mafuta", "dawa", "gym", "kunyoa"], tk: ["kumpigia Sara", "kulipa kodi", "kunywa dawa", "kutuma ripoti"], pr: ["iPhone 16", "PS5", "AirPods Pro", "Kindle"],
    spend: ["nimetumia {a} kwa {i}", "nimelipa {a} kwa {i}", "{i} imenigharimu {a}"], remind: ["nikumbushe kesho saa {h} {t}", "weka kikumbusho kesho saa {h}: {t}"], owe_in: ["namdai {n} {a}", "nimemkopesha {n} {a}"], owe_out: ["{n} ananidai {a}", "nimekopa {a} kwa {n}"],
    watch: ["niambie {p} ikishuka chini ya {a}", "nijulishe bei ya {p} ikiwa chini ya {a}"], ask: ["nimetumia kiasi gani mwezi huu?", "pesa zangu zimeenda wapi wiki hii?"], chat: ["mji mkuu wa Japani ni upi?", "andika shairi kuhusu bahari", "eleza jinsi chanjo zinavyofanya kazi"], wrap: ["", "tafadhali ", "sikia, "] },
  th: { it: ["ข้าวเที่ยง", "แท็กซี่", "กาแฟ", "ของใช้", "น้ำมัน", "ยา", "ยิม", "ตัดผม"], tk: ["โทรหาซาร่า", "จ่ายค่าเช่า", "กินยา", "ส่งรายงาน"], pr: ["iPhone 16", "PS5", "AirPods Pro", "Kindle"],
    spend: ["จ่ายค่า{i} {a}", "ใช้เงิน {a} กับ{i}", "{i} หมดไป {a}"], remind: ["เตือนฉันพรุ่งนี้ {h} โมงให้{t}", "ตั้งเตือนพรุ่งนี้ {h} โมง: {t}"], owe_in: ["{n} ติดเงินฉัน {a}", "ฉันให้ {n} ยืม {a}"], owe_out: ["ฉันติดเงิน {n} {a}", "ฉันยืมเงิน {n} มา {a}"],
    watch: ["บอกฉันเมื่อราคา {p} ต่ำกว่า {a}", "ถ้า {p} ลดเหลือต่ำกว่า {a} บอกด้วย"], ask: ["เดือนนี้ฉันใช้เงินไปเท่าไร?", "สัปดาห์นี้เงินฉันหายไปไหน?"], chat: ["เมืองหลวงของญี่ปุ่นคืออะไร?", "แต่งกลอนเกี่ยวกับทะเล", "อธิบายว่าวัคซีนทำงานอย่างไร"], wrap: ["", "ช่วย", "นี่ "] },
  vi: { it: ["bữa trưa", "taxi", "cà phê", "đi chợ", "xăng", "thuốc", "phòng gym", "cắt tóc"], tk: ["gọi cho Sara", "trả tiền nhà", "uống thuốc", "gửi báo cáo"], pr: ["iPhone 16", "PS5", "AirPods Pro", "Kindle"],
    spend: ["tôi đã tiêu {a} cho {i}", "trả {a} tiền {i}", "{i} hết {a}"], remind: ["nhắc tôi ngày mai lúc {h} giờ {t}", "đặt lời nhắc ngày mai lúc {h} giờ: {t}"], owe_in: ["{n} nợ tôi {a}", "tôi cho {n} mượn {a}"], owe_out: ["tôi nợ {n} {a}", "tôi mượn {n} {a}"],
    watch: ["báo tôi khi giá {p} dưới {a}", "nếu {p} giảm dưới {a} thì báo tôi"], ask: ["tháng này tôi đã tiêu bao nhiêu?", "tuần này tiền của tôi đi đâu?"], chat: ["thủ đô của Nhật Bản là gì?", "viết một bài thơ về biển", "giải thích vắc xin hoạt động thế nào"], wrap: ["", "làm ơn ", "này, "] },
  zh: { it: ["午饭", "打车", "咖啡", "买菜", "加油", "买药", "健身房", "理发"], tk: ["给萨拉打电话", "交房租", "吃药", "发报告"], pr: ["iPhone 16", "PS5", "AirPods Pro", "Kindle"],
    spend: ["{i}花了{a}", "付了{a}买{i}", "{i}用了{a}块"], remind: ["明天{h}点提醒我{t}", "设个提醒，明天{h}点：{t}"], owe_in: ["{n}欠我{a}", "我借给{n}{a}"], owe_out: ["我欠{n}{a}", "我向{n}借了{a}"],
    watch: ["{p}降到{a}以下告诉我", "如果{p}低于{a}就通知我"], ask: ["这个月我花了多少钱？", "这周我的钱都花哪儿了？"], chat: ["日本的首都是哪里？", "写一首关于大海的诗", "解释一下疫苗是怎么起作用的"], wrap: ["", "请", "喂，"] },
  ja: { it: ["ランチ", "タクシー", "コーヒー", "買い物", "ガソリン", "薬", "ジム", "散髪"], tk: ["サラに電話する", "家賃を払う", "薬を飲む", "レポートを送る"], pr: ["iPhone 16", "PS5", "AirPods Pro", "Kindle"],
    spend: ["{i}に{a}円使った", "{i}代{a}円払った", "{i}で{a}円かかった"], remind: ["明日{h}時に{t}ことをリマインドして", "明日{h}時にリマインダー：{t}"], owe_in: ["{n}に{a}貸してる", "{n}が私に{a}借りてる"], owe_out: ["{n}に{a}借りてる", "{n}から{a}借りた"],
    watch: ["{p}が{a}を切ったら教えて", "{p}が{a}より安くなったら知らせて"], ask: ["今月いくら使った？", "今週お金は何に使った？"], chat: ["日本の首都はどこ？", "海についての詩を書いて", "ワクチンの仕組みを説明して"], wrap: ["", "お願い、", "ねえ、"] },
  ko: { it: ["점심", "택시", "커피", "장보기", "기름값", "약", "헬스", "미용실"], tk: ["사라에게 전화하기", "월세 내기", "약 먹기", "보고서 보내기"], pr: ["iPhone 16", "PS5", "AirPods Pro", "Kindle"],
    spend: ["{i}에 {a}원 썼어", "{i} 값으로 {a}원 냈어", "{i}에 {a}원 들었어"], remind: ["내일 {h}시에 {t} 알려 줘", "내일 {h}시로 알림 맞춰 줘: {t}"], owe_in: ["{n}가 나한테 {a} 빚졌어", "{n}에게 {a} 빌려줬어"], owe_out: ["{n}에게 {a} 빚졌어", "{n}한테 {a} 빌렸어"],
    watch: ["{p}가 {a} 아래로 떨어지면 알려 줘", "{p} 가격이 {a}보다 싸지면 알려 줘"], ask: ["이번 달에 얼마 썼어?", "이번 주에 돈 어디에 썼어?"], chat: ["일본의 수도는 어디야?", "바다에 대한 시를 써 줘", "백신이 어떻게 작동하는지 설명해 줘"], wrap: ["", "부탁해, ", "있잖아, "] },
  franco: { it: ["ghada", "taxi", "ahwa", "khodar", "banzeen", "dawa", "gym", "7ala2"], tk: ["akalem sara", "adfa3 el egar", "a5od el dawa", "ab3at el report"], pr: ["iphone 16", "ps5", "airpods", "kindle"],
    spend: ["sraft {a} 3ala el {i}", "dafa3t {a} fel {i}", "el {i} kalefny {a}"], remind: ["fakarny bokra el sa3a {h} {t}", "3ayez tazkeer bokra el sa3a {h} {t}"], owe_in: ["{n} 3aleh {a}", "salaft {n} {a}"], owe_out: ["3alaya l {n} {a}", "estalaft {a} men {n}"],
    watch: ["2oly lama el {p} yeb2a a2al men {a}", "nabehny law el {p} nezel ta7t {a}"], ask: ["sraft kam el shahr da?", "flosy ra7et fen el esbo3 da?"], chat: ["eh 3asmet el yaban?", "ektebly she3r 3an el ba7r", "eshra7ly el tat3eem byeshtaghal ezay"], wrap: ["", "law sama7t ", "ba2olak "] },
};
const NAMES0 = { en: ["Ahmed", "Sara", "John", "Maria"], ar: ["احمد", "سارة", "كريم", "منى"], arb: ["أحمد", "سارة", "كريم", "منى"], fr: ["Ahmed", "Sara", "Pierre", "Marie"], es: ["Ahmed", "Sara", "Pablo", "Lucía"], de: ["Ahmed", "Sara", "Jonas", "Anna"],
  pt: ["Ahmed", "Sara", "João", "Ana"], it: ["Ahmed", "Sara", "Luca", "Giulia"], tr: ["Ahmet", "Ayşe", "Mehmet", "Elif"], id: ["Budi", "Siti", "Andi", "Dewi"], ru: ["Иван", "Анна", "Олег", "Мария"], hi: ["राहुल", "प्रिया", "अमित", "नेहा"],
  ur: ["علی", "عائشہ", "حسن", "فاطمہ"], fa: ["علی", "مریم", "رضا", "سارا"], bn: ["রাহুল", "প্রিয়া", "আমিন", "নুসরাত"], sw: ["Juma", "Amina", "Baraka", "Neema"], th: ["สมชาย", "มาลี", "อนันต์", "นภา"], vi: ["Minh", "Lan", "Hùng", "Mai"],
  zh: ["小王", "小李", "张伟", "李娜"], ja: ["田中さん", "佐藤さん", "鈴木さん", "高橋さん"], ko: ["민수", "지영", "현우", "수진"], franco: ["ahmed", "sara", "karim", "mona"] };
const HO = process.env.HELDOUT ? await import("./langs-heldout.mjs") : null;   // the held-out phrasings (langs-heldout.mjs)
const L = HO ? HO.L : L0, NAMES = HO ? HO.NAMES : NAMES0;
if (HO) seed += 104729;
const KINDS = [["ask", 7.5, ["money-ask", "ask:money", "ask:owed-in", "ask:owed-out", "ask:life"], "money-ask"], ["chat", 7.5, null, null], ["watch", 15, ["agent"], "agent"], ["owe", 20, ["life", "confirm"], "life"], ["remind", 25, ["reminder"], "action"], ["spend", 25, ["money", "confirm"], "money-log"]];
const LANGS = Object.keys(L);
const seen = new Set(), rows = [];
const per0 = Math.floor(TOTAL / LANGS.length), extra = TOTAL - per0 * LANGS.length;   // exactly TOTAL in all
for (const [li, lg] of LANGS.entries()) { const D = L[lg], N = NAMES[lg], per = per0 + (li < extra ? 1 : 0); let carry = 0, madeLg = 0;
  for (const [ki, [kind, share, accept, label]] of KINDS.entries()) { const want = ki === KINDS.length - 1 ? per - madeLg : Math.round(per * share / 100) + carry; let made = 0, tries = 0;
    while (made < want) { if (tries++ > want * 400 + 20000) break;
      const a = pick(AMT), h = int(6, 11), n = pick(N), w = pick(D.wrap) + "";
      const dir = kind === "owe" ? (rnd() < 0.5 ? "in" : "out") : "";
      let s = kind === "spend" ? pick(D.spend) : kind === "remind" ? pick(D.remind) : kind === "owe" ? pick(dir === "in" ? D.owe_in : D.owe_out) : kind === "watch" ? pick(D.watch) : kind === "ask" ? pick(D.ask) : pick(D.chat);
      const val = kind === "watch" ? a * 100 : kind === "owe" ? a * 10 : a;
      s = w + s.replace("{a}", String(val)).replace("{i}", pick(D.it)).replace("{t}", pick(D.tk)).replace("{p}", pick(D.pr)).replace("{n}", n).replace("{h}", String(h));
      if (rnd() < 0.3) s += pick(["", "!", "?", " 🙏", "."]).replace("?", kind === "ask" || kind === "chat" ? "?" : "");
      if (rnd() < 0.25 && kind !== "chat" && kind !== "ask") s = s.replace(/(\d+)/, (m) => (rnd() < 0.5 ? m : Number(m).toLocaleString("en-US")));
      const key = lg + "|" + s; if (seen.has(key)) continue; seen.add(key); made++;
      let r; try { r = classify(s, { now: NOW, both: true }); } catch (e) { r = { k: "THROW" }; }
      const model = !!(r.unsure && label && (r.cands || []).includes(label));
      const ok = kind === "chat" ? !["money", "life", "reminder", "both", "deadline", "agent"].includes(r.k) : accept.includes(r.k) || model || (kind === "ask" && /^ask:/.test(r.k));
      // the details, when the code did it: who owes whom and how much (a debt the wrong way round is worse than none)
      let why = "";
      if (ok && kind === "owe" && r.k === "life") { const c = parseLife(asRead(s), { now: NOW });
        if (!c) why = "no commitment"; else if (c.dir !== dir) why = "direction " + c.dir + " ≠ " + dir; else if (Math.round(c.amount) !== val && Math.round(c.total || 0) !== val) why = "amount " + c.amount + " ≠ " + val; }
      if (ok && kind === "spend" && r.k === "money" && r.u && r.u.actions) { const it = (r.u.actions.find((x) => x.kind === "money") || { items: [] }).items[0];
        const v2 = /\bribu\b/.test(s) ? val * 1000 : val;   // "50 ribu" is 50,000 rupiah
        if (it && Math.round(it.amount) !== v2) why = "amount " + it.amount + " ≠ " + v2; }
      rows.push({ lg, kind, s, k: why ? r.k + " (" + why + ")" : r.k, ok: ok && !why, model: ok && !why && model && !accept.includes(r.k) }); }
    madeLg += made; carry = want - made; } }
if (rows.length !== TOTAL) throw new Error("made " + rows.length + " different sentences, not " + TOTAL);
const total = rows.length, bad = rows.filter((r) => !r.ok).length, toModel = rows.filter((r) => r.model).length;
let md = `# 1M part A3${HO ? " (HELD-OUT phrasings)" : ""} — ${total} sentences in 20 languages + Franco, ${total - bad} right (${(100 * (total - bad) / total).toFixed(2)}%), ${toModel} of them handed to the model with the right kind among its choices\n\n| language | sentences | wrong | by code | left to the model | right % |\n|---|---|---|---|---|---|\n`;
const byL = {}; for (const r of rows) { const b = (byL[r.lg] = byL[r.lg] || { n: 0, bad: 0, model: 0, ex: {} }); b.n++; if (r.model) b.model++; if (!r.ok) { b.bad++; const k = r.kind + " → " + r.k; (b.ex[k] = b.ex[k] || []).push(r.s); } }
for (const [lg, b] of Object.entries(byL).sort((x, y) => y[1].bad / y[1].n - x[1].bad / x[1].n)) md += `| ${lg} | ${b.n} | ${b.bad} | ${b.n - b.bad - b.model} | ${b.model} | ${(100 * (b.n - b.bad) / b.n).toFixed(2)} |\n`;
md += "\n## What went wrong\n"; for (const [lg, b] of Object.entries(byL)) if (b.bad) { md += `\n### ${lg}\n`; for (const [k, ex] of Object.entries(b.ex).sort((x, y) => y[1].length - x[1].length).slice(0, 8)) md += `- **${k}** × ${ex.length}: ${ex.slice(0, 4).map((x) => "«" + x + "»").join(" · ")}\n`; }
if (TOTAL === 100000 || (HO && TOTAL === 10000)) fs.writeFileSync(new URL("./A3-langs" + (HO ? "-heldout" : "") + (process.env.SEED_SHIFT ? "-s" + process.env.SEED_SHIFT : "") + ".md", import.meta.url), md);
if (process.env.LANGS_JSON) fs.writeFileSync(process.env.LANGS_JSON, JSON.stringify(rows));
console.log(md.split("\n## What")[0]);
