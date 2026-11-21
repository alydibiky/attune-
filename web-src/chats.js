/* ---- v9.9.40 AP-2 (the new Autopilot, Ali OK'd K1–K6 on 14 Nov 2026 — rule 1 "ignore by default", rule 4 "everything kept and
   understood by chat"): which CHAT a notification belongs to, who WROTE it, whether the chat is a GROUP, and whether the message is
   NOISE (a meme, a sticker, a link with nothing else, "good morning", "ok", a reaction…). Pure.
   The phone now saves Android's own conversation fields with every chat message (RecallLog + ChatInbox.parts: who, convo, group);
   for messages saved before that, the shapes WhatsApp / Telegram write are read here:
     · title "Talabat",   text "Noudy: tortilla"          (a group; a saved contact writing)
     · title "Talabat: Noudy" or "Noudy @ Talabat"         (a group)
     · title "Address East Owners: ~Rowan Soliman"         (a group; ~ = not in your contacts)
     · title "Mama (2 messages)", text "call me"           (one person)
   A chat already known as a group stays a group ("Talabat" with a text that has no "Name:"). Tests: tests/chats/gen.mjs (10,000). */

const CHAT_APP = /whatsapp|telegram|messenger|orca|signal|securesms|viber|botim|imo\b|instagram|slack|teams|discord|wechat|tencent\.mm|line\b|jp\.naver/i;
export const appOf = (n) => { const s = String((n && (n.pkg || "")) + " " + (n && (n.app || ""))).toLowerCase();
  return /whatsapp/.test(s) ? "whatsapp" : /telegram/.test(s) ? "telegram" : /messenger|orca/.test(s) ? "messenger" : /signal|securesms/.test(s) ? "signal"
    : /instagram/.test(s) ? "instagram" : /viber/.test(s) ? "viber" : /botim/.test(s) ? "botim" : /slack/.test(s) ? "slack" : /teams/.test(s) ? "teams" : CHAT_APP.test(s) ? "chat" : ""; };
export const isChat = (n) => !!appOf(n);
const COUNT = /\s*\((?:\d+|[٠-٩]+) (?:new )?(?:messages?|رسائل|رسالة|mensajes?|messages)\)\s*$/i;
const TILDE = /^~\s?/;
// a word that starts a sentence with a colon, not a person's name ("Note: …", "Time: 9:00", «العنوان: …»)
// (the held-out run: "Remember:", "PS:", "Update:", «ملاحظة:» too — the words a sentence starts a label with, in EN / AR / Franco)
const NOT_A_NAME = /^(?:note|notes|reminder|remember|time|date|day|price|cost|total|address|location|place|update|updates|important|urgent|subject|re|fwd|fyi|btw|ps|p\.s|pps|link|code|otp|tip|tips|news|breaking|today|tomorrow|tonight|question|q|answer|a|info|warning|alert|edit|correction|also|step \d+|\d+|todo|to do|list|menu|order|summary|reason|status|result|results|score|weather|ملاحظة|ملحوظة|تنبيه|تذكير|العنوان|الميعاد|المعاد|السعر|الوقت|المكان|مهم|عاجل|خبر|كود|الكود|اللينك|سؤال|تحديث|النهارده|بكرة|مثلا|يعني|molaheza|mohem|el 3enwan)$/i;
const nameLike = (s) => { const t = String(s || "").replace(TILDE, "").trim();
  return t.length >= 1 && t.length <= 48 && !NOT_A_NAME.test(t) && !/[?؟!]/.test(t) && t.split(/\s+/).length <= 9 && !/^https?:/i.test(t) && !/^\d+([:.]\d+)?$/.test(t); };

/** { key, app, chat (the chat's name), who (the writer), group, text } — or null for a notification that is not a chat message.
 *  known: { [key]: { group: true } } — the chats seen before (a chat once seen as a group stays one). */
export function chatOf(n, known = {}) {
  const app = appOf(n); if (!app || !n) return null;
  let title = String(n.title || "").replace(COUNT, "").trim(), text = String(n.text || "").trim();
  if (!title && !text) return null;
  // the phone's own reading (v9.9.40): trusted as it is
  if (typeof n.group === "boolean" && (n.convo || n.who)) {
    const chat = n.group ? String(n.convo || title).replace(COUNT, "").trim() : String(n.who || title).replace(COUNT, "").trim();
    const who = String(n.who || title).replace(TILDE, "").trim();
    return { key: app + "|" + (n.group ? "g:" : "p:") + chat.toLowerCase(), app, chat, who, group: !!n.group, text };
  }
  let chat = title, who = title, group = false, m;
  if ((m = /^(.+?) @ (.+)$/.exec(title))) { group = true; who = m[1].trim(); chat = m[2].trim(); }
  else if ((m = /^(.+?):\s*(~?\s?.+)$/.exec(title)) && nameLike(m[2])) { group = true; chat = m[1].trim(); who = m[2].replace(TILDE, "").trim(); }
  else if ((m = /^\s*(~\s?)?([^:\n]{1,48}):\s+([\s\S]+)$/.exec(text)) && nameLike(m[2]) && (m[1] || (known[app + "|g:" + title.toLowerCase()] || {}).group || !NOT_A_NAME.test(m[2].trim()) && /^[\p{L}~+]/u.test(m[2].trim()) && m[2].trim().toLowerCase() !== title.toLowerCase())) {
    group = true; chat = title; who = m[2].trim(); text = m[3].trim();
  }
  else if ((known[app + "|g:" + title.toLowerCase()] || {}).group) { group = true; chat = title; who = ""; }
  who = who.replace(TILDE, "").trim();
  return { key: app + "|" + (group ? "g:" : "p:") + chat.toLowerCase(), app, chat, who, group, text };
}

