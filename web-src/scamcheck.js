/* ---- v9.3 "Is this a scam?" in Money Guardian (Ali, 5 Nov 2026, on A3: "wasn't that already available via Deal Check, or did you forget?"
   — it was: Deal Check (archive/deal, 4 Nov) was to be folded into Money Guardian, and that fold is done here).
   Any message, offer or screenshot → Scam · Be careful · No warning signs, always with the reasons. By code, on the phone; nothing is
   sent anywhere. The offer signs come from Deal Check (archive/deal/web-src/deal.js SIGNS); the message signs are new: fake links, "your
   account will be blocked", card numbers / PINs, "this is my new number", a parcel held for a small fee, easy-money jobs.
   Pure; tests: tests/unit/v930scam.test.mjs.                                                                                      */
const toLatin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));

// [id, weight, pattern, English reason, Egyptian Arabic reason]
export const SIGNS = [
  // from Deal Check (offers and sellers)
  ["pay-first", 3, /(deposit|advance payment|pay (first|before|in advance)|transfer (the money|first)|send (the )?money|عربون|حو(ّ)?ل (الأول|الاول|الفلوس)|ابعت (الفلوس|المبلغ)|ادفع (الأول|الاول|مقدم)|مقدم)/i,
    "They want money before you see or receive anything.", "عايزين فلوس قبل ما تشوف أو تستلم أي حاجة."],
  ["wallet", 2, /(vodafone cash|فودافون كاش|instapay|انستا ?باي|etisalat cash|orange cash|اورانج كاش|wallet number|رقم المحفظة|western union|gift ?card|كارت (جوجل|ايتونز|آيتونز))/i,
    "Payment to a personal wallet or a gift card — very hard to get back.", "الدفع على محفظة شخصية أو كارت هدايا — صعب جدًا ترجّعه."],
  ["code", 4, /(otp|verification code|send (me )?the code|share the code|الكود اللي (وصلك|جالك|هيوصلك)|ابعت(لي)? الكود|كود التفعيل|رمز التحقق|الكود اللي هيجيلك)/i,
    "They ask for a code sent to your phone — that is how accounts and wallets are stolen.", "بيطلبوا كود جالك على الموبايل — كده بيسرقوا الحسابات والمحافظ."],
  ["prize", 3, /(you (have )?won|congratulations.{0,30}(prize|winner|won)|claim your (prize|reward)|مبروك.{0,30}(كسبت|فزت|ربحت)|كسبت (جايزة|جائزة)|فزت ب)/i,
    "A prize you never entered for.", "جايزة من مسابقة إنت أصلًا مدخلتهاش."],
  ["urgent", 1, /(today only|last chance|only \d+ left|hurry|limited time|expires (today|tonight|in \d+)|act now|within 24 hours|النهاردة بس|النهارده بس|آخر فرصة|اخر فرصة|لفترة محدودة|الحق قبل|الكمية محدودة|فاضل \d+ بس|خلال 24 ساعة)/i,
    "Pressure to decide fast — a classic trick.", "ضغط عشان تقرر بسرعة — حيلة معروفة."],
  ["off-platform", 2, /(contact me on whatsapp|whatsapp me|message me outside|pay outside|كلمني (واتس|على الواتس)|تواصل (واتس|خاص)|برا الموقع|خارج (المنصة|الموقع))/i,
    "They move you off the platform, where you lose buyer protection.", "بيطلّعوك برا المنصة، فتخسر حماية المشتري."],
  ["guaranteed", 4, /(guaranteed (profit|return|income)|double your money|risk[- ]free (profit|investment)|\d+% (monthly|weekly|daily) (profit|return)|ربح مضمون|أرباح مضمونة|ارباح مضمونة|ضاعف فلوسك|عائد (شهري|يومي) \d+)/i,
    "Guaranteed high profit — the sign of an investment scam.", "ربح مضمون وعالي — علامة نصب استثمار."],
  // new: messages
  ["block", 3, /(account (will be|has been) (suspended|blocked|locked|closed)|verify your account|update your (details|information|card)|unusual (activity|sign-?in)|حسابك (هيتقفل|اتقفل|سيتم (إيقافه|ايقافه|غلقه))|تحديث (بياناتك|البيانات)|تم ايقاف (حسابك|بطاقتك)|كارتك (اتوقف|هيتوقف))/i,
    "“Your account will be blocked” — banks and wallets never ask you to fix it through a message.", "«حسابك هيتقفل» — البنوك والمحافظ عمرها ما بتطلب منك تصلّح ده من رسالة."],
  ["card", 4, /(card number|cvv|cvc|expiry date|\bpin\b|password|رقم (الكارت|البطاقة|الفيزا)|الرقم السري|كلمة (السر|المرور)|تاريخ الانتهاء|الـ?cvv)/i,
    "They ask for your card number, PIN or password — never give these to anyone.", "بيطلبوا رقم الكارت أو الرقم السري أو الباسورد — متديش الحاجات دي لأي حد."],
  ["new-number", 3, /(this is my new number|my (old )?phone (broke|is broken|was stolen)|new number,? save it|ده رقمي الجديد|دا رقمي الجديد|موبايلي (اتكسر|وقع|اتسرق)|سجل الرقم ده)/i,
    "“This is my new number” followed by a request — call the person on their old number first.", "«ده رقمي الجديد» وبعدها طلب — كلّم الشخص على رقمه القديم الأول."],
  ["parcel", 3, /((parcel|package|shipment|delivery).{0,40}(held|on hold|pending|failed).{0,60}(fee|pay|customs)|(customs|delivery) fee|redelivery|شحنتك.{0,30}(متوقفة|محجوزة)|رسوم (جمارك|توصيل|الشحن))/i,
    "A parcel “held” until you pay a small fee — a common trick to get your card details.", "شحنة «محجوزة» لحد ما تدفع رسوم صغيرة — حيلة معروفة عشان ياخدوا بيانات الكارت."],
  ["easy-job", 3, /(work from home|earn \$?\d+.{0,20}(a|per) (day|hour)|like (videos|posts) (and|to) earn|part[- ]time job.{0,40}(daily|per day)|اشتغل من البيت|اربح \d+.{0,15}(يوميا|في اليوم)|لايكات.{0,20}فلوس|وظيفة.{0,30}(يوميا|في اليوم))/i,
    "Easy money for liking videos or small tasks — these end with you paying “to unlock” your earnings.", "فلوس سهلة على لايكات أو مهام صغيرة — بتخلص إنك تدفع عشان «تفك» أرباحك."],
  ["link-login", 2, /(click|tap|press|open|اضغط|ادخل).{0,30}(link|here|الرابط|اللينك|هنا).{0,40}(login|log in|sign in|verify|confirm|claim|تأكيد|تفعيل|استلام|دخول)/i,
    "A link that asks you to log in or confirm something.", "لينك بيطلب منك تدخل أو تأكّد حاجة."],
];

