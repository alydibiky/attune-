// v10.1 — Ali's picks of 16 Nov 2026: T1 (My things in Follow-ups, linked to Money) · P1 P2 P3 P4 W2 (projects connected) · F1 F3
// (finding a feature). 2,500 samples of each 10,000-case generator and of its held-out set(s), plus the cases behind the build.
import { execFileSync } from "child_process";
import fs from "fs";
const T = await import("../../web-src/things.js");
const P = await import("../../web-src/projlinks.js");
const F = await import("../../web-src/features.js");
const RM = await import("../../web-src/removed.js");
const D = await import("../../web-src/deadlines.js");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const run = (gen, env = {}) => +((/right \(([\d.]+)%\)/.exec(execFileSync("node", [new URL("../" + gen + "/gen.mjs", import.meta.url).pathname, "2500"], { env: { ...process.env, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })) || [0, 0])[1]);
// ---- the generators (marks: the main set 100%, held-out 99%; the features' second held-out — never tuned on — 85%)
ok(run("thingpay") === 100, "My things ↔ Money, 2,500 sample: 100%"); ok(run("thingpay", { HELDOUT: "1" }) >= 99, "…held-out ≥ 99%");
ok(run("projlinks") === 100, "projects dates · money · people, 2,500 sample: 100%"); ok(run("projlinks", { HELDOUT: "1" }) >= 99, "…held-out ≥ 99%");
ok(run("features") === 100, "finding a feature, 2,500 sample: 100%"); ok(run("features", { HELDOUT: "1" }) >= 99, "…held-out ≥ 99%");
{ const h2 = run("features", { HELDOUT: "2" }); ok(h2 >= 85, "…the second held-out (never tuned on) ≥ 85%: " + h2 + "%"); }
// ---- T1: a receipt's thing ↔ its payment
const book = [{ id: "a", type: "expense", amount: 24999, date: "2026-03-12", note: "B.TECH" }, { id: "b", type: "expense", amount: 24999, date: "2026-07-01", note: "B.TECH" }, { id: "c", type: "income", amount: 24999, date: "2026-03-12" }];
ok(T.paymentFor({ name: "Samsung TV 55", store: "B.TECH", price: 24999, date: "2026-03-12" }, book) === "a", "the TV ↔ its payment that day (not the one in July, not an income)");
ok(T.paymentFor({ name: "Samsung TV 55", store: "B.TECH", price: 24999, date: "2026-03-12" }, book, ["a"]) === "", "a payment another thing took is never linked twice");
ok(T.expenseFor({ name: "Washer", store: "Raya", price: 18400 }, "2026-11-16").date === "2026-11-16", "a receipt with no date is added to Money today");
// ---- the date reader (fixed on the way: "Deadline 24/05/2027." — the sentence's full stop hid the date)
ok(D.datesIn("Deadline 24/05/2027.", { now: Date.parse("2026-11-16") }).length === 1 && D.datesIn("pay by 3/12/2026. ok", { now: Date.parse("2026-11-16") }).length === 1, "a date before a full stop is read");
ok(D.datesIn("version 1.2.3.4", { now: Date.parse("2026-11-16") }).length === 0, "…a version number is still not a date");
// ---- P1–P4
const now = Date.parse("2026-11-16T12:00:00");
const p = { id: "p1", name: "Umrah · December", created: now - 5 * 864e5, budget: 60000, knowledge: [], tasks: [{ text: "book hotel by 1 Dec 2026", col: "todo" }] };
const chats = [{ projectId: "p1", messages: [{ role: "user", text: "The flight is on 10 December 2026." }, { role: "assistant", text: "Maybe 12/12/2026?" }] }];
ok(P.projectDates(p, chats, now).map((x) => x.date).join() === "2026-12-01,2026-12-10", "P1: the task's date and the one YOU wrote — not the assistant's suggestion");
const m = P.projectMoney(p, [{ id: "1", type: "expense", amount: 6000, date: "2026-11-12", note: "hotel deposit for the Umrah" }, { id: "2", type: "expense", amount: 50, date: "2026-11-12", note: "umrahsss ad" }]);
ok(m.spent === 6000 && m.left === 54000, "P2: the Umrah deposit counts (not “umrahsss”): spent 6,000, 54,000 left");
const p4 = P.addShared(p, "Hany: the tiles will come on 24/11/2026", now);
ok(P.projectDates(p4, [], now).some((x) => x.date === "2026-11-24" && x.src === "note"), "P4: a shared message's date reaches the project (and Follow-ups)");
// ---- F1 / F3
ok(F.whereAsk("where is the split thing?").f.id === "split" && F.placeLine(F.whereAsk("where is the split thing?").f) === "Money → More", "F3: “where is the split thing?” → Split with anyone, Money → More (his own words)");
ok(F.whereAsk("فين الضمان؟").f.id === "things", "F3: «فين الضمان؟» → Things I own");
ok(F.whereAsk("where is my passport?") === null && F.whereAsk("where did I put my keys") === null, "F3: a thing you put somewhere is Mind's, not a feature");
ok(F.find("warranty").some((x) => x.f.id === "things"), "F1: searching “warranty” finds Things I own");
// (the full test run, 16 Nov: a chat question with "Where is it made?" inside got a feature instead of the AI's answer)
ok(F.whereAsk("What is the capacity of an LTM 1100? How much does it cost? Where is it made?") === null && F.whereAsk("how to change a tyre") === null && F.whereAsk("how do I cook rice") === null, "F3: several questions, and a how-to about the world, stay with the AI");
// every place of the app has its line (so a new feature can't be added without being findable)
const src = fs.readFileSync(new URL("../../web-src/attune.jsx", import.meta.url), "utf8"), tools = src.slice(src.indexOf("const MORE_TOOLS = ["), src.indexOf("const KNOW_ADMIN"));
const ids = [...tools.matchAll(/^\s*\["([a-z]+)", "/gm)].map((x) => x[1]).filter((id) => !RM.hiddenFromMenus(id) && !["knowledge", "studio", "crane", "improve", "compress", "humanize", "copilot", "library", "remember"].includes(id));
const opens = new Set(F.FEATURES.map((f) => f.open).concat(F.FEATURES.map((f) => f.id)));
const missing = ids.filter((id) => !opens.has(id)); ok(!missing.length, "every page in the app has a line in features.js — missing: " + missing.join(", "));
console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED (${n} checks)`);
process.exit(fail ? 1 : 0);
