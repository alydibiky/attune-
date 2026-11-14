import { worldToEnglish } from "./worldlang.js";
/* ---- v9.9.32 (Ali, 13 Nov 2026: "try the code … with 100,000 scenarios and unique texts … in a very hard and unique way") -------------
   The 100,000-sentence run (tests/scenarios/mega.mjs) found that the readers were ~99% right on a plain sentence but only ~80% right
   when people typed it the way they really do: "hey attune, remind me tomorrow at 9 to call mama thanks", «يا أتيون، صرفت 150 على
   الغدا شكرا», "ok so lunch 150 🙏", "remind me at 5 to call Sara ok?". A wake word, a filler in front, or thanks / emoji / "ok?" after
   the order changed what the readers saw. cleanTyped() takes those off BEFORE the readers look; the meaning never changes. When the
   whole message IS the filler ("hi", "thanks", «شكرا») it is left as it is (small talk). Pure; tests in tests/unit/v9932wrap.test.mjs. */

// in front, always a filler when followed by a space or punctuation (longest first)
const LEAD_ALWAYS = [
  "hey attune", "hi attune", "hello attune", "ok attune", "okay attune", "ya attune", "dear attune", "attune",
  "ok so", "okay so", "so um", "um", "umm", "uh", "uhh", "erm", "yo", "btw", "by the way", "quick one", "quick question", "pls", "plz", "please",
  "يا أتيون", "يا اتيون", "يا آتيون", "يا attune", "أتيون", "اتيون", "بقولك ايه", "بقولك إيه", "بقولك", "اسمع", "اسمعني", "يا عم", "يا باشا", "يا معلم", "معلش", "لو سمحت", "طيب", "بص",
  "ya attune", "law sama7t", "baoolak", "ba2olak",
];
// in front, a filler only when punctuation follows ("hey, …", "listen: …", "so, …", "hi! …") — or a plain space for ok / so
const LEAD_PUNCT = ["hey", "hi", "hello", "listen", "look", "well", "so", "ok", "okay", "alright", "right", "good morning", "morning", "اهلا", "أهلا", "صباح الخير", "مساء الخير", "السلام عليكم"];
const LEAD_SPACE = ["ok", "okay", "so", "alright"];
// after the order
const TRAIL = [
  "thank you so much", "thank you", "thanks a lot", "thanks", "thank u", "thx", "ty", "pls", "plz", "please", "ok?", "okay?", "ok", "okay", "asap", "😊",
  "شكرا جزيلا", "شكرا", "شكراً", "ميرسي", "يا معلم", "يا باشا", "لو سمحت", "لو سمحتي", "من فضلك", "يا أتيون", "يا اتيون", "ya attune", "shokran", "merci",
];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const W = "(?![\\p{L}\\p{N}])";   // the word ends here (Arabic letters too)
const LEAD_RE = new RegExp("^(?:" + LEAD_ALWAYS.slice().sort((a, b) => b.length - a.length).map(esc).join("|") + ")" + W + "\\s*[,،:;!.\\-–—]*\\s*", "iu");
const PUNCT_RE = new RegExp("^(?:" + LEAD_PUNCT.slice().sort((a, b) => b.length - a.length).map(esc).join("|") + ")" + W + "\\s*[,،:;!.\\-–—]+\\s*", "iu");
const SPACE_RE = new RegExp("^(?:" + LEAD_SPACE.map(esc).join("|") + ")\\s+(?=\\S)", "iu");
const TRAIL_RE = new RegExp("[\\s,،]+(?:" + TRAIL.slice().sort((a, b) => b.length - a.length).map(esc).join("|") + ")" + "[\\s!.؟?]*$", "iu");
// emoji, "!!", "..." at the end (one "?" stays: it makes a question)
const TAIL_SYMBOLS = /(?:\s*(?:\p{Extended_Pictographic}|️|‍|[!¡]{2,}|\.{2,}|…))+\s*$/u;

