/* ---- v9.9.17 (Ali, 11 Nov 2026: "make sure chat understands everything … exactly 10000 hard scenarios … people do the less work
   possible and the app understands them very well"). What the 10,000 HARD sentences (tests/scenarios/hard.mjs) showed the readers
   were missing — one small place every reader passes through before deciding:
     numWords(text)        "spent three hundred on lunch", «دفعت ميتين جنيه تاكسي» → the same sentence with 300 / 200 in digits
     notSpent(text)        "I didn't pay the 300 yet", "the driver wanted 200 but I refused", "he said the price is 300", «لسه مدفعتش»,
                           "translate 'I paid 180'…", "change the rent to 5000" → true: nothing was paid — never record it as money
     typedPayment(t, o)    the payment reader for a sentence the PERSON typed: the two checks above, the amount that is money (not
                           "at 8 pm", "for 4 people", "gate 4"), who paid whom ("Ahmed paid me back 500" is money IN), and several
                           amounts in one sentence left to the list reader
     splitOrders(text)     "paid 300 for lunch and remind me to call Ahmed at 5" → { pay, remind } — two orders, both done
     easeTime(text, now)   "half past 6 pm", "in an hour and a half", "the day after tomorrow", "tmrw", «كمان ساعة ونص», «فكريني»,
                           «اعملي تذكير» → the plain words the reminder reader already knows (6:30 pm, 90 minutes, on 12 November…)
   Pure; tests: tests/unit/v9917sense.test.mjs and the 10,000 run (bash tests/scenarios/run.sh hard).                              */
import { parsePayment } from "./yusr/paytext.js";

const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776));

// ---- number words ------------------------------------------------------------------------------------------------------------------
const EN1 = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const EN10 = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const CUR_NEXT = /^(?:pounds?|egp|le|l\.e\.?|dollars?|usd|bucks|euros?|riyals?|sar|dirhams?|aed|geneh|gneh|جنيه|جنيها|ج|ريال|درهم|دولار|يورو|دينار)$/i;
function enWords(text) {
  const tok = text.split(/(\s+|-)/); const out = []; let i = 0;
  const isNum = (w) => { const k = (w || "").toLowerCase(); return k in EN1 || k in EN10 || k === "hundred" || k === "thousand" || k === "a" || k === "an"; };
  while (i < tok.length) {
    const w = (tok[i] || "").toLowerCase().replace(/[.,!?;:]+$/, "");
    if (!isNum(w) || ((w === "a" || w === "an") && !/^(hundred|thousand)$/i.test((tok[i + 2] || "").replace(/[.,!?;:]+$/, "")))) { out.push(tok[i]); i++; continue; }
    let total = 0, cur = 0, j = i, big = false, used = 0, tail = "";
    while (j < tok.length) {
      const raw = tok[j] || "", k = raw.toLowerCase().replace(/[.,!?;:]+$/, "");
      if (/^(\s+|-)$/.test(raw)) { j++; continue; }
      if (k === "and" && used && isNum((tok[j + 2] || "").toLowerCase().replace(/[.,!?;:]+$/, "")) && !/^(a|an)$/i.test(tok[j + 2] || "")) { j++; continue; }
      if (k === "a" || k === "an") { if (used) break; cur = 1; }
      else if (k in EN1) { cur += EN1[k]; if (EN1[k] >= 10) big = true; }
      else if (k in EN10) { cur += EN10[k]; big = true; }
      else if (k === "hundred") { cur = (cur || 1) * 100; big = true; }
      else if (k === "thousand") { total += (cur || 1) * 1000; cur = 0; big = true; }
      else break;
      used++; tail = (/[.,!?;:]+$/.exec(raw) || [""])[0]; j++; if (tail) break;
    }
    let end = j; while (end > i && /^(\s+|-)$/.test(tok[end - 1] || "")) end--;
    const n = total + cur, next = (tok.slice(end).find((x) => x && !/^(\s+|-)$/.test(x)) || "").replace(/[.,!?;:]+$/, "");
    if (used && n >= 10 && (big || CUR_NEXT.test(next)) && !(n < 20 && !CUR_NEXT.test(next) && !/^(on|for)$/i.test(next))) { out.push(String(n) + tail); i = end; }
    else { out.push(tok[i]); i++; }
  }
  return out.join("");
}
const AR1 = { "واحد": 1, "اتنين": 2, "اثنين": 2, "تلاتة": 3, "تلاته": 3, "تلات": 3, "ثلاثة": 3, "اربعة": 4, "اربعه": 4, "اربع": 4, "أربعة": 4, "خمسة": 5, "خمسه": 5, "خمس": 5, "ستة": 6, "سته": 6, "ست": 6, "سبعة": 7, "سبعه": 7, "سبع": 7, "تمانية": 8, "تمانيه": 8, "تمن": 8, "ثمانية": 8, "تسعة": 9, "تسعه": 9, "تسع": 9,
  "عشرة": 10, "عشره": 10, "عشر": 10, "حداشر": 11, "اتناشر": 12, "تلتاشر": 13, "اربعتاشر": 14, "خمستاشر": 15, "ستاشر": 16, "سبعتاشر": 17, "تمنتاشر": 18, "تسعتاشر": 19 };
