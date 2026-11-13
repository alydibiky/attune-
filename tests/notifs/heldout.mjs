// v9.9.17 the HELD-OUT check: notifications written AFTER the rules were fixed on the 10,000 run, in wordings the generator does not
// use — so this score is the honest one (the 10,000 run is what the rules were tuned on). Nothing here may be "fixed" by adding its
// exact sentence to a rule; a miss is fixed by its class, and new misses from Ali's phone are added here.
//   node tests/notifs/heldout.mjs        → score + every miss
import { act, setCountry } from "./brain.mjs";
const NOW = Date.parse("2026-11-10T15:00:00");
const SMS = ["Messages", "com.google.android.apps.messaging"], GM = ["Gmail", "com.google.android.gm"], WA = ["WhatsApp", "com.whatsapp"];
let id = 0; const N = ([app, pkg], title, text) => ({ id: "h" + (++id), app, pkg, title, text, ts: NOW });
// [what must happen, notification, amount, direction]
export const HELD = [
  // ---- real payments, other wordings
  ["money", N(SMS, "CIB", "Kindly note that EGP 1,430.00 was deducted from your account ending 2231 for a purchase at RADIO SHACK"), 1430, "out"],
  ["money", N(SMS, "NBE", "عملية سحب نقدي بمبلغ 2000 جنيه من حسابك ****8891. الرصيد 15,340 جنيه"), 2000, "out"],
  ["money", N(SMS, "QNB", "Your salary has been transferred. EGP 18,750.00 credited to A/C **4410"), 18750, "in"],
  ["money", N(["InstaPay", "com.egyptianbanks.instapay"], "InstaPay", "تم استلام تحويل بمبلغ 750 جنيه من MOHAMED SAYED"), 750, "in"],
  ["money", N(SMS, "HSBC", "HSBC: You spent EGP 312.40 at GOURMET EGYPT on 09NOV. Card ending 0098"), 312.4, "out"],
  ["money", N(SMS, "BanqueMisr", "تمت عملية شراء بمبلغ 95.50 جنيه لدى مترو ماركت ببطاقتك 4455"), 95.5, "out"],
  ["money", N(["Telda", "com.telda.app"], "Telda", "You paid EGP 260 at Cilantro ☕"), 260, "out"],
  ["money", N(SMS, "ALEXBANK", "Cheque deposit of EGP 12,000.00 has been credited to your account"), 12000, "in"],
  ["money", N(SMS, "VF-Cash", "تم سحب 300 جنيه من محفظتك من ماكينة ATM. رصيدك 1,205 جنيه"), 300, "out"],
  ["money", N(["Revolut", "com.revolut.revolut"], "Revolut", "You spent €23.40 at Lidl"), 23.4, "out", "de"],
  ["money", N(["Monzo", "co.uk.getmondo"], "Monzo", "💸 £8.50 at Pret A Manger"), 8.5, "out", "gb"],
  ["money", N(SMS, "AlRajhiBank", "PoS Purchase\nBy: 4321;mada\nAmount: SAR 78.25\nAt: TAMIMI MARKETS"), 78.25, "out", "sa"],
  // ---- look like payments, are not
  ["nomoney", N(SMS, "CIB", "Never share your OTP 882134. CIB will never ask for it. Purchase EGP 2,300.00 at SAMSUNG STORE")],
  ["nomoney", N(SMS, "NBE", "عزيزي العميل، لم تتم عملية الشراء بمبلغ 640 جنيه لدى H&M. برجاء المحاولة مرة اخرى")],
  ["nomoney", N(SMS, "QNB", "Your card payment of EGP 4,500 is due on 28 Nov. Pay on time to avoid late fees")],
  ["nomoney", N(SMS, "HSBC", "Your request to transfer EGP 9,000 is being reviewed. We will notify you once it is processed")],
  ["nomoney", N(SMS, "ADIB", "Your account balance fell below EGP 1,000")],
  ["nomoney", N(SMS, "CIB", "A direct debit of EGP 1,150 to Vodafone is scheduled for 1 Dec")],
  ["nomoney", N(["Fawry", "com.fawry.myfawry"], "myFawry", "Your electricity bill is ready: EGP 512. Tap to pay")],
  ["nomoney", N(GM, "Netflix", "We're having trouble with your current billing information. We'll try again, but please update your details. Your plan: EGP 165/month")],
  ["nomoney", N(GM, "Amazon.eg", "Your refund of EGP 899 is being processed and will be credited within 7 business days")],
  ["nomoney", N(SMS, "+201129938471", "I transferred you EGP 5,000 by mistake please send it back to this number")],
  ["nomoney", N(SMS, "Vodafone", "رصيدك اوشك على الانتهاء. اشحن بـ 50 جنيه واحصل على 500 ميجا هدية")],
  ["nomoney", N(GM, "Booking.com", "Still thinking about Dahab? Prices from EGP 1,450 per night")],
  ["nomoney", N(["Careem", "com.careem.acma"], "Careem", "Your captain is on the way. Estimated fare EGP 74–92")],
  ["nomoney", N(SMS, "Etisalat", "فاتورة شهر نوفمبر صدرت بقيمة 410 جنيه. اخر موعد للدفع 25/11")],
  ["nomoney", N(GM, "Glassdoor", "Senior accountant salaries in Cairo: EGP 22,000 – 31,000 per month")],
  ["nomoney", N(["Thndr", "com.thndr.app"], "Thndr", "Your order to buy 10 COMI at EGP 82.40 is pending")],
  ["nomoney", N(SMS, "DHL", "Import duties of EGP 380 are payable on delivery of your shipment 4417723")],
  ["nomoney", N(["YouTube", "com.google.android.youtube"], "Dave Ramsey", "She paid $60,000 for a car she can't afford")],
  // ---- receipts and subscriptions
  ["paid", N(GM, "Uber Eats", "Thanks for ordering. Your total was EGP 318.00, charged to Mastercard ••1123"), 318],
  ["paid", N(GM, "Google Play", "Order receipt: Minecraft — EGP 349.99. Payment method: Visa-4411. You've been charged"), 349.99],
  ["paid", N(GM, "Zara", "Thank you for your purchase. Order No. 5512098. Total paid EGP 2,390.00"), 2390],
  ["sub", N(GM, "Spotify", "Your Spotify Premium payment went through — EGP 69.99 was charged to your card ending 4411"), 69.99, "Spotify"],
  ["sub", N(GM, "Google Play", "Your subscription to Google One has been renewed. You were charged EGP 49.99"), 49.99, "Google Gemini"],
  // ---- everything else
  ["followup", N(["Amazon Shopping", "com.amazon.mShop.android.shopping"], "Your package", "Your order is expected Friday. We'll let you know when it's out for delivery")],
  ["delivered", N(["Jumia", "com.jumia.android"], "Jumia", "Your package has been delivered. Enjoy!")],
  ["todo", N(WA, "Hany Work", "could you bring the signed contract tomorrow?")],
  ["todo", N(WA, "Mama", "متنساش تجيب الدوا وانت راجع")],
  ["callback", N(WA, "Dr Sherif", "Missed voice call")],
  ["quiet", N(WA, "Karim", "haha ok see you tonight")],
  ["quiet", N(WA, "Family: Baba", "وصلنا الحمد لله")],
  ["quiet", N(["Telegram", "org.telegram.messenger"], "Omar", "I'll send it tomorrow don't worry")],
  ["ask", N(WA, "Tarek", "I owe you 350 EGP for yesterday")],
  ["ask", N(WA, "حسابات المحل: Samy", "الايراد النهارده 14,300 جنيه")],
  ["quiet", N(["Google", "com.google.android.googlequicksearchbox"], "Weather", "Rain expected tomorrow in Cairo, 19°")],
  ["quiet", N(["Duolingo", "com.duolingo"], "Duolingo", "You're on a 45 day streak! Keep it going")],
  ["quiet", N(["LinkedIn", "com.linkedin.android"], "LinkedIn", "Sara and 12 others viewed your profile")],
  ["quiet", N(["Shazam", "com.shazam.android"], "Shazam", "Your song of the week is ready")],
  ["quiet", N(["Microsoft Teams", "com.microsoft.teams"], "Standup", "Meeting started")],
  ["nomoney", N(["Facebook", "com.facebook.katana"], "Marketplace", "Mona is selling a sofa for EGP 6,500 near you")],
  ["nomoney", N(SMS, "TAX-EG", "Your VAT return for October shows EGP 3,420 payable. Submit before 30 Nov")],
  ["nomoney", N(SMS, "+966512345678", "Your ATM card is blocked. Call this number to reactivate and avoid a SAR 500 fee")],
  ["nomoney", N(GM, "PayPal", "Reminder: you have an unpaid invoice of $45.00 from Design Studio")],
  ["nomoney", N(["Binance", "com.binance.dev"], "Binance", "Price alert: ETH reached $3,900")],
  ["nomoney", N(["Vezeeta", "com.vezeeta.patients.app"], "Vezeeta", "Rate your visit to Dr Amal. Consultation fee was EGP 400")],
  ["nomoney", N(SMS, "CIB", "You can now pay your EGP 2,150 minimum due in installments. Call 19666")],
  ["nomoney", N(GM, "Airbnb", "Your payout of $320 is on its way and should arrive in 3-5 days")],
  ["nomoney", N(SMS, "WE", "تم تجديد باقتك بنجاح. المتبقي 140 جيجا حتى 10/12")],
  ["nomoney", N(["Talabat", "com.talabat"], "talabat", "Your refund request for EGP 85 was received. We'll get back to you")],
];
const near = (x, y) => Math.abs((x || 0) - (y || 0)) < 0.006;
let right = 0; const wrong = [];
for (const [want, n, a, x, cc] of HELD) { setCountry(typeof cc === "string" ? cc : want === "money" && ["de", "gb", "sa"].includes(x) ? x : (HELD.find((h) => h[1] === n)[4] || "eg"));
  const g = act(n), moneyish = !!g.money || ["subscription", "expense", "income"].includes(g.card) || g.ask === "paid", card = g.card && g.card !== "delivered" ? g.card : "";
  const why = want === "money" ? (!g.money ? "not read" : !near(g.money.amount, a) ? "amount " + g.money.amount : g.money.dir !== x ? "direction " + g.money.dir : "")
    : want === "paid" ? ((g.money && near(g.money.amount, a) && g.money.dir === "out") || (g.ask === "paid" && near(g.askAmount, a)) || (g.card && near(g.cardAmount, a)) ? "" : "receipt missed / wrong amount")
    : want === "sub" ? (g.card === "subscription" && g.cardTitle === x && near(g.cardAmount, a) ? "" : "no subscription card (" + (g.card || "-") + " " + g.cardTitle + " " + g.cardAmount + ")")
    : want === "nomoney" ? (moneyish ? "became money" : "") : want === "ask" ? (g.money ? "became money" : g.ask ? "asked about chat talk (v9.9.30: never)" : "")
    : want === "quiet" ? (moneyish ? "became money" : card ? "made a " + card + " card" : g.ask ? "asked" : "") : g.card === want ? "" : "no " + want + " (" + (g.card || "nothing") + ")";
  if (!why) right++; else wrong.push(`${want}: ${why} · ${n.app} · ${n.title}: ${n.text.replace(/\n/g, " ⏎ ").slice(0, 90)}`); }
for (const w of wrong) console.log("  miss — " + w);
console.log(`held-out: ${right} of ${HELD.length} right (${(100 * right / HELD.length).toFixed(1)}%)`);
export const score = right / HELD.length;
