// v6.16 — the subject packs are used to SOLVE, not only quoted: a code task or a problem still looks things up, the facts block
// tells the model to use the formulas / docs / worked examples as its method and work it out step by step, and code keeps its lines.
const K = await import("../../web-src/knowledge.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const kn = K.createKnowledge(K.memoryStore());
let asked = [];
kn.packSearch = async (q) => { asked.push(q); return [
  { id: "physics:1", pack: "physics", title: "University Physics Volume 1 — Motion Along a Straight Line — Motion with Constant Acceleration", text: "For constant acceleration x = x_0 + v_0 t + 1/2 a t^2. Example: Calculating Displacement of an Accelerating Car. A car starts from rest and accelerates at 2.0 m/s² for 5.0 s. Use x = ½ a t² = 0.5 × 2.0 × 25 = 25 m.", url: "u" },
  { id: "coding:1", pack: "coding", title: "Python docs — Data Structures › More on Lists", text: "An example that uses most of the list methods::\n\n   >>> fruits = ['orange', 'apple', 'pear']\n   >>> fruits.count('apple')\n   1", url: "u" }]; };
const q = "Write a python function to count how many times apple is in a list";
ok(!K.wantsFacts(q), "a code task alone would not look anything up (the old rule)");
let h = await kn.find(q, { solve: true });
ok(asked.length === 1 && h.some((x) => x.chunk.pack === "coding"), "…but as a task to solve it searches the packs and finds the Python docs");
const blk = K.factsBlock(h, q);
ok(/reference packs on this phone/.test(blk) && /work it out yourself step by step/.test(blk) && /adapt the code/.test(blk), "the facts block says: use the passages as the method, work it out step by step, adapt the code");
ok(/\n   >>> fruits = \['orange', 'apple', 'pear'\]\n   >>> fruits.count\('apple'\)/.test(blk), "code keeps its lines and indentation in the block");
const p = "A car starts from rest and accelerates at 3 m/s² for 4 s. Calculate how far it travels.";
h = await kn.find(p, { solve: true });
const pb = K.factsBlock(h, p);
ok(h.length && h[0].chunk.pack === "physics" && /step by step/.test(pb) && /1\/2 a t\^2/.test(pb), "a physics problem gets the formula and the worked example, and is told to solve step by step");
const plain = K.factsBlock(h, "What is constant acceleration?");
ok(!/work it out yourself/.test(plain) && /answer from them only/.test(plain), "a plain lookup question still answers from the passages only");
ok(/احسب|خطوة بخطوة/.test("احسب المسافة خطوة بخطوة") && /work it out yourself/.test(K.factsBlock(h, "احسب المسافة التي تقطعها السيارة")), "Arabic: «احسب…» is a task to solve too");
console.log(fail ? `${fail} FAILED` : "v726solve ok");
process.exit(fail ? 1 : 0);
