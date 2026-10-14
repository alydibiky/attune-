/* ---- v6.27: the Deadline Radar — money lost to forgotten deadlines (Ali, 14 Oct 2026: "build it, global, automatic + manual") ---
   Free trials that turn into charges, renewals, return windows, warranties and documents that expire (passport, licence,
   ID, insurance, visa, car registration, bank card). Read by CODE, in the common languages of the world, from:
     - payment / app notifications (the same queue as "Money tracks itself"),
     - the text of a receipt or document photo (read on the phone),
     - a sentence typed or pasted (here or in Chat),
     - or typed by hand in a form (the UI).
   A model is only a fallback when the rules find nothing, and only on the phone.
   An item: { id, kind, title, date (YYYY-MM-DD: the deadline), amount, currency, doc, base (purchase/notice date), note,
              source, status: "active"|"done", outcome, created }
   Pure logic; store "attune:radar:v1" = { items: [...], seen: [notification ids] }. Tests: tests/unit/v727radar.test.mjs. */
import { payAmount, payCurrency, payNormalize } from "./yusr/paytext.js";
import { MONTH_NAMES } from "./life.js";

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");
export const isoDay = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const at12 = (y, m, d) => new Date(y, m, d, 12).getTime();
const W = (words) => new RegExp("(?<![\\p{L}])(?:" + words + ")(?![\\p{L}])", "iu");

// ---- what each kind is, how early to warn ----------------------------------------------------------------------------
export const KINDS = {
  trial:    { alert: 2,  icon: "trial" },     // cancel before the first charge
  renewal:  { alert: 3,  icon: "renewal" },   // a subscription / membership / insurance renews
  return:   { alert: 3,  icon: "return" },    // the last day to return it
  warranty: { alert: 30, icon: "warranty" },  // the warranty ends: check it works, claim before
  expiry:   { alert: 30, icon: "expiry" },    // a document or card expires
  other:    { alert: 1,  icon: "other" },
};
// documents: passports need ~6 months left to travel in many countries, so they are flagged early
const DOCS = [
  ["passport", W("passport|passeport|pasaporte|passaporte|reisepass|passaporto|pasaport|paspor|paspoort|паспорт|护照|여권|旅券|جواز السفر|جواز سفر|جواز"), 180],
  ["visa", W("visa|visum|vize|viza|تأشيرة|الفيزا|فيزا|签证|비자|ビザ"), 30],
  ["licence", W("driving licen[cs]e|driver'?s licen[cs]e|licen[cs]e|permis de conduire|permis|licencia de conducir|carteira de motorista|cnh|führerschein|patente|ehliyet|sim [ac]|rijbewijs|водительск|驾照|운전면허|免許|رخصة القيادة|رخصة قيادة"), 30],
  ["id", W("national id|id card|identity card|carte d'identité|cni|dni|cédula|cedula|rg|personalausweis|carta d'identità|kimlik|ktp|identiteitskaart|удостоверение|身份证|주민등록|マイナンバー|بطاقة الرقم القومي|البطاقة الشخصية|بطاقة الهوية|الهوية الوطنية|الهوية|الإقامة|اقامة|iqama|emirates id|residence permit|titre de séjour|permiso de residencia|aufenthaltstitel|permesso di soggiorno|ikamet"), 30],
  ["insurance", W("insurance|policy|assurance|seguro|apólice|versicherung|assicurazione|polizza|sigorta|poliçe|asuransi|polis|verzekering|страховка|保险|보험|保険|تأمين|بوليصة"), 30],
  ["registration", W("vehicle registration|car registration|registration|carte grise|tarjeta de circulación|permiso de circulación|crlv|licenciamento|zulassung|tüv|hu|bollo|revisione|ruhsat|muayene|stnk|apk|mot|техосмотр|年检|자동차 검사|車検|رخصة السيارة|ترخيص السيارة|ترخيص|الفحص الفني|استمارة"), 30],
  ["card", W("card|carte|tarjeta|cartão|karte|carta|kart|kartu|kaart|карта|卡|카드|カード|بطاقة"), 30],
];

