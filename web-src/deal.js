/* ---- v5.33 — Deal Check: "before you pay or sign, ask Attune" --------------------------------
   Ali asked for "a complete feature that will sell, that no one did before". Everyone in Egypt
   meets offers every day: installment plans ("0% interest"), marketplace sellers on WhatsApp,
   car and apartment deals, a RAM stick that turns out to be DDR5. Deal Check reads the offer
   (text or a screenshot), and then CODE — never the model — does what decides money:
     - the true total you pay and the real yearly interest of an installment plan (IRR);
     - the market price, from the prices on the web pages it finds (median, range);
     - scam and trap signs (pay-first, urgency, "you won", OTP codes, off-platform, too cheap);
     - the verdict and the price to ask for.
   The model only reads the offer into fields and writes the negotiation message.
   Pure functions; tests in tests/unit/v533.test.mjs.                                            */

const AR_DIGITS = /[٠-٩]/g;
const toLatin = (s) => String(s || "").replace(AR_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/٬/g, ",").replace(/٫/g, ".");

/** "12,400", "13.550,00", "5k", "١٢٠٠٠" → a number (or NaN). */
export function num(x) {
  if (typeof x === "number") return x;
  let s = toLatin(x).trim().toLowerCase().replace(/\s/g, "");
  const k = /k$/.test(s) ? 1000 : /m$|مليون$/.test(s) ? 1e6 : /ألف$|الف$/.test(s) ? 1000 : 1;
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return NaN;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");   // 13.550,00
  else s = s.replace(/,(?=\d{3}(\D|$))/g, "").replace(/,/g, ".");
  const v = parseFloat(s);
  return isFinite(v) ? v * k : NaN;
}

const CUR = [
  [/(egp|le\b|l\.e|e£|جنيه|جنية|ج\.م|ج م)/i, "EGP"], [/(usd|us\$|\$|dollars?|دولار)/i, "USD"], [/(eur|€|euros?|يورو)/i, "EUR"],
  [/(sar|riyals?|ريال)/i, "SAR"], [/(aed|dirhams?|درهم)/i, "AED"], [/(gbp|£|pounds? sterling)/i, "GBP"], [/(cny|rmb|yuan|يوان)/i, "CNY"],
];
export function currencyOf(s) { const t = String(s || ""); for (const [re, c] of CUR) if (re.test(t)) return c; return ""; }

/** Every price written in a text: [{ value, cur, at }] (a currency must be next to the number). */
export function pricesIn(text) {
  const t = toLatin(text), out = [];
  const re = /(egp|le|l\.e\.?|e£|us\$|usd|\$|€|eur|sar|aed|£|gbp|cny|rmb|جنيه|جنية|ج\.م|دولار|يورو|ريال|درهم)?\s?(\d[\d,.]*\d|\d)\s?(k\b|ألف|الف)?\s?(egp|le\b|l\.e\.?|e£|usd|\$|eur|€|sar|aed|gbp|cny|rmb|yuan|جنيه|جنية|ج\.م|دولار|يورو|ريال|درهم)?/gi;
  for (const m of t.matchAll(re)) {
    const cur = currencyOf(m[1] || m[4] || "");
    if (!cur) continue;
    const v = num(m[2] + (m[3] ? "k" : ""));
    if (!isFinite(v) || v <= 0) continue;
    out.push({ value: v, cur, at: m.index });
  }
  return out;
}

/**
 * v5.41 (Ali's iPhone: "12,400 EGP or 3 × 4,133 with valU" was read as 12,400 down + 3 × 4,133 → a total
 * below the price and "−13,201 more than cash"). Installment plans read by CODE from the text:
 * "3 × 4,133", "4,133 × 12", "4,133 a month for 12 months", "12 installments of 4,133", «قسط 4133 على 12 شهر»,
 * "X or N × M" (X is the cash price of the same thing), "down payment 5,000" / «مقدم 5000».
 * → [{ months, monthly, cash?, down? }]
 */
