// v9.5 (Ali, 5 Nov: "when the date comes it asks me if the person really paid, like the Sheikh — tick = recorded in revenue; paid
// more or less, like 4,000: I write it and the other payments are distributed again")
import assert from "node:assert/strict";
const LS = {}; globalThis.localStorage = { getItem: (k) => LS[k] ?? null, setItem: (k, v) => { LS[k] = String(v); }, removeItem: (k) => delete LS[k] };
const L = await import("../../web-src/life.js");
const R = await import("../../web-src/regular.js");
const H = await import("../../web-src/home.js");
const now = Date.parse("2026-11-05T10:00:00");
LS["ledger.v3"] = JSON.stringify({ txns: [], accounts: [{ id: "cash", name: "Cash", currency: "EGP" }], currency: "EGP" });
// Sheikh pays 19,500 in instalments of 2,500 from 5 Oct (monthly) → the 5 Nov payment is due today
let d = L.addCommitment({ v: 1, items: [] }, { kind: "installment", person: "Sheikh", dir: "in", amount: 2500, total: 19500, count: 8, every: "month", start: "2026-10-05", currency: "EGP", paid: [0] }, now);
L.saveLife(d);
const id = d.items[0].id;
// Home asks on the day
let list = H.todayList({ life: L.loadLife(), ledger: null, radar: null, care: null, now });
let ask = list.find((x) => x.ask);
assert.ok(ask, "Home asks: did Sheikh pay?"); assert.equal(ask.ask.person, "Sheikh"); assert.equal(ask.amount, 2500);
// "Not yet" → asked again tomorrow, not today
R.notYet(id, ask.ask.i, { now });
assert.ok(!H.todayList({ life: L.loadLife(), now }).some((x) => x.ask), "not asked again today");
assert.ok(H.todayList({ life: L.loadLife(), now: now + 86400000 }).some((x) => x.ask), "asked again tomorrow");
// he paid 4,000 instead of 2,500 → recorded as income in Money, the rest spread again, the total kept
const r = R.payPerson(id, ask.ask.i, 4000, { now });
assert.equal(r.recorded, 4000);
const led = JSON.parse(LS["ledger.v3"]);
assert.equal(led.txns.length, 1); assert.equal(led.txns[0].type, "income"); assert.equal(led.txns[0].amount, 4000);
assert.equal(r.left, 19500 - 2500 - 4000, "what is left = the total − what came");
const sch = L.scheduleOf(r.data.items[0], now);
const sum = sch.reduce((a, s) => a + (s.paid ? (r.data.items[0].got || {})[s.i] ?? s.amount : s.amount), 0);
assert.equal(Math.round(sum), 19500, "the plan still adds up to 19,500");
// paid exactly what was due (no amount typed) → that amount
const r2 = R.payPerson(id, ask.ask.i + 1, null, { now });
assert.ok(r2.recorded > 0);
console.log("ALL PASSED v950pay (10 checks)");