// ---- the words that say which kind a text is (most specific first) --------------------------------------------------------
const TRIAL = W("free trial|trial period|trial ends|trial will end|trial expires|your trial|trial of|day trial|month trial|essai gratuit|période d'essai|essai de|prueba gratuita|período de prueba|prueba de|teste grátis|período de teste|avaliação gratuita|teste gratuito|gratis testen|kostenlose testphase|testphase|probezeit|probemonat|prova gratuita|periodo di prova|ücretsiz deneme|deneme süresi|uji coba gratis|masa percobaan|gratis proberen|proefperiode|бесплатный пробный|пробный период|免费试用|试用期|무료 체험|無料体験|無料トライアル|الفترة التجريبية|تجربة مجانية|فترة تجريبية|الفتره التجريبيه");
const RENEW = W("renews?|will renew|auto-?renew(?:al|s)?|renewal date|next billing date|next billing|next payment|next charge|will be charged|billed on|se renouvelle|renouvellement|prochain prélèvement|prochaine facturation|se renovará|renovación|próximo cargo|próximo cobro|será renovad[oa]|renovação|próxima cobrança|verlängert sich|verlängerung|nächste abbuchung|nächste zahlung|si rinnova|rinnovo|prossimo addebito|yenilenecek|yenileme|sonraki ödeme|diperpanjang|perpanjangan|tagihan berikutnya|wordt verlengd|verlenging|продлится|продление|следующее списание|续订|自动续费|갱신|更新日|سيتم التجديد|يتجدد|التجديد التلقائي|تاريخ التجديد|سيتم خصم");
const RETURN = W("return(?:s)? (?:within|by|until|before|window|policy|period)|returnable (?:until|within|by)|free returns|days? to return|money[- ]back guarantee|refund within|retour(?:s)? (?:sous|jusqu'au|gratuit)|retourner (?:sous|avant)|droit de rétractation|délai de rétractation|devoluci[oó]n|devoluciones|devolver (?:en|hasta|antes)|plazo de devolución|devolução|devolver em|direito de arrependimento|rückgabe|rücksendung|widerrufsrecht|umtausch|reso entro|resi gratuiti|restituzione|diritto di recesso|iade (?:süresi|hakkı)|cayma hakkı|pengembalian (?:dalam|barang|dana dalam)|retourneren binnen|herroepingsrecht|возврат в течение|退货|7天无理由|반품|返品|الاسترجاع|الاسترداد خلال|إرجاع|ارجاع|الاستبدال والاسترجاع");
const WARRANTY = W("warranty|guarantee|guaranteed|garantie|garantía|garantia|gewährleistung|herstellergarantie|garanzia|garanti|garansi|гарантия|保修|保固|보증|保証|ضمان|الضمان|كفالة|الكفالة");
const EXPIRY = W("expir(?:es|y|ation|e|ed|ing)|exp\\.?(?=\\s*[:\\d])|valid (?:until|thru|through|till|to)|good thru|valid thru|date of expiry|expiry date|date d'expiration|expire le|valable jusqu'au|date de validité|vence|vencimiento|válid[oa] hasta|caducidad|caduca|validade|válid[oa] até|vence em|gültig bis|ablaufdatum|läuft ab|ablauf|scadenza|valid[oa] fino|scade il|son kullanma|geçerlilik|geçerli|berlaku (?:hingga|sampai)|masa berlaku|kedaluwarsa|geldig tot|vervaldatum|действителен до|срок действия|有效期|만료|有効期限|تاريخ الانتهاء|تاريخ الإنتهاء|ينتهي في|ينتهي|تنتهي|صالح حتى|صالحة حتى|صلاحية|تنتهي صلاحية");

// ---- dates ---------------------------------------------------------------------------------------------------------------
const MONTH_RES = MONTH_NAMES.map((n) => "(?:" + n + ")\\.?");
const monthIdx = (word) => { const w = String(word || "").toLowerCase(); for (let i = 0; i < 12; i++) if (new RegExp("^" + MONTH_RES[i] + "$", "iu").test(w)) return i; return -1; };
const MONTH_ANY = "(" + MONTH_NAMES.join("|") + ")\\.?";
const fold = (s) => payNormalize(s).replace(/[أإآ]/g, "ا").replace(/ى/g, "ي");
/** Every date in a text: [{ t (ms, noon), at (index), len, kind: "full"|"monthyear"|"daymonth" }].
 *  order "mdy" reads 03/04 as 4 March (the US), else 3 April; 13/02 and 02/13 are read the only way they can be. */
