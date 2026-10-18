// v6.38 (D3) — Mind brings things back by itself. node tests/unit/v740recall.test.mjs
import assert from "node:assert/strict";
import { knownPeople, recallFor } from "../../web-src/recall.js";
const now = new Date(2026, 9, 18, 12).getTime();
const s = {
  xray: [{ id: "x", me: "Ali", items: [{ type: "promise", from: "Ahmed", t: 1, amount: 2000, due: "2026-10-15", what: "الباقي بكرة" }, { type: "promise", from: "Ali", t: 2, what: "mine" }] }],
  life: { items: [{ id: "l", kind: "installment", dir: "in", person: "أحمد", amount: 1000, currency: "EGP", count: 5, every: "month", start: "2026-09-01", paid: [0] }] },
  ledger: { debts: [{ id: "d", type: "owed_to_me", person: "Karim", amount: 500, payments: [], dueDate: "2026-10-30", currency: "EGP" }] },
  memory: [{ title: "Karim's car", text: "Karim wants to sell his Verna in December", ts: now - 1000 }],
};
const names = knownPeople(s).map((p) => p.name).sort();
assert.deepEqual(names, ["Ahmed", "Karim", "أحمد"].sort());
const r = recallFor("Ahmed: hey, about the money…", s, now);
assert.equal(r.length, 1); assert.equal(r[0].person, "Ahmed");
assert.match(r[0].items[0].what, /Promised, not kept: الباقي بكرة — by 2026-10-15/);
const k = recallFor("كلمت Karim النهارده", s, now);
assert.equal(k[0].items.length, 2);
assert.ok(k[0].items.some((x) => x.src === "money" && /عليه ليك 500/.test(x.what)) && k[0].items.some((x) => x.src === "memory"));
const a = recallFor("أحمد قال هيحول", s, now);
assert.equal(a[0].items[0].src, "life"); assert.match(a[0].items[0].what, /عليه ليك 4,000 EGP/);
assert.deepEqual(recallFor("Ahmedabad trip", s, now), [], "a name inside another word is not a match");
assert.deepEqual(recallFor("", s, now), []);
console.log("v740recall: all passed");
