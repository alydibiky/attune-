// v6.37 (X3) — the weekly privacy report. node tests/unit/v740netreport.test.mjs
import assert from "node:assert/strict";
import { normalize, fold, weekReport, dayOf } from "../../web-src/netreport.js";
const now = new Date(2026, 9, 18, 15).getTime(), D = 86400000;
const phone = { entries: [
  { t: now - 1000, host: "www.duckduckgo.com", what: "page request", blocked: false },
  { t: now - 2000, host: "duckduckgo.com", what: "page request", blocked: false },
  { t: now - 3000, host: "tracker.example", what: "page request", blocked: true },
  { t: now - 9 * D, host: "old.example", what: "agent page", blocked: false }] };
const desk = [{ t: now - 5000, host: "huggingface.co", ok: true, why: "model download" }, { t: now - 6000, host: "ads.example", ok: false, why: "blocked" }];
assert.equal(normalize(phone).length, 4);
assert.equal(normalize(desk)[1].blocked, true);
assert.equal(normalize(desk)[0].what, "model download");
let s = fold(null, phone, now);
s = fold(s, phone, now);                       // the same session log again: nothing is counted twice
s = fold(s, desk, now);                        // older than the last fold → skipped (a new session starts later)
const r = weekReport(s, now);
assert.equal(r.sent, 2); assert.equal(r.blocked, 1);
assert.deepEqual(r.places.map((p) => p.host), ["duckduckgo.com", "tracker.example"]);
assert.deepEqual(r.places[0].what, ["page request"]);
assert.equal(r.days, 1); assert.equal(r.to, dayOf(now));
const s2 = fold(s, [{ t: now + 1000, host: "huggingface.co", ok: true, why: "model download" }], now + 2000);
assert.equal(weekReport(s2, now + 2000).sent, 3);
const last = weekReport(s2, now, 1);
assert.equal(last.sent, 1); assert.equal(last.places[0].host, "old.example");
const later = fold(s2, [], now + 40 * D);
assert.equal(Object.keys(later.days).length, 0);   // older than 35 days is dropped
console.log("v740netreport: all passed");
