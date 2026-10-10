// Retrieval check for Knowledge (no model): hit@k on the 104 fact questions, how many questions get facts at all,
// what unrelated questions get, and the time per lookup.   node tests/trials/knowcal.mjs
import { FACTS } from "./factpack-data.mjs";
import * as K from "../../web-src/knowledge.js";
const pack = [...new Set(FACTS.map((f) => f[1]))];
const kn = K.createKnowledge(K.memoryStore());
for (const [i, p] of pack.entries()) await kn.add({ title: "", text: p, id: "p" + i });
let t0 = performance.now(); await kn.ensure(); console.log("index ms", (performance.now() - t0).toFixed(1));
let hit = 0, any = 0, ms = 0, worst = 0;
const miss = [];
for (const [g, p, q, re] of FACTS) {
  const a = performance.now(); const h = await kn.find(q); const d = performance.now() - a; ms += d; worst = Math.max(worst, d);
  if (h.length) any++;
  if (h.some((x) => x.chunk.text === p || re.test(x.chunk.text))) hit++; else miss.push(q);
}
console.log(`hit ${hit}/${FACTS.length}, with facts ${any}, avg ${(ms / FACTS.length).toFixed(2)} ms, worst ${worst.toFixed(1)} ms`);
if (process.env.V) console.log(miss.join("\n"));
const OFF = ["hi", "thanks!", "write me a poem about the sea", "how do I reverse a list in python", "tell me a joke", "what is the capital of france", "explain quantum entanglement simply", "ازيك", "اكتب لي ايميل للمدير", "what is love?", "how to cook rice", "best phone in 2026?"];
for (const q of OFF) { const h = await kn.find(q); if (h.length) console.log("unrelated got facts:", q, "→", h[0].chunk.text.slice(0, 60)); }
