// v6.12 — web answers shaped like Gemini's: the kind of subject, the searches per section, the answer's structure.
const R = await import("../../web-src/research.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
ok(R.topicKind("Lynk & Co 900 all trims and prices") === "vehicle" && R.topicKind("Liebherr LTM 1100-4.2 specs") === "machine" && R.topicKind("iPhone 17 Pro price in Egypt") === "gadget" && R.topicKind("How tall is the Cairo Tower") === "general", "kinds");
ok(R.topicKind("مواصفات ونش جروف 250 طن") === "machine" && R.topicKind("أسعار عربية جيلي كولراي") === "vehicle", "Arabic kinds");
const s = R.topicSearches("Lynk & Co 900 all trims and prices");
ok(s.some((x) => /trims prices/.test(x)) && s.some((x) => /horsepower torque/.test(x)) && s.some((x) => /pros cons/.test(x)) && s.some((x) => /Egypt/.test(x)), "a car: trims/prices, specs, reviews and the Egypt price are searched: " + s.join(" | "));
ok(!R.topicSearches("iPhone 17 Pro price in Egypt").some((x) => /Egypt specifications/.test(x)), "'in Egypt' is not part of the subject");
const t = R.answerTemplate("Lynk & Co 900 all trims and prices");
ok(/Versions and prices/.test(t) && /\| Version \| Engine/.test(t) && /Pros and cons/.test(t) && /Rivals/.test(t) && /Availability in Egypt/.test(t), "the car answer's sections (versions table, performance, pros/cons, rivals, Egypt)");
ok(R.wantsShape("Lynk & Co 900") && R.wantsShape("Lynk & Co 900 all trims and prices") && !R.wantsShape("What is the top speed of the Tesla Model S Plaid?") && !R.wantsShape("How tall is the Cairo Tower"), "full shape for a bare subject or a detail question, not for a one-fact question");
console.log(fail ? `${fail} FAILED` : "ALL PASSED");
