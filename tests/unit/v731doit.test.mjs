// v6.28 "Do it from Home": one sentence → the right tool, by code (English + Egyptian Arabic); apply() writes that tool's own store.
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const D = await import("../../web-src/doit.js");
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const now = Date.parse("2026-10-14T08:30:00");
const stores = { care: { members: [{ id: "me", name: "Me" }], meds: [{ id: "m1", name: "Lantus", dose: "20 units", times: ["09:00", "21:00"], start: "2026-09-01" }], labs: [], taken: {} },
  ledger: { currency: "EGP", accounts: [{ id: "c", name: "Cash", currency: "EGP" }], txns: [] }, life: { v: 1, items: [] }, radar: { items: [], seen: [] },
  fit: { profile: { kg: 80 }, days: {}, weights: [] } };
const kinds = (t) => { const u = D.understand(t, { now, stores }); return u.ask ? "ask:" + u.ask.kind : u.chat ? "chat" : u.actions.map((a) => a.kind).join("+"); };
const CASES = [["I ate 2 eggs and foul for breakfast", "food"], ["فطرت فول وبيضتين وعيش", "food"], ["spent 150 on lunch", "money"], ["صرفت ١٥٠ على الغدا", "money"],
  ["had koshary for lunch, 80 pounds", "food+money"], ["took my Lantus", "dose"], ["خدت الانسولين", "dose"], ["remind me tomorrow at 9 to call Hassan", "reminder"],
  ["فكرني بكرة الساعة ٩ اكلم حسن", "reminder"], ["Ahmed owes me 12,000, 1,000 a month for a year", "life"], ["my Netflix trial ends on 20 November", "deadline"],
  ["drank 2 glasses of water", "water"], ["شربت ٢ كوباية مية", "water"], ["weighed 84 kg", "weight"], ["وزني ٨٤", "weight"], ["walked 30 minutes", "workout"], ["مشيت نص ساعة", "workout"],
  ["sugar 62", "sugar"], ["who owes me money?", "ask:owed-in"], ["what is the capital of France?", "chat"], ["note: the plumber is Mahmoud 0100 123 4567", "note"], ["taxi 60", "money"], ["my period started today", "period"]];
for (const [t, k] of CASES) ok(kinds(t) === k, `«${t}» → ${k} (got ${kinds(t)})`);
const act = (t) => D.understand(t, { now, stores }).actions;
// apply: each tool's own store
let r = D.apply(act("I ate 2 eggs and foul for breakfast")[0], stores, { now });
const bf = r.stores["attune:fit:v1"].days["2026-10-14"].meals.breakfast;
ok(bf.length === 2 && bf.every((x) => x.kcal > 0 && x.t === now) && r.open === "fit" && /breakfast/.test(r.done.en), "food: written into today's breakfast in Fit, with calories: " + r.done.en);
r = D.apply(act("spent 150 on lunch")[0], stores, { now });
const tx = r.stores["ledger.v3"].txns;
ok(tx.length === 1 && tx[0].amount === 150 && tx[0].type === "expense" && tx[0].cat === "food" && tx[0].account === "c", "money: an expense of 150 (food) in the Money ledger");
ok(D.apply(act("spent 150 on lunch")[0], { ...stores, ledger: null }, { now }).need === "money-setup", "money with no ledger yet → Money opens to set it up (nothing invented)");
r = D.apply(act("took my Lantus")[0], stores, { now });
ok(r.stores["attune:care:v1"].taken["m1|2026-10-14|09:00"] === now, "dose: the nearest Lantus dose (09:00) is ticked");
r = D.apply(act("drank 2 glasses of water")[0], stores, { now }); ok(r.stores["attune:fit:v1"].days["2026-10-14"].water === 500, "water: +500 ml");
r = D.apply(act("weighed 84 kg")[0], stores, { now }); ok(r.stores["attune:fit:v1"].weights.slice(-1)[0].kg === 84 && r.stores["attune:fit:v1"].profile.kg === 84, "weight: saved and the profile updated");
r = D.apply(act("walked 30 minutes")[0], stores, { now }); const w = r.stores["attune:fit:v1"].days["2026-10-14"].workouts[0]; ok(w.min === 30 && w.kcal === 140, "workout: 30 min walk at 80 kg = 140 kcal (MET 3.5)");
r = D.apply(act("sugar 62")[0], stores, { now }); ok(r.low && /LOW/.test(r.done.en) && r.stores["attune:care:v1"].labs.length === 1, "low sugar: saved and the 15 g steps shown");
r = D.apply(act("Ahmed owes me 12,000, 1,000 a month for a year")[0], stores, { now }); ok(r.stores["attune:life:v1"].items[0].person === "Ahmed", "debt: in People & plans");
r = D.apply(act("my Netflix trial ends on 20 November")[0], stores, { now }); ok(r.stores["attune:radar:v1"].items[0].date === "2026-11-20", "deadline: in the Radar on 20 Nov");
ok(D.apply(act("remind me tomorrow at 9 to call Hassan")[0], stores, { now }).need === "reminder", "a reminder is handed to the page to schedule");
const two = act("had koshary for lunch, 80 pounds");
ok(two[0].meal === "lunch" && two[1].items[0].amount === 80, "one sentence, two tools: koshary in lunch AND 80 in Money");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
