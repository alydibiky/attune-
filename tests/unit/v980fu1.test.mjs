// v9.8 FU1 (Ali picked "one feed: Today · This week · Later"): late first in Today, then the week, then later; what each box does
import assert from "node:assert/strict";
const T = await import("../../web-src/timeline.js");
const now = Date.parse("2026-11-08T10:00:00");
const list = [
  { id: "r:1", date: "2026-11-08", time: Date.parse("2026-11-08T09:00:00"), kind: "reminder", what: "Hear the voice notes" },
  { id: "p:md:3", date: "2026-11-08", kind: "pay", page: "life", ck: "regular", what: "Maid", amount: 600 },
  { id: "p:sh:2", date: "2026-11-05", kind: "collect", page: "life", ck: "installment", what: "Sheikh · installment", amount: 2500 },
  { id: "e:1", date: "2026-11-20", kind: "errand", page: "errands", what: "Driving licence" },
  { id: "p:vf:0", date: "2026-11-15", kind: "pay", page: "life", ck: "bill", what: "Vodafone", amount: 450 },
  { id: "p:cw:1", date: "2026-12-01", kind: "pay", page: "life", ck: "regular", what: "Car wash", amount: 700 },
  { id: "d:1", date: "2026-11-12", kind: "renewal", page: "radar", what: "Netflix" },
];
const f = T.feedOf(list, now);
assert.deepEqual(f.today.map((x) => x.id), ["p:sh:2", "p:md:3", "r:1"], "Today: the late Sheikh first, then today's (all-day ones, then by time)");
assert.ok(f.today[0].late, "the late one is marked late");
assert.deepEqual(f.week.map((x) => x.id), ["d:1", "p:vf:0"], "This week: the next 7 days");
assert.deepEqual(f.later.map((x) => x.id), ["e:1", "p:cw:1"], "Later: the rest");
assert.equal(T.actionOf(list[1], now), "pay", "today's maid → tick = paid (in Money)");
assert.equal(T.actionOf(list[5], now), "", "the car wash on 1 Dec has no box yet");
assert.equal(T.actionOf(list[2], now), "ask", "Sheikh (3 days late) → did he pay?");
assert.equal(T.actionOf({ ...list[2], date: "2026-10-20" }, now), "", "…but not after 7 days (money by a tap: 7 days at most)");
assert.equal(T.actionOf(list[0], now), "done", "a reminder → done");
assert.equal(T.actionOf(list[6], now), "", "a date to watch has no box (a tap opens it)");
console.log("ALL PASSED v980fu1 (10 checks)");
