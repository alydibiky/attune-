// v9.9.31 HELD-OUT for notification comprehension — written AFTER the rules were fixed on the 10,000 run, in apps and wordings the
// generator does not use. Each: [cat, intent, action, notification, due?, amount?]. A miss is fixed by its class, never by adding the
// exact sentence. Scored like the 10,000: right when code is sure (must stay ≥ 99%), how many code is sure of, and all right.
//   node tests/notifmind/heldout.mjs
import * as M from "../../web-src/notifmind.js";
export const NOW = Date.parse("2026-11-13T18:00:00");   // Friday
const N = (app, pkg, title, text) => ({ id: "h" + Math.random().toString(36).slice(2, 8), app, pkg, title, text, ts: NOW });
const WA = ["WhatsApp", "com.whatsapp"], TG = ["Telegram", "org.telegram.messenger"], SMS = ["Messages", "com.google.android.apps.messaging"], GM = ["Gmail", "com.google.android.gm"];
const n = ([app, pkg], title, text) => N(app, pkg, title, text);
export const HELD = [
  ["chat", "request", "do", n(WA, "Dad", "هات عيش وانت راجع"), null],
  ["chat", "request", "do", n(WA, "Nadia", "Could you grab milk on your way home?"), null],
  ["chat", "request", "pay", n(WA, "Landlord Mr. Samir", "Kindly transfer this month's rent, 9,500 EGP, by Sunday"), "2026-11-15", 9500],
  ["chat", "request", "call_back", n(TG, "Hossam", "ring me back when you see this"), null],
  ["chat", "question", "reply", n(WA, "Yara", "انت فين دلوقتي؟"), null],
  ["chat", "question", "reply", n(WA, "Paul", "Tu viens ce soir ou pas ?"), null],
  ["chat", "invite", "reply", n(WA, "Cousins 👨‍👩‍👧: Aunt Hoda", "عازماكم على الغدا يوم الجمعة الجاية الساعة 3"), null],
  ["chat", "invite", "reply", n(WA, "Lucas", "Estás invitado a la boda, el 20 de noviembre a las 19:00"), "2026-11-20"],
  ["chat", "greeting", "none", n(WA, "Grandma", "Ramadan Kareem habibi 🌙"), null],
  ["chat", "cancel", "none", n(WA, "Coach Adel", "Training tomorrow is cancelled because of the rain"), null],
  ["chat", "change", "attend", n(WA, "Dentist group: Clinic", "Your session is moved to Thursday at 16:00"), "2026-11-19"],
  ["call", "alert", "call_back", n(["Phone", "com.samsung.android.dialer"], "Missed call", "Uncle Fathy"), null],
  ["bank", "info", "none", n(SMS, "AlexBank", "Purchase of EGP 640.00 with card ending 9912 at SPINNEYS"), null, 640],
  ["bank", "info", "none", n(SMS, "Banque Misr", "تم إيداع مبلغ 12500 جنيه في حسابك رقم ***201"), null, 12500],
  ["bank", "alert", "check", n(SMS, "HSBC", "Your card ending 0098 was declined at NOON.COM for EGP 1,299"), null, 1299],
  ["wallet", "info", "none", n(["InstaPay", "com.egyptianbanks.instapay"], "InstaPay", "You received 450 EGP from AHMED ADEL"), null, 450],
  ["receipt", "confirm", "none", n(GM, "Uber Receipts", "Your receipt: you paid EGP 187.50 for your trip"), null, 187.5],
  ["bill", "reminder", "pay", n(["My Orange", "com.orange.myorange"], "Orange", "Your bill of EGP 412.75 is due on 20 Nov"), "2026-11-20", 412.75],
  ["bill", "reminder", "pay", n(SMS, "North Cairo Electricity", "فاتورة الكهرباء 683 جنيه مستحقة يوم 1 ديسمبر"), "2026-12-01", 683],
  ["subscription", "confirm", "none", n(GM, "Spotify", "Your Premium subscription was renewed. You were charged EGP 99"), null, 99],
  ["media", "alert", "update_payment", n(["Shahid", "net.mbc.shahid"], "Shahid", "Payment failed for your VIP plan — update your card to keep watching"), null],
  ["delivery", "info", "none", n(["noon", "com.noon.buyerapp"], "noon", "Your order has been shipped and will arrive Thursday"), "2026-11-19"],
  ["delivery", "info", "pickup", n(["Aramex", "com.aramex.app"], "Aramex", "Your shipment is out for delivery today"), null],
  ["food", "info", "none", n(["elmenus", "com.elmenus.app"], "elmenus", "Your food is on the way 🛵"), null],
  ["ride", "info", "pickup", n(["Careem", "com.careem.acma"], "Careem", "Your captain has arrived. White Hyundai Elantra"), null],
  ["travel", "info", "travel", n(["Emirates", "com.emirates.ek.android"], "Emirates", "Online check-in is now open for EK 928 to Dubai"), null],
  ["travel", "change", "none", n(["Saudia", "com.saudia.SaudiaApp"], "Saudia", "Your flight SV 302 has been rescheduled. New departure 22:10"), null],
  ["travel", "cancel", "none", n(["Airbnb", "com.airbnb.android"], "Airbnb", "Your reservation in Alexandria has been cancelled"), null],
  ["appointment", "reminder", "attend", n(["Vezeeta", "com.vezeeta.patients"], "Vezeeta", "Don't forget your visit to Dr Amal tomorrow at 7:30 PM"), "2026-11-14"],
  ["calendar", "reminder", "attend", n(["Calendar", "com.google.android.calendar"], "Weekly 1:1 with Rania", "Starts in 10 minutes"), null],
  ["work", "request", "do", n(["Teams", "com.microsoft.teams"], "Teams", "Mahmoud: could you update the slides before the client call?"), null],
  ["work", "request", "do", n(["Asana", "com.asana.app"], "Asana", "Ola assigned you a task: Prepare Q4 report"), null],
  ["school", "reminder", "submit", n(["Moodle", "com.moodle.moodlemobile"], "Moodle", "Assignment 'Lab report 3' is due Thursday 23:59"), "2026-11-19"],
  ["school", "info", "none", n(["Classroom", "com.google.android.apps.classroom"], "Classroom", "Ms. Heba posted a new announcement in Science 2A"), null],
  ["government", "reminder", "renew", n(["Absher", "sa.gov.moi"], "Absher", "Your driving licence expires on 1 Dec. Renew it through Absher"), "2026-12-01"],
  ["government", "request", "submit", n(["UAE PASS", "ae.uaepass.mainapp"], "UAE PASS", "Please upload the missing documents for application 77612"), null],
  ["security", "alert", "verify", n(["Instagram", "com.instagram.android"], "Instagram", "We noticed a new login from Chrome on Windows. Was this you?"), null],
  ["code", "info", "none", n(SMS, "Talabat", "Your talabat verification code is 552901"), null],
  ["code", "info", "none", n(SMS, "VF-Cash", "كود التفعيل 7731. لا تشاركه مع أحد"), null],
  ["promo", "offer", "none", n(["H&M", "com.hm.goe"], "H&M", "Members: extra 20% off everything this weekend"), null],
  ["promo", "offer", "none", n(["Careem", "com.careem.acma"], "Careem", "خصم 30% على 3 مشاوير الأسبوع ده 🚗"), null],
  ["news", "info", "read", n(["Al Jazeera", "net.aljazeera.english"], "Al Jazeera", "Breaking: Ceasefire talks resume in Doha"), null],
  ["news", "info", "read", n(TG, "قناة أخبار القاهرة", "عاجل: غلق محور 26 يوليو لأعمال صيانة الليلة"), null],
  ["social", "info", "none", n(["Facebook", "com.facebook.katana"], "Facebook", "Mona commented on your post: 'Congrats!!'"), null],
  ["media", "info", "none", n(["Netflix", "com.netflix.mediaclient"], "Netflix", "New season of The Crown is now available"), null],
  ["game", "info", "none", n(["PUBG MOBILE", "com.tencent.ig"], "PUBG MOBILE", "Your friend is online. Jump in!"), null],
  ["system", "alert", "none", n(["Android System", "android"], "Battery", "Battery low: 12% remaining"), null],
  ["smart_home", "alert", "check", n(["Ring", "com.ringapp"], "Ring", "Someone is at your Front Door"), null],
  ["weather", "info", "none", n(["AccuWeather", "com.accuweather.android"], "AccuWeather", "Thunderstorms expected after 6 PM in Giza"), null],
  ["sports", "info", "none", n(["Kooora", "com.kooora.app"], "Kooora", "نهاية المباراة: مصر 2-1 المغرب"), null],
  ["markets", "info", "none", n(["Thndr", "com.thndr.app"], "Thndr", "COMI is down 3.2% today at EGP 82.10"), null],
  ["job", "invite", "reply", n(["LinkedIn", "com.linkedin.android"], "LinkedIn", "You're invited to interview with Valeo on 20 Nov at 10:00"), "2026-11-20"],
  ["marketplace", "question", "reply", n(["Dubizzle", "com.dubizzle.horizontal"], "Dubizzle", "Omar: Is the price negotiable?"), null],
  ["charity", "confirm", "none", n(["Resala", "org.resala.app"], "Resala", "Thank you, your donation of 300 EGP was received successfully"), null, 300],
  ["email", "question", "reply", n(GM, "Hany Fouad", "Do you have time on Thursday to discuss the contract?"), null],
  ["chat", "request", "do", n(WA, "Selin", "Yarın gelirken ekmek alır mısın?"), null],
  ["chat", "request", "do", n(WA, "Budi", "Tolong belikan obat untuk ibu besok"), null],
  ["chat", "question", "reply", n(WA, "Giulia", "A che ora arrivi domani?"), null],
  ["delivery", "info", "none", n(["Trendyol", "com.trendyol.android"], "Trendyol", "Siparişiniz kargoya verildi"), null],
  ["bill", "reminder", "pay", n(["DEWA", "ae.gov.dewa.dewaApp"], "DEWA", "Your DEWA bill of AED 642.30 is due on 1 Dec"), "2026-12-01", 642.3],
];
export function run() {
  let sure = 0, sureRight = 0, right = 0; const miss = [];
  for (const [cat, intent, action, nn, due, amount] of HELD) {
    const m = M.comprehend(nn, { now: NOW }), why = [];
    if (m.cat !== cat) why.push("cat " + m.cat + "≠" + cat); if (m.intent !== intent) why.push("intent " + m.intent + "≠" + intent); if (m.action !== action) why.push("action " + m.action + "≠" + action);
    if (due && (!m.due || m.due.date !== due)) why.push("due " + (m.due && m.due.date) + "≠" + due); if (amount && (!m.amount || Math.abs(m.amount.value - amount) > 0.01)) why.push("amount " + (m.amount && m.amount.value) + "≠" + amount);
    if (!why.length) right++; if (m.sure) { sure++; if (!why.length) sureRight++; } if (why.length) miss.push((m.sure ? "SURE " : "unsure ") + why.join(", ") + " · " + nn.title + ": " + nn.text);
  }
  return { n: HELD.length, right, sure, sureRight, miss };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) { const r = run();
  for (const m of r.miss) console.log("  " + m); console.log(`held-out: ${r.right}/${r.n} all right · code sure of ${r.sure} · right when sure ${r.sureRight}/${r.sure}`); }