export function plansIn(text) {
  // «25 ألف» / «1.2 مليون» / "25k" → the full number, so «36 قسط 25 ألف» is read (v6.8)
  const t = toLatin(text).replace(/(\d),(?=\d{3}(\D|$))/g, "$1")
    .replace(/(\d+(?:\.\d+)?)\s*(?:ألف|الف|آلاف|الاف|k)(?![\p{L}])/giu, (_, n) => String(Math.round(+n * 1000)))
    .replace(/(\d+(?:\.\d+)?)\s*(?:مليون|million|m)(?![\p{L}])/giu, (_, n) => String(Math.round(+n * 1e6))), out = [];
  const N = "(\\d+(?:\\.\\d+)?)";
  const add = (months, monthly, at) => {
    months = Math.round(+months); monthly = +monthly;
    if (!(months >= 2 && months <= 120) || !(monthly > 0) || monthly < months) return;
    if (out.some((p) => p.months === months && p.monthly === monthly)) return;
    const before = t.slice(Math.max(0, at - 60), at);
    const alt = before.match(new RegExp(N + "\\s*(?:egp|le|l\\.e\\.?|جنيه|جنية|ج\\.م|\\$|usd)?\\s*[\"“”']?\\s*(?:or|أو|او|ولا|/)\\s*[\"“”']?\\s*$", "i"));
    const dn = t.match(new RegExp("(?:down ?payment|deposit of|advance of|مقدم|دفعة أولى|دفعه اولي|اول دفعة)\\s*(?:of|:)?\\s*" + N, "i"));
    out.push({ months, monthly, at, cash: alt ? +alt[1] : null, down: dn ? +dn[1] : null });
  };
  for (const m of t.matchAll(new RegExp("\\b(\\d{1,3})\\s*[×xX*]\\s*" + N, "g"))) if (+m[1] <= 120 && +m[2] > +m[1]) add(m[1], m[2], m.index);
  for (const m of t.matchAll(new RegExp(N + "\\s*[×xX*]\\s*(\\d{1,3})\\s*(?:months?|mo\\b|monthly|شهر|شهور|أشهر|قسط|installments?)", "gi"))) add(m[2], m[1], m.index);
  // "2,000 × 10" (amount first, no word): a big amount times a small count
  for (const m of t.matchAll(new RegExp(N + "\\s*[×xX*]\\s*(\\d{1,2})(?![\\d.,])", "g"))) if (+m[1] >= 100 && +m[2] >= 2) add(m[2], m[1], m.index);
  for (const m of t.matchAll(new RegExp(N + "\\s*(?:egp|le|جنيه)?\\s*(?:a|per|/|each|every)\\s*month\\s*(?:for|over|×|x)\\s*(\\d{1,3})", "gi"))) add(m[2], m[1], m.index);
  for (const m of t.matchAll(new RegExp("(\\d{1,3})\\s*(?:monthly )?(?:installments?|payments?|months?|قسط|أقساط|اقساط|شهر|شهور)\\s*(?:of|at|×|x|\\*|ب|بـ|كل واحد)\\s*" + N, "gi"))) add(m[1], m[2], m.index);   // v6.6: «١٢ قسط × ٣٠٠٠»
  // «36 قسط 25000» — count, the word, then the amount with nothing between (v6.8)
  for (const m of t.matchAll(new RegExp("(\\d{1,3})\\s*(?:قسط|أقساط|اقساط|شهر|شهور)\\s+" + N + "(?![\\d.])", "g"))) if (+m[2] >= 100) add(m[1], m[2], m.index);
  for (const m of t.matchAll(new RegExp("(?:قسط|القسط|شهري(?:ا|ًا)?)\\s*" + N + "\\s*(?:جنيه)?\\s*(?:على|لمدة|ل)\\s*(\\d{1,3})\\s*(?:شهر|شهور|أشهر)", "g"))) add(m[2], m[1], m.index);
  return out;
}

/** Two very different prices for the same thing in one offer (38,000 and 12,400) — a bait-price sign. */
export function priceMismatch(text, plan) {
  const vals = [...new Set(pricesIn(text).map((p) => p.value))].filter((v) => !plan || Math.abs(v - plan.monthly) > 1);
  if (vals.length < 2) return null;
  const hi = Math.max(...vals), lo = Math.min(...vals);
  return hi / lo >= 1.6 && lo >= 500 ? { hi, lo } : null;
}

