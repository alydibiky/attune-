// v10.9.7 the first minute (Ali's OK-FM): firstmin.js on Ali's own month, the 10,000-person generator's 2,500 sample (HARD, composed),
// the learning, and the Google Play "until cancelled" terms (a real bug found here: his renewal read as cancelled).
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; }, key: () => null, length: 0 };
const F = await import("../../web-src/firstmin.js");
const { REAL } = await import("../scan/real/ali-2026-11-23.mjs");
const { readSubscription } = await import("../../web-src/subread.js");
const G = await import("../firstmin/gen.mjs");
let fail = 0, n = 0; const ok = (c, m) => { n++; console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const now = Date.parse("2026-11-24T10:00:00");
const FROM = { "paypal-enzu": "PayPal <service@paypal.com>", "anthropic-claude-pro": "Anthropic, PBC <invoice+statements@mail.anthropic.com>", "enzu-invoice-due": "Enzu Billing <billing@enzu.com>", "google-play-ai-pro": "Google Play <googleplay-noreply@google.com>" };
const AT = { "paypal-enzu": "2026-11-20", "anthropic-claude-pro": "2026-11-12", "enzu-invoice-due": "2026-11-17", "google-play-ai-pro": "2026-11-03" };
const emails = REAL.map((r) => ({ id: r.id, from: FROM[r.id], title: r.text.split("\n")[0], text: r.text, at: Date.parse(AT[r.id] + "T10:00:00") }));
const sms = [{ id: "a", app: "CIB", title: "CIB", text: "Your credit card ending 2969 was charged for EGP 1,240.00 at CARREFOUR MAADI on 18/11/2026", ts: Date.parse("2026-11-18T19:00:00") },
  { id: "b", app: "CIB", title: "CIB", text: "Your credit card ending 2969 was charged for EGP 185.00 at TALABAT on 21/11/2026", ts: Date.parse("2026-11-21T14:00:00") },
  { id: "c", app: "CIB", title: "CIB", text: "Your credit card ending 2969 was charged for USD 22.80 at ANTHROPIC on 12/11/2026", ts: Date.parse("2026-11-12T11:00:00") }];
let r = F.firstMonth({ sms, emails, now, home: "EGP" });
ok(Math.abs(r.total - 7135.46) < 0.01, "Ali's month: 7,135.46 EGP (" + r.total + ")");
ok(r.counts.joined === 1 && r.subs.some((s) => /Claude/.test(s.name) && s.src.includes("sms") && s.src.includes("gmail")), "the ANTHROPIC card SMS and the Claude receipt are one payment");
ok(Math.abs(r.rate.USD - 3531.67 / 65) < 1e-9, "his own rate, from his PayPal line (3,531.67 EGP = 65 USD) — never an invented one");
ok(r.subs.some((s) => /Google One/.test(s.name) && s.amount === 939.99), "Google One 939.99 a month is a subscription (not 'cancelled')");
ok(r.check.length === 1 && r.check[0].q === "same" && /Enzu/i.test(r.check[0].line.name), "Check this one: the Enzu invoice — same plan as the PayPal Dash Networks payment?");
ok(r.spend.some((s) => s.name === "Dash Networks"), "the PayPal receipt names the shop (Dash Networks), not PayPal");
// "Yes, same" → the Dash Networks payment is a monthly plan
let learn = F.fixLine({}, r.check[0].line, { billSame: true });
learn = F.fixLine(learn, r.spend.find((s) => s.name === "Dash Networks"), { sub: true, cycle: "month" });
r = F.firstMonth({ sms, emails, now, home: "EGP", learn });
ok(r.check.length === 0 && Math.abs(r.subsMonthly - 5710.46) < 0.01 && Math.abs(r.subsYearly - 68525.52) < 0.01, "Yes, same → 5,710.46 a month, 68,525.52 a year");
// ✎ learned per sender: Talabat → groceries; "Not mine" hides the sender; a corrected amount is the person's
const tal = r.spend.find((s) => s.name === "TALABAT");
learn = F.fixLine(learn, tal, { cat: "groceries" });
r = F.firstMonth({ sms, emails, now, home: "EGP", learn });
ok(r.spend.find((s) => s.name === "TALABAT").cat === "groceries", "a category fixed once stays for that sender");
r = F.firstMonth({ sms, emails, now, home: "EGP", learn: F.fixLine(learn, tal, { notMine: true }) });
ok(!r.spend.some((s) => s.name === "TALABAT") && Math.abs(r.total - (7135.46 - 185)) < 0.01, "Not mine → gone from the month");
r = F.firstMonth({ sms, emails, now, home: "EGP", learn, fix: { [tal.id]: 190 } });
ok(Math.abs(r.total - 7140.46) < 0.01, "✎ amount 185 → 190 changes the total");
// the terms of a Google Play receipt are not a cancellation; a real one is
const gp = REAL.find((x) => x.id === "google-play-ai-pro").text;
ok(readSubscription(gp, { now }).cancelled === false, "Google Play: 'charged … until cancelled. Learn how to cancel.' is not cancelled");
ok(readSubscription("Your Netflix membership has been cancelled.\nPremium\nEGP 240.00", { now }).cancelled === true, "…a real cancellation still is");
// nothing in other currencies invented: a dollar plan with no rate stays in dollars
r = F.firstMonth({ sms: [], emails: emails.filter((e) => e.id === "anthropic-claude-pro"), now, home: "EGP" });
ok(r.foreign.USD === 22.8 && r.total === 0 && r.subsMonthly === 0, "no rate of his own → 22.80 USD stays in dollars (never guessed)");
// the generator: 2,500 composed HARD people, the mark 99.5 %
const g = G.run(2500, 3, { quiet: true });
ok(g.right / g.total >= 0.995, `2,500 people (HARD, composed): ${g.right}/${g.total} (mark 99.5 %)`);
ok(g.share >= 0.6, `…${(100 * g.share).toFixed(1)} % different shapes (bar 60 %)`);
console.log(fail ? `FAIL ${fail}/${n}` : `ALL PASSED v1097firstmin (${n} checks)`); if (fail) process.exitCode = 1;
