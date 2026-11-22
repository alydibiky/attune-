/* ---- v10.9 (Ali's P8 phone test, 22 Nov 2026: "I am actually disappointed … absolute bs"). The model on the phone was handed the
   wrong things, then trusted blindly. Each rule here fixes one way that went wrong, by code, for every question of its kind:
     1. listNumber — "8. What's the capital of Australia" (a numbered list he typed from): the "8." is the item number, not 8 pounds;
     2. ownProblem — "A jacket is 1,800 after a 25% discount. What was the price before?" was glued to the previous sum
        ("the price" looked like a follow-up) and answered with the previous total. A message with its own numbers is its own question;
     3. addOn — a message typed while the last answer was still being written is an add-on to it only when it reads like one
        ("and add the prices", «وكمان…»); a new question is answered as a new question;
     4. wrongQuestion — the answer uses the previous question's numbers and none of this one's → asked again without the earlier turns;
     5. packsFit — reference-pack passages go to the model only when they really answer the question (most of its words in one
        passage); otherwise nothing, so the model answers from what it knows instead of «لا تحتوي معرفتك على هذا»;
     6. noKnowledgeLine — "your Knowledge doesn't cover this" / «مفيش معلومات في بياناتك» lines are never shown as an answer;
     7. danger — how to make a bomb / poison someone / make drugs → a plain refusal, by code, before any model;
     8. fasting — eating or drinking while fasting: the settled ruling goes to the model, and an answer that says it's allowed is replaced;
     9. future — "who will win the next World Cup?" — nobody can know: the model is told so;
    10. adviceNotNews — «الجو حر جدا النهارده أعمل إيه؟» asks for tips, not for today's news: no web search (it found Facebook posts).
   Pure; tests: tests/unit/v1090askguard.test.mjs + tests/askguard/gen.mjs (10,000 composed, hardened cases). */
import { tr } from "./i18n.js";