/** The market from many prices: drops outliers, → { low, median, high, n } or null. */
export function marketRange(values) {
  const v = values.filter((x) => isFinite(x) && x > 0).sort((a, b) => a - b);
  if (v.length < 2) return v.length ? { low: v[0], median: v[0], high: v[0], n: 1 } : null;
  const mid = (a) => (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2);
  const m0 = mid(v);
  const kept = v.filter((x) => x >= m0 / 3 && x <= m0 * 3);
  const q = (p) => kept[Math.min(kept.length - 1, Math.max(0, Math.round(p * (kept.length - 1))))];
  return { low: q(0.2), median: mid(kept), high: q(0.8), n: kept.length };
}

/**
 * An installment plan → what it really costs. cash = the price paid at once; down = paid now;
 * monthly × months; fees = admin / purchase fees paid at the start.
 * → { total, extra, monthlyRate, yearlyRate } (rates as 0.35 = 35 %; null when there is no loan)
 */
export function planCost({ cash, down = 0, monthly, months, fees = 0 }) {
  cash = num(cash); down = num(down) || 0; monthly = num(monthly); months = Math.round(num(months)); fees = num(fees) || 0;
  if (!(monthly > 0) || !(months > 0)) return null;
  const total = down + fees + monthly * months;
  const out = { total, extra: isFinite(cash) ? total - cash : NaN, monthlyRate: null, yearlyRate: null };
  // a plan that costs clearly LESS than the cash price means the terms were misread — never shown as a saving
  if (isFinite(cash) && cash > 0 && total < cash * 0.97) { out.inconsistent = true; out.extra = NaN; return out; }
  if (isFinite(out.extra) && Math.abs(out.extra) <= Math.max(5, cash * 0.002)) out.extra = 0;   // 3 × 4,133 = 12,399 vs 12,400: rounding, not a saving
  if (!(cash > 0)) return out;
  const loan = cash - down - fees;              // what you really borrow: fees paid up front shrink it
  if (loan <= 0) return out;
  const pv = (r) => (r === 0 ? monthly * months : monthly * (1 - Math.pow(1 + r, -months)) / r);
  if (pv(0) <= loan) { out.monthlyRate = 0; out.yearlyRate = 0; return out; }
  let lo = 0, hi = 1;                            // bisection on the monthly rate
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (pv(m) > loan) lo = m; else hi = m; }
  out.monthlyRate = (lo + hi) / 2;
  out.yearlyRate = Math.pow(1 + out.monthlyRate, 12) - 1;
  return out;
}

