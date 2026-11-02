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
  return s;
}

const shape = (text) => String(text || "").toLowerCase().replace(/[\d٠-٩۰-۹]+([.,][\d٠-٩۰-۹]+)?/g, "#").replace(/\s+/g, " ").trim().slice(0, 160);
export const LEARN_KEY = "attune:understand:v1";
export function loadLearned(ls = typeof localStorage !== "undefined" ? localStorage : null) { try { return JSON.parse((ls && ls.getItem(LEARN_KEY)) || "{}") || {}; } catch (e) { return {}; } }
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
    { role: "system", content: "You route a message in a phone assistant app. The message may be in any language. Pick the ONE label that says what the person wants done. Reply with the label only.\nLabels:\n" + list.map((k) => "- " + k + ": " + KINDS[k]).join("\n") },
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