const AR10 = { "عشرين": 20, "تلاتين": 30, "ثلاثين": 30, "اربعين": 40, "أربعين": 40, "خمسين": 50, "ستين": 60, "سبعين": 70, "تمانين": 80, "ثمانين": 80, "تسعين": 90 };
const AR100 = { "مية": 100, "ميه": 100, "مائة": 100, "ميتين": 200, "مئتين": 200, "تلتمية": 300, "تلتميه": 300, "ثلاثمائة": 300, "ربعمية": 400, "ربعميه": 400, "خمسمية": 500, "خمسميه": 500, "ستمية": 600, "ستميه": 600, "سبعمية": 700, "سبعميه": 700, "تمنمية": 800, "تمنميه": 800, "تسعمية": 900, "تسعميه": 900 };
function arWords(text) {
  const tok = text.split(/(\s+)/); const out = []; let i = 0;
  const val = (w) => { const k = w.replace(/^و/, ""); return k in AR1 || k in AR10 || k in AR100 || /^(الف|ألف|الفين|ألفين|تلاف|الاف|آلاف|مليون)$/.test(k); };
  const strip = (w) => (w || "").replace(/[.,،!؟?;:]+$/, "");
  while (i < tok.length) {
    const raw0 = tok[i] || "", pre = /^(ب|بـ)(?=.)/.test(raw0) && val(strip(raw0).replace(/^(ب|بـ)/, "")) ? raw0.match(/^(ب|بـ)/)[0] : "";
    const w0 = strip(raw0).slice(pre.length);
    if (!w0 || !val(w0) || /^و/.test(w0)) { out.push(raw0); i++; continue; }
    let total = 0, cur = 0, j = i, used = 0, big = false, tail = "", firstBare100 = false;
    while (j < tok.length) {
      const raw = tok[j] || ""; if (/^\s+$/.test(raw)) { j++; continue; }
      let k = strip(j === i ? raw.slice(pre.length) : raw); const andW = /^و/.test(k) && used; if (andW) k = k.slice(1);
      if (/^و/.test(strip(raw)) && !used) break;
      if (k === "نص" && andW && total >= 1000 && !cur) { cur = 500; }   // «الف ونص» = 1500
      else if (k in AR1) { cur += AR1[k]; }
      else if (k in AR10) { cur += AR10[k]; big = true; }
      else if (k in AR100) { cur += AR100[k]; big = true; if (!used && AR100[k] === 100) firstBare100 = true; }
      else if (k === "الف" || k === "ألف") { total += (cur || 1) * 1000; cur = 0; big = true; }
      else if (k === "الفين" || k === "ألفين") { total += 2000; big = true; }
      else if (k === "تلاف" || k === "الاف" || k === "آلاف") { if (!cur) break; total += cur * 1000; cur = 0; big = true; }
      else if (k === "مليون") { total += (cur || 1) * 1000000; cur = 0; big = true; }
      else break;
      used++; tail = (/[.,،!؟?;:]+$/.exec(raw) || [""])[0]; j++; if (tail) break;
    }
    let end = j; while (end > i && /^\s+$/.test(tok[end - 1] || "")) end--;
    const n = total + cur, next = strip(tok.slice(end).find((x) => x && !/^\s+$/.test(x)) || "");
    // «مية» is also water («اشرب مية»): a bare «مية» counts only with «بـ» before it, a currency after it, or more number words
    const ok = used && n >= 10 && (big || CUR_NEXT.test(next)) && !(firstBare100 && used === 1 && !pre && !CUR_NEXT.test(next)) && !(n < 20 && !CUR_NEXT.test(next));
    if (ok) { out.push((pre ? pre.replace("ـ", "") : "") + String(n) + tail); i = end; } else { out.push(raw0); i++; }
  }
  return out.join("");
}
/** Number words → digits, only where a real amount is said (never "one", "a", a lone «مية» that may be water). */
export function numWords(text) {
  let t = String(text || "");
  if (/[\d٠-٩]\s*(?:hundred|thousand|k\b|الف|ألف|الاف|آلاف|تلاف|مليون|million)/i.test(t)) return t;   // "3 thousand", «٣ الاف» are the payment reader's own
  if (/\b(hundred|thousand|twenty|thirty|fou?rty|fifty|sixty|seventy|eighty|ninety|ten|eleven|twelve|\w+teen)\b/i.test(t)) t = enWords(t);
  if (/مي[ةه]|ميتين|مائة|مئتين|الف|ألف|تلاف|الاف|آلاف|مليون|عشرين|تلاتين|ثلاثين|[اأ]ربعين|خمسين|ستين|سبعين|تمانين|ثمانين|تسعين|عشر[ةه]|اشر(?![ء-ي])/.test(t)) t = arWords(t);
  return t;
}

