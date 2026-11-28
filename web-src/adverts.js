/* ---- v10.9.10 REPAIR P1 (Ali, 28 Nov 2026: "90 percent of the money guardian is wrong" — the root cause: "is this an advert?" was
   decided in 7 files with 7 different word lists (paylog PROMO, notifwords OFFER_W, notifmeaning PROMO0, notifmind offer, autopilot
   OFFER_W, subread OFFER_W, overpay PROMO), so a fix in one left the others wrong: a Vodafone renewal «تم تجديد باقتك … استمتع بضعف
   الدقايق» was an advert in 3 readers and a payment in 2; "Your order total EGP 350 has been confirmed. Use code SAVE20…" was dropped
   as an advert and the 350 was lost). This is now the ONE place that decides it; every reader imports it.
     OFFER         the words of an advert / an offer / marketing, in the app's languages
     DONE          the words that say money really moved (debited, charged, receipt, order total, «تم خصم», «تم تجديد»…) — they win
     isAdvert(t)   an offer AND no money moved
   Pure. Tests: tests/unit/v10910adverts.test.mjs, tests/adverts/gen.mjs (10,000 HARD).                                              */

const W = (src) => new RegExp(src, "iu");
const B = (words) => "(?<![\\p{L}\\d])(?:" + words + ")(?![\\p{L}])";
const CUR = "(?:egp|le|l\\.e|usd|sar|aed|kwd|qar|\\$|€|£|ج\\.?م|جنيه)";
const AMT = "[\\d٠-٩][\\d٠-٩.,]*";

