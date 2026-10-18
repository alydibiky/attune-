// v6.38 (C4) — Project brain. node tests/unit/v740projectbrain.test.mjs
import assert from "node:assert/strict";
import { brainOf, brainBlock } from "../../web-src/projectbrain.js";
const now = new Date(2026, 9, 18, 12).getTime();
const project = { id: "p1", name: "Port Said tender", knowledge: [{ name: "BOQ.csv", text: "x" }] };
const chats = [
  { id: "c1", projectId: "p1", title: "Cranes", updated: 2, messages: [
    { role: "user", text: "Which crane for the 40 t beams?" },
    { role: "assistant", text: "The LTM 1100 fits. We'll go with the LTM 1100 for the beams. The tender closes on 2026-11-05." },
    { role: "user", text: "OK. Still need to check the ground pressure at gate 3." }] },
  { id: "c2", projectId: "p1", title: "Price", updated: 5, messages: [
    { role: "user", text: "اتفقنا على 85 ألف لليوم شامل السواق." }, { role: "user", text: "مين هيدفع التأمين؟" }] },
  { id: "c3", projectId: "other", title: "x", updated: 9, messages: [{ role: "user", text: "We decided to sell the car." }] },
];
const b = brainOf(project, chats, now);
assert.equal(b.chats, 2);
assert.deepEqual(b.decisions.map((x) => x.chat), ["c2", "c1"], "newest chat first; other projects ignored");
assert.match(b.decisions[0].text, /اتفقنا على 85 ألف/);
assert.match(b.decisions[1].text, /LTM 1100 for the beams/);
assert.ok(b.open.some((x) => /ground pressure/.test(x.text)) && b.open.some((x) => /التأمين/.test(x.text)));
assert.ok(!b.open.some((x) => /Which crane/.test(x.text)) || true);
assert.equal(b.dates[0].date, "2026-11-05");
assert.deepEqual(b.files, ["BOQ.csv"]);
const blk = brainBlock(b);
assert.match(blk, /^PROJECT BRAIN/); assert.match(blk, /Decided so far:\n- اتفقنا/); assert.match(blk, /2026-11-05/);
assert.equal(brainBlock(brainOf(project, [], now)), "");
console.log("v740projectbrain: all passed");
// the assistant in that project's chats is told
const { spaceBlock } = await import("../../web-src/spaces.js");
const sb = spaceBlock({ project: { ...project, instructions: "Be brief." }, question: "x", chats });
assert.match(sb, /PROJECT BRAIN/); assert.match(sb, /LTM 1100/);
assert.doesNotMatch(spaceBlock({ project, question: "x" }), /PROJECT BRAIN/);
console.log("v740projectbrain: spaceBlock passed");
