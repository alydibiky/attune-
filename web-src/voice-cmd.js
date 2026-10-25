/* ---- Voice step 1.2 (VOICE_PLAN.md) — "Ya Attune": what was said → what to do, by CODE (Ali: "really accurate and powerful").
   Commands (Egyptian, Gulf, Levantine, Darija, English, Hinglish words):
     send   «ابعت لأحمد إني هتأخر نص ساعة», «قول لماما هكلمها بعد الشغل», «علّم خالد إني وصلت» (Gulf), «خبّر سامي إنو جاي» (Lev),
            «صيفط لكريم بلي غادي نتعطل» (Darija), "tell Ahmed I'm running late", "text Sara that the meeting moved",
            "Ahmed ko bolo ki main late hoon" (Hinglish)
     who    «مين بعتلي؟», «في رسايل؟», «منو راسلني؟», «شو في رسايل؟», "who messaged me?", "read my messages"
     read   «اقرالي رسالة أحمد», «أحمد قال إيه؟», "what did Ahmed say?"
     reply  «رد عليه قوله نص ساعة وجاي», «رد على ماما إني هكلمها», "reply saying I'm on my way"
     yes / no / change / a language («فرانكو», «عربي», "English") — answers inside the conversation
     pass   anything else → the Home box reads it (money, reminders, Agents, apps…) or Chat answers it
   voiceTurn(state, said, ctx) runs the conversation: who → what → which language (asked once per person, then remembered)
   → read back → "send" → the action. Never sends without the read-back (VOICE_PLAN rule 2). Pure; tests/unit/v1100voice.test.mjs
   and the accuracy set tests/voice/commands.json.                                                                          */
import { toFranco, isFranco, styleOf, langFor, rememberLang, langAnswer, aliasFor, rememberAlias } from "./franco.js";

const A = "[اأإآ]";                                     // any alef
const AR = /[؀-ۿ]/;
const clean = (s) => String(s || "").replace(/[ً-ْـ]/g, "").replace(/[“”«»"]/g, "").replace(/\s+/g, " ").trim();
const fold = (s) => clean(s).toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$)/g, "ه");
const stripEnd = (s) => String(s || "").replace(/\s*[.!؟?]+$/, "").trim();

// ---- people: who is "Ahmed"? -----------------------------------------------------------------------------------------------------
/** Everyone the assistant can reach: the senders of recent chat notifications (with a reply key) and the people it remembers. */
export function knownPeople(ctx = {}) {
  const out = new Map();
  // a person's own chat first: a message they wrote in a group gives the GROUP's reply key — never used to reach them alone
  const msgs = (ctx.inbox || []).slice().sort((a, b) => (!!a.group - !!b.group) || (b.ts || 0) - (a.ts || 0));
  for (const m of msgs) {
    const k = fold(m.who); if (!k) continue;
    const prev = out.get(k);
    if (prev && !(prev.group && !m.group)) continue;
    out.set(k, { name: clean(m.who), key: m.group ? null : (m.key || null), app: m.app || "", canReply: !m.group && !!m.canReply, group: m.group ? clean(m.convo || "") : "",
      last: clean(m.text).slice(0, 80), texts: (ctx.inbox || []).filter((x) => fold(x.who) === k).map((x) => x.text) });
  }
  // a group by its own name ("send to the Family group")
  for (const m of msgs) if (m.group && m.convo) { const k = fold(m.convo); if (!out.has(k)) out.set(k, { name: clean(m.convo), key: m.key || null, app: m.app || "", canReply: !!m.canReply, isGroup: true, last: clean(m.text).slice(0, 80), texts: [] }); }
  for (const [k, v] of Object.entries(ctx.people || {})) if (k[0] !== "~" && !out.has(fold(v && v.name)) && v && v.name) out.set(fold(v.name), { name: v.name, key: null, app: v.app || "", canReply: false, texts: [] });
  return [...out.values()];
}
/** A name's sound skeleton, the same for «سمير» and "Samir", «أحمد» and "Ahmed": consonants only, Arabic read the Franco way. */
export function skeleton(name) {
  let t = String(name || "").toLowerCase();
  if (AR.test(t)) t = toFranco(t);
  return t.replace(/7/g, "h").replace(/5/g, "kh").replace(/[23]/g, "").replace(/sh/g, "s").replace(/kh/g, "k").replace(/th|dh/g, "t").replace(/[^a-z ]/g, "")
    .split(" ").map((w) => w.replace(/[aeiouyw]/g, "").replace(/(.)\1+/g, "$1")).filter(Boolean).join(" ");
}
// a short name ("Ali", «علي» → one consonant) never matches by sound — only exactly or through ALIAS (Ali asked: "make sure it
// sends the correct contact")
const sameWord = (a, b) => { const x = skeleton(a), y = skeleton(b); return x.replace(/ /g, "").length >= 2 && x === y; };
/** "أحمد" / "ahmed" → the people it can mean (whole-word, Arabic letters folded; "Ahmed" matches "Ahmed Samir" and «أحمد سمير»). */
export function findPeople(name, ctx = {}) {
  const n = fold(name).replace(/^(ال|يا )/, "").trim(); if (!n) return [];
  const all = knownPeople(ctx);
  // a nickname learnt before («ماما» = "Fatma ❤️") points at exactly one contact
  const nick = aliasFor(ctx.people, name);
  if (nick) { const hit = all.filter((p) => fold(p.name) === fold(nick)); if (hit.length) return hit; }
  const exact = all.filter((p) => fold(p.name) === n);
  if (exact.length) return exact;
  const re = new RegExp("(^|\\s)" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|\\s)");
  return all.filter((p) => re.test(fold(p.name)) || (ALIAS[n] || []).some((a) => re.test(fold(p.name)) || fold(p.name).includes(a))
    || n.split(" ").every((w) => clean(p.name).split(" ").some((pw) => sameWord(w, pw))));
}
// the same person written two ways (Latin ↔ Arabic) and family words
const ALIAS = { "احمد": ["ahmed", "ahmad"], "ahmed": ["احمد"], "محمد": ["mohamed", "mohammed", "muhammad"], "mohamed": ["محمد"], "ماما": ["mama", "mom", "mum", "امي"], "mama": ["ماما"], "mom": ["ماما", "mama"],
  "بابا": ["baba", "dad", "ابويا"], "baba": ["بابا"], "dad": ["بابا", "baba"], "علي": ["ali"], "ali": ["علي"], "سارة": ["sara", "sarah"], "ساره": ["sara", "sarah"], "sara": ["ساره"], "خالد": ["khaled", "khalid"], "khaled": ["خالد"] };