/** An advert / an offer / marketing. */
export const OFFER = W([
  // English — money off, prices from, free things, urgency, calls to act
  B("price drop|on your wishlist|pay later|0% interest|interest[- ]free|installments? (?:starting|from)|orders? (?:above|over)|up to " + AMT + " ?%|" + AMT + " ?% ?(?:off|cashback|discount)"
    + "|" + CUR + " ?" + AMT + " ?off|" + AMT + " ?" + CUR + " ?off|off (?:your|on|all|every)|flash sale|(?:big |mega |summer |winter |black friday |end of season )?sale|last chance|buy (?:1|one) get|free delivery|free shipping"
    + "|invite (?:a |your )?friends?|refer (?:a )?friends?|deals?(?: of the day)?|weekend treat|pre-?approved|apply now|loan (?:offer|up to)|discounts?|promo(?:code|tion|tions)?|promo code|coupons?|cash ?back"
    + "|(?:special |exclusive |limited )?offers?|limited[- ]time|ends (?:tonight|today|soon|in \\d)|don'?t miss(?: out)?|do not miss|hurry|first order|save (?:up to|" + AMT + "|" + CUR + ")|treat yourself"
    + "|craving|hungry\\?|order now|shop now|buy now|get it now|grab (?:it|yours)|instead of|bonus points|starting (?:at|from)|starts at|plans? (?:start|from)|from (?:just|only)|for (?:only|just)|just for you"
    + "|try (?:it )?(?:for )?free|try " + AMT + " (?:days?|weeks?|months?)|subscribe now|sign up(?: now| today)|join (?:now|today)|upgrade now|use (?:the )?code|code ?:|watch now|new arrivals|now on sale"),
  // Arabic (Egyptian + Fusha) — «خصم ٥٠٪», «اطلب دلوقتي», «فرصة أخيرة»; a bank's «خصم 250 جنيه من حسابك» is a debit (DONE), not this
  "(?<!تم )(?<!تم\\s)خصم\\s*" + AMT + "\\s*[٪%]|(?<!تم )(?<!تم\\s)خصم\\s*" + AMT + "\\s*(?:ج\\.?م|جنيه)?\\s*(?:على|لأول|لاول|علي|لما|لو|عند|مع)|(?<!تم )(?<!تم\\s)(?<![\\p{L}])خصم\\s*" + AMT + "(?![\\d٠-٩])\\s*(?:ج\\.?م\\.?|جنيه|جم)?\\s*(?:[!،—-]|\\.(?![\\d٠-٩])|$)|عروض|عرض (?:خاص|حصري|لفترة|اليوم|النهارده)|خصومات|تخفيضات?|كوبون|كاش ?باك|تبدأ من|يبدأ من|ابتداء[ًا]? من"
    + "|استمتع ب|تتيح لك|في صورة نقاط|نقاط (?:مكافآت|مكافات|share)|[٪%] من قيمة|بحد أقصى|لمعرفة المزيد|حتى " + AMT + " ?[٪%]|توصيل مجاني|ضعف الدقايق|اطلب قرض|بدون ضامن|قرض شخصي"
    + "|اربح|وفر|وفّر|اطلب (?:دلوقتي|الآن|الان|حالا|حالاً)|(?:أول|اول) طلب|فرصة (?:أخيرة|اخيرة)|متفوتش|لا تفوت|لفترة محدودة|اشحن[^\\n.]{0,30}(?:واحصل|وخد|واكسب)|احصل على[^\\n.]{0,25}(?:هدية|مجان|خصم)|جعان[؟?]",
  // (merged from notelabels.js AD, v10.9.12 — "only today", "for … only", "from EGP 99", «بس بـ», «بدل من», «اكسب», «الحقه»…)
  "(invite (?:a |your )?friends?|refer (?:a |your )?friends?|get (?:[^.\\n]|\\.\\d|\\.(?=E\\b|e\\b|\u0645)){0,24}\\boff\\b|\\d+(?:[.,]\\d+)?\\s?%\\s?off|\\binstead of\\b|\\bonly (?:for|today|this)\\b|\\bfor [^.\\n]{0,20}\\bonly\\b|treat yourself|don'?t miss|limited[- ]time|hurry|last chance|flash sale|\\bsale\\b|\\bdeals?\\b|\\boffers?\\b|discount|promo\\w*|coupon|voucher|use (?:the )?code|free delivery|free shipping|cashback|save up to|lowest price|new arrivals|order now|shop now|book now|\\bwin\\b|giveaway|sponsored|new collection|\\bfrom (?:egp|\\$|usd|\u20ac|\u00a3|\u062c\\.\u0645\\.?)\\s?[\\d\u0660-\u0669](?![^\\n]{0,24}\\bto\\b)|buy (?:1|one) get|get (?:1|one) free|special offer|new arrivals|(?:plans?|prices?|items?|starting|installments? starting) (?:from|at)\\b|starting (?:from |at )?(?:egp|\\$|usd|\u20ac)|watch now|visit [a-z0-9-]+\\.(?:com|eg|net)|bonus|\u0627\u0634\u062a\u0631\u0643 (?:\u0641\u064a|\u0641)|\u0648\u0627\u062d\u0635\u0644|\u0627\u062d\u0635\u0644 \u0639\u0644\u0649|\u0628\u0640? ?[\\d\u0660-\u0669][\\d\u0660-\u0669,.\u066c\u066b]* ?\u062c\u0646\u064a\u0647 \u0628\u0633|\u0628\u0633 \u0628\u0640|\u0628\u062f\u0644(?:\u0627|\u0627\u064b)? \u0645\u0646|\u0628\u062f\u0644 \u0645\u0627|\u062e\u0635\u0645(?=\\s*(?:\u064a\u0635\u0644|\u0644\u062d\u062f|\u062d\u062a\u0649|\u0639\u0644\u0649|[\\d\u0660-\u0669]+\\s*[%\u066a]))|\u0646\u0633\u0628\u0629 \u062e\u0635\u0645|\u0639\u0631\u0636|\u0639\u0631\u0648\u0636|\u0643\u0648\u0628\u0648\u0646|\u0643\u0648\u062f \u0627\u0644\u062e\u0635\u0645|\u0627\u0633\u062a\u062e\u062f\u0645 \u0643\u0648\u062f|\u0648\u0641\u0631|\u062a\u0648\u0635\u064a\u0644 \u0645\u062c\u0627\u0646\u064a|\u0644\u0641\u062a\u0631\u0629 \u0645\u062d\u062f\u0648\u062f\u0629|\u0645\u062a\u0641\u0648\u062a\u0634|\u0627\u0644\u062d\u0642(?:\u0647|\u0647\u0627)?|\u0647\u062f\u064a\u0629|\u0627\u0637\u0644\u0628 \u062f\u0644\u0648\u0642\u062a\u064a|\u0627\u0637\u0644\u0628 \u0627\u0644\u0622\u0646|\u0627\u062f\u0639\u064a \u0635\u0627\u062d\u0628\u0643|\u0627\u062f\u0639\u064f \u0635\u062f\u064a\u0642|\u0627\u0643\u0633\u0628|\u062a\u062e\u0641\u064a\u0636\u0627\u062a|\u0644\u062d\u0642 \u0646\u0641\u0633\u0643)",
  // other languages
  "(?<![\\p{L}])(?:offre|soldes|oferta|descuento|promoción|promoção|desconto|angebot|rabatt|gutschein|kampanya|indirim|fırsat|diskon|sconto|offerta|aanbieding|korting|à partir de|скидка|акция|优惠|할인|セール)(?![\\p{L}])",
].join("|"));

