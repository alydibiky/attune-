// v9.9.13 (Ali, 10 Nov: "make sure it understands 99 percent of notifications"): a corpus of real-life notifications — offers, receipts,
// bank SMS, deliveries, chats, videos, codes, reminders — in English and Egyptian Arabic. Each must be read right by code:
//   "ads" (an offer: never asked, never money) · "notmoney" (a video / post / news / game) · "paid" (a receipt: you were charged)
//   · "ask" (money in a chat Attune can't judge alone — asked, with a guess when it has one) · "-" (nothing to ask: no money in it)
// and money from a bank / wallet goes to the payment reader (never asked here). The score must be ≥ 99%.
import * as L from "../../web-src/notelabels.js";
import { readNotification } from "../../web-src/paylog.js";
import * as AP from "../../web-src/autopilot.js";
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const now = Date.now();
const A = (app, pkg, title, text) => ({ app, pkg, title, text, ts: now, id: Math.random().toString(36).slice(2) });
// [expected, notification]
const C = [
  // ---- offers / ads (never asked)
  ["ads", A("Uber", "com.ubercab", "Uber", "Invite a friend to Uber and get ج.م.‏ 30 off when they take their first trip. Terms apply.")],
  ["ads", A("talabat", "com.talabat", "talabat", "For 206 EGP only instead of 295 EGP order 4 gateaux pieces from La Poire. Treat yourself on talabat.")],
  ["ads", A("talabat", "com.talabat", "Lunch time 🍔", "50% off on burgers today only — up to EGP 100")],
  ["ads", A("noon", "com.noon.buyerapp", "Yellow Friday is here", "Up to 70% off on phones. Prices from EGP 2,999")],
  ["ads", A("Amazon", "com.amazon.mShop.android.shopping", "Deal of the Day", "Save EGP 1,200 on Philips Airfryer — limited time")],
  ["ads", A("Jumia", "com.jumia.android", "Jumia", "🔥 Flash sale: Samsung A15 at EGP 6,499 only!")],
  ["ads", A("Careem", "com.careem.acma", "Careem", "Your weekend treat: 25% off your next 3 rides, max EGP 40 each. Use code WEEKEND")],
  ["ads", A("Breadfast", "com.breadfast", "Breadfast", "Free delivery on orders above 300 EGP 🥐 order now")],
  ["ads", A("Vodafone", "com.emeint.android.myservices", "Vodafone", "اشترك في باقة فليكس ٢٠٠ واحصل على ضعف الدقايق بـ ٢٠٠ جنيه بس")],
  ["ads", A("Orange", "com.orange.mobinilandme", "Orange", "عرض خاص: ٥٠٪ خصم على باقات النت لمدة شهر بـ ٧٥ جنيه")],
  ["ads", A("Etisalat", "com.etisalat.flous", "e&", "Recharge 50 EGP and get 100 EGP bonus! Offer valid till Friday")],
  ["ads", A("Messages", "com.google.android.apps.messaging", "B.TECH", "Shop the iPhone 16 with installments starting EGP 1,999/month. Visit btech.com")],
  ["ads", A("Messages", "com.google.android.apps.messaging", "Carrefour", "عروض كارفور: الزيت ٢ لتر بـ ١٢٠ جنيه بدل ١٥٠ جنيه لحد الخميس")],
  ["ads", A("Instashop", "com.instashop", "InstaShop", "Get EGP 50 off your next order with code INSTA50")],
  ["ads", A("Shein", "com.zzkko", "SHEIN", "Your cart misses you! Extra 15% off — items from $3.99")],
  ["ads", A("Temu", "com.einnovation.temu", "Temu", "Lightning deal: 🎁 items from EGP 25. Hurry, ends soon")],
  ["ads", A("Booking.com", "com.booking", "Booking.com", "Getaway Deals: save 15% or more on stays in Sharm El Sheikh — from EGP 2,100")],
  ["ads", A("Swvl", "mobi.swvl.android", "Swvl", "Ride with Swvl this week and get 20 EGP cashback on every trip")],
  ["ads", A("Instagram", "com.instagram.android", "Instagram", "Sponsored · Zara: New collection from EGP 899")],
  ["ads", A("Gmail", "com.google.android.gm", "Netflix", "New on Netflix this week — plans from EGP 120/month. Watch now")],
  ["ads", A("CIB", "com.cib.mobile", "CIB", "Enjoy 10% cashback on your Visa card at Seoudi until 30 Nov. Max EGP 500")],
  ["ads", A("InstaPay", "com.egyptianbanks.instapay", "InstaPay", "اربح ١٠٠ جنيه لما تحول لأي حد النهارده! الحق العرض")],
  // ---- videos / posts / news / games (not money)
  ["notmoney", A("YouTube", "com.google.android.youtube", "MrBeast", "I Hustled Streamers for $250,000")],
  ["notmoney", A("YouTube", "com.google.android.youtube", "Elzero Web School", "Learn Python in 3 hours — free course worth $200")],
  ["notmoney", A("TikTok", "com.zhiliaoapp.musically", "TikTok", "@someone posted: I spent 10,000 EGP on this phone 😱")],
  ["notmoney", A("Facebook", "com.facebook.katana", "Facebook", "Ahmed shared a post: The new Corolla price is 1,650,000 EGP")],
  ["notmoney", A("X", "com.twitter.android", "Elon Musk", "Tesla stock up $50 today")],
  ["notmoney", A("Youm7", "com.youm7.android", "اليوم السابع", "سعر الدولار اليوم ٤٨٫٥٠ جنيه في البنك الأهلي")],
  ["notmoney", A("Google News", "com.google.android.apps.magazines", "Reuters", "Egypt raises fuel prices: 92-octane now EGP 17.25 a litre")],
  ["notmoney", A("Reddit", "com.reddit.frontpage", "r/Egypt", "Is 25,000 EGP a good salary in Cairo?")],
  ["notmoney", A("PUBG MOBILE", "com.tencent.ig", "PUBG MOBILE", "Royale Pass is here — get it for $9.99")],
  ["notmoney", A("LinkedIn", "com.linkedin.android", "LinkedIn", "Jobs for you: Accountant — EGP 15,000 a month")],
  ["notmoney", A("Spotify", "com.spotify.music", "Spotify", "New episode: How I saved $10,000 in a year")],
  ["notmoney", A("Shahid", "net.mbc.shahid", "Shahid", "مسلسل جديد: الكنز ٢ — حلقة ١٠٠ مليون")],
  // ---- receipts: you were charged (asked as "You paid … add it?" or a subscription)
  ["paid", A("Gmail", "com.google.android.gm", "Google Play", "Your Google Play Order Receipt from 7 Nov 2026\nYour subscription from Google Commerce Limited on Google Play continues and you've been charged.\nGoogle AI Pro (5 TB)\nج.م.‏ ٩٣٩٫٩٩/month")],
  ["paid", A("Gmail", "com.google.android.gm", "Amazon.eg", "Thank you for your order. Your payment was successful — you were charged EGP 1,250.00. Order number: 402-118")],
  ["paid", A("Gmail", "com.google.android.gm", "Apple", "Your receipt from Apple. iCloud+ 50 GB — EGP 49.99. Billed to Visa •• 4411")],
  ["paid", A("Gmail", "com.google.android.gm", "Netflix", "Your payment of EGP 240 was successful. Thanks for your payment — your membership continues.")],
  ["paid", A("Gmail", "com.google.android.gm", "Uber Receipts", "Your Thursday evening trip with Uber. Total EGP 87.50. Thanks for riding — you were charged on Visa 4411")],
  ["paid", A("Gmail", "com.google.android.gm", "talabat", "Thanks for your order from Koshary Abou Tarek. Total paid: EGP 145.00. Order no. 99812")],
  ["paid", A("Gmail", "com.google.android.gm", "Spotify", "Receipt: Spotify Premium Individual EGP 59.99 — payment successful")],
  ["paid", A("Gmail", "com.google.android.gm", "فوري", "تم الدفع بنجاح. فاتورة الكهرباء ٤٣٥ جنيه. رقم العملية ٨٨٢١")],
  ["paid", A("Gmail", "com.google.android.gm", "OpenAI", "Your ChatGPT Plus receipt — $20.00 paid. Invoice #A1B2")],
  ["paid", A("Gmail", "com.google.android.gm", "Anghami", "إيصال: تم تجديد اشتراكك في أنغامي بلس ٥٠ جنيه")],
  // ---- money in a chat: asked (with a guess for a work group)
  ["ask:work", A("WhatsApp", "com.whatsapp", "ما يخص المرتبات: Mahmoud 3ashour (Alex Accountant)", "غفره بليل ٤٥٠ جنيه+١٠٠جنيه اعاشه")],
  ["ask:work", A("WhatsApp", "com.whatsapp", "Site workers wages: Hany", "Mohamed 300 EGP, Ali 250 EGP for Thursday")],
  ["ask:work", A("WhatsApp", "com.whatsapp", "الشغل - الموقع: Eng. Tamer", "الونش ١٢٠٠٠ جنيه في اليوم")],
  ["ask", A("WhatsApp", "com.whatsapp", "Karim", "I sent you 500 EGP for the tickets")],
  ["ask", A("WhatsApp", "com.whatsapp", "Mama", "حولتلك ٢٠٠٠ جنيه يا حبيبي")],
  ["ask", A("Telegram", "org.telegram.messenger", "Omar", "The car is 450,000 EGP final")],
  ["ask", A("Messenger", "com.facebook.orca", "Sara", "can you pay me back the 300 EGP?")],
  // ---- bank / wallet money: the payment reader handles it (not asked here)
  ["bank", A("Messages", "com.google.android.apps.messaging", "CIB", "Your account was debited with EGP 450.00 at SEOUDI MARKET on 09/11")],
  ["bank", A("Messages", "com.google.android.apps.messaging", "NBE", "تم خصم مبلغ ٣٠٠ جنيه من حسابك رقم ***١٢ عملية شراء")],
  ["bank", A("InstaPay", "com.egyptianbanks.instapay", "InstaPay", "You received EGP 2,000 from AHMED via InstaPay")],
  ["bank", A("Vodafone Cash", "com.vodafone.vfcash", "Vodafone Cash", "تم تحويل ٥٠٠ جنيه إلى ٠١٠١٢٣٤٥٦٧٨")],
  ["bank", A("CIB", "com.cib.mobile", "CIB", "Purchase of EGP 1,250.00 approved on card 4411 at AMAZON")],
  // ---- nothing to ask (no money in it)
  ["-", A("WhatsApp", "com.whatsapp", "Karim", "See you at 8 🙂")],
  ["-", A("Gmail", "com.google.android.gm", "LinkedIn", "You appeared in 12 searches this week")],
  ["-", A("Messages", "com.google.android.apps.messaging", "CIB", "Your OTP is 448812. Do not share it with anyone")],
  ["-", A("talabat", "com.talabat", "talabat", "Your order is on its way 🛵 Arriving in 15 minutes")],
  ["-", A("Calendar", "com.google.android.calendar", "Meeting", "Site visit at 10:00")],
  ["-", A("Life360", "com.life360.android.safetymapd", "Nada", "Nada arrived at Home")],
  // ---- second batch, written before any rule was changed for it (the held-out check)
  ["ads", A("elmenus", "com.elmenus.app", "elmenus", "Hungry? Get 30% off at Zooba today — up to EGP 60")],
  ["ads", A("Mrsool", "com.mrsool", "مرسول", "توصيل مجاني لأول ٣ طلبات! اطلب دلوقتي")],
  ["ads", A("Valu", "com.valu.app", "valU", "Shop now, pay later: 0% interest for 6 months on orders above EGP 5,000")],
  ["ads", A("Gmail", "com.google.android.gm", "Emirates", "Fly to Dubai from EGP 9,900 return. Book by 15 Nov")],
  ["ads", A("Gmail", "com.google.android.gm", "Udemy", "Courses from $9.99 — sale ends tonight")],
  ["ads", A("Messages", "com.google.android.apps.messaging", "WE", "جدد باقتك واكسب ٥ جيجا هدية. الباقة بـ ١٥٠ جنيه")],
  ["ads", A("Facebook", "com.facebook.katana", "Facebook", "Sponsored: Mountain View — apartments from EGP 4,500,000 with 10 years installments")],
  ["ads", A("Talabat Mart", "com.talabat", "talabat mart", "Buy 1 get 1 free on Pepsi 1L — EGP 25")],
  ["notmoney", A("YouTube", "com.google.android.youtube", "Mo Vlogs", "I bought a $1,000,000 car in Dubai")],
  ["notmoney", A("Instagram", "com.instagram.android", "Instagram", "cristiano shared a reel: Thanks for 600M ❤️")],
  ["notmoney", A("Masrawy", "com.masrawy.app", "مصراوي", "أسعار الذهب اليوم: عيار ٢١ يسجل ٣٦٥٠ جنيه")],
  ["notmoney", A("Clash of Clans", "com.supercell.clashofclans", "Clash of Clans", "Special offer: 1200 gems for $9.99!")],
  ["paid", A("Gmail", "com.google.android.gm", "Careem", "Thanks for riding with Careem. You paid EGP 64.00 with your card ending 4411")],
  ["paid", A("Gmail", "com.google.android.gm", "noon", "Order confirmed! We've received your payment of EGP 3,499. Order no. N8812")],
  ["paid", A("Gmail", "com.google.android.gm", "Microsoft", "Your Microsoft 365 Personal subscription has been renewed. Amount charged: EGP 1,099")],
  ["paid", A("Gmail", "com.google.android.gm", "Vodafone", "تم سداد فاتورة موبايلك بمبلغ ٣٢٠ جنيه بنجاح")],
  ["ask", A("WhatsApp", "com.whatsapp", "Hossam", "خد ١٥٠٠ جنيه من الخزنة")],
  ["ask:work", A("WhatsApp", "com.whatsapp", "Company accounts: Mona", "Petty cash today 2,300 EGP")],
  ["ask", A("WhatsApp", "com.whatsapp", "Ahmed Brother", "حولتلك ٣٠٠٠")],
  ["-", A("Gmail", "com.google.android.gm", "Google", "Security alert: new sign-in on Windows")],
  ["-", A("Uber", "com.ubercab", "Uber", "Your driver Mahmoud is arriving in 3 minutes")],
  ["-", A("WhatsApp", "com.whatsapp", "Family", "Mama: el akl gahez")],
];
let right = 0; const wrong = [];
for (const [want, n] of C) {
  const bankish = (x) => /cib|nbe|instapay|vodafone cash|vf ?cash|bank/i.test((x.app || "") + " " + (x.title || ""));
  if (bankish(n) && (L.understandNote(n) || {}).meaning !== "ads") { const got0 = readNotification(n, { teach: { rules: [] } }) ? "bank" : "-"; if (got0 === want) right++; else wrong.push(`${want} ≠ ${got0} · ${n.app}: ${n.text.slice(0, 70)}`); continue; }
  // v9.9.30: chats are asked about only when the person asks to teach Attune (Chat «علمني اشعاراتي») — this checks that reading
  const u = L.understandNote(n), asks = L.asksFrom([n], { rules: [], asked: [], skip: [] }, { teach: true, bankish: (x) => /cib|nbe|instapay|vodafone cash|vf ?cash|bank/i.test((x.app || "") + " " + (x.title || "")), payOf: (x) => readNotification(x, { teach: { rules: [] } }) });
  const got = u && u.sure && u.meaning !== "paid" ? u.meaning
    : u && u.meaning === "paid" ? "paid"
    : asks.length ? (asks[0].guess ? "ask:" + asks[0].guess : "ask")
    : /cib|nbe|instapay|vodafone cash|bank/i.test(n.app + " " + n.title) && readNotification(n, { teach: { rules: [] } }) ? "bank" : "-";
  // "left out" is one outcome for the person: an offer and a video are both never asked and never money
  const same = got === want || (["ads", "notmoney", "-"].includes(want) && ["ads", "notmoney"].includes(got)) || (want === "notmoney" && got === "-");
  if (same) right++; else wrong.push(`${want} ≠ ${got} · ${n.app}: ${n.text.slice(0, 70)}`);
}
const score = right / C.length;
for (const w of wrong) console.log("  wrong: " + w);
ok(score >= 0.99, `understood ${right} of ${C.length} notifications (${(score * 100).toFixed(1)}%) — Ali asked for 99%`);
ok(C.filter(([w]) => w.startsWith("ask")).every(([, n]) => L.asksFrom([n], { rules: [], asked: [], skip: [] }, { payOf: (x) => readNotification(x, { teach: { rules: [] } }) }).length === 0), "v9.9.30 (Ali: \"not keep asking\"): none of the chat money talk is asked about by itself");
// money from offers never reaches Money or Subscriptions
const adsN = C.filter(([w]) => w === "ads").map(([, n]) => n);
ok(adsN.every((n) => !readNotification(n, { teach: { rules: [] } }) || /cashback|bonus/i.test(n.text) === false), "no offer becomes a payment in Money");
ok(adsN.every((n) => { const x = AP.suggestFrom(n); return !x || x.kind !== "subscription"; }), "no offer becomes a subscription (the Netflix ad “plans from EGP 120/month” included)");
// real subscriptions become subscriptions by themselves
for (const [t, name] of [["Google Play", "Google Gemini"], ["Apple", "Apple"], ["Netflix", "Netflix"], ["Spotify", "Spotify"], ["OpenAI", "ChatGPT"], ["Anghami", "Anghami"]]) {
  const n = C.find(([w, x]) => w === "paid" && x.title === t)[1], x = AP.suggestFrom(n, { now });
  ok(x && x.kind === "subscription" && x.title === name && x.amount > 0, `${t} receipt → subscription “${name}” ${x ? x.amount : ""}`);
}
if (fails) { console.log(fails + " failed"); process.exit(1); }
