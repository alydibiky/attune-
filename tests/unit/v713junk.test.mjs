// v6.13 — Core+ wrote "0000…" on Ali's phone: an answer that starts as one repeated character is engine garbage.
import assert from "node:assert/strict";
import { junkStart } from "../../web-src/quality.js";
assert.equal(junkStart("0".repeat(160)), true);
assert.equal(junkStart("0000000000 0000000000 0000000000 0000000000 0000000000 0000000000"), true);
assert.equal(junkStart("!".repeat(70)), true);
assert.equal(junkStart("000"), false, "too short to judge");
assert.equal(junkStart("You are the bus driver — the riddle starts with 'You are driving a bus'."), false);
assert.equal(junkStart("| a | b |\n|---|---|\n| 1 | 2 |"), false);
assert.equal(junkStart("1. First, 5 people get on. 2. Then 2 get off and 7 get on. 3. Then 4 get off."), false);
assert.equal(junkStart("100000000 is a hundred million, and the answer to your question is below in full."), false);
console.log("v713junk ok");