// ---- nothing was paid ----------------------------------------------------------------------------------------------------------------
const PAYV = "(?:pay|paid|paying|spend|spent|spending|buy|bought|count|record|log|add)";
const NOT_SPENT = new RegExp([
  "\\b(?:didn'?t|did not|don'?t|do not|haven'?t|have not|hasn'?t|never|won'?t|will not|wouldn'?t|not|refused? to|can'?t|cannot)\\b[^.,;]{0,24}\\b" + PAYV + "\\b",   // I didn't pay the 300 yet · not paying 300 · don't count
  "\\b(?:but|and) (?:i )?refused\\b|\\bi refused\\b|\\bno way\\b|\\brip-?off\\b",
  "\\b(?:almost|nearly) (?:paid|spent|bought)\\b|\\b(?:was|were) (?:going|about) to (?:pay|spend|buy)\\b|\\bchanged my mind\\b",
  "\\bused to (?:cost|be|pay)\\b|\\b(?:they |he |she |the \\w+ )?(?:quoted|wanted|asked for|is asking|are asking)\\b|\\b(?:he|she|they) (?:said|says|told me)\\b|\\b(?:the )?ad says\\b|\\bthinks?\\b[^.]{0,30}\\bis\\b",
  "\\b(?:might|may|could|would|should i|shall i|do i|if i|when i|planning to|thinking of|want to|wanna|need to|have to|going to|gonna|will)\\b[^.,;]{0,18}\\b(?:pay|spend|buy|get)\\b",
  "\\bi need [\\d,.]+k?\\b[^.]{0,30}\\b(?:for|to)\\b|\\bis it normal\\b|\\bwish i\\b",
  "^(?:my (?:friend|brother|sister|colleague|neighbou?r|cousin|boss|dad|mum|mom|wife|husband)|he|she|they) (?:paid|spent|bought)\\b(?![^.]{0,20}\\b(?:me|for me|my)\\b)",
  "\\bcosts? [\\d,.]+k? in\\b",
  "^\\s*(?:please\\s+)?(?:translate|correct|proofread|rewrite|rephrase|summari[sz]e|explain|write|say|how do you say|what does)\\b",
  "^\\s*(?:please\\s+)?(?:change|edit|update|delete|remove|cancel|undo|fix)\\b|\\bactually make it\\b|\\bthat last one\\b|\\bwas wrong\\b|\\bnow,? not\\b|\\bnot [\\d,.]+k?\\s*$",
].join("|"), "i");
const NOT_SPENT_AR = /(?:لسه |لسة )?(?:مدفعتش|ما ?دفعتش|مادفعتش|مصرفتش|ما ?صرفتش|مشتريتش|ما ?اشتريتش)|مش (?:هدفع|هشتري|هصرف|دافع)|(?:بس|و)\s*(?:رفضت|مدفعتش)|رفضت ادفع|كان (?:عايز|عاوز|طالب)|كانوا (?:عايزين|طالبين)|طلبوا مني|طلب مني|قالي (?:ان )?(?:السعر|التمن|الثمن)|بيقول|كنت (?:هدفع|هشتري|هصرف)|غيرت رأيي|غيرت رايي|ممكن (?:اصرف|ادفع|اشتري)|(?:محتاج|عايز|عاوز|ناوي|نفسي|لازم)\s+(?:[\d٠-٩]|ادفع|اشتري|اصرف)|كانت? ب[\d٠-٩ ]+.{0,12}زمان|^\s*(?:ترجم|ترجملي|صحح|صححلي|اكتب|اكتبلي|اشرح|اشرحلي|لخص|لخصلي)|^\s*(?:غير|عدل|امسح|الغي|إلغي|شيل)(?![ء-ي])|^\s*لا[،, ]+غلط|كانت? غلط/;
/** True when the sentence does NOT say the person paid / received money now (a negation, a wish, what someone else said, a request). */
export function notSpent(text) { const t = latin(String(text || "")).trim(); return NOT_SPENT.test(t) || NOT_SPENT_AR.test(t); }

