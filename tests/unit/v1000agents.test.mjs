// v8.0 Agents (Ali picked design A, 25 Oct): one sentence → one agent, read by code; any app opens by its name.
import * as A from "../../web-src/agents.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const now = Date.parse("2026-10-25T10:00:00"), P = (s, o = {}) => A.parseAgent(s, { now, country: "EG", ...o });
// ---- open any app ----
ok(P("open uber").app.pkg === "com.ubercab" && P("افتح طلبات").app.pkg === "com.talabat" && P("open booking").app.pkg === "com.booking" && P("Open Amazon").app.id === "amazon", "open Uber / «افتح طلبات» / Booking / Amazon → that app");
ok(P("open uber eats").app.id === "ubereats", "the longest name wins (Uber Eats, not Uber)");
ok(P("Open My Vodafone", { installed: [{ pkg: "com.vodafone.my", label: "My Vodafone" }] }).app.pkg === "com.vodafone.my", "an app not in the list is found on the phone by its name");
ok(!!P("open zzqx").ask, "an app it can't find → it asks what the app is called");
// ---- a price watch (Ali's example) ----
const h = P("tell me when hotels near the haram are under 45k for 4 nights from 10 december");
ok(h.kind === "watch" && h.below === 45000 && h.currency === "EGP" && /booking\.com.*ss=Masjid%20al-Haram.*checkin=2026-12-10&checkout=2026-12-14/.test(h.url), "hotels near the Haram under 45k, 4 nights from 10 Dec → a Booking watch, EGP 45,000: " + h.url);
const ha = P("نبهني لما فنادق الحرم تبقى أقل من 45 ألف لمدة 4 ليالي من 10 ديسمبر");
ok(ha.kind === "watch" && ha.below === 45000 && /checkout=2026-12-14/.test(ha.url), "the same in Egyptian Arabic («45 ألف», «4 ليالي»)");
ok(P("tell me when hotels in masjid el haram become less than 45k in 4 nights").ask === "From which day? (e.g. from 10 December)", "no date → it asks from which day (never guesses)");
ok(A.limitIn("under 1.2m") === 1200000 && A.limitIn("أقل من ٤٥ ألف") === 45000 && A.limitIn("for 4 nights under 45,000") === 45000, "limits: 1.2m, «٤٥ ألف», 45,000 (not the 4 nights)");
const ip = P("tell me when the iPhone 16 on amazon is under 40,000");
ok(ip.kind === "watch" && /amazon\.eg\/s\?k=iPhone%2016/.test(ip.url) && ip.below === 40000, "a product on Amazon under 40,000 → an Amazon watch");
// ---- delivery / usual order / do it now / scout / alert ----
const tr = P("tell me when my amazon order arrives");
ok(tr.kind === "track" && tr.app.pkg === "com.amazon.mShop.android.shopping" && P("امتى طلب أمازون هيوصل").kind === "track", "my Amazon order arrives / «امتى طلب أمازون هيوصل» → a delivery agent");
const rule = A.trackRule(A.makeAgent(tr, now));
ok(rule.id.startsWith("agent-") && rule.app.startsWith("pkgs:com.amazon.mShop.android.shopping") && rule.words.includes("out for delivery"), "…kept as a notification rule on Amazon's own app (pkgs:)");
ok(!!P("order my favourite food from talabat").ask && P("order my usual from talabat: Koshary Abou Tarek, large").what === "Koshary Abou Tarek, large", "order my usual from Talabat → asks what it is once, then keeps it");
ok(P("اطلبلي أكلي المفضل من طلبات", { usual: { talabat: "كشري" } }).what === "كشري", "«اطلبلي أكلي المفضل» uses the saved usual");
const ub = P("uber to cairo airport");
ok(ub.kind === "do" && ub.plan.links[0].label === "Uber", "“Uber to Cairo airport” → Uber opens with the destination");
ok(P("find me a used Hyundai Tucson 2022").kind === "scout" && P("tell me when Ahmed messages me").kind === "alert", "Scout and message alerts live here too");
// ---- checks and the report ----
let w = A.makeAgent(h, now);
w = A.addCheck(w, { at: now, price: 48200 }); ok(!w.found && A.watchLine(w).gap === 3200, "a check above the limit: not found, EGP 3,200 above");
w = A.addCheck(w, { at: now + 1, price: 44600 }); ok(w.found && w.found.price === 44600, "a check at or under the limit → found");
w = A.addCheck(w, { at: now + 2 }); ok(w.checks[2].blocked === true, "a page with no prices is kept as “needs a browser”");
const st = { agents: [w, A.makeAgent(tr, now)], usual: {} };
ok(A.watchPlan(st).length === 1 && A.watchPlan(st)[0].below === 45000, "the phone's plan holds the price watches only");
const r = A.agentsReport(st, [{ id: "g", on: true, unseen: [1] }], [{ id: "w1", on: true }, rule], now + 3);
ok(r.running === 4 && r.by.alert === 1 && r.found === 2 && r.checks === 3, "report: 4 running (watch, delivery, Scout, 1 alert — the delivery rule not counted twice), 2 found, 3 checks");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