/** Scam and trap signs, by code. → [{ id, weight, en, ar }] */
const SIGNS = [
  ["pay-first", 3, /(deposit|advance payment|pay (first|before|in advance)|transfer (the money|first)|send (the )?money|عربون|حو(ّ)?ل (الأول|الاول|الفلوس)|ابعت (الفلوس|المبلغ)|ادفع (الأول|الاول|مقدم)|مقدم)/i,
    "They want money before you see or receive it.", "عايزين فلوس قبل ما تشوف أو تستلم الحاجة."],
  ["wallet", 2, /(vodafone cash|فودافون كاش|instapay|انستا ?باي|etisalat cash|orange cash|اورانج كاش|wallet number|رقم المحفظة|western union|gift ?card|كارت (جوجل|ايتونز|آيتونز))/i,
    "Payment to a personal wallet or gift card — very hard to get back.", "الدفع على محفظة شخصية أو كارت هدايا — صعب جدًا ترجّعه."],
  ["code", 4, /(otp|verification code|send (me )?the code|الكود اللي (وصلك|جالك)|ابعت(لي)? الكود|كود التفعيل|رمز التحقق)/i,
    "They ask for a code sent to your phone — that is how accounts and wallets are stolen.", "يطلبون رمزًا وصلك على الهاتف — وهذه طريقة لسرقة الحسابات والمحافظ."],
  ["prize", 3, /(you (have )?won|congratulations.{0,30}(prize|winner|won)|claim your (prize|reward)|مبروك.{0,20}(كسبت|فزت|ربحت)|كسبت (جايزة|جائزة)|فزت ب)/i,
    "A prize you never entered for.", "جايزة إنت ما دخلتش مسابقتها أصلًا."],
  ["urgent", 1, /(today only|last chance|only \d+ left|hurry|limited time|expires (today|tonight|in \d+)|act now|النهاردة بس|النهارده بس|آخر فرصة|اخر فرصة|لفترة محدودة|الحق قبل|الكمية محدودة|فاضل \d+ بس)/i,
    "Pressure to decide fast — a classic trick.", "ضغط لتتخذ قرارك بسرعة — أسلوب معروف."],
  ["off-platform", 2, /(contact me on whatsapp|whatsapp me|message me outside|pay outside|كلمني (واتس|على الواتس)|تواصل (واتس|خاص)|برا الموقع|خارج (المنصة|الموقع))/i,
    "They move you off the platform, where you lose buyer protection.", "يُخرجونك من المنصة، فتفقد حماية المشتري."],
  ["guaranteed", 4, /(guaranteed (profit|return|income)|double your money|risk[- ]free (profit|investment)|\d+% (monthly|weekly|daily) (profit|return)|ربح مضمون|أرباح مضمونة|ارباح مضمونة|ضاعف فلوسك|عائد (شهري|يومي) \d+)/i,
    "Guaranteed high profit — the sign of a Ponzi / investment scam.", "ربح مضمون وعالي — علامة نصب استثمار (بونزي)."],
  ["no-warranty", 1, /(no warranty|without warranty|بدون ضمان|من غير ضمان|مفيش ضمان|no returns?|non-?refundable|لا يرد ولا يستبدل)/i,
    "No warranty or returns.", "من غير ضمان أو استرجاع."],
  ["copy", 2, /(high copy|first copy|mirror (quality|copy)|replica|master copy|هاي كوبي|كوبي وان|تقليد|درجة أولى)/i,
    "It says copy / replica — not the original product.", "مكتوب «كوبي/تقليد» — ليس أصليًا."],
  ["generic", 1, /\bgeneric\b|بدون (ماركة|براند)/i,
    "No real brand is named.", "لا توجد علامة تجارية حقيقية مكتوبة."],
  ["zero-interest", 0, /(0\s?% (interest|فايدة|فائدة)|بدون (فوايد|فوائد|فايدة)|zero interest|interest[- ]free)/i,
    "Says 0% interest — the real cost is checked below.", "مكتوب 0% فوايد — التكلفة الحقيقية محسوبة تحت."],
  ["no-ratings", 1, /(not enough ratings|no ratings|new seller|بائع جديد|مفيش تقييمات)/i,
    "A seller with no ratings.", "بائع من غير تقييمات."],
];
export function scamSigns(text) {
  const t = toLatin(text);
  return SIGNS.filter(([, , re]) => re.test(t)).map(([id, weight, , en, ar]) => ({ id, weight, en, ar }));
}

/**
 * The verdict, by code. d = { price, cur, market, plan, signs, claimsZero }
 * → { level: "scam"|"risky"|"overpriced"|"fair"|"good"|"unknown", reasons: [{en, ar}], target }
 */