/** Money really moved (or a real order / renewal / receipt) — wins over the advert words. */
export const DONE = W([
  B("debited|credited|charged|billed|you(?:'ve| have)? paid|you sent|you received|was deducted|has been deducted|refunded|receipt|invoice|tax invoice"
    + "|payment (?:received|confirmation|confirmed|successful|of [^.\\n]{1,30} (?:was |has been )?(?:received|successful))|has been renewed|renewed(?: successfully)?|subscription (?:confirmed|renewed)"
    + "|order (?:total|confirmed|confirmation|receipt|#|no\\.?|number)|your order (?:of|has been (?:placed|confirmed|delivered))|transaction (?:approved|successful|completed)|purchase (?:of|at)|thanks for your (?:purchase|payment)"),
  "تم\\s*(?:خصم|تحويل|استلام|إيداع|ايداع|سحب|دفع|سداد|تجديد|التجديد|شحن)|استلمت|وصلك|إيصال|ايصال|فاتورة|عملية شراء"
    + "|خصم\\s*(?:مبلغ\\s*)?" + AMT + "\\s*(?:ج\\.?م\\.?|جنيه|egp|le)?(?:(?!لما|لو |عند |اول |أول |على )[^\\n]){0,40}?(?:من (?:حساب|بطاق|كارت|رصيد)|ببطاق|لصالح)|بطاقة الخصم المباشر",
  // (merged from notelabels.js MOVED, v10.9.12)
  "(\u062a\u0645 \u062f\u0641\u0639|total charged|paid online|charged (?:egp|usd|sar|aed|\\$|\u20ac|\u00a3)\\s?[\\d\u0660-\u0669]|you'?ve been charged|amount charged|received your payment|has been renewed|you were charged|has been charged|was charged|we charged|charged to your|billed to|debited|credited|total paid|(?:\\$|egp|usd|\u20ac)\\s?[\\d.,]+ paid|\\bpaid (?:successfully|with|by|on)\\b|payment of (?:[^.\\n]|\\.\\d|\\.(?=E\\b|e\\b|\u0645)){0,40} (?:was|is) successful|\u062a\u0645 \u062a\u062c\u062f\u064a\u062f|\u062a\u0645 \u0627\u0644\u062f\u0641\u0639|payment (?:received|successful|confirmed|complete[d]?)|payment of (?:[^.\\n]|\\.\\d|\\.(?=E\\b|e\\b|\u0645)){0,40} received|paid successfully|you paid|you sent|you received|refund(?:ed)?|\u062a\u0645 (?:\u062e\u0635\u0645|\u062a\u062d\u0648\u064a\u0644|\u0627\u0633\u062a\u0644\u0627\u0645|\u0625\u064a\u062f\u0627\u0639|\u0627\u064a\u062f\u0627\u0639|\u0633\u062d\u0628|\u0634\u0631\u0627\u0621|\u062f\u0641\u0639|\u0633\u062f\u0627\u062f)|\u0627\u0633\u062a\u0644\u0645\u062a|\u0648\u0635\u0644\u0643 \u0645\u0628\u0644\u063a)",
  // a card / bank transaction: "Transaction approved", "Purchase 450 EGP at …", "card ****8915", «بطاقة المنتهية ب 1234»
  "\\btransaction (?:approved|successful|completed|of)\\b|\\bpurchase\\s+(?:of\\s+)?(?:" + CUR + "\\s?)?" + AMT + "|\\b(?:card|account|a\\/c)\\s*(?:no\\.?\\s*)?(?:ending(?: in| with)?|\\*{2,}|x{2,})\\s*\\d{3,4}\\b|(?:بطاقة|بطاقتك|كارت|حساب|حسابك|حسابكم)[^\\n]{0,12}(?:المنتهي|رقم|\\*{2,})",
  "(?<![\\p{L}])(?:débité|prélevé|cobrado|cargado|debitado|abgebucht|belastet|addebitat[oa]|tahsil edildi|didebit)(?![\\p{L}])",
].join("|"));

/** An advert / offer, and no money moved. */
// (read the way phones write it: invisible direction marks, double spaces and line breaks, Arabic-Indic digits — "order  total", «٨٥ جنيه»)
export const plain = (text) => String(text || "").replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/\s+/g, " ");
// (alef forms too: «فرصة إخيرة», «أول» / «اول» — the lists write ا where it varies)
const alef = (t) => t.replace(/[أإآ]/g, "ا").replace(/ى(?=\s|$)/g, "ي");
// a notice about YOUR plan changing price ("will increase from EGP 500 to EGP 650", «زيادة في سعر باقتك») is not an advert
const NOTICE = /\b(?:price (?:increase|change|update)|will (?:increase|rise|go up)|new price|your (?:plan|subscription|membership)(?:'s)? price)\b|زيادة (?:في )?(?:السعر|الأسعار|سعر)|السعر الجديد|سعر (?:باقتك|اشتراكك) (?:هيزيد|سيزيد|هيبقى)/i;
export const isAdvert = (text) => { const t = plain(text), a = alef(t); return (OFFER.test(t) || OFFER.test(a)) && !DONE.test(t) && !DONE.test(a) && !NOTICE.test(t); };