// ---- reading one sentence --------------------------------------------------------------------------------------------------------
const SEND_AR = new RegExp("^(?:يا اتيون[،,]?\\s*)?(?:لو سمحت\\s+)?(?:" + [
  "ابعت(?:ل[هي]?|لها|لهم)?", "ابعث", A + "رسل", "راسل", "بعات", "بعتل[وه]", "صيفط", "قولها", "قوله", "قولي ل(?=\\S)", "قول", "بلغ", "بلّغ", "علم", "علّم", "خبر", "خبّر", "عرف", "عرّف",
].join("|") + ")(?:\\s+(?:رساله|رسالة|مسج|ماسدج|مسدج|كلمه|كلمة))?\\s*(?:ل|لـ|الى|إلى|على)?\\s*", "u");
const SEP_AR = /\s+(?:وقول(?:ه|ها|لو|له)?|قول(?:ه|ها|لو|له)|ان(?:ي|ه|ها|و|نا)?|إن(?:ي|ه|ها|و|نا)?|انو|إنو|بان|بأن|بإن|بلي|بلّي|إني|اني|يقول|تقول|وقل[ه]?|:)\s+/u;
const SEND_EN = /^(?:(?:hey |ok |okay )?attune[,]?\s*)?(?:please\s+)?(?:send(?: a)?(?: message| text| whatsapp)?(?: to)?|text|message|whatsapp|tell|let|write to|msg)\s+/i;
// Voice 2.2 (global): Turkish, Spanish, French
const SEND_TR = /^(?:lütfen\s+)?(\S+?)(?:'?(?:e|a|ye|ya))\s+(?:mesaj\s+)?(?:at|gönder|yaz|söyle|de)\s*(?:ki|:)?\s+(.+)$/iu;
const SEND_ES = /^(?:por favor\s+)?(?:dile|dígale|digale|manda(?: un mensaje)?|envía(?: un mensaje)?|envia(?: un mensaje)?|escríbele|escribele|avisa)\s+(?:a\s+)?(.+?)\s+(?:que|diciendo(?: que)?|:)\s+(.+)$/iu;
const SEND_FR = /^(?:s'il te plaît\s+)?(?:dis|envoie(?: un message)?|écris|ecris|préviens|previens)\s+(?:à|a|au)\s+(.+?)\s+(?:que|qu'|pour dire que|:)\s*(.+)$/iu;
const WHO_INTL = /(?:^|[\s¿])(kim (?:mesaj attı|yazdı|aradı)|yeni mesaj var mı|mesajlarımı oku|quién me (?:escribió|escribio|mandó|mando)|tengo mensajes|lee mis mensajes|qui m'a écrit|qui m'a ecrit|j'ai des messages|lis mes messages)(?=$|[\s?.!])/iu;
const YES_INTL = /^(?:evet|gönder|tamam|olur|sí|si|envía|envialo|envíalo|vale|claro|oui|envoie|envoie-le|d'accord|ok d'accord|haan|bhejo|theek hai)[.!]?$/iu;
const NO_INTL = /^(?:hayır|hayir|iptal|vazgeç|no|cancela|nada|non|annule|laisse tomber|nahi|mat bhejo)[.!]?$/iu;
const SEP_EN = /\s+(?:that|saying|and say|and tell (?:him|her|them)|know that|know|:|,)\s+/i;
const WHO = /\b(who (?:messaged|texted|wrote|called)( me)?|any (?:new )?messages|read (?:me )?my messages|my messages|what did i miss|new messages)\b|^(?:مين|منو|شكون|مين اللي)\s+(?:بعت|بعتلي|كلمني|راسلني|ارسل|ارسلي|صيفط)|(?:في|فيه|في اي|اي)\s+رسا[يئ]ل|(?:اقرا|اقرالي|اقري|اقرأ|اقرأ لي)\s+(?:لي\s+)?(?:ال)?رسا[يئ]ل|^رسا[يئ]لي|شو في رسا[يئ]ل|شو صار|kya koi message|koi message/i;
const READ_AR = /^(?:اقرا|اقرالي|اقرأ|اقرأ لي|اقري)\s+(?:لي\s+)?(?:رساله|رسالة|رسايل|رسائل|مسج)\s+(.+)$/u;
const SAID_AR = /^(.+?)\s+(?:(?:قال|قالت|بعت|بعتت|كتب|كتبت)\s+(?:ايه|إيه|ايش|إيش|شو|اش|إش)|(?:شو|ايش|إيش|ايه|إيه|اش)\s+(?:قال|قالت|بعت|بعتت|كتب|كتبت))\s*[؟?]?$/u;
const READ_EN = /^(?:what did|what has)\s+(.+?)\s+(?:say|write|send|text)\b|^read\s+(.+?)(?:'s)?\s+messages?$/i;
const REPLY_AR = /^(?:رد|ردّ|رد علي|جاوب)\s*(?:عليها|عليهم|عليه|علي|على|ع)?\s*(.*)$/u;
const REPLY_EN = /^(?:reply|respond|answer|write back)(?:\s+to\s+(him|her|them|[^,]+?))?(?:\s+(?:saying|that|with|:))?\s+(.*)$/i;
const YES = /^(?:ابعت(?:ها|ه)?|ابعتها|ارسل(?:ها)?|أرسل(?:ها)?|بعتها|صيفط(?:ها)?|واخا|ايوا|يب|اوكيه|ايوه|أيوه|ايوا|اه|آه|ايه|إيه|اي|إي|نعم|تمام|ماشي|اوكي|أوكي|يلا|اكيد|أكيد|صح|زين|اوك|wakha|haan|ha|yes|yeah|yep|yup|ok|okay|sure|send(?: it)?|go(?: ahead)?|do it|correct|right|بالظبط|عادي ابعت)[.!]?$/i;
const NO = /^(?:لا لا|ما بدي|مابدي|لا ما تبعت|لا ما ترسل|لا متبعتش|بلا|لا|لأ|لاء|بلاش|الغي|إلغي|الغيها|كنسل|لا خلاص|خلاص لا|stop|cancel|no|nope|don't|dont|nahi|la2|la)[.!]?$/i;
const CHANGE = /^(?:غيرها|غيّرها|غير|غيّر|خليها|خليه|اكتب|اكتبها|بدلها|change(?: it)?(?: to)?|make it|instead say|say)\s*(?:ل|لـ|to|:)?\s*(.+)$/iu;
const FORMAL = /(?:اكتبها|خليها|اكتبه)\s+(?:بأدب|بادب|رسمي|رسميه|ألطف|الطف)|make it (?:formal|polite|nicer|professional)/i;
const APP = [["whatsapp", /\s+(?:على|ع|عن طريق|في|via|on|by)\s+(?:ال)?(?:واتس(?: ?اب)?|whats ?app)(?=\s|$)/iu], ["telegram", /\s+(?:على|ع|on|via)\s+(?:ال)?(?:تليجرام|telegram)(?=\s|$)/iu], ["messenger", /\s+(?:على|ع|on|via)\s+(?:ال)?(?:ماسنجر|messenger)(?=\s|$)/iu], ["sms", /\s+(?:رساله عاديه|sms|text message)(?=\s|$)/iu]];

/** Split "NAME SEP MESSAGE" (SEP optional) — the name is the longest run of words that names someone it knows, else one word. */
function nameAndMessage(rest, sep, ctx) {
  let s = clean(rest), app = "";
  for (const [id, re] of APP) if (re.test(s)) { app = id; s = s.replace(re, " ").replace(/\s+/g, " ").trim(); }
  const m = sep.exec(" " + s);
  if (m) { const nm = s.slice(0, m.index - 1 + 1).trim(), msg = s.slice(m.index - 1 + m[0].length).trim(); if (nm && nm.split(" ").length <= 4) return { name: nm.replace(/^ل(?=\S)/, ""), msg, app, sep: m[0].trim() }; }
  const words = s.split(" ");
  for (let k = Math.min(3, words.length - 1); k >= 1; k--) { const nm = words.slice(0, k).join(" ").replace(/^ل(?=\S)/, ""); if (findPeople(nm, ctx).length) return { name: nm, msg: words.slice(k).join(" "), app }; }
  return { name: words[0].replace(/^ل(?=\S)/, ""), msg: words.slice(1).join(" "), app };
}
/** The message as the person means it: «إني هتأخر» → «هتأخر»; "that I'm late" → "I'm late"; quotes and a final "please" off. */
export function messageOf(msg, sep = "") {
  let t = stripEnd(clean(msg)).replace(/^(?:إن|ان|إني|اني|انه|إنه|انها|إنها|انو|إنو|بلي|بلّي)\s+/u, "").replace(/^(?:that|saying)\s+/i, "");
  if (/^(?:ي|ني)$/.test(sep.replace(/^(?:ان|إن)/, ""))) t = t; // «إني …» already reads as from me
  return t.replace(/\s+(?:please|لو سمحت)$/i, "").trim();
}

/** One sentence → a command (no state). */
export function parseVoice(said, ctx = {}) {
  const raw = clean(said); if (!raw) return { kind: "none" };
  const t = raw.replace(/^(?:يا اتيون|يا أتيون|hey attune|ok attune|attune)[،,]?\s*/i, "");
  const f = fold(t);
  if (FORMAL.test(t)) return { kind: "formal" };
  const lg = langAnswer(t); if (lg && t.split(/\s+/).length <= 3) return { kind: "lang", lang: lg, always: /دايما|دايمًا|دائما|always/i.test(t) };
  if (YES.test(f) || YES.test(t) || YES_INTL.test(t)) return { kind: "yes" };
  if (NO.test(f) || NO.test(t) || (NO_INTL.test(t) && !/^no\b.+/i.test(t))) return { kind: "no" };
  const ch = CHANGE.exec(t); if (ch && !SEND_AR.test(t) && !SEND_EN.test(t)) return { kind: "change", msg: messageOf(ch[1]) };
  if (WHO.test(t) || WHO.test(f) || WHO_INTL.test(t)) return { kind: "who" };
  let m;
  if ((m = READ_AR.exec(t))) return { kind: "read", from: stripEnd(m[1]) };
  if ((m = SAID_AR.exec(t)) && m[1].split(" ").length <= 3) return { kind: "read", from: m[1] };
  if ((m = READ_EN.exec(t))) return { kind: "read", from: stripEnd(m[1] || m[2]) };
  if ((m = /^(?:reply|respond|answer|write back)\b/i.test(t) && REPLY_EN.exec(t))) {
    const who = m[1] && !/^(him|her|them)$/i.test(m[1]) ? m[1].trim() : null;
    return { kind: "reply", to: who, msg: messageOf(m[2]) };
  }
  if ((m = REPLY_AR.exec(t)) && /^(?:رد|ردّ|جاوب)/.test(t)) {
    let rest = m[1].trim(), to = null;
    const named = /^(?:على|ع)\s+/.test(t.slice(t.indexOf(m[1]) - 4)) || (!/^(?:قول|إن|ان|إني|اني)/.test(rest) && /^على|^ع /.test(t.replace(/^(?:رد|ردّ|جاوب)\s*/, "")));
    if (named) { const nm = nameAndMessage(rest, SEP_AR, ctx); to = nm.name; rest = nm.msg; }
    rest = rest.replace(/^(?:وقول(?:ه|ها)?|قول(?:ه|ها|له|لها))\s+/u, "");
    return { kind: "reply", to, msg: messageOf(rest) };
  }
  // Hinglish: "Ahmed ko bolo ki main late hoon"
  if ((m = /^(.+?)\s+ko\s+(?:bolo|bol do|batao|bata do|message karo|msg karo|bhejo)\s+(?:ki\s+)?(.+)$/i.exec(t))) return { kind: "send", to: m[1].trim(), msg: messageOf(m[2]), app: "" };
  if (AR.test(t) && SEND_AR.test(t)) {
    const v = SEND_AR.exec(t)[0], rest = t.slice(v.length);
    // «قوله …» / «ابعتله …» with no name: the person talked about last
    if (/(?:قوله|قولها|ابعتله|ابعتلها|ابعتلهم)\s*$/.test(v.trim()) || !rest.trim()) return { kind: "send", to: null, msg: messageOf(rest), app: "" };
    const nm = nameAndMessage(rest, SEP_AR, ctx);
    return { kind: "send", to: nm.name, msg: messageOf(nm.msg, nm.sep), app: nm.app };
  }
  if (!AR.test(t) && (m = SEND_ES.exec(t) || SEND_FR.exec(t))) return { kind: "send", to: m[1].trim(), msg: messageOf(m[2]), app: "" };
  if (!AR.test(t) && !SEND_EN.test(t) && (m = SEND_TR.exec(t))) return { kind: "send", to: m[1].replace(/'$/, "").trim(), msg: messageOf(m[2]), app: "" };
  if (!AR.test(t) && SEND_EN.test(t) && !/^(?:tell|let) me\b/i.test(t)) {
    // "send Omar a whatsapp that …" / "send Omar a message saying …"
    let rest = t.replace(SEND_EN, ""), app0 = "";
    const am = /^(\S+(?:\s+[A-Z]\S*)?)\s+an?\s+(whatsapp|message|text|msg|telegram)\b\s*/i.exec(rest);
    if (am) { app0 = /whatsapp/i.test(am[2]) ? "whatsapp" : /telegram/i.test(am[2]) ? "telegram" : ""; rest = am[1] + " " + rest.slice(am[0].length); }
    const nm = nameAndMessage(rest, SEP_EN, ctx);
    return { kind: "send", to: nm.name, msg: messageOf(nm.msg), app: nm.app || app0 };
  }
  return { kind: "pass", text: raw };
}

// ---- the conversation ------------------------------------------------------------------------------------------------------------
const LINES = {
  en: { who: "Who should I send it to?", what: "What should I tell {n}?", lang: "Arabic, Franco or English?", which: "Which {n}? {list}", none: "No new messages.",
    readback: "To {n}: “{m}”. Send it?", sent: "Sent to {n}.", cancelled: "Cancelled — nothing was sent.", nobody: "I don't see {n} in your recent chats — I'll open {app} with the message ready, you pick them.",
    noLast: "Reply to whom? Say the name.", noRead: "No recent message from {n}.", from: "{n} on {app}: “{m}”", count: "{k} messages. ", formal: "I'll write it more politely — check it before it goes.",
    translate: "I'll put it in English — check it before it goes.", saved: "{n} gets {l} from now on.", whois: "Who is “{n}”?", other: "Someone else" },
  ar: { who: "أبعتها لمين؟", what: "أقول لـ{n} إيه؟", lang: "أبعتها عربي ولا فرانكو؟", which: "أنهي {n}؟ {list}", none: "مفيش رسايل جديدة.",
    readback: "لـ{n}: «{m}». أبعت؟", sent: "اتبعتت لـ{n}.", cancelled: "اتلغت — مابعتش حاجة.", nobody: "مش لاقي {n} في المحادثات الأخيرة — هفتحلك {app} والرسالة جاهزة، وإنت اختاره.",
    noLast: "أرد على مين؟ قول الاسم.", noRead: "مفيش رسالة جديدة من {n}.", from: "{n} على {app}: «{m}»", count: "{k} رسايل. ", formal: "هكتبها بأدب أكتر — راجعها قبل ما تتبعت.",
    translate: "هحطها بالإنجليزي — راجعها قبل ما تتبعت.", saved: "{n} هيوصله {l} من هنا ورايح.", whois: "مين «{n}»؟", other: "حد تاني" },
};
// Voice 2.2: Attune answers in the person's own dialect (from their country: Gulf, Levantine, Darija); the rest falls back to Egyptian
const DIALECT = {
  gulf: { who: "أرسلها لمين؟", what: "شنو أقول لـ{n}؟", lang: "أرسلها عربي ولا فرانكو؟", which: "أي {n}؟ {list}", none: "ما في رسايل جديدة.", readback: "لـ{n}: «{m}». أرسلها؟",
    sent: "انرسلت لـ{n}.", cancelled: "تم الإلغاء — ما أرسلت شي.", nobody: "ما لقيت {n} في المحادثات الأخيرة — بفتح لك {app} والرسالة جاهزة، وأنت اختاره.", noLast: "أرد على مين؟ قول الاسم.",
    noRead: "ما في رسالة جديدة من {n}.", count: "{k} رسايل. ", whois: "مين «{n}»؟", other: "شخص ثاني" },
  lev: { who: "لمين بدك ابعتها؟", what: "شو بدي قول لـ{n}؟", lang: "بعتها عربي ولا فرانكو؟", which: "أي {n}؟ {list}", none: "ما في رسايل جديدة.", readback: "لـ{n}: «{m}». بعتها؟",
    sent: "انبعتت لـ{n}.", cancelled: "انلغت — ما بعتت شي.", nobody: "ما لقيت {n} بالمحادثات الأخيرة — رح افتحلك {app} والرسالة جاهزة، وإنت اختارو.", noLast: "رد على مين؟ قول الاسم.",
    noRead: "ما في رسالة جديدة من {n}.", count: "{k} رسايل. ", whois: "مين «{n}»؟", other: "حدا تاني" },
  maghreb: { who: "نصيفطها لمن؟", what: "شنو نقول لـ{n}؟", lang: "نصيفطها بالعربية ولا فرانكو؟", which: "شمن {n}؟ {list}", none: "ما كاين حتى ميساج جديد.", readback: "لـ{n}: «{m}». نصيفطها؟",
    sent: "تصيفطات لـ{n}.", cancelled: "تلغات — ما صيفطت والو.", nobody: "ما لقيتش {n} فالمحادثات الأخيرة — غادي نحل ليك {app} والميساج واجد، وختارو نتا.", noLast: "نجاوب شكون؟ قول السمية.",
    noRead: "ما كاين حتى ميساج جديد من {n}.", count: "{k} ميساجات. ", whois: "شكون «{n}»؟", other: "شي واحد آخر" },
};
const linesFor = (ui, style) => (ui === "ar" ? { ...LINES.ar, ...(DIALECT[style] || {}) } : LINES[ui] || LINES.en);
LINES.tr = { ...LINES.en, who: "Kime göndereyim?", what: "{n}'e ne söyleyeyim?", which: "Hangi {n}? {list}", none: "Yeni mesaj yok.", readback: "{n}'e: “{m}”. Göndereyim mi?",
  sent: "{n}'e gönderildi.", cancelled: "İptal edildi — hiçbir şey gönderilmedi.", nobody: "Son sohbetlerde {n} yok — {app} mesaj hazır açılıyor, kişiyi sen seç.", noLast: "Kime cevap vereyim? İsmini söyle.",
  noRead: "{n}'den yeni mesaj yok.", from: "{app} üzerinden {n}: “{m}”", count: "{k} mesaj. ", whois: "“{n}” kim?", other: "Başka biri" };
LINES.es = { ...LINES.en, who: "¿A quién se lo envío?", what: "¿Qué le digo a {n}?", which: "¿Qué {n}? {list}", none: "No hay mensajes nuevos.", readback: "Para {n}: “{m}”. ¿Lo envío?",
  sent: "Enviado a {n}.", cancelled: "Cancelado — no se envió nada.", nobody: "No veo a {n} en tus chats recientes — abro {app} con el mensaje listo y tú eliges a la persona.", noLast: "¿A quién respondo? Dime el nombre.",
  noRead: "No hay mensajes nuevos de {n}.", from: "{n} en {app}: “{m}”", count: "{k} mensajes. ", whois: "¿Quién es “{n}”?", other: "Otra persona" };
LINES.fr = { ...LINES.en, who: "À qui je l'envoie ?", what: "Qu'est-ce que je dis à {n} ?", which: "Quel {n} ? {list}", none: "Pas de nouveaux messages.", readback: "À {n} : « {m} ». Je l'envoie ?",
  sent: "Envoyé à {n}.", cancelled: "Annulé — rien n'a été envoyé.", nobody: "Je ne vois pas {n} dans tes discussions récentes — j'ouvre {app} avec le message prêt, choisis la personne.", noLast: "Je réponds à qui ? Dis le nom.",
  noRead: "Pas de nouveau message de {n}.", from: "{n} sur {app} : « {m} »", count: "{k} messages. ", whois: "Qui est « {n} » ?", other: "Quelqu'un d'autre" };
const LANG_NAME = { en: { ar: "Arabic", franco: "Franco", en: "English" }, ar: { ar: "عربي", franco: "فرانكو", en: "إنجليزي" } };
LANG_NAME.tr = LANG_NAME.es = LANG_NAME.fr = LANG_NAME.en;
const APP_NAME = { whatsapp: "WhatsApp", telegram: "Telegram", messenger: "Messenger", signal: "Signal", instagram: "Instagram", sms: "SMS" };
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? v[k] : ""));
/** The language Attune answers in: Arabic when spoken in Arabic (or Franco), else English. */
const TR_W = /\b(mesaj|gönder|söyle|kim|evet|hayır|tamam|lütfen)\b|[ğış]/i, ES_W = /\b(dile|manda|envía|envia|quién|mensajes?|diciendo|sí|vale|cancela)\b|[ñ¿¡]/i, FR_W = /\b(dis|envoie|écris|qui|messages?|oui|non|annule|d'accord|à)\b|[çàèù]/i;
export const replyLang = (said, prev = "en") => (AR.test(said || "") || isFranco(said || "") ? "ar" : TR_W.test(said || "") ? "tr" : ES_W.test(said || "") ? "es" : FR_W.test(said || "") && !/^(?:no|ok|yes)$/i.test(said || "") ? "fr" : /[a-z]/i.test(said || "") ? "en" : prev);
export const newVoiceState = () => ({ step: "idle", draft: null, last: null, ui: "en" });

/** The message in the chosen language: Arabic words → Franco in the person's region style; English needs a translation. */
export function prepare(msg, lang, style = "eg") {
  if (lang === "same") return { text: msg, needs: null };
  if (lang === "franco") return { text: AR.test(msg) ? toFranco(msg, style) : msg, needs: null };
  if (lang === "en" && AR.test(msg)) return { text: msg, needs: "translate" };
  return { text: msg, needs: null };
}

/**
 * One turn. ctx = { inbox: [{key, app, who, text, ts, canReply}], people: {…franco.js memory}, style: "eg" | "gulf" | "lev" |
 * "maghreb", defaultApp: "whatsapp" }. → { state, say, card, action?, people? }
 *   card  = what the screen shows: { kind: "ask" | "readback" | "messages" | "done", … }
 *   action = { kind: "send", key, app, to, text } (a reply through the app's own notification, or the app opened with the text)
 *          | { kind: "pass", text } (the Home box / Chat takes it)
 */
export function voiceTurn(state0, said, ctx = {}) {
  const state = { ...(state0 || newVoiceState()) };
  // while a question is open (which person, which language, send?) the conversation keeps its language — tapping "Ahmed Samir"
  // on an Arabic conversation must not switch it to English
  const ui = state.ui = state.step !== "idle" && state.ui ? state.ui : replyLang(said, state.ui || "en");
  const L = linesFor(ui, ctx.style), LN = LANG_NAME[ui];
  const c = parseVoice(said, ctx);
  const out = (o) => ({ state, ...o });
  const ask = (q, extra = {}) => out({ say: q, card: { kind: "ask", q, ...extra } });

  // a new command ("tell Sara…", "who messaged me") leaves an unanswered question behind
  if (state.step !== "idle" && state.step !== "msg" && ["send", "who", "read", "reply"].includes(c.kind) && !(state.step === "who" && c.kind === "send" && !c.msg)) { state.step = "idle"; state.draft = null; }
  // ---- answers inside a conversation ----
  if (state.step === "pick" && state.draft) {
    const opts = state.draft.options || [];
    const k = /اول|الأول|first|1|واحد/i.test(said) ? 0 : /تاني|التاني|second|2|اتنين/i.test(said) ? 1 : /تالت|third|3/i.test(said) ? 2
      : opts.findIndex((p) => clean(said).split(" ").some((w) => clean(p.name).split(" ").slice(state.draft.nick ? 0 : 1).some((pw) => sameWord(w, pw) || fold(w) === fold(pw))));
    if (state.draft.nick && /حد تاني|شخص ثاني|حدا تاني|شي واحد آخر|someone else|none|مش منهم|ولا واحد|غيرهم/i.test(said)) {
      state.draft = { ...state.draft, target: { name: state.draft.name, key: null, app: "" }, options: null, nick: false }; return next(state, ctx, ui);
    }
    if (k >= 0 && opts[k]) {
      const o = opts[k];
      // a nickname answered once is remembered («ماما» = "Fatma ❤️")
      const people = state.draft.nick ? rememberAlias(ctx.people || {}, state.draft.name, o.name) : null;
      state.draft = { ...state.draft, target: { name: o.name, key: o.canReply ? o.key : null, app: o.app, texts: o.texts, last: o.last || "", group: o.group || "", isGroup: !!o.isGroup }, options: null, nick: false };
      if (people) { const r = next(state, { ...ctx, people }, ui); return { ...r, people: r.people || people }; }
      return next(state, ctx, ui);
    }
    if (c.kind === "no") { state.step = "idle"; state.draft = null; return out({ say: L.cancelled, card: { kind: "done", ok: false } }); }
    return ask(fill(L.which, { n: state.draft.name, list: opts.map((p) => p.name).join(ui === "ar" ? " ولا " : " or ") }), { options: opts.map((p) => p.name) });
  }
  if (state.step === "who" && state.draft && c.kind !== "no") { state.draft = { ...state.draft, name: stripEnd(said) }; return resolve(state, ctx, ui); }
  if (state.step === "msg" && state.draft && c.kind !== "no") { state.draft = { ...state.draft, msg: messageOf(c.kind === "change" ? c.msg : said) }; return next(state, ctx, ui); }
  if (state.step === "lang" && state.draft) {
    const lg = c.kind === "lang" ? c.lang : langAnswer(said);
    if (lg) {
      const people = rememberLang(ctx.people || {}, state.draft.target.name, lg, { name: state.draft.target.name, app: state.draft.target.app || "" });
      state.draft = { ...state.draft, lang: lg };
      const r = next(state, { ...ctx, people }, ui);
      return { ...r, people };
    }
    if (c.kind === "no") { state.step = "idle"; state.draft = null; return out({ say: L.cancelled, card: { kind: "done", ok: false } }); }
    return ask(L.lang, { options: ["ar", "franco", "en"].map((x) => LN[x]) });
  }
  if (state.step === "confirm" && state.draft) {
    if (c.kind === "yes") {
      const d = state.draft, tg = d.target || {};
      state.step = "idle"; state.last = { name: tg.name, key: tg.key, app: tg.app }; state.draft = null;
      const app = d.app || tg.app || ctx.defaultApp || "whatsapp";
      return out({ say: tg.key ? fill(L.sent, { n: tg.name }) : fill(L.nobody, { n: tg.name, app: APP_NAME[app] || app }),
        card: { kind: "done", ok: true, to: tg.name, text: d.text }, action: { kind: "send", key: tg.key || null, app, to: tg.name, text: d.text, lang: d.lang } });
    }
    if (c.kind === "no") { state.step = "idle"; state.draft = null; return out({ say: L.cancelled, card: { kind: "done", ok: false } }); }
    if (c.kind === "change") { state.draft = { ...state.draft, msg: c.msg }; return next(state, ctx, ui); }
    if (c.kind === "lang") { state.draft = { ...state.draft, lang: c.lang }; const people = rememberLang(ctx.people || {}, state.draft.target.name, c.lang, { name: state.draft.target.name }); return { ...next(state, { ...ctx, people }, ui), people }; }
    if (c.kind === "formal") { state.draft = { ...state.draft, needs: "formal" }; return out({ say: L.formal, card: { kind: "readback", to: state.draft.target.name, text: state.draft.text, lang: state.draft.lang, needs: "formal" } }); }
    // anything else while confirming = new words for the message
    if (c.kind === "pass") { state.draft = { ...state.draft, msg: messageOf(said) }; return next(state, ctx, ui); }
  }

  // ---- a new command ----
  if (c.kind === "who") {
    const msgs = (ctx.inbox || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 5);
    if (!msgs.length) return out({ say: L.none, card: { kind: "messages", items: [] } });
    state.last = { name: clean(msgs[0].who), key: msgs[0].key || null, app: msgs[0].app || "" };
    const say = fill(L.count, { k: msgs.length }) + msgs.slice(0, 3).map((m) => fill(L.from, { n: clean(m.who), app: APP_NAME[m.app] || m.app || "", m: clean(m.text).slice(0, 120) })).join(ui === "ar" ? "، " : "; ");
    return out({ say, card: { kind: "messages", items: msgs } });
  }
  if (c.kind === "read") {
    const ps = findPeople(c.from, ctx), p = ps[0];
    const msgs = p ? (ctx.inbox || []).filter((m) => fold(m.who) === fold(p.name)).sort((a, b) => (b.ts || 0) - (a.ts || 0)) : [];
    if (!msgs.length) return out({ say: fill(L.noRead, { n: c.from }), card: { kind: "messages", items: [] } });
    state.last = { name: p.name, key: msgs[0].key || null, app: msgs[0].app || "" };
    return out({ say: msgs.slice(0, 3).reverse().map((m) => fill(L.from, { n: p.name, app: APP_NAME[m.app] || m.app || "", m: clean(m.text).slice(0, 160) })).join(ui === "ar" ? "، " : "; "), card: { kind: "messages", items: msgs.slice(0, 3) } });
  }
  if (c.kind === "send" || c.kind === "reply") {
    const name = c.to || (state.last && state.last.name) || null;
    state.draft = { name, msg: c.msg || "", app: c.app || "", lang: null, target: null };
    if (!name) { state.step = "who"; return ask(c.kind === "reply" ? L.noLast : L.who); }
    if (!c.to && state.last) state.draft.target = { name: state.last.name, key: state.last.key, app: state.last.app };
    return state.draft.target ? next(state, ctx, ui) : resolve(state, ctx, ui);
  }
  if (c.kind === "yes" || c.kind === "no" || c.kind === "lang" || c.kind === "change" || c.kind === "formal") return out({ say: "", card: null, action: { kind: "pass", text: clean(said) } });
  return out({ say: "", card: null, action: { kind: "pass", text: clean(said) } });

  function resolve(st, cx, u) {
    const Lx = linesFor(u, cx.style);
    const ps = findPeople(st.draft.name, cx);
    if (ps.length > 1 && new Set(ps.map((p) => fold(p.name))).size > 1) {
      st.step = "pick"; st.draft = { ...st.draft, options: ps.slice(0, 3) };
      const q = fill(Lx.which, { n: st.draft.name, list: ps.slice(0, 3).map((p) => p.name).join(u === "ar" ? " ولا " : " or ") });
      return { state: st, say: q, card: { kind: "ask", q, options: ps.slice(0, 3).map((p) => p.name) } };
    }
    // nobody by that name, but recent chats exist: a nickname? ask who it is (and learn it), with "someone else" too
    if (!ps.length && knownPeople(cx).filter((p) => !p.isGroup).length) {
      const opts = knownPeople(cx).filter((p) => !p.isGroup).slice(0, 4);
      st.step = "pick"; st.draft = { ...st.draft, options: opts, nick: true };
      const q = fill(Lx.whois, { n: st.draft.name });
      return { state: st, say: q + " " + opts.map((p) => p.name).join(u === "ar" ? "، " : ", ") + (u === "ar" ? "، ولا " : ", or ") + Lx.other + "?", card: { kind: "ask", q, options: [...opts.map((p) => p.name), Lx.other] } };
    }
    st.draft = { ...st.draft, target: ps[0] ? { name: ps[0].name, key: ps[0].canReply ? ps[0].key : null, app: ps[0].app, texts: ps[0].texts, last: ps[0].last || "", group: ps[0].group || "", isGroup: !!ps[0].isGroup } : { name: st.draft.name, key: null, app: "" } };
    return next(st, cx, u);
  }
  function next(st, cx, u) {
    const Lx = linesFor(u, cx.style), LNx = LANG_NAME[u], d = st.draft;
    if (!d.msg) { st.step = "msg"; const q = fill(Lx.what, { n: d.target.name }); return { state: st, say: q, card: { kind: "ask", q } }; }
    // the Arabic / Franco / English question only when it means something: the person speaks Arabic, or the contact writes
    // Arabic or Franco; anyone else's message goes exactly as said (an English, Turkish, Spanish… speaker is never asked about Franco)
    const writes = styleOf(d.target.texts || []);
    const lang = d.lang || langFor(cx.people, d.target.name) || (u !== "ar" && writes !== "ar" && writes !== "franco" ? "same" : null);
    if (!lang) {
      st.step = "lang";
      const guess = styleOf(d.target.texts || []);
      const q = u === "ar" ? Lx.lang + (guess ? " (" + (guess === "franco" ? "هو بيكتب فرانكو" : guess === "en" ? "هو بيكتب إنجليزي" : "هو بيكتب عربي") + ")" : "") : Lx.lang + (guess ? " (they write in " + LNx[guess] + ")" : "");
      return { state: st, say: q, card: { kind: "ask", q, options: ["ar", "franco", "en"].map((x) => LNx[x]), suggest: guess } };
    }
    const p = prepare(d.msg, lang, cx.style || "eg");
    st.step = "confirm"; st.draft = { ...d, lang, text: p.text, needs: p.needs };
    const q = (p.needs === "translate" ? Lx.translate + " " : "") + fill(Lx.readback, { n: d.target.name, m: p.text });
    // the card names exactly who gets it: the full name, the app, their last message — and a group as a group
    return { state: st, say: q, card: { kind: "readback", to: d.target.name, text: p.text, lang, needs: p.needs, app: d.app || d.target.app || cx.defaultApp || "whatsapp", direct: !!d.target.key,
      last: d.target.last || "", isGroup: !!d.target.isGroup, onlyInGroup: d.target.group || "" } };
  }
}
