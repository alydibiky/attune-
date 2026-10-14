// v6.28 Ask your life: one question answered by CODE from everything Attune keeps (money, debts, labs, sugar, medicines, meals,
// deadlines, Mind) — exact numbers, the source named, in English and Egyptian Arabic.
import * as A from "../../web-src/lifeask.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const now = Date.parse("2026-10-14T13:00:00"), DAY = 86400000, d = (n) => new Date(now + n * DAY).toISOString().slice(0, 10);
const S = {
  ledger: { currency: "EGP", accounts: [{ id: "c", name: "Cash", currency: "EGP" }], txns: [
    { id: "1", type: "expense", amount: 250, cat: "food", account: "c", date: d(-2), note: "koshary lunch" },
    { id: "2", type: "expense", amount: 400, cat: "food", account: "c", date: d(-1), note: "dinner" },
    { id: "3", type: "expense", amount: 1200, cat: "transport", account: "c", date: d(-1), note: "car service Toyota" }] },
  life: { items: [
    { id: "a", kind: "debt", person: "Ahmed", dir: "in", amount: 1000, total: 12000, count: 12, every: "month", start: "2026-06-01", currency: "EGP", paid: [0, 1, 2] },
    { id: "b", kind: "installment", title: "Phone", dir: "out", amount: 2500, count: 6, every: "month", start: "2026-09-20", currency: "EGP", paid: [0] }] },
  care: { members: [{ id: "me", name: "Me" }, { id: "mum", name: "Mama" }], meds: [
    { id: "m1", member: "mum", name: "Lantus", dose: "20 units", times: ["09:00", "21:00"], start: "2026-09-01", days: 0 },
    { id: "m2", member: "me", name: "Vitamin D", dose: "1 tablet", times: ["09:00"], start: "2026-09-01", days: 0 }],
    labs: [{ test: "HbA1c", value: 8.1, unit: "%", low: 4, high: 5.6, flag: "high", member: "mum", date: "2026-05-02" },
           { test: "HbA1c", value: 7.2, unit: "%", low: 4, high: 5.6, flag: "high", member: "mum", date: "2026-09-10" },
           { test: "Glucose", value: 62, unit: "mg/dL", member: "mum", date: d(0), at: now - 3600000 }],
    taken: { [`m1|${d(0)}|09:00`]: now - 4 * 3600000 } },
  radar: { items: [{ id: "r1", kind: "trial", title: "YouTube Premium", date: d(2), amount: 13.99, currency: "USD", status: "active" },
                   { id: "r2", kind: "expiry", title: "Passport", date: "2027-02-10", status: "active" }] },
  fit: { days: { [d(-1)]: { meals: { breakfast: [{ name: "eggs", kcal: 300, p: 20, c: 2, f: 22 }], lunch: [{ name: "chicken rice", kcal: 650, p: 45, c: 70, f: 15 }] } } } },
  reminders: [{ id: "x", at: now + 3 * DAY, title: "Call the landlord" }],
  memory: [{ id: "n1", ts: now - 30 * DAY, title: "Toyota service notes", text: "Oil change at 60,000 km, next at 70,000", output: "" }],
};
const a = (q) => A.askLife(q, S, { now }) || { kind: "none", en: "", ar: "", rows: [] };
let r = a("Who owes me money?");
ok(r.kind === "owed-in" && /9,000 EGP/.test(r.en) && r.open === "life", "who owes me → 9,000 EGP left (12,000 − 3 paid): " + r.en);
r = a("مين عليه فلوس ليا؟"); ok(r.kind === "owed-in" && /9,000/.test(r.ar), "…in Egyptian Arabic too");
r = a("How much does Ahmed still owe me?"); ok(/Ahmed still owes you 9,000 EGP \(3 payments/.test(r.en), "a named person: " + r.en);
r = a("what installments do I still have to pay?"); ok(r.kind === "owed-out" && /12,500 EGP/.test(r.en), "my installments: 15,000 − 2,500 paid = 12,500: " + r.en);
r = a("Is mama's HbA1c getting better?"); ok(r.kind === "lab" && /7\.2/.test(r.en) && /went down from 8\.1/.test(r.en) && /doctor/.test(r.en), "mum's HbA1c: latest 7.2, down from 8.1, and ask the doctor: " + r.en);
r = a("السكر التراكمي بتاع ماما اتحسن؟"); ok(r.kind === "lab" && /انخفض من 8\.1/.test(r.ar), "…asked in Arabic");
r = a("what was the last blood sugar reading?"); ok(r.kind === "sugar" && /62 mg\/dL/.test(r.en) && /1 low/.test(r.en), "blood sugar: the last reading and this week's lows");
r = a("What medicines does mum take?"); ok(r.kind === "meds" && /Mama takes 1 medicine/.test(r.en) && /1 of 2 doses taken; next Lantus at 21:00/.test(r.en), "mum's medicines and today's doses: " + r.en);
r = a("How much protein did I eat yesterday?"); ok(r.kind === "food" && /^65 g of protein/.test(r.en), "protein yesterday = 20 + 45: " + r.en);
r = a("أكلت كام سعرات امبارح؟"); ok(r.kind === "food" && /950/.test(r.ar), "calories yesterday in Arabic: 950");
r = a("How much did I spend on food this month?"); ok(r.kind === "money" && /650/.test(r.en), "money goes to the Money answer (650 on food): " + r.en.slice(0, 80));
r = a("What's due this week?"); const rows = r.rows.map((x) => x[1]).join(" | ");
ok(r.kind === "due" && /2 already late/.test(r.en) && r.rows[0][0].includes("⚠") && /YouTube Premium/.test(rows) && /landlord/.test(rows) && !/Passport/.test(rows), "due this week: Ahmed's 2 late payments first, then the trial and the reminder (not the passport): " + rows);
r = a("Toyota"); ok(r.kind === "search" && r.rows.length === 2 && r.rows.some((x) => /car service/.test(x[1])) && r.rows.some((x) => /service notes/.test(x[1])), "a bare word searches everything: the Money entry and the Mind note");
ok(A.askLife("hello there", S, { now }) === null, "nothing in the data → null (the page offers Chat)");
ok(A.askLife("Who owes me money?", {}, { now }).en.startsWith("Nobody"), "empty data → a clear answer, no crash");
ok(A.memberAsked("ماما بتاخد ايه", S.care.members).id === "mum" && A.memberAsked("my HbA1c", S.care.members) === null, "the family member is found by relation or name");

// in Chat: only your own things
ok(A.chatAsk("What is HbA1c?", S, { now }) === null && A.chatAsk("How do installments work?", S, { now }) === null, "Chat: a general question is not taken over");
ok(A.chatAsk("Is my mum's HbA1c getting better?", S, { now }).kind === "lab" && A.chatAsk("مين عليه فلوس ليا؟", S, { now }).kind === "owed-in", "Chat: a question about your own data is answered from it");
ok(A.chatAsk("Ahmed owes me 12,000, 1,000 a month", S, { now }) === null, "Chat: a statement (to save in People & plans) is left to that card");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