export function verdict(d) {
  const reasons = [];
  const say = (en, ar) => reasons.push({ en, ar });
  const risk = (d.signs || []).reduce((s, x) => s + x.weight, 0);
  const fmt = (v) => Math.round(v).toLocaleString("en-US") + (d.cur ? " " + d.cur : "");
  let level = "unknown", target = null;
  const m = d.market, p = num(d.price);
  if (m && p > 0) {
    const vs = p / m.median;
    if (p < m.low * 0.6) { say(`The price is far below the market (${fmt(m.low)}–${fmt(m.high)}) — too good to be true is a scam sign.`, `السعر أقل بكتير من السوق (${fmt(m.low)}–${fmt(m.high)}) — «رخيص زيادة عن اللزوم» علامة نصب.`); level = "risky"; }
    else if (p > m.high * 1.08) { level = "overpriced"; say(`About ${Math.round((vs - 1) * 100)}% above the usual price (${fmt(m.median)}).`, `أغلى من السعر المعتاد (${fmt(m.median)}) بحوالي ${Math.round((vs - 1) * 100)}%.`); }
    else if (p <= m.median * 0.95) { level = "good"; say(`Below the usual price (${fmt(m.median)}).`, `أرخص من السعر المعتاد (${fmt(m.median)}).`); }
    else { level = "fair"; say(`In line with the market (${fmt(m.low)}–${fmt(m.high)}).`, `في حدود السوق (${fmt(m.low)}–${fmt(m.high)}).`); }
    if (p > m.median) target = Math.round(Math.max(m.low, m.median * 0.97) / 50) * 50;
  }
  const pl = d.plan;
  if (pl && isFinite(pl.extra) && pl.extra > 0) {
    say(`With the installments you pay ${fmt(pl.total)} — ${fmt(pl.extra)} more than the cash price.`, `بالتقسيط هتدفع ${fmt(pl.total)} — يعني ${fmt(pl.extra)} زيادة عن الكاش.`);
    if (pl.yearlyRate != null) say(`That is a real interest of about ${Math.round(pl.yearlyRate * 100)}% a year${d.claimsZero ? ", although it says 0%" : ""}.`, `ده فايدة حقيقية حوالي ${Math.round(pl.yearlyRate * 100)}% في السنة${d.claimsZero ? "، رغم إنه مكتوب 0%" : ""}.`);
    if (pl.yearlyRate != null && pl.yearlyRate > 0.35 && (level === "fair" || level === "good" || level === "unknown")) level = "overpriced";
  } else if (pl && pl.extra <= 0 && pl.total > 0) say("The installments add nothing over the cash price — a real 0%.", "التقسيط لا يضيف شيئًا على السعر النقدي — 0% فعلًا.");
  if (pl && pl.inconsistent) say(`The installments add up to ${fmt(pl.total)} — less than the price, so the terms don't match; ask the seller for the exact total.`, `مجموع الأقساط ${fmt(pl.total)} — أقل من السعر، أي أن الشروط غير متسقة؛ اسأل البائع عن الإجمالي بالتحديد.`);
  if (risk >= 4) level = "scam";
  else if (risk >= 2 && level !== "scam") level = "risky";
  for (const s of d.signs || []) if (s.weight > 0) reasons.push({ en: s.en, ar: s.ar });
  return { level, reasons, target, risk };
}

/** Questions to ask the seller before paying, for what was found. */
export function questionsFor(v, signs, kind) {
  const q = [];
  const ids = new Set((signs || []).map((s) => s.id));
  if (ids.has("pay-first") || ids.has("wallet")) q.push(["Can I see it and pay on delivery (cash / card on receipt)?", "ممكن أشوفها وأدفع عند الاستلام؟"]);
  if (ids.has("copy") || ids.has("generic")) q.push(["What is the exact brand and model number? Can you send a photo of the label?", "ما العلامة التجارية والطراز بالتحديد؟ هل يمكن إرسال صورة الملصق؟"]);
  if (ids.has("no-warranty") || kind === "product") q.push(["Is there an official warranty, and for how long? Invoice included?", "فيه ضمان رسمي؟ مدته قد إيه؟ وفيه فاتورة؟"]);
  if (v.level === "overpriced" || v.target) q.push(["Can you do a better price? Others sell it for less.", "هل يمكن سعر أفضل؟ هناك أماكن تبيعه بسعر أقل."]);
  if (kind === "installment") q.push(["What is the total I pay, all fees included? Is there an early-payment penalty?", "كم إجمالي ما سأدفعه بكل الرسوم؟ وهل توجد غرامة على السداد المبكر؟"]);
  if (kind === "car") q.push(["Can I take it to an independent mechanic and check the papers (license, violations)?", "ممكن أكشف عليها عند ميكانيكي من برا وأشوف الرخصة والمخالفات؟"]);
  if (kind === "rent") q.push(["Is the contract registered, and who pays the maintenance and utilities?", "هل العقد موثّق؟ ومن يدفع الصيانة والمرافق؟"]);
  if (!q.length) q.push(["Can I get everything agreed in writing?", "هل يمكن أن يُكتب كل ما اتفقنا عليه؟"]);
  return q.slice(0, 5).map(([en, ar]) => ({ en, ar }));
}

