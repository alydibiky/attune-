// v10.9.12 REPAIR P1 — one money core. The money audit of 28 Nov showed each money question decided in 4–8 places that disagreed; these
// are its bugs, each on the real message it was shown with, now decided by the shared modules (adverts.js, dedupe.js, paytext.js) —
// plus the 2,500 samples of the two new 10,000 HARD generators (tests/adverts/gen.mjs, tests/dedupe/gen.mjs).
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); }, removeItem(k) { delete this._[k]; } };
import { createRequire } from "module";
const { parsePayment } = createRequire(import.meta.url)("../../web-src/yusr/paytext.js");
const A = await import("../../web-src/adverts.js");
const D = await import("../../web-src/dedupe.js");
const P = await import("../../web-src/paylog.js");
const O = await import("../../web-src/overpay.js");
const G = await import("../../web-src/guardian.js");
const AP = await import("../../web-src/autopilot.js");
const NM = await import("../../web-src/notifmeaning.js");
const L = await import("../../web-src/yusr/logtext.js");
const AG = await import("../adverts/gen.mjs");
const DG = await import("../dedupe/gen.mjs");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const now = Date.parse("2026-11-28T12:00:00");
const note = (app, title, text, extra = {}) => ({ id: "n" + Math.random(), app, pkg: app.toLowerCase(), title, text, ts: now, ...extra });

// 1. adverts — ONE decision, every reader agrees
const ren = "تم تجديد باقتك بنجاح بقيمة 150 جنيه. استمتع بضعف الدقايق";
ok(!A.isAdvert(ren) && !!P.readNotification(note("Messages", "Vodafone", ren), { teach: [] }) && NM.understandNote(note("Messages", "Vodafone", ren)).kind !== "promo", "a Vodafone renewal with «استمتع بضعف الدقايق» is a payment in every reader");
const rc = "Your order total EGP 350.00 has been confirmed. Use code SAVE20 next time for 20% off";
ok(!A.isAdvert(rc) && (P.readNotification(note("Talabat", "Talabat", rc), { teach: [] }) || {}).amount === 350, "a receipt with a promo code is a payment of 350 (never the 20 of SAVE20 / 20%)");
for (const t of ["EGP 800 off your first order 🎉 Order now", "خصم 100 جنيه على أول طلب — اطلب دلوقتي", "Enjoy 50% cashback up to EGP 200 when you pay with your CIB card", "خصم 250 جنيه لما تدفع ببطاقتك — فرصة إخيرة!"])
  ok(A.isAdvert(t) && !P.readNotification(note("Talabat", "Talabat", t), { teach: [] }), "an advert is never money: " + t.slice(0, 40));
ok(!A.isAdvert("Upcoming price increase for your Google One subscription — will increase from EGP 500.00 to EGP 650.00 per month"), "a price-rise notice about YOUR plan is not an advert");
ok(!A.isAdvert("يرجى العلم انه خصم 18140.00 ج.م في 16 Nov لصالح كازيون بطاقة الخصم المباشر 1993*"), "an HSBC debit «خصم … لصالح كازيون» is not an advert");

// 2. amounts — a time, a percentage, a code, a credit limit, a year are never the amount
ok(parsePayment("on 15/11 at 1:23\n120 EGP was charged to your card", { home: "EGP" }).amount === 120, "a time before the amount: 120, never 23,120");
ok(parsePayment("Your card was charged EGP 150 at CARREFOUR. Invite a friend and get 20% off", { home: "EGP" }).amount === 150, "a percentage is never the amount");
ok(parsePayment("Your order total 450 LE has been confirmed.", { home: "EGP" }).amount === 450, "'order total 450 LE' is the amount, not an order number");
ok(parsePayment("ON 5 NOV 2026 | TRANSACTION APPROVED: LE 85 AT TALABAT | AVAILABLE BALANCE EGP 3,223", { home: "EGP" }).amount === 85, "a year after a month name is not the amount ('NOV' is no currency)");
ok(parsePayment("M-PESA: Confirmed. Ksh1,200.00 sent to JANE", { home: "KES" }).amount === 1200 && parsePayment("Kamu menerima Rp69.955 dari SITI", { home: "IDR" }).amount === 69955, "a currency glued to the number is still money (Ksh, Rp)");
const lim = O.readSource({ id: "l", kind: "notification", title: "CIB", text: "Purchase EGP 99.00 at SPOTIFY. Available limit EGP 20,000.00", at: now }, { now });
ok(lim.some((e) => e.type === "charge" && e.amount === 99), "the subscription check uses Money's amount reader: 99, never the 20,000 limit");

