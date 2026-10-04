/* =========================================================================
   LOGTEXT — "write it and Yusr logs it"
   ---------------------------------------------------------------------------
   Ali (v6.13): "I want Yusr to be AI powered: I write to it, it understands
   and automatically logs everything." He types the way he talks:
     "lunch 150, taxi 60 and got my salary 30000"
     «فطار ٨٠ وبنزين ٥٠٠ امبارح وقبضت ١٢ ألف»
   and every item becomes a transaction.

   The same rules as PAYTEXT:
   1. EVERY AMOUNT MUST BE IN HIS WORDS. The model may sort and name things;
      a number it writes that is not in the text (or not "12 ألف" → 12000)
      is dropped and reported — never logged.
   2. CODE FIRST. The plain reader below works with no model at all (the
      model only makes the categories and notes better), so logging never
      waits on a model that is still loading.
   Pure, no DOM, no network. Tests: tests/unit/v714yusrlog.test.mjs.
   ========================================================================= */

const AR_DIGITS = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9", "٫": ".", "٬": "," };
export const normDigits = (s) => String(s || "").replace(/[٠-٩۰-۹٫٬]/g, (c) => AR_DIGITS[c]);

// Yusr's own category ids (BASE_CATS in index.new.html) and the words that point to each.
export const CAT_WORDS = {
  food: /\b(lunch|dinner|breakfast|food|meal|restaurant|pizza|burger|shawarma|koshary|sandwich|snack|delivery|talabat|kfc|mcdonald'?s?)\b|غدا|غداء|عشا|عشاء|فطار|فطور|أكل|اكل|مطعم|بيتزا|برجر|شاورما|كشري|سندوتش|ساندوتش|طلبات|دليفري/i,
  groceries: /\b(groceries|grocery|supermarket|market|vegetables|fruit|milk|bread|eggs|carrefour|spinneys|hyper)\b|بقالة|سوبر ?ماركت|خضار|فاكهة|لبن|عيش|بيض|كارفور|هايبر/i,
  transport: /\b(taxi|uber|careem|didi|indrive|bus|metro|train|fuel|petrol|gas|benzine|parking|toll|car wash|ticket)\b|تاكسي|أوبر|اوبر|كريم|ميكروباص|اتوبيس|أتوبيس|مترو|قطر|بنزين|سولار|جاز|ركنة|باركينج|كارتة|غسيل العربية|مواصلات/i,
  bills: /\b(bill|bills|electricity|water|internet|wifi|phone|mobile|recharge|subscription|netflix|spotify|we|vodafone|orange|etisalat|gas bill)\b|فاتورة|فواتير|كهرباء|كهربا|مية|ماء|انترنت|إنترنت|نت|رصيد|شحن|اشتراك|نتفلكس/i,
  rent: /\b(rent|landlord|lease)\b|إيجار|ايجار|الإيجار|الايجار/i,
  shopping: /\b(shopping|clothes|shirt|shoes|jeans|dress|amazon|noon|jumia|bought|watch|bag)\b|تسوق|هدوم|لبس|قميص|جزمة|كوتشي|بنطلون|فستان|أمازون|امازون|نون|جوميا|اشتريت|شنطة|ساعة/i,
  health: /\b(pharmacy|medicine|doctor|clinic|hospital|dentist|lab|x-?ray|gym|vitamins?)\b|صيدلية|دوا|دواء|علاج|دكتور|طبيب|عيادة|مستشفى|دكتور سنان|تحاليل|أشعة|اشعة|جيم/i,
  fun: /\b(cinema|movie|game|games|playstation|outing|trip|concert|club|fun)\b|سينما|فيلم|لعب|بلايستيشن|خروجة|فسحة|رحلة|حفلة|نادي/i,
  coffee: /\b(coffee|tea|cafe|café|starbucks|latte|cappuccino|espresso|juice)\b|قهوة|شاي|كافيه|ستاربكس|لاتيه|عصير/i,
  gifts: /\b(gift|present|eidiya|charity|donation|sadaqa)\b|هدية|هدايا|عيدية|صدقة|تبرع/i,
  salary: /\b(salary|paycheck|payroll|wage|wages)\b|مرتب|راتب|المرتب|الراتب|قبضت/i,
};
const INCOME = /\b(salary|paycheck|got paid|received|receive|earned|income|refund(ed)?|sold|bonus|commission|someone paid me|paid me|gave me|got \d|got back)\b|قبضت|مرتب|راتب|استلمت|جالي|جاتلي|اخدت|أخدت|خدت|دخل|بعت|بيعت|ارتجعلي|رجعلي|عمولة|مكافأة|مكافاة|حد ادانى|اداني|ادّاني/i;
const EXPENSE = /\b(spent|paid|bought|cost|pay|for)\b|صرفت|دفعت|اشتريت|دفعت|بـ|ب /i;

/** The money amounts written in one piece of text, with the multiplier words. "12 ألف" → 12000, "1.5k" → 1500. */
export function amountsIn(text) {
  const t = normDigits(text);
  const out = [];
  const re = /(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(k|K|ألف|الف|آلاف|الاف|thousand|مليون|million|m\b|M\b)?/g;
  let m;
  while ((m = re.exec(t))) {
    let v = parseFloat(m[1].replace(/,/g, ""));
    const mul = m[2] || "";
    if (/^(k|ألف|الف|آلاف|الاف|thousand)$/i.test(mul)) v *= 1000;
    else if (/^(مليون|million|m)$/i.test(mul)) v *= 1e6;
    // a time ("at 5"), a date ("on the 3rd"), a count without money words is still money here: he is logging money
    out.push({ value: Math.round(v * 100) / 100, raw: m[0].trim(), at: m.index });
  }
  return out;
}

/** Split "lunch 150, taxi 60 and got salary 30000" into one piece per item. */
export function clauses(text) {
  const t = normDigits(text).replace(/\r/g, "");
  return t.split(/\n|[;؛،]|,(?!\d{3}\b)|\s+(?:and|then|also|plus|ثم|وبعدين|وكمان|كمان)\s+|\s+و(?=\s*\S*\s*\d)|\s+و(?=(?:قبضت|دفعت|صرفت|اشتريت|استلمت|جالي|اخدت|خدت|بنزين|تاكسي|اوبر|أوبر|غدا|عشا|فطار|قهوة|شاي)\b)/)
    .map((x) => (x || "").trim()).filter(Boolean);
}

/** "yesterday" / «امبارح» / "2 days ago" / «من يومين» / "on 3/10" → an ISO date, or null. */
export function dateIn(text, today) {
  const t = normDigits(text), d0 = new Date(today + "T12:00:00");
  const back = (n) => { const d = new Date(d0); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  if (/\b(day before yesterday)\b|أول امبارح|اول امبارح/i.test(t)) return back(2);
  if (/\byesterday\b|امبارح|أمس|امس/i.test(t)) return back(1);
  let m = /\b(\d{1,2}) days? ago\b|من (\d{1,2}) (?:أيام|ايام|يوم)/i.exec(t);
  if (m) return back(+(m[1] || m[2]));
  if (/من يومين/.test(t)) return back(2);
  if (/\btoday\b|النهارده|انهارده|اليوم/i.test(t)) return today;
  m = /\b(?:on|يوم)\s+(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/i.exec(t);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : d0.getFullYear();
    const d = new Date(Date.UTC(y, +m[2] - 1, +m[1]));
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  return null;
}

/** The category id for a piece of text (one of `ids`, else "other"). */
export function catOf(text, ids = Object.keys(CAT_WORDS).concat("other")) {
  for (const [id, re] of Object.entries(CAT_WORDS)) if (ids.includes(id) && re.test(text)) return id;
  return ids.includes("other") ? "other" : ids[0];
}

/** The account named in the text ("from the bank", «من الكاش»), matched against his account names. */
export function accountIn(text, accounts = []) {
  const t = String(text || "").toLowerCase();
  let best = null;
  for (const a of accounts) {
    const n = String(a || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
    if (n && n.length >= 2 && t.includes(n) && (!best || n.length > best.length)) best = a;
  }
  return best;
}

const noteOf = (clause, amountRaw) => clause.replace(amountRaw, " ").replace(/\b(EGP|LE|L\.E\.?|pounds?|egp|usd|\$|sar|aed|جنيه|ج\.م|جم|ج|ريال|درهم|دولار)\b/gi, " ")
  .replace(/\b(spent|paid|bought|for|on|today|yesterday|got|received|i|my|the|a)\b|صرفت|دفعت|اشتريت|النهارده|امبارح|على|في|ب(?=\s)/gi, " ")
  .replace(/\s+/g, " ").trim().slice(0, 80);

/**
 * Code-only reading → { items: [{ type, amount, cat, date, note, account }], skipped: [clause] }.
 * opts: { today: "YYYY-MM-DD", cats: [ids], accounts: [names] }
 */
export function readLocal(text, { today, cats, accounts = [] } = {}) {
  const items = [], skipped = [];
  const lead = normDigits(text).split(/\d/)[0];
  const whole = dateIn(lead, today);   // "yesterday: lunch 150, taxi 60" → both yesterday (only a date said BEFORE the first item)
  for (const c of clauses(text)) {
    const am = amountsIn(c).filter((a) => a.value > 0);
    if (!am.length) { if (/\p{L}/u.test(c)) skipped.push(c); continue; }
    // "taxi 60" → 60; "3 coffees 90" → the last number is the money
    const a = am[am.length - 1];
    const type = INCOME.test(c) && !/\b(paid for|spent)\b|صرفت|دفعت/i.test(c) ? "income" : "expense";
    const cat = type === "income" ? (CAT_WORDS.salary.test(c) && (cats || ["salary"]).includes("salary") ? "salary" : catOf(c, cats)) : catOf(c, cats);
    items.push({ type, amount: a.value, cat: type === "income" && cat !== "salary" && !(cats || []).includes(cat) ? "other" : cat,
      date: dateIn(c, today) || whole || today, note: noteOf(c, a.raw) || c.slice(0, 60), account: accountIn(c, accounts) || "", src: c });
  }
  return { items, skipped };
}

/** The model's instructions. The categories and accounts are his own. */
export function logPrompt(text, { today, cats = [], accounts = [], currency = "" } = {}) {
  return `Turn the user's note about money into transactions to log. Today is ${today}.${currency ? " Currency: " + currency + "." : ""}
Categories (use the id): ${cats.map((c) => (typeof c === "string" ? c : c.id + " = " + c.name)).join(", ")}.
${accounts.length ? "Accounts: " + accounts.join(", ") + ". Put the account only when the note names it." : ""}
Rules:
- One item per thing bought, paid or received. "lunch 150 and taxi 60" is TWO items.
- amount: exactly the number the user wrote for that item ("12 ألف" = 12000, "1.5k" = 1500). Never add, split or guess an amount; skip an item with no amount.
- type: "income" for money that came in (salary, got paid, sold, refund, قبضت, جالي), otherwise "expense".
- date: YYYY-MM-DD ("yesterday"/«امبارح» = the day before today); today when not said.
- note: 2–6 words in the user's language saying what it was.
Reply with ONLY this JSON: {"items":[{"type":"expense","amount":150,"cat":"food","date":"${today}","note":"lunch","account":""}]}

The user's note:
<<<
${String(text).slice(0, 2000)}
>>>`;
}

/** Every value an amount in the text may stand for (as written, and with its multiplier). */
function allowedAmounts(text) {
  const s = new Set();
  for (const a of amountsIn(text)) { s.add(a.value); const plain = parseFloat(normDigits(a.raw).replace(/,/g, "")); if (isFinite(plain)) s.add(plain); }
  return s;
}

/**
 * The model's reply, checked → { ok, items, warnings }. An item whose amount is not in the text is dropped
 * and named in `warnings`. When the model gave nothing usable, the code reading is used.
 */
export function parseLog(raw, text, opts = {}) {
  const { today, cats, accounts = [] } = opts;
  const ids = (cats || []).map((c) => (typeof c === "string" ? c : c.id));
  const local = readLocal(text, { today, cats: ids.length ? ids : undefined, accounts });
  let j = null;
  try { const m = String(raw || "").match(/\{[\s\S]*\}/); j = m ? JSON.parse(m[0]) : null; } catch (e) { j = null; }
  const allowed = allowedAmounts(text), warnings = [];
  let items = [];
  if (j && Array.isArray(j.items)) {
    for (const x of j.items.slice(0, 40)) {
      const amount = Math.round(Number(x && x.amount) * 100) / 100;
      if (!(amount > 0)) continue;
      if (!allowed.has(amount)) { warnings.push(`Skipped ${amount}${x.note ? " (" + String(x.note).slice(0, 30) + ")" : ""}: that number is not in what you wrote.`); continue; }
      const type = x.type === "income" ? "income" : "expense";
      const cat = ids.includes(x.cat) ? x.cat : catOf(String(x.note || ""), ids.length ? ids : undefined);
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(x.date || "")) && String(x.date) <= today ? String(x.date) : today;
      const acc = accounts.find((a) => String(a).toLowerCase() === String(x.account || "").toLowerCase()) || "";
      items.push({ type, amount, cat, date, note: String(x.note || "").slice(0, 80), account: acc });
    }
    // the model may not drop a whole item the code clearly saw (e.g. it merged "taxi 60" into lunch)
    const used = items.map((i) => i.amount);
    for (const l of local.items) { const k = used.indexOf(l.amount); if (k >= 0) used.splice(k, 1); else items.push({ ...l, src: undefined }); }
  }
  if (!items.length) items = local.items.map((x) => ({ ...x, src: undefined }));
  items = items.map(({ src, ...x }) => x);
  return items.length ? { ok: true, items, warnings, via: j && Array.isArray(j.items) ? "model" : "code" }
    : { ok: false, items: [], warnings, why: "No amount found. Write it like: lunch 150, taxi 60, got salary 30000." };
}