export function datesIn(text, { now = Date.now(), order = "dmy" } = {}) {
  const t = fold(text), out = [];
  const push = (y, m, d, at, len, kind) => { if (m >= 0 && m < 12 && d >= 1 && d <= 31 && y >= 1990 && y <= 2100) out.push({ t: at12(y, m, d), at, len, kind }); };
  const yr = (s) => (s.length === 2 ? 2000 + +s : +s);
  let m;
  // 2026-11-12, 2026/11/12, 2026.11.12
  const RE1 = /(?<!\d)(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?!\d)/g;
  while ((m = RE1.exec(t))) push(+m[1], +m[2] - 1, +m[3], m.index, m[0].length, "full");
  // 12/11/2026, 11-12-26, 12.11.2026
  const RE2 = /(?<![\d\/.-])(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4}|\d{2})(?![\d\/.-])/g;
  while ((m = RE2.exec(t))) {
    let a = +m[1], b = +m[2];
    let d = a, mo = b;
    if (b > 12 || (order === "mdy" && a <= 12)) { d = b; mo = a; }
    push(yr(m[3]), mo - 1, d, m.index, m[0].length, "full");
  }
  // 12 November 2026 · 12 de noviembre de 2026 · 12. November · 12 نوفمبر
  const RE3 = new RegExp("(?<!\\d)(\\d{1,2})(?:st|nd|rd|th|er|º|\\.)?\\s*(?:de\\s+|of\\s+)?" + MONTH_ANY + "(?![\\p{L}])(?:,?\\s*(?:de\\s+)?(\\d{4}))?", "giu");
  while ((m = RE3.exec(t))) { const mo = monthIdx(m[2]); if (mo < 0) continue; const y = m[3] ? +m[3] : yearFor(mo, +m[1], now); push(y, mo, +m[1], m.index, m[0].length, m[3] ? "full" : "daymonth"); }
  // November 12, 2026 · Nov 12
  const RE4 = new RegExp("(?<![\\p{L}])" + MONTH_ANY + "\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)(?:,?\\s*(\\d{4}))?", "giu");
  while ((m = RE4.exec(t))) { const mo = monthIdx(m[1]); if (mo < 0 || overlaps(out, m.index)) continue; const y = m[3] ? +m[3] : yearFor(mo, +m[2], now); push(y, mo, +m[2], m.index, m[0].length, m[3] ? "full" : "daymonth"); }
  // November 2026 / 11/2027 / 03/27 (a card's "valid thru") → the last day of that month
  const RE5 = new RegExp("(?<![\\p{L}\\d])" + MONTH_ANY + "\\s+(\\d{4})(?!\\d)", "giu");
  while ((m = RE5.exec(t))) { const mo = monthIdx(m[1]); if (mo < 0 || overlaps(out, m.index)) continue; push(+m[2], mo, lastDay(+m[2], mo), m.index, m[0].length, "monthyear"); }
  const RE6 = /(?<![\d\/.-])(0?[1-9]|1[0-2])\s?\/\s?(\d{4}|\d{2})(?![\d\/.-])/g;
  while ((m = RE6.exec(t))) { if (overlaps(out, m.index)) continue; const y = yr(m[2]); push(y, +m[1] - 1, lastDay(y, +m[1] - 1), m.index, m[0].length, "monthyear"); }
  return out.sort((a, b) => a.at - b.at);
}
const lastDay = (y, m) => new Date(y, m + 1, 0).getDate();
const overlaps = (list, at) => list.some((d) => at >= d.at && at < d.at + d.len);
// a day and month without a year: the next time it comes (a deadline is in the future), unless it was within the last 2 months
function yearFor(mo, d, now) {
  const n = new Date(now), y = n.getFullYear(), t = at12(y, mo, d);
  return t < now - 60 * DAY ? y + 1 : y;
}

