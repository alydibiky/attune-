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

const AR_D = "٠١٢٣٤٥٦٧٨٩", FA_D = "۰۱۲۳۴۵۶۷۸۹";
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => AR_D.indexOf(d)).replace(/[۰-۹]/g, (d) => FA_D.indexOf(d)).replace(/٫/g, ".").replace(/٬/g, ",");
const fold = (s) => latin(s).replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$|[،,.!?؟])/g, "ه").replace(/[ًٌٍَُِّْـ]/g, "");

// ---- amounts ----------------------------------------------------------------------------------------------------------------
const WORDS_EN = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, fifty: 50, hundred: 100 };
const WORDS_AR = { "واحد": 1, "اتنين": 2, "اثنين": 2, "تلات": 3, "تلاته": 3, "ثلاث": 3, "ثلاثه": 3, "اربع": 4, "اربعه": 4, "خمس": 5, "خمسه": 5, "ست": 6, "سته": 6, "سبع": 7, "سبعه": 7,
  "تمن": 8, "تمانيه": 8, "ثماني": 8, "ثمانيه": 8, "تسع": 9, "تسعه": 9, "عشر": 10, "عشره": 10, "حداشر": 11, "اتناشر": 12, "اثنا عشر": 12, "اثني عشر": 12, "عشرين": 20, "تلاتين": 30, "ثلاثين": 30, "خمسين": 50, "مية": 100, "ميه": 100, "مائه": 100 };
/** Every amount in a text, in order: "12 ألف" → 12000, "1.5k" → 1500, "ألفين" → 2000, "١٢٠٠٠" → 12000. → [{ value, at }] */
export function amountsIn(text) {
  const t = fold(text), out = [];
  const re = /(\d[\d,]*(?:\.\d+)?)\s*(k|الف|الاف|آلاف|ألف|thousand|مليون|million|m\b)?|(?:^|\s)(الفين|ألفين|الف|ألف)(?=\s|$|[،,.])/gi;
  let m;
  while ((m = re.exec(t))) {
    // not money: a count ("12 installments", "36 شهر"), a day ("on the 5th", "يوم 5") or a turn ("my turn is 4", "month 4")
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 22), before = t.slice(Math.max(0, m.index - 14), m.index);
    if (!m[3] && !m[2] && (/^\s*(?:st|nd|rd|th)?\s*(?:monthly\s+|weekly\s+)?(?:installments?|instalments?|payments?|months?|weeks?|years?|days?|اقساط|قسط|دفعات|دفعه|شهور|اشهر|شهر|اسابيع|سنين|سنوات|ايام)(?![a-z\u0621-\u064A])/i.test(after)
      || /(?:on the|day|يوم|turn is|turn|month|دوري|الشهر رقم|is)\s*$/i.test(before) || /^(?:st|nd|rd|th)\b/.test(after))) continue;
    if (m[3]) { out.push({ value: /الفين|ألفين/.test(m[3]) ? 2000 : 1000, at: m.index }); continue; }
    let v = parseFloat(m[1].replace(/,/g, "")); if (!isFinite(v)) continue;
    const u = (m[2] || "").toLowerCase();
    if (/^(k|الف|الاف|آلاف|ألف|thousand)$/.test(u)) v *= 1000; else if (/^(مليون|million|m)$/.test(u)) v *= 1e6;
    out.push({ value: v, at: m.index });
  }
  return out;
}

