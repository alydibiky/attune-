// v6.27 Read it to me (readaloud.js): what kind of paper, the amount and the due date, a medicine's dose — all by code.
import * as R from "../../web-src/readaloud.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
const now = Date.parse("2026-10-14T10:00:00");
const BILL = "North Cairo Electricity Distribution\nAccount number 448812\nElectricity bill — October 2026\nUsage 412 kWh\nTotal amount due: 1,236.50 EGP\nPay by 25/10/2026 to avoid disconnection";
const f = R.factsOf(BILL, { now, home: "EGP" });
ok(f.kind === "bill" && f.amount === 1236.5 && f.currency === "EGP" && f.due === "2026-10-25", "an electricity bill: 1,236.50 EGP, pay by 25 Oct: " + JSON.stringify({ k: f.kind, a: f.amount, c: f.currency, d: f.due }));
const e = R.explain(f, "en");
ok(/A bill to pay/.test(e.say[0]) && /1,236.50 EGP/.test(e.say.join(" ")) && /Pay by/.test(e.say.join(" ")), "said: what it is, the amount, the date: " + e.say.join(" | "));
ok(e.actions.some((a) => a.type === "radar" && a.item.date === "2026-10-25") && e.actions.some((a) => a.type === "money"), "actions: a Radar reminder for the due date, and Money");
const ea = R.explain(f, "ar");
ok(/فاتورة/.test(ea.say[0]) && /آخر موعد للدفع/.test(ea.say.join(" ")), "…and in Arabic: " + ea.say.join(" | "));
// Arabic bill
const fa = R.factsOf("فاتورة مياه\nرقم الحساب 55120\nالمبلغ المستحق 320 جنيه\nتاريخ الاستحقاق 30/10/2026", { now, home: "EGP" });
ok(fa.kind === "bill" && fa.amount === 320 && fa.due === "2026-10-30", "an Arabic water bill: 320, due 30 Oct: " + JSON.stringify({ k: fa.kind, a: fa.amount, d: fa.due }));
// a prescription
const rx = R.factsOf("Dr. Ahmed — Clinic\nRx\n1) Amoxicillin 500 mg 1 cap 3 times daily for 7 days\n2) Paracetamol 500 mg 1 tab when needed", { now });
ok(rx.kind === "prescription" && rx.meds.length === 2 && /Amoxicillin/.test(rx.meds[0].name), "a prescription: 2 medicines read");
ok(R.explain(rx, "en").actions.some((a) => a.type === "care"), "…offered to Family health (doses and reminders)");
// a medicine box
const box = R.factsOf("Panadol\nParacetamol 500 mg\n24 tablets\nAdults: take 1-2 tablets every 4-6 hours. Do not exceed 8 tablets in 24 hours.\nKeep out of reach of children", { now });
ok(box.kind === "medicine" && box.meds.length === 1, "a medicine box: recognised, its dose line read: " + JSON.stringify(box.meds[0] && { n: box.meds[0].name, d: box.meds[0].dose, f: box.meds[0].freq }));
// school, official, letter, sign
ok(R.kindOf("Dear parents,\nThe school trip is on 3 November. Please sign and return the form by 28 October.\nMrs. Hanan, Class 4 teacher") === "school", "a school note");
ok(R.kindOf("Ministry of Interior — Traffic Department\nNotice of fine: 500 EGP for parking violation") === "official", "an official paper (a fine)");
ok(R.explain(R.factsOf("Ministry of Interior\nTraffic fine 500 EGP\nPay before 01/11/2026", { now, home: "EGP" }), "en").todo.some((t) => /don't ignore it/.test(t)), "an official paper → don't ignore it, show it to someone you trust");
ok(R.kindOf("NO PARKING\nTow away zone") === "sign", "a sign");
// reading aloud
ok(R.sentences("Hello there. Pay by Friday!\nThank you").length === 3, "split into sentences for reading aloud");
ok(R.langOf("فاتورة مياه رقم الحساب") === "ar" && R.langOf("Le montant est à payer avant le") === "fr" && R.langOf("The amount is due on the first") === "en" && R.langOf("Der Betrag ist fällig und die Rechnung") === "de", "the voice's language from the paper's letters/words");
console.log(bad ? bad + " FAILED" : "v727read ok");
