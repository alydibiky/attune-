/* ---- v9.9.17 (Ali, 11 Nov 2026: "a sample of 10000 notifications in every area … see how the app deals with it"). ONE place for the
   words that say a notification with an amount in it is NOT money that moved — used by all four readers (Money's list paylog.js,
   Autopilot's card autopilot.js, "is this yours?" notelabels.js, what-it-is notifmeaning.js). Before this each reader had its own
   list, and what one refused another let through: of 10,000 generated notifications, 855 that are not payments reached Money
   (a code "for your purchase of EGP 567", «تم رفض عملية شراء», "you will be billed", a bill that is only due, a fine, a prize text).
     notAPayment(text, n) → "" (could be a payment) | "code" | "failed" | "notyet" | "offer" | "price" | "post" | "scam" | "person"
   Pure; tests: tests/unit/v9917notifs.test.mjs and the 10,000 run (bash tests/notifs/run.sh).                                      */

// a one-time code — also when it names the purchase it is for ("397519 is your verification code for … purchase of EGP 567")
export const CODE_W = /\b(otp|one[- ]time|verification code|security code|passcode|auth(?:entication)? code|2fa)\b|\b(?:use|enter) (?:the )?code \d{4,8}\b|\b\d{4,8} is your\b|رمز التحقق|كود التحقق|كود التفعيل|رمز التفعيل|كلمة المرور لمرة|الرمز السري|لا تشارك(?:ه|ها)?\s|(?<![\p{L}])(code de (?:vérification|sécurité|confirmation)|código de (?:verificación|seguridad|verificação|confirmação)|bestätigungscode|sicherheitscode|doğrulama kodu|kode (?:otp|verifikasi)|codice (?:di verifica|otp)|verificatiecode|код подтверждения|验证码|인증번호|認証コード)(?![\p{L}])/iu;
// it did NOT happen: declined, failed, not charged
export const FAILED_W = /\b(declined|(?:was|were|is|has) not (?:been )?(?:charged|completed|processed|deducted|successful|debited)|not charged|wasn'?t charged|won'?t be charged|unsuccessful|failed|couldn'?t (?:process|complete|be delivered)|could not be (?:processed|completed)|rejected|insufficient (?:funds|balance)|no amount was deducted|was released|released back)\b|تم رفض|رفض العملية|مرفوضة|فشلت|فشل (?:تجديد|عملية|الدفع|التحويل)|لم يتم خصم|لم تتم|لم يتم|تم ايقاف العملية|تم إيقاف العملية|لعدم كفاية|(?<![\p{L}])(refus[ée]e?|échou[ée]e?|rechazad[oa]|fallid[oa]|abgelehnt|fehlgeschlagen|reddedildi|başarısız|basarisiz|ditolak|gagal|recusad[oa]|rifiutat[oa])(?![\p{L}])/iu;
// it has not happened YET: due, will be charged, to be paid on delivery, a quote, a request, a limit, something maturing
export const NOTYET_W = /\b(will be (?:charged|billed|debited|deducted|renewed|collected|delivered|credited|refunded)|you'?ll be (?:charged|billed)|you will be (?:charged|billed)|will renew|renews on|auto-?renew|upcoming (?:payment|charge|bill)|payment (?:is )?due|is (?:now )?(?:due|overdue|payable)|are (?:now )?(?:due|overdue|payable)|(?:due|payable) (?:on|by|in|before|date|within)|due \d|overdue|total due|minimum due|amount due|pay (?:it |now |online )?before|to be paid|cod amount|cash on delivery|free trial|trial (?:ends|period)|matures on|estimated at|offered|requested|would (?:be|cost)|will arrive|in \d+\s*[–-]\s*\d+ (?:business |working )?days|credit limit|limit (?:has been |was )?(?:increased|raised|changed)|scheduled (?:for|on)|is being (?:reviewed|processed|verified)|being processed|is pending|pending approval|once it is processed|refund request|your request (?:to|for))\b|سيتم (?:خصم|تجديد|التجديد|سحب)|مستحق|(?:آخر|اخر) (?:ميعاد|موعد|يوم)|موعد (?:الدفع|السداد)|صدرت بقيمة|قيد (?:المراجعة|التنفيذ)|سدد قبل|السداد قبل|المبلغ المطلوب|الفترة التجريبية|تاريخ الاستحقاق|سعر الكشف|يطلب منك|طلب منك|الحد الائتماني|حد البطاقة|(?<![\p{L}])(sera (?:débité|prélevé|facturé)|se renouvelle|essai gratuit|será (?:cobrado|cargado|debitado|renovad[oa])|se renovará|prueba gratuita|teste grátis|vence em|vence el|wird (?:abgebucht|belastet|verlängert)|fällig|probemonat|verrà addebitat[oa]|si rinnova|scade il|tahsil edilecek|yenilenecek|son ödeme|akan (?:ditagih|didebit)|jatuh tempo)(?![\p{L}])/iu;
// an offer / advert, in the app's languages (added to each reader's own list)
export const OFFER_W = /\b(price drop|on your wishlist|pay later|0% interest|interest[- ]free|installments? (?:starting|from)|orders? (?:above|over)|up to \d+ ?%|\d+ ?% ?(?:off|cashback|discount)|flash sale|last chance|buy (?:1|one) get|free delivery|free shipping|invite (?:a |your )?friends?|deal of the day|weekend treat|pre-?approved|apply now|loan (?:offer|up to))\b|عروض|خصومات|تخفيضات|تبدأ من|حتى \d+ ?[٪%]|توصيل مجاني|ضعف الدقايق|اطلب قرض|بدون ضامن|قرض شخصي|(?<![\p{L}])(offre|soldes|oferta|descuento|promoción|promoção|desconto|angebot|rabatt|gutschein|kampanya|indirim|fırsat|diskon|sconto|offerta|aanbieding|korting|à partir de|скидка|акция|优惠|할인|セール)(?![\p{L}])/iu;
// a price / a stock / a rate moving — news, not the person's money
export const PRICE_W = /\b(?:is |are )?(?:up|down)\b[^.\n]{0,14}\d|\b(?:fell|rose|gained|dropped|climbs?|climbed|crossed|closed at|trading at)\b|\b(?:now|today at)\s+(?:egp|\$|usd|€|£)|\bper (?:gram|ounce|barrel|litre|liter|share)\b|\b(?:usd|eur|gbp|egp|sar|aed|btc|eth)\/(?:usd|eur|gbp|egp|sar|aed|usdt)\b|عيار|سعر (?:الدولار|الذهب|الدهب|اليورو|البنزين)|يسجل/iu;
// a post, a video, a listing somebody shared
export const POST_W = /\bshared (?:a |an |your )?(?:reel|post|video|story|photo|link)\b|\bposted(?: a| an)?:|\bis live\b|\bnew (?:episode|video|post|listing)\b|\bstarted a live\b|\bmentioned you\b|\bliked your\b|مسلسل جديد|حلقة/iu;
// a prize, a lure, a link to "verify" — a scam text
const LINK = /https?:\/\/|\bbit\.ly\/|\btinyurl\.com\/|\b[\w-]+\.(?:xyz|top|win|help|click|icu|buzz|live|site|online|info)\b/i;
const LURE = /\b(claim|verify (?:now|your)|confirm your (?:pin|card|data|account|details)|update your (?:card|data|details|payment)|cancel here|click (?:here|the link)|by mistake|suspended|will be closed|closed today|held at customs|final notice|unpaid toll)\b|اضغط|بالخطأ|بالغلط|لتحديث بياناتك|تحديث البيانات/iu;
const PRIZE = /\b(congratulations|you(?:'ve| have)? won|you are (?:a |the )?winner|you are selected|your prize|claim your)\b|مبروك (?:كسبت|ربحت)|كسبت [\d٠-٩]|ربحت|الجايزة|الجائزة|by mistake.{0,40}\b(?:refund|return|send)\b|بالخطأ.{0,40}(?:اعادة|إعادة|رجع)/iu;
export const isScam = (text) => { const t = String(text || ""); return PRIZE.test(t) || (LINK.test(t) && LURE.test(t)); };
/** An SMS whose sender is a person's phone number, not a bank's name ("+20 10…", "0101…") — people TALK about money there, like in a chat. */
export const fromPhoneNumber = (n) => !!n && /messag|\bsms\b|mms|رسائل/i.test(String(n.app || "") + " " + String(n.pkg || "")) && /^\s*\+?[\d\s().-]{7,}\s*$/.test(String(n.title || ""));
const HAPPENED = /\b(debited|credited|charged|you paid|you sent|you received|was deducted|refunded)\b|تم (?:خصم|تحويل|استلام|إيداع|ايداع|سحب|دفع|سداد)|استلمت|وصلك/iu;

/** Why this notification is not money that moved ("" when it could be). n = { app, pkg, title } for the sender checks. */
export function notAPayment(text, n = null) {
  const t = String(text || "");
  if (CODE_W.test(t)) return "code";
  if (isScam(t)) return "scam";
  if (n && fromPhoneNumber(n)) return "person";
  if (FAILED_W.test(t)) return "failed";
  if (NOTYET_W.test(t)) return "notyet";
  if (OFFER_W.test(t) && !HAPPENED.test(t)) return "offer";
  if (PRICE_W.test(t) && !HAPPENED.test(t)) return "price";
  if (POST_W.test(t)) return "post";
  return "";
}
