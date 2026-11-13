/* ---- v9.0 (Ali, 2 Nov 2026 picked option B: "the app is programmed to understand like that — I want it as smart as you … do it
   for all languages"). Chat and Home used to hand a sentence to the FIRST code reader that matched a word: «Remind me on the last
   day of each month to pay interest for mom» had "me" + "pay", so the spending reader answered it with this month's expenses.
   Now there is a referee in front of the readers:
     1. every reader says whether the sentence looks like ITS kind (cheap, code) — plus the words of each kind in all 20 languages
        below, so a Spanish, Hindi or Japanese sentence is seen too;
     2. one kind → that reader answers at once, as before (fast);
     3. two or more kinds → the phone's model reads the sentence and picks one (a few tokens, a few seconds at most); without a
        model, or if it doesn't answer in time, a fixed order where doing (a reminder, logging a payment) wins over looking things up;
     4. the pick is remembered for sentences of the same shape, so the next one is instant.
   Pure; tests: tests/unit/v903understand.test.mjs (a bank of real sentences in every language — each must land where it belongs). */

/** The kinds a sentence can be, with what each means (shown to the model). */
export const KINDS = {
  action: "set something on the phone: a reminder, an alarm, a timer, a calendar event, a call or a message to someone",
  "money-log": "record a payment or income that just happened (e.g. 'paid 200 for lunch')",
  "money-ask": "a question about the person's own past spending or income (e.g. 'how much did I spend this month?')",
  agent: "an agent: watch a price, buy something after asking, track a delivery, order the usual",
  research: "gather information on a topic from several web sources and write a report",
  deadline: "a date to keep track of: a bill due, a renewal, an expiry, an exam",
  life: "a plan with a person or money over time: a debt, an instalment, a regular payment, a gam'eya",
  calc: "a calculation to work out",
  unsure: "it could really be either of the other labels — the person should choose",
  "food-log": "record food or drink the person just had (e.g. 'koshary for lunch', '2 eggs and toast')",
  chat: "anything else: a question to answer or a conversation",
};
/** When no model can decide: doing beats looking up. */
export const ORDER = ["action", "money-log", "agent", "deadline", "life", "research", "money-ask", "calc", "chat"];