// ---- durations: "30-day", "2 years", "سنتين", "24 meses" → days -------------------------------------------------------------
const UNIT = [
  [365, "years?|yrs?|ans?|années?|años?|anos?|jahre?|jahren|anni|anno|yıl|tahun|jaar|jaren|лет|года?|年|년|سنوات|سنين|سنه|سنة|عام|اعوام|أعوام"],
  [30, "months?|mos?|mois|meses|mes|monate?|monaten|mesi|mese|ay|bulan|maand(?:en)?|месяц(?:а|ев)?|个月|개월|ヶ月|か月|شهور|اشهر|أشهر|شهر"],
  [7, "weeks?|wks?|semaines?|semanas?|wochen?|settimane?|hafta|minggu|weken?|недел[иья]|周|주|週間|اسابيع|أسابيع|اسبوع|أسبوع"],
  [1, "days?|jours?|días?|dias?|tage?n?|giorni|giorno|gün|hari|dagen?|дн(?:ей|я)|день|天|일|日間|日|ايام|أيام|يوم"],
];
const NUMW = { one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10, twelve: 12, fourteen: 14, thirty: 30, un: 1, une: 1, deux: 2, trois: 3, uno: 1, una: 1, dos: 2, tres: 3, um: 1, uma: 1, dois: 2, duas: 2, ein: 1, eine: 1, einem: 1, zwei: 2, drei: 3, due: 2, bir: 1, iki: 2, üç: 3, satu: 1, dua: 2, tiga: 3 };
/** "30-day free trial" → 30 · "2-year warranty" → 730 · "ضمان سنتين" → 730 · "14 días" → 14. → days, or 0. */
export function durationIn(text) { const f = durationsIn(text); return f.length ? f[0].days : 0; }
/** Every duration with where it is: [{ at, days }] in order. */
export function durationsIn(text) {
  const t = fold(text).toLowerCase();
  // every duration in the text; the FIRST one wins ("returns within 30 days · 2-year warranty" → 30 for the return)
  const found = [];
  const dual = /سنتين|عامين|شهرين|اسبوعين|أسبوعين/g; let m;
  while ((m = dual.exec(t))) found.push({ at: m.index, days: /شهرين/.test(m[0]) ? 60 : /سبوعين/.test(m[0]) ? 14 : 730 });
  for (const [days, u] of UNIT) {
    const re = new RegExp("(?<![\\d.,])(\\d{1,3}|" + Object.keys(NUMW).join("|") + ")\\s*[- ]?\\s*(?:" + u + ")(?![\\p{L}])", "giu");
    while ((m = re.exec(t))) { const n = /^\d/.test(m[1]) ? +m[1] : NUMW[m[1]]; if (n > 0 && n <= (days === 1 ? 400 : days === 7 ? 104 : days === 30 ? 120 : 30)) found.push({ at: m.index, days: n * days }); }
  }
  if (!found.length) { const y = /(?<![\p{L}])(سنه|سنة|عام)(?![\p{L}])/u.exec(t); if (y) found.push({ at: y.index, days: 365 }); }
  return found.sort((a, b) => a.at - b.at);
}

