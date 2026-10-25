/* ---- Voice step 1.2 (VOICE_PLAN.md): Arabic → Franco ("Arabizi"), the way people really text it, per region, and the
   per-person language memory (Ali: "I tell it in Arabic to send person X something, it asks me which language, I say Franco
   or Arabic" — and it remembers).
   Words first (the Franco keyboard's dictionary, reversed — franco-words.js — plus everyday message words below), then the
   letter rules for the rest: Egyptian 2 ء/ق, 3 ع, 7 ح, 5 خ, g ج; Gulf 9 ص, 6 ط, j ج, g ق; Levantine j ج, 2 ق; Maghreb (Darija)
   j ج, q ق, 9 ق, kh خ. Short vowels are not written in Arabic, so a word the dictionary does not know gets a light "a" between
   two consonants — the read-back shows it and "Change" fixes it. Pure; tests/unit/v1100voice.test.mjs.                      */
import { FROM_KEYBOARD } from "./franco-words.js";

export const LANGS = ["ar", "franco", "en"];
const fold = (s) => String(s || "").replace(/[ً-ْـ]/g, "");

// everyday words in messages (Egyptian spelling first; the style rows below change only what differs)
const EXTRA = {
  "أنا": "ana", "انا": "ana", "إنت": "enta", "انت": "enta", "إنتي": "enty", "انتي": "enty", "إحنا": "e7na", "احنا": "e7na",
  "هتأخر": "hat2akhar", "هتاخر": "hat2akhar", "متأخر": "met2akhar", "نص": "nos", "ساعة": "sa3a", "ساعه": "sa3a", "دقيقة": "d2i2a", "دقايق": "d2aye2",
  "جاي": "gay", "جاية": "gaya", "جايه": "gaya", "وصلت": "wselt", "واصل": "wasel", "في": "fe", "الطريق": "el taree2", "البيت": "el beit", "الشغل": "el shoghl",
  "بكرة": "bokra", "بكره": "bokra", "النهارده": "el naharda", "النهاردة": "el naharda", "دلوقتي": "dlw2ty", "بعدين": "ba3deen", "امبارح": "embare7",
  "تمام": "tamam", "ماشي": "mashy", "اوكي": "okay", "أوكي": "okay", "شكرا": "shokran", "شكراً": "shokran", "معلش": "ma3lesh", "آسف": "asef", "اسف": "asef",
  "حبيبي": "7abibi", "حبيبتي": "7abibty", "يا": "ya", "ماما": "mama", "بابا": "baba", "أخويا": "akhoya", "اخويا": "akhoya",
  "إن": "en", "ان": "en", "شاء": "sha2", "الله": "allah", "إنشاء": "insha2", "إزيك": "ezayak", "ازيك": "ezayak", "عامل": "3amel", "ايه": "eh", "إيه": "eh",
  "مش": "msh", "هكلمك": "hakalmak", "هكلمك،": "hakalmak", "كلمني": "kalemny", "اتصل": "etasel", "بعد": "ba3d", "قبل": "2abl", "لما": "lama", "عشان": "3ashan",
  "كده": "keda", "خلاص": "khalas", "يلا": "yalla", "ربنا": "rabena", "معاك": "ma3ak", "معاكي": "ma3aky", "عليك": "3aleek", "وحشتني": "wa7ashtny",
  "الاجتماع": "el egtma3", "بنك": "bank", "مكتب": "maktab", "مبروك": "mabrouk", "رسالة": "resala", "فلوس": "flos", "اتفقنا": "etafa2na", "مستني": "mestany", "مستنيك": "mestanik", "خلص": "khalas", "اتلغى": "etlagha", "اتأجل": "et2agel", "الساعة": "el sa3a", "الصبح": "el sob7", "بالليل": "bel leil", "فين": "fein", "امتى": "emta", "إمتى": "emta",
};
// what changes outside Egypt (the same Arabic word, written the region's way)
const STYLE_WORDS = {
  gulf: { "جاي": "jay", "جاية": "jaya", "بكرة": "bacher", "بكره": "bacher", "دلوقتي": "al7in", "الحين": "al7in", "تمام": "zain", "إيه": "esh", "ايه": "esh", "شكرا": "shukran", "قبل": "gabl", "الطريق": "el6ree8", "الشغل": "el dawam" },
  lev: { "جاي": "jay", "جاية": "jaye", "بكرة": "bukra", "بكره": "bukra", "دلوقتي": "halla2", "هلق": "halla2", "تمام": "tamem", "إيه": "shu", "ايه": "shu", "شكرا": "merci", "قبل": "2abel" },
  maghreb: { "جاي": "jay", "بكرة": "ghedda", "بكره": "ghedda", "دلوقتي": "daba", "تمام": "mzyan", "إيه": "ach", "ايه": "ach", "شكرا": "chokran", "قبل": "qbel" },
};
const LETTERS = {
  eg: { "ء": "2", "أ": "a", "إ": "e", "آ": "a", "ؤ": "2", "ئ": "2", "ا": "a", "ب": "b", "ت": "t", "ث": "s", "ج": "g", "ح": "7", "خ": "5", "د": "d", "ذ": "z", "ر": "r", "ز": "z", "س": "s", "ش": "sh", "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "3", "غ": "gh", "ف": "f", "ق": "2", "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h", "ة": "a", "و": "w", "ي": "y", "ى": "a" },
};
LETTERS.gulf = { ...LETTERS.eg, "ج": "j", "ص": "9", "ط": "6", "ق": "g", "خ": "kh", "ث": "th", "ذ": "th", "ظ": "6h" };
LETTERS.lev = { ...LETTERS.eg, "ج": "j", "خ": "kh", "ث": "t", "ذ": "z" };
LETTERS.maghreb = { ...LETTERS.eg, "ج": "j", "ق": "q", "خ": "kh", "ح": "7", "ع": "3" };
const VOWELS = new Set(["a", "e", "i", "o", "u"]);

/** One Arabic word → Franco (the dictionary first, then the letter rules with a light vowel between consonants). */
export function wordToFranco(w0, style = "eg") {
  const w = fold(w0).trim(); if (!w) return "";
  if (!/[؀-ۿ]/.test(w)) return w;
  const st = STYLE_WORDS[style] || {};
  if (st[w]) return st[w];
  if (EXTRA[w]) return EXTRA[w];
  if (FROM_KEYBOARD[w]) return FROM_KEYBOARD[w];
  // "ال" + a known word → "el " + it ("الشغل" known already; "البنك" → "el bank")
  if (w.startsWith("ال") && w.length > 3) { const rest = wordToFranco(w.slice(2), style); return "el " + rest; }
  // و / ب / ل joined to a word: "وجاي" → "w gay", "لبكره" → "l bokra", "بالليل" stays a dictionary word
  if (/^[وبل]/.test(w) && w.length > 2) { const rest = w.slice(1), r = st[rest] || EXTRA[rest] || FROM_KEYBOARD[rest] || (rest.startsWith("ال") ? wordToFranco(rest, style) : "");
    if (r) return ({ "و": "w ", "ب": "b", "ل": "l " })[w[0]] + r; }
  const L = LETTERS[style] || LETTERS.eg;
  let out = "";
  const chars = [...w];
  chars.forEach((c, i) => {
    let m = L[c]; if (m == null) { out += c; return; }
    const prev = chars[i - 1], next = chars[i + 1];
    if (c === "و") m = prev && next ? "o" : prev ? "o" : "w";          // a long "oo" inside / at the end, "w" at the start
    if (c === "ي") m = prev && next ? "e" : prev ? "y" : "y";
    if (c === "ا" && i === 0) m = "a";
    const lastIsVowel = out && VOWELS.has(out[out.length - 1]);
    const thisIsVowel = VOWELS.has(m[0]);
    // two consonants in a row inside a word: a light "a" between (Arabic leaves short vowels unwritten)
    // (a 3-letter word gets its vowels everywhere — "قفل" → "2afal"; a longer one not before its last letter — "مكتب" → "maktab")
    if (out && !lastIsVowel && !thisIsVowel && m !== "h") out += i === chars.length - 1 && chars.length > 3 ? "" : "a";
    out += m;
  });
  return out.replace(/aa+/g, "a").replace(/^a(?=[^aeiou])/, (x) => x);
}
/** A message in Arabic → Franco in the person's region style (eg | gulf | lev | maghreb). Numbers, Latin words and punctuation stay. */
export function toFranco(text, style = "eg") {
  return String(text || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).split(/(\s+|[،,.!?؟:])/).map((p) => (/[؀-ۿ]/.test(p) ? wordToFranco(p, style) : p.replace("،", ",").replace("؟", "?"))).join("").replace(/\s+/g, " ").trim();
}
/** Is this text Franco? Latin letters with the number letters (2 3 5 7 8 9) inside words, or several known Franco words. */
export function isFranco(text) {
  const t = String(text || "").toLowerCase();
  if (!t || /[؀-ۿ]/.test(t)) return false;
  const words = t.match(/[a-z0-9']+/g) || [];
  const numLetter = words.filter((w) => /[a-z]/.test(w) && /[235789]/.test(w)).length;
  const KNOWN = new Set(["ana", "enta", "enty", "inta", "e7na", "msh", "mesh", "keda", "kda", "ezayak", "ezayek", "tamam", "yalla", "khalas", "bokra", "eh", "leh", "fein", "emta", "ya", "fe", "3la", "3shan", "3ashan", "mashy", "ba3d", "delwa2ty", "dlw2ty", "awy", "gay", "gaya", "habibi", "7abibi", "isa", "inshallah", "wallahi", "walla"]);
  const known = words.filter((w) => KNOWN.has(w)).length;
  return numLetter >= 1 || known >= 2;
}
/** How a person writes, from their own last messages: "ar" | "franco" | "en" | null (too little to tell). */
export function styleOf(messages = []) {
  const n = { ar: 0, franco: 0, en: 0 };
  for (const m of messages.slice(-8)) { const t = String(m || ""); if (!t.trim()) continue; if (/[؀-ۿ]/.test(t)) n.ar++; else if (isFranco(t)) n.franco++; else if (/[a-z]/i.test(t)) n.en++; }
  const best = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  return best[1] >= 1 ? best[0] : null;
}

// ---- the per-person language memory ----------------------------------------------------------------------------------------------
export const PEOPLE_KEY = "attune:voice:people";
const nameKey = (n) => String(n || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة$/g, "ه").replace(/\s+/g, " ").trim();
export function loadPeople(s = typeof localStorage !== "undefined" ? localStorage : null) { try { const v = JSON.parse((s && s.getItem(PEOPLE_KEY)) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } }
export function savePeople(p, s = typeof localStorage !== "undefined" ? localStorage : null) { try { s && s.setItem(PEOPLE_KEY, JSON.stringify(p)); } catch (e) {} return p; }
/** The language remembered for a person (null = ask). */
export const langFor = (people, name) => ((people || {})[nameKey(name)] || {}).lang || null;
/** Remember a person's language (and optionally that messages to them go without the read-back — off unless asked). */
export const rememberLang = (people, name, lang, extra = {}) => ({ ...(people || {}), [nameKey(name)]: { ...((people || {})[nameKey(name)] || {}), lang, ...extra } });
/** A spoken / typed answer → a language: «فرانكو» / "franco" / «عربي» / "english" / «انجليزي» → "franco" | "ar" | "en" | null. */
export function langAnswer(text) {
  const t = String(text || "").toLowerCase().trim();
  if (/franco|frankó|فرانكو|فرانكوا|arabizi|عربيزي|انجليزي بحروف|بالحروف الانجليزي|hinglish|roman urdu/.test(t)) return "franco";
  if (/^(?:in\s+)?(?:english|انجليزي|إنجليزي|انكليزي|إنكليزي|بالانجليزي|بالإنجليزي)(?:\s|$)|\benglish\b|انجليزي|إنجليزي/.test(t)) return "en";
  if (/arabic|عربي|بالعربي|عربى/.test(t)) return "ar";
  return null;
}
