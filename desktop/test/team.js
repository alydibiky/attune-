// v9.9.8 M4: the computer's team (a small helper of the same family drafts, the big model checks).
"use strict";
const assert = require("assert");
const T = require("../lib/team");
const GB = 1024 ** 3;
const M = (id, source, gb, extra) => ({ id, source, label: id, sizeBytes: gb * GB, modelFile: "/m/" + id + "/model.gguf", ...(extra || {}) });
const big = M("xl", "unsloth/Qwen3.5-9B-GGUF:IQ4_NL", 5.6), small = M("xs", "unsloth/Qwen3.5-0.8B-GGUF:Q4_K_M", 0.55), mid = M("md", "unsloth/Qwen3.5-4B-GGUF:Q4_K_M", 2.8);
const gemma = M("max", "unsloth/gemma-4-12b-it-GGUF:UD-Q4_K_XL", 7.4), moe = M("moe-xl", "unsloth/Qwen3.6-35B-A3B-GGUF:UD-IQ4_XS", 17.7);
const pc16 = { totalRamBytes: 16 * GB, vramGB: 8 }, pc8 = { totalRamBytes: 8 * GB, vramGB: 0 };
assert.strictEqual(T.familyOf(big), "qwen3.5"); assert.strictEqual(T.familyOf(moe), "qwen3.6"); assert.strictEqual(T.familyOf(gemma), "gemma4");
assert.strictEqual(T.paramsOf(small), 0.8); assert.strictEqual(T.paramsOf(moe), 35); assert.strictEqual(T.paramsOf(big), 9);
assert.strictEqual(T.pickDraft(big, [big, small, mid], pc16).id, "xs");                       // 9B + its 0.8B helper
assert.strictEqual(T.pickDraft(big, [big, mid], pc16), null);                                 // a 4B is no helper (> 1.5 B)
assert.strictEqual(T.pickDraft(gemma, [gemma, small], pc16), null);                           // another family never drafts
assert.strictEqual(T.pickDraft(moe, [moe, small], pc16), null);                               // Qwen3.6 ≠ Qwen3.5 words
assert.strictEqual(T.pickDraft(small, [small, M("xs2", "Qwen3.5-0.8B", 0.5)], pc16), null);  // a small model alone is fast already
assert.strictEqual(T.pickDraft(big, [big, small], pc8), null);                                // 8 GB computer: 5.6 + 0.55 GB don't fit → alone
assert.strictEqual(T.pickDraft(mid, [mid, small], pc8).id, "xs");                             // …but the 4B + 0.8B do
assert.strictEqual(T.pickDraft(big, [big, small], pc16, { on: false }), null);                // switched off → alone
const g = T.draftArgs(small, true), c = T.draftArgs(small, false);
assert.ok(g.includes("-md") && g.includes(small.modelFile) && g.includes("-ngld") && !g.includes("none"));
assert.ok(c.includes("-devd") && c[c.indexOf("-ngld") + 1] === "0");
// the engine passes the helper to llama-server and names it
const { Engine } = require("../lib/engine");
const e = new Engine({ engineRoots: [], logFile: "/dev/null" });
const a = e.args(big, { genThreads: 4 }, true, small);
assert.ok(a.includes("-md") && a.indexOf("-md") > a.indexOf("-m"));
assert.ok(!e.args(big, { genThreads: 4 }, true, null).includes("-md"));
console.log("team: all checks passed");
