/* ---- v9.8 (Ali, 7 Nov: "make sure Attune can recall all notifications — it has to UNDERSTAND what the notification is, so when I ask
   about something without the notification's own words it already knows"). Each kept notification (RecallLog.kt) is read by code
   into what it IS: a delivery on its way, money out of the bank, a missed call, a message from a person, a ride, a flight, an
   appointment, a bill, a login code (never kept), an offer… with who / which shop / how much / what state. Those meaning words go
   into the search (lookback.js recallSearch) and into every chat's context (brain.js), so "when does my package come?" finds
   «Shipped · Amazon Shopping — Arriving Thursday» and "who called me?" finds «Missed call · Ahmed».
   Pure and offline; tests/unit/v980fixes.test.mjs.                                                                                */

const low = (s) => String(s || "").toLowerCase();

// [kind, app package / app name pattern, text pattern, the words it means (EN · Egyptian Arabic · Franco)]
const KINDS = [
  ["delivery", /amazon|noon|jumia|talabat|breadfast|elmenus|instashop|aramex|dhl|fedex|ups|bosta|mylerz|shein|temu|aliexpress|careem.*food|deliveroo|ubereats|glovo|rabbit|mrsool|hungerstation|swvl.*box/,
    /\b(shipped|out for delivery|on (?:its|the) way|arriv(?:ing|es|ed)|delivered|dispatched|courier|tracking|your (?:order|package|parcel|shipment)|order (?:#|no|number|confirmed|placed|is ready)|rider|picked up)\b|تم الشحن|في الطريق|خرج للتوصيل|هيوصل|وصل طلبك|تم التوصيل|طلبك|الطلب|الشحنة|المندوب|الطيار/i,
    "delivery order package parcel shipment shipping courier arriving arrive coming tracking اوردر طلب الطلب شحنه الشحنه دليفري توصيل المندوب جاي هيوصل order delivery"],
  ["bank", /bank|cib|nbe|banquemisr|qnb|hsbc|alahly|instapay|vodafone.?cash|fawry|valu|paymob|paypal|wise|revolut|meeza|aman|sympl|contact|souhoola/,
    /\b(debited|credited|transaction|purchase|spent|withdraw(?:al|n)?|deposit(?:ed)?|transfer(?:red)?|balance|card ending|your card|payment of|paid|refund(?:ed)?|egp|usd|sar|aed)\b|تم خصم|خصم مبلغ|تم ايداع|تم إيداع|ايداع|إيداع|تحويل|رصيد|بطاقتك|كارت|سحب|عملية شراء|مبلغ|جنيه/i,
    "money bank payment paid spent purchase transaction card transfer balance debit credit refund فلوس البنك دفع دفعت خصم تحويل رصيد كارت فيزا مصاريف flos bank"],
  ["call", /dialer|phone|telecom|incallui|contacts/, /\b(missed call|incoming call|calling|voicemail|called you)\b|مكالمة فائتة|مكالمه فائته|مكالمة لم يرد عليها|اتصل بك|بيتصل/i,
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
  ["promo", /./, /\b(\d+% off|sale|discount|offer|deal|promo(?:code)?|coupon|cashback|limited time|free shipping)\b|خصم \d|عرض|عروض|تخفيض|كوبون|كاش باك/i,
    "offer deal sale discount promo coupon cashback عرض عروض خصم تخفيضات كوبون"],
  ["news", /news|cnn|bbc|aljazeera|youm7|masrawy|reuters|sky|espn|kooora|yallakora|onefootball|fotmob|sofascore|livescore/, /./,
    "news headline breaking match score result اخبار خبر ماتش نتيجه كوره"],
];
const CHAT_APPS = /whatsapp|telegram|messenger|orca|signal|viber|instagram|slack|teams|discord|imo|botim|messaging|mms|sms/;
const EMAIL_APPS = /gmail|\.gm$|outlook|yahoo|proton|mail/;

const MONEY = /(?:egp|le|l\.e\.?|usd|\$|sar|aed|eur|€|£|جنيه|ج\.م|ريال|درهم)\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(?:egp|le|l\.e\.?|usd|sar|aed|eur|جنيه|ج\.م|ريال|درهم)/i;
const STATE = [
  [/delivered|تم التوصيل|اتسلم|وصل طلبك/i, "delivered"], [/out for delivery|خرج للتوصيل|المندوب في الطريق/i, "out for delivery"],
  [/arriv(?:ing|es)\s+((?:on\s+|by\s+)?(?:today|tomorrow|mon|tue|wed|thu|fri|sat|sun|\d{1,2}\s*(?:[a-z]{3}|\/))[\p{L}\d ,/]{0,16})/iu, "arriving"],
  [/shipped|dispatched|تم الشحن/i, "shipped"],
  [/debited|purchase|spent|withdraw|تم خصم|سحب|عملية شراء/i, "money out"], [/credited|deposit|received|تم ايداع|تم إيداع|استلمت/i, "money in"],
  [/missed/i, "missed"], [/cancel+ed|ملغي|تم الالغاء|تم الإلغاء/i, "cancelled"], [/delay(?:ed)?|متأخر|تأخير/i, "delayed"],
];

/** One notification {app, pkg, title, text} → { kind, who, amount, state, words } (words = what it means, for search and chats). */
export function understandNote(n) {
  const pkg = low(n && n.pkg), app = low(n && n.app), src = pkg + " " + app, title = String((n && n.title) || ""), text = String((n && n.text) || "");
  const all = title + " " + text, la = low(all);
  let kind = "";
  for (const [k, appRx, txtRx] of KINDS) if (appRx.test(src) && txtRx.test(all) && k !== "promo" && k !== "news") { kind = k; break; }
  if (!kind) for (const [k, appRx, txtRx] of KINDS) if (k !== "news" && txtRx.test(all) && (k !== "call" || /missed|مكالم/i.test(all))) { kind = k; break; }
  if (!kind && KINDS[KINDS.length - 1][1].test(src)) kind = "news";
  // a person's message (chat apps): the title is who wrote — «Ahmed Salah 012 (Dayı)», a group's "Group: Name"
  let who = "";
  if (!kind && CHAT_APPS.test(src)) { kind = "message"; who = title.replace(/\s*\(\d+ (?:messages?|رسائل|رسالة)\)\s*$/i, "").replace(/^.*?:\s*/, (m) => (m.length < 40 ? m : "")).trim(); }
  if (!kind && EMAIL_APPS.test(src)) { kind = "email"; who = title.trim(); }
  if (kind === "call") who = (title.replace(/missed call|مكالمة فائتة|مكالمه فائته/gi, "") || text.replace(/missed call( from)?|مكالمة فائتة( من)?/gi, "")).replace(/[·:\-]/g, " ").trim();
  const m = MONEY.exec(all), amount = m ? +String(m[1] || m[2]).replace(/,/g, "") : 0;
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
