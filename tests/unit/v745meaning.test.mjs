// v6.45 Recall phase 2 (meaning.js): the text a thing is understood by, its fingerprint, what still needs numbers,
// the nearest things, and the merge with the word search. The real model's trial: tests/trials/meaning.mjs (8/8 vs 4/8).
import * as M from "../../web-src/meaning.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const d = (id, text, ts = 1) => ({ id, title: "", text, ts });
const a = d("a", "electricity bill 412"), b = d("b", "ركنت العربية في الجراج"), c = d("c", "x");
ok(M.textOf({ title: "T", text: "a  b\n c" }) === "T\na b c" && M.textOf(d("z", "y".repeat(2000))).length === 700, "the text: title + text, spaces folded, 700 letters at most");
ok(M.keyOf(a) === M.keyOf({ ...a }) && M.keyOf(a) !== M.keyOf({ ...a, text: "electricity bill 413" }), "a fingerprint that changes with the text");
ok(M.missing([a, b, c], new Map([[M.keyOf(a), [1]]])).map((x) => x.id).join() === "b", "only the changed / new things get numbers (and not a 1-letter one)");
const V = { a: [1, 0, 0], b: [0, 1, 0] }, near = M.nearest([a, b], (x) => V[x.id], [0.2, 0.9, 0]);
ok(near.length === 1 && near[0].doc.id === "b", "nearest: only the close one (cosine ≥ " + M.MIN_SIM + ")");
const f = M.fuseHits([{ doc: a, score: 3, snip: "bill" }], [{ doc: b, sim: 0.8 }, { doc: a, sim: 0.6 }]);
ok(f[0].doc.id === "a" && f[0].by === "both" && f[1].doc.id === "b" && f[1].by === "meaning" && f[1].snip.includes("ركنت"), "fused: found both ways first; a meaning-only hit keeps its line");
ok(M.MODEL.bytes === 437778496 && M.MODEL.licence === "MIT", "the model: bge-m3, 438 MB, MIT");
ok(M.nativeEmbed(null, null) === null, "no phone bridge → no meaning search (words only)");
