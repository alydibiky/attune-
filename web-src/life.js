/* ---- v6.27: the Life layer — people and commitments, shared by every tool (ROADMAP_2026-10-13.md, "Life layer") ------------
   Ali's example: "Ahmed owes me 12,000, 1,000 a month for a year" → Ahmed's page, 12 monthly checkboxes with reminders, and
   each tick = +1,000 in Money. Code first (the roadmap's rule): a sentence in English, formal Arabic or Egyptian Arabic is
   read by rules into a commitment; a model is only a fallback for what the rules can't read. One rule set per language
   (GLOBAL app: savings circles under their local names — جمعية, tanda, susu, chit fund, hui, arisan…).

   A commitment: { id, kind, person, dir, amount (each payment), total, count, every, start, title, myTurn, paid: [indexes] }
     kind  installment | debt | bill | subscription | rent | circle
     dir   "in" (money comes to me) | "out" (I pay)
     every "month" | "week" | "year" | null (once)
   Pure logic; stored in localStorage "attune:life:v1" by the UI. Tests: tests/unit/v727life.test.mjs.                          */

import { tr } from "./i18n.js";
import { payCurrency, payNumber } from "./yusr/paytext.js";
import { homeCurrency } from "./locale.js";

const AR_D = "٠١٢٣٤٥٦٧٨٩", FA_D = "۰۱۲۳۴۵۶۷۸۹";
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => AR_D.indexOf(d)).replace(/[۰-۹]/g, (d) => FA_D.indexOf(d)).replace(/٫/g, ".").replace(/٬/g, ",");
const fold = (s) => latin(s).replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$|[،,.!?؟])/g, "ه").replace(/[ًٌٍَُِّْـ]/g, "");

// ---- amounts ----------------------------------------------------------------------------------------------------------------
const WORDS_EN = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, fifty: 50, hundred: 100 };
const WORDS_AR = { "واحد": 1, "اتنين": 2, "اثنين": 2, "تلات": 3, "تلاته": 3, "ثلاث": 3, "ثلاثه": 3, "اربع": 4, "اربعه": 4, "خمس": 5, "خمسه": 5, "ست": 6, "سته": 6, "سبع": 7, "سبعه": 7,
  "تمن": 8, "تمانيه": 8, "ثماني": 8, "ثمانيه": 8, "تسع": 9, "تسعه": 9, "عشر": 10, "عشره": 10, "حداشر": 11, "اتناشر": 12, "اثنا عشر": 12, "اثني عشر": 12, "عشرين": 20, "تلاتين": 30, "ثلاثين": 30, "خمسين": 50, "مية": 100, "ميه": 100, "مائه": 100 };
/** Every amount in a text, in order: "12 ألف" → 12000, "1.5k" → 1500, "ألفين" → 2000, "١٢٠٠٠" → 12000. → [{ value, at }] */
export function amountsIn(text, cur) {
  const t = fold(text), out = [];
  // v6.27: any number format (1,500.00 · 1.500,00 · 12,50) — payNumber reads it as the payment reader does
  const re = /(\d[\d,.]*\d|\d)\s*(k|الف|الاف|آلاف|ألف|thousand|mil\b|mille|tausend|bin\b|ribu|rb\b|مليون|million|millones|millions|millionen|milioni|milyon|juta|m\b)?|(?:^|\s)(الفين|ألفين|الف|ألف)(?=\s|$|[،,.])/gi;
  let m;
  while ((m = re.exec(t))) {
    // not money: a count ("12 installments", "36 شهر"), a day ("on the 5th", "يوم 5") or a turn ("my turn is 4", "month 4")
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 22), before = t.slice(Math.max(0, m.index - 14), m.index);
    if (!m[3] && !m[2] && (new RegExp("^\\s*(?:st|nd|rd|th|er|º|ª|\\.)?\\s*(?:monthly\\s+|weekly\\s+)?(?:" + UNITS + "|weeks?|years?|days?|اسابيع|سنين|سنوات|ايام|semanas?|semaines?|wochen|settimane|hafta|minggu|años?|ans?|anos?|jahre?|anni|yıl|tahun|días?|jours?|dias?|tage?|giorni|gün|hari)(?![\\p{L}])", "iu").test(after)
      || /(?:on the|\bday|يوم|turn is|\bturn|\bmonth|دوري|الشهر رقم|\bis)\s*$/i.test(before)   /* v7.9: a whole word — "Saturday 600" is money */ || /^(?:st|nd|rd|th)\b/.test(after)
      || nextToMonth(before, after))) continue;
    if (m[3]) { out.push({ value: /الفين|ألفين/.test(m[3]) ? 2000 : 1000, at: m.index }); continue; }
    let v = payNumber(m[1], cur); if (!isFinite(v)) continue;
    const u = (m[2] || "").toLowerCase();
    // v9.0 (the plans bank: «أحمد عليه 12000 ألف كل شهر» became 12 million): an Arabic "thousand" after a number of 1,000 or more is
    // a second amount — "12,000, a thousand a month" — nobody writes 12000 ألف for 12 million (that is «12 مليون»)
    if (/^(الف|الاف|آلاف|ألف)$/.test(u) && v >= 1000) { out.push({ value: v, at: m.index }); out.push({ value: 1000, at: m.index + m[0].length - u.length }); continue; }
    if (/^(k|الف|الاف|آلاف|ألف|thousand|mil|mille|tausend|bin|ribu|rb)$/.test(u)) v *= 1000; else if (/^(مليون|million|m|millones|millions|millionen|milioni|milyon|juta)$/.test(u)) v *= 1e6;
    out.push({ value: v, at: m.index });
  }
  return out;
}

