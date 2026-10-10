// v6.12 — web answers shaped like Gemini's: the kind of subject, the searches per section, the answer's structure.
const R = await import("../../web-src/research.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
ok(R.topicKind("Lynk & Co 900 all trims and prices") === "vehicle" && R.topicKind("Liebherr LTM 1100-4.2 specs") === "machine" && R.topicKind("iPhone 17 Pro price in Egypt") === "gadget" && R.topicKind("How tall is the Cairo Tower") === "general", "kinds");
ok(R.topicKind("مواصفات ونش جروف 250 طن") === "machine" && R.topicKind("أسعار عربية جيلي كولراي") === "vehicle", "Arabic kinds");
const s = R.topicSearches("Lynk & Co 900 all trims and prices", "vehicle", 5);
ok(s.some((x) => /official price trims/.test(x)) && s.some((x) => /market price used price Egypt/.test(x)) && s.some((x) => /horsepower torque/.test(x)) && s.some((x) => /pros cons/.test(x)) && s.some((x) => /China yuan/.test(x)),
   "a car (v6.16): official price, market and used price, specs, reviews — and a Chinese car's price at home are searched: " + s.join(" | "));
const sa = R.topicSearches("مواصفات وسعر تويوتا كورولا", "vehicle", 5);
ok(sa[0].startsWith("تويوتا كورولا السعر الرسمي") && sa.some((x) => /سعر السوق أوفر برايس مستعمل/.test(x)) && !sa.some((x) => /China/.test(x)) && R.topicKind("سعر تويوتا كورولا") === "vehicle", "an Arabic car question (brand in Arabic): official and market prices; no stray «و»: " + sa.join(" | "));
ok(R.isChineseCar("BYD Seal") && R.isChineseCar("سعر جيلي كولراي") && !R.isChineseCar("Toyota Corolla"), "Chinese brands are recognised");
const tpl = R.answerTemplate("Lynk & Co 900", "vehicle");
ok(/Official price \| Market price/.test(tpl) && /Prices: official vs market/.test(tpl) && /used prices by model year/.test(tpl) && /yuan/.test(tpl), "the car answer has official and market prices, used prices and the home-country price");
const fx = R.fxNote(JSON.stringify({ time_last_update_utc: "Sat, 10 Oct 2026 00:02:31 +0000", rates: { USD: 1, EGP: 48.5123, CNY: 7.1234, EUR: 0.91, AED: 3.6725, SAR: 3.75 } }), "BYD Seal");
ok(/1 USD = 48\.51 EGP = 7\.123 CNY = 0\.910 EUR/.test(fx) && /Sat, 10 Oct 2026/.test(fx) && /yuan \(CNY\) and US dollars/.test(fx), "today's rates: every price also in US dollars (and yuan for a Chinese car): " + fx.slice(0, 120));
ok(R.fxNote("oops") === "" && R.fxNote({ rates: {} }) === "", "no rates → no note (never made up)");
const sp = R.officialSpecsNote([{ title: "BYD (بي واي دي — صيني) Seal — specs (Europe, EEA)", text: "BYD SEAL — versions sold in Europe: (1) electric, 230 kW (308 hp), electric range 570 km (WLTP)" }]);
ok(/OFFICIAL TEST DATA/.test(sp) && /230 kW \(308 hp\)/.test(sp) && R.officialSpecsNote([]) === "", "the Cars pack's official figures go into the car answer");
ok(!R.topicSearches("iPhone 17 Pro price in Egypt").some((x) => /Egypt specifications/.test(x)), "'in Egypt' is not part of the subject");
const t = R.answerTemplate("Lynk & Co 900 all trims and prices");
ok(/Versions and prices/.test(t) && /\| Version \| Engine/.test(t) && /Pros and cons/.test(t) && /Rivals/.test(t) && /Availability in Egypt/.test(t), "the car answer's sections (versions table, performance, pros/cons, rivals, Egypt)");
ok(R.wantsShape("Lynk & Co 900") && R.wantsShape("Lynk & Co 900 all trims and prices") && !R.wantsShape("What is the top speed of the Tesla Model S Plaid?") && !R.wantsShape("How tall is the Cairo Tower"), "full shape for a bare subject or a detail question, not for a one-fact question");
console.log(fail ? `${fail} FAILED` : "ALL PASSED");
