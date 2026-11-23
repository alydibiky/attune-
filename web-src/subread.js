/* ---- v10.9.4 the subscription reader (Ali, 23 Nov 2026: "taking a SS of a subscription should be put right in a subscription with the
   appropriate title"; OK-SS: "accuracy is everything"; SCAN_PLAN.md job 5). The text of a screenshot / photo / e-mail (from the phone's
   text readers) → { service, plan, amount, currency, cycle, next, last4, cancelled, sure, why }.
   Every number is checked by code: the price is the one NEXT TO a price word or a period ("/month", "per year", «شهريًا»), never a
   crossed-out old price, a discount, VAT alone, a card number, a date or a phone number; two different prices with the same weight →
   not sure (the card asks one question). Pure; tests: tests/scan/gen.mjs (10,000 composed HARD) + tests/unit/v1094scan.test.mjs. */
import { datesIn } from "./deadlines.js";

/** The services people pay for every month or year, in Attune's 30 countries (name → the words that find it). Add freely. */
export const SERVICES = [
  ["Netflix", /netflix|نتفليكس|نتفلكس|نيتفليكس/i], ["Shahid VIP", /shahid|شاهد/i], ["OSN+", /\bosn\s?\+|osn plus|\bosn\b/i], ["WATCH IT", /watch ?it\b|واتش ?ات/i],
  ["Anghami", /anghami|[أإا]نغامي/i], ["Spotify", /spotify|سبوتيفاي/i], ["YouTube Premium", /youtube (?:premium|music)|يوتيوب بريميوم/i],
  ["Apple", /icloud\+?|apple (?:music|tv\+?|one|arcade)/i], ["Google One", /google one|جوجل ون/i], ["Google Gemini", /gemini|google ai (?:pro|premium|ultra|plus)/i],
  ["Disney+", /disney\s?\+|disney plus/i], ["Amazon Prime", /amazon prime|prime video|برايم/i], ["STARZPLAY", /starz ?play/i], ["TOD", /\btod\b(?= |\.|$)|tod tv/i],
  ["beIN", /bein (?:connect|sports)/i], ["Yango Play", /yango play/i], ["Deezer", /deezer/i], ["Crunchyroll", /crunchyroll/i], ["Max", /\bhbo max\b|\bmax\b (?:standard|basic|ultimate)/i],
  ["Hulu", /\bhulu\b/i], ["Paramount+", /paramount\s?\+/i], ["Peacock", /\bpeacock\b/i], ["Audible", /audible/i], ["Kindle Unlimited", /kindle unlimited/i],
  ["Xbox Game Pass", /game pass|xbox/i], ["PlayStation Plus", /playstation plus|ps plus/i], ["Nintendo Switch Online", /nintendo switch online/i],
  ["Microsoft 365", /microsoft 365|office 365/i], ["Dropbox", /dropbox/i], ["ChatGPT", /chatgpt|openai/i], ["Claude", /claude (?:pro|max)|anthropic/i],
  ["Canva", /canva/i], ["Adobe", /adobe|creative cloud|lightroom|photoshop/i], ["Notion", /\bnotion\b/i], ["Duolingo", /duolingo/i], ["LinkedIn Premium", /linkedin premium/i],
  ["Telegram Premium", /telegram premium/i], ["Snapchat+", /snapchat\s?\+/i], ["X Premium", /\bx premium\b|twitter blue/i], ["Discord Nitro", /discord nitro|\bnitro\b/i],
  ["Zoom", /\bzoom (?:pro|workplace|one)\b/i], ["Grammarly", /grammarly/i], ["NordVPN", /nordvpn/i], ["ExpressVPN", /expressvpn/i], ["Strava", /strava/i],
  ["Calm", /\bcalm (?:premium|subscription)\b/i], ["Headspace", /headspace/i], ["JioHotstar", /hotstar|jiocinema/i], ["ZEE5", /zee5/i], ["SonyLIV", /sony ?liv/i],
  ["Viu", /\bviu\b/i], ["iQIYI", /iqiyi/i], ["Vidio", /\bvidio\b/i], ["MUBI", /\bmubi\b/i], ["Tinder", /tinder/i], ["Bumble", /bumble/i], ["CapCut", /capcut/i],
  ["Google Play Pass", /play pass/i], ["Proton", /proton (?:mail|vpn|pass|unlimited)/i], ["1Password", /1password/i], ["Bitwarden", /bitwarden/i],
];
const CUR = [
  ["BRL", /\bbrl\b|R\$/i], ["EGP", /\begp\b|\bEGP\b|(?<![\p{L}])(?:LE|L\.E\.?|Le\.?)(?![\p{L}])|ج\.?\s?م|جنيه|جنية/u], ["SAR", /\bsar\b|ر\.?\s?س|ريال سعودي|﷼/i], ["AED", /\baed\b|د\.?\s?إ|د\.ا(?![\p{L}])|درهم/iu], ["KWD", /\bkwd\b|د\.?\s?ك|دينار كويتي/i],
  ["QAR", /\bqar\b|ر\.?\s?ق|ريال قطري/i], ["BHD", /\bbhd\b|د\.?\s?ب/i], ["OMR", /\bomr\b|ر\.?\s?ع/i], ["JOD", /\bjod\b|د\.?\s?أ|دينار أردني|دينار/i], ["MAD", /\bmad\b|د\.?\s?م|درهم مغربي/i],
  ["USD", /\busd\b|us\s?\$|(?<!R|r)\$/i], ["EUR", /\beur\b|€/i], ["GBP", /\bgbp\b|£/i], ["INR", /\binr\b|₹|\brs\.?/i], ["TRY", /\btry\b|₺|\btl\b/i], ["IDR", /\bidr\b|\brp\.?/i],
  ["PKR", /\bpkr\b/i], ["NGN", /\bngn\b|₦/i], ["KES", /\bkes\b|\bksh\b/i], ["ZAR", /\bzar\b|(?<![\p{L}$])R(?![\p{L}$])/u], ["MXN", /\bmxn\b/i], ["JPY", /\bjpy\b|¥|円/i],
  ["KRW", /\bkrw\b|₩/i], ["CNY", /\bcny\b|\brmb\b|元/i], ["RUB", /\brub\b|₽|руб/i], ["THB", /\bthb\b|฿/i], ["VND", /\bvnd\b|₫/i], ["BDT", /\bbdt\b|৳/i], ["PHP", /\bphp\b|₱/i],
];
// a period next to a price: month / year / week (20 languages' common words)
const MONTH_W = /\/\s?(?:mo|mth|month)\b|\bper month\b|\bmonthly\b|\ba month\b|\bevery month\b|\b1 month\b|شهري|شهريا|شهرياً|في الشهر|بالشهر|كل شهر|\/\s?شهر|(?<![\p{L}])(?:mensuel(?:le)?|par mois|mensual|al mes|por mes|monatlich|pro monat|mensal|por mês|mensile|al mese|aylık|aylik|ayda|per bulan|bulanan|в месяц|ежемесячно|मासिक|प्रति माह|ماهانه|মাসিক|kwa mwezi|รายเดือน|hàng tháng|每月|月額|월)(?![\p{L}])/iu;
const YEAR_W = /\/\s?(?:yr|year)\b|\bper year\b|\byearly\b|\bannual(?:ly)?\b|\ba year\b|\bevery year\b|\b12 months\b|سنوي|سنويا|سنوياً|في السنة|بالسنة|كل سنة|\/\s?سنة|(?<![\p{L}])(?:annuel(?:le)?|par an|anual|al año|por año|jährlich|pro jahr|por ano|annuale|all'anno|yıllık|yillik|yılda|per tahun|tahunan|в год|ежегодно|वार्षिक|سالانه|বার্ষিক|kwa mwaka|รายปี|hàng năm|每年|年額|연간)(?![\p{L}])/iu;
const WEEK_W = /\/\s?(?:wk|week)\b|\bper week\b|\bweekly\b|أسبوعي|اسبوعي|في الأسبوع|(?<![\p{L}])(?:hebdomadaire|semanal|wöchentlich|haftalık|mingguan|еженедельно)(?![\p{L}])/iu;
const PRICE_W = /\b(?:price|plan|amount|total|charged|billed|you paid|paid|payment of|renews? (?:at|for)|subscription|membership|cost)\b|السعر|المبلغ|الإجمالي|الاجمالي|الإجمالى|إجمالي|اجمالي|تم خصم|المدفوع|قيمة الاشتراك|الاشتراك|(?<![\p{L}])(?:prix|montant|total|precio|importe|preis|betrag|gesamt|preço|valor|prezzo|importo|tutar|toplam|fiyat|harga|jumlah|сумма|цена|итого|राशि|कुल|مبلغ|قیمت|মূল্য|bei|jumla|ราคา|ยอด|giá|tổng|价格|金额|合计|料金|合計|금액|합계)(?![\p{L}])/iu;
const TOTAL_W = /\btotal\b|الإجمالي|الاجمالي|الإجمالى|إجمالي|اجمالي|(?<![\p{L}])(?:gesamt|toplam|jumlah|итого|कुल|جمع|tổng|合计|合計|합계|ยอดรวม|jumla)(?![\p{L}])/iu;
// numbers that are NOT the price: an old / crossed-out price, a saving, VAT alone, a discount
const NOT_PRICE = /\b(?:was|before|instead of|save|saving|you save|off|discount|reg(?:ular)?\.? price|old price|vat|tax|subtotal|sub-total|fee)\b|بدلا من|بدلاً من|كان|وفر|وفّر|خصم|الضريبة|ضريبة|قبل الخصم|(?<![\p{L}])(?:au lieu de|économisez|remise|tva|en lugar de|ahorra|descuento|iva|statt|sparen|rabatt|mwst|em vez de|economize|desconto|invece di|risparmia|sconto|yerine|tasarruf|indirim|kdv|hemat|diskon|pajak|ppn|скидка|экономия|ндс|छूट|बचत|تخفیف|মূসক|ছাড়|punguzo|ส่วนลด|ภาษี|giảm|thuế|节省|折扣|税|割引|消費税|할인|부가세)(?![\p{L}])/iu;
const FREE_W = /\bfree\b|\btrial\b|مجان|تجربة|(?<![\p{L}])(?:gratuit|gratis|kostenlos|ücretsiz|deneme|gratuito|essai|prueba|probe|uji coba|бесплатно|मुफ़्त|رایگان|বিনামূল্যে|bure|ฟรี|miễn phí|免费|無料|무료)(?![\p{L}])/iu;
const THEN_W = /\bthen\b|\bafter that\b|\bafterwards\b|وبعدها|بعدها|ثم|بعد كده|بعد ذلك|(?<![\p{L}])(?:puis|ensuite|luego|después|danach|dann|depois|poi|sonra|lalu|kemudian|затем|потом|फिर|سپس|তারপর|kisha|จากนั้น|sau đó|然后|その後|이후)(?![\p{L}])/iu;
const NEXT_W = /\bnext (?:billing|payment|charge|bill|renewal)\b|\brenews?\b|\brenewal\b|\bnext\b|\bbilled on\b|\bwill be charged\b|\bauto-?renews?\b|يتجدد|التجديد|تجديد|الدفعة القادمة|الدفع القادم|القادم|(?<![\p{L}])(?:prochain|renouvel|próximo|renov|nächste|verlänger|prossimo|rinnov|sonraki|yenilen|berikutnya|diperpanjang|следующ|продл|अगला|نوبت بعد|تمدید|পরবর্তী|ijayo|ถัดไป|ต่ออายุ|tiếp theo|gia hạn|下次|续订|次回|更新|다음|갱신)/iu;
const CANCEL_W = /\bcancel(?:l?ed|lation)\b|\bwill end\b|\bends on\b|\bwon'?t renew\b|\bnot renew|تم إلغاء|تم الغاء|ألغيت|الغيت|إلغاء الاشتراك|(?<![\p{L}])(?:annulé|cancelad|gekündigt|cancelado|annullato|iptal edildi|dibatalkan|отменен|отменён|रद्द|لغو شد|বাতিল|imeghairiwa|ยกเลิก|đã hủy|已取消|キャンセル|해지|취소)/iu;
const PLAN_W = /\b(standard with ads|standard|premium|basic|mobile|vip|plus|pro|family|individual|duo|student|ultimate|essential|personal|business|max|lite|super)\b|العائلي|الأساسي|المميز|بريميوم|الطلاب/i;

const PERSONAL = /(?:[•*]{2,}\s?|card ending(?: in)?\s?|ending in\s?|المنتهية بـ?\s?)\d{4}\b|\byour\b|\byou\b|receipt|invoice|thank|charged|billed|renews?|renewal|next (?:billing|payment)|membership|اشتراكك|حسابك|بطاقتك|تم |فاتورة|إيصال|ايصال|يتجدد|التجديد|تجديد|الدفعة القادمة|(?<![\p{L}])(?:votre|vous|tu|su|tus|dein|deine|ihr|ihre|seu|sua|tuo|tua|sizin|hesabınız|anda|ваш|ваша|आपका|आपकी|شما|আপনার|yako|ของคุณ|của bạn|您的|あなたの|고객님)(?![\p{L}])/iu;
const STRONG_PERSONAL = /receipt|invoice|thank you for|charged|billed|you paid|payment (?:of|was)|next (?:billing|payment)|renews on|your (?:plan|membership|subscription)|تم خصم|تم الدفع|تم تجديد|اشتراكك|فاتورة|إيصال|ايصال|يتجدد في|(?<![\p{L}])(?:votre abonnement|reçu|su suscripción|recibo|ihr abo|rechnung|sua assinatura|recibo|aboneliğiniz|langganan anda|ваша подписка|आपकी सदस्यता|اشتراک شما|আপনার সাবস্ক্রিপশন|您的订阅|ご利用|구독이)(?![\p{L}])/iu;
const OFFER_W = /starting at|starts at|plans? (?:start|from)|from just|\braises?\b|price (?:increase|hike|rise)|will (?:increase|rise|go up)|announced|subscribe now|sign up(?: now)?|join now|get \d+% off|try (?:it )?(?:for )?free|choose (?:your|a) plan|يبدأ من|تبدأ من|ابتداء من|ابتداءً من|اشترك الآن|اختار الباقة|اختر الباقة|ترفع|زيادة (?:في )?الأسعار|(?<![\p{L}])(?:à partir de|abonnez-vous|desde|suscríbete|ab nur|jetzt abonnieren|a partir de|assine já|a partire da|abbonati|başlayan|hemen abone ol|mulai dari|berlangganan sekarang|от \d|подпишитесь|से शुरू|از \d|শুরু|kuanzia|เริ่มต้น|chỉ từ|起|から|부터)(?![\p{L}])/iu;
// (the same currencies, anchored: right before the number, or right after it)
const CUR_AT = CUR.map(([c, re]) => [c, new RegExp("(?:" + re.source + ")[\\s.:]{0,2}$", re.flags.replace("g", "")), new RegExp("^[\\s]{0,2}(?:" + re.source + ")", re.flags.replace("g", ""))]);
const AR_DIG = /[٠-٩۰-۹]/g;
const clean = (s) => String(s || "").replace(/[‎‏؜‪-‮⁦-⁩﻿]/g, "").replace(AR_DIG, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c) >= 0 ? "٠١٢٣٤٥٦٧٨٩".indexOf(c) : "۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/٫/g, ".").replace(/٬/g, "").replace(/ /g, " ");

/** "1,234.56" / "1.234,56" / "99" / "99.00" / "1 234,50" → a number (or NaN) */
export function numOf(s) {
  let t = String(s).replace(/[\s']/g, "");
  if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d+,\d{1,2}$/.test(t)) t = t.replace(",", ".");
  else t = t.replace(/,/g, "");
  return /^\d+(?:\.\d+)?$/.test(t) ? +t : NaN;
}
const NUM = /(?<![\d.,])(\d{1,3}(?:[ ,.'](?=\d{3})\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![\d])/g;

/** Every amount with a currency in the text → [{ v, cur, line, i }] */
function amounts(lines) {
  const out = [];
  lines.forEach((line0, li) => {
    // a service's own name is never a price ("Microsoft 365", "Office 365")
    let line = line0; for (const [, re] of SERVICES) line = line.replace(new RegExp(re.source, re.flags.replace("g", "") + "g"), (m) => " ".repeat(m.length));
    let m; NUM.lastIndex = 0;
    while ((m = NUM.exec(line))) {
      const s = m[1], at = m.index, end = at + s.length, before = line.slice(Math.max(0, at - 14), at), after = line.slice(end, end + 14);
      // never a card number piece (•••• 4417), a date (4/12, 2026), a time (12:04), a percentage, a phone number, a quantity of months
      if (/[•*xX#]\s*$/.test(before) || /^[/:.-]\d/.test(after) || /\d[/:-]$/.test(before) || /^\s?%/.test(after) || /^\s?(?:(?:months?|days?|weeks?|years?|GB|TB|MB|devices?|screens?|users?)\b|شهور|أشهر|اشهر|يوم|أيام|جهاز|شاشة)/i.test(after)) continue;
      if (/(?:ending|ends? in|card|x{2,}|\*{2,})\s*$/i.test(before) && /^\d{4}$/.test(s)) continue;
      // a day before a month's name is a date ("PAIEMENT LE 8 DEC 2026": the 8 is not 8 LE)
      if (/^\s{0,2}(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|janv|févr|fevr|avr|mai|juin|juil|août|aout|déc|ene|abr|ago|dic|märz|okt|dez|şub|nis|haz|tem|ağu|eyl|eki|kas|ara|يناير|فبراير|مارس|أبريل|ابريل|إبريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)/i.test(after)) continue;
      const v = numOf(s); if (!(v > 0)) continue;
      if (/^(19|20)\d{2}$/.test(s) && !/[$€£₹₺₽¥₩]\s*$|(?:egp|sar|aed|usd|eur|gbp|le|ج\.?م|جنيه)\s*$/i.test(before)) continue;   // a year
      // the currency must TOUCH the number ("EGP 240", "240 EGP", "$13.99", "٩٩ ج.م") — never one a few words away
      const cur = (CUR_AT.find(([, pre, post]) => pre.test(before) || post.test(after)) || [])[0] || "";
      if (!cur) continue;
      out.push({ v, cur, li, at, line });
    }
  });
  return out;
}

/** → the reading of a subscription screenshot / e-mail, or null when it isn't one. */
export function readSubscription(text0, { now = Date.now(), order = "dmy", home = "" } = {}) {
  const text = clean(text0);
  const lines = text.split(/\r?\n|(?<=[.!])\s{2,}/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const all = lines.join("\n");
  let svc = SERVICES.find(([, re]) => re.test(all));
  // v10.9.4 (Ali: "train it on more screenshots like mine"): a service Attune's list doesn't know is named by the receipt itself — Google Play's
  // "Truecaller Premium (by Truecaller)", Stripe's plan under its billing period ("Nov 17–Dec 17, 2026" / "Figma Professional"), "Receipt from
  // Figma, Inc." — only when the paper says it is a subscription (a period, "renews", "/month", "auto-renewing")
  if (!svc && /auto-?renew|renews?\b|subscription|\/\s?(?:month|year|mo|yr)\b|[A-Za-z]{3}\s\d{1,2}\s?[–—-]\s?[A-Za-z]{3}\s\d{1,2}|اشتراك|يتجدد/i.test(all)) {
    const co = ((all.match(/(?:your\s+)?receipt\s+from\s+([^#\n]{2,60}?)(?:\s#|\n|$)/i) || all.match(/ordered from\n([^\n]{2,60})/i) || [])[1] || "").replace(/,?\s*(?:pbc|inc\.?|llc|ltd\.?|limited|gmbh|s\.?a\.?)\b\.?/gi, "").replace(/[,\s]+$/, "").trim();
    // Google Play's item, even when the phone split its name over two lines ("Remini -" / "AI Photo Enhancer (by"): the lines after "Price"
    let gp = ""; { const L = all.split("\n"), k = L.findIndex((l) => /\(by\s*$|\(by\b/i.test(l));
      if (k >= 0) { let j = k; while (j > 0 && k - j < 2 && !/^(?:item|price|items)$/i.test(L[j - 1].trim()) && !/[\d$€£]/.test(L[j - 1])) j--; gp = L.slice(j, k + 1).join(" ").replace(/\s*\(by\b.*$/i, "").replace(/\s+/g, " ").trim(); } }
    const per = all.match(/\n[A-Za-z]{3}\s\d{1,2}\s?[–—-]\s?[A-Za-z]{3}\s\d{1,2},?\s\d{4}\n([^\n$€£\d]{2,60})\n/);
    const items = (all.match(/\nitems?\n([^\n]{2,60})/i) || [])[1];
    const plan = (gp || (per && per[1]) || items || "").replace(/\s*\([^)]*\)\s*$/g, "").trim();
    const name = plan && co && !plan.toLowerCase().includes(co.toLowerCase().split(" ")[0]) ? co + " " + plan : plan || co;
    if (name && !/^(?:subtotal|total|price|item|qty)/i.test(name)) svc = [name.slice(0, 60), null];
  }
  const subWords = /subscription|membership|your plan|renews?|auto-?renew|billing|اشتراك|الاشتراك|باقة|الباقة|تجديد|abonnement|suscripci|abo\b|assinatura|abbonamento|abonelik|langganan|подписк|सदस्यता|اشتراک|সাবস্ক্রিপশন|usajili|สมาชิก|gói|订阅|サブスク|구독/i.test(all);
  if (!svc && !subWords) return null;
  const cancelled = CANCEL_W.test(all);
  // the price: score each amount by its own line and the lines next to it
  const cands = amounts(lines).map((a) => {
    const own = a.line, prev = lines[a.li - 1] || "", next = lines[a.li + 1] || "";
    const left0 = own.slice(0, a.at), right = own.slice(a.at);
    // the words that belong to THIS amount: after the amount before it on the line ("Was EGP 99.99 now EGP 59.99/month": "now EGP")
    const left1 = left0.replace(/\d+(?:[.,]\d+)?\s?%/g, (m) => "#".repeat(m.length));   // ("VAT 14% 18.48": the 14% is not an amount before this one)
    const lastNum = left1.search(/\d[^\d]*$/), left = lastNum >= 0 ? left0.slice(lastNum + 1) : left0, alone = lastNum < 0;
    let s = 0;
    if (MONTH_W.test(right.slice(0, 24)) || YEAR_W.test(right.slice(0, 24)) || WEEK_W.test(right.slice(0, 24))) s += 4;
    else if (MONTH_W.test(own) || YEAR_W.test(own) || WEEK_W.test(own)) s += 2;
    if (PRICE_W.test(left) || PRICE_W.test(prev)) s += 2;
    if (TOTAL_W.test(left) || (TOTAL_W.test(prev) && !PRICE_W.test(left))) s += 2;
    // (Ali's Claude Pro receipt: "Total excluding tax $20.00" … "Total $22.80" · "Amount paid $22.80") — a total before tax / a subtotal is
    // never the price; what was paid in the end is
    const bare = left.replace(/\b[A-Za-z]{3}\b|US\$|R\$|[$€£₹₺₩¥₽]|ج\.?\s?م|ر\.?\s?س|د\.?\s?[إاأ]|\bLE\b|\bRp\b|\bRs\b/g, ""), lab = (/\p{L}/u.test(bare) ? left : left + " " + prev).toLowerCase();   // ("QAR 231.99" alone: "QAR" is not a label — the line above is)   // ("$22.80" alone on its line: its label is the line above)
    if (/excluding tax|before tax|excl\.? (?:tax|vat)|without (?:tax|vat)|sub-?\s?total|net amount|قبل الضريبة|بدون ضريبة|المجموع الفرعي/i.test(lab)) s -= 5;
    if (/amount paid|total paid|you paid|paid|المدفوع|تم دفع/i.test(lab)) s += 2;
    if (/^\s*(?:total|الإجمالي|الاجمالي|إجمالي)\s*:?\s*$/i.test(/\p{L}/u.test(bare) ? left : prev)) s += 1;
    const old = NOT_PRICE.test(left.slice(-30)) || (alone && NOT_PRICE.test(right.slice(0, 30)) && !TOTAL_W.test(own));
    if (old) s -= 6;
    if (/\bnow\b|الآن|دلوقتي|(?<![\p{L}])(?:maintenant|ahora|jetzt|agora|ora|şimdi|sekarang|сейчас|अब|اکنون|এখন|sasa|ตอนนี้|bây giờ|现在|今なら|지금)(?![\p{L}])/iu.test(left)) s += 2;
    if (FREE_W.test(left) && !THEN_W.test(left)) s -= 3;
    if (THEN_W.test(left)) s += 3;
    if (/[~̶]|strike/i.test(own)) s -= 4;
    if (svc && svc[1] && svc[1].test(own)) s += 1;
    if (home && a.cur === home) s += 0.5;
    void next;
    return { ...a, s, old };
  }).sort((x, y) => y.s - x.s || x.li - y.li);
  const best = cands[0];
  const rivals = best ? cands.filter((c) => c.s === best.s && !c.old && Math.abs(c.v - best.v) > 0.005) : [];
  // the period: next to the price first, then anywhere
  const zone = best ? best.line.slice(best.at, best.at + 40) + " " + (lines[best.li + 1] || "") : "";
  const cyc = (t) => (YEAR_W.test(t) ? "year" : MONTH_W.test(t) ? "month" : WEEK_W.test(t) ? "week" : "");
  let cycle = cyc(zone) || cyc(best ? best.line : "") || cyc(all), cycleGuessed = false;
  // the next payment: a date on a "next / renews" line (or after it); else none
  let next = "";
  for (let i = 0; i < lines.length && !next; i++) {
    if (!NEXT_W.test(lines[i])) continue;
    const zoneD = lines[i].slice(lines[i].search(NEXT_W)) + " " + (lines[i + 1] || "");
    const ds = datesIn(zoneD, { now, order }).filter((d) => d.kind !== "monthyear" || /\b\d{4}\b/.test(zoneD));
    if (ds.length) { const d = new Date(ds[0].t); next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
  }
  if (!next) {   // the period paid for: "Nov 12–Dec 12, 2026" → it renews 12 Dec
    const m = all.match(/([A-Za-z\u0600-\u06FF]{3,10}\.?\s\d{1,2}|\d{1,2}\s[A-Za-z\u0600-\u06FF]{3,10}|\d{1,2}\/\d{1,2}\/\d{4})\s?[–—-]\s?([A-Za-z\u0600-\u06FF]{3,10}\.?\s\d{1,2}(?:,?\s\d{4})?|\d{1,2}\s[A-Za-z\u0600-\u06FF]{3,10}(?:\s\d{4})?|\d{1,2}\/\d{1,2}\/\d{4})/);
    if (m) { const yr = (all.slice(m.index, m.index + m[0].length + 8).match(/\b20\d{2}\b/) || [""])[0]; const ds = datesIn(m[2] + (/\d{4}/.test(m[2]) ? "" : " " + yr), { now, order });
      let a = datesIn(m[1] + (/\d{4}/.test(m[1]) ? "" : " " + yr), { now, order });
      if (a.length && ds.length && a[0].t >= ds[0].t && !/\d{4}/.test(m[1]) && yr) a = datesIn(m[1] + " " + (+yr - 1), { now, order });   // "Nov 9–Nov 9, 2027": it started in 2026
      if (ds.length && a.length && ds[0].t > a[0].t) { const d = new Date(ds[0].t); next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const span = (ds[0].t - a[0].t) / 864e5; if (!cycle) { if (span >= 26 && span <= 32) cycle = "month"; else if (span >= 360 && span <= 370) cycle = "year"; } } }
  }
  if (!cycle && next) {   // "next billing 4 Dec" a month after today's payment → monthly
    const days = (Date.parse(next + "T12:00:00") - now) / 864e5;
    if (days > 300 && days < 380) cycle = "year"; else if (days > 0 && days <= 32) { cycle = "month"; cycleGuessed = true; }
  }
  if (!cycle && svc) { cycle = "month"; cycleGuessed = true; }
  const card = all.match(/(?:[•*xX#]{2,}\s?|ending(?: in)?\s|ends in\s|card\s(?:no\.?\s)?\**\s?|المنتهية بـ?\s?|تنتهي بـ?\s?)(\d{4})(?!\d)/i)
    || all.match(/(?:master\s?card|visa|meeza|amex|maestro)\s?[-–x]\s?(\d{4})(?!\d)|\bx-(\d{4})(?!\d)|\bwith\s*[-–]\s*\n?\s*(\d{4})(?!\d)/i);
  const plan = (all.match(PLAN_W) || [])[1] || (all.match(PLAN_W) || [])[0] || "";
  const r = { service: svc ? svc[0] : "", plan: plan ? plan.replace(/^\w/, (c) => c.toUpperCase()) : "", amount: best ? best.v : 0, currency: best ? best.cur : "",
    cycle, cycleGuessed, next, last4: card ? (card[1] || card[2] || card[3] || "") : "", cancelled };
  // it must be YOUR subscription (a receipt, your plan, a renewal) — never a news post, an advert or a plans page
  const personal = PERSONAL.test(all) || NEXT_W.test(all) || (/\bsub-?total\b|المجموع الفرعي|(?<![\p{L}])(?:sous-total|zwischensumme|ara toplam)(?![\p{L}])/iu.test(all) && TOTAL_W.test(all)) || /\bpaid on\b|تم الدفع في|(?<![\p{L}])(?:payé le|pagado el|bezahlt am|pago em|ödendi)(?![\p{L}])/iu.test(all), offer = OFFER_W.test(all);
  // sure = yours, a known service, ONE price with a price word or a period next to it, a period
  const alone = best && cands.filter((c) => c.s > -3 && !c.old && Math.abs(c.v - best.v) > 0.005).length === 0;   // (a "was / save" price is never a rival)   // the only amount that isn't an old price / a saving
  const why = offer && !STRONG_PERSONAL.test(all) ? "offer" : !personal ? "notyours" : !svc ? "service" : !best ? "price" : rivals.length ? "twoprices" : (best.s < 2 && !(alone && best.s >= 0)) ? "price" : !cycle ? "cycle" : "";
  return { ...r, sure: !why, why, prices: cands.slice(0, 6).map((c) => ({ v: c.v, cur: c.cur, s: c.s, li: c.li })) };
}
