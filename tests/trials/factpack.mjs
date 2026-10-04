// Knowledge-pack bench: does a small downloaded pack + on-device retrieval make answers right?
//   TRIAL_PORT=8120 [EMB_PORT=8130] [MODES=none,bm25,embed] [LIMIT=n] node tests/trials/factpack.mjs
// none  = the model alone; bm25 = the app's word index (web-src/docqa.js) over the pack, top 3 passages;
// embed = a small multilingual embedding model (llama-server --embedding on EMB_PORT), cosine top 3.
// Also prints retrieval hit@3 for both retrievers (no model needed for that part).
import { FACTS } from "./factpack-data.mjs";
import { words } from "../../web-src/docqa.js";

const PORT = process.env.TRIAL_PORT || 8120, EMB = process.env.EMB_PORT;
const MODES = (process.env.MODES || (EMB ? "none,bm25,embed" : "none,bm25")).split(",").filter(Boolean);
const items = FACTS.slice(0, +process.env.LIMIT || FACTS.length);
const pack = [...new Set(FACTS.map((f) => f[1]))];
const packBytes = pack.reduce((s, p) => s + Buffer.byteLength(p), 0);

// ---- word index (same scoring idea as the document reader: idf-weighted overlap) ----
const docs = pack.map((p) => new Set(words(p)));
const df = new Map(); for (const d of docs) for (const w of d) df.set(w, (df.get(w) || 0) + 1);
function bm25(q, k = 3) {
  const qs = [...new Set(words(q))];
  return docs.map((d, i) => [qs.reduce((s, w) => s + (d.has(w) ? Math.log(1 + pack.length / df.get(w)) : 0), 0), i])
    .sort((a, b) => b[0] - a[0]).slice(0, k).filter((x) => x[0] > 0).map((x) => x[1]);
}
// ---- embeddings ----
async function embed(texts) {
  const r = await fetch(`http://127.0.0.1:${EMB}/v1/embeddings`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input: texts }) });
  const j = await r.json(); return j.data.map((d) => d.embedding);
}
const cos = (a, b) => { let s = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { s += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return s / Math.sqrt(x * y); };
const PFX = process.env.EMB_PREFIX === "0" ? ["", ""] : ["query: ", "passage: "];
let packVec = null;
async function dense(q, k = 3) {
  if (!packVec) { packVec = []; for (let i = 0; i < pack.length; i += 1) packVec.push(...await embed(pack.slice(i, i + 1).map((p) => PFX[1] + p))); }
  const [v] = await embed([PFX[0] + q]);
  return packVec.map((p, i) => [cos(p, v), i]).sort((a, b) => b[0] - a[0]).slice(0, k).map((x) => x[1]);
}
const toLatin = (s) => String(s).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[٫]/g, ".").replace(/٬/g, ",");
async function ask(q, ctx) {
  const sys = ctx ? "Answer briefly. Use the reference notes if they help.\n\nReference notes:\n" + ctx.map((i) => "- " + pack[i]).join("\n") : "Answer briefly.";
  const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "system", content: sys }, { role: "user", content: q }], max_tokens: 120, temperature: 0, chat_template_kwargs: { enable_thinking: false } }) });
  const j = await r.json(); return String(j.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "");
}

console.log(`pack: ${pack.length} passages, ${(packBytes / 1024).toFixed(1)} KB; ${items.length} questions`);
const hit = { bm25: 0, embed: 0 };
const score = Object.fromEntries(MODES.map((m) => [m, { all: 0, ar: 0, eg: 0, cr: 0, gen: 0 }]));
const nAr = items.filter((f) => f[4] === "ar").length;
for (const [grp, passage, q, re, lang] of items) {
  const gold = pack.indexOf(passage);
  const has = (r) => r && r.some((i) => i === gold || re.test(pack[i]));
  const rb = bm25(q); if (has(rb)) hit.bm25++;
  const rd = EMB ? await dense(q) : null; if (has(rd)) hit.embed++;
  for (const m of MODES) {
    const a = toLatin(await ask(q, m === "none" ? null : m === "bm25" ? rb : rd));
    if (re.test(a)) { const s = score[m]; s.all++; s[grp]++; if (lang === "ar") s.ar++; }
  }
}
const n = items.length, g = (k) => items.filter((f) => f[0] === k).length;
console.log(`retrieval hit@3: words ${hit.bm25}/${n}` + (EMB ? `, embeddings ${hit.embed}/${n}` : ""));
console.log(`| Mode | Correct | Egypt (${g("eg")}) | Cranes (${g("cr")}) | General (${g("gen")}) | Arabic questions (${nAr}) |\n|---|---|---|---|---|---|`);
for (const m of MODES) { const s = score[m]; console.log(`| ${m} | ${s.all}/${n} | ${s.eg} | ${s.cr} | ${s.gen} | ${s.ar} |`); }
