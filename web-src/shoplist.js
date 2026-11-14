/* ---- v9.9.40 AP-4 (the new Autopilot, Ali OK'd K2 / K3, 14 Nov 2026: "also I want it to understand when I tell it I bought the
   shopping list"): the Talabat list — a chat Ali and Noudy write what ran out at home in — and "I bought …" said any way.
   · itemsOf("عيش وجبنة") → ["عيش", "جبنة"]; itemsOf("milk, eggs and bread") → ["milk", "eggs", "bread"]; a message that is not
     items ("ok", "where are you?", "the frozen ones pls") → [].
   · boughtOf(text, items) → { all: true } / { all: true, except: [...] } / { only: [...] } / null — "I bought the shopping list",
     «جبت الطلبات», «جبت كل حاجة ما عدا اللبن», "got everything except milk and eggs", "bought the tortilla and bread",
     "gebt el talabat", "5alast el shopping"; the item names are matched to the list (Arabic spelling, plural, "the").
   Pure; tests: tests/shoplist/gen.mjs (10,000 sentences × lists) + tests/unit/v9940shoplist.test.mjs. */

const AR_FOLD = (s) => String(s || "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$)/g, "ه").replace(/[ًٌٍَُِّْـ]/g, "");
const norm = (s) => AR_FOLD(String(s || "").toLowerCase()).replace(/^(?:the|a|an|some|el|al|ال)\s*/i, "").replace(/^ال(?=[ء-ي]{2,})/, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const sing = (w) => w.replace(/(?<=[a-z]{3})(?:ies)$/, "y").replace(/(?<=[a-z]{3})(?:es)$/, "").replace(/(?<=[a-z]{3})s$/, "");
const key = (s) => norm(s).split(" ").map(sing).join(" ");

// ---- 1. items from a list-chat message ----------------------------------------------------------------------------------------
const FILLER = /^(?:we need|need|please get|please buy|get|buy|pls|please|also|and|plus|محتاجين|عايزين|هات|هاتي|جيب|جيبي|ابقى هات|ابقي هاتي|و|كمان|e7na me7tageen|hat|geeb)\s+/i;
const RAN_OUT = /\s+(?:خلص|خلصت|خلصو|خلصوا|مفيش|ran out|is out|are out|finished|5eles|5elset)\s*[.!]*$/i;
const NOT_ITEMS = /[?؟]|^(?:ok|okay|yes|no|thanks|where|when|who|why|how|call|i'?m|i am|on my way|انا|فين|امتى|ليه|مين|ازاي|تمام|حاضر|ماشي|شكرا)\b/i;
// (the 10,000-conversation run: "the weather is nice today", «انا وصلت», "saw Sara today" in the list chat became items) — a sentence
// is not a list: a pronoun, a verb or a time word means somebody is SAYING something, not naming things to buy
const SENTENCE = /\b(?:i|i'm|im|you|we|he|she|they|it's|its|is|are|was|were|am|be|been|have|has|had|do|does|did|will|would|can|could|should|went|go|going|came|come|coming|arrived|saw|see|seen|said|told|think|know|love|like|home|today|tonight|yesterday|now|here|there|weather|nice|good|bad|ok|okay|thanks|please call|call me|where|when|why|how|what|who)\b|(?:^|\s)(?:انا|أنا|انت|انتي|إنت|احنا|إحنا|هو|هي|هما|وصلت|وصل|روحت|رحت|شفت|شوفت|قلت|قال|عملت|هعمل|هنروح|جاي|جايه|جاية|فين|امتى|إمتى|ليه|ازاي|ازيك|عامل|كويس|حلو|البيت|النهارده|انهارده|امبارح|دلوقتي|بكره|بكرة|ana|enta|e7na|wasalt|ro7t|sheft|fen|feen|emta|leh|ezay|ezayak|kwayes|el beit|ennaharda|eh|eih|ehh|akhbar|el akhbar|ezayek|3amel|3amla|wa7ashteny|w7shtny|ba7ebak|ba7ebek)(?=\s|$|[،,.!?؟])|\b(?:miss|love|tired|happy|sad|great|awesome|sorry|congrats|congratulations|good luck|what's up|whats up|sup)\b|(?:^|\s)[ء-ي]{2,}(?:تني|تيني|تينا|تنا)(?=\s|$|[،,.!?؟])|(?:^|\s)(?:وحشتني|وحشتيني|بحبك|مبروك|ربنا معاك|الحمد لله|ازاي|اخبارك|عامله ايه|عامل ايه)(?=\s|$|[،,.!?؟])/i;
export function itemsOf(text0) {
  const text = String(text0 || "").trim();
  if (!text || NOT_ITEMS.test(text) || text.length > 200 || SENTENCE.test(text.replace(/\s+(?:خلص|خلصت|خلصو|خلصوا|مفيش|ran out|is out|are out|finished|5eles)\s*[.!]*$/i, ""))) return [];
  const parts = text.split(/\s*(?:\n|,|،|;|\+|\band\b|&|\s+و(?=[ء-ي]))\s*/i).map((x) => x.replace(FILLER, "").replace(FILLER, "").replace(RAN_OUT, "").replace(/\s*(?:pls|please|لو سمحت|بليز)\s*$/i, "").trim()).filter(Boolean);
  // a detail ("the frozen ones", "from Spinneys") belongs to the item before it, it is not an item
  const out = [];
  for (const p of parts) {
    if (/^(?:the \w+ ones?|from \S+|اللي|بتاع|من عند|كبير|صغير|frozen|fresh|large|small|big|x?\d+)$/i.test(p) || /^(?:the|from|من)\s/i.test(p) && out.length) { if (out.length) out[out.length - 1].note = (out[out.length - 1].note ? out[out.length - 1].note + ", " : "") + p; continue; }
    if (p.split(/\s+/).length > 5) return [];   // a sentence, not a list
    out.push({ text: p });
  }
  return out.map((x) => x.text);
}

// ---- 2. "I bought …" ----------------------------------------------------------------------------------------------------------
const BOUGHT = /\b(?:i\s+)?(?:bought|got|picked up|grabbed|did|finished|done with|have)\b|(?:^|\s)(?:جبت|اشتريت|خلصت|جبنا|اشترينا|gebt|gibt|eshtarait|eshtareit|5alast|khalast)(?=\s|$)/i;
const LIST_WORD = /\b(?:the\s+)?(?:shopping|grocer(?:y|ies)|groceries|talabat|list|shopping list|grocery list|stuff|things|everything|all of it|all)\b|(?:الطلبات|طلبات|الحاجات|الحاجه|كل حاجه|كل حاجة|كله|كلها|القايمه|القايمة|الشوبنج|السوبرماركت|talabat|el talabat|el 7agat|kol 7aga|kollo)/i;
const EXCEPT = /\s*(?:\b(?:except(?: for)?|but not|apart from|other than|without|minus)\b|(?:ما عدا|ماعدا|الا|إلا|غير|من غير|ma3ada|ma 3ada|ella|gher|men gher))\s+/i;
// a question is never "I bought it" — wherever its ? is ("ok did you buy the milk? 🙏")
const PEOPLE_ASK = /[?؟]|^\s*(?:did|have|will|would|can|could) (?:you|noudy|she|he|we)\b|^\s*(?:انت|انتي|هو|هي|هتجيب|هتجيبي) /i;
const LEAD = /^\s*(?:(?:ok|okay|so|btw|hey|hi|attune|hey attune|يا\s*(?:اتيون|أتيون)|طيب|بص)[\s,!:.]+)+/i;
// (the held-out run: «جبت الرز النهارده» — a time word at the end is not part of the last item)
const TAIL = /[\s,.!]*(?:خلاص|خلص|الحمد لله|thanks|thank you|thx|done|ya rab|today|tonight|yesterday|this morning|just now|now|النهارده|انهارده|النهاردة|امبارح|إمبارح|دلوقتي|الصبح|بالليل|ennaharda|naharda|embare7|delwa2ty|🙏|👍|✅|❤️)[\s.!🙏👍✅❤️]*$/i;
/** The items said in a phrase, matched to the list (null when one of them isn't on it — then it is not about this list). */
function namesIn(phrase, items) {
  const bits = String(phrase || "").split(/\s*(?:,|،|\band\b|&|\s+و(?=[ء-ي])|\s+w\s+)\s*/i).map((x) => x.replace(/^(?:the|el|al)\s+/i, "").trim()).filter(Boolean);
  const out = [];
  for (const b of bits) { const k = key(b); const hit = items.find((it) => key(it) === k || key(it).includes(k) && k.length >= 3 || k.includes(key(it)) && key(it).length >= 3); if (!hit) return null; if (!out.includes(hit)) out.push(hit); }
  return out;
}
export function boughtOf(text0, items = []) {
  if (PEOPLE_ASK.test(String(text0 || "").replace(LEAD, ""))) return null;
  let text = String(text0 || "").replace(LEAD, "").replace(/[.!]+\s*$/, "").trim(); for (let i = 0; i < 3; i++) text = text.replace(TAIL, "").trim();
  if (!text || !BOUGHT.test(text)) return null;
  const after = text.replace(/^.*?(?:\b(?:i\s+)?(?:bought|got|picked up|grabbed|finished|done with)\b|(?:جبت|اشتريت|خلصت|جبنا|اشترينا|gebt|gibt|eshtarait|eshtareit|5alast|khalast))\s*/i, "");
  const ex = EXCEPT.exec(after);
  if (LIST_WORD.test(ex ? after.slice(0, ex.index) : after)) {
    if (!ex) return { all: true };
    const except = namesIn(after.slice(ex.index + ex[0].length), items);
    return except && except.length ? { all: true, except } : { all: true };
  }
  const only = namesIn(after, items);
  return only && only.length ? { only } : null;
}
/** Apply it to the list's open items → { done: [...], left: [...] } (what to tick and what stays). */
export function applyBought(b, items = []) {
  if (!b) return { done: [], left: items.slice() };
  const done = b.only ? items.filter((x) => b.only.includes(x)) : items.filter((x) => !(b.except || []).includes(x));
  return { done, left: items.filter((x) => !done.includes(x)) };
}
