// Knowledge through the chat prompt path: the 104 fact questions with and without Knowledge, on a running llama-server.
//   TRIAL_PORT=8120 [LIMIT=n] [MODES=none,know] node tests/trials/knowchat.mjs > tests/trials/knowchat-<model>.md
// The request is built the way Chat builds it for a small model (levels 1–2): the short system prompt (boost.js compactSystem),
// the honesty and no-code rules, then the user turn = the facts block (knowledge.js factsBlock) + the question + the language hint.
// The answer is cleaned the way Chat does (checkFacts removes the tags) and graded by code. Also: lookup time, answer time, prompt size.
import { FACTS } from "./factpack-data.mjs";
import * as K from "../../web-src/knowledge.js";
import { compactSystem, HONESTY_RULE, NO_CODE_RULE } from "../../web-src/boost.js";

const PORT = process.env.TRIAL_PORT || 8120;
const MODES = (process.env.MODES || "none,know").split(",");
const items = FACTS.slice(0, +process.env.LIMIT || FACTS.length);
const langHint = (t) => { const ar = (t.match(/[؀-ۿ]/g) || []).length, la = (t.match(/[A-Za-z]/g) || []).length;
  return ar + la < 3 ? "" : ar > la ? "\n\n(اكتب الرد بالعربي — بالمصري لو السؤال بالمصري.)" : la > ar * 3 ? "\n\n(Write the reply in English.)" : ""; };
const toLatin = (s) => String(s).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/٫/g, ".").replace(/٬/g, ",");

const kn = K.createKnowledge(K.memoryStore());
const pack = [...new Set(FACTS.map((f) => f[1]))];
for (const [i, p] of pack.entries()) await kn.add({ id: "f" + i, title: "", text: p });
await kn.ensure();
const system = compactSystem(new Date().toDateString()) + "\n\n" + HONESTY_RULE + "\n" + NO_CODE_RULE;

async function ask(user) {
  const t = Date.now();
  const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: 200, temperature: 0.1, chat_template_kwargs: { enable_thinking: false } }) });
  const j = await r.json();
  return { text: String(j.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, ""), ms: Date.now() - t, prompt: j.usage?.prompt_tokens || 0, gen: j.usage?.completion_tokens || 0 };
}
const S = Object.fromEntries(MODES.map((m) => [m, { ok: 0, eg: 0, cr: 0, gen: 0, ar: 0, ms: 0, prompt: 0, toks: 0, chips: 0 }]));
let look = 0, lookMax = 0, withFacts = 0;
for (const [grp, , q, re, lang] of items) {
  const t = performance.now(); const hits = await kn.find(q); const d = performance.now() - t; look += d; lookMax = Math.max(lookMax, d);
  if (hits.length) withFacts++;
  for (const m of MODES) {
    const user = (m === "know" && hits.length ? K.factsBlock(hits, q) : "") + q + langHint(q);
    const a = await ask(user);
    const text = m === "know" && hits.length ? K.checkFacts(a.text, hits) : { text: a.text, chips: [] };
    const s = S[m]; s.ms += a.ms; s.prompt += a.prompt; s.toks += a.gen; s.chips += text.chips.length ? 1 : 0;
    if (re.test(toLatin(text.text))) { s.ok++; s[grp]++; if (lang === "ar") s.ar++; }
  }
}
const n = items.length, g = (k) => items.filter((f) => f[0] === k).length, nAr = items.filter((f) => f[4] === "ar").length;
console.log(`questions ${n}; got facts ${withFacts}; lookup avg ${(look / n).toFixed(2)} ms, max ${lookMax.toFixed(1)} ms`);
console.log(`| Mode | Correct | Egypt (${g("eg")}) | Cranes (${g("cr")}) | General (${g("gen")}) | Arabic (${nAr}) | avg answer s | avg prompt tok | answers with chip |\n|---|---|---|---|---|---|---|---|---|`);
for (const m of MODES) { const s = S[m]; console.log(`| ${m} | ${s.ok}/${n} | ${s.eg} | ${s.cr} | ${s.gen} | ${s.ar} | ${(s.ms / n / 1000).toFixed(1)} | ${Math.round(s.prompt / n)} | ${s.chips} |`); }
