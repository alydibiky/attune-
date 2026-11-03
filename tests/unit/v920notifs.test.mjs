// v9.0 (Ali: "make sure the notifications reading is working"): what the phone's notifications become — a payment in Money,
// a date in Dates, or nothing. Chats that mention money, offers, shipping notices and reminders are never payments.
import { readNotification } from "../../web-src/paylog.js";
import { fromNotifications } from "../../web-src/deadlines.js";
let bad = 0; const ok = (c, m, x) => { if (!c) { bad++; console.log("FAIL " + m + (x !== undefined ? "  " + JSON.stringify(x) : "")); } };
const now = Date.parse("2026-11-03T10:00:00"), N = (app, text) => ({ id: app + text.length, app, title: app, text, ts: now });
const pay = (app, text) => readNotification(N(app, text));
let e = pay("Vodafone Cash", "استلمت 300 ج.م من 01098765432. رصيدك 1,200 ج.م"); ok(e && e.direction === "in" && e.amount === 300, "Vodafone Cash «استلمت 300 ج.م … رصيدك» → +300 (not a balance)", e);
e = pay("Uber", "Thanks for riding with Ahmed. Your trip total: EGP 85.40"); ok(e && e.direction === "out" && e.amount === 85.4, "Uber receipt → −85.40", e);
e = pay("Fawry", "تم دفع فاتورة كهرباء بمبلغ 650 جنيه بنجاح. رقم العملية 123"); ok(e && e.direction === "out" && e.amount === 650, "Fawry electricity → −650", e);
e = pay("InstaPay", "Transfer of EGP 2,000.00 to MOM completed. Ref 998877"); ok(e && e.amount === 2000 && e.direction === "out", "InstaPay transfer → −2,000", e);
for (const [app, t] of [["WhatsApp", "I will send you 500 tomorrow inshallah"], ["WhatsApp", "بكرة هبعتلك ال 2000"], ["Talabat", "Get EGP 100 cashback on your next order!"],
  ["Amazon.eg", "Your order of HUAWEI FreeClip 2 (EGP 7,950) has shipped"], ["valU", "Your installment of EGP 1,500 is due on 10 Nov"], ["CIB", "Your bill of EGP 450 is due on 10/11/2026"],
  ["Netflix", "Your Netflix membership renews on 15 Nov for EGP 250"], ["Telegram", "مين عنده 500 فكة؟"], ["CIB", "Your OTP is 482913. Do not share it."], ["CIB", "Your available balance is EGP 48,250.00"]])
  ok(!pay(app, t), `not a payment: ${app} "${t}"`);
const D = fromNotifications([N("valU", "Your installment of EGP 1,500 is due on 10 Nov"), N("Netflix", "Your Netflix membership renews on 15 Nov for EGP 250"),
  N("Spotify", "Your free trial ends on 20 November. You will be charged EGP 60"), N("WE", "فاتورة الإنترنت 450 جنيه مستحقة يوم 15 نوفمبر"), N("WhatsApp", "see you on 10 Nov")], [], { now, home: "EGP", order: "dmy" });
ok(D.length === 4, "4 dates from 5 notifications (a chat's 'see you on 10 Nov' is not one)", D.map((d) => d.title));
ok(D.some((d) => d.kind === "trial" && d.date === "2026-11-20" && d.amount === 60) && D.some((d) => d.kind === "renewal" && d.date === "2026-11-15" && d.amount === 250), "the Spotify trial and the Netflix renewal, with dates and amounts");
ok(D.every((d) => d.title), "every date has a name (the Arabic internet bill too)", D.map((d) => d.title));
console.log(bad ? bad + " FAILED" : "PASS v920notifs: notifications become the right payment, the right date, or nothing");
