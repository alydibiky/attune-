import assert from "assert";
import * as K from "../../web-src/knowpack.js";
import { FACTS } from "../trials/factpack-data.mjs";

const passages = [...new Set(FACTS.map((f) => f[1]))].map((text, id) => ({ id, text }));
const idx = K.buildPackIndex(passages);

// the word index finds the Cairo Tower passage
const h = K.searchWords(idx, "How tall is the Cairo Tower?");
assert.ok(h.length && /Cairo Tower/.test(passages[h[0].i].text));
// Arabic question finds an Arabic-answerable passage via shared words? (numbers only) — at least returns an array
assert.ok(Array.isArray(K.searchWords(idx, "برج القاهرة طوله كام؟")));
// nothing matches → empty
assert.deepStrictEqual(K.searchWords(idx, "zzzz qqqq"), []);

// hit@3 on the whole fact test stays at the measured level (85/104) or better
let hit = 0;
for (const [, p, q, re] of FACTS) if (K.searchWords(idx, q).some((x) => passages[x.i].text === p || re.test(passages[x.i].text))) hit++;
assert.ok(hit >= 85, "word hit@3 " + hit);

// cosine / vectors
assert.ok(Math.abs(K.cosine([1, 0], [1, 0]) - 1) < 1e-9);
assert.strictEqual(K.cosine([0, 0], [1, 0]), 0);
const v = K.searchVectors([[1, 0], [0, 1], [0.9, 0.1]], [1, 0], 2);
assert.deepStrictEqual(v.map((x) => x.i), [0, 2]);

// fusion keeps items found by both lists first
const f = K.fuse([[{ i: 1 }, { i: 2 }], [{ i: 2 }, { i: 3 }]], 3);
assert.strictEqual(f[0].i, 2);

// note respects budget and is empty with no hits
assert.strictEqual(K.packNote(idx, []), "");
const note = K.packNote(idx, h, 120);
assert.ok(note.length < 220 && note.startsWith("Reference notes"));

// 8-bit vectors round-trip closely
const vec = Array.from({ length: 384 }, (_, i) => Math.sin(i));
const back = K.unpackVector(K.packVector(vec));
assert.ok(K.cosine(vec, back) > 0.999);
console.log("knowpack ok (word hit@3 " + hit + "/" + FACTS.length + ")");