/** The prompt that reads the offer into fields (JSON). */
export function extractMessages(offer, hasPhoto) {
  return [
    { role: "system", content: `You read an offer, listing, installment plan or seller's message and fill in its terms. Reply with ONLY a JSON object:
{"item": "what is sold, with brand and model if written", "kind": "product|car|installment|rent|service|investment|other", "price": number or null, "currency": "EGP|USD|…" or null, "cash_price": number or null, "down_payment": number or null, "monthly": number or null, "months": number or null, "fees": number or null, "seller": "name or null", "claims": ["short claims the seller makes"], "text": "the offer's own words, copied (up to 600 characters)", "unclear": "if the offer can honestly be read in two ways (which price is the real one, cash or installments, per month or in total, what is included) — ONE short question to ask the buyer; otherwise \"\""}
Rules: copy numbers exactly as written; null when not written — never guess. "price" is the price asked (the cash price if there is one).` },
    { role: "user", content: (hasPhoto ? "The offer is in the attached screenshot/photo." + (offer ? "\nAlso:\n" : "") : "") + (offer || "") },
  ];
}

/** Parse the model's JSON (tolerant). */
export function parseTerms(raw) {
  let j = null;
  try { const s = String(raw || ""); j = JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)); } catch (e) { return null; }
  if (!j || typeof j !== "object") return null;
  const n = (x) => (x == null || x === "" ? null : isFinite(num(x)) ? num(x) : null);
  return {
    item: String(j.item || "").slice(0, 120), kind: String(j.kind || "other").toLowerCase(),
    price: n(j.price), currency: j.currency ? String(j.currency).toUpperCase().slice(0, 4) : null,
    cash: n(j.cash_price), down: n(j.down_payment), monthly: n(j.monthly), months: n(j.months), fees: n(j.fees),
    seller: j.seller ? String(j.seller).slice(0, 60) : null, claims: Array.isArray(j.claims) ? j.claims.map(String).slice(0, 6) : [],
    text: String(j.text || "").slice(0, 800), unclear: String(j.unclear || "").trim().slice(0, 200),
  };
}

// ---- v5.42: "do you mean…?" — Ali: "if the AI doesn't understand the offer, make it ask the user
// do you mean that? so he answers yes or no and explains what he means" ----
const fmtN = (v) => Math.round(v).toLocaleString("en-US");
/** Is this amount written as a deposit / down payment / fee (not a second price)? */
function labelledPart(text, v) {
  const d = String(Math.round(v)).split("").join("[,.\\s٬]?");
  const w = "(deposit|down ?payment|down|advance|reserve|to hold|hold it|fee|fees|admin|عربون|مقدم|مقدّم|رسوم|تأمين|حجز)";
  return new RegExp(w + "[^\\d]{0,30}" + d + "(?!\\d)", "i").test(text) || new RegExp("(?<!\\d)" + d + "[^\\d]{0,20}" + w, "i").test(text);
}
/** What was understood, in one sentence the buyer can say yes or no to. */
export function readingOf(t, lang) {
  const ar = lang === "ar", cur = t.currency ? " " + t.currency : "";
  const item = t.item || (ar ? "هذا العرض" : "this");
  const cash = t.cash || t.price;
  const parts = [];
  if (cash) parts.push(ar ? `${item} بسعر ${fmtN(cash)}${cur} كاش` : `${item} for ${fmtN(cash)}${cur} cash`);
  else parts.push(ar ? `${item} من غير سعر كاش واضح` : `${item}, with no clear cash price`);
  if (t.monthly && t.months) {
    const down = t.down ? (ar ? `مقدم ${fmtN(t.down)}${cur} + ` : `${fmtN(t.down)}${cur} down + `) : "";
    const total = (t.down || 0) + t.monthly * t.months;
    parts.push(ar ? `أو بالتقسيط: ${down}${t.months} × ${fmtN(t.monthly)}${cur} (المجموع ${fmtN(total)}${cur})` : `or in installments: ${down}${t.months} × ${fmtN(t.monthly)}${cur} (${fmtN(total)}${cur} in total)`);
  } else if (t.monthly) parts.push(ar ? `وقسط ${fmtN(t.monthly)}${cur} شهريًا (عدد الأشهر غير مذكور)` : `and ${fmtN(t.monthly)}${cur} a month (the number of months isn't written)`);
  return (ar ? "قصدك: " : "Do you mean: ") + parts.join(ar ? "، " : ", ") + (ar ? "؟" : "?");
}
/**
 * Is the reading doubtful enough to ask first? → { en, ar } (why) or null.
 * Code decides: the model said it's unclear, two very different prices, no price at all,
 * a plan cheaper than cash, or months without an amount.
 */
