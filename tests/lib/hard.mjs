// v10.2 (Ali, 17 Nov 2026: "I want the 10000 test to be harder and all unique, not same pattern … it's too easy and they always get all
// right"). Every 10,000-case generator runs its cases through this:
//   harden(text, rnd, opts) — 1 to 4 REAL-WORLD changes that keep the meaning (what a phone, a bank or a person really does to a message):
//     the notification cut at ~100 characters, line breaks, double spaces, invisible direction marks, Arabic-Indic digits ١٢٣,
//     a currency written another way (EGP / LE / L.E / جم / ج.م / جنيه), 1,160.00 ↔ 1160 ↔ 1.160,00, Arabic letter variants (ة/ه أ/ا ى/ي),
//     a sender prefix ("CIB:"), the app's own suffix ("· 2 new"), emoji, UPPER / lower case, a stray word in the other language.
//     opts.keep: a RegExp of text that must survive (e.g. the amount) — a change that would remove it is skipped.
//   shapeOf(text) — the case's pattern with every value blanked (numbers → 9, names → w, Arabic words → ع), so the same template
//     with new numbers counts as ONE shape. A run reports shapes / cases; the bar is ≥ 60 % different shapes.
export const SHAPE_BAR = 0.6;
const AR_DIG = "٠١٢٣٤٥٦٧٨٩";
const CUR_EG = ["EGP", "LE", "L.E", "جم", "ج.م", "جنيه"];
const PREFIX = ["[SMS] ", ""];   // (neutral — a prefix may not change what the message is)
const SUFFIX = [" (1/2)", " 🔔", ""];   // (what a phone / an SMS really adds; nothing that changes the meaning)
const STRAY = ["😊", "🙏", "!!", "تمام", "شكرا", "thanks", "ok"];   // (nothing that turns a sentence into a request)
export function harden(text0, rnd, { keep = null, lang = "", allowCut = true, allowCase = true, human = false, sms = false } = {}) {
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  let t = String(text0);
  const ops = [
    () => t.replace(/ /g, () => (rnd() < 0.08 ? "  " : " ")),                                 // double spaces
    () => t.replace(/([.،,!؟?]) /, "$1\n"),                                                     // a line break
    () => "‏" + t.replace(/ (\d)/, " ‎$1"),                                           // invisible direction marks
    () => (/[\u0600-\u06FF]/.test(t) ? t.replace(/\d/g, (d) => AR_DIG[+d]) : t),                // Arabic-Indic digits (the whole message, as phones do — only in Arabic text)
    () => t.replace(/\b(EGP|LE|L\.E)\b/, () => pick(["EGP", "LE", "L.E", "EGP"])).replace(/(جنيه|جم|ج\.م)(?=\s|$)/, () => pick(["جنيه", "جم", "ج.م"])),   // the currency written another way (in the same script)
    () => (/EGP|L\.?E|جنيه|جم|ج\.م|\$|USD|SAR|AED/.test(t) ? t.replace(/(\d),(\d{3})(?!\d)/, "$1$2") : t),   // 1,160 → 1160 (a bank that writes no comma; not 3-decimal money)
    () => t.replace(/(\d)\.00\b/, (m, a) => pick([a, a + ".00", a + ".0"])),                   // .00 or not
    () => (human ? t.replace(/ة(?=\s|$)/g, () => (rnd() < 0.5 ? "ه" : "ة")).replace(/ى(?=\s|$)/g, "ي") : t),   // a person's Arabic spelling (ة/ه, ى/ي)
    () => t.replace(/[أإ]/g, () => pick(["ا", "أ", "إ"])),                                      // alef forms — banks and people write them all
    () => (sms ? pick(PREFIX) + t : t),                                                         // a prefix some SMS apps add
    () => (sms || human ? t + pick(SUFFIX) : t),                                                // "(1/2)" of a long SMS, an emoji a person adds
    () => (!allowCase ? t : human && rnd() < 0.5 ? t.toLowerCase() : t.toUpperCase()),          // case (ALL CAPS happens everywhere; all lower only when a person types)
    () => (human ? t.replace(/(\S+)$/, (m) => m + " " + pick(STRAY)) : t),                       // a stray word (people only)
    () => (allowCut && t.length > 110 ? t.slice(0, 95 + Math.floor(rnd() * 20)) + "…" : t),     // the notification cut short
  ];
  const n = 1 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) { const prev = t; t = pick(ops)(); if (keep && !keepOk(prev, t, keep)) t = prev; }
  return t;
}
// (a change may not remove what the truth depends on — compared after the digits are folded back to 0-9)
const fold = (s) => String(s).replace(/[٠-٩]/g, (c) => AR_DIG.indexOf(c)).replace(/[‎‏]/g, "");
function keepOk(prev, next, keep) { const a = fold(prev).match(keep), b = fold(next).match(keep); return !a || !!b; }
export function shapeOf(text) {
  return String(text).replace(/[٠-٩\d][\d٠-٩.,:/\-]*/g, "9").replace(/https?:\/\/\S+/g, "U").replace(/[A-Z][a-zA-Z]+/g, "W").replace(/[a-z]+/g, "w")
    .replace(/[؀-ۿ]+/g, "ع").replace(/\s+/g, " ").replace(/(\b[wW9ع]\b ?)+/g, (m) => m.trim().split(" ").length > 3 ? "… " : m).trim();
}
export function shapeReport(texts) { const s = new Set(texts.map(shapeOf)); return { shapes: s.size, cases: texts.length, share: s.size / Math.max(1, texts.length) }; }