const W = (...xs) => new RegExp(xs.join("|"), "iu");
// The words of each kind, in Attune's 20 languages (en, Egyptian + Fusha Arabic, es fr de pt it ru tr id hi ur fa bn sw th vi zh ja ko)
export const LEX = {
  action: W(
    "\\bremind(?:er)?\\b", "\\bset an? (?:alarm|timer)\\b", "\\balarm\\b", "\\bwake me\\b", "don'?t let me forget", "\\btimer\\b",
    "فكرني", "فكّرني", "ذكرني", "ذكّرني", "نبهني", "نبّهني", "صحيني", "صحّيني", "منبه", "تذكير", "متنسانيش", "لا تدعني أنسى", "ذكّرني",
    "recuérdame", "recordatorio", "alarma", "despiértame", "no me dejes olvidar", "temporizador",
    "rappelle[- ]moi", "\\brappel\\b", "alarme", "réveille[- ]moi", "minuteur",
    "erinnere mich", "erinnerung", "wecker", "weck mich",
    "lembre[- ]me", "me lembre", "lembra[- ]me", "me lembra", "lembrete", "me acorde", "desperta[- ]me",
    "ricordami", "promemoria", "sveglia", "svegliami",
    "напомни", "напоминание", "будильник", "разбуди", "таймер",
    "hatırlat", "uyandır", "alarm kur", "zamanlayıcı",
    "ingatkan", "pengingat", "bangunkan",
    "याद दिला", "रिमाइंडर", "अलार्म", "मुझे जगा",
    "یاد دلا", "یاد دہانی", "الارم", "مجھے جگا",
    "یادم بنداز", "یادآوری کن", "یادآور", "بیدارم کن", "زنگ هشدار",
    "মনে করিয়ে", "রিমাইন্ডার", "অ্যালার্ম", "জাগিয়ে",
    "nikumbushe", "kikumbusho", "niamshe",
    "เตือนฉัน", "ตั้งปลุก", "ปลุกฉัน",
    "nhắc tôi", "nhắc nhở", "báo thức", "đánh thức",
    "提醒我", "提醒", "闹钟", "叫醒我", "定时器",
    "リマインド", "思い出させて", "アラーム", "起こして", "タイマー",
    "리마인드", "리마인더", "상기시켜", "알람", "깨워", "타이머", "잊지 않게"),
  "money-ask": W(
    "how much (?:did|have) i (?:spen[dt]|paid|pay|earn|ma[dk]e)", "what did i spend", "\\bmy (?:expenses|spending|outgoings)\\b", "where did my money go",
    "صرفت كام", "مصاريفي", "مصروفاتي", "فلوسي راحت فين", "كم أنفقت", "كم صرفت", "نفقاتي",
    "cu[aá]nto (?:he )?gast", "mis gastos", "en qu[eé] gast",
    "combien (?:j'ai|ai-je) dépensé", "mes dépenses",
    "wie ?viel habe ich .{0,30}ausgegeben", "meine ausgaben", "wofür habe ich",
    "quanto (?:eu )?gastei", "meus gastos", "minhas despesas",
    "quanto ho speso", "le mie spese",
    "сколько я потратил", "мои расходы", "на что я потратил",
    "ne kadar harcadım", "harcamalarım",
    "berapa (?:yang )?(?:saya )?(?:habiskan|keluarkan)", "pengeluaran saya",
    "मैंने कितना खर्च", "मेरे खर्च",
    "میں نے کتنا خرچ", "میرے اخراجات",
    "چقدر خرج کردم", "هزینه‌?های? ?من", "خرج‌?هایم",
    "আমি কত খরচ", "আমার খরচ",
    "nimetumia (?:pesa )?kiasi gani", "matumizi yangu",
    "ใช้เงินไปเท่า(?:ไหร่|ไร)", "ค่าใช้จ่ายของฉัน",
    "tôi đã tiêu bao nhiêu", "chi tiêu của tôi",
    "我花了多少", "我的开销", "我的支出",
    "いくら使った", "私の支出", "出費",
    "얼마나 썼", "얼마 썼", "내 지출"),
  research: W(
    "\\b(?:gather|collect|compile) (?:me )?(?:all )?(?:the )?(?:info(?:rmation)?|details|facts)\\b", "\\bdeep research\\b", "\\bresearch (?:about|on)\\b", "^research\\b", "tell me everything about", "give me a report (?:on|about)",
    "جمعلي معلومات", "جمّعلي معلومات", "اجمعلي معلومات", "اعملي بحث", "بحث عميق", "ابحث بعمق", "عايز معلومات عن", "اجمع لي معلومات", "بحث معمّق",
    "investiga", "investigación (?:sobre|a fondo)", "re[uú]ne información", "recopila información",
    "fais une recherche", "recherche approfondie", "rassemble des informations", "renseigne-toi sur",
    "recherchiere", "sammle informationen", "tiefenrecherche",
    "pesquise", "pesquisa (?:sobre|aprofundada)", "re[uú]na informações", "junte informações",
    "fai una ricerca", "ricerca approfondita", "raccogli informazioni",
    "исследуй", "собери информацию", "глубокое исследование",
    "araştır", "bilgi topla", "derin araştırma",
    "\\briset\\b", "kumpulkan informasi", "cari informasi tentang",
    "शोध करो", "जानकारी जुटा", "जानकारी इकट्ठा", "गहन शोध",
    "تحقیق کرو", "معلومات جمع کرو", "گہری تحقیق",
    "تحقیق کن", "اطلاعات جمع کن", "تحقیق عمیق",
    "গবেষণা কর", "তথ্য জোগাড়", "গভীর গবেষণা",
    "\\btafiti\\b", "kusanya taarifa", "utafiti wa kina",
    "ค้นคว้า", "รวบรวมข้อมูล",
    "nghiên cứu về", "thu thập thông tin", "nghiên cứu chuyên sâu",
    "研究一下", "收集.{0,12}(?:信息|资料)", "深度研究", "调研",
    "リサーチ", "情報を集めて", "詳しく調べて",
    "조사해", "리서치", "정보를 모아"),
  agent: W(
    "tell me when .{1,60}(?:under|below|cheaper|less than|drops?)", "\\bbuy me\\b", "\\bprice drops?\\b", "when my .{1,30} (?:order|package) arrives",
    "(?:قولي|نبهني) لما .{1,60}(?:اقل من|أقل من|ينزل|يرخص)", "اشتريلي", "لما طلب",
    "avísame cuando", "cómprame", "préviens[- ]moi quand", "achète[- ]moi", "sag mir,? wenn", "kauf mir", "me avise quando", "compre para mim", "avvisami quando", "comprami",
    "сообщи,? когда", "купи мне", "düşünce haber ver", "bana .{1,30} al\\b", "kabari saya (?:kalau|jika)", "belikan", "मेरे लिए खरीद", "जब .{1,40} सस्ता", "میرے لیے خرید",
    "خبرم کن وقتی", "برام بخر", "কিনে দাও", "ninunulie", "บอกฉันเมื่อราคา", "ซื้อให้", "báo tôi khi giá", "mua cho tôi", "降到.{0,20}告诉我", "帮我买", "下がったら教えて", "買って", "떨어지면 알려", "사줘"),
};

