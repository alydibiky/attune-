// v6.34 — Ali's 17 Oct phone list: food corrections in plain sentences.
import assert from "node:assert/strict";
import * as R from "../../web-src/fitread.js";
import * as Q from "../../web-src/docqa.js";
import * as LF from "../../web-src/life.js";
import { tickRegular } from "../../web-src/regular.js";
const plate = R.readMealText("fried egg on toast").items;
assert.ok(plate.length >= 1, "a plate to correct");
for (const said of ["There is tomato sauce", "there is tomato sauce and cheese", "it has tomato sauce", "فيه صلصة طماطم", "tomato sauce"]) {
  const r = R.draftCommand(plate, said);
  assert.ok(r && r.items.length > plate.length, "an addition is understood: " + said);
  assert.match(r.done.en, /Added/);
}
const one = R.readMealText("milk chocolate 45 g").items;
const sw = R.draftCommand(one, "it's cake, not milk chocolate");
assert.ok(sw && sw.items.length === 1 && sw.items[0].id !== one[0].id, "a swap keeps one food: " + (sw && sw.done.en));
assert.equal(Math.round(sw.items[0].grams), Math.round(one[0].grams), "…and its grams");
assert.equal(R.draftCommand(plate, "remove the egg").items.length, plate.length - 1, "remove still works");
assert.equal(R.draftCommand(plate, "blah blah"), null, "nonsense still says it didn't get it");
// a task on a document ("Solve the questions") is solved from the whole document, not searched for
for (const q of ["Solve the questions", "solve question 3", "answer all the questions", "do the exercises", "calculate the doubling time", "حل الأسئلة", "حلها"]) assert.equal(Q.intent(q), "solve", q);
for (const q of ["what is the late fee", "Summarise this document", "which questions are about yield?"]) assert.notEqual(Q.intent(q), "solve", q);
const sm = Q.solveMessages("Solve the questions", "[p. 1]\nQ1. mu = ln2 / td; td = 2 h. Find mu.");
assert.match(sm[0].content, /step by step/); assert.match(sm[1].content, /Q1\. mu/);
// the maid every Saturday, 600 EGP: a checkbox each Saturday, a tick = an expense in Money, an untick takes it out
const SAT = new Date("2026-10-17T10:00:00").getTime();
const maid = LF.parseLife("the maid comes every Saturday and takes 600 egp", { now: SAT, currency: "EGP" });
assert.equal(maid.kind, "regular"); assert.equal(maid.amount, 600); assert.equal(maid.every, "week"); assert.equal(maid.start, "2026-10-17", "today is Saturday: the first box is today's");
const ar = LF.parseLife("الشغالة بتيجي كل سبت وبتاخد ٦٠٠ جنيه", { now: SAT + 86400000, currency: "EGP" });
assert.equal(ar.kind, "regular"); assert.equal(ar.start, "2026-10-24", "on a Sunday the next box is next Saturday");
const mem = new Map(); const store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
store.setItem("ledger.v3", JSON.stringify({ accounts: [{ id: "a1", currency: "EGP" }], txns: [] }));
LF.saveLife(LF.addCommitment({ v: 1, items: [] }, maid, SAT), store);
const id = LF.loadLife(store).items[0].id;
let due = LF.dueSoon(LF.loadLife(store), SAT);
assert.equal(due.length, 1, "on Saturday it is due today"); assert.equal(due[0].late, false);
assert.equal(LF.dueSoon(LF.loadLife(store), SAT + 3 * 86400000).length, 0, "a missed Saturday is not 'late' on Tuesday");
let r = tickRegular(id, due[0].i, true, { store, now: SAT });
assert.equal(r.recorded, 600, "ticked → recorded");
let led = JSON.parse(store.getItem("ledger.v3"));
assert.equal(led.txns.length, 1); assert.equal(led.txns[0].type, "expense"); assert.equal(led.txns[0].amount, 600); assert.equal(led.txns[0].date, "2026-10-17"); assert.match(led.txns[0].note, /Maid/);
assert.equal(LF.dueSoon(LF.loadLife(store), SAT).length, 0, "done for today");
assert.equal(tickRegular(id, due[0].i, true, { store, now: SAT }).recorded, 0, "a second tick doesn't record it twice");
assert.equal(JSON.parse(store.getItem("ledger.v3")).txns.length, 1);
r = tickRegular(id, due[0].i, false, { store, now: SAT });
assert.ok(r.removed); assert.equal(JSON.parse(store.getItem("ledger.v3")).txns.length, 0, "unticked → taken out of Money");
assert.equal(LF.progressOf(LF.loadLife(store).items[0], SAT + 8 * 86400000).next.date, "2026-10-31", "the schedule keeps going week after week");
console.log("PASS v737fixes");
