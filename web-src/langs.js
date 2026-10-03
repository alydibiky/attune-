/* ---- the 12 chat languages (v6.12) ----------------------------------------------------------------------------------------------------
   Ali: "add the most popular 12 languages to the chat, so a Spanish person can write in Spanish".
   English, Mandarin Chinese, Hindi, Spanish, French, Arabic, Bengali, Portuguese, Russian, Urdu, Indonesian, German.
   What this file does, all by code (no model needed): finds the language a person wrote in, says which way it runs (right-to-left for Arabic
   and Urdu), gives the language tags the phone's voice input and read-aloud use, and writes the one rule the model must follow:
   answer in the language the person used. The same file is used by the chat, the read-aloud button and the model tests.            */

export const LANGS = {
  en: { name: "English",    native: "English",    tag: "en-US", rtl: false },
  zh: { name: "Chinese",    native: "中文",        tag: "zh-CN", rtl: false },
  hi: { name: "Hindi",      native: "हिन्दी",       tag: "hi-IN", rtl: false },
  es: { name: "Spanish",    native: "Español",    tag: "es-ES", rtl: false },
  fr: { name: "French",     native: "Français",   tag: "fr-FR", rtl: false },
  ar: { name: "Arabic",     native: "العربية",    tag: "ar-EG", rtl: true },
  bn: { name: "Bengali",    native: "বাংলা",       tag: "bn-BD", rtl: false },
  pt: { name: "Portuguese", native: "Português",  tag: "pt-BR", rtl: false },
  ru: { name: "Russian",    native: "Русский",    tag: "ru-RU", rtl: false },
  ur: { name: "Urdu",       native: "اردو",       tag: "ur-PK", rtl: true },
  id: { name: "Indonesian", native: "Bahasa Indonesia", tag: "id-ID", rtl: false },
  de: { name: "German",     native: "Deutsch",    tag: "de-DE", rtl: false },
};
export const LANG_CODES = Object.keys(LANGS);

// words that are very common in one Latin-script language and rare in the others
const STOP = {
  en: "the and is are was were be been being am you your yours with that this these those for what how can could please have has had not from they them will would should about there their which when where why who whom it's i'm don't doesn't a an to of in on at by as or if so up me my we us our he she him her his its do does did give make write tell show explain list name get take find use help need want know think say go see look come put set run build create send read open close start stop than then too just only also very much many some any all each more most other into over after before between through here now today tomorrow yesterday",
  es: "el la los las una un es son está están que qué cómo cuál cuándo dónde por para con sin pero muy también más tengo quiero puedes puedo hola gracias favor del al esto esta eso yo tú usted nosotros",
  fr: "le la les un une des est sont que qui quoi comment pourquoi avec pour dans sur mais très aussi plus je tu il nous vous bonjour merci s'il c'est j'ai du au ce cette ces",
  pt: "o os as um uma é são está estão que qual como quando onde por para com sem mas muito também mais eu você nós olá obrigado favor do da dos das não isso isto tenho quero posso",
  de: "der die das ein eine ist sind und oder nicht ich du sie wir ihr was wie warum wann wo mit für auf aber sehr auch mehr bitte danke hallo kann können habe möchte den dem des zu von",
  id: "yang dan di ke dari ini itu dengan untuk tidak ada saya kamu anda apa bagaimana kenapa kapan dimana bisa mau tolong terima kasih halo adalah akan sudah belum juga lebih sangat atau pada",
};
const STOPSETS = Object.fromEntries(Object.entries(STOP).map(([k, v]) => [k, new Set(v.split(/\s+/))]));
const DIAC = { es: /[ñ¿¡]/g, fr: /[àâçèêëîïôùûœ]/g, pt: /[ãõç]/g, de: /[äöüß]/g };