// ---- how many / how often / when ---------------------------------------------------------------------------------------------
// v6.27: payments and months in the world's common languages (cuotas, mensualités, parcelas, Raten, rate, taksit, cicilan…)
const UNITS = "installments?|instalments?|payments?|months?|monthly payments|اقساط|قسط|دفعات|دفعه|شهور|اشهر|شهر|cuotas?|plazos?|pagos?|meses|mes|mensualidades|mensualités|paiements?|mois|versements?|parcelas?|prestações|prestação|raten|rate|monate?|mesi|taksit|ay|cicilan|bulan|angsuran";
function countOf(t) {
  let m = new RegExp("(\\d+)\\s*(?:monthly\\s+|weekly\\s+)?(?:" + UNITS + ")(?![\\p{L}])", "iu").exec(t);
  if (m) return +m[1];
  m = new RegExp("(?:^|\\s)(" + Object.keys(WORDS_EN).join("|") + ")\\s+(?:installments?|payments?|months?)", "i").exec(t);
  if (m) return WORDS_EN[m[1].toLowerCase()];
  m = new RegExp("(?:^|\\s)(" + Object.keys(WORDS_AR).join("|") + ")\\s+(?:اقساط|قسط|دفعات|شهور|اشهر)").exec(t);
  if (m) return WORDS_AR[m[1]];
  if (/\b(for|over) (a|one) year\b|لمده سنه|علي سنه|لسنه|سنه كامله|(?:^|\s)سنه(?=\s|$)|durante un año|en un año|pendant un an|sur un an|durante um ano|em um ano|ein jahr lang|für ein jahr|per un anno|bir yıl boyunca|selama setahun/.test(t)) return 12;
  if (/\b(for|over) two years\b|سنتين/.test(t)) return 24;
  if (/\b(for|over) (six|6) months\b|نص سنه/.test(t)) return 6;
  return 0;
}
const EVERY_M = /\b(a|per|every|each) month\b|\b(?:every|each)\s+(?:first|1st|last|beginning|start|end)\b.{0,15}\bmonth\b|\b(?:first|1st|beginning|start)\s+(?:day\s+)?of\s+(?:every|each)\s+month\b|اول كل شهر|أول كل شهر|كل اول الشهر|كل أول الشهر|اول الشهر من كل شهر|\bmonthly\b|كل شهر|شهري|شهريا|في الشهر|بالشهر|كل اول شهر|al mes|por mes|cada mes|mensual|par mois|chaque mois|tous les mois|mensuel|por mês|ao mês|todo mês|todos os meses|mensal|pro monat|im monat|jeden monat|monatlich|al mese|ogni mese|mensile|her ay|aylık|ayda|per bulan|setiap bulan|tiap bulan|bulanan/;
const EVERY_W = /\b(a|per|every|each) week\b|\bweekly\b|كل اسبوع|اسبوعي|اسبوعيا|في الاسبوع|por semana|cada semana|semanal|par semaine|chaque semaine|hebdomadaire|pro woche|jede woche|wöchentlich|a settimana|ogni settimana|settimanale|her hafta|haftalık|per minggu|setiap minggu|mingguan/;
function everyOf(t) {
  if (EVERY_M.test(t)) return "month";
  if (EVERY_W.test(t)) return "week";
  if (/\b(a|per|every|each) year\b|\byearly\b|\bannual(ly)?\b|كل سنه|سنوي|سنويا|al año|por año|cada año|anual|par an|chaque année|annuel|por ano|todo ano|pro jahr|jährlich|all'anno|ogni anno|annuale|her yıl|yıllık|per tahun|setiap tahun|tahunan/.test(t)) return "year";
  if (/installments?|instalments?|اقساط|قسط|تقسيط|cuotas|mensualités|parcelas|raten|rate\b|taksit|cicilan|angsuran/.test(t)) return "month";
  return null;
}
// v6.27: month names in English, Arabic (Egypt/Gulf and Levant/Iraq), Spanish, French, Portuguese, German, Italian, Turkish,
// Indonesian and Dutch — whole names (or a 3-letter English/German short form), never a word that starts like one ("market")
// a day written next to a month name ("15 November", "Nov 15", "1 de diciembre") is a date, not an amount
let MONTH_ANY = null;
function nextToMonth(before, after) {
  MONTH_ANY = MONTH_ANY || "(?:" + MONTH_NAMES.join("|") + ")";
  return new RegExp("^\\s*(?:st|nd|rd|th|er|º|\\.)?\\s*(?:de\\s+|of\\s+)?" + MONTH_ANY + "(?![\\p{L}])", "iu").test(after)
    || new RegExp("(?<![\\p{L}])" + MONTH_ANY + "\\.?\\s*$", "iu").test(before);
}
export const MONTH_NAMES = [
  "jan(?:uary)?|يناير|كانون الثاني|enero|janvier|janeiro|januar|gennaio|ocak|januari",
  "feb(?:ruary)?|فبراير|شباط|febrero|février|fevrier|fevereiro|februar|febbraio|şubat|subat|februari",
  "mar(?:ch)?|مارس|اذار|آذار|marzo|mars|março|marco|märz|maerz|mart|maret|maart",
  "apr(?:il)?|ابريل|نيسان|abril|avril|aprile|nisan|april",
  "may|مايو|ايار|أيار|mayo|mai|maio|maggio|mayıs|mayis|mei",
  "jun(?:e)?|يونيو|حزيران|junio|juin|junho|juni|giugno|haziran",
  "jul(?:y)?|يوليو|تموز|julio|juillet|julho|juli|luglio|temmuz",
  "aug(?:ust)?|اغسطس|آب|اب|agosto|août|aout|august|ağustos|agustus|augustus",
  "sep(?:t(?:ember)?)?|سبتمبر|ايلول|أيلول|septiembre|setiembre|septembre|setembro|settembre|eylül|eylul|september",
  "oct(?:ober)?|okt|اكتوبر|تشرين الاول|octubre|octobre|outubro|oktober|ottobre|ekim",
  "nov(?:ember)?|نوفمبر|تشرين الثاني|noviembre|novembre|novembro|kasım|kasim|november",
  "dec(?:ember)?|dez|ديسمبر|كانون الاول|diciembre|décembre|decembre|dezembro|dezember|dicembre|aralık|aralik|desember|december",
];
const WEEKDAYS = { "sun(?:day)?": 0, "mon(?:day)?": 1, "tue(?:s|sday)?": 2, "wed(?:nesday)?": 3, "thu(?:rs|rsday)?": 4, "fri(?:day)?": 5, "sat(?:urday)?": 6, "الاحد": 0, "الاتنين": 1, "الاثنين": 1, "التلات": 2, "الثلاثاء": 2, "الاربع": 3, "الاربعاء": 3, "الخميس": 4, "الجمعه": 5, "السبت": 6 };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** The first date mentioned (a month name → its 1st, or the "day N" in it; a weekday → the next one; "next month"), else "". */
function startOf(t, now) {
  const d0 = new Date(now); d0.setHours(12, 0, 0, 0);
  let dayN = (/(?:on the|day|يوم|el día|le|am|il|dia)\s*(\d{1,2})(?:st|nd|rd|th|er|º|\.)?\b/i.exec(t) || [])[1];
  // v9.8 (Ali: "I pay 700 for the man who washes the car the first day of each month"): the first of the month = day 1
  if (!dayN && /\b(?:first|1st|beginning|start)\s+(?:day\s+)?of\s+(?:the\s+|each\s+|every\s+)?month\b|\b(?:every|each)\s+(?:first|1st)\s+(?:day\s+)?of\s+(?:the\s+)?month\b|اول (?:كل )?(?:ال)?شهر|أول (?:كل )?(?:ال)?شهر/i.test(t)) dayN = "1";
  for (let m = 0; m < 12; m++) {
    const k = "(?:" + MONTH_NAMES[m] + ")\\.?";
    const near = new RegExp("(\\d{1,2})(?:st|nd|rd|th|er|º|\\.)?\\s*(?:de\\s+|of\\s+)?" + k + "(?![\\p{L}])|(?<![\\p{L}])" + k + "\\s+(\\d{1,2})(?!\\d)", "iu").exec(t);
    if (near) dayN = near[1] || near[2];
    if (near || new RegExp("(^|\\s|من |اول |from |starting |in |en |a partir de |à partir de |ab |dal |desde )" + k + "(?=\\s|$|[،,.\\d])", "iu").test(t)) {
      const y = m < d0.getMonth() || (m === d0.getMonth() && dayN && +dayN < d0.getDate()) ? d0.getFullYear() + 1 : d0.getFullYear();
      return iso(new Date(y, m, dayN ? +dayN : 1, 12));
    }
  }
  for (const [k, w] of Object.entries(WEEKDAYS)) {
    if (new RegExp("(^|\\s)(on |يوم |due )?" + k + "(?=\\s|$|[،,.])", "i").test(t)) {
      const d = new Date(d0); d.setDate(d.getDate() + ((w - d.getDay() + 7) % 7 || 7)); return iso(d);
    }
  }
  if (/\bnext month\b|الشهر الجاي|الشهر القادم|الشهر اللي جاي|próximo mes|mes que viene|mois prochain|mês que vem|próximo mês|nächsten monat|prossimo mese|gelecek ay|bulan depan/.test(t)) return iso(new Date(d0.getFullYear(), d0.getMonth() + 1, dayN ? +dayN : 1, 12));
  if (/\btomorrow\b|بكره|بكرة|غدا|mañana|demain|amanhã|morgen|domani|yarın|besok/.test(t)) { const d = new Date(d0); d.setDate(d.getDate() + 1); return iso(d); }
  if (dayN) { const d = new Date(d0.getFullYear(), d0.getMonth(), +dayN, 12); if (d < d0) d.setMonth(d.getMonth() + 1); return iso(d); }
  return "";
}

// ---- who ---------------------------------------------------------------------------------------------------------------------
const NOT_NAME = /^(i|me|my|he|she|they|we|you|him|her|them|the|a|an|his|it|this|that|انا|هو|هي|هم|احنا|انت|عليه|عليها|عليا|ليا|ليه|لي|من|علي|الي|في|ده|دي|كل|شهر|كمان)$/i;
function personOf(raw, t) {
  const tries = [
    /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(?:owes|will pay|is paying|pays|borrowed|took(?=[^.]{0,25}\bfrom me\b)|has to pay|must pay|will give|gives|will send|will return|is giving)\b/,
    /\b(?:lent|loaned|gave|owe|paid|pay|to|from|with|lend|Lent)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/,
    /\b(?:owe|from|to)\s+([A-Z]{2,5})\b/,   // a bank's short name: CIB, NBE, QNB
  ];
  // (v9.0: «علي عليه 1000» — Ali, the name, spelled like «علي» "on"; first in the sentence and before «عليه» it can only be the name)
  if (/^\s*(?:(?:صاحبي|صديقي|زميلي|جاري|اخويا|أخويا|ابن عمي|ابن خالي)\s+)?علي\s+(?:عليه|هيدفعلي|هيرجعلي|مديون|استلف مني|خد مني|اخد مني)/.test(raw)) return "علي";   // v9.9.15: «صاحبي علي استلف مني 450»
  for (const re of tries) { const m = re.exec(raw); if (m && !NOT_NAME.test(m[1])) return m[1]; }
  // v8.9 (Ali: "People & plans still doesn't understand"): "my sister pays me 2000 every month" — a relative is who it is
  const rel = /\bmy\s+(sister|brother|mother|mom|mum|father|dad|son|daughter|uncle|aunt|cousin|friend|boss|neighbou?r|wife|husband|landlord|tenant|partner|colleague)\b/i.exec(raw);
  if (rel && /\b(owes|pays|will pay|gives|will give|lent|borrowed|owe|paid|sends|will send)\b/i.test(raw)) return rel[1][0].toUpperCase() + rel[1].slice(1).toLowerCase();
  // v8.2 (Ali typed "sheikh owes me 22,000 …" in small letters): the word before "owes" is the name, capitalised
  const low = /(?:^|[\s,.])([a-z][a-z'-]{1,20})\s+(?:owes|will pay|is paying|has to pay|must pay|borrowed|took(?=[^.]{0,25}\bfrom me\b))\b/i.exec(raw);
  if (low && !NOT_NAME.test(low[1]) && !/^(also|still|now|friend|brother|sister|cousin|neighbou?r|uncle|aunt|boss|client|customer)$/i.test(low[1])) return low[1][0].toUpperCase() + low[1].slice(1).toLowerCase();
  // v8.6 (the 2-month test: "I lent mohamed 700", "I owe the grocer 120" became plain expenses): a small-letter name, or "the grocer",
  // after lent / owe / borrowed from
  const low2 = /\b(?:lent|loaned|owe|borrowed\s+(?:[\d,.]+\s+)?from)\s+(?:the\s+|my\s+|our\s+)?([a-z][a-z'-]{1,20})\b/i.exec(raw);
  if (low2 && !NOT_NAME.test(low2[1]) && !/^(me|you|him|her|them|us|money|it|this|that|some|a|an|\d.*)$/i.test(low2[1])) return low2[1][0].toUpperCase() + low2[1].slice(1).toLowerCase();
  // persona 9 (28 Oct): English with an Arabic-script name — "محمد owes me 1730", "I lent محمد 1603" became plain expenses
  const mixed = /(?:^|\s)([ء-ي]{2,})\s+(?:owes|will pay|is paying|has to pay|must pay|borrowed)\b/i.exec(raw) || /\b(?:lent|loaned|owe|borrowed\s+(?:[\d,.]+\s+)?from)\s+([ء-ي]{2,})/i.exec(raw);
  if (mixed && !NOT_NAME.test(mixed[1])) return mixed[1];
  // v6.27: Spanish, French, Portuguese, German, Italian, Turkish, Indonesian
  const N = "(\\p{Lu}[\\p{Ll}'’-]+(?:\\s\\p{Lu}[\\p{Ll}'’-]+)?)";
  const world = [
    new RegExp(N + "\\s+(?:me debe|me doit|me deve|schuldet mir|mi deve|bana borçlu|berutang (?:kepada|ke|pada) saya|me tiene que pagar|doit me rendre|vai me pagar|zahlt mir)(?![\\p{L}])", "u"),
    new RegExp("(?:le\\s+|lui\\s+)?(?:presté a|prêté à|prete a|emprestei (?:para|a|ao|à)|geliehen an|lieh|prestato a|borç verdim|meminjamkan(?: uang)? (?:kepada|ke)|le debo a|je dois à|devo (?:a|para|ao)|schulde|devo a|borcum var|berutang (?:kepada|ke))\\s+" + N, "iu"),
    new RegExp("(?:a|à|para|ao|an|ke|kepada)\\s+" + N + "\\s+(?:le presté|j'ai prêté|emprestei|habe ich geliehen|ho prestato)", "u"),
  ];
  for (const re of world) { const m = re.exec(raw); if (m && !NOT_NAME.test(m[1])) return m[1]; }
  const ar = [
    /(?:^|\s)([ء-ي]{2,})\s+(?:عليه|عليها|هيدفعلي|هيدفع|هيرجعلي|هيرجع|مديون|مدين|استلف مني|استلفت مني|اخد مني|اخدت مني|خد مني|خدت مني|يدفعلي|سيدفع|يسدد)/,   // v9.9.15: «ماما استلفت مني 850»
    // v9.9.15 (the 10,000-sentence run): «استلفت 700 من كريم» — the amount between the verb and the name — was saved as a 700 expense
    /(?:سلفت|اسلفت|اقرضت|ادينت|اديت|عليا ل|علي ل|مديون ل|مدين ل|(?:استلفت|اخدت|خدت|اقترضت)\s+(?:[\d٠-٩][\d٠-٩,.٬]*\s*(?:جنيه|جنية|ج|الف|ألف|k)?\s+)?من)\s*([ء-ي]{2,})/,
    /(?:^|\s)ل([ء-ي]{2,})\s+(?:عندي|عليا)/,
    /(?:ليا|لي|ليه)\s+(?:عند|مع|معاه)\s*([ء-ي]{2,})/,
    /(?:^|\s)([ء-ي]{2,})\s+(?:هيديني|هتديني|بيديني|بتديني|هترجعلي|بتدفعلي|بيدفعلي|بتبعتلي|بيبعتلي)/,
  ];
  // (persona 2: «أحمد عليه ٥٠٠» was saved as «احمد» — the name is taken back from what was typed, hamza and all)
  const plain = (x) => String(x).replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
  const asTyped = (n) => String(raw).split(/[\s،,.]+/).map((w) => w.replace(/^ل(?=[ء-ي]{3,})/, "")).find((w) => plain(w) === plain(n)) || n;
  for (const re of ar) { const m = re.exec(t); if (m && !NOT_NAME.test(m[1])) return asTyped(m[1].replace(/^ل(?=[ء-ي]{3,})/, "")); }
  return "";
}

// ---- the sentence → a commitment -----------------------------------------------------------------------------------------
const CIRCLE = /\b(savings circle|money circle|rosca|tanda|susu|chit fund|hui|arisan|tontine|pasanaku|cundina|paluwagan|kameti|committee|gam'?[3a]?[ei]?ya|gameya|gamaeya|gamiya|gam3eya)\b|جمعيه|جمعية/i;
const SUBS = /\b(netflix|spotify|shahid|osn|youtube premium|icloud|google one|chatgpt|gym|subscription|membership|disney\+?|hulu|hbo|max|paramount\+?|prime video|apple (?:tv|music|one)|deezer|crunchyroll|xbox|playstation plus|game pass|microsoft 365|office 365|dropbox|notion|duolingo|audible|kindle unlimited|linkedin premium|suscripción|suscripcion|abonnement|assinatura|abo|abbonamento|abonelik|langganan|gimnasio|salle de sport|academia|fitnessstudio|palestra|spor salonu)\b|اشتراك|نتفليكس|شاهد|الجيم|جيم/i;
const RENT = /\b(rent|alquiler|arriendo|loyer|aluguel|miete|affitto|kira|sewa)\b|ايجار|الايجار/i;
const BILL = /\b(bill|electricity|water|gas bill|internet|phone bill|due|factura|recibo|facture|conta de|rechnung|bolletta|fatura|tagihan|luz|électricité|strom|elettricità|elektrik|listrik)\b|فاتوره|فاتورة|الكهربا|كهربا|الكهرباء|المياه|الميه|النت|الانترنت|التليفون|الغاز/i;
// v8.2: an amount said WITH "a month" ("1,000 a month", «1000 في الشهر») is each payment; "owes me 22,000 … monthly for 9 months" is a total
const PER_AMOUNT = /(?:\d|الف|ألف|آلاف|الاف|مية|ميه|thousand|hundred)\s*(?:k|egp|le|usd|sar|aed|\$|جنيه|ج|ريال|درهم)?\s*(?:(?:a|per|every|each)\s+(?:month|week)|monthly|weekly|كل\s*(?:ال)?(?:شهر|اسبوع)|في\s*(?:ال)?(?:شهر|اسبوع)|بال(?:شهر|اسبوع)|شهريا|اسبوعيا)/;
// v8.4 (Ali, 27 Oct: "22,000 total for the next 9 months to be paid in installments" was read as 22,000 a month): "total" is the
// whole sum; one amount is each payment only when the per-month words are ON it ("1,000 a month"); else, when "monthly" is
// somewhere in the sentence, it could be either — the preview offers both readings (alt) and the person picks
const TOTAL_W = /\b(total|in total|in all|altogether|all together|the whole|whole amount|overall|full amount)\b|اجمالي|الاجمالي|كله|كلهم|بالكامل|المبلغ الكلي/;
function oneAmount(t) {
  if (TOTAL_W.test(t)) return "total";
  if (/\b(?:in|over|en|sur|em|auf|su|dalam)\s+\d+|عل[يى]\s*\d+/.test(t)) return "total";
  if (PER_AMOUNT.test(latin(t))) return "each";
  if (EVERY_M.test(t) || EVERY_W.test(t)) return "unsure";
  return "total";
}
const PAY_V = /\b(pay|paid|paying|pays|pay back|repay|settle)\b|ادفع|يدفع|هدفع|هيدفع|دفع|اسدد|يسدد|سداد|هسدد/;
const IN_W = /me debe|me doit|me deve|schuldet mir|mi deve|bana borçlu|berutang (?:kepada|ke|pada) saya|le presté|lui ai prêté|j'ai prêté|emprestei|habe .{0,30}geliehen|ho prestato|borç verdim|meminjamkan|me tiene que pagar|doit me rendre|vai me pagar|zahlt mir/i;
const OUT_W = /\b(le debo|je dois|eu devo|ich schulde|gli devo|le devo|borçluyum|saya berutang|pedí prestado|j'ai emprunté|peguei emprestado|habe mir .{0,30}geliehen|ho preso in prestito|borç aldım|saya meminjam|mi cuota|ma mensualité|minha parcela|meine rate|la mia rata|taksitim|cicilan saya)\b/i;
// v9.4 (the sentence battery: "Mona borrowed 4500 from me" was not read): someone borrowed from me / took a loan from me = they owe me
const IN_ = /\b(?:borrowed|took|loaned)\s+(?:[\d,.]+\s*k?\s*)?(?:\S+\s+){0,2}from me\b|استلف مني|استلفت مني|اخد مني|خد مني|اخدت مني|خدت مني|اقترض مني|\bowes me\b|\bwill pay me\b|\bpays me\b|\b(?:will|is going to|is to|has to|must|should) (?:give|send|return|transfer) me\b|\bgives me\b|\bowe(?:s)? me back\b|ليا عند|ليا مع|لي عند|ليا معاه|هيديني|هتديني|بيديني|بتديني|هترجعلي|بتدفعلي|بيدفعلي|بتبعتلي|بيبعتلي|\bi lent\b|\bi loaned\b|(?:^|\s)lent\s+(?!me\b)|\blent\b.*\bto\b|سيدفع|سيسدد|هيسدد|هيدفع(?!ل)|\bto pay me back\b|\bi gave\b.*\b(loan|borrow)|عليه|عليها|هيدفعلي|يدفعلي|هيرجعلي|سلفت|اسلفت|اقرضت|ادينت|استلف مني|اخد مني|خد مني|مديون ليا|مدين لي/i;
const OUT_ = /\bi owe\b|\bi borrowed\b|\bi have to pay\b|\bi must pay\b|\bmy (installment|instalment)s?\b|عليا|علي ل|استلفت|اقترضت|اخدت من|خدت من|مديون ل|لازم ادفع|هدفع|قسط العربيه|قسطي|اقساطي/i;

// v6.34 (Ali: "the maid comes every Saturday and takes 600 EGP — a checkbox when I log in on Saturday, and it records the expense
// by itself"): someone who comes on a day and is paid each time → kind "regular", a checkbox on each day, ticked = spent in Money
const HELP = /\b(maid|housekeeper|cleaner|cleaning lady|nanny|babysitter|driver|gardener|tutor|private teacher|coach|trainer|doorman|cook|nurse|physio(?:therapist)?|car wash(?:er)?|wash(?:es|ed|ing)?\s+(?:the\s+|my\s+)?cars?|car\s+cleaner)\b|الشغال[هة]|شغال[هة]|الداد[هة]|داد[هة]|السواق|سواق|المدرس|مدرس|المدرسه الخصوصي|الجنايني|جنايني|البواب|بواب|الطباخ|طباخ|الممرض[هة]|ممرض[هة]|الكوتش|كوتش|المدرب|مدرب|عامله النظاف[هة]|ست النظاف[هة]|اللي بتنضف|غسيل العربي[هة]|بيغسل العربي[هة]|يغسل العربي[هة]|غسال العربي[هة]|اللي بيغسل/i;
const DAY_EVERY = /\b(every|each|on)\s+(sun|mon|tue|wed|thu|fri|sat)(?:day|s|sday|nesday|rsday|rs|urday)?s?\b|كل\s+(يوم\s+)?(احد|حد|اتنين|اثنين|تلات|ثلاثاء|اربع|اربعاء|خميس|جمعه|سبت)|(?:كل|يوم)\s+(ال)?(احد|حد|اتنين|اثنين|تلات|ثلاثاء|اربع|اربعاء|خميس|جمعه|سبت)/i;

/** The name of a bill / subscription: the words before its amount («فاتورة الكهربا ٦٤٠» → «فاتورة الكهربا», "Netflix 200" → "Netflix"). */
function nameBefore(raw, fallback) {
  const lead = String(raw).split(/[\d\u0660-\u0669$€£]/)[0].replace(/[:،,\-–—]+\s*$/, "").replace(/\s+/g, " ").trim()
    // v9.8 ("I pay 1500 for the gym every month" was named "I pay"): the payer and the verb are not the name
    .replace(/^(?:i|we)\s+(?:pay|paid|am paying|spend|give|send|transfer)\s*(?:for\s+|to\s+)?(?:the\s+|my\s+)?|^(?:بدفع|بادفع|بندفع|دفعت)\s*/i, "").trim();
  const words = lead.split(" ").filter(Boolean);
  if (!words.length) { const after = /\b(?:for|to)\s+(?:the\s+|my\s+)?([\p{L}]+(?:\s+[\p{L}]+)?)/iu.exec(String(raw).replace(/\b(?:every|each|a|per)\s+(?:month|week|year)\b.*$/i, "")); if (after) return after[1][0].toUpperCase() + after[1].slice(1); }
  return words.length && words.length <= 5 ? words.join(" ") : fallback;
}

/**
 * One sentence → a commitment, or null when the rules can't read it (then a model may try, with the same fields).
 * now: for dates; currency: the default currency.
 */
const BANKS = "bank|cib|nbe|banque misr|qnb|hsbc|aaib|alex bank|adib|emirates nbd|banque du caire|البنك|بنك|بنك مصر|البنك الأهلي|البنك الاهلي";
function bankLoan(t0) {
  const t = String(t0 || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  if (!/\bloan\b|قرض|سلفة من البنك/i.test(t)) return t0;
  const bank = new RegExp("(?:from|with|at|من)\\s+((?:the\\s+)?(?:" + BANKS + ")(?:\\s+[A-Z][\\w]*)?)", "i").exec(t);
  if (bank && /^[a-z]{2,5}$/i.test(bank[1]) && !/^bank$/i.test(bank[1])) bank[1] = bank[1].toUpperCase();
  const amt = /(\d[\d,.]*)\s*(k|الف|ألف|thousand)?/i.exec(t.replace(/\b(\d{1,3})\s*(months?|years?|شهر|شهور|سنين|سنة|سنه|سنوات)\b/gi, " "));
  let per = /(?:for|over|on|in|على|علي|لمدة|مدة)?\s*(\d{1,3})\s*(months?|شهر|شهور|years?|سنين|سنة|سنه|سنوات)(?!\s*(?:a|per|each)?\s*month)/i.exec(t.replace(/(\d[\d,.]*)\s*(?:k|الف|ألف)?\s*(?:a|per|each)\s+month|(\d[\d,.]*)\s*(?:كل شهر|في الشهر|شهريا|شهرياً)/gi, " "));
  // v9.0 (the bank: «… لمدة سنة» — a year with no number; "سنتين" — two years)
  if (!per) { const y = /(?:for|over|لمدة|مدة|على|علي)\s+(?:a|one|واحده?)?\s*(year|سنة|سنه)(?![\p{L}])|(?:for|over|لمدة|مدة|على|علي)\s+(two years|سنتين)/iu.exec(t); if (y) per = [y[0], y[2] ? "2" : "1", "year"]; }
  if (!bank || !amt || !per) return t0;
  const n = +amt[1].replace(/,/g, "") * (amt[2] ? 1000 : 1), months = +per[1] * (/year|سن/i.test(per[2]) ? 12 : 1);
  if (!(n > 0) || !(months >= 2 && months <= 360)) return t0;
  const who = bank[1].replace(/^the\s+/i, "").replace(/^(bank|البنك|بنك)$/i, (b) => (/[ء-ي]/.test(b) ? "البنك" : tr("Bank")));
  // v9.0 (the bank: "loan 10000 from the bank, 1000 a month for 12 months" became 833 a month): the monthly payment said is the
  // payment — the interest is in it (12 × 1,000 = 12,000 to pay)
  const pm = /(\d[\d,.]*)\s*(k|الف|ألف)?\s*(?:a|per|each)\s+month|(\d[\d,.]*)\s*(الف|ألف)?\s*(?:كل شهر|في الشهر|شهريا|شهرياً)/i.exec(t);
  const each = pm ? +String(pm[1] || pm[3]).replace(/,/g, "") * ((pm[2] || pm[4]) ? 1000 : 1) : 0;
  if (each > 0 && each < n * 2 && each * months >= n * 0.9) return `I owe ${who} ${each} each month, ${months} installments`;
  return `I owe ${who} ${n} over ${months} months`;
}
export function parseLife(text, { now = Date.now(), currency = homeCurrency() } = {}) {
  // persona 1: a bank loan — "loan 5000 from the bank, 12 months", "a loan of 60000 from CIB for 24 months", «قرض ١٠٠ الف من البنك
  // على ٣ سنين» — is money you owe the bank in monthly payments (the principal; interest can be added on its page)
  text = bankLoan(text);
  const raw = String(text || "").trim(); if (!raw) return null;
  const t = fold(raw).toLowerCase();
  // v6.27: the currency as the payment reader sees it (any currency in the world), else the person's own
  const cur = payCurrency(raw, currency) || currency;
  const amts = amountsIn(raw, cur).map((a) => a.value).filter((v) => v > 0);
  if (!amts.length) return null;
  const count = countOf(t), every = everyOf(t), start = startOf(t, now), person = personOf(raw, fold(raw));
  const base = { person, currency: cur, start, every, paid: [], title: "" };
  // v9.9.15 C3 (Ali picked it, 11 Nov: "I will pay Ahmed 4500 next week" — "it should ask me on the day if I paid, and if I did it goes
  // to Money after asking which balance and which category"): something I WILL pay, once, on a day → a one-time payment due that day
  // (kind "bill": Follow-ups asks "did you pay?" on the day; "who pays it / from which balance" as for every payment)
  { const FP = /\b(?:i(?:'ll| will| should| need to| have to| must| am going to| want to)|gonna|need to|have to)\s+pay\b|(?<![ء-ي])(?:هدفع|هسدد)(?![ء-ي])|(?:لازم|عايز|عاوز|محتاج|ناوي)\s+(?:ادفع|اسدد)/i;
    if (FP.test(raw) && !count && !every && amts.length === 1 && !/\b(?:owe|owes|borrow|lent|installments?|instalments?)\b|قسط|اقساط|استلف|سلف/i.test(raw)) {
      const isAr = /[ء-ي]/.test(raw);
      let st = start;
      if (!st) { const d = new Date(now); d.setHours(12, 0, 0, 0);
        const W = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, "حد": 0, "احد": 0, "اتنين": 1, "اثنين": 1, "تلات": 2, "ثلاثاء": 2, "اربع": 3, "اربعاء": 3, "خميس": 4, "جمعه": 5, "سبت": 6 };
        const wd = /\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i.exec(raw) || /(?:^|\s)(?:يوم\s+)?(?:ال)?(احد|حد|اتنين|اثنين|تلات|ثلاثاء|اربعاء|اربع|خميس|جمعه|سبت)(?=$|\s)/.exec(t);
        if (/\bnext week\b|الاسبوع الجاي|الاسبوع اللي جاي|الاسبوع القادم/i.test(t)) { d.setDate(d.getDate() + 7); st = iso(d); }
        else if (/\btomorrow\b|بكره|بكرة/i.test(t)) { d.setDate(d.getDate() + 1); st = iso(d); }
        else if (/\bnext month\b|الشهر الجاي|الشهر اللي جاي/i.test(t)) { d.setMonth(d.getMonth() + 1); st = iso(d); }
        else if (wd) { const k = (wd[1] || "").toLowerCase(); d.setDate(d.getDate() + (((W[k] - d.getDay() + 7) % 7) || 7)); st = iso(d); } }
      if (st) {
        const thing = (/\bfor\s+(?:the\s+|my\s+|a\s+)?([a-z][a-z' -]{1,28}?)(?=\s+(?:by|on|next|before|this|tomorrow|in)\b|\s*[.!]?$)/i.exec(raw) || [])[1] || "";
        const title = person ? (isAr ? "دفع ل" + person : "Pay " + person) : thing ? thing[0].toUpperCase() + thing.slice(1) : isAr ? "دفعة" : "Payment";
        return { ...base, start: st, kind: "bill", dir: "out", amount: amts[0], count: 1, total: amts[0], every: null, title, planned: true };
      } } }
  // a savings circle: "جمعية 2000 في الشهر لمدة 10 شهور ودوري الرابع"
  if (CIRCLE.test(raw)) {
    const turn = (/(?:my turn|i get it|i take it|دوري|بقبض|هقبض|اقبض)[^\d٠-٩]{0,20}(\d+)/i.exec(latin(t)) || [])[1]
      || ({ "الاول": 1, "التاني": 2, "الثاني": 2, "التالت": 3, "الثالث": 3, "الرابع": 4, "الخامس": 5, "السادس": 6, "السابع": 7, "التامن": 8, "الثامن": 8, "التاسع": 9, "العاشر": 10 })[(/(?:دوري|بقبض|هقبض)\s*(?:في\s*)?(?:الشهر\s*)?(ال[ء-ي]+)/.exec(t) || [])[1]] || 0;
    const ppl = /(\d+)\s*(?:people|persons|members|friends|افراد|أفراد|فرد|نفر|اشخاص|أشخاص|واحد)/i.exec(latin(t));
    const n = count || (ppl ? +ppl[1] : 0) || 10;
    const camt = amts.filter((v) => v !== n && v !== +turn)[0] || amts[0];
    return { ...base, kind: "circle", dir: "out", amount: camt, count: n, total: camt * n, every: every || "month", myTurn: +turn || 0, title: CIRCLE.exec(raw)[0] };
  }
  const dirIn = IN_.test(t) || IN_.test(raw) || IN_W.test(raw), dirOut = !dirIn && (OUT_.test(t) || OUT_.test(raw) || OUT_W.test(raw));
  // money owed between people: one sum (a debt) or paid in parts (installments)
  if (person && dirIn && every && !count && amts.length === 1 && /\b(pays|gives|sends)\s+me\b|\b(will|is going to|gonna)\s+(pay|give|send)\s+me\b|بيدفعلي|بتدفعلي|بيديني|بتديني|بيبعتلي|بتبعتلي|هيديني|هتديني|هيدفعلي|هتدفعلي/i.test(raw) && !/owes|عليه|عليها/.test(t))
    return { ...base, kind: "regular", dir: "in", amount: amts[0], count: 0, total: 0, every, start: start || iso(new Date(now)), title: person, auto: true };
  if (person && (dirIn || dirOut)) {
    const big = Math.max(...amts), small = amts.length > 1 ? Math.min(...amts) : 0;
    if (count || every || (small && small < big)) {
      // one amount said "a month" is each payment ("pays me 1,000 a month for a year"); "in 12" / "على 12" splits a total
      const how = amts.length === 1 ? oneAmount(t) : "";
      const split = how === "total" || how === "unsure" || /(owes me|عليه|عليها|me debe|me doit|me deve|schuldet mir|mi deve)\s*\S*\s*\d/.test(t) && !small && how !== "each";
      const each1 = amts.length === 1 && how === "each" && every;
      const n = count || (small ? partsOf(big, small) : 0), each = each1 ? big : small && small < big ? small : n ? Math.round((big / n) * 100) / 100 : big;
      // (a total split in n: the total stays exact — 22,000 over 9 is 22,000, not 9 × 2,444.44 = 21,999.96)
      // v9.4 (Ali, 5 Nov: "Sheikh pays me 19,500 in installments of 2,500" became 8 × 2,500 = 20,000): a total with a payment size
      // keeps the TOTAL the person said — 7 × 2,500 and a last payment of 2,000 (scheduleOf gives the last one the rest)
      const tot = each1 ? Math.round(each * n * 100) / 100 : small && small < big && !count ? big : !(small && small < big) ? big : Math.round(each * n * 100) / 100;
      if (n > 1) return withAlt({ ...base, kind: "installment", dir: dirIn ? "in" : "out", amount: each, count: n, total: tot, every: every || "month" }, how);
    }
    return { ...base, kind: "debt", dir: dirIn ? "in" : "out", amount: big, count: 1, total: big, every: null };
  }
  // v9.0 (the bank: "the driver comes every day, 200 a day"): every day = all seven days of the week
  const DAILY = /\b(every ?day|daily|each day|a day)\b|كل يوم|يوميا|يومياً|في اليوم/i;
  if ((HELP.test(raw) || HELP.test(t)) && (DAY_EVERY.test(t) || every || DAILY.test(t))) {
    const m = HELP.exec(raw) || HELP.exec(t);
    // v9.8: "the man who washes the car" is the car washer (a name, not "washes car")
    const name = /wash|غسيل|يغسل|غسال/i.test(m[0]) ? (/[\u0600-\u06FF]/.test(m[0]) ? "غسيل العربية" : "Car wash") : m[0].replace(/^ال/, "");
    // the start: that weekday — today when today is the day (the first box is today's)
    const dm = DAY_EVERY.exec(t), word = dm ? (dm[2] || dm[4] || dm[6] || "") : "";
    const W = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, "حد": 0, "احد": 0, "اتنين": 1, "اثنين": 1, "تلات": 2, "ثلاثاء": 2, "اربع": 3, "اربعاء": 3, "خميس": 4, "جمعه": 5, "سبت": 6 };
    let st = start;
    if (word in W) { const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + ((W[word] - d.getDay() + 7) % 7)); st = iso(d); }   // that weekday, today included
    // v8.9: several days a week — «كل حد واربع», "every Sunday and Wednesday" → days [0, 3] (one box on each)
    const all = [...t.matchAll(/(?:^|[\s,،و])(?:ال)?(احد|حد|اتنين|اثنين|تلات|ثلاثاء|اربعاء|اربع|خميس|جمعه|سبت)(?=$|[\s,،])|\b(sun|mon|tue|wed|thu|fri|sat)(?:day|s|sday|nesday|rsday|rs|urday)?s?\b/gi)].map((x) => W[(x[1] || x[2] || "").toLowerCase()]).filter((x) => x != null);
    const days = !DAY_EVERY.test(t) && DAILY.test(t) && !every ? [0, 1, 2, 3, 4, 5, 6] : [...new Set(all)].sort((a, b) => a - b);
    const dirR = dirIn || /\b(pays me|gives me|sends me|will (?:give|pay|send) me)\b/i.test(raw) ? "in" : "out";
    return { ...base, ...(days.length > 1 && (every || "week") === "week" ? { days } : {}), kind: "regular", dir: dirR, amount: amts[0], count: 0, total: 0, every: every || "week", start: st || iso(new Date(now)), title: /^[a-z]/i.test(name) ? name[0].toUpperCase() + name.slice(1) : name, auto: true };
  }
  if (RENT.test(raw) || RENT.test(t)) return { ...base, kind: "rent", dir: dirIn && /tenant|المستاجر|بيدفعلي|inquilino|locataire|mieter|affittuario|kiracı|penyewa/.test(t) ? "in" : "out", amount: amts[0], count: count || 0, total: 0, every: every || "month", title: "Rent" };
  if (SUBS.test(raw) || SUBS.test(t)) { const m = SUBS.exec(raw) || SUBS.exec(t); return { ...base, kind: "subscription", dir: "out", amount: amts[0], count: 0, total: 0, every: every || "month", title: nameBefore(raw, m[0][0].toUpperCase() + m[0].slice(1)) }; }
  if (BILL.test(raw) || BILL.test(t)) { const m = BILL.exec(raw) || BILL.exec(t); return { ...base, kind: "bill", dir: "out", amount: amts[0], count: every ? 0 : 1, total: every ? 0 : amts[0], every, title: nameBefore(raw, m[0]) }; }
  // installments — or "22,000 to be paid monthly over 9 months" (a payment over months is installments even without the word)
  if ((/installments?|instalments?|قسط|اقساط|تقسيط/.test(t) || (PAY_V.test(t) && count > 1)) && (count || every)) {
    const how = amts.length === 1 ? oneAmount(t) : "", title = (/(car|phone|laptop|عربيه|العربيه|موبايل|تليفون|لابتوب)/.exec(t) || [""])[0];
    if (how === "each" && count > 1) return { ...base, kind: "installment", dir: dirIn ? "in" : "out", amount: amts[0], count, total: amts[0] * count, every: every || "month", title };
    const big = Math.max(...amts), small = amts.length > 1 ? Math.min(...amts) : 0, n = count || (small ? partsOf(big, small) : 0);
    if (n > 1) return withAlt({ ...base, kind: "installment", dir: dirIn ? "in" : "out", amount: small || Math.round((big / n) * 100) / 100, count: n, total: small && count ? small * n : big, every: every || "month", title }, how);
  }
  // v9.8 (Ali: "I pay 700 EGP to the man who washes the car the first day of each month" became a one-off expense): a payment I make
  // again and again (every month / week / year) is a regular — a box on each of its days, ticked = the expense in Money (like the maid)
  if (every && !dirIn && amts.length === 1 && (PAY_V.test(t) || PAY_V.test(raw) || /\b(?:for|to)\s+(?:the|my)\b|\bi\s+(?:give|send|transfer)\b|بدفع|بادفع|بندفع|بدي|بديله|بديها|بيدفعله|ببعت|بحول/i.test(raw))) {
    const who = /\b(?:for|to)\s+((?:the|my)\s+)?([\p{L}][\p{L}' -]{1,40}?)(?=\s+(?:on|every|each|the first|first|at|in|a month|per|\d)|[,.،]|$)/iu.exec(raw.replace(/[\d٠-٩][\d٠-٩,.]*\s*(?:egp|le|l\.e\.?|pounds?|جنيه|ج)?/gi, " ").replace(/\s+/g, " "));
    const ar = /(?:^|\s)(?:ل|لل)([ء-ي]+(?:\s+[ء-ي]+){0,2})/.exec(raw.replace(/كل|اول|أول|الشهر|شهر|بدفع|بادفع/g, " "));
    const title = (who && who[2].trim()) || (ar && ar[1].trim()) || nameBefore(raw, tr("Payment"));
    return { ...base, kind: "regular", dir: "out", amount: amts[0], count: 0, total: 0, every, start: start || iso(new Date(now)), title: /^[a-z]/i.test(title) ? title[0].toUpperCase() + title.slice(1) : title, auto: true };
  }
  return null;
}

/** How many payments of `each` pay `total`: 12,000 at 1,000 → 12; 19,500 at 2,500 → 8 (7 full and a last, smaller one). */
function partsOf(total, each) { const q = total / each; return Math.abs(q - Math.round(q)) < 0.001 ? Math.round(q) : Math.ceil(q); }

/** The other reading of an unsure sentence: the same plan with the amount as EACH payment (the preview offers it). */
function withAlt(c, how) {
  if (how !== "unsure" || !(c.count > 1)) return c;
  const each = c.total;   // (the one amount said)
  return { ...c, alt: { ...c, amount: each, total: Math.round(each * c.count * 100) / 100 } };
}
/** A commitment's dates: [{ i, date, amount, paid }] — `count` payments (or the next 12 for an open-ended one). */
/** persona 9 (Ali picked H-B 1): "Sara owes me 2026" with no date and no instalments is OPEN — it never shows as late or due
    until a date is set (it used to be "late" for a whole year). */
export const isOpenLoan = (c) => !!c && c.kind === "debt" && !c.start && !(c.count > 1) && !c.every;
export function scheduleOf(c, now = Date.now()) {
  let n = c.count > 0 ? c.count : c.every ? 12 : 1;
  // a "regular" (the maid every Saturday) never ends: every day from its start up to the next one ahead
  // (v6.36: counted from the start DAY — before noon "today 12:00" is still ahead, and the day's box went missing)
  if (c.kind === "regular" && c.start) { const days = Math.max(0, (Date.parse(iso(new Date(now)) + "T12:00:00") - Date.parse(c.start + "T12:00:00")) / 86400000); n = Math.max(2, Math.floor(days / (c.every === "month" ? 30.44 : c.every === "year" ? 365.25 : 7)) + 2); }
  // v8.6 (the 2-month test: "Sheikh: 9 monthly payments" saved on 1 Sep still showed its first payment "next month" on 31 Oct — an
  // undated plan was re-dated to TODAY every day, so nothing ever came due): it counts from the day it was saved
  let d = c.start ? new Date(c.start + "T12:00:00") : new Date(c.created || now);
  if (!c.start) { d.setHours(12, 0, 0, 0); if (c.every === "month") d = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12); }
  // persona 9 (a year of use): an open-ended plan (Netflix every month) had 12 months of slots from its start — in its 13th month
  // nothing was due any more. It keeps a year ahead of today.
  if (!(c.count > 0) && c.every && c.kind !== "regular") { const per = c.every === "week" ? 7 : c.every === "year" ? 365.25 : 30.44; n = Math.max(n, Math.floor(Math.max(0, now - d.getTime()) / 864e5 / per) + 12); }
  const out = [];
  const dateOf = (i) => { const x = new Date(d); if (c.every === "month") x.setMonth(d.getMonth() + i); else if (c.every === "week") x.setDate(d.getDate() + 7 * i); else if (c.every === "year") x.setFullYear(d.getFullYear() + i); else if (i > 0) x.setMonth(d.getMonth() + i); return iso(x); };
  // v8.9: a regular on several days a week (the tutor every Sunday and Wednesday) — one box on each of those days
  if (c.kind === "regular" && Array.isArray(c.days) && c.days.length > 1 && c.start) {
    const x = new Date(c.start + "T12:00:00"), end = Date.parse(iso(new Date(now)) + "T12:00:00") + 7 * 864e5;
    for (let i = 0; x.getTime() <= end && i < 2000; x.setDate(x.getDate() + 1)) if (c.days.includes(x.getDay())) { out.push({ i, date: iso(x), amount: c.amount, paid: (c.paid || []).includes(i) }); i++; }
    return withChanges(c, out, now);
  }
  for (let i = 0; i < n; i++) out.push({ i, date: dateOf(i), amount: c.amount, paid: (c.paid || []).includes(i) });
  // v8.6 (persona 6: "22,000 over 9 months" added up to 21,999.96): the last payment takes the cents, so the plan adds up exactly
  if (c.total > 0 && c.count > 1 && n === c.count && !Object.keys(c.got || {}).length) { const rest = r2(c.total - c.amount * (n - 1)); if (rest > 0 && rest <= c.amount + 1) out[n - 1].amount = rest; }
  const res = rebalance(c, withChanges(c, out, now), dateOf);
  if (isOpenLoan(c)) for (const x of res) x.open = true;
  return res;
}
/* v9.9 edit by talking (lifeedit.js): "the maid is now taking 700" / "comes on Friday now" / "stop the car wash" from a day on.
   The days before keep what they were: an amount change keeps the old amount (`was`) for earlier days; a new start day keeps the
   days before it (and a day already ticked) and the rest follow the new day; a stop removes the days from then on. */
function withChanges(c, out, now) {
  const ch = c.changes || [];
  if (!ch.length || c.count > 0) return out;
  let res = out.map((x) => ({ ...x }));
  for (const m of [...ch].filter((x) => x.start).sort((a, b) => a.from.localeCompare(b.from))) {
    const keep = res.filter((x) => x.date < m.from || x.paid);
    const last = res.length ? res[res.length - 1].date : m.from, today = iso(new Date(now));
    let i = keep.reduce((a, x) => Math.max(a, x.i), -1) + 1;
    const base = new Date(m.start + "T12:00:00"), step = (k) => { const x = new Date(base); if (c.every === "month") x.setMonth(base.getMonth() + k); else if (c.every === "year") x.setFullYear(base.getFullYear() + k); else x.setDate(base.getDate() + 7 * k); return iso(x); };
    const add = [];
    for (let k = 0; k < 600; k++) { const d = step(k); if (d > last && add.some((y) => y.date > today)) break; if (keep.some((y) => y.date === d)) continue; add.push({ i, date: d, amount: c.amount, paid: (c.paid || []).includes(i) }); i++; }
    res = [...keep, ...add];
  }
  const stop = ch.filter((x) => x.stop).map((x) => x.from).sort()[0];
  if (stop) res = res.filter((x) => x.date < stop || x.paid);
  for (const x of res) { let a = c.amount; for (const m of [...ch].filter((y) => y.amount != null).sort((p, q) => q.from.localeCompare(p.from))) if (m.from > x.date) a = m.was; x.amount = a; }
  return res;
}
/* v8.3 (Ali, 26 Oct: "make it customizable — write what he actually paid, and it reschedules the rest based on that"): a payment can
   be ticked with the amount really paid (c.got[i]). What is still owed is then spread evenly over the payments not paid yet; paid in
   full early → the rest disappear; still something left after the last one → one more payment the next month. */
const r2 = (v) => Math.round(v * 100) / 100;
function rebalance(c, out, dateOf) {
  const got = c.got || {};
  if (!Object.keys(got).length || c.kind === "regular" || c.kind === "circle") return out;
  const total = c.total || (c.count > 0 ? c.amount * c.count : c.amount);
  for (const x of out) if (x.paid && got[x.i] != null) { x.amount = +got[x.i]; x.actual = true; }
  // (persona 9: a subscription paid with its amount vanished — an open-ended plan has no total to spread, each month is its own)
  if (!(c.total > 0) && !(c.count > 0)) return out;
  const paidSum = out.filter((x) => x.paid).reduce((a, x) => a + x.amount, 0);
  const rest = r2(total - paidSum), open = out.filter((x) => !x.paid);
  if (rest <= 0.004) return out.filter((x) => x.paid);
  if (!open.length) { const i = out.length; return [...out, { i, date: dateOf(i), amount: rest, paid: false, extra: true }]; }
  const each = r2(rest / open.length);
  open.forEach((x, k) => { x.amount = k === open.length - 1 ? r2(rest - each * (open.length - 1)) : each; x.moved = true; });
  return out;
}

/** What is left: { paidCount, paidAmount, left, next } */
export function progressOf(c, now = Date.now()) {
  const s = scheduleOf(c, now), paid = s.filter((x) => x.paid);
  const total = c.total || (c.count > 0 ? c.amount * c.count : 0);
  // (a regular day that passed unticked = they didn't come — not late; its next is today or the next day ahead)
  const today = iso(new Date(now));
  const next = c.kind === "regular" ? s.find((x) => !x.paid && x.date >= today) || null : s.find((x) => !x.paid) || null;
  return { paidCount: paid.length, paidAmount: paid.reduce((a, x) => a + x.amount, 0), left: total ? Math.max(0, total - paid.reduce((a, x) => a + x.amount, 0)) : null, next, schedule: s };
}

/** A tick on payment i → the Money entry it makes (proposed to Money, confirmed there): income for "in", expense for "out". */
export function tickEntry(c, i, now = Date.now()) {
  const s = scheduleOf(c, now)[i]; if (!s) return null;
  const who = c.person ? c.person + " — " : "";
  const what = c.kind === "regular" ? `${c.title || "regular"} · ${s.date}` : c.kind === "installment" ? `installment ${i + 1} of ${c.count}` : c.kind === "circle" ? `${c.title || "savings circle"} ${i + 1}/${c.count}` : c.title || c.kind;
  return { direction: c.dir === "in" ? "in" : "out", amount: s.amount, currency: c.currency, party: c.person || "", note: (who + what).trim(), ts: Date.parse(s.date + "T12:00:00") };
}

/** The sentence a tick sends to Money (read there by paytext.js, confirmed by the person):
 *  "Received 1,000 EGP from Ahmed — installment 4 of 12" / "Paid 2,000 EGP — جمعية 1/10". */
export function tickText(c, i, now = Date.now()) {
  const e = tickEntry(c, i, now); if (!e) return "";
  const amt = e.amount.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " " + (e.currency || homeCurrency());
  const what = e.note.replace(/^.*? — /, "");
  return e.direction === "in" ? `Received ${amt}${e.party ? " from " + e.party : ""} — ${what}` : `Paid ${amt}${e.party ? " to " + e.party : ""} — ${what}`;
}

// ---- the store: { v: 1, items: [commitment + id + created] } in localStorage "attune:life:v1" ----
export const LIFE_KEY = "attune:life:v1";
export function loadLife(store = typeof localStorage !== "undefined" ? localStorage : null) {
  try { const j = JSON.parse((store && store.getItem(LIFE_KEY)) || "null"); return j && Array.isArray(j.items) ? j : { v: 1, items: [] }; } catch (e) { return { v: 1, items: [] }; }
}
export function saveLife(data, store = typeof localStorage !== "undefined" ? localStorage : null) {
  try { store && store.setItem(LIFE_KEY, JSON.stringify(data)); } catch (e) {}
  return data;
}
export function addCommitment(data, c, now = Date.now()) {
  const id = "c" + now.toString(36) + Math.random().toString(36).slice(2, 6);
  const { alt, altOf, ...keep } = c;   // (the other reading of an unsure sentence is not kept)
  return { ...data, items: [...data.items, { ...keep, id, created: now, paid: c.paid || [] }] };
}
export function togglePaid(data, id, i) {
  return { ...data, items: data.items.map((c) => { if (c.id !== id) return c; const on = (c.paid || []).includes(i); const got = { ...(c.got || {}) }; if (on) delete got[i];
    return { ...c, paid: on ? c.paid.filter((x) => x !== i) : [...(c.paid || []), i].sort((a, b) => a - b), got }; }) };
}
/** v8.3: payment i was paid with this amount (more or less than due) — the rest of the plan is worked out again (scheduleOf). */
export function payAmount(data, id, i, amount) {
  const v = Math.round((+amount || 0) * 100) / 100; if (!(v >= 0)) return data;
  return { ...data, items: data.items.map((c) => (c.id !== id ? c : { ...c, paid: [...new Set([...(c.paid || []), i])].sort((a, b) => a - b), got: { ...(c.got || {}), [i]: v } })) };
}
/** v7.9 (Ali: "People & plans did not ask me with a checkbox if the maid came"): who comes on a day and is paid each time,
 *  and today is their day, not answered yet. → [{ c, i, date, amount }] */
export function askToday(data, now = Date.now()) {
  const today = iso(new Date(now)), out = [];
  for (const c of (data && data.items) || []) {
    if (c.kind !== "regular" || c.dir !== "out") continue;
    for (const s of scheduleOf(c, now)) if (s.date === today && !s.paid && !(c.skip || []).includes(s.i)) out.push({ c, i: s.i, date: s.date, amount: s.amount });
  }
  return out;
}
/** "Didn't come" on day i: nothing is paid, and the day isn't asked again (untick with `on` = false). */
export function skipDay(data, id, i, on = true) {
  return { ...data, items: data.items.map((c) => c.id !== id ? c : { ...c, skip: on ? [...new Set([...(c.skip || []), i])] : (c.skip || []).filter((x) => x !== i) }) };
}
export function removeCommitment(data, id) { return { ...data, items: data.items.filter((c) => c.id !== id) }; }

/** What is due soon across everything (for Home's "Today" and reminders): [{ c, i, date, amount, late }] within `days`. */
export function dueSoon(data, now = Date.now(), days = 7) {
  const today = iso(new Date(now)), until = iso(new Date(now + days * 86400000)), out = [];
  for (const c of data.items || []) for (const s of scheduleOf(c, now)) if (!s.paid && !s.open && !(c.skip || []).includes(s.i) && s.date <= until && (c.kind !== "regular" || s.date === today)) { out.push({ c, i: s.i, date: s.date, amount: s.amount, late: s.date < today }); }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** The model's fallback prompt and reader — the same fields, only when the rules return null. */
export function lifeModelPrompt(text) {
  return `Read this note about money between people, an installment, a savings circle, a bill, rent or a subscription. Note: «${String(text).slice(0, 240)}»
Reply with ONLY one JSON object: {"kind": "installment"|"debt"|"circle"|"bill"|"rent"|"subscription"|null, "person": name or "", "dir": "in" if money comes to the writer else "out", "amount": each payment as a number, "count": number of payments or 0, "every": "month"|"week"|"year"|null, "start": "YYYY-MM-DD" or ""}`;
}
export function readLifeModel(text, currency = homeCurrency()) {
  const m = /\{[\s\S]*\}/.exec(String(text || "")); if (!m) return null;
  let j; try { j = JSON.parse(m[0]); } catch (e) { return null; }
  if (!["installment", "debt", "circle", "bill", "rent", "subscription"].includes(j.kind) || !(Number(j.amount) > 0)) return null;
  const count = Math.max(0, Math.min(600, Math.round(Number(j.count) || 0)));
  return { kind: j.kind, person: String(j.person || "").slice(0, 60), dir: j.dir === "in" ? "in" : "out", amount: Number(j.amount), count, total: count ? Number(j.amount) * count : 0,
    every: ["month", "week", "year"].includes(j.every) ? j.every : null, start: /^\d{4}-\d{2}-\d{2}$/.test(j.start || "") ? j.start : "", currency, paid: [], title: "", model: true };
}

/** v6.27: a statement typed in Chat that is a commitment («Ahmed owes me 12,000, 1,000 a month for a year») → it, else null.
 *  Questions («how much does Ahmed owe me?», «كام عليه؟») and advice requests stay in Chat. */
export function chatLifeIntent(text, opts) {
  const t = String(text || "").trim();
  if (!t || t.length > 200 || /[?؟]\s*$/.test(t) || /^[¿]/.test(t) || /^(how|what|why|when|should|can|is|are|do|does|كام|ازاي|إزاي|ليه|امتى|هل|ايه|إيه|cuánto|cuanto|cómo|como|qué|que|por qué|combien|comment|pourquoi|est-ce|quanto|quanta|por que|wie|was|warum|wann|soll|perché|quale|ne kadar|nasıl|neden|berapa|bagaimana|kenapa)(?![\p{L}])/iu.test(t) || /\b(how much|how many|advice|calculate|interest rate)\b/i.test(t)) return null;
  // a request to work something out is a Chat task, not a note («… give me the rent with the tax», «احسب …»)
  // (v9.0: "my sister WILL GIVE ME 2000 every month" is money coming in, not a request — "give me" counts only as an order)
  if (!/\b(will|would|is going to|has to|must|should|to|gonna)\s+(give|send|pay)\s+me\b/i.test(t) && /\b(give me|calculate|work out|tell me|compute|show me|explain|write|find|estimate|compare)\b|احسب|اديني|اعطني|قولي|قول لي|اكتب|اعملي|اشرح|قارن|(?<![\p{L}])(calcula|calcule|calcular|calculer|dime|dis-moi|explica|explique|escribe|écris|berechne|erkläre|schreib|calcola|spiega|scrivi|hesapla|açıkla|yaz|hitung|jelaskan|tulis)(?![\p{L}])/iu.test(t)) return null;
  const c = parseLife(t, opts);
  if (!c) return null;
  // a bill, rent or subscription only when the text itself says how often or when (not a price mentioned in passing)
  if (["bill", "rent", "subscription"].includes(c.kind) && !c.start && !c.every) return null;
  // v9.0 (the sentence bank: "1200 gym" became a monthly gym plan): a subscription needs the words that say it repeats, or a
  // service that only comes as one (Netflix, Spotify…) — otherwise it is one payment
  // (the same for rent and a bill: "rent 8000" alone is this month's payment, not a new rent plan each time it is typed)
  if ((c.kind === "rent" || c.kind === "bill") && !c.start && !/\b(every|each|a month|monthly|per month|due|on the \d)|كل|شهري|شهرياً|ميعاد|يوم \d/i.test(t)) return null;
  if (c.kind === "subscription" && !c.start && !/\b(every|each|a month|monthly|per month|a year|yearly|annual|weekly|a week|renews?|subscription|membership)\b|كل|شهري|سنوي|اسبوعي|أسبوعي|بيتجدد|اشتراك/i.test(t)
    && !/\b(netflix|spotify|shahid|osn|watch it|watchit|youtube premium|apple music|icloud|google one|chatgpt|anghami|disney|amazon prime|prime video|canva|adobe|office 365|microsoft 365)\b|نتفليكس|شاهد|انغامي|أنغامي/i.test(t)) return null;
  // v9.9.15 C2 / C3: one payment due on a LATER day ("pay the electricity bill 320 on Friday", "I should pay 1500 for the course by
  // Sunday") is a plan too — asked about on its day; the same words about today or a past day stay money spent
  if (c.kind === "bill" && c.count === 1 && c.start && c.start > iso(new Date((opts && opts.now) || Date.now()))) {
    if (c.planned) return c;
    const ti = String(c.title || "").replace(/^\s*(?:please\s+)?(?:pay|ادفع|سدد)\s+(?:the\s+|my\s+)?/i, "").trim();
    return { ...c, title: ti ? ti[0].toUpperCase() + ti.slice(1) : c.title };
  }
  return c.person || c.kind === "circle" || c.kind === "installment" || c.every ? c : null;
}

/** v6.27: the reminder for a commitment's NEXT unpaid payment — 9:00 on its day (or in an hour if that is today and
 *  9:00 has passed); null when everything is paid or the day is gone. One reminder per commitment, moved on each tick. */
export function nextReminder(c, now = Date.now()) {
  const n = progressOf(c, now).next; if (!n) return null;
  const d = new Date(n.date + "T09:00:00"); let at = d.getTime();
  if (at < now) { const end = new Date(n.date + "T20:00:00").getTime(); if (end < now) return null; at = now + 3600000; }
  const who = c.person ? c.person + " · " : "";
  const what = c.kind === "installment" ? `installment ${n.i + 1} of ${c.count}` : c.kind === "circle" ? `${c.title || "savings circle"} ${n.i + 1}/${c.count}` : c.title || c.kind;
  const amount = n.amount.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " " + (c.currency || homeCurrency());
  // v9.9.13/14 (Ali: "it should remind me whether I am paying or not"): who pays decides the words; someone else / nobody → Money untouched
  if (c.payer === "none") return { id: "life-" + c.id, at, title: tr("Renews today: {w}", { w: what }), body: tr("{a} — nobody's balance changes; tick it when it's paid", { a: amount }) };
  if (c.payer && c.payer !== "me") return { id: "life-" + c.id, at, title: tr("Renews today: {w}", { w: what }), body: tr("{a} — {p} pays it; your balance stays the same", { a: amount, p: c.payer }) };
  if (c.payer === "me" && c.accountName) return { id: "life-" + c.id, at, title: tr("Due: {w}", { w: what }), body: tr("{a} from {acc} — tick it in People & plans when it's paid", { a: amount, acc: c.accountName }) };
  return { id: "life-" + c.id, at, title: (c.dir === "in" ? "Due to you: " : "Due: ") + who + what, body: amount + " — tick it in People & plans when it's paid" };
}

/** v8.9 (Ali: "People & plans doesn't understand what I want"): a payment ON something already on the list — «Ahmed paid me back
 *  2000», «دفعت لأحمد 1000 من اللي عليا», "I paid Karim 250" — not a new debt. → { c, i, amount, dir } for the person's open plan, or null. */
export function paymentOn(data, text, now = Date.now()) {
  const raw = String(text || "").trim(); if (!raw) return null;
  const t = fold(raw).toLowerCase();
  const back = /\b(paid me back|paid me|gave me back|returned|sent me|transferred me|repaid me)\b|رجعلي|رجعتلي|ادالي|اداني|اديني|دفعلي|دفعتلي|سددلي|سددتلي|بعتلي|بعتتلي|حولي|حولتلي|استلمت من|خدت من .* من اللي عليه/i;
  const mine = /\b(i paid|i gave|i returned|i sent|i transferred|i repaid|paid back)\b|دفعت ل|اديت ل|رجعت ل|سددت ل|بعت ل|حولت ل|سددت/i;
  const dir = back.test(raw) || back.test(t) ? "in" : mine.test(raw) || mine.test(t) ? "out" : null;
  if (!dir) return null;
  const amt = amountsIn(raw, homeCurrency()).map((a) => a.value).filter((v) => v > 0)[0]; if (!amt) return null;
  const plain = (x) => fold(String(x || "")).toLowerCase().replace(/^ال/, "");
  const open = ((data && data.items) || []).filter((c) => c.person && c.dir === dir && (c.kind === "debt" || c.kind === "installment") && plain(t).includes(plain(c.person)));
  if (!open.length) return null;
  const c = open.sort((a, b) => plain(b.person).length - plain(a.person).length)[0];
  const next = scheduleOf(c, now).find((s) => !s.paid); if (!next) return null;
  return { c, i: next.i, amount: amt, dir };
}

/* ---- v9.9.14 "Who pays it?" for every recurring payment (Ali, 10 Nov: "I don't want a small fix … choose which balance to take from if
   it's taking from me, and if someone else is paying it make me choose who pays it — someone Attune knows, from contacts, or nothing …
   it should remind me whether I am paying or not"). On a commitment:
     payer: "me" | a person's name | "none" (not set — nobody's money moves, only the reminder)
     payerRef: { id (a People card), phone (a contact) }   account / accountName: the Money account "me" pays from ("" = the usual one)
   Kinds: subscription, bill, rent, regular — the ones that renew. Pure; tests/unit/v9914payer.test.mjs. */
export const RENEWS = ["subscription", "bill", "rent", "regular"];
export const hasPayer = (c) => !!c && RENEWS.includes(c.kind) && c.dir !== "in";
/** Save who pays: setPayer(data, id, "me" | "Name" | "none" | { payer, ref, account, accountName }). */
export function setPayer(data, id, who) {
  const w = typeof who === "string" ? { payer: who } : (who || {});
  const payer = w.payer === "me" || w.payer === "none" ? w.payer : String(w.payer || "").trim().slice(0, 40) || "none";
  const ref = w.ref && (w.ref.id || w.ref.phone) ? { ...(w.ref.id ? { id: String(w.ref.id) } : {}), ...(w.ref.phone ? { phone: String(w.ref.phone).slice(0, 30) } : {}) } : null;
  return { ...data, items: (data.items || []).map((c) => (c.id === id ? { ...c, payer, payerRef: ref,
    account: payer === "me" ? String(w.account || "") : "", accountName: payer === "me" ? String(w.accountName || "").slice(0, 40) : "" } : c)) };
}
/** Does this payment come out of MY money? (no payer saved = me, as it always was) */
export const paysMe = (c) => !c || !c.payer || c.payer === "me";
/** Recurring payments Attune added by itself whose payer was never asked. */
export const payerUnknown = (data) => ((data && data.items) || []).filter((c) => hasPayer(c) && c.auto && !c.payer && !c.ended);
/** One line: "You pay · from CIB" / "My father pays" / "Nobody set — reminder only". */
export function payerLine(c) {
  if (!c || !c.payer) return tr("You pay");
  if (c.payer === "me") return c.accountName ? tr("You pay · from {a}", { a: c.accountName }) : tr("You pay");
  if (c.payer === "none") return tr("Nobody set — reminder only");
  return tr("{p} pays", { p: c.payer });
}
/** The people to offer: your People cards (family first), then the people already in your plans and payers; once each. */
export function peopleChoices(dir = { items: [] }, data = { items: [] }, max = 8) {
  const fam = /father|mother|dad|mom|mum|brother|sister|wife|husband|son|daughter|uncle|aunt|grand|بابا|ماما|ابويا|امي|أبويا|أمي|اخويا|أخويا|اختي|أختي|مراتي|جوزي|ابني|بنتي|خالي|عمي|جدي|جدتي|خالتي|عمتي/i;
  const out = [], seen = new Set();
  const add = (name, ref, role) => { const k = String(name || "").trim().toLowerCase(); if (!k || seen.has(k)) return; seen.add(k); out.push({ name: String(name).trim(), ref: ref || null, role: role || "" }); };
  for (const c of (data && data.items) || []) if (c.payer && !["me", "none"].includes(c.payer)) add(c.payer, c.payerRef || null, "");
  const people = ((dir && dir.items) || []).filter((p) => p && p.kind === "person" && p.name);
  const isFam = (p) => fam.test(p.role || "") || fam.test(p.name);
  for (const p of [...people.filter(isFam), ...people.filter((p) => !isFam(p))]) add(p.name, { id: p.id, ...(p.contact && p.contact.phone ? { phone: p.contact.phone } : {}) }, p.role);
  for (const c of (data && data.items) || []) if (c.person) add(c.person, null, "");
  return out.slice(0, max);
}
/** v9.9.14 every renewing payment keeps its next reminder (Ali: "remind me whether I am paying or not") — also the ones Autopilot ticks
 *  by itself, whose reminder used to be set only when People & plans was used. → the reminders that are missing or out of date. */
export function lifeReminders(data, existing = [], now = Date.now()) {
  const have = new Map((existing || []).map((r) => [r.id, r]));
  const out = [];
  for (const c of (data && data.items) || []) {
    if (!hasPayer(c) || c.ended) continue;
    const r = nextReminder(c, now); if (!r) continue;
    const h = have.get(r.id);
    if (!h || h.at !== r.at || h.body !== r.body || h.title !== r.title) out.push(r);
  }
  return out;
}