// official sites a lookalike pretends to be (a link that names the brand but isn't its real domain)
const BRANDS = [["instapay", ["instapay.com.eg", "ipn.eg"]], ["vodafone", ["vodafone.com.eg", "vodafone.com"]], ["cib", ["cibeg.com"]], ["nbe", ["nbe.com.eg"]], ["banquemisr", ["banquemisr.com"]],
  ["fawry", ["fawry.com"]], ["aramex", ["aramex.com"]], ["dhl", ["dhl.com"]], ["amazon", ["amazon.eg", "amazon.com", "amazon.sa", "amazon.ae"]], ["noon", ["noon.com"]], ["paypal", ["paypal.com"]],
  ["netflix", ["netflix.com"]], ["apple", ["apple.com"]], ["google", ["google.com"]], ["whatsapp", ["whatsapp.com"]], ["facebook", ["facebook.com"]], ["egyptpost", ["egyptpost.org"]]];
const host = (u) => { try { return new URL(/^https?:/i.test(u) ? u : "https://" + u).hostname.toLowerCase().replace(/^www\./, ""); } catch (e) { return ""; } };
/** Links that wear a brand's name but are not that brand's site ("instapay-gift.co"). → [{ link, brand }] */
export function fakeLinks(text) {
  const links = String(text || "").match(/\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/gi) || [];
  const out = [];
  for (const l of links) {
    const h = host(l); if (!h || /^\d/.test(h)) continue;
    for (const [b, real] of BRANDS) if (h.includes(b) && !real.some((r) => h === r || h.endsWith("." + r))) { out.push({ link: h, brand: b }); break; }
  }
  return out;
}

/** The verdict. → { level: "scam"|"careful"|"none", score, reasons: [{ id, en, ar }] } */
export function scamCheck(text) {
  const t = toLatin(text);
  if (!t.trim()) return { level: "none", score: 0, reasons: [] };
  const reasons = SIGNS.filter(([, , re]) => re.test(t)).map(([id, w, , en, ar]) => ({ id, w, en, ar }));
  for (const f of fakeLinks(t)) reasons.push({ id: "fake-link", w: 4, en: "The link says “{b}” but goes to {l} — not the real site.", v: { b: f.brand, l: f.link }, ar: "اللينك مكتوب فيه «" + f.brand + "» بس بيروح لـ " + f.link + " — مش الموقع الحقيقي.", link: f.link, brand: f.brand });
  const score = reasons.reduce((a, r) => a + r.w, 0);
  return { level: score >= 4 ? "scam" : score >= 2 ? "careful" : "none", score, reasons: reasons.sort((a, b) => b.w - a.w).map(({ w, ...r }) => r) };
}
