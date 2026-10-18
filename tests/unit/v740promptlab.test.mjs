// v6.40 (W5) — Prompt lab helpers. node tests/unit/v740promptlab.test.mjs
import assert from "node:assert/strict";
import { fill, compare, keep, loadMine } from "../../web-src/promptlab.js";
assert.equal(fill("Summarise: {input}", "Hello"), "Summarise: Hello");
assert.equal(fill("Reply politely to [paste here]", "the client"), "Reply politely to the client");
assert.equal(fill("Translate to Arabic.", "Good morning"), "Translate to Arabic.\n\nGood morning");
assert.equal(fill("X {{text}}", ""), "X {{text}}");
const c = compare({ text: "one two three", ms: 900 }, { text: "one", ms: 1200 });
assert.equal(c.faster, "a"); assert.equal(c.shorter, "b"); assert.equal(c.a.words, 3);
const mem = new Map(); const s = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
keep("Summarise in 3 lines: {input}", "Short summary", s, 1); keep("Summarise in 3 lines: {input}", "Again", s, 2);
assert.equal(loadMine(s).length, 1, "the same prompt is kept once"); assert.equal(loadMine(s)[0].title, "Again");
console.log("v740promptlab: all passed");