const count = (s, re) => (s.match(re) || []).length;
/** The language of a text, one of LANG_CODES (or "" when it is too short or has no letters). */
export function detectLang(text) {
  const s = String(text || "").replace(/https?:\/\/\S+/g, " ").replace(/[`*_#>|]/g, " ").slice(0, 600);
  const han = count(s, /[一-鿿]/g), kana = count(s, /[぀-ヿ]/g), hangul = count(s, /[가-힯]/g);
  const deva = count(s, /[ऀ-ॿ]/g), beng = count(s, /[ঀ-৿]/g), cyr = count(s, /[Ѐ-ӿ]/g), arab = count(s, /[؀-ۿݐ-ݿ]/g);
  const latin = count(s, /[A-Za-zÀ-ɏ]/g);
  const total = han + kana + hangul + deva + beng + cyr + arab + latin;
  if (!total) return "";
  const top = Math.max(han + kana, hangul, deva, beng, cyr, arab, latin);
  if (top === han + kana) return kana > han / 2 ? "ja" : "zh";
  if (top === hangul) return "ko";
  if (top === deva) return "hi";
  if (top === beng) return "bn";
  if (top === cyr) return "ru";
  if (top === arab) {
    // Urdu and Persian add letters Arabic does not use
    const ur = count(s, /[ٹڈڑںےھہۂۃ]/g), fa = count(s, /[پچژگ]/g);
    if (ur >= 1 || (fa >= 1 && /(?:^|\s)(?:اور|ہے|ہیں|کا|کی|کے|کو|سے|میں)(?:\s|$)/.test(s))) return "ur";
    if (fa >= 1 && /(?:^|\s)(?:است|که|را|می|این|با|برای|من)(?:\s|$)/.test(s)) return "fa";
    return "ar";
  }
  const words = s.toLowerCase().match(/[a-zà-ɏ'’]+/g) || [];
  if (words.length < 2 && s.length < 12) return "";
  const score = {};
  for (const k of Object.keys(STOP)) {
    let n = 0;
    for (const w of words) if (STOPSETS[k].has(w.replace(/’/g, "'"))) n++;
    if (DIAC[k]) n += count(s.toLowerCase(), DIAC[k]) * 0.7;
    score[k] = n;
  }
  // English is the default: another Latin-script language must show real evidence (two of its words, or accents) and beat English
  const ranked = Object.entries(score).filter(([k]) => k !== "en").sort((a, b) => b[1] - a[1]);
  const best = ranked[0];
  return best && best[1] >= 2 && best[1] > score.en ? best[0] : "en";
}

export const langName = (code) => (LANGS[code] ? LANGS[code].name : "");
export const isRtl = (code) => !!(LANGS[code] && LANGS[code].rtl) || code === "fa" || code === "he";
/** The tag the phone's voice input and read-aloud want for a language code ("" = let the phone choose). */
export function voiceTag(code, fallback = "") { return LANGS[code] ? LANGS[code].tag : code === "fa" ? "fa-IR" : code === "ja" ? "ja-JP" : code === "ko" ? "ko-KR" : fallback; }
/** The phone's own language when it is one of the 12 (navigator.language "es-MX" → "es"), else "". */
export function deviceLang(nav) {
  const l = String((nav && nav.language) || "").toLowerCase().split("-")[0];
  return LANGS[l] ? l : "";
}

// ---- "answer in French" / "responde en inglés": the language the person ASKS for beats the language they wrote in -----------------------
const NAMES = {
  en: "english|inglés|ingles|anglais|englisch|inglês|inglese|английском|английски|英语|英文|अंग्रेज़ी|अंग्रेजी|ইংরেজি|الإنجليزية|الانجليزية|الإنجليزي|الانجليزي|انجليزي|انگریزی|inggris",
  es: "spanish|español|espanol|espagnol|spanisch|espanhol|spagnolo|испанском|西班牙语|स्पेनिश|স্প্যানিশ|الإسبانية|الاسبانية|اسباني|ہسپانوی|spanyol",
  fr: "french|francés|frances|français|francais|französisch|francês|frances|французском|法语|法文|फ्रेंच|ফরাসি|الفرنسية|فرنساوي|فرنسي|فرانسیسی|prancis",
  pt: "portuguese|portugués|portugues|portugais|portugiesisch|portoghese|португальском|葡萄牙语|पुर्तगाली|পর্তুগিজ|البرتغالية|برتغالي|پرتگالی|portugis",
  de: "german|alemán|aleman|allemand|deutsch|alemão|alemao|tedesco|немецком|德语|जर्मन|জার্মান|الألمانية|الالمانية|الماني|جرمن|jerman",
  ru: "russian|ruso|russe|russisch|russo|русском|俄语|रूसी|রুশ|الروسية|روسي|روسی|rusia",
  zh: "chinese|chino|chinois|chinesisch|chinês|cinese|китайском|中文|汉语|漢語|चीनी|চীনা|الصينية|صيني|چینی|cina|mandarin",
  hi: "hindi|hindú|हिंदी|हिन्दी|হিন্দি|الهندية|هندي|ہندی",
  bn: "bengali|bengalí|bengali|bengalisch|bengalês|бенгальском|孟加拉语|बंगाली|বাংলা|البنغالية|بنغالي|بنگالی|benggala",
  ar: "arabic|árabe|arabe|arabisch|арабском|阿拉伯语|अरबी|আরবি|العربية|عربي|بالعربي|عربی",
  ur: "urdu|ourdou|урду|乌尔都语|उर्दू|উর্দু|الأردية|الاردية|أردو|اردو",
  id: "indonesian|indonesio|indonésien|indonesisch|indonésio|indonesiano|индонезийском|印尼语|इंडोनेशियाई|ইন্দোনেশিয়ান|الإندونيسية|اندونيسي|indonesia",
};
const ASK = Object.entries(NAMES).map(([c, n]) => [c, new RegExp("(?:^|[\\s,:;.(\"'«])(?:in|into|en|auf|em|na|no|nel|su|на|用|में|বাংলায়|بال|باللغة|باللغه|به|dalam|bahasa|ب|à|au)\\s+(?:the\\s+|la\\s+|el\\s+|le\\s+|اللغة\\s+)?(?:" + n + ")(?![\\p{L}])", "iu")]);
/** The language the text asks the answer to be in ("Responde en inglés" → "en"), or "". */
export function requestedLang(text) {
  const t = String(text || "").slice(0, 600);
  for (const [c, rx] of ASK) if (rx.test(t)) return c;
  if (/(?:^|\s)(?:بالعربي|بالانجليزي|بالإنجليزي|بالفرنساوي)(?!\p{L})/u.test(t)) return /عربي/.test(t) ? "ar" : /فرنساوي/.test(t) ? "fr" : "en";
  return "";
}

/**
 * The line added to the chat's instructions for the language of the latest message. English and Arabic are already covered by the base
 * prompt (Egyptian Arabic has its own rule); for the ten others the model is told the language BY NAME — small models drift to English
 * otherwise — and to keep names, numbers, code and quoted text as written.
 */
export function replyLanguageRule(text) {
  const asked = requestedLang(text);
  if (asked) return `The user asks for the answer in ${LANGS[asked].name}. Write your whole answer in ${LANGS[asked].name}, naturally. Keep names, numbers, code and quoted text exactly as written.`;
  const code = detectLang(text);
  if (!code || code === "en") return "";
  const name = LANGS[code] ? LANGS[code].name : code === "fa" ? "Persian" : code === "ja" ? "Japanese" : "Korean";
  return `The user is writing in ${name}. Write your whole answer in ${name}, in natural everyday ${name} (not a word-for-word translation of English). Do not switch to English unless they ask you to. Keep names, numbers, code and quoted text exactly as written.`;
}
