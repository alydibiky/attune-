/* ---- v10.9 S1 (Ali, 22 Nov 2026: "make the speed much faster"): everyday sums worked out by code, instantly --------------------------
   Measured with the real phone model (tests/trials/realchat.py): a sum in words took 40–60 s — the model writes a program (~20 s),
   explains it (~15 s), and sometimes fixes its own program (+25 s). Most sums people type have one of a few shapes, and code can read
   them exactly:
     split      «عندي 22000 هقسمهم على 9 شهور»            → 22000 ÷ 9
     rate       «إيجار ونش 3 أيام بـ 12,500 في اليوم + 14٪ ضريبة», «كيلو اللحمة بـ 480، عايز 2.5 كيلو»  → rate × count (+ tax / − discount)
     percent    "15% tip on 640", «خصم 20% على 1500», "18,000 with 14% VAT included — the price before VAT?", "1,800 after a 25% discount — before?"
     save       "save 2,500 a month, how many months to reach 60,000?"
     instalment «عربية بـ 900 ألف مقدم 30% والباقي على 5 سنين — القسط كام؟»
     interest   «حطيت 100 ألف في شهادة بعائد 20% سنوي — هاخد كام في السنة؟»
   A shape answers only when EVERY number in the message has its place in it and the message asks for a result; anything else goes to
   the model as before (a wrong instant answer is worse than a slow right one). The working is shown as numbers and symbols (the same in
   every language); the one-word label is in the app's language. Pure; tests: tests/quicksum/gen.mjs (10,000 + held-out), unit
   v1090quicksum, e2e e2e_v1090quicksum.py. */
import { tr } from "./i18n.js";

const AR_D = "٠١٢٣٤٥٦٧٨٩", FA_D = "۰۱۲۳۴۵۶۷۸۹";
const N = "(\\d+(?:\\.\\d+)?)";
const fold = (x) => String(x).replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");

