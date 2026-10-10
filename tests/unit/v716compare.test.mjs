// v6.13 — "A vs B" web answers get Gemini's comparison shape (each side's versions, a head-to-head table, which to choose).
import assert from "node:assert/strict";
import { compareParts, compareSearches, answerTemplate, wantsShape, topicKind } from "../../web-src/research.js";
assert.deepEqual(compareParts("Geely galaxy m9 vs lynk and co 900"), ["Geely galaxy m9", "lynk and co 900"]);
assert.deepEqual(compareParts("compare BYD Song Plus and Chery Tiggo 8 Pro"), ["BYD Song Plus", "Chery Tiggo 8 Pro"]);
assert.deepEqual(compareParts("الفرق بين ليبهر LTM 1100 و جروف GMK5100"), ["ليبهر LTM 1100", "جروف GMK5100"]);
assert.deepEqual(compareParts("iPhone 17 Pro ولا Galaxy S26 Ultra؟"), ["iPhone 17 Pro", "Galaxy S26 Ultra"]);
assert.equal(compareParts("how do I compare two quotes"), null);
assert.equal(compareParts("Lynk & Co 900 price"), null);
const q = "Geely galaxy m9 vs lynk and co 900";
assert.equal(topicKind(q), "vehicle");
assert.equal(wantsShape(q), true);
const s = compareSearches(q);
assert.ok(s.length >= 5 && s.some((x) => /galaxy m9 trims prices/i.test(x)) && s.some((x) => /lynk and co 900 trims prices/i.test(x)) && /vs/.test(s[0]), "searches for each side and the comparison: " + s.join(" | "));
const t = answerTemplate(q);
assert.match(t, /COMPARISON/); assert.match(t, /## Geely galaxy m9 — a table/); assert.match(t, /## lynk and co 900 — the same table/);
assert.match(t, /Head to head — a table: \| \| Geely galaxy m9 \| lynk and co 900 \| Better \|/); assert.match(t, /Which to choose/);
assert.doesNotMatch(answerTemplate("Lynk & Co 900"), /COMPARISON/, "a single subject keeps its own template");
console.log("v716compare ok");
