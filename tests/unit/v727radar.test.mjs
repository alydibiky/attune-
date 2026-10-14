// v6.27 Deadline Radar (deadlines.js) — trials, renewals, returns, warranties and documents, read by code in many
// languages, from notifications, receipt text and typed sentences; the store, the reminders, the "saved" amount.
import * as R from "../../web-src/deadlines.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
const now = new Date("2026-10-14T10:00:00").getTime();
const one = (t, exp, o = {}) => {
  const all = R.readDeadlines(t, { now, home: "USD", ...o });
  const r = all.find((x) => x.kind === exp.kind) || {};
  const miss = Object.entries(exp).filter(([k, v]) => JSON.stringify(r[k]) !== JSON.stringify(v));
  ok(!miss.length, `${t.replace(/\n/g, " / ").slice(0, 80)} → ${JSON.stringify(all.map((x) => ({ kind: x.kind, title: x.title, date: x.date, amount: x.amount, currency: x.currency, doc: x.doc })))}`);
};
// trials and renewals (notifications / emails)
one("Your Spotify Premium free trial ends on Nov 20, 2026. After that you'll be charged $11.99/month.", { kind: "trial", title: "Spotify", date: "2026-11-20", amount: 11.99, currency: "USD" });
one("Start your 7-day free trial of Duolingo", { kind: "trial", title: "Duolingo", date: "2026-10-21" });
one("Netflix: your membership will renew on 12/11/2026 for 549 THB", { kind: "renewal", title: "Netflix", date: "2026-11-12", amount: 549, currency: "THB" });
one("Tu prueba gratuita de Disney+ termina el 3 de noviembre de 2026", { kind: "trial", title: "Disney+", date: "2026-11-03" });
one("Votre abonnement Canal+ se renouvelle le 15 novembre 2026 pour 24,99 €", { kind: "renewal", date: "2026-11-15", amount: 24.99, currency: "EUR" });
one("Ihr kostenloser Probemonat für Audible endet am 01.11.2026", { kind: "trial", title: "Audible", date: "2026-11-01" });
one("Your free trial ends 11/05/2026", { kind: "trial", date: "2026-11-05" }, { order: "mdy" });
one("تنتهي الفترة التجريبية المجانية لشاهد في 25 أكتوبر 2026 وسيتم خصم 99 جنيه", { kind: "trial", date: "2026-10-25", amount: 99, currency: "EGP" });
// receipts (the text read from a photo)
one("MEDIA MARKT\nSamsung 55\" QLED TV\nDatum: 14.10.2026\nSumme 699,00 €\nRückgabe innerhalb von 30 Tagen\n2 Jahre Garantie", { kind: "return", date: "2026-11-13", amount: 699, currency: "EUR" });
one("MEDIA MARKT\nSamsung 55\" QLED TV\nDatum: 14.10.2026\nSumme 699,00 €\nRückgabe innerhalb von 30 Tagen\n2 Jahre Garantie", { kind: "warranty", title: "Samsung 55\" QLED TV", date: "2028-10-14" });
one("BEST BUY\nApple AirPods Pro\nDate 10/02/2026\nTotal $249.00\nReturn by 11/01/2026", { kind: "return", title: "Apple AirPods Pro", date: "2026-11-01", amount: 249 }, { order: "mdy" });
one("فاتورة\nثلاجة شارب 18 قدم\nالتاريخ 2026-10-14\nالإجمالي 25,000 جنيه\nضمان سنتين", { kind: "warranty", title: "ثلاجة شارب 18 قدم", date: "2028-10-14", amount: 25000, currency: "EGP" });
one("Amazon.in order: boAt Rockerz headphones ₹1,499. Return window closes on 24 Oct 2026", { kind: "return", date: "2026-10-24", amount: 1499, currency: "INR" });
// documents and cards
one("PASSPORT\nSurname SMITH\nDate of issue 05/03/2020\nDate of expiry 04/03/2030", { kind: "expiry", doc: "passport", title: "Passport", date: "2030-03-04" });
one("Your car insurance policy expires on 1 December 2026", { kind: "expiry", doc: "insurance", date: "2026-12-01" });
one("VISA •••• 1234 VALID THRU 03/27", { kind: "expiry", doc: "card", date: "2027-03-31" });
one("Führerschein gültig bis 15.06.2027", { kind: "expiry", doc: "licence", date: "2027-06-15" });
one("رخصة القيادة تنتهي في 2027-01-20", { kind: "expiry", doc: "licence", date: "2027-01-20" });
// not deadlines
for (const t of ["Meet me on 12 November at 5", "I paid 200 EGP for lunch", "Happy birthday! 🎉", "The meeting is moved to 20/11/2026"]) ok(!R.readDeadlines(t, { now }).length, "nothing in «" + t + "»");
// durations and dates
ok(R.durationIn("30-day returns") === 30 && R.durationIn("2-year warranty") === 730 && R.durationIn("garantía de 2 años") === 730 && R.durationIn("ضمان سنتين") === 730 && R.durationIn("14 días") === 14 && R.durationIn("one month free") === 30, "durations: 30-day · 2-year · 2 años · سنتين · 14 días · one month");
ok(R.datesIn("Nov 20", { now }).map((d) => R.isoDay(d.t))[0] === "2026-11-20" && R.datesIn("20 Feb", { now }).map((d) => R.isoDay(d.t))[0] === "2027-02-20", "a day and month without a year → the next one");
// Chat
ok(R.chatDeadlineIntent("my netflix trial ends on 20 november", { now }).kind === "trial", "Chat: «my netflix trial ends on 20 november» → watch it");
ok(!R.chatDeadlineIntent("when does my free trial end?", { now }) && !R.chatDeadlineIntent("explain what a warranty is", { now }), "Chat: questions stay in Chat");
// notifications
const q = [{ id: "n1", title: "Google Play", text: "Your free trial of YouTube Premium ends on 30 Oct 2026. You'll be charged EGP 79.99", ts: now }, { id: "n2", title: "CIB", text: "You paid 200 EGP at Carrefour", ts: now }];
const sug = R.fromNotifications(q, [], { now, home: "EGP" });
ok(sug.length === 1 && sug[0].nid === "n1" && sug[0].title === "YouTube Premium" && sug[0].date === "2026-10-30" && sug[0].amount === 79.99, "notifications: the trial is found, the payment is not a deadline: " + JSON.stringify(sug.map((s) => [s.title, s.date, s.amount])));
ok(!R.fromNotifications(q, ["n1"], { now }).length, "…and a seen one is not offered again");
// the store
let D = { items: [], seen: [] };
let r = R.addDeadline(D, { kind: "trial", title: "Spotify", date: "2026-10-16", amount: 11.99, currency: "USD" }, now); D = r.data;
ok(R.addDeadline(D, { kind: "trial", title: "spotify", date: "2026-10-16" }, now).dup, "the same deadline is kept once");
D = R.addDeadline(D, { kind: "expiry", doc: "passport", title: "Passport", date: "2027-03-01" }, now).data;
D = R.addDeadline(D, { kind: "warranty", title: "TV", date: "2028-10-14", amount: 699 }, now).data;
const V = R.radarView(D, now);
ok(V.soon.map((x) => x.title).join() === "Spotify,Passport" && V.later.map((x) => x.title).join() === "TV", "soon: Spotify (2 days) and the passport (inside 6 months); later: the TV warranty");
ok(R.daysLeft(D.items[0], now) === 2 && R.alertDays(D.items[1]) === 180, "2 days left; a passport warns 180 days ahead");
const rem = R.radarReminder(D.items[2], now);
ok(rem && R.isoDay(rem.at) === "2028-09-14" && /Warranty ends: TV/.test(rem.title), "the TV's reminder: 30 days before its warranty ends");
const res = R.resolveDeadline(D, D.items[0].id, "cancelled", now);
ok(res.saved === 11.99 && res.data.items[0].status === "done", "cancelled before the charge → 11.99 saved");
ok(R.resolveDeadline(D, D.items[0].id, "cancelled", new Date("2026-10-20").getTime()).saved === 0, "cancelled after the charge → nothing claimed");
ok(R.radarToday(D, now).map((x) => x.title).join() === "Spotify", "Home's today: the trial ending in 2 days (not the passport months away)");
// the model fallback
ok(R.readDeadlineModel('{"kind":"return","title":"Shoes","date":"2026-11-01","amount":80}', { home: "EUR", now })[0].currency === "EUR" && !R.readDeadlineModel('{"kind":"x"}').length, "the model's answer is checked");
console.log(bad ? bad + " FAILED" : "v727radar ok");