// ---- how many / how often / when ---------------------------------------------------------------------------------------------
function countOf(t) {
  let m = /(\d+)\s*(?:monthly\s+|weekly\s+)?(?:installments?|instalments?|payments?|months?|monthly payments|اقساط|قسط|دفعات|دفعه|شهور|اشهر|شهر)(?![a-z])/i.exec(t);
  if (m) return +m[1];
  m = new RegExp("(?:^|\\s)(" + Object.keys(WORDS_EN).join("|") + ")\\s+(?:installments?|payments?|months?)", "i").exec(t);
  if (m) return WORDS_EN[m[1].toLowerCase()];
  m = new RegExp("(?:^|\\s)(" + Object.keys(WORDS_AR).join("|") + ")\\s+(?:اقساط|قسط|دفعات|شهور|اشهر)").exec(t);
  if (m) return WORDS_AR[m[1]];
  if (/\b(for|over) (a|one) year\b|لمده سنه|علي سنه|لسنه|سنه كامله|(?:^|\s)سنه(?=\s|$)/.test(t)) return 12;
  if (/\b(for|over) two years\b|سنتين/.test(t)) return 24;
  if (/\b(for|over) (six|6) months\b|نص سنه/.test(t)) return 6;
  return 0;
}
function everyOf(t) {
  if (/\b(a|per|every|each) month\b|\bmonthly\b|كل شهر|شهري|شهريا|في الشهر|بالشهر|كل اول شهر/.test(t)) return "month";
  if (/\b(a|per|every|each) week\b|\bweekly\b|كل اسبوع|اسبوعي|اسبوعيا|في الاسبوع/.test(t)) return "week";
  if (/\b(a|per|every|each) year\b|\byearly\b|\bannual(ly)?\b|كل سنه|سنوي|سنويا/.test(t)) return "year";
  if (/installments?|instalments?|اقساط|قسط/.test(t)) return "month";
  return null;
}
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  "يناير": 0, "فبراير": 1, "مارس": 2, "ابريل": 3, "مايو": 4, "يونيو": 5, "يوليو": 6, "اغسطس": 7, "سبتمبر": 8, "اكتوبر": 9, "نوفمبر": 10, "ديسمبر": 11 };
const WEEKDAYS = { "sun(?:day)?": 0, "mon(?:day)?": 1, "tue(?:s|sday)?": 2, "wed(?:nesday)?": 3, "thu(?:rs|rsday)?": 4, "fri(?:day)?": 5, "sat(?:urday)?": 6, "الاحد": 0, "الاتنين": 1, "الاثنين": 1, "التلات": 2, "الثلاثاء": 2, "الاربع": 3, "الاربعاء": 3, "الخميس": 4, "الجمعه": 5, "السبت": 6 };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** The first date mentioned (a month name → its 1st, or the "day N" in it; a weekday → the next one; "next month"), else "". */
function startOf(t, now) {
  const d0 = new Date(now); d0.setHours(12, 0, 0, 0);
  const dayN = (/(?:on the|day|يوم)\s*(\d{1,2})(?:st|nd|rd|th)?\b/i.exec(t) || [])[1];
  for (const [k, m] of Object.entries(MONTHS)) {
    if (new RegExp("(^|\\s|من |اول |from |starting |in )" + k + "[a-z]*(?=\\s|$|[،,.])", "i").test(t)) {
      const y = m < d0.getMonth() || (m === d0.getMonth() && dayN && +dayN < d0.getDate()) ? d0.getFullYear() + 1 : d0.getFullYear();
      return iso(new Date(y, m, dayN ? +dayN : 1, 12));
    }
  }
  for (const [k, w] of Object.entries(WEEKDAYS)) {
    if (new RegExp("(^|\\s)(on |يوم |due )?" + k + "(?=\\s|$|[،,.])", "i").test(t)) {
      const d = new Date(d0); d.setDate(d.getDate() + ((w - d.getDay() + 7) % 7 || 7)); return iso(d);
    }
  }
  if (/\bnext month\b|الشهر الجاي|الشهر القادم|الشهر اللي جاي/.test(t)) return iso(new Date(d0.getFullYear(), d0.getMonth() + 1, dayN ? +dayN : 1, 12));
  if (/\btomorrow\b|بكره|بكرة|غدا/.test(t)) { const d = new Date(d0); d.setDate(d.getDate() + 1); return iso(d); }
  if (dayN) { const d = new Date(d0.getFullYear(), d0.getMonth(), +dayN, 12); if (d < d0) d.setMonth(d.getMonth() + 1); return iso(d); }
  return "";
}