// ---- names ---------------------------------------------------------------------------------------------------------------
const SERVICES = /netflix|spotify|disney\+?|hulu|hbo max|hbo|max|paramount\+?|peacock|prime video|amazon prime|apple tv\+?|apple music|apple one|icloud\+?|youtube premium|youtube music|youtube tv|google one|crunchyroll|deezer|tidal|audible|kindle unlimited|xbox game pass|game pass|playstation plus|ps plus|nintendo switch online|microsoft 365|office 365|dropbox|chatgpt plus|chatgpt|claude pro|gemini advanced|copilot pro|canva pro|canva|adobe creative cloud|adobe|figma|notion|evernote|grammarly|duolingo plus|super duolingo|duolingo|babbel|headspace|calm|strava|peloton|linkedin premium|linkedin|patreon|twitch|tinder|bumble|hinge|nordvpn|expressvpn|surfshark|1password|lastpass|shahid vip|shahid|osn\+?|watch it|anghami plus|anghami|starzplay|tod|beIN|dazn|sky|now tv|britbox|mubi|curiositystream|skillshare|masterclass|coursera plus|udemy|brilliant|scribd|medium|substack|nyt|new york times|washington post|the economist|financial times|wsj|uber one|lyft pink|doordash dashpass|dashpass|instacart\+?|walmart\+|costco|sam's club|amazon|gym|fitness first|planet fitness|gold's gym/i;
const NOT_TITLE = /^(your|you|the|a|an|this|that|we|our|hi|hello|dear|thank|thanks|receipt|invoice|order|total|subtotal|tax|vat|date|datum|fecha|time|cash|card|visa|mastercard|change|qty|item|price|amount|tel|phone|www|http|summe|gesamt|total|rechnung|facture|factura|nota|fatura|struk|نشكر|شكرا|فاتورة|الإجمالي|الاجمالي|المجموع|ضريبة|التاريخ|ضمان|الضمان)(?![\p{L}])/iu;
/** The best name for a deadline: a known service, else the line of a receipt that names the product, else a short lead. */
function titleOf(raw, kind, doc) {
  const s = SERVICES.exec(raw);
  if (s && (kind === "trial" || kind === "renewal")) return cap(s[0]);
  if (kind === "expiry" && doc) return DOC_NAME[doc];
  // "Your Spotify Premium trial…", "Netflix subscription": a capitalised name before trial / subscription / membership
  const m = /([A-Z][\w+&'’.-]*(?:\s+[A-Z][\w+&'’.-]*){0,2})\s+(?:free\s+)?(?:trial|subscription|membership|plan|premium)/.exec(raw);
  if (m && !NOT_TITLE.test(m[1])) return m[1].trim();
  if (s) return cap(s[0]);
  // a receipt: the first line that looks like a product (letters, not a header word, not only numbers)
  const lines = String(raw).split(/\n+/).map((l) => l.trim()).filter((l) => /\p{L}{3,}/u.test(l) && l.length <= 60 && !NOT_TITLE.test(l) && !/^[^\p{L}]*\d/u.test(l) && !WARRANTY.test(l) && !RETURN.test(l));
  const prod = lines.find((l) => /(?:tv|phone|laptop|watch|fridge|refrigerator|washer|washing|machine|camera|headphones?|earbuds|airpods|iphone|galaxy|pixel|macbook|ipad|tablet|console|playstation|xbox|vacuum|oven|microwave|monitor|printer|router|speaker|shoes?|jacket|dress|bike|sofa|mattress|chair|desk|ثلاجة|غسالة|تلفزيون|شاشة|موبايل|هاتف|لابتوب|سماعة|ساعة|مكيف|تكييف|بوتاجاز|ميكروويف)/i.test(l));
  return (prod || (kind === "return" || kind === "warranty" ? lines[1] || lines[0] : lines[0]) || "").replace(/\s{2,}/g, " ").slice(0, 48);
}
const cap = (w) => String(w || "").replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
export const DOC_NAME = { passport: "Passport", visa: "Visa", licence: "Driving licence", id: "ID card", insurance: "Insurance", registration: "Car registration", card: "Bank card" };

// ---- the reader ----------------------------------------------------------------------------------------------------------
/**
 * A text (a notification, a receipt read from a photo, a pasted email, a typed sentence) → the deadlines in it:
 * [{ kind, title, date, amount, currency, doc, base, confidence, why }]. A receipt can give two (return + warranty).
 * opts: { now, order ("dmy"|"mdy"), home (the person's currency), base (when the message/photo was made) }.
 */
