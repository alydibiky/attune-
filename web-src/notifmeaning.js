/* ---- v9.8 (Ali, 7 Nov: "make sure Attune can recall all notifications — it has to UNDERSTAND what the notification is, so when I ask
   about something without the notification's own words it already knows"). Each kept notification (RecallLog.kt) is read by code
   into what it IS: a delivery on its way, money out of the bank, a missed call, a message from a person, a ride, a flight, an
   appointment, a bill, a login code (never kept), an offer… with who / which shop / how much / what state. Those meaning words go
   into the search (lookback.js recallSearch) and into every chat's context (brain.js), so "when does my package come?" finds
   «Shipped · Amazon Shopping — Arriving Thursday» and "who called me?" finds «Missed call · Ahmed».
   Pure and offline; tests/unit/v980fixes.test.mjs.                                                                                */

import { OFFER_W, CODE_W } from "./notifwords.js";   // v9.9.17 one list for all four readers
const low = (s) => String(s || "").toLowerCase();

// [kind, app package / app name pattern, text pattern, the words it means (EN · Egyptian Arabic · Franco)]
const KINDS = [
  ["delivery", /amazon|noon|jumia|talabat|breadfast|elmenus|instashop|aramex|dhl|fedex|ups|bosta|mylerz|shein|temu|aliexpress|careem.*food|deliveroo|ubereats|glovo|rabbit|mrsool|hungerstation|swvl.*box/,
    /\b(shipped|out for delivery|on (?:its|the) way|arriv(?:ing|es|ed)|delivered|dispatched|courier|tracking|your (?:order|package|parcel|shipment)|order (?:#|no|number|confirmed|placed|is ready)|rider|picked up)\b|تم الشحن|في الطريق|خرجت? للتوصيل|شحنتك|هيوصل|وصل طلبك|تم التوصيل|طلبك|الطلب|الشحنة|المندوب|الطيار/i,
    "delivery order package parcel shipment shipping courier arriving arrive coming tracking اوردر طلب الطلب شحنه الشحنه دليفري توصيل المندوب جاي هيوصل order delivery"],
  ["bank", /bank|cib|nbe|banquemisr|qnb|hsbc|alahly|instapay|vodafone.?cash|fawry|valu|paymob|paypal|wise|revolut|meeza|aman|sympl|contact|souhoola/,
    /\b(debited|credited|transaction|purchase|spent|withdraw(?:al|n)?|deposit(?:ed)?|transfer(?:red)?|balance|card ending|your card|payment of|paid|refund(?:ed)?|received|egp|usd|sar|aed|qar|kwd|bhd|omr|jod)\b|تم خصم|خصم مبلغ|تم ايداع|تم إيداع|ايداع|إيداع|تحويل|رصيد|بطاقتك|كارت|سحب|عملية شراء|مبلغ|جنيه/i,
    "money bank payment paid spent purchase transaction card transfer balance debit credit refund فلوس البنك دفع دفعت خصم تحويل رصيد كارت فيزا مصاريف flos bank"],
  ["call", /dialer|phone|telecom|incallui|contacts/, /\b(missed (?:voice |video )?call|incoming (?:voice |video )?call|calling|voicemail|called you)\b|مكالمة فائتة|مكالمه فائته|مكالمة لم يرد عليها|اتصل بك|بيتصل/i,
    "call called missed phone ring rang voicemail اتصل اتصال مكالمه كلمني رن رنه kalemny etasal"],
  ["ride", /uber|careem|indrive|didi|bolt|swvl|halan|lyft/, /\b(driver|trip|ride|pickup|pick-up|arriving in|your captain|has arrived|is on the way)\b|السواق|الكابتن|الرحلة|وصل الكابتن|في الطريق اليك/i,
    "ride trip taxi car driver captain uber careem pickup اوبر كريم مشوار عربيه السواق الكابتن رحله"],
  ["flight", /egyptair|emirates|qatar|saudia|flydubai|airarabia|turkish|lufthansa|booking|skyscanner|wego|almosafer|kayak|expedia|agoda|airbnb|trip\.com/,
    /\b(flight|boarding|gate|check-?in|itinerary|booking (?:confirmed|reference)|reservation|pnr|departure|e-?ticket|hotel)\b|رحلتك|الطيران|بوابة|حجزك|تذكرة|الفندق|حجز/i,
    "flight travel trip booking reservation hotel ticket boarding gate airport طياره سفر رحله حجز الحجز فندق تذكره المطار"],
  ["appointment", /calendar|clinic|vezeeta|doctor|hospital|seha|tbibi|altibbi/, /\b(appointment|reminder|meeting|starts in|tomorrow at|booked for|consultation|clinic|doctor)\b|ميعاد|موعد|معاد|كشف|حجز عند|الدكتور|اجتماع/i,
    "appointment meeting doctor clinic calendar event schedule ميعاد معاد موعد كشف دكتور اجتماع ma3ad"],
  ["bill", /vodafone|orange|etisalat|\bwe\b|telecomegypt|electricity|water|gas|internet|fawry/, /\b(bill|due|invoice|recharge|renew(?:al|ed)?|bundle|quota|subscription|expires?|overdue|unpaid)\b|فاتورة|فاتوره|مستحق|شحن|تجديد|باقة|باقه|اشتراك|الرصيد/i,
    "bill invoice due recharge bundle internet subscription renew phone credit فاتوره فواتير باقه النت شحن رصيد اشتراك تجديد"],
  ["security", /google|apple|microsoft|facebook|instagram|bank|authenticator/, /\b(sign-?in|log-?in|new device|security alert|password|verify|suspicious|2-step)\b|تسجيل الدخول|جهاز جديد|تنبيه أمني|كلمة المرور/i,
    "security login sign in password account alert device امان دخول باسورد الحساب"],
  ["promo", /./, /\b(\d+% off|sale|discount|offer|deal|promo(?:code)?|coupon|cashback|limited time|free shipping)\b|(?<!تم )خصم \d|عرض|عروض|تخفيض|كوبون|كاش باك/i,
    "offer deal sale discount promo coupon cashback عرض عروض خصم تخفيضات كوبون"],
  ["news", /news|cnn|bbc|aljazeera|youm7|masrawy|reuters|sky|espn|kooora|yallakora|onefootball|fotmob|sofascore|livescore/, /./,
    "news headline breaking match score result اخبار خبر ماتش نتيجه كوره"],
];
const REAL_CHAT = /whatsapp|telegram|messenger|orca|signal|securesms|viber|slack|teams|discord|imo\b|botim/;
const CHAT_APPS = /whatsapp|telegram|messenger|orca|signal|viber|instagram|slack|teams|discord|imo|botim|messaging|mms|sms/;
const EMAIL_APPS = /gmail|\.gm$|outlook|yahoo|proton|mail/;

const MONEY = /(?<![a-z])(?:egp|e£|le|l\.e\.?|usd|\$|sar|aed|qar|kwd|bhd|omr|jod|eur|€|£|جنيه|ج\.م\.?|ريال|درهم|ر\.س|ر\.ق|د\.إ|د\.ك)\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(?:egp|e£|le\b|l\.e\.?|usd|sar|aed|qar|kwd|bhd|omr|jod|eur|جنيه|جم(?![ء-ي])|ج\.م|ريال|درهم|ر\.س|ر\.ق|د\.إ|د\.ك)/i;
const STATE = [
  [/(?<!will be |to be |couldn't be |could not be |not be |not |for )delivered|تم التوصيل|تم توصيل|اتسلم|وصل طلبك/i, "delivered"], [/out for delivery|خرج للتوصيل|المندوب في الطريق/i, "out for delivery"],
  [/arriv(?:ing|es)\s+((?:on\s+|by\s+)?(?:today|tomorrow|mon|tue|wed|thu|fri|sat|sun|\d{1,2}\s*(?:[a-z]{3}|\/))[\p{L}\d ,/]{0,16})/iu, "arriving"],
  [/shipped|dispatched|تم الشحن/i, "shipped"],
  [/debited|purchase|spent|withdraw|تم خصم|سحب|عملية شراء|(?:payment|we) received(?: your payment)?:?[^.\n]{0,40}\bfor your (?:stay|order|booking|reservation|trip|ticket|purchase|subscription)|received your payment/i, "money out"],   // (v9.9.30: "Payment received: EGP 1,879 for your stay" is YOUR payment) [/credited|deposit|received|تم ايداع|تم إيداع|استلمت/i, "money in"],
  [/missed/i, "missed"], [/cancel+ed|ملغي|تم الالغاء|تم الإلغاء/i, "cancelled"], [/delay(?:ed)?|متأخر|تأخير/i, "delayed"],
];

/** One notification {app, pkg, title, text} → { kind, who, amount, state, words } (words = what it means, for search and chats). */
export function understandNote(n) {
  const pkg = low(n && n.pkg), app = low(n && n.app), src = pkg + " " + app + (/messag|\bsms\b|mms|gmail|\.gm\b|outlook|yahoo|proton|mail/.test(pkg + " " + app) ? " " + low(n && n.title) : ""),   /* v9.9.30: an email's sender counts like an SMS sender ("Vezeeta" in Gmail) */ title = String((n && n.title) || ""), text = String((n && n.text) || "");
  const all = title + " " + text, la = low(all);
  let kind = "";
  // v9.8 (Ali's screenshot): a WhatsApp "Missed voice call" is a call, not a message; an offer ("300 EGP OFF … delivered in 15 minutes")
  // is an offer, not a delivery; an email only counts as a delivery when a shop sent it
  // v9.9.17: «تم خصم 3,317 جم من بطاقتك» is money deducted, not a discount («خصم 30٪»); offers in the app's other languages
  const PROMO0 = /\b\d+\s*(?:%|egp|le|جنيه)?\s*off\b|\bsale\b|\bdiscount\b|\bpromo(?:code)?\b|\bcoupon\b|\bcashback\b|\b(?:special )?offers?\b|\bdeals?\b|\bbonus\b|\binstead of\b|عرض|(?<!تم )خصم \d|تخفيض|كوبون/i;
  const PROMO = { test: (x) => (PROMO0.test(x) || OFFER_W.test(x)) && !/تم خصم|خصم مبلغ|\b(debited|credited|charged)\b/i.test(x) };
  // a person's chat is a message (or a missed call) whatever words it uses («انا في الطريق» is not a delivery, "the gate code" not a flight)
  const realChat = REAL_CHAT.test(src), cal = /calendar|com\.google\.android\.apps\.tachyon|\bmeet\b/.test(src);
  const SHOP = /amazon|noon|jumia|talabat|breadfast|aramex|dhl|fedex|ups|bosta|mylerz|shein|temu|aliexpress|instashop/i;
  if (/missed (?:voice |video )?call|مكالمة (?:صوتية |فيديو )?فائتة|مكالمة لم يرد عليها/i.test(all)) kind = "call";
  else if (realChat) kind = "";
  else if (cal || /\bstarts in \d+ (?:min|mins|minutes|hours?)\b|\bmeeting in \d+ (?:min|minutes)\b/i.test(all)) kind = "appointment";
  else if (CODE_W.test(all) || /sign[- ]?in|log[- ]?in|tried to log|new device|security alert|password|recovery email|2-step|suspicious|تسجيل الدخول|جهاز جديد|تنبيه أمني/i.test(all) && !/\b(egp|usd|sar|aed)\b|\$|جنيه/i.test(all)) kind = "security";
  else if (PROMO.test(all) && !/\b(shipped|(?:has been|was|been) delivered|out for delivery|your (?:order|package|parcel)|tracking)\b|تم الشحن|تم التوصيل|طلبك/i.test(all)) kind = "promo";
  if (!kind && !realChat) for (const [k, appRx, txtRx] of KINDS) if (appRx.test(src) && txtRx.test(all) && k !== "promo" && k !== "news") { kind = k; break; }
  if (!kind && !realChat) for (const [k, appRx, txtRx] of KINDS) if (k !== "news" && txtRx.test(all) && (k !== "call" || /missed|مكالم/i.test(all)) && !(k === "delivery" && EMAIL_APPS.test(src) && !SHOP.test(all))) { kind = k; break; }
  if (!kind && KINDS[KINDS.length - 1][1].test(src)) kind = "news";
  // a person's message (chat apps): the title is who wrote — «Ahmed Salah 012 (Dayı)», a group's "Group: Name"
  let who = "";
  if (!kind && CHAT_APPS.test(src)) { kind = "message"; who = title.replace(/\s*\(\d+ (?:messages?|رسائل|رسالة)\)\s*$/i, "").replace(/^.*?:\s*/, (m) => (m.length < 40 ? m : "")).trim(); }
  if (!kind && EMAIL_APPS.test(src)) { kind = "email"; who = title.trim(); }
  if (kind === "call" && CHAT_APPS.test(src)) who = title.replace(/\s*\(\d+.*\)\s*$/, "").trim();
  else if (kind === "call") who = (title.replace(/missed call|مكالمة فائتة|مكالمه فائته/gi, "") || text.replace(/missed call( from)?|مكالمة فائتة( من)?/gi, "")).replace(/[·:\-]/g, " ").trim();
  // v9.9.12 (Ali: the Google AI Pro receipt "ج.م.‏ ٩٣٩٫٩٩/month" wasn't added to Subscriptions): Arabic digits, the Arabic decimal mark
  // and the invisible direction marks are read like 939.99
  const m = MONEY.exec(all.replace(/[\u200e\u200f\u061c\u202a-\u202e]/g, "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776)).replace(/٫/g, ".").replace(/٬/g, ",")), amount = m ? +String(m[1] || m[2]).replace(/,/g, "") : 0;
  let state = ""; for (const [rx, s] of STATE) { const x = rx.exec(all); if (x) { state = s === "arriving" && x[1] ? "arriving " + x[1].replace(/\s+/g, " ").trim() : s; break; } }
  const def = KINDS.find((k) => k[0] === kind);
  const words = [def ? def[3] : kind === "message" ? "message messages wrote texted chat رساله رسايل بعت كلمني مسدج" : kind === "email" ? "email mail inbox ايميل بريد" : "",
    state, who, (app || "").replace(/[^a-z؀-ۿ ]/gi, " ")].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return { kind: kind || "other", who, amount, state, words };
}

const LABEL = { delivery: "Delivery", bank: "Bank / payment", call: "Call", ride: "Ride", flight: "Travel", appointment: "Appointment", bill: "Bill", security: "Account security", promo: "Offer", news: "News", message: "Message", email: "Email", other: "Notification" };
/** One line a model can read: "[Delivery · shipped] Amazon Shopping · 29 Oct 21:10 — Shipped: Arriving Thursday". */
export function noteLine(n, now = Date.now()) {
  const u = understandNote(n);
  let when = ""; try { const d = new Date(n.ts || now); when = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " " + d.toTimeString().slice(0, 5); } catch (e) {}
  return `[${LABEL[u.kind]}${u.state ? " · " + u.state : ""}${u.who ? " · from " + u.who : ""}${u.amount ? " · " + u.amount : ""}] ${n.app || ""} · ${when} — ${String(n.title || "").slice(0, 80)}: ${String(n.text || "").replace(/\s+/g, " ").slice(0, 220)}`;
}