// ---- who ---------------------------------------------------------------------------------------------------------------------
const NOT_NAME = /^(i|me|my|he|she|they|we|you|him|her|them|the|a|an|his|it|this|that|انا|هو|هي|هم|احنا|انت|عليه|عليها|عليا|ليا|ليه|لي|من|علي|الي|في|ده|دي|كل|شهر|كمان)$/i;
function personOf(raw, t) {
  const tries = [
    /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(?:owes|will pay|is paying|pays|borrowed|has to pay|must pay)\b/,
    /\b(?:lent|loaned|gave|owe|paid|pay|to|from|with|lend|Lent)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/,
  ];
  for (const re of tries) { const m = re.exec(raw); if (m && !NOT_NAME.test(m[1])) return m[1]; }
  const ar = [
    /(?:^|\s)([ء-ي]{2,})\s+(?:عليه|عليها|هيدفعلي|هيدفع|هيرجعلي|هيرجع|مديون|مدين|استلف مني|اخد مني|خد مني|يدفعلي|سيدفع|يسدد)/,
    /(?:سلفت|اسلفت|اقرضت|ادينت|اديت|عليا ل|علي ل|مديون ل|مدين ل|استلفت من|اخدت من|خدت من|اقترضت من)\s*([ء-ي]{2,})/,
    /(?:^|\s)ل([ء-ي]{2,})\s+(?:عندي|عليا)/,
  ];
  for (const re of ar) { const m = re.exec(t); if (m && !NOT_NAME.test(m[1])) return m[1].replace(/^ل(?=[ء-ي]{3,})/, ""); }
  return "";
}

// ---- the sentence → a commitment -----------------------------------------------------------------------------------------
const CIRCLE = /\b(savings circle|money circle|rosca|tanda|susu|chit fund|hui|arisan|tontine|pasanaku|cundina|paluwagan|kameti|committee)\b|جمعيه|جمعية/i;
const SUBS = /\b(netflix|spotify|shahid|osn|youtube premium|icloud|google one|chatgpt|gym|subscription|membership)\b|اشتراك|نتفليكس|شاهد|الجيم|جيم/i;
const RENT = /\brent\b|ايجار|الايجار/i;
const BILL = /\b(bill|electricity|water|gas bill|internet|phone bill|due)\b|فاتوره|فاتورة|الكهربا|كهربا|الكهرباء|المياه|الميه|النت|الانترنت|التليفون|الغاز/i;
const IN_ = /\bowes me\b|\bwill pay me\b|\bpays me\b|\bi lent\b|\bi loaned\b|(?:^|\s)lent\s+(?!me\b)|\blent\b.*\bto\b|سيدفع|سيسدد|هيسدد|هيدفع(?!ل)|\bto pay me back\b|\bi gave\b.*\b(loan|borrow)|عليه|عليها|هيدفعلي|يدفعلي|هيرجعلي|سلفت|اسلفت|اقرضت|ادينت|استلف مني|اخد مني|خد مني|مديون ليا|مدين لي/i;
const OUT_ = /\bi owe\b|\bi borrowed\b|\bi have to pay\b|\bi must pay\b|\bmy (installment|instalment)s?\b|عليا|علي ل|استلفت|اقترضت|اخدت من|خدت من|مديون ل|لازم ادفع|هدفع|قسط العربيه|قسطي|اقساطي/i;

/**
 * One sentence → a commitment, or null when the rules can't read it (then a model may try, with the same fields).
 * now: for dates; currency: the default currency.
 */