export function readDeadlines(text, opts = {}) {
  const raw = String(text || "").trim(); if (!raw || raw.length > 6000) return [];
  const now = opts.now || Date.now(), base0 = opts.base || now;
  const t = fold(raw);
  const dates = datesIn(raw, { now, order: opts.order });
  // the amount, with the dates blanked out first (a year or a card's 03/27 is not a price)
  let masked = fold(raw); for (const d of dates) masked = masked.slice(0, d.at) + " ".repeat(d.len) + masked.slice(d.at + d.len);
  const amt = payAmount(masked, opts.home), cur = payCurrency(raw, opts.home) || (amt ? opts.home || "" : "");
  const amount = amt ? amt.value : 0;
  // the purchase / notice date: a date next to "date|purchased|order|invoice", else the earliest past date, else the message time
  const baseD = dates.find((d) => /(?:date|dated|purchased?|bought|ordered|order date|invoice|issued|fecha|date d'achat|datum|data|tarih|tanggal|التاريخ|تاريخ الشراء|تاريخ الفاتورة)\W{0,12}$/i.test(t.slice(Math.max(0, d.at - 30), d.at)))
    || dates.filter((d) => d.t <= now + DAY).sort((a, b) => a.t - b.t)[0];
  const base = baseD ? baseD.t : base0;
  const after = (re) => { // the first date after the words that say "this is the deadline"
    const m = re.exec(t); if (!m) return null;
    return dates.find((d) => d.at >= m.index && d.at - (m.index + m[0].length) < 60) || null;
  };
  const out = [];
  const add = (kind, date, extra = {}) => {
    if (!date) return;
    const iso = isoDay(date);
    if (out.some((x) => x.kind === kind && x.date === iso)) return;
    out.push({ kind, date: iso, amount, currency: cur, title: titleOf(raw, kind, extra.doc), base: isoDay(base), confidence: "high", ...extra });
  };
  const dur = durationIn(raw);
  if (TRIAL.test(t)) {
    const d = after(/(?:ends?|ending|expires?|until|till|on|charged|billed|termine|finaliza|termina|acaba|endet|scade|termina il|bitiyor|berakhir|ينتهي|تنتهي|حتى)\b|charge you|first payment|primer cargo|premier prélèvement|erste zahlung/iu) || dates.find((d) => d.t > now - DAY);
    if (d) add("trial", d.t, { why: "date" });
    else if (dur) add("trial", base + dur * DAY, { why: "duration", confidence: "medium" });
  }
  if (!out.length && RENEW.test(t)) {
    const d = after(RENEW) || dates.find((d) => d.t > now - DAY);
    if (d) add("renewal", d.t, { why: "date" });
  }
  if (RETURN.test(t)) {
    const d = after(/(?:return(?:s|able)?|refund|retour|devoluci[oó]n|devolver|devolução|rückgabe|reso|iade|pengembalian|الاسترجاع|إرجاع|ارجاع)[^\d]{0,40}?(?:by|until|before|till|closes?(?: on)?|ends?(?: on)?|expires?(?: on)?|jusqu'au|avant|hasta|antes del?|até|bis|entro il|kadar|sebelum|حتى|قبل)(?![\p{L}])/iu);
    if (d) add("return", d.t, { why: "date" });
    else add("return", base + (durationIn(t.slice(RETURN.exec(t).index, RETURN.exec(t).index + 60)) || dur || 14) * DAY, { why: dur ? "duration" : "default", confidence: dur ? "high" : "low" });
  }
  if (WARRANTY.test(t)) {
    const w = WARRANTY.exec(t);
    // the duration closest to the word "warranty" (a receipt may also say "30 days to return")
    const wl = durationsIn(t).filter((x) => Math.abs(x.at - w.index) < 60).sort((a, b) => Math.abs(a.at - w.index) - Math.abs(b.at - w.index));
    const wd = wl.length ? wl[0].days : 0;
    const d = after(/(?:warranty|guarantee|garantie|garantía|garantia|garanzia|garanti|garansi|ضمان|الضمان)\W{0,30}?(?:until|till|expires?|ends?|valid until|jusqu'au|hasta|até|bis|fino al|kadar|hingga|حتى|ينتهي)/iu);
    if (d) add("warranty", d.t, { why: "date" });
    else if (wd) add("warranty", addMonths(base, wd), { why: "duration" });
    else add("warranty", addMonths(base, 365), { why: "default", confidence: "low" });
  }
  if (EXPIRY.test(t) && !out.some((x) => x.kind === "trial")) {
    const d = after(EXPIRY) || dates.filter((d) => d.t > now - 30 * DAY).sort((a, b) => b.t - a.t)[0];
    const card = /(?:visa|mastercard|master card|amex|american express|maestro|mada|meeza|rupay|discover|unionpay|elo|carte bleue)\s*(?:card\s*)?(?:[•*x·.]{2,}|\d{4}|ending)|valid thru|good thru|card ending|carte se terminant/i.test(t);
    if (d) { const doc = card ? "card" : (DOCS.find(([, re]) => re.test(t)) || [])[0] || ""; add("expiry", d.t, { why: "date", doc }); }
  }
  return out;
}
// a duration in whole years/months lands on the same day of the month (a 2-year warranty from 14 Oct 2026 → 14 Oct 2028)
function addMonths(base, days) {
  const d = new Date(base);
  if (days % 365 === 0) d.setFullYear(d.getFullYear() + days / 365);
  else if (days % 30 === 0) d.setMonth(d.getMonth() + days / 30);
  else d.setDate(d.getDate() + days);
  return d.getTime();
}

// ---- a phone model's fallback (only when the rules find nothing and a model is loaded) ----------------------------------------
export function deadlineModelPrompt(text) {
  return `Find the deadline in this text (a free trial that will charge, a renewal, the last day to return something, a warranty end, or a document/card expiry). Text: «${String(text).slice(0, 600)}»
Reply with ONLY one JSON object: {"kind": "trial"|"renewal"|"return"|"warranty"|"expiry"|null, "title": short name of the thing, "date": "YYYY-MM-DD" of the deadline or "", "amount": number or 0}`;
}
export function readDeadlineModel(out, opts = {}) {
  const m = /\{[\s\S]*\}/.exec(String(out || "")); if (!m) return [];
  let j; try { j = JSON.parse(m[0]); } catch (e) { return []; }
  if (!KINDS[j.kind] || !/^\d{4}-\d{2}-\d{2}$/.test(j.date || "")) return [];
  return [{ kind: j.kind, title: String(j.title || "").slice(0, 48), date: j.date, amount: Number(j.amount) > 0 ? Number(j.amount) : 0, currency: opts.home || "", base: isoDay(opts.now || Date.now()), confidence: "medium", model: true }];
}

// ---- Chat: «my Netflix trial ends on 20 November» → watch it ----------------------------------------------------------------
export function chatDeadlineIntent(text, opts = {}) {
  const t = String(text || "").trim();
  if (!t || t.length > 300 || /[?؟]\s*$/.test(t) || /^[¿]/.test(t)) return null;
  if (/\b(what|how|why|should|can|explain|write|tell me|calculate|compare)\b|اشرح|اكتب|احسب|ازاي|ليه/i.test(t)) return null;
  const found = readDeadlines(t, opts).filter((d) => d.confidence !== "low" && d.date >= isoDay(opts.now || Date.now()));
  return found.length ? found[0] : null;
}

// ---- notifications → suggestions ----------------------------------------------------------------------------------------------
/** Stored notifications [{id, title, text, ts, app}] → deadlines not yet seen: [{ ...deadline, nid, source: "notification" }]. */
export function fromNotifications(queue, seen = [], opts = {}) {
  const skip = new Set(seen), out = [];
  for (const n of queue || []) {
    if (!n || skip.has(n.id)) continue;
    const text = [n.title, n.text].filter(Boolean).join(" — ");
    for (const d of readDeadlines(text, { ...opts, base: n.ts || opts.now })) if (d.confidence !== "low") out.push({ ...d, nid: n.id, app: n.app || "", source: "notification", note: text.slice(0, 200) });
  }
  return out;
}

// ---- the store, and what to show ------------------------------------------------------------------------------------------------
export const RADAR_KEY = "attune:radar:v1";
export const FREE_LIMIT = 3;
export const loadRadar = (store = typeof localStorage !== "undefined" ? localStorage : null) => {
  try { const j = JSON.parse((store && store.getItem(RADAR_KEY)) || "null"); return j && Array.isArray(j.items) ? { seen: [], ...j } : { items: [], seen: [] }; } catch (e) { return { items: [], seen: [] }; }
};
export const saveRadar = (data, store = typeof localStorage !== "undefined" ? localStorage : null) => { try { store && store.setItem(RADAR_KEY, JSON.stringify(data)); } catch (e) {} return data; };
const norm = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
/** Add one (the same kind + name + date is kept once). → { data, item, dup } */
export function addDeadline(data, d, now = Date.now()) {
  const dup = data.items.find((x) => x.status !== "done" && x.kind === d.kind && x.date === d.date && norm(x.title) === norm(d.title));
  if (dup) return { data, item: dup, dup: true };
  const item = { id: "d" + now.toString(36) + Math.random().toString(36).slice(2, 6), kind: KINDS[d.kind] ? d.kind : "other", title: String(d.title || "").slice(0, 60), date: d.date,
    amount: Number(d.amount) > 0 ? Math.round(Number(d.amount) * 100) / 100 : 0, currency: d.currency || "", doc: d.doc || "", base: d.base || isoDay(now), note: String(d.note || "").slice(0, 300),
    photo: d.photo || "", source: d.source || "typed", status: "active", created: now };
  return { data: { ...data, items: [...data.items, item] }, item, dup: false };
}
export const updateDeadline = (data, id, patch) => ({ ...data, items: data.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
export const removeDeadline = (data, id) => ({ ...data, items: data.items.filter((x) => x.id !== id) });
export const markSeen = (data, ids) => ({ ...data, seen: [...new Set([...(data.seen || []), ...ids])].slice(-500) });
/** Done: outcome "cancelled" (a trial / renewal stopped before the charge), "returned", "claimed" (warranty), "renewed",
 *  "kept". → { data, saved } — saved = the money it kept in the person's pocket (for the Guardian's honest counter). */
export function resolveDeadline(data, id, outcome, now = Date.now()) {
  const x = data.items.find((i) => i.id === id); if (!x) return { data, saved: 0 };
  const saves = { cancelled: ["trial", "renewal"], returned: ["return"], claimed: ["warranty"] };
  const saved = (saves[outcome] || []).includes(x.kind) && x.date >= isoDay(now) || outcome === "claimed" ? x.amount || 0 : 0;
  return { data: updateDeadline(data, id, { status: "done", outcome, doneAt: now }), saved };
}
/** How many days are left (0 = today, negative = passed). */
export const daysLeft = (x, now = Date.now()) => Math.round((Date.parse(x.date + "T12:00:00") - at12(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate())) / DAY);
/** How early to warn for this item (a passport earlier than a trial). */
export const alertDays = (x) => (x.kind === "expiry" ? ((DOCS.find(([k]) => k === x.doc) || [])[2] || KINDS.expiry.alert) : (KINDS[x.kind] || KINDS.other).alert);
/** The reminder for an item: 9:00 on (deadline − alert days); if that has passed but the deadline hasn't, in an hour. */
export function radarReminder(x, now = Date.now()) {
  if (x.status === "done") return null;
  const end = Date.parse(x.date + "T20:00:00"); if (end < now) return null;
  let at = Date.parse(x.date + "T09:00:00") - alertDays(x) * DAY;
  if (at < now) at = now + 3600000;
  const left = daysLeft(x, at);
  const what = { trial: "Free trial ends", renewal: "Renews", return: "Last day to return", warranty: "Warranty ends", expiry: "Expires", other: "Deadline" }[x.kind];
  return { id: "radar-" + x.id, at, title: `${what}: ${x.title || ""}`.trim(), body: `${x.date}${left > 0 ? ` (in ${left} day${left === 1 ? "" : "s"})` : ""}${x.amount ? ` · ${x.amount.toLocaleString("en-US")} ${x.currency || ""}`.trimEnd() : ""}` };
}
/** The page's lists: soon (inside its warning window, or passed in the last 7 days), later, done; the active count. */
export function radarView(data, now = Date.now()) {
  const act = data.items.filter((x) => x.status !== "done").sort((a, b) => a.date.localeCompare(b.date));
  const soon = [], later = [];
  for (const x of act) { const l = daysLeft(x, now); if (l < -7) continue; (l <= alertDays(x) ? soon : later).push(x); }
  return { soon, later, done: data.items.filter((x) => x.status === "done").sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)), active: act.length };
}
/** Home's TODAY: the radar items inside their warning window. */
export const radarToday = (data, now = Date.now()) => radarView(data, now).soon.filter((x) => daysLeft(x, now) >= 0 && daysLeft(x, now) <= Math.min(alertDays(x), 7));
