// v10.9.4 Scan anything S1 (SCAN_PLAN.md; Ali's OK-SS "accuracy is everything"): the subscription reader (web-src/subread.js).
const ok = (c, t) => { console.log((c ? "PASS " : "FAIL ") + t); if (!c) process.exitCode = 1; };
const S = await import("../../web-src/subread.js");
const { run } = await import("../scan/gen.mjs");
const r = run(2500, 5, { quiet: true });
ok(r.right / r.total >= 0.995, `2,500 composed HARD subscription screens: ${r.right}/${r.total} (mark 99.5 %)`);
ok(r.share >= 0.6, `…${(100 * r.share).toFixed(1)} % different shapes (bar 60 %)`);
const now = Date.parse("2026-11-23T12:00:00"), rd = (t) => S.readSubscription(t, { now });
let x = rd("NETFLIX\nYour membership · Standard\nEGP 240.00 · next billing 4 Dec 2026\nVisa •••• 4417");
ok(x.sure && x.service === "Netflix" && x.amount === 240 && x.currency === "EGP" && x.next === "2026-12-04" && x.last4 === "4417" && x.cycle === "month", "Netflix screenshot → Netflix 240 EGP monthly, next 4 Dec, Visa 4417");
x = rd("Shahid VIP\nاشتراك شهري\n٩٩ ج.م / شهر\nيتجدد في ٤ ديسمبر ٢٠٢٦");
ok(x.sure && x.service === "Shahid VIP" && x.amount === 99 && x.currency === "EGP" && x.next === "2026-12-04", "Arabic Shahid VIP (Arabic digits) → 99 EGP, next 4 Dec");
x = rd("Spotify Premium Individual\nWas EGP 99.99 now EGP 59.99/month\nRenews on 18 Dec 2026");
ok(x.sure && x.amount === 59.99, "the crossed-out old price is never the price (59.99, not 99.99)");
x = rd("Your receipt from Apple\niCloud+ 200 GB\nSubtotal 36.84 SAR\nVAT 5.53 SAR\nTotal 42.37 SAR\nRenews 4 December 2026");
ok(x.sure && x.amount === 42.37 && x.currency === "SAR", "VAT receipt → the total (42.37 SAR), never 200 (GB) or the VAT");
x = rd("Your subscription: Microsoft 365 Family\nMicrosoft 365 Family EGP 109 a month\nNext payment 2026-12-20");
ok(x.sure && x.amount === 109, "\"Microsoft 365\": 365 is the name, not the price");
ok(!rd("Netflix raises its Standard plan to $17.99 a month in the US").sure, "a news post about a price is never saved as yours");
ok(!rd("Choose your plan\nNetflix\nBasic $6.99/month\nStandard $15.49/month\nPremium $22.99/month").sure, "a plans page with several prices → ask, never guess");
ok(!rd("Shahid VIP يبدأ من ٤٩ ج.م شهريًا — اشترك الآن").sure, "an advert → not saved");
ok(rd("Hello Ahmed, see you tomorrow at 5") === null, "a chat screenshot is not a subscription");

// Ali's own screenshots (23 Nov 2026) — tests/scan/real/ali-2026-11-23.mjs: each must read exactly right
const R = await import("../../web-src/scanread.js");
const { REAL } = await import("../scan/real/ali-2026-11-23.mjs");
for (const c of REAL) {
  const r = R.readScan(c.text, { now: Date.parse("2026-11-23T19:30:00"), home: "EGP", order: "dmy" }), d = r.data || {}, w = c.want;
  const bad = [];
  if (r.kind !== w.kind) bad.push("kind " + r.kind);
  if (!r.sure) bad.push("not sure (" + r.why + ")");
  for (const k of ["service", "amount", "currency", "cycle", "next", "last4"]) if (w[k] != null && d[k] !== w[k]) bad.push(k + " " + d[k]);
  if (w.due && d.due !== w.due) bad.push("due " + d.due);
  if (w.original && !(d.original && d.original.amount === w.original.amount && d.original.currency === w.original.currency)) bad.push("original price");
  ok(!bad.length, `Ali's screenshot "${c.id}" → ${w.kind} ${w.service || ""} ${w.amount} ${w.currency}${bad.length ? " — WRONG: " + bad.join(", ") : ""}`);
}