export function parseLife(text, { now = Date.now(), currency = "EGP" } = {}) {
  const raw = String(text || "").trim(); if (!raw) return null;
  const t = fold(raw).toLowerCase();
  const amts = amountsIn(raw).map((a) => a.value).filter((v) => v > 0);
  if (!amts.length) return null;
  const count = countOf(t), every = everyOf(t), start = startOf(t, now), person = personOf(raw, fold(raw));
  const cur = (/\$|\busd\b|dollars?|دولار/i.test(raw) ? "USD" : /€|\beur\b|euros?|يورو/i.test(raw) ? "EUR" : /\bsar\b|riyals?|ريال/i.test(raw) ? "SAR" : /\baed\b|dirhams?|درهم/i.test(raw) ? "AED" : currency);
  const base = { person, currency: cur, start, every, paid: [], title: "" };
  // a savings circle: "جمعية 2000 في الشهر لمدة 10 شهور ودوري الرابع"
  if (CIRCLE.test(raw)) {
    const turn = (/(?:my turn|i get it|i take it|دوري|بقبض|هقبض|اقبض)[^\d٠-٩]{0,20}(\d+)/i.exec(latin(t)) || [])[1]
      || ({ "الاول": 1, "التاني": 2, "الثاني": 2, "التالت": 3, "الثالث": 3, "الرابع": 4, "الخامس": 5, "السادس": 6, "السابع": 7, "التامن": 8, "الثامن": 8, "التاسع": 9, "العاشر": 10 })[(/(?:دوري|بقبض|هقبض)\s*(?:في\s*)?(?:الشهر\s*)?(ال[ء-ي]+)/.exec(t) || [])[1]] || 0;
    const n = count || 10;
    return { ...base, kind: "circle", dir: "out", amount: amts[0], count: n, total: amts[0] * n, every: every || "month", myTurn: +turn || 0, title: CIRCLE.exec(raw)[0] };
  }
  const dirIn = IN_.test(t) || IN_.test(raw), dirOut = !dirIn && (OUT_.test(t) || OUT_.test(raw));
  // money owed between people: one sum (a debt) or paid in parts (installments)
  if (person && (dirIn || dirOut)) {
    const big = Math.max(...amts), small = amts.length > 1 ? Math.min(...amts) : 0;
    if (count || every || (small && small < big)) {
      // one amount said "a month" is each payment ("pays me 1,000 a month for a year"); "in 12" / "على 12" splits a total
      const split = /\b(?:in|over)\s+\d+|عل[يى]\s*\d+/.test(t) || /(owes me|عليه|عليها)\s*\S*\s*\d/.test(t) && !small && !/\b(a|per|every|each) (month|week)\b|كل شهر|في الشهر|بالشهر/.test(t);
      const each1 = amts.length === 1 && !split && every;
      const n = count || (small ? Math.round(big / small) : 0), each = each1 ? big : small && small < big ? small : n ? Math.round((big / n) * 100) / 100 : big;
      if (n > 1) return { ...base, kind: "installment", dir: dirIn ? "in" : "out", amount: each, count: n, total: Math.round(each * n * 100) / 100, every: every || "month" };
    }
    return { ...base, kind: "debt", dir: dirIn ? "in" : "out", amount: big, count: 1, total: big, every: null };
  }
  if (RENT.test(raw) || RENT.test(t)) return { ...base, kind: "rent", dir: dirIn && /tenant|المستاجر|بيدفعلي/.test(t) ? "in" : "out", amount: amts[0], count: count || 0, total: 0, every: every || "month", title: "Rent" };
  if (SUBS.test(raw) || SUBS.test(t)) { const m = SUBS.exec(raw); return { ...base, kind: "subscription", dir: "out", amount: amts[0], count: 0, total: 0, every: every || "month", title: m[0][0].toUpperCase() + m[0].slice(1) }; }
  if (BILL.test(raw) || BILL.test(t)) { const m = BILL.exec(raw) || BILL.exec(t); return { ...base, kind: "bill", dir: "out", amount: amts[0], count: every ? 0 : 1, total: every ? 0 : amts[0], every, title: m[0] }; }
  if (/installments?|instalments?|قسط|اقساط/.test(t) && (count || every)) {
    const split = /\b(?:in|over)\s+\d+|عل[يى]\s*\d+/.test(t), each1 = amts.length === 1 && !split && /\b(a|per|every|each) (month|week)\b|\bmonthly\b|\bweekly\b|كل شهر|شهريا|في الشهر|بالشهر|كل اسبوع/.test(t);
    if (each1 && count > 1) return { ...base, kind: "installment", dir: dirIn ? "in" : "out", amount: amts[0], count, total: amts[0] * count, every: every || "month", title: (/(car|phone|laptop|عربيه|العربيه|موبايل|تليفون|لابتوب)/.exec(t) || [""])[0] };
    const big = Math.max(...amts), small = amts.length > 1 ? Math.min(...amts) : 0, n = count || (small ? Math.round(big / small) : 0);
    if (n > 1) return { ...base, kind: "installment", dir: dirIn ? "in" : "out", amount: small || Math.round((big / n) * 100) / 100, count: n, total: small ? small * n : big, every: every || "month", title: (/(car|phone|laptop|عربيه|العربيه|موبايل|تليفون|لابتوب)/.exec(t) || [""])[0] };
  }
  return null;
}

