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
  en: "the and is are was you your with that this for what how can please have not from they will would about there their which when where why who it's i'm don't",
  es: "el la los las una un es son está están que qué cómo cuál cuándo dónde por para con sin pero muy también más tengo quiero puedes puedo hola gracias favor del al esto esta eso yo tú usted nosotros",
  fr: "le la les un une des est sont que qui quoi comment pourquoi avec pour dans sur mais très aussi plus je tu il nous vous bonjour merci s'il c'est j'ai du au ce cette ces",
  pt: "o a os as um uma é são está estão que qual como quando onde por para com sem mas muito também mais eu você nós olá obrigado favor do da dos das não isso isto tenho quero posso",
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
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : "en";
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

/**
 * The line added to the chat's instructions for the language of the latest message. English and Arabic are already covered by the base
 * prompt (Egyptian Arabic has its own rule); for the ten others the model is told the language BY NAME — small models drift to English
 * otherwise — and to keep names, numbers, code and quoted text as written.
 */
export function replyLanguageRule(text) {
  const code = detectLang(text);
  if (!code || code === "en") return "";
  const name = LANGS[code] ? LANGS[code].name : code === "fa" ? "Persian" : code === "ja" ? "Japanese" : "Korean";
  return `The user is writing in ${name}. Write your whole answer in ${name}, in natural everyday ${name} (not a word-for-word translation of English). Do not switch to English unless they ask you to. Keep names, numbers, code and quoted text exactly as written.`;
}
