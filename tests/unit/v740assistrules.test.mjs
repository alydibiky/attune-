// v6.40 (C1) — assistants learn from corrections; one file per assistant. node tests/unit/v740assistrules.test.mjs
import assert from "node:assert/strict";
const mem = new Map(); globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), key: (i) => [...mem.keys()][i], get length() { return mem.size; } };
const S = await import("../../web-src/spaces.js");
assert.equal(S.ruleFromCorrection({ input: "price of a 50 t crane per day", corrected: "9,000 EGP a day with the operator", note: "" }), "When asked something like “price of a 50 t crane per day”, the right answer is: 9,000 EGP a day with the operator");
assert.equal(S.ruleFromCorrection({ note: "Always answer in Egyptian Arabic" }), "Always answer in Egyptian Arabic");
const a = S.upsertAssistant({ emoji: "🏗️", name: "Crane quotes", desc: "", instructions: "You price crane jobs.", starters: [] });
S.learnRule(a.id, { note: "Always add 14% VAT" }); S.learnRule(a.id, { note: "Always add 14% VAT" });
S.learnRule(a.id, { input: "50 t", corrected: "9,000 EGP a day" });
assert.equal(S.rulesFor(a.id).length, 2, "the same rule is kept once");
const blk = S.spaceBlock({ assistant: a, question: "x" });
assert.match(blk, /WHAT THIS USER TAUGHT YOU/); assert.match(blk, /- Always add 14% VAT/);
const file = S.exportAssistant(a);
assert.match(file, /"kind": "attune-assistant"/); assert.doesNotMatch(file, /"id":/);
const b = S.importAssistant(file);
assert.notEqual(b.id, a.id); assert.equal(b.name, "Crane quotes"); assert.equal(S.rulesFor(b.id).length, 2, "the rules come with the file");
assert.throws(() => S.importAssistant("{\"x\":1}"), /not an assistant file/);
console.log("v740assistrules: all passed");
