// v6.37 (W6) — the Video cut's times. node tests/unit/v740clip.test.mjs
import assert from "node:assert/strict";
import { timeMs, clipRange } from "../../web-src/video.js";
assert.equal(timeMs("1:20"), 80000);
assert.equal(timeMs("01:02:03"), 3723000);
assert.equal(timeMs("75"), 75000);
assert.equal(timeMs("1.5"), 1500);
assert.equal(timeMs("١:٢٠"), 80000);
assert.equal(timeMs(""), null);
assert.ok(Number.isNaN(timeMs("1:75")));
assert.ok(Number.isNaN(timeMs("abc")));
assert.deepEqual(clipRange("0:30", "1:00"), { start: 30000, end: 60000 });
assert.deepEqual(clipRange("", ""), { start: 0, end: 0 });
assert.deepEqual(clipRange("1:00", ""), { start: 60000, end: 0 });
assert.ok(clipRange("1:00", "0:30").error);
assert.ok(clipRange("x", "").error);
console.log("v740clip: all passed");
