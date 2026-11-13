// v9.9.30 HELD-OUT for "really smart, not keep asking" (Ali, 13 Nov 2026) — written AFTER the fix, in wordings neither the 10,000 run
// nor heldout.mjs use. Each notification says what a smart assistant does with it:
//   alone  → done by itself (into Money, or a follow-up / bill / call back / to-do) — never a question, never a card that waits
//   quiet  → nothing: no money, no card, no question (news, offers, future charges, failed payments, chat talk, prices, codes…)
// A miss is fixed by its class, never by adding the exact sentence to a rule.   node tests/notifs/heldout2.mjs
import { act, setCountry } from "./brain.mjs";
const NOW = Date.parse("2026-11-13T18:00:00");
const SMS = ["Messages", "com.google.android.apps.messaging"], GM = ["Gmail", "com.google.android.gm"], WA = ["WhatsApp", "com.whatsapp"], TG = ["Telegram", "org.telegram.messenger"];
let id = 0; const N = ([app, pkg], title, text) => ({ id: "z" + (++id), app, pkg, title, text, ts: NOW });
export const HELD2 = [
  // ---- done by itself: bank / wallet money in their own words about YOUR account
  ["alone", N(SMS, "NBE", "تم خصم 1,250.00 ج.م من حسابك رقم ***4471 لصالح فودافون")],
  ["alone", N(SMS, "CIB", "Dear client, EGP 3,400.00 was withdrawn from your account ending 7781 via ATM on 13/11")],
  ["alone", N(SMS, "QNB", "Your account ending 2210 has been credited with EGP 42,500.00 (Payroll)")],
  ["alone", N(SMS, "AlRajhiBank", "شراء عبر نقاط البيع بطاقة: 5521* مبلغ: 145 SAR لدى: بنده في: 13/11 19:02")],
  ["alone", N(SMS, "Emirates NBD", "AED 260.00 has been debited from your card ending 3341 at CARREFOUR MOE")],
  ["alone", N(["Vodafone Cash", "com.vodafone.vfcash"], "Vodafone Cash", "تم تحويل 500 جنيه من محفظتك إلى 01012345678")],
  // ---- done by itself: a shop's / an app's receipt
  ["alone", N(GM, "Uber Receipts", "Thanks for riding with Uber. Total charged EGP 187.50 to Visa •••• 4471")],
  ["alone", N(GM, "Apple", "Your receipt from Apple. You paid USD 9.99 for iCloud+ 200 GB")],
  ["alone", N(GM, "Noon", "Payment successful! We received your payment of EGP 2,349 for order N-55120")],
  ["alone", N(GM, "Talabat", "Receipt: Your order from Zooba is paid. Total charged EGP 312.00")],
  // ---- done by itself: a delivery's day, a bill that is due, a call back, a request
  ["alone", N(["Amazon Shopping", "com.amazon.mShop.android.shopping"], "Amazon", "Your package with Anker charger is arriving tomorrow")],
  ["alone", N(["My Orange", "com.orange.myorange"], "Orange", "Your mobile bill of EGP 412.75 is due on 20 Nov")],
  ["alone", N(WA, "Mona", "ابعتلي صورة البطاقة بكرة الصبح لو سمحت")],
  // ---- quiet: never money, never a question, never a card
  ["quiet", N(TG, "أخبار مصر العاجلة", "ارتفاع سعر الدولار إلى 51.40 جنيه في البنوك اليوم")],
  ["quiet", N(TG, "قناة العقارات", "شقة 3 غرف في التجمع بـ 4,500,000 جنيه — للتواصل واتساب")],
  ["quiet", N(GM, "Netflix", "Your membership will renew on 20 Nov for EGP 240.00")],
  ["quiet", N(GM, "Spotify", "We couldn't charge your card for Premium (EGP 59.99). Please update your payment details")],
  ["quiet", N(SMS, "CIB", "Your OTP for the purchase of EGP 3,250.00 at NOON is 448812. Do not share it")],
  ["quiet", N(WA, "Ahmed Work", "the client paid 20,000 today, we'll split it next week")],
  ["quiet", N(WA, "Family 🏠", "Mama: العشا النهارده عليا، جبت لحمة بـ 900 جنيه")],
  ["quiet", N(GM, "Careem", "Ride with 20% off this weekend — up to EGP 50 discount")],
  ["quiet", N(["YouTube", "com.google.android.youtube"], "MrBeast", "I Spent $1,000,000 On This Island")],
  ["quiet", N(GM, "Booking.com", "Prices in Sharm El Sheikh from EGP 1,900 per night — book now")],
  ["quiet", N(SMS, "+201005551234", "مبروك ربحت 50,000 جنيه! اضغط على الرابط لاستلام الجائزة")],
  ["quiet", N(GM, "Vezeeta", "Your appointment with Dr Nour is confirmed for 15 Nov 6:00 PM. Fees EGP 600 at the clinic")],
  ["quiet", N(["inDrive", "sinet.startup.inDriver"], "inDrive", "A driver offered EGP 95 for your ride")],
  ["quiet", N(GM, "Landlord", "Just a reminder: from January the rent will be EGP 15,000 per month")],
  ["quiet", N(SMS, "NBE", "Your available balance is EGP 18,240.55 as of 13/11/2026")],
];
export function run() {
  const miss = [];
  for (const [want, n] of HELD2) { setCountry("eg"); const g = act(n, { recent: [n] });
    const card = g.card && g.card !== "delivered", alone = (g.money && g.money.auto) || (card && g.cardAuto), waits = card && !g.cardAuto && !(g.money && g.money.auto);
    const why = g.ask ? "asked a question" : waits ? "a " + g.card + " card waits for a tap" : want === "alone" ? (alone ? "" : "not done") : (g.money || card ? "made " + (g.money ? "money" : g.card) : "");
    if (why) miss.push(want + " — " + why + " · " + n.app + " · " + n.title + ": " + n.text); }
  return { right: HELD2.length - miss.length, n: HELD2.length, miss };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) { const r = run(); for (const m of r.miss) console.log("  miss — " + m); console.log("held-out 2: " + r.right + " of " + r.n + " right"); }