/** A commitment's dates: [{ i, date, amount, paid }] — `count` payments (or the next 12 for an open-ended one). */
export function scheduleOf(c, now = Date.now()) {
  const n = c.count > 0 ? c.count : c.every ? 12 : 1;
  let d = c.start ? new Date(c.start + "T12:00:00") : new Date(now);
  if (!c.start) { d.setHours(12, 0, 0, 0); if (c.every === "month") d = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12); }
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = new Date(d);
    if (c.every === "month") x.setMonth(d.getMonth() + i); else if (c.every === "week") x.setDate(d.getDate() + 7 * i); else if (c.every === "year") x.setFullYear(d.getFullYear() + i);
    out.push({ i, date: iso(x), amount: c.amount, paid: (c.paid || []).includes(i) });
  }
  return out;
}

/** What is left: { paidCount, paidAmount, left, next } */
export function progressOf(c, now = Date.now()) {
  const s = scheduleOf(c, now), paid = s.filter((x) => x.paid);
  const total = c.total || (c.count > 0 ? c.amount * c.count : 0);
  return { paidCount: paid.length, paidAmount: paid.reduce((a, x) => a + x.amount, 0), left: total ? Math.max(0, total - paid.reduce((a, x) => a + x.amount, 0)) : null, next: s.find((x) => !x.paid) || null, schedule: s };
}

/** A tick on payment i → the Money entry it makes (proposed to Money, confirmed there): income for "in", expense for "out". */
export function tickEntry(c, i, now = Date.now()) {
  const s = scheduleOf(c, now)[i]; if (!s) return null;
  const who = c.person ? c.person + " — " : "";
  const what = c.kind === "installment" ? `installment ${i + 1} of ${c.count}` : c.kind === "circle" ? `${c.title || "savings circle"} ${i + 1}/${c.count}` : c.title || c.kind;
  return { direction: c.dir === "in" ? "in" : "out", amount: s.amount, currency: c.currency, party: c.person || "", note: (who + what).trim(), ts: Date.parse(s.date + "T12:00:00") };
}

/** The sentence a tick sends to Money (read there by paytext.js, confirmed by the person):
 *  "Received 1,000 EGP from Ahmed — installment 4 of 12" / "Paid 2,000 EGP — جمعية 1/10". */
export function tickText(c, i, now = Date.now()) {
  const e = tickEntry(c, i, now); if (!e) return "";
  const amt = e.amount.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " " + (e.currency || "EGP");
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
  return { ...data, items: [...data.items, { ...c, id, created: now, paid: c.paid || [] }] };
}
export function togglePaid(data, id, i) {
  return { ...data, items: data.items.map((c) => c.id !== id ? c : { ...c, paid: (c.paid || []).includes(i) ? c.paid.filter((x) => x !== i) : [...(c.paid || []), i].sort((a, b) => a - b) }) };
}
export function removeCommitment(data, id) { return { ...data, items: data.items.filter((c) => c.id !== id) }; }

/** What is due soon across everything (for Home's "Today" and reminders): [{ c, i, date, amount, late }] within `days`. */
export function dueSoon(data, now = Date.now(), days = 7) {
  const today = iso(new Date(now)), until = iso(new Date(now + days * 86400000)), out = [];
  for (const c of data.items || []) for (const s of scheduleOf(c, now)) if (!s.paid && s.date <= until) { out.push({ c, i: s.i, date: s.date, amount: s.amount, late: s.date < today }); }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** The model's fallback prompt and reader — the same fields, only when the rules return null. */
export function lifeModelPrompt(text) {
  return `Read this note about money between people, an installment, a savings circle, a bill, rent or a subscription. Note: «${String(text).slice(0, 240)}»
Reply with ONLY one JSON object: {"kind": "installment"|"debt"|"circle"|"bill"|"rent"|"subscription"|null, "person": name or "", "dir": "in" if money comes to the writer else "out", "amount": each payment as a number, "count": number of payments or 0, "every": "month"|"week"|"year"|null, "start": "YYYY-MM-DD" or ""}`;
}
export function readLifeModel(text, currency = "EGP") {
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
  if (!t || t.length > 200 || /[?؟]\s*$/.test(t) || /^(how|what|why|when|should|can|is|are|do|does|كام|ازاي|إزاي|ليه|امتى|هل|ايه|إيه)\b/i.test(t) || /\b(how much|how many|advice|calculate|interest rate)\b/i.test(t)) return null;
  const c = parseLife(t, opts);
  return c && (c.person || c.kind === "circle" || c.kind === "installment" || c.every) ? c : null;
}