export function needsConfirm(t, text, plan) {
  if (!t) return null;
  const mm = priceMismatch(text, plan);
  const cash = t.cash || t.price;
  if (mm && !(plan && plan.cash) && !labelledPart(text, mm.lo) && mm.lo !== t.down && mm.lo !== t.fees) return { en: `The offer has two very different prices (${fmtN(mm.hi)} and ${fmtN(mm.lo)}).`, ar: `العرض فيه سعرين مختلفين جدًا (${fmtN(mm.hi)} و ${fmtN(mm.lo)}).` };
  if (!cash && !t.monthly) return { en: "No price was found in the offer.", ar: "ملقتش سعر في العرض." };
  if (t.monthly && t.months && cash && (t.down || 0) + t.monthly * t.months < cash * 0.9) return { en: "The installments add up to less than the cash price — one of them was probably misread.", ar: "مجموع الأقساط أقل من السعر النقدي — غالبًا قُرئ أحد الأرقام خطأً." };
  if (t.months && !t.monthly) return { en: "The number of months is written but not the monthly amount.", ar: "عدد الأشهر مذكور لكن مبلغ القسط غير مذكور." };
  if (t.unclear) return { en: t.unclear, ar: t.unclear };
  return null;
}
/** The offer plus the buyer's explanation, for the second reading. */
export const withClarification = (text, note) => `${String(text || "").trim()}\n\n(The buyer explains what the offer means — trust this over the offer's wording: ${String(note || "").trim()})`;

/** The web search for the market price. */
export function marketQuery(item, lang, year = new Date().getFullYear()) {
  const it = String(item || "").replace(/\s+/g, " ").trim().slice(0, 80);
  return lang === "ar" ? `سعر ${it} في مصر ${year}` : `${it} price Egypt ${year}`;
}

/** Market prices from web pages, in the offer's currency, near the offer's size. */
export function marketFrom(hits, cur, price) {
  const vals = [];
  const used = [];
  for (const h of hits || []) {
    const ps = pricesIn((h.title || "") + "\n" + (h.text || "")).filter((x) => !cur || x.cur === cur)
      .map((x) => x.value).filter((v) => !(price > 0) || (v >= price / 5 && v <= price * 5));
    if (ps.length) { vals.push(...ps.slice(0, 4)); used.push(h); }
  }
  return { market: marketRange(vals), sources: used.slice(0, 6) };
}

/** The negotiation / reply message the model writes. */
export function messageMessages(t, v, lang, questions) {
  const ar = lang === "ar";
  return [
    { role: "system", content: ar
      ? "اكتب رسالة قصيرة ومهذبة بالعامية المصرية للبائع (٣–٥ سطور)، جاهزة للإرسال على واتساب. من غير مقدمات ولا شرح — الرسالة نفسها بس."
      : "Write a short, polite message to the seller (3–5 lines), ready to send on WhatsApp. No preamble, no explanation — only the message." },
    { role: "user", content: `Item: ${t.item || "the item"}\nAsked price: ${t.price || "?"} ${t.currency || ""}\n` +
      (v.target ? `Ask for about: ${v.target} ${t.currency || ""}\n` : "") +
      `Verdict: ${v.level}\nPoints: ${v.reasons.map((r) => r.en).join(" · ")}\nQuestions to include: ${questions.map((q) => q.en).join(" · ")}` +
      (v.level === "scam" ? "\nThis looks like a scam: write a firm, safe message that asks to meet and pay on delivery, and gives no money or codes." : "") },
  ];
}