/** The message made easy to read: Latin digits, no thousands commas, «900 ألف» = 900000, «كيلو ونص» = 1.5 كيلو, ٪ = %. */
export function norm(text) {
  let t = String(text || "").replace(/[٠-٩]/g, (d) => AR_D.indexOf(d)).replace(/[۰-۹]/g, (d) => FA_D.indexOf(d))
    .replace(/[‎‏؜‪-‮⁦-⁩]/g, "").replace(/٫/g, ".").replace(/٬/g, ",").replace(/٪/g, "%").toLowerCase();
  t = fold(t);
  t = t.replace(/(\d),(?=\d{3}(?!\d))/g, "$1").replace(/(\d),(?=\d{3}(?!\d))/g, "$1");                       // 1,250,000 → 1250000
  t = t.replace(/(\d)\s*(?:في|فى)\s*(?:الميه|الميه|الماءه|المئه|الماي[هة])/g, "$1%").replace(/(\d)\s*(?:بالميه|بالمائه|بالمئه)/g, "$1%");
  t = t.replace(/(\d)\s*(?:percent|per cent|pct)\b/g, "$1%");
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:الف|آلاف|الاف|alf|thousand|k)(?![\p{L}])/gu, (m, n) => String(Math.round(parseFloat(n) * 1e3)))
    .replace(/(\d+(?:\.\d+)?)\s*(?:مليون|ملايين|million|mn)(?![\p{L}])/gu, (m, n) => String(Math.round(parseFloat(n) * 1e6)));
  // «كيلو ونص» 1.5 · «نص كيلو» 0.5 · «ربع كيلو» 0.25 · duals «يومين» 2 days …
  t = t.replace(/(?<![\p{L}\d])(كيلو|ساعه|ساعة|متر|لتر)\s+ونص(?![\p{L}])/gu, "1.5 $1").replace(/(?<![\p{L}\d])نص\s+(كيلو|ساعه|متر|لتر)(?![\p{L}])/gu, "0.5 $1").replace(/(?<![\p{L}\d])ربع\s+(كيلو|ساعه|لتر)(?![\p{L}])/gu, "0.25 $1");
  t = t.replace(/(?<![\p{L}\d])(يومين|ليلتين|شهرين|سنتين|اسبوعين|ساعتين|كيلوين)(?![\p{L}])/gu, (m, w) => "2 " + { يومين: "ايام", ليلتين: "ليالي", شهرين: "شهور", سنتين: "سنين", اسبوعين: "اسابيع", ساعتين: "ساعات", كيلوين: "كيلو" }[w]);
  t = t.replace(/ج\.\s?م\.?|l\.e\.?|(?<![\p{L}])جم(?![\p{L}])/gu, " جنيه ").replace(/بـ\s*/g, "ب ").replace(/(?<![\p{L}])ب(?=\d)/gu, "ب ").replace(/(\d)(ج|جنيه|egp|le|l\.e)(?![\p{L}])/gu, "$1 $2");
  return t.replace(/\s+/g, " ").trim();
}
const nums = (t) => (t.replace(/\b20[2-4]\d\b/g, " ").match(/\d+(?:\.\d+)?/g) || []).map(Number);
const ASKS = /[?؟]|\b(how much|how many|how long|what(?:'s| is| was| will)|total|each|per|calculate|work out|monthly(?: payment)?|instal+ment)\b|(?<![\p{L}])(كام|قد ايه|اد ايه|المجموع|الاجمالي|الحساب|هيبقي|هيكون|هتبقي|يبقي|احسب|احسبلي|كل واحد|كل شهر|في الشهر|في السنه|القسط|السعر|بكام|هاخد)(?![\p{L}])/iu;
const NOT_A_SUM = /\b(remind|reminder|alarm|paid|spent|bought|i owe|owes me|lent)\b|(?<![\p{L}])(فكرني|ذكرني|نبهني|صرفت|دفعت|اشتريت|سلفت|عليا|ليا عند)(?![\p{L}])/iu;
const r2 = (x) => Math.round(x * 100) / 100;
const f = (x) => r2(x).toLocaleString("en-US", { maximumFractionDigits: 2 });

// units people count in
const UNIT_EN = "days?|nights?|hours?|hrs?|weeks?|months?|years?|kg|kgs|kilos?|kilograms?|items?|pieces?|pcs|people|persons?|guests?|meters?|metres?|m2|sqm|liters?|litres?|units?|boxes?|tickets?|cans?|bags?|shirts?|bottles?";
const UNIT_AR = "ايام|يوم|ليالي|ليله|ساعات|ساعه|اسابيع|اسبوع|شهور|اشهر|شهر|سنين|سنوات|سنه|كيلو|كيلوات|قطع|قطعه|حته|حتت|افراد|فرد|نفر|اشخاص|شخص|متر|امتار|لتر|علب|علبه|تذاكر|تذكره|اكياس|كيس|قمصان|قميص|ازايز|ازازه";
const PER_EN = "(?:a|an|per|each|every|for each|/)\\s*(?:day|night|hour|week|month|year|kg|kilo|item|piece|person|guest|meter|metre|m2|liter|litre|unit|box|ticket|can|bag|shirt|bottle)";
const PER_AR = "(?:في|ف|لل|ل|كل)\\s*(?:ال)?(?:يوم|ليله|ساعه|اسبوع|شهر|سنه|كيلو|واحد|واحده|قطعه|حته|فرد|نفر|شخص|متر|لتر|علبه|تذكره|كيس|قميص|ازازه)";

/** → { kind, value, label, steps: [string], unit } or null */
export function quickSum(text0) {
  const raw = String(text0 || "");
  if (!raw.trim() || raw.length > 260 || /```|=>|\bdef\b/.test(raw)) return null;
  const t = norm(raw);
  // ---- what is left: had X, spent / ate / gave Y → X − Y («مرتبي 12000 وبصرف 9000، فاضل كام؟», "3 apples, ate 2, how many left?") ----
  {
    const LEFT = /\b(left|remain(?:ing|s)?)\b|(?<![\p{L}])و?(فاضل|فاضلي|باقي|الباقي|يتبقي|متبقي|هيفضل|يفضل)(?![\p{L}])/u;
    const TAKE = /\b(spent|spend|spending|ate|eaten|used|gave|give|paid|pay|lost|sold|took)\b|(?<![\p{L}])و?(صرفت|بصرف|هصرف|اكلت|كلت|استعملت|اديت|دفعت|بدفع|هدفع|ضاع|بعت|خدت|اخدت|سحبت)(?![\p{L}])/u;
    const ns = nums(t), v = TAKE.exec(t);
    if (LEFT.test(t) && v && !/%/.test(t) && ns.length === 2) {
      const before = nums(t.slice(0, v.index)), after = nums(t.slice(v.index + v[0].length));
      let x = null, y = null;
      if (before.length === 1 && after.length === 1) { x = before[0]; y = after[0]; }
      else if (!before.length && after.length === 2) { const k = new RegExp(`${N}\\s*(?:من|out of|of)\\s*${N}`, "iu").exec(t.slice(v.index)); if (k) { y = +k[1]; x = +k[2]; } }
      if (x != null && x > y) return { kind: "left", value: r2(x - y), label: "Left", steps: [`${f(x)} − ${f(y)} = **${f(x - y)}**`] };
    }
  }
  if (!(ASKS.test(t) || /\d\s*%\s*(?:tip|of|off|discount|خصم|من|بقشيش)\s*(?:on\s+|علي\s+|على\s+)?\d/u.test(t) || /(?:tip|بقشيش|خصم)\s*\d+\s*%\s*(?:on|of|علي|على|من)\s*\d/u.test(t)) || NOT_A_SUM.test(t)) return null;
  const all = nums(t);
  if (all.length < 2 || all.length > 4) return null;
  const pcts = (t.match(/\d+(?:\.\d+)?\s*%/g) || []).map(parseFloat);
  if (pcts.some((p) => !(p > 0 && p < 100)) || pcts.length > 2) return null;
  const used = (list) => list.length === all.length && [...list].map(Number).sort((a, b) => a - b).every((x, i) => x === [...all].sort((a, b) => a - b)[i]);
  const R = (re) => new RegExp(re, "iu");
  let m;

  // ---- instalment: price, down payment %, rest over N years / months (no interest) ----
  if (pcts.length === 1 && /down ?payment|deposit|upfront|مقدم|دفعه اولي|اول دفعه/.test(t) && !/\b(interest|apr)\b|فايد|فوايد|فائده|فوائد/.test(t.replace(/(?:من غير|بدون|without|no|0%?)\s*(?:ال)?(?:فوايد|فوائد|فايده|فائده|interest)/g, ""))) {
    const per = R(`(?:over|in|for|on|علي|على|ع)\\s*${N}\\s*(years?|months?|سنين|سنوات|سنه|شهور|اشهر|شهر)(?![\\p{L}])`).exec(t);
    if (per) {
      const p = pcts[0], n = +per[1], months = /year|سن/.test(per[2]) ? n * 12 : n;
      const others = all.filter((v, k) => !(v === p && k === all.indexOf(p)) && !(v === n && k === all.lastIndexOf(n)));
      const price = others.length === 1 ? others[0] : null;
      if (price && used([price, p, n]) && price > 0 && months > 0) {
        const down = price * p / 100, rest = price - down, each = rest / months;
        return { kind: "instalment", value: r2(each), label: "Monthly payment", steps: [`${f(price)} × ${p}% = ${f(down)}`, `${f(price)} − ${f(down)} = ${f(rest)}`, ...(months !== n ? [`${n} × 12 = ${months}`] : []), `${f(rest)} ÷ ${months} = **${f(each)}**`] };
      }
    }
  }

  // ---- save S a month to reach T ----
  m = R(`(?:save|put aside|set aside|بحوش|هحوش|احوش|بوفر|هوفر|اوفر|بشيل|هشيل|بحط|هحط)\\s*${N}\\s*(?:\\S+\\s+)?(?:a|per|each|every|في|كل)\\s*(?:ال)?(month|شهر).*?(?:reach|get to|have|collect|hit|اوصل|اجمع|يبقي معايا|يكون معايا|يبقى معايا)\\s*(?:ل|لـ|to)?\\s*${N}`).exec(t)
    || R(`(?:reach|get to|collect|have|want|need|اوصل|اجمع|عايز|محتاج)\\s*(?:ل|لـ|to)?\\s*${N}.*?(?:save|saving|بحوش|هحوش|احوش|بوفر|هوفر|اوفر|بشيل|هشيل|بحط|هحط)\\s*${N}\\s*(?:\\S+\\s+)?(?:a|per|each|every|في|كل)\\s*(?:ال)?(month|شهر)`).exec(t);
  if (m && pcts.length === 0) {
    const first = /^(?:save|put|set|بحوش|هحوش|احوش|بوفر|هوفر|اوفر|بشيل|هشيل|بحط|هحط)/.test(m[0]);
    const s = first ? +m[1] : +m[2], target = first ? +m[3] : +m[1];
    if (used([s, target]) && s > 0 && target > s) {
      const n = target / s, whole = Math.ceil(n - 1e-9);
      return { kind: "save", value: whole, label: "Months needed", steps: [`${f(target)} ÷ ${f(s)} = ${Number.isInteger(n) ? "**" + n + "**" : f(n) + " → **" + whole + "**"}`] };
    }
  }

  // ---- interest: X at P% a year → per year / per month ----
  if (pcts.length === 1) {
    m = R(`${N}\\s*(?:\\S+\\s+){0,6}?(?:at|with|بعائد|بفايده|بفائده|عائد|فايده|interest|return|ب)\\s*(?:of\\s+)?${N}\\s*%\\s*(?:a year|per year|yearly|annual(?:ly)?|p\\.?a\\.?|سنوي|سنويا|في السنه)`).exec(t);
    if (m && used([+m[1], +m[2]]) && !/\b(for|over)\s+\d|(?:لمده|على|علي)\s*\d/.test(t.slice(m.index + m[0].length))) {
      const x = +m[1], p = +m[2], year = x * p / 100;
      const perMonth = /\b(a month|per month|monthly)\b|في الشهر|شهري|كل شهر/.test(t.slice(m.index + m[0].length)) || (/\b(a month|monthly)\b|في الشهر|كل شهر|شهري/.test(t) && !/في السنه|a year|per year|yearly/.test(t.slice(m.index + m[0].length)));
      return perMonth ? { kind: "interest", value: r2(year / 12), label: "Per month", steps: [`${f(x)} × ${p}% = ${f(year)}`, `${f(year)} ÷ 12 = **${f(year / 12)}**`] }
        : { kind: "interest", value: r2(year), label: "Per year", steps: [`${f(x)} × ${p}% = **${f(year)}**`] };
    }
  }

  // ---- split X over N ----
  m = R(`(?:split|divide|share|قسم|اقسم|هقسم|نقسم|تقسيم|بقسم)\\S*\\s+(?:\\S+\\s+){0,2}?${N}\\s*(?:\\S+\\s+){0,2}?(?:between|among|over|into|by|in|on|علي|على|ع)\\s*${N}`).exec(t)
    || R(`${N}\\s*(?:egp|le|pounds?|جنيه|ج)?\\s*(?:\\S+\\s+){0,3}?(?:over|across|in|split (?:over|into|between)|divided (?:over|into|between|among)|(?:بالتقسيط\\s+)?(?:علي|على))\\s*${N}\\s*(months?|instal+ments?|payments?|weeks?|years?|people|persons?|friends|parts?|شهور|اشهر|شهر|اقساط|قسط|دفعات|افراد|اشخاص|نفر|اصحاب|اجزاء|سنين|اسابيع)`).exec(t);
  if (m && pcts.length === 0) {
    const x = +m[1], n = +m[2];
    if (used([x, n]) && n >= 2 && n <= 600 && x > n) {
      const unit = m[3] || "";
      return { kind: "split", value: r2(x / n), label: /month|شهر|شهور|اشهر|قسط|اقساط|instal|payment/.test(unit) ? "Per month" : "Each part", steps: [`${f(x)} ÷ ${n} = **${f(x / n)}**`] };
    }
  }

  // ---- percentages of one amount ----
  if (pcts.length === 1 && all.length === 2) {
    const p = pcts[0], x = all.find((v) => v !== p) ?? all[1];
    if (used([p, x])) {
      const before = /\b(before|original(?:ly)?|without|excluding|excl|pre-?tax)\b|(?<![\p{L}])(قبل|الاصلي|من غير|بدون|كان بكام|كان سعره)(?![\p{L}])/u.test(t);
      const included = /\b(included|including|incl|inclusive|with)\b|شامل|بالضريبه|بالقيمه المضافه|متضمن/.test(t);
      const disc = /\b(discount|off|sale)\b|(?<![\p{L}])(خصم|تخفيض|اوكازيون)(?![\p{L}])/u.test(t), tax = /\b(vat|tax|service)\b|ضريب|قيمه مضافه|خدمه/.test(t), tip = /\btip\b|بقشيش|تيب/.test(t);
      const after = /\b(after|now|costs?|is)\b|(?<![\p{L}])(بعد|دلوقتي|بقي|بقى)(?![\p{L}])/u.test(t);
      if (before && disc && after) return { kind: "percent", value: r2(x / (1 - p / 100)), label: "Price before", steps: [`100% − ${p}% = ${100 - p}%`, `${f(x)} ÷ ${r2(1 - p / 100)} = **${f(x / (1 - p / 100))}**`] };
      if (before && tax && included) return { kind: "percent", value: r2(x / (1 + p / 100)), label: "Price before", steps: [`100% + ${p}% = ${100 + p}%`, `${f(x)} ÷ ${r2(1 + p / 100)} = **${f(x / (1 + p / 100))}**`] };
      if (before) return null;   // "before" without a clear discount / tax-included: the model reads it
      const total = /\b(total|altogether|in all|final)\b|(?<![\p{L}])(الاجمالي|المجموع|كله|علي بعض|النهائي|هدفع كام|هيبقي كام)(?![\p{L}])/u.test(t);
      if (disc) return { kind: "percent", value: r2(x * (1 - p / 100)), label: "Price after discount", steps: [`${f(x)} × ${p}% = ${f(x * p / 100)}`, `${f(x)} − ${f(x * p / 100)} = **${f(x * (1 - p / 100))}**`] };
      if ((tax || tip) && total) return { kind: "percent", value: r2(x * (1 + p / 100)), label: "Total", steps: [`${f(x)} × ${p}% = ${f(x * p / 100)}`, `${f(x)} + ${f(x * p / 100)} = **${f(x * (1 + p / 100))}**`] };
      if (tip) return { kind: "percent", value: r2(x * p / 100), label: "Tip", steps: [`${f(x)} × ${p}% = **${f(x * p / 100)}**`] };
      if (R(`${p}\\s*%\\s*(?:of|من)\\s*${x}(?!\\d)`).test(t)) return { kind: "percent", value: r2(x * p / 100), label: "Total", steps: [`${f(x)} × ${p}% = **${f(x * p / 100)}**`] };
      return null;
    }
  }

  // ---- a rate × a count (+ tax / − discount) ----
  {
    const rateRe = [R(`${N}\\s*(?:egp|le|pounds?|جنيه|ج|\\$|usd|dollars?)?\\s*${PER_EN}\\b`), R(`(?:ب|بسعر|سعر|at|for|@)?\\s*${N}\\s*(?:جنيه|ج|egp|le)?\\s*${PER_AR}(?![\\p{L}])`),
      R(`(?:سعر\\s+)?(?:الكيلو|كيلو\\s+\\p{L}+|تذكره\\s+\\p{L}+|الواحد[هة]?|القطعه|الحته|التذكره|الليله|اليوم|العلبه|الكيس|الازازه|القميص|التيشرت|الفرد|النفر|الشخص|الساعه|المتر|اللتر|الكرتونه)\\s*(?:\\p{L}+\\s+)?(?:ب|بسعر|=|:|is|at)\\s*${N}`)];
    let rate = null, rateAt = -1, rateLen = 0;
    for (const re of rateRe) { const k = re.exec(t); if (k) { rate = +k[1]; rateAt = k.index + k[0].lastIndexOf(k[1]); rateLen = k[1].length; break; } }   // (only the rate's own number is taken out: «عايز 3 كيلو الكيلو بـ 480»)
    if (rate != null) {
      const rest = t.slice(0, rateAt) + " ".repeat(rateLen) + t.slice(rateAt + rateLen);
      const cnt = R(`(?<![\\d.%])${N}\\s*(?:${UNIT_EN}|${UNIT_AR})(?![\\p{L}])`).exec(rest);
      const taxM = R(`${N}\\s*%\\s*(?:\\p{L}+\\s+)?(?:tax|vat|service|tip|ضريب\\p{L}*|قيمه مضافه|خدمه|بقشيش)|(?:tax|vat|service|ضريب\\p{L}*|خدمه)\\s*(?:of\\s+)?${N}\\s*%`).exec(rest);
      const discM = R(`${N}\\s*%\\s*(?:discount|off|خصم)|(?:discount|خصم)\\s*(?:of\\s+)?${N}\\s*%`).exec(rest);
      if (cnt) {
        const count = +cnt[1], tx = taxM ? +(taxM[1] || taxM[2]) : 0, dc = discM ? +(discM[1] || discM[2]) : 0;
        if (used([rate, count, ...(tx ? [tx] : []), ...(dc ? [dc] : [])]) && count > 0 && rate > 0) {
          const base = rate * count, steps = [`${f(rate)} × ${f(count)} = ${tx || dc ? f(base) : "**" + f(base) + "**"}`];
          let v = base;
          if (dc) { const d = v * dc / 100; steps.push(`${f(v)} − ${dc}% (${f(d)}) = ${tx ? f(v - d) : "**" + f(v - d) + "**"}`); v -= d; }
          if (tx) { const a = v * tx / 100; steps.push(`${f(v)} + ${tx}% (${f(a)}) = **${f(v + a)}**`); v += a; }
          return { kind: "rate", value: r2(v), label: "Total", steps };
        }
      }
    }
  }
  return null;
}

const AR_LABEL = { Left: "الباقي", "Monthly payment": "القسط الشهري", "Months needed": "عدد الشهور", "Per year": "في السنة", "Per month": "في الشهر", "Each part": "نصيب كل واحد", "Price before": "السعر قبل", "Price after discount": "السعر بعد الخصم", Tip: "البقشيش", Total: "الإجمالي" };
const CUR = [[/\begp\b|\ble\b|l\.e|جنيه|(?<![\p{L}])ج(?![\p{L}])|pounds?/iu, "EGP", "جنيه"], [/\busd\b|\$|dollars?|دولار/iu, "USD", "دولار"], [/\bsar\b|ريال/iu, "SAR", "ريال"], [/\baed\b|درهم/iu, "AED", "درهم"], [/\beur\b|€|euros?|يورو/iu, "EUR", "يورو"]];
/** The answer as Chat shows it: the result in bold with its label, then the working as numbered lines. */
export function quickSumMarkdown(q, text) {
  const ar = /[؀-ۿ]/.test(String(text || ""));
  const c = q.kind === "save" ? null : CUR.find(([re]) => re.test(norm(text)));
  const label = ar ? AR_LABEL[q.label] || q.label : tr(q.label);
  const unit = q.kind === "save" ? "" : c ? " " + (ar ? c[2] : c[1]) : "";
  return `**${label}: ${f(q.value)}${unit}**\n\n` + q.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
}

/** A short follow-up to a sum just answered — "and with 10% VAT?", «ولو 5 أيام؟», "what about 4 people?" — is the same sum with the new
 *  number put in its place → { q, text } or null. Only a percentage for a percentage, or a number with the same kind of unit. */
export function quickFollowUp(prevText, typed) {
  const t = norm(typed), p = norm(prevText);
  if (!quickSum(prevText) || t.split(" ").length > 9 || !/^\s*(?:and|what about|how about|what if|if|with|for|و|طب|طيب|ولو|لو|بس|مع|ب)(?![\p{L}])|\?|؟/u.test(t)) return null;
  const tp = t.match(/(\d+(?:\.\d+)?)\s*%/g) || [], pp = p.match(/(\d+(?:\.\d+)?)\s*%/g) || [];
  if (tp.length === 1 && nums(t).length === 1 && pp.length === 1) { const text = p.replace(pp[0], tp[0]); const q = quickSum(text); return q ? { q, text } : null; }
  const U = [["day|days|يوم|ايام", "day"], ["night|nights|ليله|ليالي", "night"], ["kg|kilo|kilos|كيلو", "kg"], ["month|months|شهر|شهور|اشهر", "month"], ["year|years|سنه|سنين|سنوات", "year"],
    ["people|persons|friends|افراد|اشخاص|نفر", "people"], ["hour|hours|ساعه|ساعات", "hour"]];
  const tn = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${U.map((u) => u[0]).join("|")})(?![\\p{L}])`, "iu").exec(t);
  if (tn && nums(t).length === 1) {
    const kind = (U.find((u) => new RegExp(`^(?:${u[0]})$`, "iu").test(tn[2])) || [])[1];
    const pm = [...p.matchAll(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${U.map((u) => u[0]).join("|")})(?![\\p{L}])`, "giu"))].filter((m) => (U.find((u) => new RegExp(`^(?:${u[0]})$`, "iu").test(m[2])) || [])[1] === kind);
    if (pm.length === 1) { const text = p.slice(0, pm[0].index) + tn[1] + " " + pm[0][2] + p.slice(pm[0].index + pm[0][0].length); const q = quickSum(text); return q ? { q, text } : null; }
  }
  return null;
}