// 3. directions and payees
ok(parsePayment("Transaction approved: EGP 800.0 at ELEZABY PHARMACY", { home: "EGP" }).direction === "out" && parsePayment("Your bundle has been renewed for 295 EGP", { home: "EGP" }).direction === "out", "'Transaction approved' and 'renewed for' are money out");
ok(NM.understandNote(note("CIB", "CIB", "Your account was credited with EGP 5,000.00")).state === "money in", "notifmeaning says 'money in' again (the rule sat inside a comment)");
ok(parsePayment("تم تحويل 500 جنيه إلى حساب أحمد علي", { home: "EGP" }).party === "أحمد علي" && parsePayment("تم تحويل 500 جنيه إلى حسابك من أحمد علي", { home: "EGP" }).party === "أحمد علي", "the payee after «إلى حساب» and the payer after «حسابك من»");
ok(parsePayment("تم خصم 250 جنيه من حسابكم رقم 1234 عملية شراء من سعودي ماركت", { home: "EGP" }).party === "سعودي ماركت", "the shop after «عملية شراء من», never «حسابكم»");
ok(L.catOf("Your card was charged EGP 20.00 at ZYXSHOP") === "other" && L.catOf("spnt 200 on lunh") === "food", "'charged' is not a typo of 'charger'; 'lunh' still is lunch");

// 4. the same payment — dedupe.js
const t1 = note("InstaPay", "InstaPay", "تم تحويل 500 جنيه إلى حساب أحمد علي"), t2 = { ...note("InstaPay", "InstaPay", "تم تحويل 500 جنيه إلى حساب منى سمير"), ts: now + 5 * 60000 };
ok(P.inbox([t1, t2], [], { teach: [] }).length === 2, "two InstaPay transfers of 500 to two people stay two");
const c1 = { ...note("InstaPay", "InstaPay", "You sent EGP 20.00 to MONA ALI") }, c2 = { ...note("CIB", "CIB", "Your card was charged USD 20.00 at OPENAI"), ts: now + 120000 };
ok(P.inbox([c1, c2], [], { teach: [] }).length === 2, "EGP 20 and USD 20 two minutes apart are two payments");
ok(D.samePayment({ direction: "out", amount: 250, currency: "EGP", party: "سعودي ماركت", ts: now }, { type: "expense", amount: 250, note: "Seoudi · Cash", date: "2026-11-28" }, { byDay: true }), "the bank's Arabic SMS and the typed 'Seoudi' are ONE payment");
ok(!D.samePayee("Omar Hassan", "Ahmed Hassan") && !D.samePayee("Omar", "Amr") && !D.samePayee("Omar", "مروة") && D.samePayee("El Ezaby", "العزبي"), "payee names: a shared family name is not the same person; Omar ≠ Amr ≠ «مروة»; «العزبي» = El Ezaby");
const led = { currency: "EGP", accounts: [{ id: "a", currency: "EGP" }], txns: [
  { id: "x", type: "expense", amount: 500, account: "a", date: "2026-11-28", note: "أحمد علي · InstaPay", created: now, source: "notification" },
  { id: "y", type: "expense", amount: 500, account: "a", date: "2026-11-28", note: "منى سمير · InstaPay", created: now + 300000, source: "notification" }] };
ok(!G.findings({ ledger: led, life: null, now }).some((f) => f.kind === "double"), "two transfers to two people are never 'charged twice'");

// 5. dollars stay dollars through Autopilot
const st = AP.suggestFrom(note("Steam", "Steam", "Thanks for your purchase! You paid $9.99 for Hollow Knight. Receipt #12345"), { now });
const acts = st ? AP.actionsFor(st) : [];
ok(!st || (acts[0] && acts[0].items && acts[0].items[0].currency === "USD"), "an Autopilot money card carries its currency ($9.99 → USD): " + JSON.stringify(st && [st.kind, st.cur]));

// 6. the two 10,000 generators: 2,500 samples
{ const cs = AG.gen(5, 2500); let g = 0; for (const c of cs) if (!AG.check(c).length) g++; ok(g / cs.length >= 0.995, `adverts: 2,500 HARD composed notifications, every reader agrees: ${(g / cs.length * 100).toFixed(2)} %`); }
{ const cs = DG.gen(5, 2500); let g = 0; for (const c of cs) if (DG.check(c)) g++; ok(g / cs.length >= 0.995, `the same payment: 2,500 HARD pairs: ${(g / cs.length * 100).toFixed(2)} %`); }
console.log(fail ? fail + " FAILED" : "ALL PASSED"); process.exit(fail ? 1 : 0);