/** The kinds the words of a sentence point to (any of the 20 languages). */
export function lexSignals(text) {
  const t = String(text || ""), out = new Set();
  for (const [k, re] of Object.entries(LEX)) if (re.test(t)) out.add(k);
  return out;
}

/** The kinds this sentence could be: the readers' own yes/no (flags) + the words of every language. */
export function signalsOf(text, flags = {}) {
  const s = lexSignals(text);
  for (const [k, v] of Object.entries(flags || {})) if (v) s.add(k);
  // a reminder to pay is not a question about money spent; asking how much you spent is not logging it
  if (s.has("action") && s.has("money-ask") && !/\?\s*$/.test(String(text || "").trim())) s.delete("money-ask");
  // "remind me what we talked about?" asks to recall something — not a reminder
  if (/\bremind me (what|who|how|where|why|which|of what)\b|(فكرني|ذكرني) (ب?إيه|بايه|مين|ازاي|إزاي|فين|ليه)/i.test(String(text || "")) && /[?؟]\s*$/.test(String(text || "").trim())) s.delete("action");
  // a price wish for an agent ("tell me when X is under 40k", «نبهني لما … أقل من …») is not a payment, nor a reminder
  if (s.has("agent") && /\b(under|below|less than|cheaper|drops?)\b|أقل من|اقل من|تحت|ينزل|يرخص/i.test(String(text || ""))) { s.delete("money-log"); s.delete("action"); }
  // v9.9.32 (the 100,000 chat orders: «بعد اجتماع 5 ساعات … اشتريت شاحن ب290» became a reminder): something already paid or bought,
  // with no word asking for a reminder, is not an action ("5 hours" was how long the meeting took)
  if (s.has("action") && s.has("money-log") && /\b(?:paid|spent|bought|grabbed)\b|(?<![ء-ي])(?:دفعت|صرفت|اشتريت|جبت)(?![ء-ي])/i.test(String(text || "")) && !/\bremind|\balarm|\bwake me|فكرني|ذكرني|نبهني|صحيني|منبه/i.test(String(text || ""))) s.delete("action");
  // borrowing or lending is a plan with a person, not money spent
  if (s.has("life") && s.has("money-log") && /\b(borrow(ed)?|lent|lend|owes?|loan)\b|استلفت|سلفت|سلّفت|عليه|عليها|ليا عند|اقترضت|أقرضت/i.test(String(text || ""))) s.delete("money-log");
  // "15% of 2400" is a calculation, not a payment of 2,400
  if (s.has("calc") && s.has("money-log") && /[%٪]|\b(?:of|times|plus|minus)\b|من|في/.test(String(text || ""))) s.delete("money-log");
  return s;
}

const shape = (text) => String(text || "").toLowerCase().replace(/[\d٠-٩۰-۹]+([.,][\d٠-٩۰-۹]+)?/g, "#").replace(/\s+/g, " ").trim().slice(0, 160);
export const LEARN_KEY = "attune:understand:v1";
export function loadLearned(ls = typeof localStorage !== "undefined" ? localStorage : null) { try { return JSON.parse((ls && ls.getItem(LEARN_KEY)) || "{}") || {}; } catch (e) { return {}; } }
/** v9.1: what a sentence of this shape turned out to be before (the person's own pick or the model's), or null. */
export function learnedKind(text, ls = typeof localStorage !== "undefined" ? localStorage : null) { return loadLearned(ls)[shape(text)] || null; }
/** Remembers what a sentence of this shape turned out to be (the newest 300). */
export function learn(text, kind, ls = typeof localStorage !== "undefined" ? localStorage : null) {
  if (!KINDS[kind]) return;
  const m = loadLearned(ls), k = shape(text); delete m[k]; m[k] = kind;
  const keys = Object.keys(m); for (const x of keys.slice(0, Math.max(0, keys.length - 300))) delete m[x];
  try { ls && ls.setItem(LEARN_KEY, JSON.stringify(m)); } catch (e) {}
}

