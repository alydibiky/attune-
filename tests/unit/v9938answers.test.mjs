// v9.9.38 — the 1M test, parts B, D and E: what the answers-by-code and the real-page journeys found, each kept from coming back,
// and a 2,500 sample of part D (answers compared with the truth worked out separately) above its mark.
import { execFileSync } from "child_process";
const A = await import("../../web-src/actions.js"), LA = await import("../../web-src/lifeask.js"), M = await import("../../web-src/myledger.js");
const L = await import("../../web-src/life.js"), DL = await import("../../web-src/deadlines.js"), B = await import("../../web-src/braindump.js");
const W = await import("../../web-src/wrapclean.js"), U = await import("../../web-src/understand.js"), D = await import("../../web-src/doit.js");
let fail = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const now = Date.parse("2026-11-14T15:20:00"), when = (t) => { const q = A.quickAction(t, now); return q && q.at ? new Date(q.at).toString().slice(0, 21) : "none"; };

// reminders: weeks and months (were 1 January 1970), am / pm after "in N …"
ok(when("remind me in 2 weeks to call Sara") === "Sat Nov 28 2026 09:00", "«in 2 weeks» → 28 Nov 9:00 (was 1 Jan 1970): " + when("remind me in 2 weeks to call Sara"));
ok(when("remind me in 3 months to renew") === "Sun Feb 14 2027 09:00", "«in 3 months» → 14 Feb");
ok(when("فكرني بعد اسبوعين ادفع الايجار") === "Sat Nov 28 2026 09:00" && when("فكرني بعد شهر اجدد الرخصة") === "Mon Dec 14 2026 09:00", "«بعد اسبوعين» / «بعد شهر»");
ok(when("remind me in 1 month at 8 pm to pay") === "Mon Dec 14 2026 20:00", "«in 1 month at 8 pm» rings at 8 pm (was 8 am)");
{ const q = A.quickAction("remind me on 14 November at 2:30 pm to call Sara", now); ok(q && (q.problems || []).some((p) => /already passed/.test(p)), "a date today whose time has gone is asked about, never set in the past silently"); }

// who owes me: an open debt counts; a person with nothing owes nothing (it was everyone's total)
const life = { items: [{ id: "a", kind: "installment", person: "Ahmed", dir: "in", amount: 1000, count: 12, total: 12000, every: "month", start: "2026-08-01", currency: "EGP", paid: [0, 1] },
  { id: "b", kind: "debt", person: "Sara", dir: "in", amount: 2500, count: 0, total: 0, every: null, start: "", currency: "EGP", paid: [] }] };
ok(/12,500 EGP/.test(LA.askLife("who owes me money?", { life }, { now }).en), "«who owes me money?» counts Sara's open 2,500 → 12,500");
ok(L.progressOf(life.items[1], now).left === 2500 && L.progressOf({ ...life.items[1], paid: [0] }, now).left === 0, "an open debt has its amount left, 0 once paid");
ok(L.progressOf({ kind: "subscription", amount: 200, count: 0, total: 0, every: "month", start: "2026-01-01" }, now).left == null, "a repeating plan (Netflix) still has no 'left'");
ok(/^Hany owes you nothing/.test(LA.askLife("how much does Hany owe me?", { life }, { now }).en), "«how much does Hany owe me?» → nothing (was everyone's total)");
ok(/owes? you/.test(LA.askLife("how much am I owed?", { life }, { now }).en || ""), "«how much am I owed?» is understood");

// wording: "You spent 150 EGP today" (was "in today")
{ const Lg = { currency: "EGP", accounts: [{ id: "c", currency: "EGP", start: 0 }], txns: [{ id: "1", type: "expense", amount: 150, cat: "food", date: "2026-11-14", note: "lunch", account: "c" }] };
  const t = M.answerMyMoney("how much did I spend today?", Lg, { now, short: true }).text, a = M.answerMyMoney("صرفت كام النهارده؟", Lg, { now, short: true }).text;
  ok(/150 EGP\*\* today/.test(t) && !/in today/.test(t) && !/في النهارده/.test(a), "«You spent 150 EGP today» (not «in today»), «… النهارده» (not «في النهارده»)"); }

// papers: "ends l Dec 2026" is the 1st; brain dump: a bare item before a verb-last list joins it
ok(DL.readDeadlines("Free trial ends l Dec 2026", { now: Date.parse("2026-11-12"), home: "EGP", order: "dmy" })[0].date === "2026-12-01", "«ends l Dec 2026» → 1 Dec (was 31 Dec)");
{ const o = B.organise("süt satın al, yumurta, pirinç ve ekmek satın al yarın", { now: Date.parse("2026-11-12T12:00:00") }); ok(o.length === 2 && o[1].items.join() === "yumurta,pirinç,ekmek", "Turkish: «yumurta, pirinç ve ekmek satın al» is one list: " + JSON.stringify(o.map((x) => x.items))); }

// the Home box (part E): Franco lending and an Arabic change of mind
{ const r = W.readable("salaft ahmed 7350"), a = U.looksFranco(r) ? U.francoToArabic(r) : r, u = D.understand(a, { now, stores: {} }); ok(u.actions.length === 1 && u.actions[0].kind === "life", "Franco «salaft ahmed 7350» is a debt (was an English expense)"); }
ok(W.readable("صرفت 664 على الباركينج لا استنى 581") === "صرفت 581 على الباركينج", "«… لا استنى 581» keeps only the second amount");

// part D, 2,500 answers (scaled sample) against the truth
const out = execFileSync("node", [new URL("../onemillion/partD.mjs", import.meta.url).pathname, String(2500 / 150000)], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const pct = +((/\(([\d.]+)%\)/.exec(out) || [0, 0])[1]);
ok(pct >= 99.9, "part D sample (2,500 answers: sums, money, debts, due, reminder times, holidays): " + pct + "% (the mark: 99.9%)");
console.log(fail ? `FAIL ${fail}` : "ALL PASSED");
process.exit(fail ? 1 : 0);
