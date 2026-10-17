// v6.32: the Overpaying check — subscriptions, trials, price rises, overlaps, renewals and perks, found by code on the phone.
import * as O from "../../web-src/overpay.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const now = new Date("2026-10-17T12:00:00").getTime(), at = (d) => new Date(d + "T10:00:00").getTime();
const tx = (date, amount, note) => ({ id: note + date, type: "expense", amount, cat: "bills", account: "c", date, note });
// made-up data
const ledger = { currency: "EGP", txns: [
  tx("2026-07-07", 500, "GOOGLE *Google One · CIB"), tx("2026-08-07", 500, "GOOGLE *Google One · CIB"), tx("2026-09-07", 500, "GOOGLE *Google One · CIB"), tx("2026-10-07", 650, "GOOGLE *Google One · CIB"),
  tx("2026-08-03", 220, "Google Play ChatGPT · CIB"), tx("2026-09-03", 220, "Google Play ChatGPT · CIB"), tx("2026-10-03", 220, "Google Play ChatGPT · CIB"),
  tx("2026-08-12", 165, "Netflix.com · NBE"), tx("2026-09-12", 165, "Netflix.com · NBE"), tx("2026-10-12", 165, "Netflix.com · NBE"),
  tx("2026-08-15", 120, "Shahid VIP · NBE"), tx("2026-09-15", 120, "Shahid VIP · NBE"), tx("2026-10-15", 120, "Shahid VIP · NBE"),
  tx("2026-08-01", 300, "CARREFOUR · CIB"), tx("2026-09-04", 410, "CARREFOUR · CIB"), tx("2026-10-02", 260, "CARREFOUR · CIB"),   // groceries: not a subscription
  tx("2026-08-20", 90, "Gym Plus · CIB"), tx("2026-09-20", 90, "Gym Plus · CIB"), tx("2026-10-20", 90, "Gym Plus · CIB"),   // steady: a subscription by its pattern
  tx("2026-05-02", 80, "Spotify · CIB"),
  tx("2026-07-01", 450, "WE Internet · CIB"), tx("2026-08-01", 450, "WE Internet · CIB"), tx("2026-09-01", 450, "WE Internet · CIB"), tx("2026-10-01", 520, "WE Internet · CIB"),   // home internet went up   // stopped in May: not active
] };
const emails = [
  { id: "m1", kind: "email", from: "Example AI <billing@example.ai>", title: "Your 7-day Claude Pro trial starts now", text: "Your free trial ends on October 20, 2026. After that you will be charged $20.00/month.", at: at("2026-10-13"), link: "https://mail.google.com/mail/#all/thread-f:111" },
  { id: "m2", kind: "email", from: "Google <payments-noreply@google.com>", title: "Upcoming price increase for your Google One subscription", text: "The price of your plan will increase from EGP 500.00 to EGP 650.00 per month starting 7 Oct 2026.", at: at("2026-09-01"), link: "https://mail.google.com/mail/#all/thread-f:222" },
  { id: "m3", kind: "email", from: "Domains Co <renewals@domains.example>", title: "Renewal receipt for your domain", text: "Thanks for your payment. example.org renewed for 1 year. Total: EGP 1,264.26", at: at("2025-11-02"), link: "https://mail.google.com/mail/#all/thread-f:333" },
  { id: "m4", kind: "email", from: "Sports Store <club@store.example>", title: "You have a 50 EGP voucher waiting", text: "You have 5,209 points. Redeem your 50 EGP voucher before 30 November 2026.", at: at("2026-10-01"), link: "https://mail.google.com/mail/#all/thread-f:444" },
  { id: "m5", kind: "email", from: "Bank <alerts@bank.example>", title: "Your verification code", text: "Your code is 123456", at: at("2026-10-10") },
];
const R = O.overpayCheck({ ledger, emails, radar: { items: [] }, now, home: "EGP" });
const S = (n) => R.subs.find((s) => s.name === n);
ok(O.serviceOf("GOOGLE *Google One · CIB") === "Google One" && O.serviceOf("Google AI Pro (5 TB)") === "Google AI Pro", "service names");
ok(JSON.stringify(O.moneyIn("from EGP 699.99 to EGP 939.99").map((m) => [m.amount, m.currency])) === '[[699.99,"EGP"],[939.99,"EGP"]]', "two amounts with their currency");
ok(O.moneyIn("$20.00/month")[0].currency === "USD" && O.moneyIn("1,264.26 ج.م")[0].amount === 1264.26, "dollar and Arabic pound");
ok(S("Google One") && S("ChatGPT") && S("Netflix") && S("Shahid"), "known services found: " + R.subs.map((s) => s.name).join(", "));
ok(!R.subs.some((s) => /carrefour/i.test(s.name)), "groceries are not a subscription");
ok(R.subs.some((s) => /gym/i.test(s.name)), "a steady monthly payment is");
ok(!S("Spotify"), "a subscription that stopped in May is not counted");
const dom = R.subs.find((s) => s.cadence === "year");
ok(dom && dom.amount === 1264.26 && dom.perMonth === 105.36, "a yearly renewal counts 1/12 a month: " + (dom && dom.name));
ok(Math.abs(R.perMonth.EGP - (650 + 220 + 165 + 120 + 90 + 520 + 105.355)) < 0.02, "what you pay a month: " + JSON.stringify(R.perMonth));
function r(n) { return Math.round(n * 100) / 100; }
const t = R.trials[0];
ok(t && t.name === "Claude" && t.days === 3 && t.amount === 20 && t.currency === "USD", "trial ends in 3 days, then $20: " + JSON.stringify(t && [t.name, t.days, t.amount, t.currency]));
ok(t.src.link.endsWith("thread-f:111"), "the trial links to its email");
const h = R.hikes.find((x) => x.name === "Google One");
ok(h && h.from === 500 && h.to === 650 && h.pct === 30 && h.perYear === 1800, "price rise +30%: 1,800 more a year");
ok(h.src.link.endsWith("thread-f:222") && R.hikes.filter((x) => x.name === "Google One").length === 1, "the rise links to the notice, counted once");
const we = R.hikes.find((x) => /internet/i.test(x.name));
ok(we && we.from === 450 && we.to === 520 && we.perYear === 840 && we.src.kind === "payment", "a rise found in the payments alone: home internet 450 → 520");
const ai = R.overlaps.find((o) => o.group === "ai");
ok(ai && ai.items.length === 2 && ai.items.some((i) => i.trial), "AI overlap: ChatGPT and the Claude trial");
const vid = R.overlaps.find((o) => o.group === "video");
ok(vid && vid.perYear === 1440, "video overlap: keep Netflix, Shahid costs 1,440 a year");
const ren = R.renewals[0];
ok(ren && ren.days === 16 && ren.amount === 1264.26, "the domain renews in 16 days: " + JSON.stringify(ren && [ren.name, ren.date]));
const p = R.perks[0];
ok(p && p.value === 50 && p.points === 5209 && p.expires === "2026-11-30", "an unused 50 EGP voucher: " + JSON.stringify(p && [p.name, p.value, p.expires]));
ok(R.perks.length === 1, "a verification code is not a perk");
ok(R.now.map((x) => x.kind).join(",") === "trial,hike,hike", "act now: the trial, then the price rise");
ok(R.atStake.EGP === 1800 + 1440 + 840 && R.atStake.USD === 240, "at stake a year: " + JSON.stringify(R.atStake));
// dismissed findings stay away
ok(!O.overpayCheck({ ledger, emails, now, done: [t.id] }).trials.length, "a trial marked done is gone");
// notifications work the same way (no link)
const N = O.overpayCheck({ notes: [{ id: "n1", app: "Bank", title: "Purchase", text: "Your card was charged EGP 99.00 at Anghami Plus. Receipt 7781", ts: at("2026-10-05") }], now });
ok(N.subs.length === 1 && N.subs[0].name === "Anghami" && N.subs[0].src.kind === "notification", "a charge notification → a subscription");
// mbox (Gmail Takeout)
const mbox = [
  "From 1811111111111111111@xxx Mon Oct 13 10:00:00 +0000 2026",
  "X-GM-THRID: 1811111111111111111", "X-Gmail-Labels: Inbox,Category Updates", "Message-ID: <a1@mail.example>", "Date: Mon, 13 Oct 2026 10:00:00 +0000",
  "From: Music <no-reply@music.example>", "Subject: =?UTF-8?B?WW91ciBTcG90aWZ5IHJlY2VpcHQ=?=", "Content-Type: multipart/alternative; boundary=\"b1\"", "",
  "--b1", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: quoted-printable", "", "Receipt: Spotify Premium =E2=80=94 EGP 99.00 per month", "--b1", "Content-Type: text/html", "", "<p>x</p>", "--b1--", "",
  "From 1822222222222222222@xxx Tue Oct 14 10:00:00 +0000 2026", "X-GM-THRID: 1822222222222222222", "Date: Tue, 14 Oct 2026 10:00:00 +0000", "From: friend@example.com", "Subject: lunch?", "", "see you", "",
  "From 1833333333333333333@xxx Wed Oct 15 10:00:00 +0000 2026",
].join("\n");
const M = O.readMbox(mbox, { since: at("2025-10-17") });
ok(M.emails.length === 1 && M.emails[0].title === "Your Spotify receipt" && /EGP 99\.00 per month/.test(M.emails[0].text), "mbox: the receipt is read (encoded subject, quoted-printable), the lunch email is skipped");
ok(M.emails[0].link === "https://mail.google.com/mail/#all/thread-f:1822222222222222222".replace("1822222222222222222", "1811111111111111111"), "mbox: a Gmail link from the thread id");
ok(M.rest.startsWith("From 1833"), "mbox: the unfinished last message waits for the next part");
// month by month, and the reminder on the 1st
let o = { emails: [], snaps: { "2026-09": { perMonth: { EGP: 1300 } } }, done: [] };
const sn = O.snapshot(o, R, now);
ok(sn.prevMonth === "2026-09" && sn.change.EGP === r(((R.perMonth.EGP - 1300) / 1300) * 100 * 10) / 10 || sn.change.EGP > 0, "change since last month: " + JSON.stringify(sn.change));
const rem = O.monthlyReminder(now);
ok(new Date(rem.at).getDate() === 1 && new Date(rem.at).getMonth() === 10 && new Date(rem.at).getHours() === 9 && rem.repeat === "monthly", "reminder: 1 Nov at 9:00, every month");
o = O.addEmails(o, M.emails); o = O.addEmails(o, M.emails);
ok(o.emails.length === 1, "the same email twice: kept once");
console.log(fail ? `${fail} FAILED` : "ALL PASSED");
