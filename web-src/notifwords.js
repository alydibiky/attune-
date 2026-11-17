/* ---- v9.9.17 (Ali, 11 Nov 2026: "a sample of 10000 notifications in every area … see how the app deals with it"). ONE place for the
   words that say a notification with an amount in it is NOT money that moved — used by all four readers (Money's list paylog.js,
   Autopilot's card autopilot.js, "is this yours?" notelabels.js, what-it-is notifmeaning.js). Before this each reader had its own
   list, and what one refused another let through: of 10,000 generated notifications, 855 that are not payments reached Money
   (a code "for your purchase of EGP 567", «تم رفض عملية شراء», "you will be billed", a bill that is only due, a fine, a prize text).
     notAPayment(text, n) → "" (could be a payment) | "code" | "failed" | "notyet" | "offer" | "price" | "post" | "scam" | "person"
   Pure; tests: tests/unit/v9917notifs.test.mjs and the 10,000 run (bash tests/notifs/run.sh).                                      */

// a one-time code — also when it names the purchase it is for ("397519 is your verification code for … purchase of EGP 567")
export const CODE_W = /\b(otp|one[- ]time|verification code|security code|passcode|auth(?:entication)? code|2fa)\b|\b(?:use|enter) (?:the )?code \d{4,8}\b|\b\d{4,8} is your\b|رمز التحقق|كود التحقق|كود التفعيل|رمز التفعيل|كلمة المرور لمرة|الرمز السري|لا تشارك(?:ه|ها)?\s(?!بيانات|معلومات|حساب|ارقام|أرقام)|(?<![\p{L}])(code de (?:vérification|sécurité|confirmation)|código de (?:verificación|seguridad|verificação|confirmação)|bestätigungscode|sicherheitscode|doğrulama kodu|kode (?:otp|verifikasi)|codice (?:di verifica|otp)|verificatiecode|код подтверждения|验证码|인증번호|認証コード)(?![\p{L}])/iu;
// it did NOT happen: declined, failed, not charged
export const FAILED_W = /\b(couldn'?t (?:charge|process|complete|renew)|could not (?:charge|process|complete|renew)|unable to (?:charge|process|renew)|declined|(?:was|were|is|has) not (?:been )?(?:charged|completed|processed|deducted|successful|debited)|not charged|wasn'?t charged|won'?t be charged|unsuccessful|failed|couldn'?t (?:process|complete|be delivered)|could not be (?:processed|completed)|rejected|insufficient (?:funds|balance)|no amount was deducted|was released|released back)\b|تم رفض|رفض العملية|مرفوضة|فشلت|فشل (?:تجديد|عملية|الدفع|التحويل)|لم يتم خصم|لم تتم|لم يتم|تم ايقاف العملية|تم إيقاف العملية|لعدم كفاية|(?<![\p{L}])(refus[ée]e?|échou[ée]e?|rechazad[oa]|fallid[oa]|abgelehnt|fehlgeschlagen|reddedildi|başarısız|basarisiz|ditolak|gagal|recusad[oa]|rifiutat[oa])(?![\p{L}])/iu;
// it has not happened YET: due, will be charged, to be paid on delivery, a quote, a request, a limit, something maturing
export const NOTYET_W = /\b(changing (?:its|the|your) price|price (?:change|increase)s?\b|(?:salary|pay) ?slip|payslip|(?:renewal )?quote(?=\s*:)|quotation|will be (?:egp|usd|sar|aed|le|eur)|starting (?:january|february|march|april|may|june|july|august|september|october|november|december|next month)|will be (?:charged|billed|debited|deducted|renewed|collected|delivered|credited|refunded)|you'?ll be (?:charged|billed)|you will be (?:charged|billed)|will renew|renews on|auto-?renew|upcoming (?:payment|charge|bill)|payment (?:is )?due|is (?:now )?(?:due|overdue|payable)|are (?:now )?(?:due|overdue|payable)|(?:due|payable) (?:on|by|in|before|date|within)|due \d|overdue|total due|minimum due|amount due|pay (?:it |now |online )?before|to be paid|cod amount|cash on delivery|free trial|trial (?:ends|period)|matures on|estimated at|offered|requested|would (?:be|cost)|will arrive|in \d+\s*[–-]\s*\d+ (?:business |working )?days|credit limit|limit (?:has been |was )?(?:increased|raised|changed)|scheduled (?:for|on)|is being (?:reviewed|processed|verified)|being processed|is pending|pending approval|once it is processed|refund request|your request (?:to|for))\b|سيتم (?:خصم|تجديد|التجديد|سحب)|مستحق|(?:آخر|اخر) (?:ميعاد|موعد|يوم)|موعد (?:الدفع|السداد)|صدرت بقيمة|قيد (?:المراجعة|التنفيذ)|سدد قبل|السداد قبل|المبلغ المطلوب|الفترة التجريبية|تاريخ الاستحقاق|سعر الكشف|يطلب منك|طلب منك|الحد الائتماني|حد البطاقة|(?<![\p{L}])(sera (?:débité|prélevé|facturé)|se renouvelle|essai gratuit|será (?:cobrado|cargado|debitado|renovad[oa])|se renovará|prueba gratuita|teste grátis|vence em|vence el|wird (?:abgebucht|belastet|verlängert)|fällig|probemonat|verrà addebitat[oa]|si rinnova|scade il|tahsil edilecek|yenilenecek|son ödeme|akan (?:ditagih|didebit)|jatuh tempo)(?![\p{L}])/iu;
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
// v10.2 (Ali's CIB offer: "…اضغط هنا: https://cib.eg/0p1z", sent by CIB): a link to the SENDER's own site is not a lure — "click here"
// with a link is a scam only when the link goes somewhere else (a fake "cib-eg.help" from "CIB" still is)
const ownLink = (t, sender) => { const who = String(sender || "").toLowerCase().replace(/[^a-z0-9]/g, ""); if (who.length < 2) return false;
  const hosts = [...String(t).matchAll(/https?:\/\/([^\/\s]+)/gi)].map((m) => m[1].toLowerCase()); if (!hosts.length) return false;
  return hosts.every((h) => { const base = h.replace(/^www\./, "").split("."); return base[0] === who && /^(?:eg|com|net|com\.eg|ae|sa|co|io|bank|me)$/.test(base.slice(1).join(".")); }); };
export const isScam = (text, sender = "") => { const t = String(text || ""); return PRIZE.test(t) || (LINK.test(t) && LURE.test(t) && !ownLink(t, sender)); };
/** An SMS whose sender is a person's phone number, not a bank's name ("+20 10…", "0101…") — people TALK about money there, like in a chat. */
export const fromPhoneNumber = (n) => !!n && /messag|\bsms\b|mms|رسائل/i.test(String(n.app || "") + " " + String(n.pkg || "")) && /^\s*\+?[\d\s().-]{7,}\s*$/.test(String(n.title || ""));
const HAPPENED = /\b(debited|credited|charged|you paid|you sent|you received|was deducted|refunded)\b|تم (?:خصم|تحويل|استلام|إيداع|ايداع|سحب|دفع|سداد)|استلمت|وصلك/iu;

/** Why this notification is not money that moved ("" when it could be). n = { app, pkg, title } for the sender checks. */
export function notAPayment(text, n = null) {
  const t = String(text || "");
  if (CODE_W.test(t)) return "code";
  if (isScam(t, n && n.title)) return "scam";
  if (n && fromPhoneNumber(n)) return "person";
  if (FAILED_W.test(t)) return "failed";
  if (NOTYET_W.test(t)) return "notyet";
  if (OFFER_W.test(t) && !HAPPENED.test(t)) return "offer";
  if (PRICE_W.test(t) && !HAPPENED.test(t)) return "price";
  if (POST_W.test(t)) return "post";
  return "";
}

/* ---- v10.2 (Ali, 17 Nov 2026: "there was a sign-in link email from Claude, it was saved in Dates like it was a subscription").
   A sign-in link, a login code, "verify your email", a password reset, "new sign-in to your account" — the date or "expires in 1 hour"
   in it is the LINK's, never a trial, a renewal or a paper. Dates, the notification reader and the Overpaying check all skip it.
   isSignInMessage(text) → true for those. A real renewal / trial / document that only adds "sign in to manage" is not one. */
// the message is ABOUT signing in (any of the 20 languages)
const SIGNIN_W = new RegExp([
  String.raw`\b(?:sign|log)[- ]?in (?:link|code|request|attempt)s?\b`, String.raw`\blogin (?:link|code|request|attempt)s?\b`, String.raw`\b(?:magic|secure|one[- ]time|passwordless) (?:sign[- ]?in |log[- ]?in |login )?link\b`,
  String.raw`\blink to (?:sign|log) ?in\b`, String.raw`\b(?:click|tap|use) (?:the |this )?(?:link|button) (?:below )?to (?:sign|log) ?in\b`, String.raw`\b(?:sign|log) ?in to (?:your )?[\w.\- ]{1,30}? (?:with|using) (?:this|the) (?:link|code)\b`,
  String.raw`\bsecure link to (?:sign|log) ?in\b`, String.raw`\byour (?:sign[- ]?in|log[- ]?in|login) (?:link|code)\b`,
  String.raw`\b(?:verify|confirm) your (?:email|e-mail|account|address|phone|identity)\b`, String.raw`\b(?:email|e-mail|account) (?:verification|confirmation)\b`,
  String.raw`\b(?:reset|change) your password\b`, String.raw`\bpassword (?:reset|recovery)\b`, String.raw`\bforgot (?:your )?password\b`,
  String.raw`\bnew (?:sign[- ]?in|log[- ]?in|login|device)\b`, String.raw`\b(?:sign|log)[- ]?in (?:from|on) a new\b`, String.raw`\bsomeone (?:signed|logged) in\b`, String.raw`\bwas this you\b`,
  // ar (Egyptian + Fusha)
  "رابط تسجيل الدخول", "رابط الدخول", "رابط آمن", "كود تسجيل الدخول", "رمز تسجيل الدخول", "سجل دخولك", "سجّل دخولك", "لتسجيل الدخول", "تأكيد البريد", "تاكيد البريد", "تأكيد بريدك", "تحقق من بريدك", "إعادة تعيين كلمة المرور", "اعادة تعيين كلمة المرور", "تسجيل دخول جديد",
  // es pt it fr de
  "enlace de inicio de sesión", "enlace para iniciar sesión", "código de inicio de sesión", "inicia sesión con este enlace", "verifica tu correo", "confirma tu correo", "restablecer (?:tu )?contraseña", "nuevo inicio de sesión",
  "link de (?:acesso|login)", "link para entrar", "código de acesso", "verifique seu e-mail", "confirme seu e-mail", "redefinir (?:sua )?senha", "novo login",
  "link di accesso", "codice di accesso", "accedi con questo link", "verifica (?:la tua )?email", "conferma (?:la tua )?email", "reimposta(?:re)? (?:la )?password", "nuovo accesso",
  "lien de connexion", "lien pour vous connecter", "code de connexion", "vérifiez votre (?:adresse )?e-?mail", "confirmez votre (?:adresse )?e-?mail", "réinitialis(?:er|ez) (?:votre )?mot de passe", "nouvelle connexion",
  "anmeldelink", "login-link", "anmeldecode", "bestätigen sie ihre e-?mail", "e-?mail-adresse bestätigen", "passwort zurücksetzen", "neue anmeldung",
  // ru tr id
  "ссылка для входа", "код для входа", "код входа", "подтвердите (?:вашу )?почту", "подтвердите (?:ваш )?e-?mail", "сброс пароля", "сбросить пароль", "новый вход",
  "giriş bağlantısı", "giriş kodu", "e-?postanızı doğrulayın", "şifrenizi sıfırlayın", "şifre sıfırlama", "yeni giriş",
  "tautan masuk", "kode masuk", "verifikasi email", "atur ulang kata sandi", "login baru",
  // hi ur fa bn sw
  "साइन इन लिंक", "लॉगिन लिंक", "लॉग इन लिंक", "लॉगिन कोड", "ईमेल सत्यापित", "पासवर्ड रीसेट", "نئے لاگ ان", "لاگ ان لنک", "لاگ ان کوڈ", "پاس ورڈ ری سیٹ",
  "لینک ورود", "کد ورود", "تأیید ایمیل", "بازنشانی رمز عبور", "ورود جدید", "সাইন ইন লিংক", "লগইন লিংক", "লগইন কোড", "পাসওয়ার্ড রিসেট",
  "kiungo cha kuingia", "msimbo wa kuingia", "thibitisha barua pepe", "weka upya nenosiri",
  // th vi zh ja ko
  "ลิงก์เข้าสู่ระบบ", "รหัสเข้าสู่ระบบ", "ยืนยันอีเมล", "รีเซ็ตรหัสผ่าน", "liên kết đăng nhập", "mã đăng nhập", "xác minh email", "đặt lại mật khẩu", "đăng nhập mới",
  "登录链接", "登录验证码", "登入連結", "验证您的邮箱", "重置密码", "新的登录", "ログインリンク", "サインインリンク", "ログインコード", "メールアドレスの確認", "パスワードの再設定", "新しいログイン",
  "로그인 링크", "로그인 코드", "이메일 인증", "비밀번호 재설정", "새 로그인",
].join("|"), "iu");
// "this link / code expires in 15 minutes" — the thing that expires is the link or the code
const LINKEXP_W = new RegExp([
  String.raw`\b(?:link|code|otp|token|url|button)s?\b[^.\n]{0,25}\b(?:expires?|expiring|will expire|is valid|valid for|valid until|only valid|can only be used once|works once)\b`,
  "(?:رابط|الرابط|كود|الكود|رمز|الرمز)[^.\\n]{0,25}(?:صالح|صالحة|بينتهي|ينتهي|تنتهي|هينتهي|صلاحيته|لمرة واحدة)",
  String.raw`(?:enlace|código|link|codice|lien|code|ссылка|код|bağlantı|kod|tautan|kode)[^.\n]{0,25}(?:caduca|vence|expira|válid|scade|valido|expire|läuft|gültig|истекает|действительн|geçerli|sona erer|kedaluwarsa|berlaku)`,
  "(?:लिंक|कोड|لنک|کوڈ|لینک|کد|লিংক|কোড|kiungo|msimbo|ลิงก์|รหัส|liên kết|mã|链接|验证码|連結|リンク|コード|링크|코드)[^.\\n]{0,25}(?:समाप्त|मान्य|ختم|منقضی|معتبر|মেয়াদ|itaisha|halali|หมดอายุ|hết hạn|hiệu lực|过期|失效|有效|有効|期限|만료|유효)",
].join("|"), "iu");
const REAL_W = /\b(?:renews?|renewal|auto-?renew|free trial|trial (?:ends|period)|membership|subscription (?:renews|ends|will)|warranty|return (?:by|within)|passport|licen[cs]e|insurance|next (?:billing|payment|charge)|will be charged)\b|تجديد|يتجدد|بيتجدد|التجربة المجانية|الاشتراك هيتجدد|renouvel|renova|verlänger|rinnov|yenilen|perpanjang/i;
export function isSignInMessage(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (LINKEXP_W.test(t) || CODE_W.test(t)) return true;
  // "Sign in to Claude" + a link in the message
  const signinTitle = /^(?:sign|log) ?in to \S+(?: \S+)?(?:\n|$)/i.test(String(text || "").trim()) && /\blink\b|https?:\/\//i.test(t);
  // a renewal / trial / paper that only adds "sign in to manage" is not a sign-in message
  return (SIGNIN_W.test(t) || signinTitle) && !REAL_W.test(t);
}
