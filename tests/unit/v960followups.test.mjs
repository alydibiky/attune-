// v9.6 (Ali picked F4 + F1): week strip on top + one list by day, Late first, one search box
import assert from "node:assert/strict";
const T = await import("../../web-src/timeline.js");
const now = Date.parse("2026-11-05T10:00:00");
const list = [
  { id: "a", date: "2026-11-03", kind: "reminder", what: "Take the balance from my room" },
  { id: "b", date: "2026-11-05", kind: "collect", what: "Sheikh · installment", amount: 2500 },
  { id: "c", date: "2026-11-07", kind: "pay", what: "Maid", amount: 600 },
  { id: "d", date: "2026-11-10", kind: "reminder", what: "Charge the water of Address East" },
];
const w = T.weekDays(list, "2026-11-05");
assert.equal(w.length, 7); assert.equal(w[0].date, "2026-11-05"); assert.equal(w[0].count, 1); assert.equal(w[0].pays, false);
assert.equal(w[2].date, "2026-11-07"); assert.equal(w[2].pays, true, "the maid's day has a red dot");
assert.equal(w[1].count, 0);
const g = T.byDayLate(list, now);
assert.equal(g[0].date, "late"); assert.equal(g[0].items.length, 1, "everything late is one group, first");
assert.deepEqual(g.slice(1).map((x) => x.date), ["2026-11-05", "2026-11-07", "2026-11-10"]);
assert.deepEqual(T.searchItems(list, "water").map((x) => x.id), ["d"]);
assert.deepEqual(T.searchItems(list, "sheikh 2500").map((x) => x.id), ["b"], "words and amounts");
assert.equal(T.searchItems(list, "a").length, 4, "one letter does not filter yet");
console.log("ALL PASSED v960followups (9 checks)");
