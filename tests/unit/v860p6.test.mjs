// v8.6 persona 6 (the logic tester): exact answers the app must never get wrong.
const LS = { "attune:country": "eg" }; globalThis.localStorage = { getItem: (k) => (k in LS ? LS[k] : null), setItem: (k, v) => { LS[k] = String(v); }, removeItem: (k) => { delete LS[k]; } };
const C = await import("../../web-src/calc.js"), MC = await import("../../web-src/mathcheck.js"), L = await import("../../web-src/life.js"), D = await import("../../web-src/deadlines.js"), A = await import("../../web-src/actions.js"), F = await import("../../web-src/fit.js");
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const v = (t) => { const r = C.calculate(t); return r && r.value; };
ok(v("(5+3)*2^3") === 64 && v("2^3^2") === 512 && v("√81 * 2") === 18 && v("sqrt(144) + 1") === 13, "powers and square roots");
ok(v("log(100) + 1") === null, "a function the calculator can't do is left to the model, never answered wrong");
ok(v("3 cranes × 4 days × 12,500 EGP + 14% VAT") === 171000, "the crane quote with VAT");
ok(MC.checkMath("Grand total = 150000 + 21000 = 171500").wrong.length === 1 && MC.checkMath("Total = 150000 + 21000 = 171000").wrong.length === 0, "a whole-number sum off by 500 is caught (the 0.5 % room is for rounded results only)");
const c = L.parseLife("sheikh owes me 22,000 to be paid monthly for 9 months", { currency: "EGP" });
ok(Math.round(L.scheduleOf({ ...c, created: Date.parse("2026-10-27") }).reduce((a, x) => a + x.amount, 0) * 100) / 100 === 22000, "9 instalments add up to exactly 22,000 (the last one takes the cents)");
const now = Date.parse("2026-10-27T10:00:00");
ok(D.chatDeadlineIntent("driving licence expires 29/02/2027", { now }) === null, "29 February 2027 is not a date (it was moved to 1 March)");
ok((D.chatDeadlineIntent("جواز السفر بينتهي ١٠/٥/٢٠٢٧", { now }) || {}).date === "2027-05-10", "an Egyptian sentence with Arabic digits");
ok((D.chatDeadlineIntent("my visa ends on 31 jan", { now }) || {}).date === "2027-01-31" && (D.chatDeadlineIntent("car license renewal 15/12", { now }) || {}).date === "2026-12-15", "'ends on 31 jan' and 'renewal 15/12' are deadlines");
const r = A.quickAction("remind me on 3/4 at 5pm", now); ok(new Date(r.at).getFullYear() === 2027 && !r.problems.length, "3/4 in October = next 3 April, not 'already passed'");
const t = F.targets({ sex: "m", age: 30, cm: 180, kg: 80, activity: "moderate", goal: "maintain" });
ok(t.bmr === 1780 && t.tdee === Math.round(1780 * 1.55), "Mifflin-St Jeor BMR and TDEE");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
