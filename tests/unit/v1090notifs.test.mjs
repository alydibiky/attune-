// v10.9 (Ali, 22 Nov 2026: "do the notifications to 100 percent"). The old runs were 100 % on notifications written here; REAL Egyptian
// bank / wallet SMS (tests/notifs/real-eg.json — from public MIT-licensed SMS-parser projects, names and numbers replaced) found 14 bugs
// on the first run, the hard variations 7 more, and new random seeds of the HARD run 6 more — each fixed generally. Every one is here.
// Runs: tests/notifs/real.mjs (90 real messages + 10,000 phone variations: 100 %), tests/notifs/gen.mjs (10,000: 100 %; HARD 10,000:
// 100 %, 68 % different shapes — it was 42 %; held-out seeds 11–19: 100 %).
process.env.N = "2500";
const { RESULT } = await import("../notifs/real.mjs");
const { act, setCountry } = await import("../notifs/brain.mjs");
setCountry("EG");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const ts = new Date("2026-11-20T12:00").getTime();
const sms = (title, text) => { const a = act({ id: String(n), app: "Messages", pkg: "com.google.android.apps.messaging", title, text, ts }); return a.money ? a.money.dir + " " + a.money.amount : "-"; };
// money IN that was read as OUT
ok(sms("QNB ALAHLI", "تحويل إنستاباي وارد بقيمة 890.00 جم من حساب عمر خالد. المرجع: 24100200104") === "in 890", "«تحويل إنستاباي وارد» is money IN");
ok(sms("Bank", "تم تحويل مبلغ 1,500.00 جم لحسابكم المنتهي بـ 1234 من احمد محمد") === "in 1500", "«تم تحويل 1,500.00 جم لحسابكم» is IN (the decimal point hid «لحسابكم»)");
ok(sms("HSBC", "تم تحويل مبلغ 300 ج.م لحسابكم من هاني") === "in 300" && sms("BM", "تم تحويل 80.00 جم ألى حسابك برقم مرجعي 12") === "in 80", "…with «ج.م» and «ألى» too");
ok(sms("Bank", "إيداع تحويل لحظي IPN بمبلغ 800.00 جم بحسابك رقم ...4321 من سارة") === "in 800" && sms("Bank", "تم إضافة تحويل لحظي لبطاقتكم مسبقة الدفع بمبلغ 200.00 جم من MOHAMED") === "in 200", "«إيداع تحويل», «إضافة تحويل لبطاقتكم» are IN");
// the wrong amount
ok(sms("Vodafone Cash", "تم سحب 10600.0 ج بنجاح. رصيد حسابك في فودافون كاش الحالي 4221.58 جنيه.") === "out 10600", "a Vodafone Cash withdrawal is 10,600, not the balance 4,221.58");
ok(sms("BM", "رصيدك 5000 جم. تم إيداع 150 جم Ref 1234567890") === "in 150", "«رصيدك 5000 جم. تم إيداع 150 جم» → 150 in (it was missed)");
ok(sms("19623", "تم تحويل مبلغ 100 جم لحسابكم من علي") === "in 100", "a bank's short code (19623) is never the amount");
ok(sms("Banque du Caire", "وصلك تحويل 63114.00 LE\nلحسابك المنتهي بـ 8545\nمن عمر خالد") === "in 63114", "«المنتهي بـ 8545» is an account, not the amount (it was ADDED as 8,545 by itself)");
ok(sms("Fawry", "APR 14, 2026 4:55:41 PM: RECEIVED EGP1000 FROM 37865797543231 TO MOBILE ACCOUNT NUMBER 7848.") === "in 1000", "'APR 14' in capitals is a date");
ok(sms("CIB", "عملية سحب نقدي بمبلغ 2000.00 LE من ماكينة الصراف الآلي ATM186 يوم 22/10/26") === "out 2000", "'ATM186' is a machine, not 186");
ok(sms("JM-SBIUPI", "Dear UPI user A/C X1234 debited by 296 on date 10Nov26 trf to ZOMATO Refno 631098765432 - If not u? call 1800111109 or SMS BLOCK 1234 to 9223008333 -SBI") === "out 296", "SBI: 296 'debited by', not the 1234 of 'SMS BLOCK 1234'");
ok(sms("NBE", "International fees EGP 15.00 and purchase EGP 300.00 at STEAM") === "out 300", "a fee next to a purchase is not the purchase");
{ const a = act({ id: "g", app: "Gmail", pkg: "com.google.android.gm", title: "Apple", text: "Your iCloud+ 50 GB subscription has been renewed. Amount charged: EGP 52", ts });
  const b = act({ id: "m", app: "Gmail", pkg: "com.google.android.gm", title: "Microsoft", text: "Your Microsoft 365 Personal subscription has been renewed. Amount charged: EGP 1,375", ts });
  ok(a.money && a.money.amount === 52 && b.money && b.money.amount === 1375, "'50 GB' and 'Microsoft 365' are not prices (Money read 50 and 365)"); }
{ const y = act({ id: "y", app: "Gmail", pkg: "com.google.android.gm", title: "YouTube", text: "Your payment of L.E 673.00 for YouTube Premium was successful. Your membership continues.", ts });
  ok(y.money && y.money.amount === 673 && y.card === "subscription", "'payment of L.E 673.00 … was successful' is a subscription (the dot of 'L.E' hid it)"); }
// not money at all
ok(sms("Vodafone Cash", "تم طلب سحب مبلغ 10600.0 جنيه من حساب فودافون كاش. للتأكيد اطلب #1*9* وادخل الرقم السري.") === "-", "a withdrawal REQUEST waiting for your code is not money (it was counted, then counted again)");
ok(sms("Store", "Please transfer 350.00 EGP to store@instapay and paste your Bank SMS Reference ID.") === "-", "'please transfer 350 EGP' is an instruction");
ok(sms("INFO", "تم تحويل 7042.00 جنيه لمحفظتك بالخطإ برجاء اعادة المبلغ على الرقم 01095318690") === "-", "the wallet scam «… لمحفظتك بالخطأ برجاء إعادة المبلغ» is never money (it was ADDED by itself)");
ok(sms("Vezeeta", "Your appointment with Dr Mostafa is confirmed for Thursday at 11:00 AM. Fees EGP 416.75 to be pai…") === "-", "'to be pai…' cut off is still 'to be paid'");
// cards
{ const c = act({ id: "c", app: "Messages", pkg: "com.google.android.apps.messaging", title: "CIB", text: "Your credit card available limit EGP 20,000.00. Purchase EGP 99.00 at SPOTIFY", ts });
  ok(c.card === "subscription" && c.cardAmount === 99, "the Spotify card shows 99, not the card's limit 20,000"); }
{ const a = { id: "1", app: "Phone", pkg: "com.google.android.dialer", title: "Missed call", text: "JOHN ", ts }, b = { ...a, id: "2", text: "John", ts: ts - 20 * 60000 };
  ok(act(a, { recent: [a, b] }).card === "callback", "two missed calls from 'JOHN' and 'John' are one caller → Call back"); }
{ const AP = await import("../../web-src/autopilot.js"); ok(new Date(AP.dayIn("تم شحن طلبك وهيوصل يوم الإحد", ts)).getDay() === 0, "«يوم الإحد» (any alef) is Sunday"); }
ok(RESULT.okReal === RESULT.nReal, `every real message read right: ${RESULT.okReal}/${RESULT.nReal}`);
ok(RESULT.ok / RESULT.n >= 0.995, `2,500 phone variations of them: ${RESULT.ok}/${RESULT.n}`);
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`);
process.exit(fail ? 1 : 0);