// ---- the payment reader for a typed sentence -------------------------------------------------------------------------------------------
const UNIT_AFTER = "(?:am|pm|a\\.m\\.?|p\\.m\\.?|min(?:ute)?s?|hours?|hrs?|km|kms|kilomet(?:er|re)s?|miles?|steps?|pages?|years?(?: old)?|people|persons?|guys|friends|kids?|children|kg|kilos?|%|days?|nights?|weeks?|months?|times|floors?|shirts?|coffees?|pieces?|items?|tickets?|bottles?|boxes|cups?|دقيقه|دقيقة|دقايق|ساعه|ساعة|ساعات|كيلو|خطوه|خطوة|صفحه|صفحة|صفحات|سنه|سنة|سنين|يوم|ايام|أيام|مره|مرة|مرات|عيال|اولاد|أولاد|افراد|أفراد|قمصان|قطع|تذاكر|انفار)";
const LEAD_BEFORE = "(?:at|on|page|room|floor|chapter|code|pin|password|number|no\\.?|flat|apartment|gate|seat|bus|line|flight|version|model|iphone|galaxy|pixel|ps|size|aged?|score|الساعة|الساعه|يوم|صفحه|صفحة|اوضه|أوضة|الدور|شقه|شقة|الكود|كود|الرقم|رقم|الرحلة|رحلة|الباسورد|باسورد|باب|بوابة|مقاس|ايفون|آيفون)";
const MONTHS = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*|يناير|فبراير|مارس|ابريل|أبريل|مايو|يونيو|يوليو|اغسطس|أغسطس|سبتمبر|اكتوبر|أكتوبر|نوفمبر|ديسمبر";
const CURW = "(?:egp|le|l\\.e\\.?|usd|sar|aed|eur|gbp|pounds?|dollars?|euros?|riyals?|dirhams?|geneh|جنيه|جنيها|ج\\.م|ج|ريال|درهم|دولار|يورو|\\$|€|£)";
/** The numbers in a typed sentence that can be money: not a time, a date, a count of people / things, a gate, a page. → [n…] */
export function moneyNumbers(text) {
  const s = latin(String(text || "")).replace(/(\d),(?=\d{3}\b)/g, "$1"), out = [];
  const re = /(?<![\d.])(\d+(?:\.\d+)?)(k\b)?/gi; let m;
  while ((m = re.exec(s))) {
    const before = s.slice(Math.max(0, m.index - 24), m.index), after = s.slice(m.index + m[0].length, m.index + m[0].length + 24), n = +m[1] * (m[2] ? 1000 : 1);
    if ((/[a-z]$/i.test(before) && !new RegExp(CURW + "$", "i").test(before)) || (/^[a-z]/i.test(after) && !new RegExp("^" + CURW, "i").test(after) && !/^(?:am|pm|st|nd|rd|th|x)\b/i.test(after))) continue;   // "dafa3t", "7ala2", "S24", "M3"
    const cur = new RegExp("^\\s*" + CURW, "i").test(after) || new RegExp(CURW + "\\s*$", "i").test(before);
    if (!cur) {
      if (new RegExp("^\\s*" + UNIT_AFTER + "(?![\\p{L}])", "iu").test(after)) continue;
      if (/^:\d{2}/.test(after) || /\d:$/.test(before)) continue;                                                     // 7:30
      if (new RegExp("^(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:" + MONTHS + ")", "i").test(after) || new RegExp("(?:" + MONTHS + ")\\s*$", "i").test(before)) continue;   // 3 November
      if (new RegExp("(?<![\\p{L}])" + LEAD_BEFORE + "\\s*#?\\s*$", "iu").test(before) && !/\b(?:paid|spent|cost|for)\s+$/i.test(before)) continue;        // at 8 · gate 4 · يوم 3
      if (/^\s*[-–\/]\s*\d/.test(after) && !/\/-/.test(after) || /\d\s*[-–\/]\s*$/.test(before)) continue;                                               // 3-1 · 10/11
      if (/^\d{7,}$/.test(m[1])) continue;                                                                             // a phone number
    }
    out.push(n);
  }
  return out;
}
const IN_ME = /\b(?:paid|gave|sent|returned|transferred|refunded) (?:me|us)\b|\b(?:paid|gave) (?:it )?back\b[^.]{0,30}\b(?:owes?|owed) me\b|\bgot [^.]{0,14}\bback from\b|\bgot (?:paid|a refund|my (?:salary|money))\b|\breturned the [^.]{0,14}\b(?:he|she|they) owed me\b|\bsettled\b[^.]{0,20}\b(?:his|her|their) debt\b|\b(?:client|customer|company|boss)\s+(?:paid|sent|transferred)\b(?! (?:to|for) (?:the|a|his|her))|(?:دفعلي|دفعتلي|دفعولي|بعتلي|بعتتلي|بعتولي|اداني|ادتني|ادوني|حوللي|حولتلي|رجعلي|رجعتلي|رجعولي|سددلي|سددتلي|رد(?:لي|تلي))/i;
const OUT_ME = /\bi (?:paid|gave|returned|sent|transferred)\b[^.]{0,30}\bback\b|\bpaid back [^.]{0,14}\bto\b|\bi returned\b|(?<![ء-ي])(?:رجعت|سددت|رديت)\s+(?:[\d٠-٩]+\s+)?(?:ل|لـ)(?=[ء-ي])|(?<![ء-ي])(?:رجعت|سددت)\s+ل/i;
const FRANCO_IN = /\b(?:abadt|2abadt|estalamt|gali|galy|el morattab nezel|el mortab nezel)\b|(?<![ء-ي])(?:قبضت|استلمت|جالي|جاني|جاتلي)(?![ء-ي])|(?:المرتب|الراتب|مرتبي|راتبي) (?:نزل|وصل|اتحول)/i;
const OUT_HINT = /\b(?:i paid|paid|spent|bought|cost(?:s| me)?|came to|went on|in total|gave the)\b|(?<![ء-ي])(?:دفعت|صرفت|اشتريت|اديت|حاسبت|كلفتني|كلفني|كلف)(?![ء-ي])/i;
const DEBT_W = /\b(?:owes?|owed|lent|loan(?:ed)?|borrow(?:ed)?|in debt|of mine)\b|مديون|مدين|سلف|استلف|(?<![ء-ي])(?:عليه|عليها|عليا)(?![ء-ي])|ليا عند|ليه عندي/i;
/** A sentence the person typed → the payment in it (parsePayment's shape), or null when nothing was paid or the list reader should take it. */
export function typedPayment(text, opts = {}) {
  const t = numWords(String(text || ""));
  if (notSpent(t)) return null;
  // a bank / wallet message pasted into Chat («تم تحويل مبلغ 2,500.00 جنيه إلى … رقم العملية 123456») is read by the bank reader as it is
  if (/تم (?:خصم|تحويل|ايداع|إيداع|استلام|سحب|دفع|سداد)|رقم العملية|\b(?:debited|credited|available balance|avl\.? ?bal|card ending|a\/c|ref(?:erence)?\.? ?(?:no\.? ?)?\d)\b/i.test(t)) return parsePayment(t, opts);
  const nums = moneyNumbers(t);
  if (nums.length >= 2 && /\b(?:and|then|plus)\b|[,،;+\n]|\sو\s?|\sو(?=[ء-ي])/i.test(t) && !/\b(?:of what|out of|from the|instead of|in total|total)\b|من اللي|من اصل|من أصل/i.test(t)) return null;   // several things → the list reader (doit.js)
  const p = parsePayment(t, opts);
  // a debt ("I still owe Mohamed 2500 for the dentist", «خدت من كريم 15000 سلف») is People & plans' — unless it is being paid back now
  if (DEBT_W.test(t) && !IN_ME.test(t) && !OUT_ME.test(t)) return p && p.ok ? null : p;
  // one clear amount with a clear "I paid / I got" — the card asks before anything is added, so it is safe to offer it
  if (p && !p.ok && nums.length === 1 && (IN_ME.test(t) || FRANCO_IN.test(t) || OUT_ME.test(t) || OUT_HINT.test(t)) && !/[?؟]\s*$/.test(t)) { p.ok = true; p.amount = nums[0]; p.direction = p.direction || "out"; }
  if (!p || !p.ok) return p;
  if (nums.length === 1 && Math.abs(nums[0] - p.amount) > 0.005) p.amount = nums[0];        // "at 8 pm I paid 600" → 600, not 8
  else if (nums.length && !nums.some((n) => Math.abs(n - p.amount) < 0.005)) p.amount = nums[nums.length - 1];
  else if (!nums.length) return null;                                                          // every number in it is a time / a count
  if (OUT_ME.test(t)) p.direction = "out"; else if (IN_ME.test(t) || FRANCO_IN.test(t)) p.direction = "in";
  else if (/\b(?:i )?(?:bought|spent)\b|(?<![ء-ي])(?:اشتريت|صرفت|دفعت)(?![ء-ي])/i.test(t)) p.direction = "out";   // «اشتريت 5 قمصان ب420 من سيتي ستارز» (the «من» read as money in)
  return p;
}