// ---- noise (rule 1): kept for search, never a card ---------------------------------------------------------------------------
const URL_RE = /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|eg|me|ly|be|gl|tv|io)\/\S*/gi;
// (any emoji in front: "📍 Live location", "🗳 Poll", "🔂 View once")
const MEDIA = /^[\p{Extended_Pictographic}️\s]*(?:photo|video|voice (?:message|note|call)|video (?:note|call)|audio|sticker|gif|image|document|contact|contact card|location|live location|poll|view once (?:photo|video|message)|صورة|فيديو|رسالة صوتية|بصمة صوتية|ملصق|ملف|مستند|موقع|الموقع المباشر|جهة اتصال|استطلاع)(?:\s*\(\d+:\d+\))?\s*$|^<(?:media omitted|تم استبعاد الوسائط)>$|^(?:image|video|sticker|audio|gif) omitted$/iu;
const REACT = /^(?:reacted|تفاعل|تفاعلت|reaccionó|a réagi)\b|^(?:❤️|👍|😂|😮|😢|🙏|🔥|👏|😍|🥰|💯|✅|👌)\s*(?:to|على)\b/i;
const DELETED = /^(?:this message was deleted|you deleted this message|تم حذف هذه الرسالة|🚫\s*.{0,40}deleted)$/i;
const GREET = /^(?:good (?:morning|night|evening|afternoon)|gm|gn|morning|happy (?:friday|weekend|eid|new year|ramadan)|eid mubarak|ramadan kareem|jumma mubarak|صباح (?:الخير|الفل|النور|الورد|الفل والياسمين)|مساء (?:الخير|الفل|النور)|تصبحوا على خير|تصبح على خير|جمعة مباركة|جمعه مباركه|كل سنة وانتو طيبين|كل سنه وانتم طيبين|عيد (?:سعيد|مبارك)|رمضان كريم|sabah el (?:kheir|7'eir|5eir|fol)|masa2 el kheir|gom3a mobaraka)[\s!.\p{Extended_Pictographic}️]*$/iu;
const ACK = /^(?:ok(?:ay)?|k|kk|yes|yep|yeah|no|nope|sure|thanks?|thank you|thx|ty|noted|done|got it|cool|nice|great|lol|haha+|hahaha+|hhh+|wow|amen|ameen|آمين|اوك|أوك|تمام|ماشي|حاضر|طيب|اه|أه|ايوه|أيوه|لا|شكرا|شكراً|متشكر|تسلم|ميرسي|هههه+|خخخ+|حلو|جميل|tmam|mashy|7ader|shokran|merci|tamam|ah|la2)[\s!.?؟\p{Extended_Pictographic}️]*$/iu;
const EMOJI_ONLY = /^[\s\p{Extended_Pictographic}‍️\u{1F3FB}-\u{1F3FF}]+$/u;
const FORWARD = /^(?:forwarded|forwarded many times|تمت إعادة التوجيه|تمت إعادة توجيهها كثيرًا)\b/i;
const SUMMARY = /^\d+ (?:new )?messages? from \d+ chats?$|^\d+ رسائل? (?:جديدة )?من \d+ (?:محادثات|دردشات)$/i;

// v10.8 (Ali, 21 Nov: "any notification is to do even if it's not that important" — a shop's WhatsApp advert «تخيل بوكس فيه كل اللي ممكن
// تحتاجه … عليه خصم ٥٠٪» became a late to-do): an ADVERT is noise. Scored — a percent next to a discount word, a promo code / coupon,
// "limited time" count 2; "order now", "free delivery", «عروض», 🔥🎁 count 1; 2 or more = an advert. A message that asks YOU
// something ("they have 30% off — should I get it?", «أجيبلك؟») is never an advert.
const PCT = "[\\d٠-٩]{1,3}(?:[.,][\\d٠-٩]+)?\\s*(?:%|٪|percent|في المية|في الميه)";
const DISC = "(?:off|discount|sale|save|savings|خصم|الخصم|تخفيض|تخفيضات|توفير|وفر|اوفر|أوفر|عرض|عروض|offer|deal|promo|khasm|5asm|takhfeed|ta5fee?d)";
const OFFER_STRONG = [new RegExp(PCT + "[^\\n]{0,30}?" + DISC + "|" + DISC + "[^\\n]{0,30}?" + PCT, "i"),
  /\b(?:promo|discount|coupon|voucher)\s*code\b|\buse (?:the )?code\b|كود (?:ال)?خصم|كوبون|بروموكود|برومو كود/i,
  /\blimited[- ]time\b|\boffer (?:ends|valid)\b|\bwhile stocks? last\b|لفترة محدودة|لمدة محدودة|العرض (?:ساري|متاح|لحد|حتى)|حتى نفاد الكمية|لحد ما الكمية تخلص/i,
  /\b(?:buy \d+ get \d+|bogo)\b|اشتري [\d٠-٩]+ (?:و ?)?(?:خد|واحصل)|\bunsubscribe\b|لإلغاء الاشتراك|للالغاء ارسل/i];
const OFFER_WEAK = [/\b(?:order|shop|book|buy|grab|get) (?:yours? )?now\b|اطلب (?:الآن|الان|دلوقتي|حالا)|اطلبه (?:الآن|الان|دلوقتي)|احجز (?:الآن|الان|دلوقتي)|اشتري (?:الآن|الان|دلوقتي)/i,
  /\bfree (?:delivery|shipping|gift)\b|توصيل مجاني|شحن مجاني|هدية مجانية|هدية مع كل/i, /\b(?:new collection|new arrivals?|now available|available now|in stock|best ?seller)\b|تشكيلة جديدة|وصل حديثا|متوفر (?:الآن|الان|دلوقتي)|الأكثر مبيعا/i,
  /عرض|عروض|\b(?:sale|offer|deal|discount)s?\b|خصم|تخفيض/i, /[🔥🎁🛍️💥🏷️⚡]{1}/u, /\b(?:only|just)\s+(?:EGP|LE|\$|€)?\s*[\d٠-٩]+|بس ب ?[\d٠-٩]+|بـ ?[\d٠-٩]+ (?:جنيه|ج)\b|\bper (?:box|piece|month)\b/i,
  /\b(?:dm|inbox) (?:us|for)\b|ابعتلنا|كلمنا (?:على|ع) ال|للطلب|للحجز|للاستفسار/i];
const ASKS_ME = /\b(?:should i|shall i|want me to|do you want|d'?you want|can you|could you|would you|please (?:get|buy|pick|bring|send)|pick (?:one |it |them )?up)\b|ممكن\s+(?:تعدي|تجيب|تبعت|تشتري|تاخد|تمر|تفوت)|(?:جيبلي|هاتلي|ابعتلي|اشتريلي|هاتهولي)|\b(?:momken t(?:egeb|eb3at|eshtery)|hatly|gebly|eb3atly)\b|(?:^|\s)(?:تحب|تحبي|عايز|عايزة|عاوز|اجيب|أجيب|اجيبلك|أجيبلك|نجيب|نشتري|اشتريلك|ناخد|آخد|اخد)(?=\s|$|[؟?،,])/i;
export function isOffer(text) { const t = String(text || "").replace(/\s+/g, " "); if (ASKS_ME.test(t)) return false;
  let sc = 0; for (const r of OFFER_STRONG) if (r.test(t)) sc += 2; for (const r of OFFER_WEAK) if (r.test(t)) sc += 1; return sc >= 2; }

/** null for a real message; else the kind of noise: "media", "link", "reaction", "deleted", "greeting", "ack", "emoji", "forward", "summary", "offer" (an advert). */
export function noiseOf(text0) {
  const text = String(text0 || "").replace(/[‎‏]/g, "").trim();
  if (!text) return "media";
  if (SUMMARY.test(text)) return "summary";
  if (DELETED.test(text)) return "deleted";
  if (REACT.test(text)) return "reaction";
  if (MEDIA.test(text)) return "media";
  if (FORWARD.test(text)) return "forward";
  if (EMOJI_ONLY.test(text)) return "emoji";
  if (GREET.test(text)) return "greeting";
  if (ACK.test(text)) return "ack";
  if (isOffer(text)) return "offer";
  // a link with (almost) nothing else: a meme / a Facebook post / a video — "check this https://…" too
  const rest = text.replace(URL_RE, " ").replace(/\b(?:check (?:this|it) out|look|see this|watch|شوف|بص|شوفوا|بصوا|lol|haha|😂+)\b/gi, " ").replace(/[\s\p{P}\p{Extended_Pictographic}]+/gu, " ").trim();
  if (URL_RE.test(text) && rest.split(/\s+/).filter(Boolean).length <= 2) { URL_RE.lastIndex = 0; return "link"; }
  URL_RE.lastIndex = 0;
  return null;
}