/** The order without the wake word, fillers and thanks around it. Leaves a message that is ONLY such words as it is. */
export function cleanTyped(text) {
  const orig = String(text == null ? "" : text);
  // a pasted conversation, document or long message is read as it is (v9.9.32: a pasted "You said / ChatGPT said" was flattened)
  if (orig.length > 300 || /\n\s*\n/.test(orig) || orig.split("\n").length > 4) return orig.trim();
  let t = orig.replace(/[ \t]{2,}/g, " ").trim();
  for (let i = 0; i < 4; i++) {
    const before = t;
    t = t.replace(TAIL_SYMBOLS, "").trim();
    // one full stop at the end ("half of 850.", «الشاحن فين؟.») is not part of the order; "2.5" keeps its point
    t = t.replace(/(?<![.\d][.])\.\s*$/u, "").replace(/([?؟])[.!]+$/u, "$1").trim();
    const tr = t.replace(TRAIL_RE, "").trim();
    // "remind me at 5 ok?" → the "?" belonged to "ok", so it goes with it
    if (tr && tr !== t) t = tr;
    let lead = t.replace(LEAD_RE, "");
    if (lead === t) lead = t.replace(PUNCT_RE, "");
    if (lead === t && t.split(/\s+/).length >= 3) lead = t.replace(SPACE_RE, "");
    // "look at …", «بص على …»: the first word was a verb with its object, not a filler
    if (lead !== t && /^(?:على|عل|في|ل|to|at|on|for|into)(?![\p{L}\p{N}])/iu.test(lead)) lead = t;
    if (lead && lead !== t && lead.split(/\s+/).filter(Boolean).length >= 1 && /[\p{L}\p{N}]/u.test(lead)) t = lead.trim();
    if (t === before) break;
  }
  t = unshout(t);
  // nothing real left ("hi", "thanks 🙏", «يا أتيون») → the message as typed (it is small talk)
  if (!t || !/[\p{L}\p{N}]/u.test(t)) return orig.trim();
  // only a greeting / thanks left ("hey attune, thanks" → "hey attune") → the message as typed (small talk)
  const only = t.toLowerCase().replace(/[\s,،!.?؟]+/g, " ").trim();
  if (LEAD_ALWAYS.concat(LEAD_PUNCT, TRAIL).some((w) => w.toLowerCase() === only)) return orig.trim();
  return t;
}

// ALL CAPS ("TELL ME IF HASSAN TEXTS ME") → ordinary case, names kept capitalised: the readers find a person by the capital letter
const SMALL = new Set(("a an the i me my mine we us our you your he him his she her it its they them their this that these those to at on in of for from by with " +
  "about into over under after before up down out off and or but if when while because so then than as is am are was were be been being do does did done have has had " +
  "will would can could should may might must shall not no yes please tell remind call text message messages texts send sent pay paid spent spend buy bought get got " +
  "give gave take took owe owes owed lent lend borrowed borrow watch find show open set add put save note remember delete cancel change every each day days week weeks " +
  "month months year years today tomorrow tonight morning evening afternoon night noon midnight am pm minutes minute hours hour half quarter past next last this what " +
  "where who why how which much many money cost costs costing price for my all always comes first never stop notifications notify alert gets home calls lunch dinner " +
  "breakfast coffee taxi petrol groceries bill bills rent salary got wife husband brother sister mum mom dad mother father friend boss son daughter egp le pounds dollars " +
  "usd km kg on via whatsapp telegram sms email mail app it's i'm don't can't won't i'll let let's know").split(" "));