// ---- two orders in one sentence ----------------------------------------------------------------------------------------------------------
const REM = "(?:please\\s+)?(?:remind me|set a reminder|don'?t let me forget|فكرني|فكريني|ذكرني|نبهني)";
/** "paid 300 for lunch and remind me to call Ahmed at 5" → { pay: "paid 300 for lunch", remind: "remind me to call Ahmed at 5" } (or null). */
export function splitOrders(text) {
  const t = String(text || "").trim(); if (t.length > 300 || /[?؟]\s*$/.test(t)) return null;
  let m = new RegExp("^(.{4,}?)\\s*(?:[.,،;]|\\band\\b|\\balso\\b|\\bthen\\b|\\s+و(?=[ء-ي\\s]))\\s*(?:and\\s+|also\\s+|then\\s+|و\\s*)?(" + REM + ".+)$", "i").exec(t);
  if (m && !new RegExp(REM, "i").test(m[1]) && /[\d٠-٩]/.test(m[1])) return { pay: m[1].trim(), remind: m[2].trim() };
  m = new RegExp("^(" + REM + ".+?)\\s*(?:[.,،;]|\\band\\b|\\balso\\b)\\s*(?:and\\s+|also\\s+)?((?:i\\s+)?(?:paid|spent|bought|دفعت|صرفت|اشتريت).+)$", "i").exec(t);
  if (m && /[\d٠-٩]/.test(m[2])) return { pay: m[2].trim(), remind: m[1].trim() };
  return null;
}