const AR_D = "٠١٢٣٤٥٦٧٨٩", FA_D = "۰۱۲۳۴۵۶۷۸۹";
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => String(AR_D.indexOf(d))).replace(/[۰-۹]/g, (d) => String(FA_D.indexOf(d)));
const clean = (s) => latin(s).replace(/[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g, "").replace(/[ \t]+/g, " ");
// Arabic as people type it: any alef, ة or ه, ى or ي — the text and the patterns are folded the same way before they meet
const arFold = (x) => String(x).replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
const cleanA = (s) => arFold(clean(s));
const R = (re) => new RegExp(arFold(re.source), re.flags);

// ---- 1. "8. What's …" ------------------------------------------------------------------------------------------------------------------
/** A leading list number ("8.", "8)", "٨-", "#8", "Q8:") before a sentence → the sentence without it; otherwise the text unchanged. */
export function listNumber(text) {
  const t = String(text || "");
  const m = /^[\s\u200e\u200f\u061c]*(?:#|q\.?\s?|س\s?)?[0-9٠-٩۰-۹]{1,2}\s*(?:[.)\]:،,\-–—]|\s*-)\s*(?=\S)/i.exec(t);
  if (!m) return t;
  const rest = t.slice(m[0].length);
  // the rest must be words, not "8. 500 lunch" read the other way round, nor "1.5 kg" / "3.14" / "12:30"
  if (/^[0-9٠-٩۰-۹]/.test(rest)) return t;
  if (!/^\p{L}/u.test(rest) && !/^[«"“'(¿¡]/.test(rest)) return t;
  if ((rest.match(/\p{L}+/gu) || []).length < 2) return t;
  return rest;
}

// ---- 2. a problem with its own numbers ------------------------------------------------------------------------------------------------
const NUM = /\d[\d,.]*(?:\s?%)?/g;
const OPENER = /^\s*(?:and|but|what if|what about|how about|then|so|also|now|ok(?:ay)?|instead|plus|with|without|same|و|طب|طيب|ولو|بس|وكمان|كمان|وبدل|وبدون|وب|ومع|بدل|من غير|طيب لو|ولو كان|yes|no|لا|اه|أيوه)(?![\p{L}])/iu;
/** Does this message hold a whole sum of its own (two numbers or more, a full sentence, not "and with 5 cranes?")? */
export function ownProblem(text) {
  const t = clean(text).trim();
  const nums = (t.match(NUM) || []).filter((x) => /\d/.test(x));
  if (nums.length < 2) return false;
  if (OPENER.test(t)) return false;
  if (/\b(it|that|this|those|these|them|the same|the above|above|previous)\b|(?<![\p{L}])(ده|دي|دول|نفسه|نفس|اللي فوق|السابق)(?![\p{L}])/iu.test(t) && t.split(/\s+/).length < 9) return false;
  return t.split(/\s+/).length >= 6;
}

// ---- 3. typed while the answer was being written ----------------------------------------------------------------------------------------
const ADD = /^\s*(?:and|also|plus|but|actually|wait|no,?|i mean|make it|instead|add|include|without|with|shorter|longer|in (?:arabic|english)|more|less|same|use|change|fix|و|وكمان|كمان|بس|لا|قصدي|أقصد|اقصد|ضيف|زود|شيل|خليها|خليه|بدل|من غير|بالعربي|بالانجليزي|بالإنجليزي|اختصر|طوّل|طول|نفس|غير|غيّر)(?![\p{L}])/iu;
/** Is a message typed during the last answer an add-on to it (not a new question)? */
export function addOn(text) {
  const t = clean(text).trim();
  if (!t) return false;
  if (ADD.test(t)) return true;
  const w = t.split(/\s+/).length;
  // "who wrote Hamlet", «ايه عاصمة اليابان» are questions of their own, however short
  return w <= 3 && !/[?؟]/.test(t) && !/^\s*(?:who|what|where|when|why|how|which|is|are|can|do|does|مين|ايه|إيه|فين|امتى|إمتى|ليه|ازاي|إزاي|كام|هل|ما|من)(?![\p{L}])/iu.test(t);
}

// ---- 4. the answer is about the previous question ------------------------------------------------------------------------------------------
const numsOf = (s) => new Set((clean(s).match(/\d[\d,]*(?:\.\d+)?/g) || []).map((x) => x.replace(/,/g, "")).filter((x) => x.length >= 2));
/** The answer has none of this question's numbers but at least two of the previous question's → it answered the wrong question. */
export function wrongQuestion(question, answer, prevQuestion) {
  if (!prevQuestion || !answer) return false;
  const q = numsOf(question), a = numsOf(answer), p = numsOf(prevQuestion);
  const qOnly = [...q].filter((x) => !p.has(x));
  if (qOnly.length < 1) return false;
  const usesQ = qOnly.some((x) => a.has(x));
  const usesP = [...p].filter((x) => !q.has(x) && a.has(x)).length;
  return !usesQ && usesP >= 2;
}

// ---- 5. pack passages only when they answer ----------------------------------------------------------------------------------------
const STOP = new Set("the a an of to in on at for is are was were be by and or with what who whom which when where why how do does did can could should would will shall this that these those it its from about as me my i you your we our they their he she his her there here than then into over under also just very much many some any all no not yes please tell give show".split(" ")
  .concat("في من على عن الى إلى الي مع هو هي ده دي دا اللي التي الذي ما ماذا مين من كام كم ازاي إزاي ايه إيه هل لو أو او و يا انا أنا انت إنت عايز عاوز ممكن قولي قوللي اشرحلي النهارده".split(" ")));
const foldW = (w) => String(w || "").toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة$/, "ه").replace(/^(وال|بال|كال|فال|لل|ال)(?=\p{L}{2})/u, "");
const keyWords = (s) => [...new Set((clean(s).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((w) => w.length > 2 && !STOP.has(w)).map(foldW))];
/**
 * Keep the passages only when one of them holds most of the question's meaningful words (≥ 70 %, at least 2) — or the question is a
 * task to solve (the subject packs are its method). → the passages to use, or [] (then the model answers from what it knows).
 */
export function packsFit(hits, question, { solve = false } = {}) {
  if (!hits || !hits.length) return [];
  if (solve) return hits;
  const qw = keyWords(question);
  if (qw.length < 2) return [];
  const fits = (h) => { const cw = new Set(keyWords(((h.chunk && h.chunk.title) || "") + " " + ((h.chunk && h.chunk.text) || ""))); let m = 0; for (const w of qw) if (cw.has(w)) m++; return m >= 2 && m / qw.length >= 0.7; };
  return hits.some(fits) ? hits.filter((h, i) => i === 0 || fits(h)) : [];
}

// ---- 6. "your knowledge doesn't cover this" is never an answer ------------------------------------------------------------------------------
const NOKNOW = /^\s*[*_>•\-\s]*(?:[0-9٠-٩]{1,2}[.)]\s*)?[*_\s]*(?:لا تحتوي معرفتك[^\n]*|لا تتضمن معرفتك[^\n]*|مفيش معلومات في (?:بياناتك|معرفتك|ملاحظاتك)[^\n]*|لا توجد معلومات في (?:بياناتك|معرفتك|ملاحظاتك|المصادر)[^\n]*|معرفتك لا تحتوي[^\n]*|your knowledge (?:doesn't|does not|don't) (?:cover|contain|include|have)[^\n]*|(?:the )?(?:provided )?(?:facts|passages|sources|notes) (?:don't|do not|doesn't|does not) (?:cover|contain|mention|include)[^\n]*|none of the (?:provided )?(?:facts|passages|sources)[^\n]*|there is no information (?:about this )?in your (?:knowledge|data|notes)[^\n]*)\s*$/gimu;
/** The answer without "your knowledge doesn't cover it" lines → { text, empty } (empty = nothing real was left: ask again without facts). */
export function noKnowledgeLine(answer) {
  const text = String(answer || "").replace(/[\u200e\u200f\u061c]/g, "").replace(/[ \t]{2,}/g, " ").replace(NOKNOW, "").replace(/\n{3,}/g, "\n\n").trim();
  // what is left once the polite filler is gone ("Hope this helps!", "---", "Sources: none", an emoji): nothing real → empty
  const real = text.split("\n").filter((l) => !/^\s*[*_>•\-#\d٠-٩.)\s]*(?:hope (?:this|that|it) helps!?|let me know[^\n]*|i hope[^\n]*|sources?:? ?none|_?sources?:? none_?|أتمنى[^\n]*|اتمنى[^\n]*|بالتوفيق[^\n]*|-{3,}|[\p{Extended_Pictographic}\s]*)[*_.!\s]*$/iu.test(l)).join("\n");
  // (only when such a line WAS there: "12 edges." on its own is a whole answer)
  const had = text !== String(answer || "").replace(/[\u200e\u200f\u061c]/g, "").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return { text, empty: had && real.replace(/[\s*_.•\-]/g, "").length < 12 };
}

// ---- 7. dangerous how-to ------------------------------------------------------------------------------------------------------------------
const HOWTO = R(/\b(how (?:do|can|could|would|to|should) (?:i |you |we |one )?(?:make|build|create|cook|brew|synthesi[sz]e|produce|assemble|prepare|mix)|make|build|making|building|recipe for|steps? (?:to|for)|instructions? (?:to|for)|guide to)\b|(?<![\p{L}])(?:ازاي|إزاي|كيف|كيفي[ةه]|طريق[ةه]|خطوات|ازاى)(?![\p{L}])|(?<![\p{L}])(?:أعمل|اعمل|نعمل|يعمل|اصنع|أصنع|نصنع|تصنيع|صناعة|اجهز|أجهز|احضر|أحضر|تحضير|اركب|أركب|تركيب)(?![\p{L}])|comment (?:faire|fabriquer)|cómo (?:hacer|fabricar)|wie (?:baue|mache|stelle)|как (?:сделать|изготовить)|nas[ıi]l (?:yap[ıi]l[ıi]r|yapar[ıi]m)|cara membuat|如何(?:制作|制造)|作り方|만드는 법/iu);
const HARM = R(/\b(bomb|bombs|explosive|explosives|ied|pipe ?bomb|molotov|grenade|detonator|napalm|tnt|ricin|sarin|nerve agent|anthrax|untraceable gun|ghost gun|poison (?:someone|somebody|a person|my (?:wife|husband|boss|neighbou?r|friend)|him|her|them)|kill (?:someone|somebody|a person)|(?:make|cook|brew|synthesi[sz]e|produce) (?:crystal )?meth(?:amphetamine)?)\b|(?<![\p{L}])(?:قنبل[هة]|قنابل|متفجر(?:ات|ه|ة)?|مولوتوف|ديناميت|عبو[هة] ناسف[هة]|حزام ناسف|اسمم|أسمم|تسميم (?:حد|شخص|انسان|إنسان)|(?:تصنيع|اصنع|أصنع|اعمل|أعمل|اطبخ|أطبخ)\s+(?:ال)?(?:مخدرات|شابو|آيس|ايس|كريستال ميث)|(?:اعمل|أعمل|اصنع|أصنع|تصنيع)\s+(?:مسدس|فرد خرطوش|سلاح))(?![\p{L}])|bombe|bomba|бомб|взрывчат|patlayıcı|बम|विस्फोटक|بم بنانے|炸弹|炸药|爆弾|爆薬|폭탄|폭발물|bom rakitan/iu);
const NOT_HARM = R(/\b(bath ?bombs?|seed ?bombs?|photo ?bomb|bomb calorimeter|cherry bomb|f-?bomb|da bomb|bomb(?:ed)? (?:the|my) (?:exam|test|interview)|bombastic|bombay|meth(?:od|odology|yl|ane|anol)|ice ?cream|dry ice)\b|(?<![\p{L}])(?:قنبلة (?:استحمام|حمام|الموسم|سعرات)|بومب|آيس ?كريم|ايس ?كريم|ايس كوفي|آيس كوفي|سلاح ذو حدين|سلاحك)(?![\p{L}])/iu);
/** A request for a way to hurt people (bombs, poison, weapons, hard drugs) → true. Learning about them in the news is not. */
export function danger(text) {
  const t = cleanA(text);
  if (!HARM.test(t) || NOT_HARM.test(t)) return false;
  return HOWTO.test(t);
}
export const REFUSE_EN = "I can't help with that — it could hurt people. If someone is in danger, call your local emergency number.";
export const refusal = (ar) => (ar ? "مقدرش أساعد في ده — ممكن يأذي ناس. لو حد في خطر، كلّم رقم الطوارئ." : tr(REFUSE_EN));

// ---- 8. eating or drinking while fasting ---------------------------------------------------------------------------------------------------
const FAST = R(/\b(fasting|while (?:i'?m |i am )?fasting|during (?:the )?fast|in ramadan|ramadan)\b|(?<![\p{L}])(?:صايم|صايم[هة]|صائم|صائم[هة]|صيام|الصيام|الصوم|صوم|وانا صايم|وأنا صايم|في رمضان|نهار رمضان)(?![\p{L}])/iu);
const INTAKE = R(/\b(drink|drinking|drank|eat|eating|ate|eaten|have|having|coffee|tea|water|juice|smoke|smoking|cigarettes?|vape|gum|food|snack|soda|milk|dates|fruit)\b|(?<![\p{L}])(?:اشرب|أشرب|ااشرب|نشرب|يشرب|شرب|شربت|ااكل|تمر|بلح|فاكه[هة]|اكل|آكل|ناكل|ياكل|أكل|كلت|اكلت|أكلت|قهو[هة]|شاي|ميه|مية|ماء|عصير|سجاير|سجائر|سيجار[هة]|ادخن|أدخن|تدخين|لبان|علك[هة]|اكلة|سناك|حاجة ساقعة|بيبسي|لبن)(?![\p{L}])/iu);
const AFTER = R(/\b(after iftar|after sunset|at suhoor|before dawn|at night|between iftar)\b|(?<![\p{L}])(?:بعد الفطار|بعد الإفطار|بعد الافطار|بعد المغرب|في السحور|وقت السحور|بالليل|قبل الفجر)(?![\p{L}])/iu);
const FORGOT = R(/\b(forgot|forgetting|by mistake|accidentally|unintentionally)\b|(?<![\p{L}])(?:ناسي|ناسيا|نسيت|ناسيًا|بالغلط|سهوا|سهوًا)(?![\p{L}])/iu);
/** "Can I drink coffee while fasting in Ramadan?" → "intake" ("…by mistake" → "forgot"; "after iftar" → null: that's allowed). */
export function fastingAsk(text) {
  const t = cleanA(text);
  if (!FAST.test(t) || !INTAKE.test(t)) return null;
  if (AFTER.test(t)) return null;
  return FORGOT.test(t) ? "forgot" : "intake";
}
/** The settled ruling, given to the model with the question (English — it answers in the question's language). */
export const FAST_FACT = "\n\n(Settled ruling, agreed by all four schools: eating or drinking anything ON PURPOSE during the fasting day — coffee, tea, water, juice, food, smoking — breaks the fast. It is allowed from iftar (sunset) until suhoor ends (dawn). Eating or drinking by honest forgetting does not break it. Say this plainly first; mention that the sick, travellers and pregnant or nursing women may be excused.)";
const SAYS_OK = R(/^\s*[*_]*\s*(?:نعم|أيوه|ايوه|اه|آه|yes|sure|of course|it is allowed|it's allowed|you can)\b|(?<![\p{L}])(?:لا تكسر الصيام|لا تكسر الصوم|لا تفطر|لا يفطر|مش بتفطر|مش بيفطر|ما بتفطرش|ما بيفطرش|جائز(?:ة)? (?:أثناء|في نهار|وانت صايم|وأنت صائم)|يجوز شرب|شرب القهو[هة] في رمضان جائز)(?![\p{L}])|\b(does(?:n't| not) break (?:the|your) fast|won't break (?:the|your) fast|is allowed while fasting|you can drink (?:it|coffee|tea|water) while fasting)\b/iu);
/** A fasting answer that says drinking on purpose is fine → true (it is then replaced by the ruling). */
export function fastingWrong(kind, answer) {
  if (kind !== "intake") return false;
  return SAYS_OK.test(cleanA(String(answer || "").slice(0, 600)));
}
export const FAST_EN = "No — eating or drinking anything on purpose while fasting (coffee, tea, water, juice, or smoking) breaks the fast; all four schools agree. It's fine from iftar until suhoor. If you drank by honest forgetting, your fast still counts. The sick, travellers and pregnant or nursing women may be excused — for your own case, ask a scholar you trust.";
export const fastingAnswer = (ar) => (ar ? "لا — أي أكل أو شرب بقصد وإنت صايم (قهوة، شاي، مية، عصير، أو سجاير) بيفطّر، والمذاهب الأربعة متفقين على كده. تقدر تشربها من الفطار لحد السحور. ولو شربت ناسي، صيامك صحيح. والمريض والمسافر والحامل والمرضع ليهم رخصة — ولحالتك الخاصة اسأل عالم تثق فيه." : tr(FAST_EN));

// ---- 9. the future ------------------------------------------------------------------------------------------------------------------------------
const FUTURE = R(/\b(who(?:'s| is)? (?:will|going to|gonna) win|will (?:\w+ ){0,3}win|who wins the next|next (?:world cup|election|champions league|olympics|afcon)|predict(?:ion)? (?:the|who)|will (?:the )?(?:price|dollar|gold|stock|market|bitcoin) (?:go|rise|fall|drop|crash)|what will happen)\b|(?<![\p{L}])(?:مين هيكسب|مين اللي هيكسب|هيكسب|هتكسب|هيفوز|سيفوز|من سيفوز|الجاي[هة]?|القادم[هة]?|توقع(?:ك|اتك)?|الدولار هيعلى|الدهب هيعلى|الذهب هيعلى|هينزل|هيطلع)(?![\p{L}])/iu);
const FUT_EVENT = R(/\b(win|world cup|election|league|cup|match|price|dollar|gold|stock|bitcoin|market|happen)\b|(?<![\p{L}])(?:كاس|كأس|الدوري|ماتش|مباراة|انتخابات|الدولار|الدهب|الذهب|البورصة|سعر|البطولة|يكسب|هيكسب|يفوز)(?![\p{L}])/iu);
/** "Who will win the next World Cup?" → true: nobody can know; the model is told so. */
export const future = (text) => { const t = cleanA(text); return FUTURE.test(t) && FUT_EVENT.test(t); };
export const FUTURE_NOTE = "\n\n(This asks about the future, which nobody can know. Say that plainly in the first line. Then you may name the usual favourites and why, clearly marked as a guess — never state a winner, a price or a result as fact.)";

// ---- 10. advice, not today's news -------------------------------------------------------------------------------------------------------------
const ADVICE = R(/\b(what (?:should|can|do) i do|what to do|tips|advice|how (?:do|can|should) i (?:cope|stay|deal|keep|handle|survive|feel)|how to (?:cope|stay|deal|keep cool|handle))\b|(?<![\p{L}])(?:اعمل ايه|أعمل ايه|اعمل إيه|أعمل إيه|نعمل ايه|نعمل إيه|نصايح|نصيحة|نصيحه|انصحني|ازاي اتعامل|إزاي أتعامل|ازاي استحمل|ازاي أستحمل|ازاي اتصرف|أتصرف ازاي|اتصرف ازاي)(?![\p{L}])/iu);
const NEWSY = R(/\b(price|prices|cost|rate|news|score|result|forecast|temperature|degrees?|how hot|will it rain|open now|schedule)\b|(?<![\p{L}])(?:سعر|أسعار|اسعار|بكام|أخبار|اخبار|نتيجة|درجة الحرارة|درجه الحراره|كام درجة|كام درجه|هتمطر|مواعيد)(?![\p{L}])/iu);
/** «الجو حر جدا النهارده أعمل إيه؟» — a request for tips, which a web search can't answer better than the model → true. */
export const adviceNotNews = (text) => { const t = cleanA(text); return ADVICE.test(t) && !NEWSY.test(t); };

// ---- who a money question is about ----------------------------------------------------------------------------------------------------
const NOT_A_NAME = new Set("the my a an this that last next every each me him her them us it food rent bills shopping groceries transport uber coffee school car gym fuel petrol month week year day today".split(" ")
  .concat("الشهر الاسبوع الأسبوع السنة السنه النهارده امبارح البيت الاكل الأكل الايجار الإيجار الفواتير المدرسة المدرسه العربية العربيه البنزين الجيم النادي الدكتور كل ده دي".split(" ")));
/** "how much did I pay Ahmed this month?", «دفعت كام لأحمد الشهر ده؟» → "Ahmed" / «أحمد» (or ""). */
export function payee(text) {
  const t = clean(text);
  let m = /(?<![\p{L}])(?:دفعت|صرفت|اديت|إديت|ادّيت|حولت|حوّلت|بعت|سلفت|سلّفت)\s+(?:كام|قد ايه|قد إيه|اد ايه|اد إيه)?\s*(?:لـ\s*|ل(?!ل)(?=\p{L}{2}))(\p{L}{2,})/u.exec(t)
    || /(?<![\p{L}])كام\s+(?:لـ\s*|ل(?!ل)(?=\p{L}{2}))(\p{L}{2,})/u.exec(t)
    || /\b(?:pay|paid|give|gave|given|send|sent|transfer(?:red)?|lend|lent)\s+(?:to\s+)?([A-Za-z][a-z'-]{1,20})\b/i.exec(t)
    || /\b(?:paid|gave|given|sent|transferred|lent|spent)\b[^?.!]{0,30}?\b(?:to|on)\s+([A-Z][a-z'-]{1,20})\b/.exec(t);
  if (!m) return "";
  const w = m[1];
  if (/^(?:ال|لل)/.test(w) || NOT_A_NAME.has(w.toLowerCase()) || NOT_A_NAME.has(w)) return "";
  return w;
}

// ---- 11. how many minutes in a week (the real phone model said 1,008) ------------------------------------------------------------------
const U = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2629746, year: 31536000 };
const UW = [["second", /^(?:seconds?|secs?|ثواني|ثانية|ثانيه|ثانيا)$/i], ["minute", /^(?:minutes?|mins?|دقايق|دقائق|دقيقة|دقيقه)$/i], ["hour", /^(?:hours?|hrs?|ساعات|ساعة|ساعه)$/i],
  ["day", /^(?:days?|ايام|أيام|يوم)$/i], ["week", /^(?:weeks?|اسابيع|أسابيع|اسبوع|أسبوع)$/i], ["month", /^(?:months?|شهور|أشهر|شهر)$/i], ["year", /^(?:years?|سنين|سنوات|سنة|سنه|عام)$/i]];
const unitOf = (w) => { const x = String(w || "").replace(/^ال/, ""); const f = UW.find(([, re]) => re.test(x)); return f ? f[0] : null; };
/** "how many minutes are in a week?", «كام دقيقة في الأسبوع؟» → the note with the number worked out here (or ""). */
export function unitNote(text) {
  const t = cleanA(text);
  const m = /\bhow many (\w+) (?:are )?(?:there )?in (?:a |an |one |1 )?(\w+)/i.exec(t) || /(?<![\p{L}])كام (\p{L}+) (?:في|فى|ف) (?:ال)?(\p{L}+)/u.exec(t);
  if (!m) return "";
  const a = unitOf(m[1]), b = unitOf(m[2]);
  if (!a || !b || U[b] <= U[a]) return "";
  const n = U[b] / U[a], v = Number.isInteger(n) ? n.toLocaleString("en-US") : (Math.round(n * 100) / 100).toLocaleString("en-US");
  return `\n\n(Worked out by the phone: 1 ${b} = ${v} ${a}s${b === "month" ? " on average" : b === "year" ? " (a leap year has one day more)" : ""}. Give exactly this number.)`;
}

// ---- 12. when Ramadan / Eid starts (the real phone model said "around March 2027"; it is about 8 Feb) ------------------------------------
const HIJRI = [["Ramadan", 9, 1, R(/ramadan|رمضان/i)], ["Eid al-Fitr", 10, 1, R(/eid al[- ]?fitr|عيد الفطر|العيد الصغير/i)], ["Eid al-Adha", 12, 10, R(/eid al[- ]?adha|عيد الأضحى|العيد الكبير/i)]];
function hijriParts(d) {
  try { const p = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric", year: "numeric" }).formatToParts(d);
    const g = (k) => +((p.find((x) => x.type === k) || {}).value || 0); return { d: g("day"), m: g("month") }; } catch (e) { return null; }
}
/** "When is Ramadan 2027?", «رمضان الجاي امتى؟» → the expected date, worked out from the Umm al-Qura calendar (or ""). */
export function hijriNote(text, now = Date.now()) {
  const t = cleanA(text);
  if (!/\b(when|start|begin|date|what day)\b|امتي|امتى|إمتى|هيبدا|يبدا|بيبدا|اول يوم|أول يوم|ميعاد|موعد|تاريخ/i.test(t)) return "";
  const ev = HIJRI.find(([, , , re]) => re.test(t)); if (!ev) return "";
  const y = +((t.match(/\b(20[2-4]\d)\b/) || [])[1] || 0);
  const from = y ? new Date(y, 0, 1) : new Date(now), to = y ? new Date(y, 11, 31) : new Date(now + 400 * 864e5);
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const h = hijriParts(d); if (!h) return "";
    if (h.m === ev[1] && h.d === ev[2]) {
      const iso = d.toISOString().slice(0, 10);
      return `\n\n(Worked out by the phone from the Umm al-Qura calendar: ${ev[0]} ${y || ""} is expected to start on ${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} (${iso}); the exact day depends on the moon sighting and may differ by one day. Give this date.)`.replace("  ", " ");
    }
  }
  return "";
}