function unshout(t) {
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length < 4 || /[a-z]/.test(t) || letters !== letters.toUpperCase()) return t;
  let first = true;
  return t.toLowerCase().replace(/[a-z][a-z'’]*/g, (w) => { const keep = !SMALL.has(w) && !first && w.length > 1; first = false; return keep ? w[0].toUpperCase() + w.slice(1) : w; });
}

/* ---- v9.9.32 (the 100,000 chat orders): the ways people ask for a reminder indirectly → the words the readers know ------------------
   "ping me tomorrow at 9 to call mama" · "can you make sure I send the report on Saturday at 11 am" · "I keep forgetting to take my
   medicine, remind me at 9" · «خليك فاكرلي بكرة الساعة 9 اني اكلم ماما» → "remind me …" / «فكرني …». And a change of mind in the middle
   ("at 5, no wait, 6"; "200, sorry I mean 250"; «275 لا قصدي 600») keeps only the second number. */
const TIMEW = "(?:tomorrow|tonight|today|this (?:morning|evening|afternoon)|in (?:an?|\\d+|half)|at (?:\\d|quarter|half|noon|midnight|ten|five)|on |next |the day after|every )";
const REPHRASE = [
  // "ping me if the PS5 dips below 20000" is a price wish (an agent), not a reminder
  [/^(?:ping|nudge|buzz|alert|notify|poke) me (?:if|when|once|the moment|as soon as)\s+(.+?)\s+(?:dips|drops|falls|goes|gets|is)\s+(?:below|under|cheaper than|less than)\s+/i, "tell me when $1 goes under "],
  [new RegExp("^(?:ping|nudge|buzz|poke) me\\b(?=\\s+(?:" + TIMEW.slice(3, -1) + "|to\\b|so\\b|about\\b))", "i"), "remind me"],
  [/^remind me (.+?) so (?:that )?I\b/i, "remind me $1 to"],
  [/^give me a (?:shout|ring|heads[- ]up)\b/i, "remind me"],
  [/^jog my memory\b/i, "remind me"],
  [/^(?:would you mind|could you|can you|will you|please|be a dear and|make sure you|do me a favou?r and)\s+remind(?:ing)? me\b/i, "remind me"],
  [/^(?:i'?d (?:love|like) a|i (?:want|need) a|can i (?:get|have) a)\s+reminder\b/i, "remind me"],
  [new RegExp("^(?:alert|notify|tell) me\\s+(?=" + TIMEW + ")", "i"), "remind me "],
  [new RegExp("^set (?:an? )?(?:alarm|reminder)\\s+(?=" + TIMEW + ")", "i"), "remind me "],
  [/^if you could (remind me .+?)(?:,?\s*that would be (?:great|nice|amazing|perfect))?$/i, "$1"],
  [/^remind me,\s*(.+?),\s*to\s+/i, "remind me $1 to "],
];
function rephrase(t) {
  let s = t;
  for (const [re, to] of REPHRASE) s = s.replace(re, to);
  let m;
  // "can you make sure I call Sara tomorrow at 9" → "remind me to call Sara tomorrow at 9"
  if ((m = /^(?:can|could|would) you (?:make sure|ensure) (?:that )?i\s+(.+)$/i.exec(s))) s = "remind me to " + m[1];
  // "I keep forgetting to X, remind me W" / "I really need to X W, remind me please" / "W I have to X, remind me"
  if ((m = /^i (?:keep|always) forget(?:ting)? to (.+?),?\s+remind me\s*(.*)$/i.exec(s))) s = "remind me " + m[2] + " to " + m[1];
  if ((m = /^i (?:really )?(?:need|have) to (.+?),?\s+remind me(?: please)?$/i.exec(s))) s = "remind me to " + m[1];
  if ((m = /^(.+?)\s+i (?:have|need) to (.+?),?\s+remind me(?: please)?$/i.exec(s)) && new RegExp("^" + TIMEW, "i").test(m[1] + " ")) s = "remind me " + m[1] + " to " + m[2];
  // v9.9.38 (the 1M test): "what's my taxis total since the 1st?" · "my coffee total this month" · "what's my total on food this week?"
  if ((m = /^(?:what'?s|what is|show me|tell me)?\s*(?:my|the)\s+(?!grand\b|overall\b|monthly\b|net\b)([\p{L}][\p{L}\s'’-]{1,30}?)\s+(?:total|spending)(?!\s*(?:is|was|=|:)(?:\s|\d|$))\s*(.*)$/iu.exec(s)) && !/\b(?:income|salary|balance|savings?)\b/i.test(m[1])) s = "how much did I spend on " + m[1] + (m[2] ? " " + m[2] : "");
  else if ((m = /^(?:what'?s|what is|show me|tell me)\s+my\s+total\s+(?:on|for)\s+(.+)$/i.exec(s))) s = "how much did I spend on " + m[1];
  // "heads up tonight at 7: buy bread" / "reminder please: pay the bill, tomorrow at 9"
  if ((m = /^heads[- ]up\s+(.+?):(?!\d\d)\s*(.+)$/i.exec(s))) s = "remind me " + m[1] + " to " + m[2];   // (v9.9.38: "at 7:30 am" keeps its minutes)
  // v9.9.38 (the 1M test: "paid 150 for a haircut and don't let me forget to call the bank in 2 hours" kept only the money)
  s = s.replace(/^(?:please\s+)?(?:don'?t|do not) let me forget (?:to\s+)?/i, "remind me to ").replace(/([,;]\s*|\s+(?:and|also|plus|then)\s+)(?:please\s+)?(?:don'?t|do not) let me forget (?:to\s+)?/i, "$1remind me to ");
  if ((m = /^reminder(?: please)?:\s*(.+?),\s*(.+)$/i.exec(s)) && new RegExp("^" + TIMEW, "i").test(m[2] + " ")) s = "remind me " + m[2] + " to " + m[1];
  if ((m = /^remind me\s+(.+?)\s+so I\s+(.+)$/i.exec(s))) s = "remind me " + m[1] + " to " + m[2];
  // Egyptian Arabic
  s = s.replace(/^(?:لو ينفع|لو سمحت|يا ريت|ياريت|من فضلك)\s+(?:ت)?(فكرني|ذكرني|نبهني)/, "$1").replace(/^ابقى?\s+(فكرني|ذكرني|نبهني)/, "$1")
    .replace(/^(فكرني|ذكرني|نبهني)\s+(?:من فضلك|لو سمحت)\s+/, "$1 ").replace(/^(?:متنسانيش|ماتنسانيش|خليك فاكرلي|خليك فاكر|حطلي تذكير|عايز تذكير|عاوز تذكير|اعملي تذكير)\s+/, "فكرني ")
    .replace(/^نبهني\s+(.+?)\s+عشان\s+/, "نبهني $1 ");
  if ((m = /^انا (?:دايما|دايماً|على طول) بنسى\s+(.+?)[،,]\s*(?:فكرني|ذكرني)\s+(.+)$/.exec(s))) s = "فكرني " + m[2] + " " + m[1];
  if ((m = /^(.+?)\s+لازم\s+(.+?)\s+(?:فكرني|ذكرني)$/.exec(s))) s = "فكرني " + m[1] + " " + m[2];
  // "tell me when omar messages me" — a name typed in small letters is still a name (the message-alert reader looks for a capital)
  s = s.replace(/^((?:tell|let|notify|alert|ping) me (?:know )?(?:when|if|once)\s+)([a-z][a-z'-]{1,20})(\s+(?:messages|texts|calls|whatsapps|emails|writes)\b)/i, (m0, a, n, b) => a + n[0].toUpperCase() + n.slice(1) + b);
  // debts said oddly → the words the People & plans reader knows
  s = s.replace(/^(.+?)\s+(?:still\s+)?(?:hasn'?t|has not|didn'?t|did not|never)\s+(?:paid|given|sent)\s+(?:me\s+)?back\s+(?:the\s+|my\s+)?([\d٠-٩][\d٠-٩,.]*)/i, "$1 owes me $2")
    .replace(/^(.+?)\s+(?:covered|paid for)\s+my\s+([\d٠-٩][\d٠-٩,.]*)\s*(.*?)(?:,?\s*(?:so\s+)?i owe (?:him|her|them|it)\b.*)?$/i, (m0, who, n, rest) => "I owe " + who + " " + n + (rest ? " " + rest : ""))
    .replace(/^(.+?)\s+fronted me\s+/i, "$1 lent me ")
    .replace(/^(?:i\s+)?gave\s+(\S+(?:\s+\S+)?)\s+([\d٠-٩][\d٠-٩,.]*)\s+(?:till|until|untill|til)\s+/i, "I lent $1 $2 until ")
    .replace(/^(\S+(?:\s+\S+)?)\s+لسه\s+(?:مرجعليش|مرجعش ليا|مرجعش|ماردليش|مردليش|مدفعليش)\s+(?:ال)?([\d٠-٩][\d٠-٩,.]*)/, "$1 عليه $2")
    .replace(/^(\S+(?:\s+\S+)?)\s+لسه\s+عليه\s+(?:حاجة|حاجه|فلوس)\s*([؟?])?$/, "$1 عليه كام؟");
  // «تابعلي سعر X ولما يبقى اقل من N نبهني» → «نبهني لما X يبقى أقل من N»
  if ((m = /^تابع(?:لي| لي)?\s+سعر\s+(.+?)\s+و?لما\s+(?:يبقى|يبقي|تبقى|ينزل|يوصل)\s+(?:اقل من|أقل من|تحت|ل)\s*([\d٠-٩][\d٠-٩,.]*)\s*(?:نبهني|قولي|عرفني)?$/.exec(s))) s = "نبهني لما " + m[1] + " يبقى أقل من " + m[2];
  // money questions in slang
  s = s.replace(/^how much (?:did|have) i (?:blow|blown|burn|burned|burnt|waste|wasted|drop|dropped|splash|splashed)\s+(?:out\s+)?on\b/i, "how much did I spend on")
    .replace(/^what(?:'s| is) my (.+?) total (this|last|today|yesterday)\b/i, (m0, c, p) => "how much did I spend on " + c + " " + p)
    .replace(/^how much money is left(?: for me)?\b/i, "how much do I have left");
  return s.replace(/[ \t]{2,}/g, " ").trim();
}
// a change of mind: "…at 7 am, sorry 8 am, to …" → "…at 8 am to …"; "lunch 200, no actually 250" → "lunch 250"
const FIX = "(?:sorry,?\\s*i mean(?:t)?|sorry|no wait,?(?:\\s*it was)?|no,? actually|actually|oops,?\\s*i meant|i mean|i meant|correction:?|لا قصدي|قصدي|لا استنى|لا استني|استنى|استني|لا لحظة|لا لحظه|لا ثانية|لا ثانيه|لا غلطت كانوا|لا غلطت كانت|لا غلط كانت|لا غلط كانوا|لا غلطت|لا لا)";
const NUM = "([\\d٠-٩][\\d٠-٩,.]*)(\\s*(?:am|pm|a\\.m\\.|p\\.m\\.))?";
const CORR = new RegExp("^(.*?)" + NUM + "([^\\d٠-٩]{0,40}?)[\\s,،—–-]+" + FIX + "[\\s,،:]*(?:it was\\s+|كانوا\\s+|كانت\\s+)?" + NUM + "\\s*[,،]?\\s*(.*)$", "i");
function correct(t) {
  const m = CORR.exec(t); if (!m) return t;
  const [, before, , ap1, mid, n2, ap2, after] = m;
  const out = (before + n2 + (ap2 || ap1 || "") + (mid && !/^[\s,،—–-]*$/.test(mid) ? mid : "") + (after ? " " + after : "")).replace(/\s+([,،])/g, "$1").replace(/[ \t]{2,}/g, " ").trim();
  return out;
}
/** "don't remind me to …", "I don't owe Ahmed anything", «متفكرنيش …»: an order NOT to do something — nothing is recorded or set. */
export function negatedOrder(text) {
  const t = String(text || "").trim();
  return /^(?:please\s+)?(?:don'?t|do not|no need to|you don'?t (?:have|need) to|stop|never)\s+(?:remind|ping|nudge|alert)(?:ing)? me\b|^(?:never ?mind|forget it),?\s*(?:don'?t|no)\b|^i (?:don'?t|do not) (?:want|need) (?:a |any )?reminders?\b/i.test(t)
    || /^i (?:don'?t|do not) owe\b.*\b(?:anything|nothing|any money)\b|^\S+(?:\s+\S+)?\s+(?:doesn'?t|does not|don'?t) owe me\b.*\b(?:anything|nothing|any ?more)\b|\b(?:are|we'?re) (?:even|square|quits)\b.*\bno debts?\b/i.test(t)
    || /^i (?:didn'?t|did not|haven'?t) (?:spend|spent|pay|paid|buy|bought) (?:anything|nothing|a thing)\b/i.test(t)
    || /^(?:متفكرنيش|ماتفكرنيش|متنبهنيش|بطل تفكرني|بطّل تفكرني|مش عايز تذكير|مش عاوز تذكير|مش محتاج تذكير)|^(?:انا )?مش مديون\b|مش عليه (?:حاجة|اي حاجة|أي حاجة|فلوس)|^(?:مصرفتش|ماصرفتش) (?:حاجة|ولا مليم|اي حاجة)/.test(t);
}
/** cleanTyped + the indirect ways of asking + a change of mind → what the readers read. */
export function readable(text) {
  const raw = String(text == null ? "" : text);
  if (raw.length > 300 || /\n\s*\n/.test(raw) || raw.split("\n").length > 4) return raw.trim();
  const c = cleanTyped(text);
  if (negatedOrder(c)) return c;
  return correct(rephrase(otherLang(c)));
}

/* ---- v9.9.32: spending and reminders in 7 more languages → English the readers know (the thing / task keeps its own words) --------
   "gasté 50 en el almuerzo" · "paguei 612 pelo táxi" · "ho speso 30 per la cena" · "benzin için 658 lira harcadım" · "bayar 50 ribu untuk
   kopi" · "recuérdame mañana a las 9 llamar a mamá" · "rappelle-moi demain à 9h d'appeler maman" · "yarın saat 9'da annemi aramayı
   hatırlat" · "ingatkan aku besok jam 9 untuk telepon ibu". French and German payments were already read. */
const N = "([\\d٠-٩][\\d٠-٩.,]*)";
const CUR = { euros: "EUR", euro: "EUR", "€": "EUR", reais: "BRL", real: "BRL", lira: "TRY", tl: "TRY", pesos: "MXN", rupiah: "IDR", rp: "IDR" };
const curOf = (w) => (w ? (CUR[String(w).toLowerCase()] || "") : "");
const amt = (n, cur, k) => { const v = k ? String(Math.round(parseFloat(String(n).replace(/[.,](?=\d{3}\b)/g, "").replace(",", ".")) * 1000)) : n; return v + (cur ? " " + cur : ""); };
const WHEN = [
  // [regex for the time words, → English]
  [/^(?:mañana|demain|morgen|amanhã|domani|yarın|besok)$/i, "tomorrow"], [/^(?:hoy|aujourd'?hui|heute|hoje|oggi|bugün|hari ini)$/i, "today"],
];
function whenEn(w) { const x = WHEN.find(([re]) => re.test(w.trim())); return x ? x[1] : ""; }
function otherLang(t) {
  let m;
  // v9.9.38 (the 1M test): "where did my money go this week?" was read as "where did I put my …" / "what's due"
  if ((m = /^(?:هي\s+)?(?:فلوسي|الفلوس)\s+(?:راحت|بتروح|راحو|راحوا)\s+(?:فين|على ايه|في ايه)\s*(.*)$/.exec(t))) return "صرفت كام " + (m[1] || "").replace(/[؟?]+$/, "").trim() + "؟";   // (the model trial: «فلوسي راحت فين الاسبوع ده؟» went to the model)
  if ((m = /^(?:so\s+|ok\s+)?where\s+(?:did|has|have)\s+(?:all\s+)?(?:my|our)\s+(?:money|cash|salary)\s+(?:go|gone|went)\b\s*(.*)$/i.exec(t))) return "what did I spend money on" + (m[1] ? " " + m[1] : "?");
  // spending
  if ((m = new RegExp("^(?:gasté|pagué|gastei|paguei|ho speso|ho pagato|spesi|pagai|j'ai payé|j'ai dépensé|j’ai payé|j’ai dépensé)\\s+" + N + "\\s*(euros?|reais|real|pesos|€)?\\s+(?:en|por|no|na|nos|nas|em|pelo|pela|com|per|di|para|para o|para a|pour|au|à la|à|aux)\\s+(.+)$", "i").exec(t))) return "spent " + amt(m[1], curOf(m[2])) + " on " + m[3];
  if ((m = new RegExp("^(.+?)\\s+için\\s+" + N + "\\s*(lira|tl)?\\s+(?:ödedim|harcadım|verdim)$", "i").exec(t))) return "spent " + amt(m[2], curOf(m[3] || "lira")) + " on " + m[1];
  if ((m = new RegExp("^(?:bayar|habis|beli|keluar)\\s+" + N + "\\s*(ribu|rb|k)?\\s*(?:rupiah|rp)?\\s+(?:untuk|buat|utk|beli)\\s+(.+)$", "i").exec(t))) return "spent " + amt(m[1], "IDR", !!m[2]) + " on " + m[3];
  if ((m = new RegExp("^(.{2,40}?)\\s+" + N + "\\s*(ribu|rb)\\s*$", "i").exec(t))) return "spent " + amt(m[2], "IDR", true) + " on " + m[1];
  if ((m = new RegExp("^(.{2,40}?)\\s+" + N + "\\s*(euros?|reais|lira|tl|pesos)\\s*$", "i").exec(t)) && !/[\u0600-\u06FF]/.test(t) && !/\b(?:is|was|are|were|costs?|price|about|around|for|of|the|it|that|this)\b/i.test(m[1])) return "spent " + amt(m[2], curOf(m[3])) + " on " + m[1];
  // reminders
  const H = "(?:\\s+(?:a las|à|um|às|as|alle|jam|saat)\\s+(\\d{1,2})(?:[:h.](\\d\\d))?(?:h|'?(?:da|de|ta|te))?)?";
  const IN = "(?:en|dans|in|em|tra|fra)\\s+(\\d+)\\s+(horas?|heures?|stunden?|ore|minutos?|minutes?|minuten|minuti)";
  if ((m = new RegExp("^(?:recu[ée]rdame|rappelle[- ]moi|erinnere mich|me lembr[ea]|lembre[- ]me|ricordami)\\s+(?:" + IN + "|(\\S+)" + H + ")\\s*,?\\s*(?:de |d'|da |di |daran,?\\s+|que |an )?(.+)$", "i").exec(t))) {
    const [, n, unit, w, h, mi, task] = m;
    if (n) return "remind me in " + n + (/^(?:min)/i.test(unit) ? " minutes" : " hours") + " to " + task;
    const day = whenEn(w || ""); if (day) return "remind me " + day + (h ? " at " + h + (mi ? ":" + mi : "") : "") + " to " + task;
  }
  if ((m = /^(?:(\S+)\s+saat\s+(\d{1,2})(?:[:.](\d\d))?'?(?:da|de|ta|te)|(\d+)\s+saat\s+sonra|(\S+))\s+(.+?)\s+hatırlat(?:ır mısın)?$/i.exec(t))) {
    if (m[4]) return "remind me in " + m[4] + " hours to " + m[6];
    const day = whenEn(m[1] || m[5] || ""); if (day) return "remind me " + day + (m[2] ? " at " + m[2] + (m[3] ? ":" + m[3] : "") : "") + " to " + m[6];
  }
  if ((m = /^ingatkan\s+(?:aku|saya|gue)\s+(?:(\d+)\s+jam\s+lagi|(\S+(?:\s+ini)?)(?:\s+jam\s+(\d{1,2})(?:[:.](\d\d))?)?)\s+(?:untuk\s+|buat\s+)?(.+)$/i.exec(t))) {
    if (m[1]) return "remind me in " + m[1] + " hours to " + m[5];
    const day = whenEn(m[2] || ""); if (day) return "remind me " + day + (m[3] ? " at " + m[3] + (m[4] ? ":" + m[4] : "") : "") + " to " + m[5];
  }
  return worldToEnglish(t);   // v9.9.38: the six everyday orders in all 20 languages (worldlang.js)
}