/** The referee's first look → { pick, unsure, candidates, fallback }. pick = the kind to use now; unsure = ask the model.
 *  flagged = the kinds a code reader said yes to. A kind seen only in the WORDS (no reader agrees — a Spanish sentence, or "what's
 *  the best alarm app?") is never forced by code: the model confirms it, or nothing changes. */
export function decide(signals, text = "", learned = null, flagged = null) {
  const c = ORDER.filter((k) => signals && signals.has && signals.has(k));
  const fl = flagged || signals || new Set();
  const known = learned ? learned[shape(text)] : null;
  if (known && (c.includes(known) || known === "chat")) return { pick: known, unsure: false, candidates: c, fallback: known, learned: true };
  if (!c.length) return { pick: null, unsure: false, candidates: c, fallback: null };
  if (c.length === 1 && fl.has(c[0])) return { pick: c[0], unsure: false, candidates: c, fallback: c[0] };
  return { pick: null, unsure: true, candidates: [...c, "chat"], fallback: c.find((k) => fl.has(k)) || null };
}

/** The question to the phone's model: which ONE of these is the sentence? (answer = the label only) */
export function judgeMessages(text, candidates) {
  const list = (candidates || []).filter((k) => KINDS[k]);
  return [
    { role: "system", content: "You route a message in a phone assistant app. The message may be in any language (also Egyptian Arabic or Arabic written in Latin letters). Pick the ONE label that says what the person wants done. Reply with the label only.\nLabels:\n" + list.map((k) => "- " + k + ": " + KINDS[k]).join("\n")
      + "\nRules: a question that asks for information is chat, even when it mentions reminders, money or buying (\"remind me what we said?\" → chat; \"what is the best phone under 15000?\" → chat). A short note of something paid or bought with its amount is money-log (\"lunch 150\", \"صرفت 300 بنزين\"). \"Tell me when X is under a price\" is agent." },
    { role: "user", content: "Message: " + String(text || "").slice(0, 500) + "\nLabel:" },
  ];
}
/** The model's reply → one of the candidates, or null. */
export function parseJudge(ans, candidates) {
  const a = String(ans || "").toLowerCase().replace(/[`*"'.\s]+/g, " ").trim();
  const list = (candidates || []).slice().sort((x, y) => y.length - x.length);
  return list.find((k) => new RegExp("(^|\\s)" + k.replace(/-/g, "[- ]?") + "(\\s|$)").test(a)) || null;
}

/** All of it: the readers' flags → the kind to use. ask(messages) → the model's reply (optional; given a few seconds). */
export async function referee(text, flags = {}, { ask = null, timeoutMs = 6000, ls } = {}) {
  const sig = signalsOf(text, flags), fl = new Set(Object.entries(flags || {}).filter(([k, v]) => v && sig.has(k)).map(([k]) => k));
  const d = decide(sig, text, loadLearned(ls), fl);
  if (!d.unsure) return { kind: d.pick, how: d.learned ? "learned" : "code", candidates: d.candidates };
  let kind = null;
  if (ask) {
    try { kind = parseJudge(await Promise.race([ask(judgeMessages(text, d.candidates)), new Promise((r) => setTimeout(() => r(""), timeoutMs))]), d.candidates); } catch (e) { kind = null; }
  }
  if (kind) { learn(text, kind, ls); return { kind, how: "model", candidates: d.candidates }; }
  return { kind: d.fallback, how: "order", candidates: d.candidates };
}

/* ---- v9.0 (Ali: "do the not done yet" — a research agent that keeps going): "keep me updated on solar panels every week",
   «تابعلي أخبار الطاقة الشمسية كل أسبوع», "Mantenme al día sobre los coches eléctricos cada semana" → { topic, every } in all 20
   languages. Each round is a fresh deep research in Chat ("what's new since …"), started by a notification on the day. */
const FOLLOW = W(
  "keep me (?:updated|posted|informed) (?:on|about|with)", "send me (?:the )?(?:news|updates?) (?:on|about)", "follow the news (?:on|about)", "what'?s new (?:on|about|with|in)", "track (?:the )?news (?:on|about)",
  "تابعلي", "تابع لي", "ابعتلي (?:جديد|اخبار|أخبار)", "عرفني (?:آخر |اخر )?(?:جديد|اخبار|أخبار)", "خليني متابع", "ابقني على اطلاع (?:على|ب)", "أطلعني على",
  "mantenme al (?:día|tanto) (?:sobre|de)", "avísame de (?:las )?novedades (?:de|sobre)", "tiens[- ]moi au courant (?:des|du|de la|de|sur)", "halte mich (?:auf dem laufenden )?(?:über|zu)", "me mantenha atualizado sobre",
  "mantenha-me informado sobre", "tienimi aggiornato su", "держи меня в курсе", "beni .{1,40} hakkında (?:güncel tut|bilgilendir)", "kabari (?:saya )?perkembangan", "ikuti berita",
  "के बारे में अपडेट देते रहना", "अपडेट देते रहना", "اپڈیٹ دیتے رہنا", "در جریان .{1,30} بگذار", "مرا در جریان بگذار", "আপডেট দিও", "nijulishe habari (?:za|kuhusu)",
  "อัปเดตให้ฉันเรื่อง", "cập nhật cho tôi về", "持续关注", "帮我关注", "最新情報を教えて", "追いかけて", "소식 알려줘", "업데이트 해줘");
const EVERY = [
  ["day", W("\\bevery ?day\\b", "\\bdaily\\b", "كل يوم", "يوميا", "يوميًا", "cada día", "a diario", "chaque jour", "tous les jours", "täglich", "jeden tag", "todo dia", "todos os dias", "diariamente", "ogni giorno",
    "каждый день", "ежедневно", "her gün", "setiap hari", "हर दिन", "रोज़", "روزانہ", "ہر روز", "هر روز", "প্রতিদিন", "kila siku", "ทุกวัน", "mỗi ngày", "hằng ngày", "每天", "毎日", "매일")],
  ["month", W("\\bevery month\\b", "\\bmonthly\\b", "كل شهر", "شهريا", "شهريًا", "cada mes", "mensual", "chaque mois", "tous les mois", "monatlich", "jeden monat", "todo mês", "mensalmente", "ogni mese",
    "каждый месяц", "ежемесячно", "her ay", "setiap bulan", "हर महीने", "ہر مہینے", "هر ماه", "প্রতি মাসে", "kila mwezi", "ทุกเดือน", "mỗi tháng", "hằng tháng", "每个月", "每月", "毎月", "매달", "매월")],
  ["week", W("\\bevery week\\b", "\\bweekly\\b", "كل (?:أسبوع|اسبوع)", "أسبوعيا", "اسبوعيا", "أسبوعيًا", "cada semana", "semanal", "chaque semaine", "toutes les semaines", "wöchentlich", "jede woche", "toda semana",
    "semanalmente", "ogni settimana", "каждую неделю", "еженедельно", "her hafta", "setiap minggu", "हर हफ्ते", "हर सप्ताह", "ہر ہفتے", "هر هفته", "প্রতি সপ্তাহে", "kila wiki", "ทุกสัปดาห์", "mỗi tuần", "hằng tuần", "每周", "每週", "毎週", "매주")],
];
/** → { topic, every: "day" | "week" | "month" } or null. A research request with a repeat counts too ("research X every week"). */
export function followOf(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  const ev = EVERY.find(([, re]) => re.test(t));
  const f = FOLLOW.exec(t) || (ev && /^\s*follow\b/i.exec(t)), r = LEX.research.exec(t);
  if (!f && !(r && ev)) return null;
  const every = ev ? ev[0] : "week";
  let topic = t.replace(f ? f[0] : r[0], " ");
  if (ev) topic = topic.replace(ev[1], " ");
  topic = topic.replace(/^(?:please|من فضلك|لو سمحت)\s+/i, "").replace(/\b(?:the news (?:on|about)|news (?:on|about)|about|on|for me|for)\b/gi, " ")
    .replace(/(?:^|\s)(?:أخبار|اخبار|جديد|عن|على|لي)(?=\s|$)/g, " ").replace(/[?.!،,:;]+/g, " ").replace(/\s+/g, " ").trim();
  return topic.length >= 2 ? { topic: topic.slice(0, 200), every } : null;
}

/* ---- v9.0 (the sentence bank: "fakarny bokra el sa3a 9 akalem mama" went to the AI): Franco (Arabic in Latin letters) → Arabic,
   word by word, so every reader that knows Egyptian Arabic understands it. The keyboard's own dictionary (franco-words.js)
   turned around, plus the command words people type to an assistant. Words it doesn't know (names, brands) stay as written. */
import { FROM_KEYBOARD } from "./franco-words.js";
const CMD = { fakarny: "فكرني", fakkarny: "فكرني", fakarni: "فكرني", fakkarni: "فكرني", fakkrni: "فكرني", nabehny: "نبهني", nabahny: "نبهني", nabbehny: "نبهني",
  sa7eeny: "صحيني", sa7iny: "صحيني", sa7eny: "صحيني", sa7ini: "صحيني", ab3atly: "ابعتلي", ab3atli: "ابعتلي", ab3at: "ابعت", akalem: "اكلم", a2alem: "اكلم", akallem: "اكلم", kallem: "كلم",
  edfa3: "ادفع", adfa3: "ادفع", dafa3t: "دفعت", dfa3t: "دفعت", saraft: "صرفت", sraft: "صرفت", eshtaret: "اشتريت", eshtarait: "اشتريت", ghada: "غدا", "8ada": "غدا", ghadaa: "غدا",
  fetar: "فطار", fe6ar: "فطار", fitar: "فطار", "3asha": "عشا", "3ashaa": "عشا", bokra: "بكرة", bukra: "بكرة", naharda: "النهارده", ennaharda: "النهارده", elnaharda: "النهارده",
  embare7: "امبارح", emberi7: "امبارح", sa3a: "ساعة", kol: "كل", youm: "يوم", yom: "يوم", shahr: "شهر", esbo3: "أسبوع", osbo3: "أسبوع", gom3a: "جمعة", gum3a: "جمعة",
  sabt: "سبت", "7ad": "حد", etnen: "اتنين", talat: "تلات", arba3: "أربع", khamees: "خميس", "5amis": "خميس", kam: "كام", kaam: "كام", "3ayez": "عايز", "3awez": "عاوز",
  eshtereely: "اشتريلي", eshtereli: "اشتريلي", eshteryly: "اشتريلي", dawarly: "دورلي", dawwarli: "دورلي", dawarli: "دورلي", "3ala": "على", fe: "في", fi: "في", men: "من",
  ma3: "مع", "3esh": "عيش", "3eish": "عيش", "3eesh": "عيش", "5odar": "خضار", "khodar": "خضار", "fak7a": "فاكهة", "fakha": "فاكهة", "mowaslat": "مواصلات", "benzeen": "بنزين", "banzeen": "بنزين",
  "kahraba": "كهربا", "gas": "غاز", "mayya": "مية", "aysh": "عيش", "laban": "لبن", "fera5": "فراخ", "ferakh": "فراخ", "la7ma": "لحمة", "ro2z": "رز", "roz": "رز", "koshary": "كشري", "koshari": "كشري",
  "3aleh": "عليه", "3aleih": "عليه", "3aleha": "عليها", "3alaya": "عليا", "3alayya": "عليا", "3alehom": "عليهم", leya: "ليا", liya: "ليا", sallaft: "سلفت", masareef: "مصاريف", masarif: "مصاريف", "2ad": "قد", "2a2al": "أقل", a2al: "أقل",
  ad: "قد", nos: "نص", ro3: "ربع", "ella": "إلا", sob7: "الصبح", "elsob7": "الصبح", bel: "بالليل", belel: "بالليل", "belleil": "بالليل", "2ol": "قول", "2oly": "قولي", "2olli": "قولي", oly: "قولي",
  lama: "لما", lamma: "لما", law: "لو", "yewsal": "يوصل", "yewsl": "يوصل", talab: "طلب", "talaby": "طلبي", "gamaeya": "جمعية", "gam3eya": "جمعية", "gam3ya": "جمعية", dayman: "دايما",
  // v9.9.18 (the hard run: "rakna 110 geneh", "dawa b 950 geneh", "el 7ala2 kan b 3200" went to the AI) — money words and everyday things
  geneh: "جنيه", gneh: "جنيه", geneih: "جنيه", genih: "جنيه", genieh: "جنيه", ginih: "جنيه", gnih: "جنيه", kan: "كان", kanet: "كانت", kalefny: "كلفني", kallefny: "كلفني", kalefni: "كلفني", kalefetny: "كلفتني",
  rakna: "ركنة", ragna: "ركنة", dawa: "دوا", hodoom: "هدوم", hodom: "هدوم", sabak: "سباك", "7ala2": "حلاق", hala2: "حلاق", hedeya: "هدية", hedeyya: "هدية", hdeya: "هدية", ahwa: "قهوة", "2ahwa": "قهوة",
  makwagy: "مكوجي", mekaneeky: "ميكانيكي", mekaniky: "ميكانيكي", saydaleya: "صيدلية", "3arabeya": "عربية", "3arabiya": "عربية", b: "ب", bi: "ب", lel: "على", "3al": "على",
  kaman: "كمان", kamaan: "كمان", kman: "كمان", "de2e2a": "دقيقة", "de2ee2a": "دقيقة", "d2e2a": "دقيقة", "da2aye2": "دقايق", "da2ayi2": "دقايق", "sa3ten": "ساعتين", "sa3teen": "ساعتين", "sa3tein": "ساعتين",
  enharda: "النهارده", "ba3d": "بعد", "b3d": "بعد", "ashrab": "اشرب", "eshrab": "اشرب", "atfy": "اطفي", "atfi": "اطفي", "forn": "فرن", "maya": "مية", "dohr": "الضهر", "el3asr": "العصر", "3asr": "العصر", "maghrib": "المغرب" };
let INV = null;
const inv = () => { if (INV) return INV; INV = {}; for (const [a, f] of Object.entries(FROM_KEYBOARD || {})) if (!INV[f]) INV[f] = a; return INV; };
/** "fakarny bokra el sa3a 9 akalem mama" → «فكرني بكرة الساعة 9 اكلم ماما». Only words it knows change. */
export function francoToArabic(text) {
  const map = inv(), toks = String(text || "").split(/(\s+)/);
  const word = (w) => { const k = w.toLowerCase(), p = /[.,!?؟]+$/.exec(k), k2 = p ? k.slice(0, p.index) : k; const r = CMD[k] || map[k] || (p ? CMD[k2] || map[k2] : null); return r && p && !(CMD[k] || map[k]) ? r + p[0] : r || null; };   // v9.9.18: "forn!" too
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i]; if (/^\s*$/.test(w)) { out.push(w); continue; }
    const lw = w.toLowerCase();
    // "bel leil" / "bel lel" → «بالليل» (one word, not «بالليل leil»)
    if ((lw === "bel" || lw === "bil") && toks[i + 2] && /^(leil|lail|lel|leyl)$/i.test(toks[i + 2].replace(/[.,!?]+$/, ""))) { out.push("بالليل"); i += 2; continue; }
    // "el sa3a" → «الساعة», "el2akl" → «الأكل»
    if ((lw === "el" || lw === "il") && toks[i + 2] && word(toks[i + 2])) { out.push("ال" + word(toks[i + 2]).replace(/^ال/, "")); i += 2; continue; }
    const m = /^(el|il)[-]?(.+)$/i.exec(w); if (m && word(m[2])) { out.push("ال" + word(m[2]).replace(/^ال/, "")); continue; }
    out.push(word(w) || w);
  }
  return out.join("");
}
/** Is it Franco worth reading as Arabic? (≥ 1 command word or ≥ 2 known words) */
const EN_WORDS = new Set("i i'm im me my you your we our he she it they the a an and or of to for in on at with from is are was were be been have has had do did does ate eat eating had drink drank can could will would should please this that these those what when where how why not no yes".split(" "));
export function looksFranco(text) {
  const ws = String(text || "").toLowerCase().split(/\s+/).filter(Boolean), map = inv();
  if (/[؀-ۿ]/.test(text)) return false;
  // v9.1 (e2e_v542: "I ate a plate of koshari and a can of cola" became «I ate a plate of كشري…», answered in Arabic): an English
  // sentence with one Egyptian word in it is English — more English everyday words than Franco ones, and it stays as typed
  const fr = ws.filter((w) => CMD[w] || map[w]).length, en = ws.filter((w) => EN_WORDS.has(w.replace(/[^a-z']/g, ""))).length;
  if (en >= 2 && en >= fr) return false;
  return ws.some((w) => CMD[w]) || ws.filter((w) => map[w]).length >= 2;
}
