/* ---- v9.4 the number guard (Ali, 5 Nov 2026: "I told it Sheikh pays me 19,500 in installments of 2,500 — why did it turn it to
   20,000? … fix it for good for everything in the chat").
   Whatever the chat builds from a sentence — a plan, a payment, a split, a price to watch — must still hold every AMOUNT the person
   said. Times ("at 9", "5:30"), dates ("1 December", "2027"), and counts with their unit ("4 nights", "12 months", "3 people", "20 g")
   are not amounts. An amount is "kept" when it is one of the numbers in what was built, or the product / sum of two of them (2,500 a
   month × 8 = 20,000 is not 19,500, so 19,500 is missing). Pure — tests/unit/v940numguard.test.mjs.                                */

const AR_D = "٠١٢٣٤٥٦٧٨٩";
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => AR_D.indexOf(d)).replace(/٫/g, ".").replace(/٬/g, ",");

const MONTHS = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|يناير|فبراير|مارس|ابريل|أبريل|مايو|يونيو|يوليو|اغسطس|أغسطس|سبتمبر|اكتوبر|أكتوبر|نوفمبر|ديسمبر";
// a count with its unit — not money
const UNIT = "nights?|days?|weeks?|months?|years?|hours?|hrs?|minutes?|mins?|seconds?|secs?|people|persons?|friends|ways|parts|payments?|installments?|instalments?|times|x|kids?|children|adults?|stars?|kg|g|grams?|gm|km|m|cm|l|ml|liters?|litres?|%|percent|pcs|pieces?|items?|stops?|seats?|rooms?|floors?|k?cal|calories|cups?|glasses|eggs?|slices?|karat|k\\b(?=\\s*(?:gold|ذهب|دهب))" +
  "|ليالي|ليله|ليلة|ايام|أيام|يوم|اسابيع|أسابيع|اسبوع|أسبوع|شهور|أشهر|اشهر|شهر|سنين|سنوات|سنه|سنة|ساعات|ساعه|ساعة|دقايق|دقائق|دقيقه|دقيقة|افراد|أفراد|اشخاص|أشخاص|نفر|انفار|قسط|اقساط|أقساط|دفعات|دفعه|مرات|مره|مرة|جرام|كيلو|متر|لتر|عيار|نجوم|قطع|حته|حتة";

/** The amounts said in a sentence → [number]. */
export function saidAmounts(text) {
  let t = " " + latin(text).toLowerCase() + " ";
  // dates and times are not amounts
  t = t.replace(new RegExp("\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:" + MONTHS + ")\\b|(?:" + MONTHS + ")\\s+\\d{1,2}(?:st|nd|rd|th)?\\b", "gi"), " ")
    .replace(/(?:يوم|في)\s+\d{1,2}(?!\d)/g, " ")
    .replace(/\b(?:19|20)\d{2}\b(?!\d|,\d)/g, " ")
    .replace(/\b\d{1,2}[:.]\d{2}\s*(?:am|pm|a\.m\.|p\.m\.)?|\b\d{1,2}\s*(?:am|pm|a\.m\.|p\.m\.)|\b(?:at|by|before|after|around|until|till)\s+\d{1,2}\b(?![,.:]?\d)|(?:الساعه|الساعة|ساعة|الساعة)\s*\d{1,2}(?:[:.]\d{2})?/gi, " ")
    .replace(/(?:\bback|\breturn(?:ing)?|راجع|رجوع|العوده|العودة)\s+(?:on\s+|يوم\s+)?(?:the\s+)?\d{1,2}(?!\d)(?![,.]\d)/gi, " ")
    .replace(/\b(?:the|on the)\s+\d{1,2}(?:st|nd|rd|th)\b|\b\d{1,2}(?:st|nd|rd|th)\b/gi, " ")
    .replace(/\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/g, " ")
    // a model, a flight, a size: "PS5", "S25", "A54" (letters joined to the number), a flight code "MS 777", "iPhone 16", "Pro 2"
    .replace(/\b[a-z]{1,3}\d{1,4}\b(?![,.]?\d)/gi, (m) => (/^(?:egp|le|usd|sar|aed|eur|gbp|kd|qr)\d/i.test(m) ? m : " "))
    .replace(/\b(?:ms|sv|ek|qr|tk|ey|xy|nl|fz|g9|j9|ba|lh|af|kl|pc|w6|fr|u2)\s\d{2,4}\b/gi, " ")
    .replace(/(?:\b(?:iphone|galaxy|pixel|redmi|note|playstation|ps|xbox|ipad|macbook|watch|series|gen|pro|max|plus|ultra|mini|air|model|version|v)|ايفون|الايفون|آيفون|جالاكسي|بلايستيشن|ساعه|ساعة)\s*\d{1,3}(?![\d,.])/gi, " ");
  const out = [];
  const re = /(\d+(?:[,]\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(k\b|thousand|الف|ألف|آلاف|الاف|m\b|million|مليون)?\s*([^\s\d,.،]*)/gi;
  let m;
  while ((m = re.exec(t))) {
    const after = (m[3] || "") + " " + t.slice(re.lastIndex, re.lastIndex + 14);
    if (!m[2] && new RegExp("^\\s*(?:" + UNIT + ")(?![\\p{L}])", "iu").test(m[3] ? m[3] + " " : after)) continue;
    let v = parseFloat(m[1].replace(/,/g, "")); if (!isFinite(v)) continue;
    if (/^(k|thousand|الف|ألف|آلاف|الاف)$/i.test(m[2] || "")) v *= 1000; else if (/^(m|million|مليون)$/i.test(m[2] || "")) v *= 1e6;
    if (v < 10 && !m[2]) continue;   // 1–9 alone is almost always a count ("3 friends", "pay in 2")
    out.push(Math.round(v * 100) / 100);
  }
  return [...new Set(out)];
}

/** Every finite number inside what was built (deep). */
export function builtNumbers(obj, out = [], depth = 0) {
  if (depth > 6 || obj == null) return out;
  if (typeof obj === "number") { if (isFinite(obj)) out.push(obj); return out; }
  if (typeof obj === "string") { if (/^\d+(\.\d+)?$/.test(obj)) out.push(+obj); return out; }
  if (Array.isArray(obj)) { for (const x of obj.slice(0, 200)) builtNumbers(x, out, depth + 1); return out; }
  if (typeof obj === "object") for (const [k, v] of Object.entries(obj)) {
    if (/^(source|said|src|note|text|title|raw|id|created|at|ts|date|start)$/.test(k)) continue;
    // a name the agent kept ("iPhone 16", "MS 777") holds its numbers — they were understood, not lost
    if (typeof v === "string" && /^(what|name|model|query|flight|item|product)$/.test(k)) { for (const n of latin(v).match(/\d+(?:\.\d+)?/g) || []) out.push(+n); continue; }
    builtNumbers(v, out, depth + 1); }
  return out;
}

const near = (a, b) => Math.abs(a - b) <= Math.max(0.5, Math.abs(b) * 0.001);

/** The amounts said that are NOT in what was built → [number] (empty = every amount is kept). */
export function missingAmounts(text, built) {
  const said = saidAmounts(text); if (!said.length) return [];
  const nums = [...new Set(builtNumbers(built).filter((x) => x > 0))].slice(0, 120);
  return said.filter((v) => {
    if (nums.some((x) => near(x, v))) return false;
    // a product or a sum of two built numbers ("1,500 a month for 6 months" → 9,000)
    for (let i = 0; i < nums.length; i++) for (let j = i; j < nums.length; j++) if (near(nums[i] * nums[j], v) || near(nums[i] + nums[j], v)) return false;
    return true;
  });
}