// ---- time words the reminder reader does not know yet → the ones it knows ------------------------------------------------------------------
const MON_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON_AR = ["يناير", "فبراير", "مارس", "ابريل", "مايو", "يونيو", "يوليو", "اغسطس", "سبتمبر", "اكتوبر", "نوفمبر", "ديسمبر"];
const dayAfter = (now, n) => { const d = new Date(now); d.setDate(d.getDate() + n); return d; };
const pm = (h, part) => (/even|night|afternoon|pm/i.test(part) && +h < 12 ? +h + " pm" : /morn|am/i.test(part) ? +h + " am" : h);
export function easeTime(text, now = Date.now()) {
  let t = latin(String(text || ""));
  // how a reminder is asked for
  t = t.replace(/\b(?:i need|i want|give me|set(?: me)?|make(?: me)?|create) an? reminder\b\s*:?\s*/i, "remind me ").replace(/\b(?:can|could|would) you (?:please )?remind me\b/i, "remind me").replace(/\bremind me\b([^.]*?)\bthat i (?:have|need|must) to\b/i, "remind me$1to")
    .replace(/(?:^|(?<=\s))(?:فكريني|فكرينى|فكرنى|عايزك تفكرني|عاوزك تفكرني|ممكن تفكرني|اعمل(?:ي|لي)? تذكير|حط(?:لي)? تذكير|متخلنيش انس[ىي]|ما ?تخلينيش انس[ىي]|ماتخلنيش انس[ىي])(?=\s)/g, "فكرني");
  // spelling
  t = t.replace(/\b(?:tmrw|tmw|tmr|2moro|2morrow|2mrw|tomorow|tommorow|tommorrow|tomorro)\b/gi, "tomorrow").replace(/\btom(?=\s+(?:at\s+)?\d)/gi, "tomorrow").replace(/\b(\d+)\s*mins\b/gi, "$1 minutes").replace(/\b(\d+)\s*hrs?\b/gi, "$1 hours")
    .replace(/\b(tomorrow|today|tonight)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/gi, "$1 at $2");
  if (/\bremind|\breminder\b|\bwake me\b/i.test(t)) t = t.replace(/\bbokra\b|\bbukra\b/gi, "tomorrow").replace(/\benharda\b|\bel ?naharda\b/gi, "today");
  // clock words
  t = t.replace(/\b(?:a )?quarter past (\d{1,2})\b/gi, "$1:15").replace(/\bhalf past (\d{1,2})\b/gi, "$1:30").replace(/\b(?:a )?quarter to (\d{1,2})\b/gi, (_, h) => ((+h + 11) % 12 || 12) + ":45")
    .replace(/\b(\d{1,2}) (?:minutes? )?past (\d{1,2})\b/gi, (_, m, h) => h + ":" + String(m).padStart(2, "0")).replace(/\b(5|10|15|20|25) (?:minutes? )?to (\d{1,2})(?=\s*(?:am|pm|o'?clock|in the|$))/gi, (_, m, h) => ((+h + 11) % 12 || 12) + ":" + (60 - +m))
    .replace(/\b(\d{1,2}(?::\d{2})?) in the (morning|evening|afternoon)\b/gi, (_, h, p) => h + (/morn/i.test(p) ? " am" : " pm")).replace(/\b(\d{1,2}(?::\d{2})?) at night\b/gi, "$1 pm").replace(/\b(\d{1,2}(?::\d{2})?)\s*o'?clock\b/gi, "$1");
  // durations
  t = t.replace(/\b(\d+) hours? and a half\b/gi, (_, h) => +h * 60 + 30 + " minutes").replace(/\ban? hour and a half\b/gi, "90 minutes").replace(/\bhalf an hour\b|\ba half hour\b/gi, "30 minutes").replace(/\bin an hour\b/gi, "in 1 hour").replace(/\ba couple of hours\b/gi, "2 hours").replace(/\bin a (minute|week)\b/gi, "in 1 $1")
    .replace(/(^|\s)(\d+)\s*(?:ساعات|ساعه|ساعة) ونص(?=\s|$)/g, (_, a, h) => a + (+h * 60 + 30) + " دقيقة").replace(/(^|\s)ساعتين ونص(?=\s|$)/g, "$1150 دقيقة").replace(/(^|\s)(?:ساعه|ساعة) ونص(?=\s|$)/g, "$190 دقيقة").replace(/(^|\s)(?:ساعه|ساعة) (?:الا|إلا) ربع(?=\s|$)/g, "$145 دقيقة");
  // parts of the day
  t = t.replace(/\b(tomorrow|today) (morning|evening|afternoon|night) at (\d{1,2}(?::\d{2})?)(?!\s*(?:am|pm))/gi, (_, d, p, h) => d + " at " + pm(h, p)).replace(/\bthis (morning|evening|afternoon) at (\d{1,2}(?::\d{2})?)(?!\s*(?:am|pm))/gi, (_, p, h) => "today at " + pm(h, p))
    .replace(/\btomorrow morning\b(?!\s+at)/gi, "tomorrow at 9 am").replace(/\btomorrow afternoon\b(?!\s+at)/gi, "tomorrow at 3 pm").replace(/\btomorrow (?:evening|night)\b(?!\s+at)/gi, "tomorrow at 7 pm").replace(/\bthis evening\b(?!\s+at)/gi, "today at 7 pm").replace(/\bthis afternoon\b(?!\s+at)/gi, "today at 3 pm")
    .replace(/\b(tomorrow|today) (morning|evening|afternoon|night) at\b/gi, "$1 at").replace(/\bthis (morning|evening|afternoon) at\b/gi, "today at")
    .replace(/\bevery (morning|evening|night) at (\d{1,2}(?::\d{2})?)(?!\s*(?:am|pm))/gi, (_, p, h) => "every day at " + pm(h, p)).replace(/\bevery (morning|evening|night)\b/gi, (_, p) => "every day at " + (/morn/i.test(p) ? "8 am" : "8 pm")).replace(/\bweekly on\b/gi, "every");
  // days counted from today → the date itself
  const on = (n) => { const d = dayAfter(now, n); return "on " + d.getDate() + " " + MON_EN[d.getMonth()]; }, onAr = (n) => { const d = dayAfter(now, n); return "يوم " + d.getDate() + " " + MON_AR[d.getMonth()]; };
  t = t.replace(/\b(?:on )?the day after tomorrow\b/gi, on(2)).replace(/\b(?:in|after) (\d{1,2}) days\b/gi, (_, n) => on(+n)).replace(/\bin a couple of days\b/gi, on(2))
    .replace(/(^|\s)بعد (?:بكره|بكرة)(?=\s|$)/g, (_, a) => a + onAr(2)).replace(/(^|\s)(?:بعد|كمان) (\d{1,2}) (?:ايام|أيام|يوم)(?=\s|$)/g, (_, a, n) => a + onAr(+n)).replace(/(^|\s)(?:بعد|كمان) يومين(?=\s|$)/g, (_, a) => a + onAr(2));
  // Arabic clock words
  t = t.replace(/(\d{1,2}) (?:الا|إلا) ربع/g, (_, h) => ((+h + 11) % 12 || 12) + ":45").replace(/(\d{1,2}) (?:الا|إلا) تلت/g, (_, h) => ((+h + 11) % 12 || 12) + ":40");
  return t;
}

// ---- debts said another way → the words the plan reader knows ---------------------------------------------------------------------------------
const NM = "((?:my |the |uncle |aunt |dr\\.? )?[\\p{L}'’-]+(?: [\\p{Lu}][\\p{L}'’-]+| Ali)?)", NA = "((?:صاحبي |صديقي |ابن عمي |ابن خالي |دكتور |عمو |طنط )?[ء-ي]+)", AMT = "([\\d٠-٩][\\d٠-٩,.٬]*\\s*k?)";
const DEBT_FORMS = [
  [new RegExp("^" + NM + " lent me " + AMT, "iu"), "I borrowed $2 from $1"], [new RegExp("^i gave " + NM + " " + AMT + " as a loan", "iu"), "I lent $1 $2"],
  [new RegExp("^i took " + AMT + " from " + NM + " and (?:i )?(?:will|i'?ll) (?:return|pay|give) (?:it|them)(?: back)?", "iu"), "I borrowed $1 from $2"], [new RegExp("^" + NM + " took " + AMT + " from me and (?:will|he'?ll|she'?ll) (?:return|pay|give) (?:it|them)(?: back)?", "iu"), "$1 borrowed $2 from me"],
  [new RegExp("^i (?:have|need) to (?:give|pay) " + NM + " back " + AMT, "iu"), "I owe $1 $2"], [new RegExp("^" + NM + " needs to (?:return|give back|pay back) my " + AMT, "iu"), "$1 owes me $2"],
  [new RegExp("^i'?m in debt to " + NM + " (?:for|by) " + AMT, "iu"), "I owe $1 $2"], [new RegExp("^" + NM + " has " + AMT + " of mine", "iu"), "$1 owes me $2"],
  [new RegExp("^(?:i )?lent " + AMT + " to " + NM, "iu"), "I lent $2 $1"], [new RegExp("^borrowed " + AMT + " from " + NM, "iu"), "I borrowed $1 from $2"],
  [/\b(i|[\p{L}'’-]+) still (owes?)\b/iu, "$1 $2"],
  [new RegExp("^انا عليا " + AMT + " ل" + NA), "عليا ل$2 $1"], [new RegExp("^خدت من " + NA + " " + AMT + " سلف"), "استلفت $2 من $1"], [new RegExp("^اديت " + NA + " " + AMT + " سلف"), "سلفت $1 $2"],
  [new RegExp("^" + NA + " ليه عندي " + AMT), "عليا ل$1 $2"], [new RegExp("^" + NA + " سلفني " + AMT), "استلفت $2 من $1"], [new RegExp("^" + NA + " مديون ليا ب" + AMT), "$1 عليه $2"], [new RegExp("^انا مديون ل" + NA + " ب" + AMT), "عليا ل$1 $2"],
  [new RegExp("^" + NA + " خد مني " + AMT + " وهيرجع\\S*"), "$1 استلف مني $2"], [new RegExp("^" + NA + " لسه مرجعش ال" + AMT + " اللي استلفهم مني"), "$1 استلف مني $2"], [new RegExp("^" + NA + " عليه ليا " + AMT), "$1 عليه $2"],
];
/** "uncle Samir lent me 10000" → "I borrowed 10000 from uncle Samir"; «انا عليا 1000 لحسن» → «عليا لحسن 1000» — the same debt in the words life.js reads. */
export function easeDebt(text) { let t = String(text || "").trim(); for (const [re, to] of DEBT_FORMS) if (re.test(t)) { t = t.replace(re, to); break; } return t; }

// ---- sums said in words → the signs the calculator knows ------------------------------------------------------------------------------------------
export function easeCalc(text) {
  let t = latin(String(text || "")); const N = "(\\d+(?:\\.\\d+)?)";
  const pure = new RegExp("^\\s*(?:احسب\\s+|كام\\s+)?" + N + "\\s*(في|على|زائد|ناقص)\\s*" + N + "\\s*[=؟?]?\\s*$").exec(t);
  if (pure) return pure[1] + " " + { "في": "*", "على": "/", "زائد": "+", "ناقص": "-" }[pure[2]] + " " + pure[3];
  return t.replace(new RegExp(N + "\\s*percent of\\s*" + N, "i"), "$1% of $2").replace(new RegExp("(?:what'?s|what is)?\\s*" + N + "\\s*%\\s*off\\s*" + N + "\\s*\\??", "i"), "$2 * (100 - $1) / 100")
    .replace(new RegExp("^\\s*split\\s*" + N + "\\s*(?:between|among|by|on|over)\\s*" + N + "(?:\\s*(?:people|persons|of us|friends))?\\s*\\??\\s*$", "i"), "$1 / $2").replace(new RegExp("^\\s*(?:what'?s |what is )?half of\\s*" + N + "\\s*\\??\\s*$", "i"), "$1 / 2")
    .replace(new RegExp("^\\s*(?:what'?s |what is )?" + N + "\\s*squared\\s*\\??\\s*$", "i"), "$1 * $1");
}

// ---- a spending line written with signs: "lunch (350)", "mechanic: 320", "haircut 1750/-", «تورتة 15ج», "😋 charger 25" -------------------------------
export function tidy(text) {
  return String(text || "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, " ").replace(/\(([\d٠-٩][\d٠-٩,.]*)\)/g, " $1 ").replace(/([\p{L}])\s*[:=\-–]\s*(?=[\d٠-٩])/gu, "$1 ")
    .replace(/([\d٠-٩])\/-/g, "$1").replace(/([\d٠-٩])(ج|جنيه)(?![ء-ي])/g, "$1 $2").replace(/^\s*-(?=[\d٠-٩])/, "").replace(/([\d٠-٩])\s*[.!]+\s*$/, "$1").replace(/\s+/g, " ").trim();
}
