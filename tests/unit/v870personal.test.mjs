// v8.7 (Ali: "tell me about my barber" — 15 s and the voice didn't know; it was in the app)
import assert from "node:assert/strict";
import * as P from "../../web-src/personal.js";
const now = Date.parse("2026-10-29T20:00:00");
const memory = [
  { id: "m1", kind: "note", title: "Barber", text: "that in the barber I go to hany rabee3 I like 1.ahmed me8awry 2.ahmed Sheraton 3.ibrahim hassan", ts: now - 864e5 * 20 },
  { id: "m2", kind: "note", title: "Osama", text: "Osama the carpenter 01001234567, did the kitchen cabinets", ts: now - 864e5 * 40 },
  { id: "m3", kind: "note", title: "Shopping", text: "milk eggs bread", ts: now - 864e5 },
];
let n = 0;
for (const q of ["Tell me about my barber", "do you know my barber", "مين الحلاق بتاعي", "who is Osama the carpenter", "my carpenter's number"]) {
  const a = P.mindAnswer(q, { memory }, { now });
  assert.ok(a, q); assert.ok(/hany rabee3|Osama the carpenter/.test(a.en), q + " → " + (a && a.en)); n++;
}
assert.equal(P.mindAnswer("what is a barber", { memory }, { now }), null, "a general question is not about yours"); n++;
assert.equal(P.mindAnswer("tell me about my dentist", { memory }, { now }), null, "nothing about it → null (the model may answer)"); n++;
assert.equal(P.personalAsk("What was the score of Liverpool and Chelsea yesterday"), false); n++;
console.log(`v870personal: ${n} checks passed`);
