// v10.8 (found reading every line of the 18 languages, 21 Nov 2026): German, Spanish, Portuguese, Italian, Turkish, Indonesian and Vietnamese
// write twelve thousand "12.000", French and Russian "12 000" (often a no-break space), and a price "1.500,50". The app's own example lines
// in those languages say exactly that ("Ahmed me debe 12.000, 1.000 al mes") — but the sentence readers took "12.000" as 12.
// ungroup() rewrites such numbers to plain digits BEFORE a reader looks at them; English "12,000" is left for the readers (they handle it).
// Not touched: "3.5", "12.03" (a date), "192.168.1.20" (an address), and dot-grouped numbers next to a three-decimal currency
// (KWD BHD OMR JOD TND — "3.500 KWD" is three and a half dinars) or when the caller says its currency has three decimals.
const THREE = /^\s*(?:KWD|BHD|OMR|JOD|TND|KD|BD|JD|دينار|د\.\s?ك|د\.\s?ب|ر\.\s?ع|د\.\s?أ|د\.\s?ت)/iu;
const THREE_BEFORE = /(?:KWD|BHD|OMR|JOD|TND|KD|BD|JD|د\.\s?ك|د\.\s?ب|ر\.\s?ع|د\.\s?أ|د\.\s?ت)\s*$/iu;
const THREE_CUR = /^(?:KWD|BHD|OMR|JOD|TND|IQD|LYD)$/;
const RE = /(?<![\d.,])(\d{1,3})((?:([.\u00a0\u202f ])\d{3})(?:\3\d{3})*)(?:,(\d{1,2}))?(?![\d]|[.,]\d)/gu;
// every digit the 20 languages write → 0-9: Arabic ٠-٩, Persian/Urdu ۰-۹, Hindi ०-९, Bengali ০-৯, Thai ๐-๙, full-width ０-９ (Chinese, Japanese, Korean)
const DIGITS = [["٠", 0x660], ["۰", 0x6f0], ["०", 0x966], ["০", 0x9e6], ["๐", 0xe50], ["０", 0xff10]];
export function digits(s) {
  let t = String(s == null ? "" : s);
  for (const [, base] of DIGITS) t = t.replace(new RegExp(`[\\u${base.toString(16).padStart(4, "0")}-\\u${(base + 9).toString(16).padStart(4, "0")}]`, "g"), (d) => String(d.charCodeAt(0) - base));
  // direction marks come with copied right-to-left text and sit around numbers («elfu ‎8», "12 ‎000", "a las ‎5") — they are not part of it
  return t.replace(/[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g, "").replace(/٫/g, ".").replace(/٬/g, ",").replace(/，(?=\d{3})/g, ",");
}
// the words for a thousand / ten thousand / a lakh / a million that the readers don't know (they know k, thousand, mil, mille, tausend, bin,
// ribu, juta, million and the Arabic words): 5万 = 50,000 · 2 लाख = 200,000 · 3 triệu = 3,000,000 · 12 тыс = 12,000 · 12 mila = 12,000
const BIG = [
  [/万|萬|만/u, 1e4], [/千|천/u, 1e3], [/億|亿|억/u, 1e8],
  [/हज़ार|हजार/u, 1e3], [/लाख/u, 1e5], [/करोड़|करोड/u, 1e7],
  [/ہزار/u, 1e3], [/لاکھ/u, 1e5], [/کروڑ/u, 1e7], [/هزار/u, 1e3], [/میلیون/u, 1e6],
  [/হাজার/u, 1e3], [/লাখ|লক্ষ/u, 1e5], [/কোটি/u, 1e7],
  [/พัน/u, 1e3], [/หมื่น/u, 1e4], [/แสน/u, 1e5], [/ล้าน/u, 1e6],
  [/nghìn|ngàn/iu, 1e3], [/triệu/iu, 1e6], [/tỷ|tỉ/iu, 1e9],
  [/тысяч[аи]?|тыс\.?/iu, 1e3], [/миллион(?:а|ов)?|млн\.?/iu, 1e6],
  [/mila/iu, 1e3], [/mln/iu, 1e6],
];
const BIG_RE = new RegExp(`(?<![\\d.,])(\\d+(?:[.,]\\d{1,2})?)\\s?(${BIG.map(([r]) => r.source).join("|")})(?![A-Za-zÀ-ɏЀ-ӿ])`, "giu");   // CJK / Thai have no spaces: «5万円» counts
const PRE_RE = /\b(elfu|milioni)\s+(\d+(?:[.,]\d{1,2})?)(?![\d])/giu;   // Swahili says the word first: "elfu 12" = 12,000
const asNum = (n, k) => { const v = Math.round(parseFloat(String(n).replace(",", ".")) * k); return isFinite(v) ? String(v) : n; };
export function bigWords(s) {
  let t = String(s == null ? "" : s);
  if (!/\d/.test(t)) return t;
  t = t.replace(BIG_RE, (m, n, w) => { const hit = BIG.find(([r]) => new RegExp(`^(?:${r.source})$`, "iu").test(w)); return hit ? asNum(n, hit[1]) : m; });
  return t.replace(PRE_RE, (m, w, n) => asNum(n, /elfu/i.test(w) ? 1e3 : 1e6));
}
/** "12.000" → "12000", "12 000" → "12000", "1.500,50" → "1500.50", «১২,০০০» → "12,000", "5万" → "50000"; everything else as it was.
    cur: the money's currency, if known. */
export function ungroup(s, cur = "") {
  const t = bigWords(digits(s));
  if (!/\d[.\u00a0\u202f ]\d{3}/.test(t)) return t;
  return t.replace(RE, (m, a, groups, sep, dec, at, whole) => {
    if (sep === "." && (THREE_CUR.test(String(cur).toUpperCase()) || THREE.test(whole.slice(at + m.length)) || THREE_BEFORE.test(whole.slice(Math.max(0, at - 8), at)))) return m;
    if (sep === " " && /\d\s*$/.test(whole.slice(Math.max(0, at - 3), at))) return m;   // "1 2 345" — a list of numbers, not one
    return a + groups.replace(/[.\u00a0\u202f ]/g, "") + (dec ? "." + dec : "");
  });
}
